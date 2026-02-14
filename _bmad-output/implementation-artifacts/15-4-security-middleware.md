# Story 15.4: Security Middleware

Status: review

## Story

As a **developer**,
I want **comprehensive security middleware protecting the web application**,
So that **the application follows OWASP best practices and is safe to deploy**.

## Acceptance Criteria

1. Helmet security headers are present on all HTTP responses (X-Content-Type-Options, X-Frame-Options, CSP, etc.)
2. CORS is configured — requests from allowed origins are accepted, disallowed origins rejected with 403
3. CSRF protection is active — state-changing requests (POST, PUT, DELETE) require a valid CSRF token; requests without a valid token are rejected with 403
4. Rate limiting is configured — clients exceeding the request limit (default: 100 requests/minute) receive 429 Too Many Requests; the limit is configurable via environment variables
5. Request body size is limited to 10MB — larger bodies are rejected with 413

## Tasks / Subtasks

- [x] Task 1: Install security dependencies (AC: 1-4)
  - [x] 1.1: Add `helmet` for security headers
  - [x] 1.2: Add `cors` and `@types/cors` for CORS management
  - [x] 1.3: Add `express-rate-limit` for rate limiting
  - [x] 1.4: Add `csrf-csrf` (double-submit cookie CSRF protection — works with APIs, no template requirement unlike csurf)

- [x] Task 2: Create security middleware module (AC: 1-5)
  - [x] 2.1: Create `packages/web/src/server/security.ts` with `setupSecurity(app)` function per architecture spec
  - [x] 2.2: Configure helmet with appropriate defaults (allow inline scripts for SPA if needed via CSP nonce or hash)
  - [x] 2.3: Configure CORS with `ALLOWED_ORIGINS` env var (comma-separated), defaulting to same-origin
  - [x] 2.4: Configure CSRF protection using double-submit cookie pattern (csrf-csrf)
  - [x] 2.5: Configure rate limiting with `RATE_LIMIT_MAX` env var (default: 100 requests/minute window)
  - [x] 2.6: Body size limit already configured in server.ts (10mb) — verify it's present

- [x] Task 3: CSRF token endpoint (AC: 3)
  - [x] 3.1: Add GET `/api/csrf-token` endpoint that returns a CSRF token for the client
  - [x] 3.2: Client must include this token in subsequent POST/PUT/DELETE requests (via header or body)
  - [x] 3.3: Exempt the `/api/connect` endpoint from CSRF (first request before client has a token — uses session cookie for auth)
  - [x] 3.4: Exempt WebSocket upgrade requests from CSRF (authenticated via session token)

- [x] Task 4: Wire security into server (AC: 1-5)
  - [x] 4.1: Call `setupSecurity(app)` in server.ts BEFORE any route handlers
  - [x] 4.2: Ensure security middleware ordering: helmet → cors → csrf → rate-limit → body parser → routes
  - [x] 4.3: Update session cookie to include `Secure` flag when `NODE_ENV=production`

- [x] Task 5: Write tests (AC: 1-5)
  - [x] 5.1: Create `packages/web/src/test/security.test.ts`
  - [x] 5.2: Test helmet headers present on responses (X-Content-Type-Options, X-Frame-Options, etc.)
  - [x] 5.3: Test CORS allows configured origins
  - [x] 5.4: Test CORS rejects disallowed origins
  - [x] 5.5: Test CSRF token endpoint returns a token
  - [x] 5.6: Test POST requests without CSRF token are rejected (403)
  - [x] 5.7: Test POST requests with valid CSRF token are accepted
  - [x] 5.8: Test rate limiting returns 429 after exceeding limit
  - [x] 5.9: Test body size limit returns 413 for oversized payloads
  - [x] 5.10: Run compile + lint + test to validate

## Dev Notes

- Follow architecture spec section "Security Middleware"
- Use `csrf-csrf` package (NOT deprecated `csurf`) — it implements double-submit cookie pattern which works well with SPAs and APIs
- CSRF exemptions needed for: initial connect (no CSRF cookie yet), WebSocket upgrade, health endpoint
- Helmet's default CSP may block inline scripts — configure CSP to allow SPA to function (may need `script-src 'self'`)
- Rate limiting should be per-IP (default behavior of express-rate-limit)
- ALLOWED_ORIGINS env var should support comma-separated list: `https://app.example.com,https://staging.example.com`
- When ALLOWED_ORIGINS is not set, default to same-origin behavior (no CORS headers needed for same-origin)
- The body parser limit (10mb) was already added in Story 15.1 — verify, don't duplicate

### Project Structure Notes

- `packages/web/src/server/security.ts` — new security middleware module
- `packages/web/src/server/server.ts` — modified to wire security middleware
- Follows the `setupX(app)` pattern used by apiProxy

### References

- [Source: architecture.md#Security Middleware] — Security middleware design and configuration
- [Source: epics.md#Story 15.4] — Acceptance criteria
- [Source: OWASP Top 10] — Security best practices

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Fixed csrf-csrf API: `getTokenFromRequest` renamed to `getCsrfTokenFromRequest` (v4.x API)
- Fixed csrf-csrf v4.x requires `getSessionIdentifier` — used session cookie value as identifier
- Fixed CSRF test: token must be fetched with session cookie so it's bound to the correct session identifier
- Fixed body size test: CSRF check runs before body parser, so used CSRF-exempt endpoint for body size test

### Completion Notes List
- Installed helmet@8, cors@2, express-rate-limit@8, csrf-csrf@4, cookie-parser as dependencies
- Installed @types/cors, @types/cookie-parser as devDependencies
- Created `security.ts` with `setupSecurity(app)` following the `setupX(app)` pattern
- Helmet configured with explicit CSP directives: default-src 'self', script-src 'self', style-src 'self' + unsafe-inline, frame-ancestors 'none'
- CORS only enabled when `ALLOWED_ORIGINS` env var is set (same-origin default)
- CSRF uses double-submit cookie pattern via csrf-csrf, exempt paths: `/api/connect`, `/health`, WebSocket upgrades
- CSRF token endpoint at GET `/api/csrf-token`, clients send token via `X-CSRF-Token` header
- Rate limiting configurable via `RATE_LIMIT_MAX` env var, default 100 req/min
- Session cookie updated with `Secure` flag when `NODE_ENV=production`
- Added `skipSecurity` option to `CreateServerOptions` so existing tests remain isolated from security middleware
- Added `SecurityOptions` with `csrfSecret` override for deterministic test tokens
- Existing tests updated: `apiProxy.test.ts` and `wsServer.test.ts` use `skipSecurity: true`
- 14 new security tests added, all 88 tests pass, lint clean

### File List
- `packages/web/package.json` — added helmet, cors, express-rate-limit, csrf-csrf, cookie-parser, @types/cors, @types/cookie-parser
- `packages/web/src/server/security.ts` — new security middleware module
- `packages/web/src/server/server.ts` — wired setupSecurity, added SecurityOptions/skipSecurity to CreateServerOptions
- `packages/web/src/server/apiProxy.ts` — session cookie Secure flag in production
- `packages/web/src/test/security.test.ts` — new security test suite (14 tests)
- `packages/web/src/test/apiProxy.test.ts` — added skipSecurity: true
- `packages/web/src/test/wsServer.test.ts` — added skipSecurity: true
