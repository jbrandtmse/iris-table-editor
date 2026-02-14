# Story 17.5: Browser Navigation

Status: done

## Story

As a **user**,
I want **to manage multiple open tables and use URL-based navigation**,
So that **I can bookmark tables and use browser back/forward navigation**.

## Acceptance Criteria

1. When I click "Open Table" in the tab bar or double-click a table in the schema tree, a table opens and the browser URL updates to `/table/{namespace}/{tableName}` (the schema tree/table selection is already part of the shared webview)
2. When I have multiple table tabs open and I click a tab, the URL updates to reflect the active table
3. When I click browser Back/Forward buttons, the previous/next table view is restored and the correct tab becomes active
4. When I bookmark a table URL and navigate to it later with an active session, the table opens directly (already partially handled by spa-router.js)
5. When I navigate to a bookmarked URL without a session, I see the connection form, and after connecting I am redirected to the bookmarked table

## Tasks / Subtasks

- [x] Task 1: URL update on table selection (AC: 1, 2)
  - [x] 1.1: In spa-router.js, listen for `tableSelected` events from the bridge that indicate a table was loaded
  - [x] 1.2: When a table loads, update the URL using `history.pushState()` to `/table/{namespace}/{tableName}`
  - [x] 1.3: When switching tabs (another table already loaded), update URL using `pushState()` with duplicate detection
  - [x] 1.4: Encode namespace and table name in the URL path (use `encodeURIComponent` for special chars)

- [x] Task 2: Browser back/forward navigation (AC: 3)
  - [x] 2.1: Add `popstate` event listener in spa-router.js
  - [x] 2.2: On popstate, parse the URL for table context and send `selectTable` command via bridge
  - [x] 2.3: Handle navigation to root `/` — don't send selectTable (just clear current route)

- [x] Task 3: Post-connect redirect to bookmarked URL (AC: 5)
  - [x] 3.1: Extended `handleInitialRoute()` polling timeout from 5s to 30s to handle slow form fill
  - [x] 3.2: Bridge becomes available after connect via MutationObserver on connectedView
  - [x] 3.3: The existing spa-router.js `handleInitialRoute()` polling handles this when bridge becomes available after connect

- [x] Task 4: Table event integration (AC: 1, 2)
  - [x] 4.1: Determined event is `tableSelected` (from commandHandler.ts selectTable case, payload includes namespace + tableName)
  - [x] 4.2: Register bridge event handler via `onEvent('tableSelected', ...)` in `registerBridgeHandlers()`
  - [x] 4.3: Update URL based on the active table's namespace and table name from the event payload

- [x] Task 5: Write tests (AC: 1-5)
  - [x] 5.1: Create `packages/web/src/test/browserNavigation.test.ts`
  - [x] 5.2: Test that spa-router.js source includes `pushState` usage
  - [x] 5.3: Test that spa-router.js has `popstate` event listener
  - [x] 5.4: Test that parseTableRoute correctly handles various URL patterns (11 test cases)
  - [x] 5.5: Test SPA catch-all returns HTML for deep table routes
  - [x] 5.6: Run compile + lint + test to validate (330 tests pass, 0 failures)

## Files Modified

- `packages/web/public/spa-router.js` — Extended with pushState, popstate, bridge event handlers, reconnect support
- `packages/web/src/test/browserNavigation.test.ts` — NEW: 25 tests for navigation behavior

## Completion Notes

- The key bridge event is `tableSelected` (not `tableData` or `tableSchema` as speculated in dev notes). The `selectTable` command handler in `commandHandler.ts` returns `{ event: 'tableSelected', payload: { tableName, namespace, columns, rows, ... } }`.
- URL updates use `history.pushState()` with duplicate detection via `currentRoute` tracking and `isSameRoute()`.
- The `popstate` handler parses the URL and sends `selectTable` via bridge for table routes; clears `currentRoute` for root/non-table routes.
- Post-connect redirect works via the existing `handleInitialRoute()` polling mechanism with timeout extended to 30 seconds (300 attempts at 100ms intervals). No changes needed to `connection-form.js`.
- Bridge event handlers are re-registered on WebSocket reconnect via `ite-ws-reconnected` event listener with a 50ms delay to let WebMessageBridge re-initialize.
- No changes needed to `connection-form.js` — the bridge initialization flow (MutationObserver on connectedView hidden attribute) naturally makes the bridge available for the polling mechanism.

## Dev Notes

- `spa-router.js` already exists with `parseTableRoute()` and `handleInitialRoute()` — extend it, don't rewrite
- The shared webview dispatches events via the bridge when tables are loaded — the key event to listen for is likely `tableData` (which includes the table name and namespace)
- `history.pushState(state, '', url)` for new table opens; `history.replaceState()` for tab switches if desired
- The `popstate` event fires when user clicks Back/Forward — parse URL and send selectTable command
- The post-connect redirect should work via the existing `handleInitialRoute()` polling mechanism — when bridge becomes available after connect, the route handler fires
- Don't forget to check `window.iteMessageBridge` availability before registering event handlers
- Use the same bridge initialization pattern as WebMessageBridge (wait for `ite-bridge-ready` or poll)

### Key Event Flow
1. User selects table in schema tree → shared webview sends `openTable` command → server processes → server sends `tableSelected` event → bridge dispatches to handlers
2. Router listens for `tableSelected` event → extracts namespace/tableName → calls `history.pushState('/table/{ns}/{table}')`
3. User clicks Back → `popstate` fires → router parses URL → sends `selectTable` command via bridge

### Project Structure Notes
- `packages/web/public/spa-router.js` — MODIFY: add pushState, popstate, event listeners
- `packages/web/src/test/browserNavigation.test.ts` — NEW: navigation tests
- `packages/web/public/connection-form.js` — possibly modify for post-connect redirect

### References
- [Source: epics.md#Story 17.5] — Acceptance criteria
- [Source: web/public/spa-router.js] — Existing SPA router
- [Source: webview/src/main.js] — Shared webview table selection logic
- [Source: web/src/server/commandHandler.ts] — Server command handling
