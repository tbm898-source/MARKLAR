# Classroom + OpenAI bridge

Programmatic bridge: **OpenAI API** (ChatGPT-class drafts) and **Google Classroom** (list courses, post announcements). All **Classroom posts** are checked against **`config/aya-policy.json`** (AYA / institution-appropriate gating) before publish.

## Setup

1. `cd integrations/classroom-chatgpt-bridge`
2. `npm install`
3. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` (and optional `OPENAI_MODEL`).
4. **Google Cloud**
   - Create a project, enable **Google Classroom API**.
   - OAuth consent screen (Internal or External as your org requires).
   - Credentials → **OAuth client ID** → **Desktop app**.
   - Download JSON → save as `client_secret.json` in this folder **or** put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.
   - Add authorized redirect URI: `http://127.0.0.1:53682/oauth2callback`
5. `npm run auth-google` — complete browser login; creates `token.json` (gitignored).

## Commands

| Command | Purpose |
|--------|---------|
| `npm run auth-google` | OAuth (first time or new scopes) |
| `node src/cli.mjs courses` | List active courses (id + name) |
| `node src/cli.mjs gate --text "..."` | AYA policy check only |
| `node src/cli.mjs draft -- "prompt"` | Model draft + AYA check (no post) |
| `node src/cli.mjs post-announcement --courseId ID --text "..."` | Gate then post |
| `...post-announcement ... --dry-run` | Gate only, print body |

## AYA policy

- Edit `config/aya-policy.json` (start from `config/aya-policy.example.json`).
- Use `requiredPhrases`, `blockedPhrases`, `blockedRegex`, `blockedUrlHosts`, or strict `allowedUrlHosts` for allowlist-only links.
- `blockOnFailure` in policy controls whether `gate` exits with code 1 on failure.

## Notes

- Consumer **chat.openai.com** is separate from the **API**; this repo uses the API. Same models family, billing via OpenAI platform.
- You are responsible for compliance with Google Workspace for Education, FERPA, and district AI rules.
- Do not commit `.env`, `token.json`, or `client_secret.json`.
