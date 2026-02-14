# Story 16.3: Connection Test

Status: review

## Story

As a **user**,
I want **to test my connection before committing to it**,
So that **I can verify the server is reachable and credentials are correct**.

## Acceptance Criteria

1. When I have filled in connection details and click "Test Connection", the button changes to "Testing..." with a spinner, and the server proxies a test request to the IRIS server with a 30-second timeout
2. When the test succeeds, I see a success indicator with "Connection successful" in green text, and the IRIS server version is displayed
3. When the test fails, I see a failure indicator with "Could not connect: [reason]" in red text with an actionable error message (e.g., "Connection refused — check hostname and port")
4. When the test is taking too long and I click "Cancel", the test request is aborted and the button returns to "Test Connection"

## Tasks / Subtasks

- [x] Task 1: Add POST /api/test-connection server endpoint (AC: 1, 2, 3)
  - [x] 1.1: Add POST `/api/test-connection` route in `apiProxy.ts` that accepts connection details in request body
  - [x] 1.2: Validate required fields (host, port, namespace, username, password)
  - [x] 1.3: Build Atelier URL and attempt a GET request to the IRIS server (same pattern as /api/connect)
  - [x] 1.4: On success: parse IRIS response for server version info and return `{ status: 'success', version: '...' }`
  - [x] 1.5: On failure: classify error (connection refused, auth failed, timeout) and return actionable error message
  - [x] 1.6: Add 30-second timeout with AbortController (same pattern as existing proxy requests)
  - [x] 1.7: Add HTTPS enforcement for production (same guard as /api/connect)
  - [x] 1.8: Add `/api/test-connection` to CSRF_EXEMPT_PATHS in security.ts (pre-auth endpoint like /api/connect)

- [x] Task 2: Add "Test Connection" button to connection form UI (AC: 1, 4)
  - [x] 2.1: Add "Test Connection" button in `index.html` next to "Connect" button
  - [x] 2.2: Style with BEM classes `.ite-connection-form__test-btn` matching existing button styles
  - [x] 2.3: Add spinner element for the test button (same pattern as connect button)
  - [x] 2.4: Add test result display area below the buttons

- [x] Task 3: Add test connection JavaScript logic (AC: 1-4)
  - [x] 3.1: In `connection-form.js`, add `handleTestConnection()` function
  - [x] 3.2: Validate form fields before sending test (reuse existing `validateForm()`)
  - [x] 3.3: Show "Testing..." state: change button text, show spinner, disable both buttons
  - [x] 3.4: POST to `/api/test-connection` with connection details in body
  - [x] 3.5: Include CSRF token in header (same pattern as /api/connect)
  - [x] 3.6: On success: show green "Connection successful — IRIS version: X.Y.Z" message
  - [x] 3.7: On failure: show red "Could not connect: [actionable reason]" message
  - [x] 3.8: Implement cancel: use AbortController for the fetch, add "Cancel" button that appears during testing
  - [x] 3.9: On cancel: abort fetch, restore button to "Test Connection", clear result message
  - [x] 3.10: Restore form state (re-enable buttons) after test completes or cancels
  - [x] 3.11: Add screen reader announcements for test results

- [x] Task 4: Write tests (AC: 1-4)
  - [x] 4.1: Create `packages/web/src/test/connectionTest.test.ts`
  - [x] 4.2: Test POST /api/test-connection with valid credentials returns success + version
  - [x] 4.3: Test POST /api/test-connection with invalid credentials returns auth error
  - [x] 4.4: Test POST /api/test-connection with unreachable host returns connection error
  - [x] 4.5: Test POST /api/test-connection with missing fields returns 400
  - [x] 4.6: Test POST /api/test-connection timeout behavior
  - [x] 4.7: Test HTTPS enforcement on /api/test-connection in production
  - [x] 4.8: Test /api/test-connection does NOT create a session (stateless test)
  - [x] 4.9: Run compile + lint + test to validate

## Dev Notes

- The /api/test-connection endpoint is similar to /api/connect but does NOT create a session — it's a stateless probe
- Reuse the same error classification logic (classifyProxyError) from apiProxy.ts
- The desktop app has a similar test connection feature in `packages/desktop/src/main/ConnectionManager.ts` — use as reference
- IRIS Atelier API base URL GET returns server info including version — parse this from the response
- The cancel feature requires client-side AbortController — the browser aborts the fetch, server-side the proxy request may still complete but the response is discarded
- Test connection must NOT store credentials or create sessions — it's purely a probe
- Add to CSRF_EXEMPT_PATHS since this is a pre-auth action (user isn't connected yet)

### Project Structure Notes

- `packages/web/src/server/apiProxy.ts` — add POST /api/test-connection route
- `packages/web/src/server/security.ts` — add /api/test-connection to CSRF exempt list
- `packages/web/public/index.html` — add Test Connection button + result area
- `packages/web/public/connection-form.js` — add test connection logic
- `packages/web/public/connection-form.css` — add test button + result styles
- `packages/web/src/test/connectionTest.test.ts` — new test file

### References

- [Source: architecture.md#Web Connection Management] — Test connection via proxy
- [Source: epics.md#Story 16.3] — Acceptance criteria
- [Source: desktop/src/main/ConnectionManager.ts] — Desktop test connection (reference)
- [Source: web/src/server/apiProxy.ts] — Existing connect endpoint (pattern)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
N/A - clean implementation, no debugging required

### Completion Notes List
- Server endpoint (POST /api/test-connection) follows exact same pattern as /api/connect but is stateless (no session creation)
- Parses IRIS version from Atelier API response (result.content.version or falls back to API version)
- Error classification reuses existing classifyProxyError() for consistent error messages
- HTTPS enforcement in production mirrors /api/connect guard
- Added to CSRF_EXEMPT_PATHS since it's a pre-auth action
- Client-side uses AbortController for cancel capability; test button hides and cancel button appears during testing
- Cancel button restores form state and clears result
- Screen reader announcements for all state transitions (testing, success, failure, cancel)
- Test result area uses BEM classes with success (green) and error (red) styling matching existing message pattern
- 16 new tests: 15 in main suite + 1 HTTPS enforcement test
- All 179 web package tests pass; compile and lint clean
- Desktop package has 5 pre-existing test failures (ALLOWED_EVENTS count mismatch from parallel development) - not related to this story

### File List
- `packages/web/src/server/apiProxy.ts` — Added POST /api/test-connection endpoint (stateless IRIS probe with version parsing)
- `packages/web/src/server/security.ts` — Added /api/test-connection to CSRF_EXEMPT_PATHS
- `packages/web/public/index.html` — Added Test Connection button, spinner, cancel button, and test result area
- `packages/web/public/connection-form.js` — Added handleTestConnection(), handleCancelTest(), setTesting(), showTestResult(), clearTestResult() functions with AbortController cancel support
- `packages/web/public/connection-form.css` — Added .ite-connection-form__test-result styles (success/error variants)
- `packages/web/src/test/connectionTest.test.ts` — New test file with 16 tests covering all acceptance criteria
