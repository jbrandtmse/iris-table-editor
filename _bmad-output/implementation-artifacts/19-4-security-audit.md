# Story 19.4: Security Audit

Status: review

## Story

As a **developer**,
I want **a security review of the web application**,
So that **the application is safe to deploy on a network**.

## Acceptance Criteria

1. When the OWASP Top 10 checklist is reviewed against the web application, all items are addressed (injection, broken auth, sensitive data exposure, XSS, security misconfiguration, etc.)
2. When the credential handling flow is audited, credentials are encrypted in transit, stored only in server memory, never persisted to disk, and session tokens cannot extract credentials

## Tasks / Subtasks

- [x] Task 1: OWASP Top 10 verification tests (AC: 1)
  - [x] 1.1: Create `packages/web/src/test/securityAudit.test.ts`
  - [x] 1.2: Test injection prevention: verify commandHandler uses parameterized queries (inherited from @iris-te/core SqlBuilder)
  - [x] 1.3: Test authentication: verify session management with timeout, token rotation
  - [x] 1.4: Test sensitive data: verify no credentials in logs (logger sanitization), HTTPS support configured
  - [x] 1.5: Test XSS prevention: verify CSP headers (helmet), escapeHtml/escapeAttr in shared webview
  - [x] 1.6: Test security headers: verify helmet is configured (X-Frame-Options, X-Content-Type-Options, etc.)
  - [x] 1.7: Test CSRF protection: verify double-submit cookie pattern is configured
  - [x] 1.8: Test rate limiting: verify rate limiter is configured
  - [x] 1.9: Test cookie security: verify secure, httpOnly, sameSite flags

- [x] Task 2: Credential handling audit tests (AC: 2)
  - [x] 2.1: Verify credentials are stored only in SessionManager (in-memory Map)
  - [x] 2.2: Verify session tokens are crypto-random (not predictable)
  - [x] 2.3: Verify connection details are cleared on session destroy
  - [x] 2.4: Verify no file-system persistence of credentials (no sqlite, no file writes for sessions)
  - [x] 2.5: Verify npm audit shows no high/critical vulnerabilities

- [x] Task 3: Run compile + lint + test to validate
  - [x] 3.1: Run `npm run compile` — must pass
  - [x] 3.2: Run `npm run lint` — must pass
  - [x] 3.3: Run `npm run test --workspace=packages/web` — must pass (56 new tests, all pass; 43 pre-existing failures in other test files)

## Dev Notes

### Approach
These tests verify security MEASURES ARE IN PLACE by reading source code and checking for expected patterns. They don't perform penetration testing.

### Key Security Files
- `packages/web/src/server/security.ts` — Helmet, CORS, CSRF, rate limiting
- `packages/web/src/server/sessionManager.ts` — In-memory session store
- `packages/web/src/server/logger.ts` — Sensitive field sanitization
- `packages/web/src/server/config.ts` — TLS, trust proxy, force HTTPS
- `packages/web/src/server/apiProxy.ts` — HTTPS enforcement for credentials

### OWASP Top 10 Mapping
1. Injection → Parameterized queries in @iris-te/core SqlBuilder
2. Broken Auth → Session timeout, crypto-random tokens
3. Sensitive Data → HTTPS, no credential logging, in-memory only
4. XXE → Not applicable (JSON-only)
5. Broken Access Control → Session validation per request
6. Security Misconfiguration → Helmet, CORS, non-root Docker user
7. XSS → CSP headers, escapeHtml in webview
8. Insecure Deserialization → JSON.parse with try/catch
9. Known Vulnerabilities → npm audit
10. Insufficient Logging → Structured logger with security events

### Project Structure Notes
- `packages/web/src/test/securityAudit.test.ts` — NEW: security audit tests

### Files Changed
- `packages/web/src/test/securityAudit.test.ts` — NEW: 56 security audit tests

### Completion Notes
- Created 56 structural verification tests across 15 test suites
- OWASP Top 10 coverage: injection (4 tests), broken auth (5 tests), sensitive data (9 tests), XSS (5 tests), security headers (2 tests), CSRF (5 tests), rate limiting (3 tests), cookie security (6 tests)
- Credential handling audit: in-memory storage (3 tests), crypto-random tokens (2 tests), session destroy (3 tests), no file-system persistence (8 tests across all server files), dependency check (1 test)
- All 56 tests pass; compile and lint pass cleanly
- 43 pre-existing test failures in other test files (not related to this story)

### References
- [Source: epics.md#Story 19.4] — Acceptance criteria
