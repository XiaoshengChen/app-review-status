# Setup

Use this guide whenever the user does not yet have a working private config. Do not request or display private-key contents.

## Requirements

- Node.js 18 or newer.
- An App Store Connect team or individual API key with access to the target apps.
- The downloaded `.p8` private key stored outside this repository.

## 1. Get an App Store Connect API key

Open [App Store Connect](https://appstoreconnect.apple.com/). Apple documents the current flows in its [official App Store Connect API guide](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/).

### Individual key — recommended for personal use

1. Sign in to App Store Connect.
2. Click the username in the top-right corner, then **Edit Profile**.
3. Under **Individual API Key**, click **Generate Key**.
4. Click **Download** and save the `.p8` file securely.
5. Note the **Key ID** shown by App Store Connect.

An individual key uses the user's existing app access, requires no Issuer ID, and Apple allows one active individual key per user.

### Team key — for centrally managed access

1. In App Store Connect, open **Users and Access** → **Integrations**.
2. If API access is not enabled, the Account Holder must click **Request Access** and complete Apple's approval flow.
3. Open **Team Keys**, then click **Generate API Key** or the `+` button.
4. Enter a reference name such as `app-review-status-readonly`.
5. Choose the least-privileged role that can view the intended apps, then generate the key.
6. Note the **Issuer ID** and **Key ID**, and download the `.p8` file.

Apple only lets users download a private API key once. Store it securely and revoke it if it is lost or exposed.

## 2. Collect only the required values

Ask the user for:

- Key type: `individual` or `team`.
- Key ID.
- Absolute local path to the downloaded `.p8` file.
- Issuer ID only for a team key.
- Optional App ID list; omit it to check every app visible to the key.

Never ask for the `.p8` contents, a JWT, an Apple Account password, or a session cookie. Do not upload credentials or put them in the skill directory.

## 3. Create a private config

Copy the relevant example to a private directory outside the checkout:

- Team key: `references/config.example.json`
- Individual key: `references/config.individual.example.json`

Replace placeholders locally. `issuerId` is required only for team keys. `appIds` is optional.

Individual-key example:

```json
{
  "keyType": "individual",
  "keyId": "YOUR_KEY_ID",
  "privateKeyPath": "/absolute/path/to/AuthKey_YOUR_KEY_ID.p8"
}
```

Team-key example:

```json
{
  "keyType": "team",
  "issuerId": "YOUR_ISSUER_ID",
  "keyId": "YOUR_KEY_ID",
  "privateKeyPath": "/absolute/path/to/AuthKey_YOUR_KEY_ID.p8"
}
```

Write the config only after the user approves its destination. Keep it outside the repository.

Restrict the private key on macOS or Linux:

```bash
chmod 600 /absolute/path/to/AuthKey_KEY_ID.p8
```

Never paste the private key into a prompt, config file, issue, log, or repository. A config stores only its path.

## 4. Validate with the offline demo

The user can see the expected output before credentials are ready:

```bash
node scripts/app-review-status.mjs --fixture references/demo-response.json
```

The demo uses fictional data and never contacts Apple.

## 5. Run the live check

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json
```

For JSON:

```bash
node scripts/app-review-status.mjs --config /absolute/path/to/config.json --format json
```

If Apple returns an authentication or authorization error, report it without claiming that there are no apps. Recheck the key type, IDs, app access, private-key path, and file permissions.
