# Story 16.5: Session Persistence & Auto-Reconnect

Status: review

## Story

As a **user**,
I want **my session to survive page reloads**,
So that **I don't lose my work when I accidentally refresh the browser**.

## Acceptance Criteria

1. When I have an active session and reload the browser page (F5 or Ctrl+R), my session is still valid (session cookie persists), I return to the connected state, and my previously open table tabs are restored
2. When my session has expired during a page reload, I see the connection form with a message: "Session expired. Please reconnect." and my recent connections are still available for quick reconnect
3. When the WebSocket connection drops during use, I see a reconnection banner: "Connection lost. Reconnecting...", the browser attempts automatic reconnection with exponential backoff, and after successful reconnection the banner disappears and data refreshes

## Tasks / Subtasks

- [x] Task 1: Session persistence across page reloads (AC: 1)
  - [x] 1.1: Verify session cookie persists across page reloads (it's a session cookie — no Max-Age/Expires, so it persists until browser closes)
  - [x] 1.2: Verify `checkSession()` on page load correctly restores the connected state (already implemented in Story 16.1/16.4)
  - [x] 1.3: Verify connection header is populated from /api/session on reload (already done in Story 16.4)
  - [x] 1.4: Store open table tab info in sessionStorage so it can be restored after reload (placeholder — tables are not yet implemented, store as empty array for now)
  - [x] 1.5: On reload with active session: restore from sessionStorage (or show empty state if no tabs stored)

- [x] Task 2: Expired session handling on reload (AC: 2)
  - [x] 2.1: When checkSession() returns `{ status: 'disconnected' }` AND sessionStorage has a flag indicating "was previously connected", show the session expired message
  - [x] 2.2: Add `state.wasConnected` flag in sessionStorage (set on connect, cleared on explicit disconnect)
  - [x] 2.3: Display "Session expired. Please reconnect." message in the connection form area (using existing showFormMessage)
  - [x] 2.4: Verify recent connections list is available for quick reconnect (already stored in localStorage)

- [x] Task 3: WebSocket reconnection with exponential backoff (AC: 3)
  - [x] 3.1: Create `packages/web/public/ws-reconnect.js` — WebSocket client with auto-reconnect
  - [x] 3.2: Implement exponential backoff: start at 1s, max 30s, with jitter (random ±20%)
  - [x] 3.3: On WebSocket disconnect: show reconnection banner at top of page "Connection lost. Reconnecting..."
  - [x] 3.4: On successful reconnect: hide banner, announce to screen reader, trigger data refresh event
  - [x] 3.5: On reconnect failure after max retries (10): show "Connection lost. Please refresh the page." with a refresh button
  - [x] 3.6: Add reconnection banner HTML to `index.html` (hidden by default)
  - [x] 3.7: Style reconnection banner with BEM classes `.ite-reconnect-banner`
  - [x] 3.8: Connect the WebSocket client to the existing WebSocket server (ws://host/ws with session cookie)

- [x] Task 4: WebSocket session expiry handling (AC: 3)
  - [x] 4.1: Handle `sessionExpired` event from WebSocket server (close code 4002, already sent by server in Story 15.3/15.5)
  - [x] 4.2: On session expiry via WebSocket: do NOT attempt reconnect (session is invalid), show connection form with "Session expired" message
  - [x] 4.3: Distinguish between session expiry (close code 4002) and network disconnect (close code 1006/other)

- [x] Task 5: Write tests (AC: 1-3)
  - [x] 5.1: Create `packages/web/src/test/sessionPersistence.test.ts`
  - [x] 5.2: Test that /api/session returns connected after "simulated reload" (same cookie)
  - [x] 5.3: Test that /api/session returns disconnected after session timeout
  - [x] 5.4: Test WebSocket reconnection logic (unit test the backoff algorithm)
  - [x] 5.5: Test WebSocket distinguishes session expiry (4002) from network disconnect
  - [x] 5.6: Test reconnection banner show/hide behavior
  - [x] 5.7: Run compile + lint + test to validate

## Dev Notes

- Session cookie is already a session cookie (no Max-Age/Expires) so it persists until browser close — this is correct behavior for AC 1
- `checkSession()` already checks /api/session and shows connected/disconnected view — Story 16.1/16.4
- The "restore table tabs" part of AC 1 is a placeholder since the grid UI isn't implemented yet (Epic 17). Store tab state in sessionStorage but actual restoration happens in Epic 17.
- WebSocket client for the browser is NEW work — the WebSocket server exists (Story 15.3) but no browser client has been created yet
- The WebSocket connection uses the session cookie for auth (same as HTTP requests)
- Exponential backoff formula: `delay = min(baseDelay * 2^attempt, maxDelay) + jitter`
- Session expiry close code 4002 was established in Story 15.3 (wsServer.ts notifySessionExpired)
- The reconnection banner should be visually prominent but not block interaction
- This story completes Epic 16 — after this, the web app has full auth/connection lifecycle

### Project Structure Notes

- `packages/web/public/index.html` — add reconnection banner, reference ws-reconnect.js
- `packages/web/public/ws-reconnect.js` — NEW: WebSocket client with auto-reconnect
- `packages/web/public/connection-form.js` — add session expiry handling, wasConnected flag
- `packages/web/public/connection-form.css` — add reconnection banner styles
- `packages/web/src/test/sessionPersistence.test.ts` — new test file

### References

- [Source: architecture.md#Session & Credential Management] — Session lifecycle
- [Source: epics.md#Story 16.5] — Acceptance criteria
- [Source: web/src/server/wsServer.ts] — WebSocket server with close code 4002
- [Source: web/public/connection-form.js] — checkSession, session state

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
N/A

### Completion Notes List
- Session cookie already persists across reloads (session cookie with no Max-Age/Expires) — verified via integration test
- `checkSession()` already restores connected state on reload — enhanced with wasConnected flag for expired session detection
- Added `ite-was-connected` sessionStorage flag: set on connect (both handleConnect and checkSession), cleared on explicit disconnect
- Added `ite-open-tabs` sessionStorage placeholder (empty array) for future Epic 17 tab restoration
- Created `ws-reconnect.js`: browser WebSocket client with exponential backoff (1s base, 30s max, ±20% jitter, 10 max retries)
- WebSocket auto-connects when connectedView becomes visible (MutationObserver on hidden attribute)
- Close code 4002 = session expiry: delegates to `handleSessionExpired()`, no reconnect attempt
- Network disconnect (code 1006/other): shows reconnection banner, schedules exponential backoff reconnect
- On successful reconnect: hides banner, announces to screen reader, fires `ite-ws-reconnected` custom event
- After max retries: shows "Connection lost. Please refresh the page." with refresh button
- Reconnection banner positioned at top of page, uses BEM `.ite-reconnect-banner` classes
- CSP updated to allow `ws:` and `wss:` in connect-src
- All 208 web tests pass (28 new tests added); compile and lint clean
- Desktop test failure (`should have exactly 25 events` — 26 !== 25) is pre-existing and unrelated

### File List
- `packages/web/public/connection-form.js` — Modified: added wasConnected/openTabs sessionStorage tracking, handleSessionExpired function, expired session detection in checkSession
- `packages/web/public/ws-reconnect.js` — NEW: Browser WebSocket client with auto-reconnect, exponential backoff, session expiry handling
- `packages/web/public/index.html` — Modified: added reconnection banner HTML, ws-reconnect.js script tag, updated CSP for ws:/wss:
- `packages/web/public/connection-form.css` — Modified: added .ite-reconnect-banner styles
- `packages/web/src/test/sessionPersistence.test.ts` — NEW: 28 tests covering session persistence, backoff algorithm, WS expiry vs disconnect, banner behavior, state tracking
