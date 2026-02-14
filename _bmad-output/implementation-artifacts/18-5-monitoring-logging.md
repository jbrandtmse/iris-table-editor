# Story 18.5: Monitoring & Logging

Status: review

## Story

As a **deployer**,
I want **health checks, structured logging, and error tracking**,
So that **I can monitor the web application in production**.

## Acceptance Criteria

1. When I access `GET /health`, I receive `{ status: "ok", uptime: <seconds>, connections: <count> }`
2. When the server is handling requests, I see structured JSON log entries with timestamp, level, message, and request metadata, and no sensitive data appears in logs
3. When an error occurs, the log entry includes the error code, stack trace (in development), and request context, categorized by type (connection, authentication, proxy, internal)

## Tasks / Subtasks

- [x] Task 1: Enhanced health endpoint (AC: 1)
  - [x] 1.1: Update `/health` in server.ts to return `{ status: "ok", uptime: process.uptime(), connections: sessionMgr.getSessionCount() }`
  - [x] 1.2: Ensure the endpoint remains fast and doesn't expose sensitive data

- [x] Task 2: Create structured logger (AC: 2)
  - [x] 2.1: Create `packages/web/src/server/logger.ts` with a simple structured JSON logger
  - [x] 2.2: Logger outputs JSON in production: `{ timestamp, level, message, ...metadata }`
  - [x] 2.3: Logger outputs human-readable format in development (existing `console.log` style with `[IRIS-TE]` prefix)
  - [x] 2.4: Log levels: error, warn, info, debug
  - [x] 2.5: Sanitize sensitive fields from metadata: password, secret, token, cookie, authorization

- [x] Task 3: Request logging middleware (AC: 2)
  - [x] 3.1: Add request logging middleware in server.ts (or logger.ts) that logs: method, url, status, duration, IP
  - [x] 3.2: Skip logging for static assets and health checks to reduce noise
  - [x] 3.3: Don't log request/response bodies (may contain credentials)

- [x] Task 4: Error handling middleware (AC: 3)
  - [x] 4.1: Add a global error handler middleware at the END of the middleware chain in server.ts
  - [x] 4.2: Categorize errors: connection (ECONNREFUSED, ENOTFOUND), authentication (401/403), proxy (502/504), internal (500)
  - [x] 4.3: Include error code, category, message, and request context in the log
  - [x] 4.4: Include stack trace only in development (NODE_ENV !== 'production')
  - [x] 4.5: Return appropriate JSON error response to client

- [x] Task 5: Write tests (AC: 1-3)
  - [x] 5.1: Create `packages/web/src/test/monitoring.test.ts`
  - [x] 5.2: Test health endpoint returns uptime and connections count
  - [x] 5.3: Test logger outputs JSON in production mode
  - [x] 5.4: Test logger outputs human-readable in development mode
  - [x] 5.5: Test logger sanitizes sensitive fields (password, token, etc.)
  - [x] 5.6: Test error categorization (connection, auth, proxy, internal)
  - [x] 5.7: Test that stack traces are omitted in production error responses
  - [x] 5.8: Run compile + lint + test to validate

## Dev Notes

### Current State
- Health endpoint at server.ts line 85: returns `{ status: "ok" }` — needs uptime + connections
- All logging uses `console.log/warn/error` with `[IRIS-TE]` prefix — no structured format
- SessionManager has `getActiveSessions()` method that returns active session array
- No centralized error handling middleware exists

### Logger Design
Keep it simple — no external dependencies (no winston, pino, etc). Just a thin wrapper:
```typescript
// production: JSON to stdout
{"timestamp":"2026-02-14T20:30:00.000Z","level":"info","message":"Request completed","method":"GET","url":"/api/tables","status":200,"duration":45}

// development: human-readable
[IRIS-TE] info: Request completed GET /api/tables 200 45ms
```

### Sensitive Data Sanitization
The logger should strip or mask fields like: password, secret, token, cookie, authorization, credential.
Pattern: check metadata keys, replace values with `[REDACTED]`.

### Error Categories
```typescript
type ErrorCategory = 'connection' | 'authentication' | 'proxy' | 'internal';
```
Map by error code or HTTP status:
- ECONNREFUSED, ENOTFOUND, ETIMEDOUT → 'connection'
- 401, 403 → 'authentication'
- 502, 504 → 'proxy'
- Everything else → 'internal'

### Middleware Ordering
The error handler MUST be the LAST middleware (after all routes). Express error handlers have 4 params: `(err, req, res, next)`.

### Project Structure Notes
- `packages/web/src/server/logger.ts` — NEW: structured logger
- `packages/web/src/server/server.ts` — MODIFY: enhanced health, request logging, error handler
- `packages/web/src/test/monitoring.test.ts` — NEW: monitoring tests

### References
- [Source: epics.md#Story 18.5] — Acceptance criteria
- [Source: web/src/server/server.ts] — Server entry point + health endpoint
- [Source: web/src/server/sessionManager.ts] — Session tracking

## Files Changed
- `packages/web/src/server/logger.ts` — NEW: Structured logger with JSON/dev output, sanitization, error categorization
- `packages/web/src/server/server.ts` — MODIFIED: Enhanced health endpoint, request logging middleware, error handler
- `packages/web/src/test/monitoring.test.ts` — NEW: 34 tests for monitoring & logging
- `packages/web/src/test/server.test.ts` — MODIFIED: Updated health endpoint assertion for new response shape
- `packages/web/src/test/spaShell.test.ts` — MODIFIED: Updated health endpoint assertion for new response shape

## Completion Notes
- 34 new monitoring tests added across 7 test groups
- All 498 web tests pass (0 failures)
- Compile and lint pass cleanly
- Used `getSessionCount()` instead of `getActiveSessions().length` (the method in SessionManager)
- No external dependencies added — logger is pure Node.js
- Error handler is the last middleware (after SPA catch-all, before WebSocket setup)
- `categorizeError` and `sanitizeMetadata` exported from logger.ts for direct testing
