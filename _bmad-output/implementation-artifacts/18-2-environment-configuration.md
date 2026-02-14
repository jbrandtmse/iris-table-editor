# Story 18.2: Environment Configuration

Status: review

## Story

As a **deployer**,
I want **configurable environment variables for all deployment settings**,
So that **I can customize the deployment without rebuilding the image**.

## Acceptance Criteria

1. When I set environment variables, the following settings are configurable: PORT (default 3000), NODE_ENV (production/development), ALLOWED_ORIGINS (comma-separated CORS origins), SESSION_SECRET (secret for cookie signing), SESSION_TIMEOUT (timeout in seconds, default 1800), RATE_LIMIT_MAX (max requests per minute, default 100), TLS_CERT (path to TLS cert, optional), TLS_KEY (path to TLS key, optional)
2. When required environment variables are missing and NODE_ENV=production, the server logs a clear error message and exits with a non-zero code

## Tasks / Subtasks

- [x] Task 1: Centralize environment variable reading (AC: 1)
  - [x] 1.1: Create `packages/web/src/server/config.ts` — centralized config module that reads all env vars
  - [x] 1.2: Export typed config object: `{ port, nodeEnv, allowedOrigins, sessionSecret, sessionTimeout, rateLimitMax, tlsCert, tlsKey }`
  - [x] 1.3: Parse ALLOWED_ORIGINS as comma-separated string into string array
  - [x] 1.4: Parse SESSION_TIMEOUT as integer (seconds), default 1800
  - [x] 1.5: Parse RATE_LIMIT_MAX as integer, default 100
  - [x] 1.6: Parse PORT as integer, default 3000

- [x] Task 2: Validate required env vars in production (AC: 2)
  - [x] 2.1: In production (NODE_ENV=production), SESSION_SECRET must be set (not random)
  - [x] 2.2: Log clear error message and call `process.exit(1)` if required vars missing
  - [x] 2.3: In development, log warnings but don't exit

- [x] Task 3: Wire config into existing server components (AC: 1)
  - [x] 3.1: Update server.ts to use config module for PORT and session timeout
  - [x] 3.2: Update security.ts to use config module for ALLOWED_ORIGINS, RATE_LIMIT_MAX, SESSION_SECRET
  - [x] 3.3: Ensure backward compatibility — existing env var names still work

- [x] Task 4: TLS support scaffolding (AC: 1)
  - [x] 4.1: Read TLS_CERT and TLS_KEY paths from config
  - [x] 4.2: If both are provided, create HTTPS server instead of HTTP
  - [x] 4.3: If only one is provided, log error and exit
  - [x] 4.4: Log TLS status at startup (enabled/disabled)

- [x] Task 5: Write tests (AC: 1-2)
  - [x] 5.1: Create `packages/web/src/test/config.test.ts`
  - [x] 5.2: Test default values for all config options
  - [x] 5.3: Test parsing ALLOWED_ORIGINS comma-separated string
  - [x] 5.4: Test SESSION_TIMEOUT and RATE_LIMIT_MAX integer parsing
  - [x] 5.5: Test production validation (SESSION_SECRET required)
  - [x] 5.6: Test TLS validation (both or neither)
  - [x] 5.7: Run compile + lint + test to validate

## Files Changed

- `packages/web/src/server/config.ts` — NEW: centralized config module (AppConfig interface, loadConfig, getConfig, validateConfig, logStartupConfig)
- `packages/web/src/server/server.ts` — MODIFIED: imports config module, uses getConfig() for PORT/TLS, calls validateConfig() at startup, TLS creates https.createServer
- `packages/web/src/server/security.ts` — MODIFIED: imports config module, removed parseAllowedOrigins/getCsrfSecret, uses cfg.allowedOrigins/csrfSecret/rateLimitMax/nodeEnv
- `packages/web/src/test/config.test.ts` — NEW: 38 tests covering defaults, parsing, bounds validation, production validation, TLS validation
- `packages/web/src/test/docker.test.ts` — MODIFIED: updated env var assertions to check config.ts as centralized source

## Completion Notes

- Created `config.ts` as the single source of truth for all environment variables
- `getConfig()` reads fresh `process.env` values on each call, ensuring test compatibility (tests set env vars before creating servers)
- Random fallback secret generated once per process lifetime (stable across getConfig calls)
- security.ts fully migrated: removed `parseAllowedOrigins()` and `getCsrfSecret()` functions, now uses config module
- server.ts fully migrated: uses config for PORT, validates at startup, creates HTTPS server when TLS configured
- sessionManager.ts retains its own `getSessionTimeoutMs()` (reads SESSION_TIMEOUT) for backward compat with constructor options
- All 421 tests pass (0 failures), compile and lint clean
- Backward compatible: same env var names, same defaults, deprecated logStartupConfig wrapper in server.ts
- Review fix: `parseIntWithDefault` now rejects negative/zero values (returns default instead)
- Review fix: `validateConfig` uses `config.sessionSecretExplicit` field instead of reading `process.env` directly
- Review fix: `loadConfig` made private, `getConfig` is the sole public API

## Dev Notes

- Story 18.1 already added `logStartupConfig()` to server.ts and SESSION_SECRET fallback to security.ts — build on that work
- security.ts already reads ALLOWED_ORIGINS and CSRF_SECRET env vars — consolidate into config module
- sessionManager.ts already reads SESSION_TIMEOUT — consolidate
- The config module should be the SINGLE source of truth for all env vars
- Don't break existing behavior — maintain backward compatibility with existing env var names
- TLS is scaffolding only — full TLS testing comes in Story 18.4

### Project Structure Notes
- `packages/web/src/server/config.ts` — NEW: centralized config
- `packages/web/src/server/server.ts` — MODIFY: use config module
- `packages/web/src/server/security.ts` — MODIFY: use config module
- `packages/web/src/test/config.test.ts` — NEW: config tests

### References
- [Source: epics.md#Story 18.2] — Acceptance criteria
- [Source: web/src/server/server.ts] — Server entry point
- [Source: web/src/server/security.ts] — Security middleware
- [Source: web/src/server/sessionManager.ts] — Session timeout
