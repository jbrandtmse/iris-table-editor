# Story 17.2: WebMessageBridge

Status: review

## Story

As a **developer**,
I want **a WebSocket-based implementation of IMessageBridge**,
So that **the shared webview communicates with the server using the same interface as VS Code and desktop**.

## Acceptance Criteria

1. When the SPA loads and the WebMessageBridge initializes, it establishes a WebSocket connection to the server and the connection authenticates using the session token
2. When the webview sends a command (e.g., `loadTables`) via `bridge.sendCommand()`, it is serialized as JSON and sent over WebSocket, and the server receives, processes, and sends back an event
3. When the server sends an event (e.g., `tableData`) over WebSocket, the registered event handlers are called with the payload and the webview AppState updates
4. When the webview uses `bridge.offEvent()` to remove an event handler, it no longer receives events of that type
5. When all existing commands and events are used through WebMessageBridge, they work identically to VSCodeMessageBridge and ElectronMessageBridge, and no webview code changes are needed

## Tasks / Subtasks

- [x] Task 1: Verify end-to-end command/event flow (AC: 1, 2, 3)
  - [x] 1.1: Write integration test: connect to server, establish WebSocket, send `getNamespaces` command, receive `namespaceList` event response
  - [x] 1.2: Write integration test: send `getTables` command with namespace, receive `tableList` event response
  - [x] 1.3: Write integration test: send `requestData` command with table context, receive `tableData` event response
  - [x] 1.4: Verify command JSON format matches what commandHandler.ts expects: `{ command, payload }`
  - [x] 1.5: Verify event JSON format matches what WebMessageBridge dispatches: `{ event, payload }`

- [x] Task 2: Verify bridge contract compliance (AC: 4, 5)
  - [x] 2.1: Write unit test: `sendCommand` serializes `{ command, payload }` as JSON and sends over WebSocket
  - [x] 2.2: Write unit test: `onEvent` registers handler, receives dispatched events
  - [x] 2.3: Write unit test: `offEvent` removes specific handler (not all handlers for that event)
  - [x] 2.4: Write unit test: `getState`/`setState` round-trip through sessionStorage
  - [x] 2.5: Write unit test: multiple handlers for same event all receive the event
  - [x] 2.6: Write unit test: handler removed via offEvent stops receiving events

- [x] Task 3: Verify command buffering and reconnect (AC: 1)
  - [x] 3.1: Write test: commands sent before WebSocket is OPEN are buffered and flushed when connection opens
  - [x] 3.2: Write test: on WebSocket reconnect, bridge re-initializes and can send/receive again
  - [x] 3.3: Write test: bridge destroy() clears all handlers and buffered commands

- [x] Task 4: Verify parity with other bridge implementations (AC: 5)
  - [x] 4.1: Read `packages/vscode/src/VSCodeMessageBridge.js` and `packages/desktop/src/main/preload.ts` bridge to understand their contract
  - [x] 4.2: Verify WebMessageBridge handles all commands that commandHandler.ts supports
  - [x] 4.3: Verify event names match between server (commandHandler.ts) and bridge dispatch
  - [x] 4.4: Document any differences or gaps (if any)

- [x] Task 5: Fix any issues found during verification (AC: 1-5)
  - [x] 5.1: Fix any JSON format mismatches between bridge and commandHandler — No mismatches found
  - [x] 5.2: Fix any missing event handling — No missing handlers found
  - [x] 5.3: Ensure error responses from server are properly dispatched as events

- [x] Task 6: Run full test suite and update story (AC: 1-5)
  - [x] 6.1: Run compile + lint + test to validate
  - [x] 6.2: Update story file with all checkboxes and completion notes

## Dev Notes

- The WebMessageBridge was created in Story 17.1 (`packages/web/public/WebMessageBridge.js`) — this story VERIFIES and HARDENS it
- Story 17.1 review noted: "No behavioral tests for WebMessageBridge" — this story adds them
- For unit tests of browser JS (WebMessageBridge.js), use a mock WebSocket approach:
  - Create a minimal mock WebSocket class that captures sent messages and can simulate received messages
  - OR test via the server-side WebSocket integration tests (connect real WebSocket, send commands, verify responses)
- The commandHandler.ts (Story 15.3) processes commands and sends back events. Test the full round-trip.
- For `offEvent` test: register a handler, call offEvent, send an event, verify handler is NOT called
- The bridge's `getState()`/`setState()` use sessionStorage — test with a mock or in a Node.js environment using global mocks
- The end-to-end tests should use a real test server (createAppServer) + real WebSocket client (from `ws` package)

### Integration Test Pattern

```typescript
import WebSocket from 'ws';

// Create test server
const { server } = await createAppServer({ fetchFn: mockFetch, skipSecurity: true });
// Connect session
// Open WebSocket with session cookie
const ws = new WebSocket(`ws://localhost:${port}/ws`, { headers: { cookie: `iris_session=${token}` } });
// Send command
ws.send(JSON.stringify({ command: 'getNamespaces', payload: {} }));
// Receive event
ws.on('message', (data) => { /* verify event format */ });
```

### Project Structure Notes

- `packages/web/src/test/webMessageBridge.test.ts` — NEW test file
- `packages/web/public/WebMessageBridge.js` — may need fixes based on verification
- No new files expected besides the test file

### References

- [Source: architecture.md#IMessageBridge Abstraction] — Bridge interface spec
- [Source: epics.md#Story 17.2] — Acceptance criteria
- [Source: web/public/WebMessageBridge.js] — Bridge implementation (Story 17.1)
- [Source: web/src/server/commandHandler.ts] — Server-side command processing
- [Source: core/src/models/IMessageBridge.ts] — Interface definition

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
N/A - no debugging issues encountered.

### Completion Notes List
- Created comprehensive test file `packages/web/src/test/webMessageBridge.test.ts` with 33 new tests across 4 major test suites
- **Part 1 (Integration)**: 12 end-to-end tests using real WebSocket connections to a test server, verifying all 9 commands (getNamespaces, getTables, selectTable, requestData, paginate, refreshData, updateRow, insertRow, deleteRow) plus error handling (malformed JSON, unknown commands, service failures)
- **Part 2 (Unit)**: 12 unit tests verifying bridge contract compliance — sendCommand serialization, onEvent/offEvent handler management, getState/setState round-trip via mock sessionStorage, multiple handlers per event
- **Part 3 (Buffering)**: 4 tests for command buffering before WS open, reconnect behavior, destroy() cleanup, and message ordering preservation
- **Part 4 (Parity)**: 5 tests verifying command-to-event mapping completeness (all 9 commands), event name consistency, IMessageBridge method coverage, and cross-bridge format parity
- **Task 5 (Fixes)**: No issues found during verification. The WebMessageBridge implementation is correct — JSON formats match, all events are properly dispatched, and error responses flow through correctly
- **Parity findings**: All three bridges (VSCode, Electron, Web) implement the 5-method IMessageBridge contract. Acceptable differences: Electron adds emitLocalEvent() for tab switching, Web adds destroy() for lifecycle cleanup, Electron has channel validation for security. The core `{ command, payload }` / `{ event, payload }` message format is identical across all bridges.
- Full test suite: 262 tests, 0 failures. Compile and lint pass cleanly.

### File List
- `packages/web/src/test/webMessageBridge.test.ts` (NEW) - 33 tests for WebMessageBridge verification
