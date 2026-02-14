# Story 15.2: Atelier API Proxy

Status: review

## Story

As a **user**,
I want **the web server to proxy my requests to IRIS servers**,
So that **I can interact with IRIS from the browser without direct server access**.

## Acceptance Criteria

1. POST to `/api/iris/query` with query and parameters forwards the request to the IRIS Atelier API endpoint
2. Authentication headers (Basic Auth) are injected from session credentials
3. The IRIS response is returned to the browser
4. When the session is invalid or expired, the server returns 401 Unauthorized
5. When the IRIS server is unreachable or times out, the server returns an appropriate error with user-friendly message and ErrorHandler error code
6. The proxy adds no more than 100ms latency to IRIS responses (minimal overhead)

## Tasks / Subtasks

- [x] Task 1: Create API proxy module (AC: 1, 2, 3)
  - [x] 1.1: Create `packages/web/src/server/apiProxy.ts` with `setupApiProxy(app, sessionManager)` function
  - [x] 1.2: Implement POST `/api/iris/query` route that extracts `query` and `parameters` from request body
  - [x] 1.3: Build the Atelier API URL using UrlBuilder from @iris-te/core (reuse existing utility)
  - [x] 1.4: Inject Basic Auth header from session credentials (`Buffer.from(username:password).toString('base64')`)
  - [x] 1.5: Forward request to IRIS using native `fetch` and return the response JSON
  - [x] 1.6: Add request timeout (30 seconds default, configurable via env)

- [x] Task 2: Create session manager stub (AC: 2, 4)
  - [x] 2.1: Create `packages/web/src/server/sessionManager.ts` with `SessionManager` class
  - [x] 2.2: Implement `validate(req)` method that checks session token from cookie/header
  - [x] 2.3: Store session data in memory Map: `Map<string, SessionData>` where SessionData contains host, port, namespace, username, password, pathPrefix, useHTTPS
  - [x] 2.4: Implement `createSession(connectionDetails)` returning a session token
  - [x] 2.5: Implement `destroySession(token)` for cleanup
  - [x] 2.6: Return null from validate() when session is invalid → proxy returns 401

- [x] Task 3: Create connect/disconnect API endpoints (AC: 2, 4)
  - [x] 3.1: Add POST `/api/connect` endpoint that receives connection details (host, port, namespace, username, password, pathPrefix, useHTTPS)
  - [x] 3.2: Validate connection by making a test request to IRIS (reuse AtelierApiService.testConnection pattern)
  - [x] 3.3: On success, create session and return session token
  - [x] 3.4: Add POST `/api/disconnect` endpoint that destroys the session
  - [x] 3.5: Add GET `/api/session` endpoint that returns current session status (connected/disconnected, server info without password)

- [x] Task 4: Error handling for proxy (AC: 5)
  - [x] 4.1: Handle IRIS server unreachable (ECONNREFUSED, ENOTFOUND) → return 502 with user-friendly message
  - [x] 4.2: Handle IRIS server timeout → return 504 with timeout message
  - [x] 4.3: Handle IRIS auth failure (401/403 from IRIS) → return 401 with "IRIS authentication failed" message
  - [x] 4.4: Use ErrorHandler error codes from @iris-te/core where applicable
  - [x] 4.5: Never leak internal IRIS server details (hostname, port) in error responses to browser

- [x] Task 5: Wire proxy into server (AC: 1-6)
  - [x] 5.1: Import and call `setupApiProxy(app, sessionManager)` in server.ts
  - [x] 5.2: Ensure proxy routes are registered BEFORE the SPA catch-all route
  - [x] 5.3: Create SessionManager instance in server.ts

- [x] Task 6: Write tests (AC: 1-6)
  - [x] 6.1: Create `packages/web/src/test/apiProxy.test.ts`
  - [x] 6.2: Test POST /api/iris/query with valid session returns proxied response (mock fetch)
  - [x] 6.3: Test POST /api/iris/query without session returns 401
  - [x] 6.4: Test POST /api/iris/query with expired session returns 401
  - [x] 6.5: Test IRIS unreachable returns 502 with error message
  - [x] 6.6: Test IRIS timeout returns 504 with error message
  - [x] 6.7: Create `packages/web/src/test/sessionManager.test.ts`
  - [x] 6.8: Test session creation, validation, destruction lifecycle
  - [x] 6.9: Test session isolation (different tokens, different sessions)
  - [x] 6.10: Test connect endpoint creates session on successful IRIS connection
  - [x] 6.11: Test disconnect endpoint destroys session
  - [x] 6.12: Run compile + lint + test to validate

## Dev Notes

- Follow architecture spec section "API Proxy" and "Session & Credential Management (Web)"
- Reuse `UrlBuilder` from @iris-te/core for constructing Atelier API URLs
- Reuse `AtelierApiService` patterns for IRIS communication (but through proxy, not direct)
- Session tokens should be cryptographically random (use `crypto.randomUUID()` or `crypto.randomBytes()`)
- Session token delivery: use HTTP-only cookie (secure, sameSite: strict) for automatic inclusion in requests
- This story creates the session manager that will be expanded in Story 15.5 with timeout/expiry
- For now, sessions persist until disconnect or server restart (no timeout yet)
- Tests should mock the actual fetch to IRIS (don't require a real IRIS server)
- Use `node:test` mock facilities or manual mock injection

### Project Structure Notes

- `packages/web/src/server/apiProxy.ts` — new file for proxy routes
- `packages/web/src/server/sessionManager.ts` — new file for session management
- `packages/web/src/server/server.ts` — modified to wire in proxy
- Follows architecture spec file layout

### References

- [Source: architecture.md#API Proxy] — Proxy design, route structure, auth injection
- [Source: architecture.md#Session & Credential Management (Web)] — Session flow
- [Source: architecture.md#Web Server Architecture] — Server design overview
- [Source: epics.md#Story 15.2] — Acceptance criteria
- [Source: core/src/utils/UrlBuilder.ts] — Reusable URL construction
- [Source: core/src/services/AtelierApiService.ts] — IRIS communication patterns

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Initial compile passed clean after implementation
- First test run for apiProxy.test.ts: 14/17 failed due to globalThis.fetch mock intercepting both real HTTP calls to Express server and mocked IRIS calls
- Solution: Dependency injection pattern - added `fetchFn` option to `setupApiProxy()` and `createAppServer()` factory function so IRIS fetch can be mocked independently
- After fix: all 44 tests pass (18 proxy + 17 session manager + 9 existing server)

### Completion Notes List
- Implemented SessionManager with in-memory Map storage, cookie/Bearer token extraction, cryptographic UUID tokens
- Implemented API proxy with POST /api/iris/query (forwarding, auth injection, timeout), POST /api/connect (test connection + session creation), POST /api/disconnect (session destruction), GET /api/session (status)
- Error handling: ECONNREFUSED/ENOTFOUND -> 502, AbortError -> 504, IRIS 401/403 -> 401, never leaks IRIS host/port in error messages
- Used UrlBuilder from @iris-te/core for Atelier URL construction
- Used ErrorCodes from @iris-te/core for consistent error codes
- Refactored server.ts to export createAppServer() factory for testable server instances with dependency injection
- Session cookie: HttpOnly, SameSite=Strict, Path=/
- Proxy timeout: 30s default, configurable via IRIS_PROXY_TIMEOUT env var
- 44 tests total: 18 API proxy tests, 17 session manager tests, 9 existing server tests (no regressions)

### File List
- `packages/web/src/server/apiProxy.ts` (new) — API proxy routes and error classification
- `packages/web/src/server/sessionManager.ts` (new) — In-memory session management
- `packages/web/src/server/server.ts` (modified) — Added SessionManager, setupApiProxy wiring, createAppServer factory
- `packages/web/src/test/apiProxy.test.ts` (new) — 18 tests for proxy endpoints
- `packages/web/src/test/sessionManager.test.ts` (new) — 17 tests for session lifecycle

## Change Log
- 2026-02-14: Implemented Story 15.2 - API proxy, session manager, connect/disconnect endpoints, error handling, 35 new tests
