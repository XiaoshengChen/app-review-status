# App Review Status Skill

A small, read-only Agent Skill that checks the current review state of App Store versions through Apple’s official App Store Connect API.

It answers questions such as:

- Is my app waiting for review?
- Has review started?
- Was the version rejected?
- Is the version ready for sale or distribution?

The public version is intentionally stateless. It does **not** create daily reports, schedule jobs, store status history, estimate review time, control a browser, or modify App Store Connect.

## How it works

1. The script reads a private local configuration file containing only the API-key type, identifiers, the local `.p8` path, and an optional list of App IDs.
2. It creates a short-lived JSON Web Token in memory:
   - Header: `alg=ES256`, `kid=<key id>`, `typ=JWT`.
   - Team-key payload: `iss`, `iat`, `exp`, and `aud=appstoreconnect-v1`.
   - Individual-key payload: `sub=user`, `iat`, `exp`, and `aud=appstoreconnect-v1`.
3. It signs the JWT with the local `.p8` private key using ES256. The key and token are never printed or written to disk.
4. It performs only authenticated `GET` requests:
   - `GET /v1/apps` or `GET /v1/apps/{id}` to resolve accessible apps.
   - `GET /v1/apps/{id}/appStoreVersions` to read version, platform, creation date, and current state.
5. By default, it selects the newest App Store version for each app/platform pair and renders a Markdown table. `--all-versions` returns every version and `--format json` returns structured JSON.

The status comes from Apple’s `appVersionState` field, with `appStoreState` used only as a compatibility fallback.

## Repository layout

```text
app-review-status/
├── SKILL.md
├── agents/openai.yaml
├── scripts/app-review-status.mjs
└── references/
    ├── config.example.json
    ├── config.individual.example.json
    ├── demo-response.json
    ├── limitations.md
    └── setup.md
```

## Requirements

- Node.js 18+
- An App Store Connect API key
- A `.p8` private key downloaded from App Store Connect

Apple supports two key types:

- **Team key:** requires an Issuer ID and uses the role assigned to that key.
- **Individual key:** does not use an Issuer ID and inherits the associated user’s app access and permissions.

Use the least-privileged role that can read the apps you want to inspect.

## Configure

Keep configuration and private keys outside the repository.

For a team key, start from `references/config.example.json`:

```json
{
  "keyType": "team",
  "issuerId": "YOUR_ISSUER_ID",
  "keyId": "YOUR_KEY_ID",
  "privateKeyPath": "/absolute/path/to/AuthKey_YOUR_KEY_ID.p8",
  "appIds": ["YOUR_APP_ID"]
}
```

For an individual key, use `references/config.individual.example.json` and omit `issuerId`:

```json
{
  "keyType": "individual",
  "keyId": "YOUR_KEY_ID",
  "privateKeyPath": "/absolute/path/to/AuthKey_YOUR_KEY_ID.p8",
  "appIds": ["YOUR_APP_ID"]
}
```

`appIds` is optional. If omitted, the script checks every app visible to the key.

On macOS or Linux, restrict the key file:

```bash
chmod 600 /absolute/path/to/AuthKey_YOUR_KEY_ID.p8
```

## Run directly

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json
```

Machine-readable output:

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json --format json
```

Return all App Store versions instead of only the newest per platform:

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json --all-versions
```

Offline demo, with no Apple request:

```bash
node scripts/app-review-status.mjs --fixture references/demo-response.json
```

## Install as an Agent Skill

Clone the repository, then place or symlink it in the skill directory used by your agent host. For Codex:

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/app-review-status.git
ln -s "$(pwd)/app-review-status" ~/.codex/skills/app-review-status
```

Then ask:

```text
Use $app-review-status to check the current App Store Connect review status with config /absolute/path/to/config.json.
```

## Example output

```markdown
# App Store Connect Review Status

Checked: 2026-01-15T09:00:00.000Z

| App | Version | Platform | Status |
| --- | --- | --- | --- |
| Example Reader | 1.2.0 | IOS | `WAITING_FOR_REVIEW` |
```

## Security properties

- Read-only: the implementation contains no POST, PATCH, PUT, or DELETE requests.
- Stateless: it does not create a history or status cache.
- Local credentials: the `.p8` key never leaves the machine except for the ES256 signature created for Apple authentication.
- Short-lived JWT: the generated token expires after 10 minutes and exists only in process memory.
- Private-key permission check: on macOS and Linux, the script refuses group- or world-readable key files.
- Credential-safe examples: the repository contains placeholders and synthetic fixtures only.

## Limitations

- Apple returns the current state, not the exact time the version entered that state.
- The API does not return the App Review conversation or detailed rejection reason.
- This project does not calculate queue duration or approval ETA.
- This project does not schedule recurring checks or send daily reports.
- Access depends on the apps and role associated with the API key.

## Official references

- [Creating API Keys for App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api)
- [Generating Tokens for API Requests](https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests)
- [List all App Store versions for an app](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-appstoreversions)

## License

MIT

— [chenxs.com](https://chenxs.com)
