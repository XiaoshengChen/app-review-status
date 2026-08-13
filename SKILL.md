---
name: app-review-status
description: Read the current App Store Connect app-version review status through Apple's official API and return a concise status snapshot. Also guide first-time setup when the user has no API key, .p8 file, Key ID, Issuer ID, or config. Use when asked whether an app is Waiting for Review, In Review, Rejected, Ready for Sale/Distribution, or in another App Store version state. This skill is read-only and stateless; do not use it for scheduling, daily digests, historical wait tracking, ETA prediction, browser automation, rejection-message retrieval, submission, release, or metadata changes.
---

# App Review Status

Read the current version state from the App Store Connect API with the bundled deterministic script. Keep the workflow read-only and stateless.

## Run

1. Check whether the user already has a private config.
2. If the config, API key, `.p8` file, Key ID, or required Issuer ID is missing, read `references/setup.md` completely and guide setup before attempting a live request.
   - Recommend an individual API key for personal use unless the user needs a team-managed key.
   - Ask only for non-secret metadata and local paths. Never ask the user to paste the private-key contents.
   - Offer the offline demo while the user obtains credentials:

     ```bash
     node scripts/app-review-status.mjs --fixture references/demo-response.json
     ```

   - Stop after giving the exact next action if setup requires the user to sign in, generate, or download a key. Resume the live check after the user confirms it is ready.
3. Run:

   ```bash
   node scripts/app-review-status.mjs --config /absolute/path/to/config.json
   ```

4. Return the script output without inventing timestamps, wait durations, rejection reasons, or ETAs.

Use `--format json` for machine-readable output and `--all-versions` when the user explicitly asks for every version instead of the latest version per platform.

## Rules

- Treat `appVersionState` returned by Apple as the source of truth, with `appStoreState` as a compatibility fallback.
- Never print, copy, upload, commit, or request the contents of a `.p8` private key or generated JWT.
- Refer to credentials only by local path. Keep config and private keys outside the repository.
- Do not search the filesystem broadly for credentials. If the user wants help locating a downloaded `.p8`, inspect only the specific folder or page they authorize.
- Do not claim the key is valid until a live API request succeeds.
- Report API errors as errors. Do not translate authentication failure into “no apps” or “no active review.”
- If a version is rejected, state only the rejection status. Apple's public API does not expose the App Review conversation or rejection explanation.
- Do not persist observations, calculate time in state, predict approval time, schedule runs, open a browser, or modify App Store Connect data.

For credential setup, read `references/setup.md`. For API boundaries, read `references/limitations.md`.
