import fs from 'fs';
import path from 'path';
import http from 'http';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.announcements',
];

function readClientSecrets() {
  const envId = process.env.GOOGLE_CLIENT_ID;
  const envSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (envId && envSecret) {
    return {
      client_id: envId,
      client_secret: envSecret,
      redirect_uris: [process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:53682/oauth2callback'],
    };
  }
  const p = path.join(ROOT, 'client_secret.json');
  if (!fs.existsSync(p)) {
    throw new Error(
      'Missing Google OAuth client. Add client_secret.json (Desktop app) from Google Cloud Console, or set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env'
    );
  }
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const installed = j.installed || j.web;
  if (!installed) {
    throw new Error('client_secret.json must contain "installed" or "web" OAuth client');
  }
  return {
    client_id: installed.client_id,
    client_secret: installed.client_secret,
    redirect_uris: installed.redirect_uris || [process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:53682/oauth2callback'],
  };
}

export async function authorizeGoogle() {
  const secrets = readClientSecrets();
  const redirectUri =
    secrets.redirect_uris[0] || process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:53682/oauth2callback';

  const oAuth2Client = new google.auth.OAuth2(secrets.client_id, secrets.client_secret, redirectUri);

  const tokenPath = path.join(ROOT, 'token.json');
  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });

    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url || !req.url.includes('oauth2callback')) {
          res.writeHead(404);
          res.end();
          return;
        }
        const qs = new URL(req.url, 'http://127.0.0.1').searchParams;
        const code = qs.get('code');
        if (!code) {
          res.writeHead(400);
          res.end('Missing code');
          server.close();
          reject(new Error('No authorization code'));
          return;
        }
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>Google authorization saved. You can close this tab.</body></html>');
        server.close();
        resolve(oAuth2Client);
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
        server.close();
        reject(e);
      }
    });

    server.listen(53682, '127.0.0.1', () => {
      console.log('Open this URL in your browser:\n');
      console.log(authUrl);
      console.log('\nWaiting for redirect on http://127.0.0.1:53682/oauth2callback ...');
    });
  });
}

export async function getAuthorizedClient() {
  const tokenPath = path.join(ROOT, 'token.json');
  if (!fs.existsSync(tokenPath)) {
    throw new Error('No token.json. Run: npm run auth-google');
  }
  const secrets = readClientSecrets();
  const redirectUri =
    secrets.redirect_uris[0] || process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:53682/oauth2callback';
  const oAuth2Client = new google.auth.OAuth2(secrets.client_id, secrets.client_secret, redirectUri);
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(tokenPath, 'utf8')));
  return oAuth2Client;
}
