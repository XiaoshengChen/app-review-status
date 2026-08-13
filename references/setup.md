# Setup

## Requirements

- Node.js 18 or newer.
- An App Store Connect team or individual API key with access to the target apps.
- The downloaded `.p8` private key stored outside this repository.

## Create a private config

Copy the relevant example to a private directory outside the checkout:

- Team key: `references/config.example.json`
- Individual key: `references/config.individual.example.json`

Replace placeholders locally. `issuerId` is required only for team keys. `appIds` is optional; omit it to check every app visible to the API key.

Restrict the private key on macOS or Linux:

```bash
chmod 600 /absolute/path/to/AuthKey_KEY_ID.p8
```

Never paste the private key into a prompt, config file, issue, log, or repository.

## Run

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json
```

For JSON:

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json --format json
```
