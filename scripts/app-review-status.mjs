#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const API_ORIGIN = "https://api.appstoreconnect.apple.com";

function fail(message, exitCode = 1) {
  process.stderr.write(`app-review-status: ${message}\n`);
  process.exit(exitCode);
}

function expandPath(input) {
  if (typeof input !== "string") return input;
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return path.resolve(input);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`cannot read ${label} at ${filePath}: ${error.message}`);
  }
}

function parseArgs(argv) {
  const args = { format: "markdown", allVersions: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--config") args.configPath = argv[++i];
    else if (token === "--fixture") args.fixturePath = argv[++i];
    else if (token === "--format") args.format = argv[++i];
    else if (token === "--all-versions") args.allVersions = true;
    else if (token === "--help" || token === "-h") args.help = true;
    else fail(`unknown argument: ${token}`);
  }
  if (!args.help && !args.configPath && !args.fixturePath) {
    fail("pass --config for a live check or --fixture for an offline test");
  }
  if (!['markdown', 'json'].includes(args.format)) fail("--format must be markdown or json");
  return args;
}

function printHelp() {
  process.stdout.write(`Usage:
  node scripts/app-review-status.mjs --config /absolute/path/config.json
  node scripts/app-review-status.mjs --config config.json --format json
  node scripts/app-review-status.mjs --config config.json --all-versions
  node scripts/app-review-status.mjs --fixture references/demo-response.json

Options:
  --config PATH       Private config for a live API check
  --fixture PATH      Offline fixture; never calls Apple
  --format TYPE       markdown (default) or json
  --all-versions      Return all versions instead of the latest per platform
`);
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function makeJwt(config) {
  const keyPath = expandPath(config.privateKeyPath);
  if (!keyPath) fail("config.privateKeyPath is required");
  if (!config.keyId) fail("config.keyId is required");

  let privateKey;
  let stat;
  try {
    stat = fs.statSync(keyPath);
    privateKey = fs.readFileSync(keyPath, "utf8");
  } catch (error) {
    fail(`cannot read private key at ${keyPath}: ${error.message}`);
  }
  if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
    fail(`private key permissions are too broad; run chmod 600 ${keyPath}`);
  }

  const keyType = config.keyType || (config.issuerId ? "team" : "individual");
  if (!['team', 'individual'].includes(keyType)) fail("config.keyType must be team or individual");
  if (keyType === "team" && !config.issuerId) fail("config.issuerId is required for a team key");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    ...(keyType === "individual" ? { sub: "user" } : { iss: config.issuerId }),
    iat: now,
    exp: now + 600,
    aud: "appstoreconnect-v1",
  }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${signature.toString("base64url")}`;
}

async function apiRequest(resourcePath, jwt) {
  const response = await fetch(new URL(resourcePath, API_ORIGIN), {
    headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.errors?.map((item) => item.detail || item.title).filter(Boolean).join("; ");
    throw new Error(`Apple API ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return body;
}

async function apiList(resourcePath, jwt) {
  let url = new URL(resourcePath, API_ORIGIN);
  const rows = [];
  while (url) {
    const body = await apiRequest(url, jwt);
    rows.push(...(Array.isArray(body.data) ? body.data : []));
    url = body?.links?.next ? new URL(body.links.next) : null;
  }
  return rows;
}

async function collectLive(config) {
  const jwt = makeJwt(config);
  const requestedIds = new Set((config.appIds || []).map(String));
  let apps;

  if (requestedIds.size > 0) {
    apps = await Promise.all([...requestedIds].map(async (id) => {
      const body = await apiRequest(`/v1/apps/${encodeURIComponent(id)}`, jwt);
      return body.data;
    }));
  } else {
    apps = await apiList("/v1/apps?limit=200", jwt);
  }

  const observations = [];
  for (const app of apps.filter(Boolean)) {
    const versions = await apiList(
      `/v1/apps/${encodeURIComponent(app.id)}/appStoreVersions?limit=200&fields[appStoreVersions]=platform,versionString,appVersionState,appStoreState,createdDate`,
      jwt,
    );
    for (const version of versions) {
      observations.push({
        appId: app.id,
        appName: app.attributes?.name || app.id,
        bundleId: app.attributes?.bundleId || null,
        versionId: version.id,
        version: version.attributes?.versionString || "unknown",
        platform: version.attributes?.platform || "UNKNOWN",
        state: version.attributes?.appVersionState || version.attributes?.appStoreState || "UNKNOWN",
        createdDate: version.attributes?.createdDate || null,
      });
    }
  }
  return observations;
}

function naturalVersionCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function newestPerPlatform(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.appId}:${row.platform}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map((group) => [...group].sort((a, b) => {
    const dateDelta = Date.parse(b.createdDate || 0) - Date.parse(a.createdDate || 0);
    return Number.isNaN(dateDelta) || dateDelta === 0
      ? naturalVersionCompare(b.version, a.version)
      : dateDelta;
  })[0]);
}

function sortRows(rows) {
  return [...rows].sort((a, b) =>
    a.appName.localeCompare(b.appName)
    || a.platform.localeCompare(b.platform)
    || naturalVersionCompare(b.version, a.version));
}

function escapeCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderMarkdown(result) {
  const lines = [
    "# App Store Connect Review Status",
    "",
    `Checked: ${result.checkedAt}`,
    "",
  ];
  if (result.versions.length === 0) {
    lines.push("No App Store versions were found. Check the API key's app access and the optional `appIds` filter.");
    return `${lines.join("\n")}\n`;
  }
  lines.push("| App | Version | Platform | Status |", "| --- | --- | --- | --- |");
  for (const row of result.versions) {
    lines.push(`| ${escapeCell(row.appName)} | ${escapeCell(row.version)} | ${escapeCell(row.platform)} | \`${escapeCell(row.state)}\` |`);
  }
  if (result.versions.some((row) => ["REJECTED", "METADATA_REJECTED", "INVALID_BINARY"].includes(row.state))) {
    lines.push("", "> Apple’s public API exposes the rejection state, but not the App Review message or rejection explanation.");
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  let observations;
  if (args.fixturePath) {
    const fixture = readJson(expandPath(args.fixturePath), "fixture");
    observations = fixture.observations || [];
  } else {
    const config = readJson(expandPath(args.configPath), "config");
    try {
      observations = await collectLive(config);
    } catch (error) {
      fail(error.message);
    }
  }

  const selected = args.allVersions ? observations : newestPerPlatform(observations);
  const result = {
    checkedAt: new Date().toISOString(),
    mode: args.allVersions ? "all-versions" : "latest-per-platform",
    versions: sortRows(selected),
  };
  process.stdout.write(args.format === "json"
    ? `${JSON.stringify(result, null, 2)}\n`
    : renderMarkdown(result));
}

await main();
