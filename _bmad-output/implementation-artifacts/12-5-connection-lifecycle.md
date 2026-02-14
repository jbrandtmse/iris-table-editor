# Story 12.5: Connection Lifecycle

Status: review

## Story

As a **user**,
I want **to connect, disconnect, and switch between IRIS servers**,
so that **I can work with multiple IRIS environments from one application**.

## Acceptance Criteria

1. **Given** a user double-clicks a server OR selects "Connect" from context menu, **When** the connection initiates, **Then** display "Connecting to [server name]..." with progress indicator **And** show Cancel button to abort the connection

2. **Given** the connection attempt is in progress, **When** the user clicks Cancel, **Then** the connection attempt is aborted **And** the server returns to disconnected state **And** the user sees "Connection cancelled"

3. **Given** the connection succeeds, **When** the server responds, **Then** the server status indicator changes to green (connected) **And** the user can proceed to browse tables

4. **Given** the connection fails, **When** an error is returned, **Then** show a clear error message **And** the server status remains disconnected **And** the user can retry or edit connection details

5. **Given** a user is connected to a server, **When** the user clicks "Disconnect" (context menu), **Then** the connection is closed **And** the server status returns to disconnected

6. **Given** a user is connected to server A, **When** the user double-clicks server B, **Then** server A is disconnected first **And** server B connection initiates **And** only one server is connected at a time (MVP)

7. **Given** a user is connected and a network error occurs, **When** the next API call fails with a network error, **Then** display "Connection lost. Check your network and try reconnecting." **And** the server status changes to disconnected

## Tasks / Subtasks

- [x] Task 1: Create ConnectionLifecycleManager service (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 1.1: Create `packages/desktop/src/main/ConnectionLifecycleManager.ts`
  - [x] 1.2: Define `ConnectionState` type: `'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'`
  - [x] 1.3: Define `ConnectionLifecycleEvent` callback type for state change notifications:
    - `onConnectionProgress(payload: IDesktopConnectionProgressPayload): void`
    - Events: `connecting`, `connected`, `disconnected`, `cancelled`, `error`
  - [x] 1.4: Constructor takes `ConnectionManager` (for credentials) and `eventCallback` function
  - [x] 1.5: `connect(serverName: string): Promise<void>` method:
    - Retrieve server config via `connectionManager.getServer(serverName)`
    - Get decrypted password via `connectionManager.getDecryptedPassword(serverName)`
    - Build `IServerSpec` from server config
    - Create `AtelierApiService`, set 10s timeout
    - Use AbortController for cancellation support
    - Call `AtelierApiService.testConnection(spec, username, password, signal)`
    - Emit `connecting` -> `connected` or `error` via callback
    - Map error codes to user-friendly messages (reuse `TEST_CONNECTION_ERROR_MESSAGES` pattern)
  - [x] 1.6: `disconnect(): void` method:
    - Set state to `disconnected`
    - Clear current connection info
    - Emit `disconnected` via callback
  - [x] 1.7: `cancelConnection(): void` method:
    - Abort the pending connection via AbortController
    - State transitions to `disconnected`
    - Emit `cancelled` via callback
  - [x] 1.8: Server switching logic: if already connected, call `disconnect()` before `connect()`
  - [x] 1.9: State getters: `getState()`, `getConnectedServer()`, `isConnecting()`
  - [x] 1.10: Handle edge cases: connect while already connecting (cancel previous), connect to same server (no-op if connected)

- [x] Task 2: Add connection lifecycle message types (AC: 1, 2, 3, 4, 5, 7)
  - [x] 2.1: Add `IDesktopConnectionProgressPayload` interface: `{ status: 'connecting' | 'connected' | 'disconnected' | 'cancelled' | 'error'; serverName: string; message?: string; }`
  - [x] 2.2: Add `disconnectServer` command to `DesktopConnectionCommand` union
  - [x] 2.3: Add `cancelConnection` command to `DesktopConnectionCommand` union
  - [x] 2.4: Add `connectionProgress` event to `DesktopConnectionEvent` union
  - [x] 2.5: Export new types from `@iris-te/core`

- [x] Task 3: Update server list UI for connection progress (AC: 1, 2, 3, 4, 5, 7)
  - [x] 3.1: Add `connectionProgress` event handler to server-list.js:
    - `connecting`: show inline progress indicator on the server item, update state
    - `connected`: update `connectedServer`, clear progress
    - `disconnected`: clear `connectedServer`, clear progress
    - `cancelled`: clear progress, show brief "Cancelled" message
    - `error`: show error message near the server item, clear progress
  - [x] 3.2: Add `connectingServer` to state (tracks which server is being connected)
  - [x] 3.3: Render connecting state: spinner on the server item's status indicator + "Connecting..." text
  - [x] 3.4: Add "Cancel" button that appears during connection progress
  - [x] 3.5: Add "Disconnect" option to context menu (visible when server is connected)
  - [x] 3.6: Add inline error display under server item on connection failure (with Retry button)
  - [x] 3.7: Server switching: when connecting to a different server while one is connected, send `disconnectServer` first then `connectServer`

- [x] Task 4: Update server list CSS for connection progress (AC: 1, 3, 4, 7)
  - [x] 4.1: Add `.ite-server-list__status--connecting` style with CSS spinner animation
  - [x] 4.2: Add `.ite-server-list__progress` style for inline "Connecting..." text
  - [x] 4.3: Add `.ite-server-list__cancel-btn` style for inline cancel button
  - [x] 4.4: Add `.ite-server-list__inline-error` style for connection error display
  - [x] 4.5: Add `.ite-server-list__inline-error-actions` for Retry/Edit buttons

- [x] Task 5: Export ConnectionLifecycleManager (AC: all)
  - [x] 5.1: Export `ConnectionLifecycleManager` from `packages/desktop/src/index.ts`
  - [x] 5.2: Export `ConnectionState` type from desktop index

- [x] Task 6: Write tests (AC: all)
  - [x] 6.1: Unit tests for `ConnectionLifecycleManager.connect()`: success flow, error mapping, credential retrieval
  - [x] 6.2: Unit tests for cancellation: cancel during connection, AbortController usage
  - [x] 6.3: Unit tests for disconnect: state transition, callback invocation
  - [x] 6.4: Unit tests for server switching: disconnect A before connect B
  - [x] 6.5: Unit tests for edge cases: connect while connecting (cancels previous), connect to same server
  - [x] 6.6: Unit tests for network error detection and user-friendly messages
  - [x] 6.7: Unit tests for state getters: getState(), getConnectedServer(), isConnecting()
  - [x] 6.8: Unit tests for server not found and missing password scenarios
  - [x] 6.9: Tests in `packages/desktop/src/test/`

- [x] Task 7: Validate (AC: all)
  - [x] 7.1: Run `npm run compile` -- all packages compile
  - [x] 7.2: Run `npm run lint` -- no new lint errors
  - [x] 7.3: Run `npm run test` -- all tests pass
  - [x] 7.4: Verify packages/desktop has no `vscode` imports
  - [x] 7.5: Verify all state transitions are tested

## Dev Notes

### Architecture Context

This is the final story in Epic 12 (Connection Manager). It builds the connection lifecycle service layer that will be wired to Electron IPC handlers in Epic 11. Since Electron is not yet installed, the service uses callback-based event emission rather than IPC directly.

**Connection flow:**
```
User double-clicks server -> connectServer command
  -> ConnectionLifecycleManager.connect(serverName)
    -> ConnectionManager.getServer(serverName)  // get config
    -> ConnectionManager.getDecryptedPassword(serverName)  // get password
    -> AtelierApiService.testConnection(spec, username, password, signal)
    -> Callback: { status: 'connecting' | 'connected' | 'error', serverName, message? }
```

**State machine:**
```
idle -> connecting -> connected -> disconnected -> connecting -> ...
                  -> error -> disconnected -> ...
                  -> cancelled -> disconnected -> ...
```

### Important Design Decisions

1. **ConnectionLifecycleManager as separate class**: Rather than adding lifecycle logic to ConnectionManager (which is CRUD-focused), a new class handles the stateful connection lifecycle. This follows single responsibility and makes testing easier.

2. **Callback-based events**: Uses a simple callback function for event emission rather than EventEmitter or observable patterns. This keeps it lightweight and easy to wire to Electron IPC in Epic 11.

3. **AbortController for cancellation**: Reuses the pattern from Story 1.7 -- internal AbortController for timeout, passed as `externalSignal` to `AtelierApiService.testConnection()`. `cancelConnection()` aborts the controller.

4. **Server switching**: MVP allows only one active connection. When connecting to server B while server A is connected, automatically disconnect A first. No unsaved-changes prompt yet (that requires table tab awareness from Epic 11).

5. **testConnection for connect**: Uses `AtelierApiService.testConnection()` as the "connect" mechanism. This validates credentials and server reachability. Actual data queries (namespaces, tables) are separate operations that will use the same `AtelierApiService` instance.

6. **Error message reuse**: The `TEST_CONNECTION_ERROR_MESSAGES` map from Story 12.3 is reused for connection error mapping to keep user-facing messages consistent.

### Previous Story Intelligence (12.4)

**Story 12.4 established:**
- `ICredentialStore` abstraction with `encrypt()`, `decrypt()`, `isAvailable()`
- `NodeCryptoCredentialStore` using AES-256-GCM
- `ConnectionManager.getDecryptedPassword(serverName)` -- convenience method for connection flow
- `ConnectionManager.getServer(name)` -- returns decrypted password if credential store available
- 425 total tests (184 desktop + 241 vscode)

**ConnectionManager current state (Stories 12.1-12.4):**
- `ServerConfig`: name, hostname, port, namespace?, username, description?, ssl, encryptedPassword, pathPrefix?
- `getServer(name)` -> ServerConfig with decrypted password
- `getDecryptedPassword(serverName)` -> string
- `testConnection(config: TestConnectionConfig)` -> TestConnectionResult
- `TEST_CONNECTION_ERROR_MESSAGES` map: SERVER_UNREACHABLE, AUTH_FAILED, CONNECTION_TIMEOUT, CONNECTION_FAILED, CONNECTION_CANCELLED

**AtelierApiService (`@iris-te/core`):**
- `testConnection(spec, username, password, externalSignal?)` -> `{ success, error? }`
- `IServerSpec`: `{ name, scheme, host, port, pathPrefix, username? }`
- `setTimeout(ms)` for timeout configuration
- Error codes: `ErrorCodes.AUTH_FAILED`, `ErrorCodes.CONNECTION_TIMEOUT`, etc.

**Server list UI (Story 12.1):**
- `state.connectedServer` already tracked
- `connectionStatus` event handler already wired
- Context menu has "Connect" action already sending `connectServer` command
- Double-click sends `connectServer` command

**Existing desktop message types:**
- `DesktopConnectionCommand` includes `connectServer`, `testConnection`
- `DesktopConnectionEvent` includes `connectionStatus`, `error`
- `IConnectionStatusPayload`: `{ connected: boolean; serverName: string | null; }`
- `IConnectionProgressPayload` (VS Code, Story 1.7): `{ status, serverName, message? }`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Electron Architecture]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.5: Connection Lifecycle]
- [Source: 12-4-credential-storage.md -- Previous story implementation]
- [Source: packages/desktop/src/main/ConnectionManager.ts -- Current implementation]
- [Source: packages/core/src/models/IMessages.ts -- Message types]

## Dev Agent Record

### Completion Notes

**ConnectionLifecycleManager** (`packages/desktop/src/main/ConnectionLifecycleManager.ts`):
- State machine: `idle -> connecting -> connected/error/cancelled(disconnected)` with full cycle support
- Constructor takes `ConnectionManager` (CRUD layer) and `ConnectionLifecycleCallback` function
- `connect(serverName)`: retrieves config + decrypted password, builds IServerSpec, creates AtelierApiService with 10s timeout, passes AbortController signal for cancellation, maps error codes to user-friendly messages via `CONNECTION_ERROR_MESSAGES` (same pattern as `TEST_CONNECTION_ERROR_MESSAGES` from Story 12.3)
- `disconnect()`: clears state, emits `disconnected` event
- `cancelConnection()`: aborts AbortController, emits `cancelled`, no-op if not connecting
- Edge cases: connect-to-same-server is no-op, connect-while-connecting cancels previous, server-not-found and missing-password emit error without API call
- Race condition guard: checks state after await to prevent stale callbacks

**Message types** (`packages/core/src/models/IMessages.ts`):
- Added `IDesktopConnectionProgressPayload` with status union: `'connecting' | 'connected' | 'disconnected' | 'cancelled' | 'error'`
- Added `disconnectServer` and `cancelConnection` commands to `DesktopConnectionCommand`
- Added `connectionProgress` event to `DesktopConnectionEvent`
- Exported `IDesktopConnectionProgressPayload` from `@iris-te/core` index

**Server list UI** (`packages/desktop/src/ui/connection/server-list.js`):
- Added `connectingServer`, `connectionError`, `connectionErrorServer` to state
- Added `connectionProgress` event handler with full status switch (connecting/connected/disconnected/cancelled/error)
- Updated `renderServerList()` to show connecting spinner, "Connecting..." text, Cancel button, inline error with Retry/Edit buttons
- Added `cancelConnection` and `retryConnection` action handling in click delegation
- Added `disconnect` action to context menu handler
- Context menu toggles Connect/Disconnect visibility based on connection state

**Server list HTML** (`packages/desktop/src/ui/connection/server-list.html`):
- Added hidden Disconnect button to context menu

**Server list CSS** (`packages/desktop/src/ui/connection/server-list.css`):
- `.ite-server-list__status--connecting` with pulse animation
- `.ite-server-list__progress` for inline connecting text
- `.ite-server-list__cancel-btn` for cancel button during connection
- `.ite-server-list__inline-error` and `.ite-server-list__inline-error-actions` for error display with Retry/Edit

**Exports** (`packages/desktop/src/index.ts`):
- Exported `ConnectionLifecycleManager` class and `ConnectionState`/`ConnectionLifecycleCallback` types

### Test Results

- **VS Code tests**: 241 passing
- **Desktop tests**: 239 passing (56 suites) -- 55 new tests added
- **Total**: 480 tests, 0 failures, 0 skipped
- All state transitions covered: idle->connecting->connected->disconnected, idle->connecting->error, idle->error (not found), error->connecting->connected (retry)
- No `vscode` imports in packages/desktop

### Files Modified

- `packages/core/src/models/IMessages.ts` -- Added IDesktopConnectionProgressPayload, disconnectServer/cancelConnection commands, connectionProgress event
- `packages/core/src/index.ts` -- Exported IDesktopConnectionProgressPayload
- `packages/desktop/src/index.ts` -- Exported ConnectionLifecycleManager, ConnectionState, ConnectionLifecycleCallback
- `packages/desktop/src/ui/connection/server-list.js` -- Added connectionProgress handler, connecting state rendering, cancel/disconnect/retry actions
- `packages/desktop/src/ui/connection/server-list.css` -- Added connecting, progress, cancel, inline error styles
- `packages/desktop/src/ui/connection/server-list.html` -- Added Disconnect context menu item

### Files Created

- `packages/desktop/src/main/ConnectionLifecycleManager.ts` -- Connection lifecycle state machine service
- `packages/desktop/src/test/connectionLifecycle.test.ts` -- 55 unit tests covering all acceptance criteria
