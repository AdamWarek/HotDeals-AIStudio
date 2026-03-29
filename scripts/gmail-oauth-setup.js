/**
 * Step 3 — Obtain GMAIL_REFRESH_TOKEN (one-time per Google account)
 *
 * Prerequisite: OAuth consent screen with scope gmail.readonly, and wiruje2@gmail.com
 * added as a Test user (if app is in Testing).
 *
 * Prerequisite: Desktop OAuth client OR Web client with redirect URI below added in
 * Google Cloud Console → APIs & Services → Credentials → your client →
 * Authorized redirect URIs:
 *   http://127.0.0.1:34567/oauth2callback
 *
 * Usage:
 *   1. Put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env (do NOT set GMAIL_REFRESH_TOKEN yet).
 *   2. Run: npm run gmail-oauth-setup
 *   3. Open the printed URL, sign in as wiruje2@gmail.com, click Allow.
 *   4. Copy GMAIL_REFRESH_TOKEN from the terminal into .env
 *
 * If redirect_uri_mismatch: add the exact URI above to your OAuth client (Web type),
 * or create a new "Web application" client with that redirect and use its ID/secret.
 *
 * If refresh_token is missing: visit https://myaccount.google.com/permissions ,
 * remove access for your app, then run this script again (prompt=consent forces refresh token).
 */

import 'dotenv/config';
import http from 'http';
import { google } from 'googleapis';

const REDIRECT_PORT = 34567;
const REDIRECT_PATH = '/oauth2callback';
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}${REDIRECT_PATH}`;

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n--- Gmail OAuth (Step 3) ---\n');
  console.log('Open this URL in your browser (use wiruje2@gmail.com when asked):\n');
  console.log(authUrl);
  console.log(`\nThis machine must accept redirect to: ${REDIRECT_URI}\n`);

  const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const server = http.createServer(async (req, res) => {
    const urlPath = req.url?.split('?')[0] || '';
    if (urlPath !== REDIRECT_PATH) {
      res.writeHead(404);
      res.end();
      return;
    }

    const params = new URL(req.url || '', `http://127.0.0.1:${REDIRECT_PORT}`).searchParams;
    const err = params.get('error');
    const code = params.get('code');

    if (err) {
      const desc = params.get('error_description') || '';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><meta charset="utf-8"><p>OAuth error: <strong>${escHtml(err)}</strong></p><p>${escHtml(desc)}</p>`);
      console.error('\nOAuth error:', err, desc);
      server.close();
      process.exit(1);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing ?code=');
      server.close();
      process.exit(1);
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<!DOCTYPE html><meta charset="utf-8"><title>OK</title><p>Authorization successful. You can close this tab.</p>'
      );

      console.log('\n--- Success ---\n');
      if (tokens.refresh_token) {
        console.log('Add this line to your .env (do not commit):\n');
        console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      } else {
        console.log(
          'No refresh_token in response. Revoke app access at https://myaccount.google.com/permissions , then run npm run gmail-oauth-setup again.\n'
        );
        if (tokens.access_token) {
          console.log('(Access token was issued but without refresh_token — consent may need re-granting.)\n');
        }
      }
      server.close();
      process.exit(tokens.refresh_token ? 0 : 1);
    } catch (e) {
      console.error('\nToken exchange failed:', e?.message || e);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Token exchange failed');
      server.close();
      process.exit(1);
    }
  });

  server.listen(REDIRECT_PORT, '127.0.0.1', () => {
    console.log(`Listening on ${REDIRECT_URI} …`);
  });

  server.on('error', (e) => {
    console.error('Could not start local server (port busy?).', e.message);
    process.exit(1);
  });
}

main();
