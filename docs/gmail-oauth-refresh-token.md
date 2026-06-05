# Gmail OAuth Refresh Token — Renewal Guide

Use this guide whenever the `GMAIL_REFRESH_TOKEN` expires and the CI log shows:

```
[ingest-newsletters] Gmail error (nike): invalid_grant
[ingest-newsletters] Gmail error (adidas): invalid_grant
```

Google refresh tokens expire after approximately 6 months of inactivity, or when the Google account password changes.

---

## Prerequisites

- Access to the project `.env` file
- Access to GitHub repository secrets
- `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` already in `.env` (these do **not** expire)
- Node.js installed locally
- The Gmail account: **wiruje2@gmail.com**

---

## Step 1 — Verify credentials in `.env`

Open `.env` in the project root and confirm these two lines have values:

```env
GMAIL_CLIENT_ID=393645774444-xxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxx
GMAIL_REFRESH_TOKEN=          ← leave empty or delete this line for now
```

If `GMAIL_CLIENT_ID` or `GMAIL_CLIENT_SECRET` are missing, retrieve them from:

> [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → project **promo-scraper** → OAuth 2.0 Client ID **promo-scraper-desktop** → click the pencil icon → copy Client ID and Client Secret.

---

## Step 2 — Revoke old app access (mandatory)

Google only issues a new `refresh_token` when you grant consent for the **first time or after revocation**. Skipping this step will cause the script to succeed but return no `refresh_token`.

1. Open [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. Sign in as **wiruje2@gmail.com**
3. Find your app in the list (named **promo-scraper** or similar)
4. Click the app → **Remove access** → confirm

---

## Step 3 — Run the setup script

Open a terminal in the project root and run:

```powershell
npm run gmail-oauth-setup
```

The script prints output similar to:

```
--- Gmail OAuth (Step 3) ---

Open this URL in your browser (use wiruje2@gmail.com when asked):

https://accounts.google.com/o/oauth2/v2/auth?client_id=...

Listening on http://127.0.0.1:34567/oauth2callback …
```

**Do not close this terminal.**

---

## Step 4 — Authorize in the browser

1. Copy the full `https://accounts.google.com/...` URL from the terminal
2. Paste it into Chrome or Edge
3. Sign in as **wiruje2@gmail.com** if prompted
4. On the permissions screen click **Allow** (or **Continue** then **Allow**)
5. The browser tab will show: `Authorization successful. You can close this tab.`

---

## Step 5 — Copy the token from the terminal

After clicking Allow the terminal prints:

```
--- Success ---

Add this line to your .env (do not commit):

GMAIL_REFRESH_TOKEN=1//0gABCDEFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Copy the entire value** after `GMAIL_REFRESH_TOKEN=`.

> If you see `No refresh_token in response` instead, Step 2 was not completed. Revoke app access again and re-run `npm run gmail-oauth-setup`.

---

## Step 6 — Update `.env` locally

Open `.env` and set:

```env
GMAIL_REFRESH_TOKEN=1//0gABCDEFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Use the exact value from the terminal. Never commit this file.

---

## Step 7 — Test the ingest locally

```powershell
npm run ingest-newsletters
```

Expected output:

```
[ingest-newsletters] Wrote 185 nike deal(s) to public/data/nike_promos.json
[ingest-newsletters] Wrote 417 adidas deal(s) to public/data/adidas_promos.json
```

If it still shows `invalid_grant`, repeat from Step 2.

---

## Step 8 — Update the GitHub secret

1. Go to the repository on GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Find `GMAIL_REFRESH_TOKEN` → click the pencil icon (**Update secret**)
4. Paste the new token value
5. Click **Update secret**

---

## Step 9 — Trigger the scraper

Push any change or manually run the workflow:

1. GitHub → **Actions** → **Daily Deals Scraper**
2. **Run workflow** → **Run workflow**

After the run completes (~4 minutes), `deals.json` will include fresh Nike and Adidas deals.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `invalid_grant` in CI | Refresh token expired or revoked | Repeat this guide from Step 2 |
| `No refresh_token in response` | App access was not revoked before re-authorizing | Complete Step 2, then re-run Step 3 |
| `redirect_uri_mismatch` | OAuth client type is Web but redirect URI is missing | Add `http://127.0.0.1:34567/oauth2callback` in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your client → Authorized redirect URIs |
| `Missing GMAIL_CLIENT_ID` | `.env` not configured | Copy credentials from Google Cloud Console as described in Step 1 |
| `0 nike deals` / `0 adidas deals` after successful ingest | No matching emails in last 60 days | Check Gmail inbox at wiruje2@gmail.com for Nike/Adidas emails; verify `NEWSLETTER_QUERY_NIKE` / `NEWSLETTER_QUERY_ADIDAS` env vars if overridden |

---

## Key facts

| Item | Value |
|------|-------|
| Gmail account | wiruje2@gmail.com |
| OAuth client | promo-scraper-desktop (Desktop type) |
| Google Cloud project | promo-scraper |
| Redirect URI used by setup script | `http://127.0.0.1:34567/oauth2callback` |
| Gmail scope | `gmail.readonly` |
| Actual Nike sender domain | `official.nike.com` |
| Actual Adidas sender domain | `pl-news.adidas.com` |
| GitHub secret name | `GMAIL_REFRESH_TOKEN` |
| Token typical lifespan | ~6 months without use |
