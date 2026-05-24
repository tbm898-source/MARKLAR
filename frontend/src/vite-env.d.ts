/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute base URL of the FieldPulse backend.
   *
   * - Leave empty / unset (default) to use same-origin `/api`. This is the
   *   correct value for local dev (via Vite proxy), the Electron desktop app,
   *   and the production single-server mode where the backend serves the
   *   built frontend.
   * - Set to an absolute origin (e.g. `https://api.example.com`) to enable
   *   the hosted-API deployment mode where the frontend is served from a
   *   different origin than the backend. The backend must allow the
   *   frontend's origin via `CORS_ALLOWED_ORIGINS`.
   *
   * Trailing slashes are stripped; the `/api` suffix is added by the client.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
