# FieldPulse Lite — Admin Authentication Plan (V1)

Status: **Plan only.** This document does not change any code, schema,
env file, dependency, or runtime behavior. It defines the smallest safe
authentication posture for FieldPulse Lite's admin surface so that the
follow-up implementation PRs can be reviewed against a clear contract.

The worker submission flow stays open and unchanged. Only `/admin` and
admin-capable APIs are in scope.

---

## 1. Purpose & scope

Protect `/admin` and the admin-capable backend routes against
unauthenticated access in hosted/production deployments, without
breaking:

- The local-first worker submission flow on phones.
- The Electron desktop experience on a trusted host.
- The Goliath V1 read-only system endpoints' file/cache-only behavior.

This document is approved as a doc-only spec. No middleware, no login
page, no env-file change, and no schema change is introduced in this
PR. Implementation is sequenced in [section 8](#8-rollout-steps).

## 2. What is protected and what stays open

The route gating matrix below is the single source of truth for the
follow-up implementation PRs.

### 2.1 Open in V1 (no auth)

| Surface | Why open |
|---------|----------|
| `/worker`, `/worker/form/:action`, `/worker/confirm`, `/setup` | Kiosk / phone field flow. QR-driven; cannot prompt for credentials. |
| `POST /api/logs` | Worker submission. Must work offline-first and from a freshly scanned QR. |
| `POST /api/upload-photo` | Worker photo attach. Same justification as `POST /api/logs`. |
| `GET /api/config` | Worker form metadata (workers, sites, action labels). No PII. |
| `GET /api/setup` | Phone-onboarding payload (LAN URLs, QR target). No PII. |
| `GET /api/health` | Liveness probe. Returns a tiny `{ok, emailConfigured, clickupConfigured}` payload; no secrets. |

### 2.2 Admin-gated in V1

These are the routes that read, mutate, or report on field data. They
are the targets of the V1 admin gate.

| Route | Notes |
|-------|-------|
| `GET /admin` (HTML page) | The admin SPA entry. Unauthenticated browsers redirect to `/admin/login` (see [section 5](#5-recommendation--v1)). |
| `GET /api/logs` | Lists field entries (with filters). Primary data exposure surface. |
| `GET /api/logs/:id` | Returns a single full log record. **Added per PR 3 amendment** — same data class as the list endpoint, so it must be gated together. |
| `POST /api/logs/:id/retry-sync` | Mutates sync state and may call ClickUp on the admin's behalf. |
| `POST /api/logs/:id/mark-reviewed` | Mutates record state. |
| `POST /api/reports/email` | Sends an SMTP report containing log data. |
| `GET /api/reports/status` | Reveals whether SMTP / ClickUp credentials are configured. Not sensitive on its own but pairs with reconnaissance. |
| `GET /api/system/sentinel`, `GET /api/system/operator-health`, `GET /api/system/canonical-status` | Goliath V1 read-only host/CANONICAL state. Read-only on the backend but exposes operator surface; admin-gated in hosted/production. Local desktop keeps current behavior. |

### 2.3 Uploaded photos: `/uploads/*` (added per PR 3 amendment)

Uploaded photos are a data-exposure surface. The frontend renders them
via standard `<img src="/uploads/...">` tags, which do **not** carry
`Authorization: Bearer …` headers. That means cookie-based auth is the
only practical gate for image serving.

**V1 posture:**

- `POST /api/upload-photo` stays **open** (worker write path).
- `GET /uploads/*`:
  - **Local desktop & local dev:** unchanged. Static files served by
    `express.static(uploadsDir)`. Trusted host.
  - **Hosted / production single-server (`NODE_ENV=production`):**
    `GET /uploads/*` is **admin-gated via the session cookie** (see
    [section 5.2](#52-transports)). Bearer tokens do not flow through
    image tags, so the cookie path is the canonical solution.
  - **Hosted-API mode (frontend + backend on different origins):**
    same as production single-server, plus the cookie must be set
    `Secure; SameSite=None; HttpOnly` so the browser includes it on
    cross-origin `<img>` requests. The frontend origin must already be
    in `CORS_ALLOWED_ORIGINS` from Phase 1.

**Implementation note (deferred to the implementation PR, not this
plan):** mount the admin cookie middleware *before* `express.static`
on `/uploads`, and have it return `401` (or a 1×1 transparent fallback)
when the cookie is missing in production.

**Acceptable alternative for the first hosted release**, explicitly
called out so reviewers can opt into it:

- Treat `/uploads/*` as **public-by-unguessable-URL** for V1 and
  document the risk in `DEPLOYMENT_AND_CONFIG.md` at implementation
  time. Filenames are already random (`Date.now()-rand36.ext`), so
  collisions and direct enumeration are unlikely, but the URLs are not
  secret — anyone who has ever seen an admin page screenshot keeps the
  link. This option is **not the recommendation**, but it is the
  cheapest path if cookie wiring slips. If chosen, gating must be
  added in a follow-up before any external sharing of the admin URL.

The implementation PR must pick one of the two postures explicitly and
document the choice in the PR body.

## 3. Threat model (brief)

| Mode | Primary risk | Secondary risk | Out of scope |
|------|--------------|----------------|--------------|
| Local desktop (Electron) | Anyone on LAN can hit `/admin` over Wi-Fi if firewall is open. | Phone left unlocked at job site reaches `/admin`. | OS-level compromise. |
| Production single-server | `/admin` and `/uploads/*` are internet-reachable; full data exposure if unprotected. | Brute-force of admin secret. | DoS, CDN cache poisoning. |
| Hosted-API mode | Same as production plus cross-origin cookie misconfiguration. | Same. | Same. |
| Worker spam | Out of scope. Worker write surface stays open by design. | — | — |

Goliath V1 endpoints stay read-only at the backend regardless of
authentication. The auth gate only controls *who can read them over
HTTP*.

## 4. Options compared

|  | A. Shared admin token / password | B. Session cookie (server-issued) | C. Hosted identity provider / OIDC |
|---|---|---|---|
| UX | Bookmark `?token=…` **or** a single-field login form | Standard login form; persists until logout/expiry | Redirect to provider; "Sign in with Google" etc. |
| Server state | None | Optional (signed cookie OR server-side store) | Provider state; we verify JWT/JWKS |
| Multi-user | No (one shared secret) | Yes (with a user table — out of V1) | Yes |
| Per-user attribution in `mark-reviewed` | No | Possible | Yes |
| Mobile add-to-home / PWA | Works | Works | Redirect can be awkward in standalone display mode |
| Electron desktop persistence | Works (token in env or cookie in WebView) | Works (cookie in WebView) | Needs deep-link / system browser dance |
| `<img src="/uploads/...">` works in admin | Only if a cookie is also issued | Yes (native fit) | Yes (provider sets a cookie) |
| New runtime dependencies | None (`crypto.timingSafeEqual` + Express middleware) | None (signed cookie via Node `crypto`) | Yes (OIDC client lib, JWKS verification) |
| Operational cost | One env var | One env var + cookie config | Provider account + callback URLs + ongoing secrets |
| Failure mode if secret missing | Open in dev / fail-closed in prod (matches Phase 1 CORS posture) | Same | Same, plus the provider can fail independently |
| Effort | XS | S | M–L |
| Fit for FieldPulse V1 | Best | OK | Overkill |

## 5. Recommendation — V1

**A shared admin token (`ADMIN_TOKEN`) that is accepted via two equally
supported transports**, with the cookie transport doubling as the
mechanism that makes `<img src="/uploads/...">` work in the admin UI.

### 5.1 Why this and not the others

- Smallest surface area. No new dependency, no user table, no OIDC
  provider account, no token-refresh logic.
- Identical behavior across browser, mobile PWA, and Electron.
- Drops into the existing Phase 1 + Phase 2 architecture cleanly:
  middleware reads `config.ts`, fails closed in production with a loud
  warning if `ADMIN_TOKEN` is empty (mirrors the existing
  `CORS_ALLOWED_ORIGINS` posture).
- Explicit, documented graduation path to option B (session cookie +
  user table) without changing public URLs, and from there to option C
  (OIDC) when the product gains multi-tenant or external-user needs.

### 5.2 Transports

| Transport | Use case | Notes |
|-----------|----------|-------|
| `Authorization: Bearer <ADMIN_TOKEN>` | API clients, `curl`, automation, server-to-server. | Compared with `crypto.timingSafeEqual` on a fixed-length buffer to avoid timing leaks. |
| `Set-Cookie: <ADMIN_COOKIE_NAME>=<random session id>; HttpOnly; SameSite=…; Secure (prod only); Path=/` | Browsers / PWA / Electron. Set by `POST /api/admin/login` after the admin enters `ADMIN_TOKEN` once. | Required for `<img src="/uploads/...">` in admin. Cookie value is a per-session random id; the raw `ADMIN_TOKEN` is **never** sent back to the client. |

### 5.3 Login flow (planned, not implemented in this PR)

1. Unauthenticated `GET /admin` → redirect to `/admin/login`.
2. `/admin/login` is a minimal one-field form: "Admin token". Posts to
   `POST /api/admin/login` with `{token}`.
3. Server: `timingSafeEqual(token, ADMIN_TOKEN)`. On match, generate a
   random session id (`crypto.randomBytes(32).toString("base64url")`),
   set `Set-Cookie`, respond `204`. On mismatch, respond `401`.
4. The session id is stored either:
   - **In-memory** (default for V1): a `Map<sessionId, expiry>` in the
     backend process. Lost on restart. Acceptable for a single-process
     deployment.
   - **In SQLite** (optional): a new `admin_sessions` table. Persisting
     across restarts. **Schema change — deferred to a later PR if
     adopted.** V1 default avoids any schema change.
5. Subsequent requests authenticate via either transport.

### 5.4 Failure / unconfigured behavior

This mirrors the Phase 1 CORS posture exactly so operators have one
mental model.

| Mode | `ADMIN_TOKEN` empty | `ADMIN_TOKEN` set |
|------|---------------------|-------------------|
| Development (`NODE_ENV != "production"`) | Admin routes remain open. A loud `[FieldPulse]` warning is logged at boot. | Admin gate active. Dev defaults (e.g., local CORS allow-list) still apply. |
| Production (`NODE_ENV="production"`) | **Fail closed.** Admin routes return `403` (or `401` from middleware before any handler runs). A loud `[FieldPulse]` warning is logged at boot. Worker routes are unaffected. | Admin gate active. Cookie is `Secure; SameSite=None; HttpOnly`. |

### 5.5 Brute-force throttle (deferred decision)

In-memory rate limit on `POST /api/admin/login`: e.g., 5 failed
attempts per IP per 60 seconds, returning `429`. Cheap to add but
**not** part of V1's minimum scope. The implementation PR may include
it or defer to a follow-up PR; this plan flags it so the decision is
explicit.

## 6. Behavior per deployment mode

### 6.1 Local desktop (Electron)

- Default `.env` has `ADMIN_TOKEN` empty → admin routes open, loud
  warning at boot. **Existing trust model preserved.**
- Power users may set `ADMIN_TOKEN` in `.env`; the cookie persists in
  the Electron WebView between launches.
- `/uploads/*` continues to be served by `express.static` as today.
  No cookie required on a trusted host.
- No change to `desktop:start` / `desktop:dist` / packaging.

### 6.2 Production single-server

- `ADMIN_TOKEN` is **required** to actually use the admin pages.
  Boot loudly warns if missing. Admin routes fail-closed.
- `/uploads/*` is admin-gated via the cookie middleware (recommended)
  or documented as public-by-unguessable-URL (alternative — see
  [section 2.3](#23-uploaded-photos-uploads-added-per-pr-3-amendment)).
- Worker pages and worker APIs remain reachable without credentials.

### 6.3 Hosted-API mode (frontend and backend on different origins)

- `ADMIN_TOKEN` required, same posture as 6.2.
- Cookie attributes: `Secure; HttpOnly; SameSite=None; Path=/`.
  The frontend's origin must already be in `CORS_ALLOWED_ORIGINS`
  (Phase 1). `credentials: true` on the CORS middleware is already
  configured.
- `<img src="https://api.example.com/uploads/abc.jpg">` from
  `https://app.example.com/admin` works iff the cookie is sent
  cross-origin (`SameSite=None`).

### 6.4 Mobile / browser / PWA

- Workers never see `/admin/login`. The QR flow lands on `/worker` and
  the offline queue is untouched.
- Admins on mobile log in once; the cookie persists across PWA
  "Add to Home Screen" sessions.

## 7. Env vars to add (planned, not implemented in this PR)

This PR does **not** edit `.env.example`. The implementation PR will.

| Var | Required when | Default | Validated by `config.ts` |
|-----|---------------|---------|--------------------------|
| `ADMIN_TOKEN` | `NODE_ENV=production` (else open + warn) | empty | Length ≥ 16 if non-empty; otherwise reject at boot with a clear `[FieldPulse config] ADMIN_TOKEN: …` message. |
| `ADMIN_SESSION_TTL_HOURS` | optional | `12` | Integer in `1..168` (1 hour – 7 days). |
| `ADMIN_COOKIE_NAME` | optional | `fp_admin` | Non-empty if set; cookie-name-charset only. |

`config.ts` extension is a single, additive change consistent with the
Phase 2a / 2b shape; no breaking change.

## 8. Rollout steps

Each step is its own PR. None of them are part of this PR.

1. **PR 3 — Plan (this PR).** Doc only.
2. **PR 4 — Backend admin middleware.**
   - Extend `Config` with `admin: { token, sessionTtlHours, cookieName }`.
   - Add `backend/src/middleware/adminAuth.ts` (cookie OR bearer).
   - Wire it on the routes listed in [section 2.2](#22-admin-gated-in-v1).
   - Add `POST /api/admin/login` and `POST /api/admin/logout`.
   - In-memory session store; document loss-on-restart.
   - Negative tests: no token → 401; wrong token → 401; right token →
     200; constant-time compare verified by unit test.
   - **No frontend change yet.** Admin UI still works in dev (open
     mode). API consumers (tests / curl) use the bearer header.
3. **PR 5 — Frontend login page.**
   - `/admin/login` route in the React app, single field.
   - Redirect logic in the admin SPA when API returns 401.
   - Logout button in admin nav.
4. **PR 6 — `/uploads/*` cookie gate in production.**
   - Mount the cookie auth middleware before `express.static("/uploads")`
     when `NODE_ENV=production`.
   - Smoke test: `<img>` loads inside admin, fails when logged out.
   - Document the choice (gated vs public-by-unguessable-URL) in
     `DEPLOYMENT_AND_CONFIG.md`.
5. **PR 7 — Production hardening.**
   - `Secure; SameSite=None; HttpOnly` cookie in prod.
   - Optional: brute-force throttle on `POST /api/admin/login`.
   - Optional: audit log line for login/logout.
6. **PR 8 (optional) — SQLite session store.**
   - Schema change adding `admin_sessions(id, expires_at)`.
   - Survives backend restarts. Only adopt if multi-process or
     restart resilience becomes a requirement.

## 9. Risks

1. **Shared-secret leakage.** Anyone who learns `ADMIN_TOKEN` is admin
   until rotation. Mitigation: rotate via env, restart backend; all
   in-memory sessions invalidate automatically (because session ids
   are keyed off process memory). Documented operator runbook will be
   added with PR 4.
2. **No per-user attribution.** `mark-reviewed` records *that* it was
   reviewed but not *by whom*. Acceptable for single-operator
   FieldPulse Lite; explicit upgrade path is option B (session +
   user table).
3. **Cookie-vs-bearer transport drift.** Two transports double the
   middleware test matrix. Mitigation: one middleware function that
   accepts either, with a single positive integration test per
   transport.
4. **Dev-mode "open + warn" can hide misconfiguration.** If someone
   ships a build with `NODE_ENV=development`, admin will be wide
   open. Mitigation: PR 4 will extend `summarizeConfig()` to print
   `admin-token=set|empty` (no value) so the startup line surfaces it.
5. **Worker QR confusion.** Workers must never be routed to
   `/admin/login`. Mitigation: existing React Router config already
   isolates `/worker/*` from `/admin/*`; PR 5 must keep this strict.
6. **`<img>` cookie semantics.** `<img>` requests carry cookies by
   default same-origin, but **not** cross-origin unless
   `SameSite=None; Secure`. PR 6/7 must set this in hosted-API mode or
   admin photo loading silently breaks. Test: load `<img>` from the
   admin SPA, confirm 200 from `/uploads/...`.
7. **In-memory sessions lost on restart.** Acceptable for V1; flagged
   for upgrade to SQLite in PR 8 if needed.
8. **Worker write surface remains open by design.** Anyone on the
   network can `POST /api/logs` and `POST /api/upload-photo`. This is
   intentional (kiosk flow) but documented here so it is not later
   flagged as an oversight.

## 10. Explicit non-goals for V1

- No OIDC, no Google/Microsoft/Apple sign-in, no SSO.
- No per-user accounts, no roles, no permissions matrix.
- No password reset, no MFA / 2FA.
- No worker authentication.
- No rate limiting beyond the optional `POST /api/admin/login` throttle.
- No changes to Goliath V1 read-only behavior.
- No changes to the worker submission flow.
- No mobile / Capacitor / Electron / installer changes.
- No database schema change in V1 (deferred to optional PR 8).

## 11. Open questions for the implementation PR (PR 4)

These are the choices the next PR's author must make explicitly. They
are flagged here so a reviewer can require an answer.

1. In production with `ADMIN_TOKEN` empty: return `401` or `403`? Spec
   recommends `401` from the middleware before the handler.
2. Login endpoint path: `/api/admin/login` vs `/api/auth/login`?
   Recommend `/api/admin/login` to keep the namespace narrow.
3. Cookie path: `/` vs `/admin`? Recommend `/` so `/uploads/*` is
   covered without a second cookie.
4. Should `GET /api/health` reveal `adminConfigured: boolean`? Useful
   for ops monitoring; harmless. Recommended **yes**, in PR 4.
5. Should `/uploads/*` gating be in PR 4 or split into PR 6? Recommend
   PR 6 to keep PR 4 reviewable.
6. Brute-force throttle: PR 4, PR 7, or never? Recommend PR 7 unless
   the hosted target is internet-facing from day one.
