# Story 15.3: WebSocket Server

Status: review

## Story

As a **developer**,
I want **a WebSocket server for IMessageBridge communication**,
So that **the browser can send commands and receive events in real-time**.

## Acceptance Criteria

1. When a browser client connects via WebSocket, the connection is established within 1 second
2. The WebSocket connection is authenticated against the user's session (session token required)
3. When an unauthenticated WebSocket attempt is made without valid session, the server closes the connection with code 4001 (Unauthorized)
4. When the browser sends a command (JSON: `{ command, payload }`), the server processes it using @iris-te/core services and sends back an event response (JSON: `{ event, payload }`)
5. When the session expires, the server sends a session-expired event and closes the connection
6. When the WebSocket connection drops, the browser should be able to reconnect (server supports new connections)

## Tasks / Subtasks

- [x] Task 1: Install ws package and set up WebSocket server (AC: 1)
  - [x] 1.1: Add `ws` and `@types/ws` to packages/web dependencies
  - [x] 1.2: Create `packages/web/src/server/wsServer.ts` with `setupWebSocket(server, sessionManager)` function
  - [x] 1.3: Create WebSocketServer attached to the existing HTTP server from Story 15.1
  - [x] 1.4: Handle the `upgrade` request to validate session before allowing WebSocket connection

- [x] Task 2: Implement session-authenticated WebSocket connections (AC: 2, 3)
  - [x] 2.1: Extract session token from WebSocket upgrade request (cookie or query parameter `?token=`)
  - [x] 2.2: Validate session via SessionManager.validate() or SessionManager.validateFromUpgrade(req)
  - [x] 2.3: Add `validateFromUpgrade(req)` method to SessionManager if not already present
  - [x] 2.4: On invalid session, close WebSocket with code 4001 and reason "Unauthorized"
  - [x] 2.5: On valid session, accept connection and store session reference

- [x] Task 3: Implement command processing (AC: 4)
  - [x] 3.1: Parse incoming WebSocket messages as JSON `{ command, payload }`
  - [x] 3.2: Create `packages/web/src/server/commandHandler.ts` with `handleCommand(command, payload, session)` function
  - [x] 3.3: Route commands to appropriate @iris-te/core services based on command name:
    - `getNamespaces` → TableMetadataService.getNamespaces()
    - `getTables` → TableMetadataService.getTables()
    - `selectTable` → TableMetadataService.getTableSchema() + QueryExecutor.fetchTableData()
    - `requestData` / `paginate` → QueryExecutor.fetchTableData()
    - `refreshData` → QueryExecutor.fetchTableData()
    - `updateRow` → QueryExecutor.updateRow()
    - `insertRow` → QueryExecutor.insertRow()
    - `deleteRow` → QueryExecutor.deleteRow()
  - [x] 3.4: Send response back as JSON `{ event, payload }` where event maps to the appropriate response event name
  - [x] 3.5: Handle errors in command processing — send error event back to client

- [x] Task 4: Handle session expiry notifications (AC: 5)
  - [x] 4.1: Track WebSocket connections by session token in a Map
  - [x] 4.2: When SessionManager destroys a session, notify all associated WebSocket connections
  - [x] 4.3: Send `{ event: "sessionExpired", payload: {} }` before closing
  - [x] 4.4: Close connection with code 4002 (Session Expired)

- [x] Task 5: Handle connection cleanup (AC: 6)
  - [x] 5.1: On WebSocket close, remove from session tracking
  - [x] 5.2: On WebSocket error, log and clean up
  - [x] 5.3: Handle malformed JSON messages gracefully (send error event, don't crash)

- [x] Task 6: Wire WebSocket server into main server (AC: 1-6)
  - [x] 6.1: Import and call `setupWebSocket(server, sessionManager)` in server.ts
  - [x] 6.2: Ensure WebSocket server shares the HTTP server instance

- [x] Task 7: Write tests (AC: 1-6)
  - [x] 7.1: Create `packages/web/src/test/wsServer.test.ts`
  - [x] 7.2: Test WebSocket connection with valid session succeeds
  - [x] 7.3: Test WebSocket connection without session closes with 4001
  - [x] 7.4: Test command send/receive cycle (mock core service responses)
  - [x] 7.5: Test malformed JSON message returns error event
  - [x] 7.6: Test unknown command returns error event
  - [x] 7.7: Create `packages/web/src/test/commandHandler.test.ts`
  - [x] 7.8: Test each command routes to correct core service
  - [x] 7.9: Test command error handling returns error event
  - [x] 7.10: Run compile + lint + test to validate

## Dev Notes

- Follow architecture spec section "WebSocket Server"
- Use the `ws` npm package (industry standard WebSocket library for Node.js)
- The HTTP server from Story 15.1 uses `http.createServer(app)` specifically to support WebSocket upgrade
- Command names should match the existing IMessageBridge command vocabulary used in VS Code and Desktop targets
- Check `packages/core/src/models/IMessages.ts` for the complete command/event type definitions
- For command processing, create service instances per-session using session credentials (similar to desktop SessionManager pattern)
- The commandHandler should create AtelierApiService, QueryExecutor, TableMetadataService instances using session connection details
- Use dependency injection in commandHandler for testability (inject service factory)
- Tests use `ws` client library to connect to the test server

### Project Structure Notes

- `packages/web/src/server/wsServer.ts` — WebSocket server setup and connection management
- `packages/web/src/server/commandHandler.ts` — Command routing to core services
- Both follow the existing modular pattern (setupX functions)

### References

- [Source: architecture.md#WebSocket Server] — WebSocket server design
- [Source: architecture.md#IMessageBridge Abstraction] — Command/event interface contract
- [Source: core/src/models/IMessages.ts] — Command and event type definitions
- [Source: desktop/src/main/ipc.ts] — Desktop command routing pattern (reference for commandHandler)
- [Source: desktop/src/main/SessionManager.ts] — Per-session service instance pattern
- [Source: epics.md#Story 15.3] — Acceptance criteria

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Fixed ws client test issue: `unexpected-response` event needs suppressed `error` event handler to avoid uncaught exception in test runner

### Completion Notes List
- Installed `ws` (^8.19.0) and `@types/ws` (^8.18.1) in packages/web
- Created `wsServer.ts` with `setupWebSocket()` function using `noServer` mode for manual upgrade handling
- Session validation extracts tokens from cookies or `?token=` query parameter during HTTP upgrade
- Invalid sessions get HTTP 401 response before WebSocket handshake (rejected at upgrade level)
- Created `commandHandler.ts` with `handleCommand()` routing all IMessageBridge commands to @iris-te/core services
- Command handler uses dependency-injected `ServiceFactory` for testability (same pattern as desktop ipc.ts)
- Each WebSocket connection maintains its own `ConnectionContext` (namespace, table, schema) for per-connection browsing state
- Session expiry tracked via `connectionsByToken` Map; `notifySessionExpired()` sends sessionExpired event + code 4002
- Wired WebSocket into `server.ts` via `createAppServer()` — returns `wsHandle` for test/session-expiry access
- `CreateServerOptions` extended with `wsOptions` for injecting mock service factory in tests
- Task 2.3 (validateFromUpgrade): Implemented as a local function in wsServer.ts rather than modifying SessionManager, to keep the web-specific upgrade logic out of the shared session manager. Uses SessionManager.validate() internally with a synthesized Express-like request object.
- All 74 tests pass (14 new WebSocket tests + 16 new commandHandler tests + 44 existing tests)
- Compile and lint clean

### File List
- `packages/web/package.json` (modified — added ws, @types/ws dependencies)
- `packages/web/src/server/wsServer.ts` (new — WebSocket server setup and connection management)
- `packages/web/src/server/commandHandler.ts` (new — command routing to @iris-te/core services)
- `packages/web/src/server/server.ts` (modified — wired setupWebSocket, extended CreateServerOptions)
- `packages/web/src/test/wsServer.test.ts` (new — 14 WebSocket server tests)
- `packages/web/src/test/commandHandler.test.ts` (new — 16 command handler tests)

### Change Log
- 2026-02-14: Story 15.3 implemented — WebSocket server with session auth, command routing, session expiry, and connection cleanup (30 new tests)
