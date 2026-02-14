# Story 18.4: HTTPS/TLS Configuration

Status: review

## Story

As a **deployer**,
I want **HTTPS/TLS support for production deployments**,
So that **all data in transit is encrypted**.

## Acceptance Criteria

1. When TLS certificates are provided via environment variables (TLS_CERT, TLS_KEY), the server serves over HTTPS directly
2. When a reverse proxy (nginx/caddy) is used for TLS termination, the app accepts proxied connections correctly and the `X-Forwarded-Proto` header is respected
3. When I check the docker-compose configuration, there is a TLS-enabled profile/example showing certificate volume mounts

## Tasks / Subtasks

- [x] Task 1: Enable Express trust proxy for reverse proxy support (AC: 2)
  - [x] 1.1: Add `app.set('trust proxy', 1)` in `server.ts` `createApp()` when behind a proxy
  - [x] 1.2: Read `TRUST_PROXY` env var in config.ts (default: `false` in dev, `true` when `NODE_ENV=production`)
  - [x] 1.3: When trust proxy is enabled, Express `req.secure` uses `X-Forwarded-Proto` header
  - [x] 1.4: This fixes existing `req.secure` checks in security.ts and apiProxy.ts

- [x] Task 2: Add HTTPS redirect middleware (AC: 2)
  - [x] 2.1: In security.ts, add optional HTTPS redirect: if `FORCE_HTTPS=true` and request is not secure, redirect to HTTPS
  - [x] 2.2: Add `FORCE_HTTPS` env var to config.ts (default: `false`)
  - [x] 2.3: Skip redirect for health check endpoint (`/health`)
  - [x] 2.4: Skip redirect when request is already secure (direct TLS or via proxy)

- [x] Task 3: Add TLS docker-compose profile (AC: 3)
  - [x] 3.1: Add a `docker-compose.tls.yml` override file in `packages/web/` that shows TLS certificate volume mounts
  - [x] 3.2: Map TLS_CERT and TLS_KEY to `/certs/` in the container
  - [x] 3.3: Expose port 443 in addition to 3000

- [x] Task 4: Secure cookie configuration for TLS (AC: 1, 2)
  - [x] 4.1: Verify CSRF cookie `secure: true` in production (already done in security.ts line 120)
  - [x] 4.2: Verify session cookie uses secure flag in production (already done in apiProxy.ts line 66)
  - [x] 4.3: No changes needed — already configured correctly

- [x] Task 5: Write tests (AC: 1-3)
  - [x] 5.1: Create `packages/web/src/test/tls.test.ts`
  - [x] 5.2: Test that config.ts reads TRUST_PROXY and FORCE_HTTPS env vars
  - [x] 5.3: Test that trust proxy defaults differ by environment
  - [x] 5.4: Test that docker-compose.tls.yml exists with volume mounts and port 443
  - [x] 5.5: Test that server.ts sets trust proxy when configured
  - [x] 5.6: Test that HTTPS redirect skips /health endpoint
  - [x] 5.7: Run compile + lint + test to validate

## Files Changed

- `packages/web/src/server/config.ts` — Added `trustProxy` and `forceHttps` to AppConfig + loadConfig + logStartupConfig
- `packages/web/src/server/server.ts` — Added `app.set('trust proxy', 1)` when trustProxy is enabled
- `packages/web/src/server/security.ts` — Added HTTPS redirect middleware before helmet (when forceHttps enabled)
- `packages/web/docker-compose.tls.yml` — NEW: TLS docker-compose override with cert volume mounts
- `packages/web/src/test/tls.test.ts` — NEW: 20 tests for TLS configuration
- `packages/web/src/test/config.test.ts` — Added TRUST_PROXY and FORCE_HTTPS to ENV_KEYS save/restore
- `_bmad-output/implementation-artifacts/18-4-https-tls-configuration.md` — Updated status and checkboxes

## Completion Notes

- All 5 tasks implemented and verified
- 20 new tests in tls.test.ts covering config parsing, trust proxy, HTTPS redirect, docker-compose.tls.yml, cookie security, and startup logging
- Total test suite: 464 tests passing, 0 failures
- Compile + lint + test all pass
- Cookie security verified: CSRF cookie (security.ts) and session cookie (apiProxy.ts) both set Secure flag in production

## Dev Notes

### Already Implemented (Stories 18.1 + 18.2)
- `config.ts` reads TLS_CERT and TLS_KEY, validates both-or-neither
- `server.ts` creates `https.createServer()` when TLS configured
- `server.ts` imports `fs` and `https` for TLS
- `security.ts` checks `req.secure || req.headers['x-forwarded-proto'] === 'https'` for CSP WebSocket origin
- `apiProxy.ts` checks `req.secure || req.headers['x-forwarded-proto'] === 'https'` for HTTPS enforcement
- CSRF cookies have `secure: cfg.nodeEnv === 'production'`

### What's Missing
1. **`trust proxy`**: Express needs `app.set('trust proxy', 1)` to make `req.secure` respect `X-Forwarded-Proto`. Without this, reverse proxy HTTPS detection doesn't work via `req.secure` — only the manual header check works.
2. **HTTPS redirect**: Optional redirect from HTTP to HTTPS when `FORCE_HTTPS=true`
3. **TLS compose example**: Docker compose override showing volume mounts for certificates

### Key Pattern
```typescript
// In server.ts createApp():
if (cfg.trustProxy) {
    app.set('trust proxy', 1);
}
```

### Config Additions
```typescript
// In AppConfig interface:
trustProxy: boolean;
forceHttps: boolean;

// In loadConfig():
trustProxy: process.env.TRUST_PROXY === 'true' || (process.env.TRUST_PROXY === undefined && (process.env.NODE_ENV === 'production')),
forceHttps: process.env.FORCE_HTTPS === 'true',
```

### HTTPS Redirect Pattern
```typescript
// In security.ts, before other middleware:
if (cfg.forceHttps) {
    app.use((req, res, next) => {
        if (req.path === '/health') { next(); return; }
        if (!req.secure) {
            res.redirect(301, `https://${req.headers.host}${req.url}`);
            return;
        }
        next();
    });
}
```

### Project Structure Notes
- `packages/web/src/server/config.ts` — MODIFY: add trustProxy, forceHttps
- `packages/web/src/server/server.ts` — MODIFY: set trust proxy
- `packages/web/src/server/security.ts` — MODIFY: add HTTPS redirect
- `packages/web/docker-compose.tls.yml` — NEW: TLS compose override
- `packages/web/src/test/tls.test.ts` — NEW: TLS tests

### References
- [Source: epics.md#Story 18.4] — Acceptance criteria
- [Source: web/src/server/server.ts] — Server TLS creation
- [Source: web/src/server/security.ts] — Security middleware
- [Source: web/src/server/config.ts] — Environment config
