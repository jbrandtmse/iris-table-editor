# Story 16.2: Browser Credential Handling

Status: review

## Story

As a **user**,
I want **my credentials handled securely in the browser**,
So that **I can trust the web application with my IRIS server access**.

## Acceptance Criteria

1. When I enter credentials and click "Connect", credentials are sent to the server over HTTPS only, the server validates them against IRIS, credentials are stored in the server-side session (memory only), and a session token (JWT/cookie) is returned to the browser
2. When I have an active session and check browser storage, my password is NOT stored in localStorage, sessionStorage, or cookies — only the session token is stored
3. When I close the browser tab, sessionStorage is cleared, my session token is no longer available, and I must re-enter credentials on next visit (unless session cookie persists)

## Tasks / Subtasks

- [x] Task 1: Verify credential transmission security (AC: 1)
  - [x] 1.1: Verify POST /api/connect sends credentials in request body (not URL params)
  - [x] 1.2: Verify server validates credentials against IRIS before creating session
  - [x] 1.3: Verify credentials are stored only in server-side session memory (SessionManager)
  - [x] 1.4: Verify session token is returned as HTTP-only cookie (not in response body)
  - [x] 1.5: Add HTTPS enforcement check — if NODE_ENV=production, reject non-HTTPS connect requests

- [x] Task 2: Verify browser storage security (AC: 2)
  - [x] 2.1: Audit connection-form.js to ensure password is NEVER written to localStorage
  - [x] 2.2: Audit connection-form.js to ensure password is NEVER written to sessionStorage
  - [x] 2.3: Verify "Remember connection" feature stores only: host, port, namespace, username, pathPrefix, useHTTPS (NO password)
  - [x] 2.4: Add automated test that verifies password absence from localStorage after connect

- [x] Task 3: Session cookie configuration (AC: 3)
  - [x] 3.1: Verify session cookie has HttpOnly flag (already done in Story 15.2)
  - [x] 3.2: Verify session cookie has SameSite=Strict (already done in Story 15.2)
  - [x] 3.3: Verify session cookie has Secure flag in production (already done in Story 15.4/15.5)
  - [x] 3.4: Configure session cookie with appropriate expiry (session cookie = deleted on browser close, OR persistent with server-side timeout)
  - [x] 3.5: Document the cookie lifecycle clearly

- [x] Task 4: Password field security (AC: 2)
  - [x] 4.1: Verify password input type="password" in connection form
  - [x] 4.2: Verify password is cleared from form after successful connection
  - [x] 4.3: Verify password is cleared from memory (set input value to empty string) after form submission

- [x] Task 5: Write security verification tests (AC: 1-3)
  - [x] 5.1: Create `packages/web/src/test/credentialSecurity.test.ts`
  - [x] 5.2: Test that /api/connect response does NOT contain password in body
  - [x] 5.3: Test that /api/session response does NOT contain password
  - [x] 5.4: Test that session cookie has HttpOnly flag
  - [x] 5.5: Test that session cookie has SameSite=Strict
  - [x] 5.6: Test recent connections stored in localStorage contain NO password
  - [x] 5.7: Test HTTPS enforcement in production mode
  - [x] 5.8: Run compile + lint + test to validate

## Dev Notes

- Much of this story is VERIFICATION of existing implementations from Stories 15.2, 15.4, 15.5, 16.1
- The main new work is: HTTPS enforcement, password cleanup, and comprehensive security tests
- Session cookie was configured in Story 15.2 (apiProxy.ts) — verify and enhance if needed
- Password clearing from form fields is a client-side security practice
- HTTPS enforcement: In production, the server should reject /api/connect over HTTP to prevent credential transmission in cleartext
- This story adds a security verification test suite that acts as a regression guard

### Cookie Lifecycle Documentation (Task 3.5)

The session cookie (`iris_session`) follows this lifecycle:

1. **Creation**: Set via `Set-Cookie` header on successful POST `/api/connect` response
2. **Attributes**: `HttpOnly; SameSite=Strict; Path=/` (+ `Secure` in production)
3. **Expiry**: No `Max-Age` or `Expires` is set, making it a **session cookie** that is deleted when the browser closes
4. **Server-side timeout**: The `SessionManager` enforces a sliding-window timeout (default 30 min via `SESSION_TIMEOUT` env var). Even if the cookie persists, the server will reject expired sessions.
5. **Destruction**: Cookie is cleared (Max-Age=0) on POST `/api/disconnect` or when the server detects session expiry

### Project Structure Notes

- Primarily modifies existing files (verification and hardening)
- New test file: `packages/web/src/test/credentialSecurity.test.ts`
- May need minor updates to apiProxy.ts or security.ts for HTTPS enforcement

### References

- [Source: architecture.md#Session & Credential Management (Web)] — Credential flow
- [Source: epics.md#Story 16.2] — Acceptance criteria
- [Source: web/src/server/apiProxy.ts] — Session cookie configuration
- [Source: web/src/server/sessionManager.ts] — Credential storage
- [Source: web/public/connection-form.js] — Client-side credential handling

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
No debug issues encountered.

### Completion Notes List

- **Task 1 (Verification + HTTPS enforcement)**: Audited and verified that POST /api/connect sends credentials in request body only, server validates against IRIS before creating session, credentials stored only in server-side SessionManager memory, and session token delivered via HTTP-only cookie. Added HTTPS enforcement in production mode: new guard in apiProxy.ts `/api/connect` handler rejects non-HTTPS requests with 403 when `NODE_ENV=production`.

- **Task 2 (Browser storage audit)**: Audited `connection-form.js` saveRecentConnection() function — confirmed password is explicitly excluded from the saved entry object. Only host, port, pathPrefix, namespace, username, useHTTPS are stored. No writes to sessionStorage exist in the codebase. Added automated test verifying password absence from stored recent connections.

- **Task 3 (Session cookie config)**: Verified HttpOnly, SameSite=Strict, Secure (production), and session-scoped (no Max-Age/Expires) cookie attributes. All set correctly in the `setSessionCookie()` function in apiProxy.ts. Documented cookie lifecycle in Dev Notes section.

- **Task 4 (Password field security)**: Verified `type="password"` on the password input in index.html. Added password clearing logic in connection-form.js: after successful connection, `fields.password.value = ''` clears the DOM input and `data.password = ''` clears the local JS variable.

- **Task 5 (Security verification tests)**: Created comprehensive `credentialSecurity.test.ts` with 18 tests covering: credential transmission security (4 tests), connect response password absence (1 test), session response password absence (1 test), session cookie security (4 tests), recent connections storage security (2 tests), HTTPS enforcement in production (2 tests), non-production HTTP allowance (1 test), password field security (2 tests), and Secure flag verification (1 test). All 162 web tests pass (up from 144).

### File List

- `packages/web/src/server/apiProxy.ts` — Modified: Added HTTPS enforcement guard in `/api/connect` handler for production mode (Task 1.5)
- `packages/web/public/connection-form.js` — Modified: Added password clearing from form field and local variable after successful connection (Tasks 4.2, 4.3)
- `packages/web/src/test/credentialSecurity.test.ts` — New: Comprehensive security verification test suite with 18 tests (Task 5)
- `_bmad-output/implementation-artifacts/16-2-browser-credential-handling.md` — Modified: Updated status, task checkboxes, completion notes, file list
