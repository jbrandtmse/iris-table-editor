# Story 19.1: Feature Parity Verification (Web)

Status: review

## Story

As a **developer**,
I want **to verify all feature parity checkpoints work in the browser**,
So that **web users get the same experience as VS Code and desktop users**.

## Acceptance Criteria

1. When the 24 feature parity checkpoints from Epic 14 are tested against the web codebase, all are accounted for: grid display, column headers, pagination, cell selection, inline editing, save/cancel, visual feedback, row creation, row deletion, schema tree, column filtering, filter panel, column sorting, boolean checkbox, date picker, time fields, numeric fields, null values, keyboard shortcuts, CSV/Excel export/import

## Tasks / Subtasks

- [x] Task 1: Create feature parity verification test suite (AC: 1)
  - [x] 1.1: Create `packages/web/src/test/featureParity.test.ts`
  - [x] 1.2: Verify the shared webview package is properly integrated — check that @iris-te/webview main.js, styles.css exist and are served as static files
  - [x] 1.3: Verify the command handler supports all 24 feature command types (selectTable, updateRow, insertRow, deleteRow, paginate, sort, filter, export, import, etc.)
  - [x] 1.4: Verify the API proxy forwards all required endpoints (/action/query for SQL operations)
  - [x] 1.5: Verify the WebSocket bridge handles all command/event types
  - [x] 1.6: Verify the SPA shell loads the shared webview HTML/CSS/JS

- [x] Task 2: Verify bridge message compatibility (AC: 1)
  - [x] 2.1: Check that WebMessageBridge implements the same IMessageBridge interface methods
  - [x] 2.2: Verify the message format (command/event structure) matches what the shared webview expects
  - [x] 2.3: Verify the connection form correctly sends connect/disconnect commands

- [x] Task 3: Run compile + lint + test to validate
  - [x] 3.1: Run `npm run compile` — must pass
  - [x] 3.2: Run `npm run lint` — must pass
  - [x] 3.3: Run `npm run test --workspace=packages/web` — must pass

## Dev Notes

### Approach
Since we can't run a live IRIS server in CI, these tests verify the CODE PATHS exist — that all commands are wired, all event handlers are registered, and the shared webview assets are accessible. This is a structural verification, not a functional end-to-end test.

### Key Files to Check
- `packages/web/src/server/commandHandler.ts` — All commands the server handles
- `packages/web/src/server/wsServer.ts` — WebSocket command routing
- `packages/web/src/server/server.ts` — Static file serving for webview
- `packages/web/public/web-message-bridge.js` — IMessageBridge implementation
- `packages/webview/src/main.js` — Shared webview (commands it sends)

### The 24 Checkpoints Map To These Commands
1-3: selectTable, paginate → grid, headers, pagination
4-7: (client-side keyboard nav, editing, save, cancel)
8: (client-side visual feedback states)
9: insertRow
10: deleteRow (with confirmation)
11: selectTable with namespace browsing
12-13: (client-side filtering — filterData command or client-side)
14: sortData
15-19: (client-side data type controls — part of shared webview)
20: (client-side keyboard shortcuts — shared webview)
21-24: exportCsv, exportExcel, importCsv, importExcel

### Project Structure Notes
- `packages/web/src/test/featureParity.test.ts` — NEW: feature parity verification tests

### Files Changed
- `packages/web/src/test/featureParity.test.ts` — NEW: 113 tests across 11 suites

### Completion Notes
- 113 structural verification tests covering all 24 feature parity checkpoints
- Test suites: Shared Webview Assets (8), Command Handler Completeness (17), WebSocket Routing (9), API Proxy Coverage (11), Bridge Interface (7), Bridge Message Format (6), Connection Form Commands (6), SPA Shell Integration (14), Client-Side Features in Shared Webview (22), Complete Command/Event Mapping (4), Static File Serving (9)
- All tests read actual source files and verify expected patterns via string matching
- No new dependencies added; no live server or IRIS connection required
- `npm run compile` — passed
- `npm run lint` — passed
- `npm run test --workspace=packages/web` — 611 tests, 0 failures

### References
- [Source: epics.md#Story 19.1] — Acceptance criteria
- [Source: 14-1-feature-parity-verification.md] — Desktop feature parity reference
