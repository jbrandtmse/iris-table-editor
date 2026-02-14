# Story 11.2: IPC Bridge

Status: review

## Story

As a **developer**,
I want **a typed IPC bridge with session management connecting the Electron main process to the shared webview**,
so that **the webview can send commands for server browsing and data operations identically to the VS Code target**.

## Acceptance Criteria

1. **Given** a user is connected to an IRIS server, **When** the webview sends `getNamespaces`, **Then** the main process queries the server via TableMetadataService **And** returns the namespace list via `namespaceList` event

2. **Given** a user selects a namespace, **When** the webview sends `getTables` with a namespace, **Then** the main process queries the server via TableMetadataService **And** returns the table list via `tableList` event

3. **Given** a user opens a table, **When** the webview sends `requestData`, **Then** the main process queries the server via QueryExecutor **And** returns the data via `tableData` event

4. **Given** all IPC channels are defined, **When** I inspect the preload script, **Then** only declared command names are accepted **And** only declared event names can be subscribed to

5. **Given** the connection succeeds, **When** the `connectionProgress: connected` event fires, **Then** a SessionManager retains the active AtelierApiService, QueryExecutor, and TableMetadataService **And** credentials are held in memory only

6. **Given** the user disconnects, **When** the `disconnected` event fires, **Then** the SessionManager clears all service instances **And** credentials are purged from memory

7. **Given** the user sends a data command without an active connection, **When** the main process receives the command, **Then** an error event is sent back: "Not connected to a server"

## Tasks / Subtasks

- [x] Task 1: Create SessionManager service (AC: 5, 6, 7)
  - [x] 1.1: Create `packages/desktop/src/main/SessionManager.ts`
  - [x] 1.2: `SessionManager` holds active session state:
    - `serverName: string | null` — connected server name
    - `serverSpec: IServerSpec | null` — connection spec
    - `username: string | null` — cached username
    - `password: string | null` — cached password (in-memory only)
    - `apiService: AtelierApiService | null` — HTTP transport
    - `queryExecutor: QueryExecutor | null` — SQL CRUD
    - `metadataService: TableMetadataService | null` — namespace/table metadata
  - [x] 1.3: `startSession(serverName, serverSpec, username, password): void` — creates AtelierApiService (with 30s timeout), QueryExecutor, TableMetadataService; stores credentials
  - [x] 1.4: `endSession(): void` — clears all fields, nulls out service references and credentials
  - [x] 1.5: `isActive(): boolean` — returns true if session has all required fields
  - [x] 1.6: Getters: `getServerName()`, `getServerSpec()`, `getQueryExecutor()`, `getMetadataService()`, `getUsername()`, `getPassword()`
  - [x] 1.7: No credential persistence — password exists only in memory during active session

- [x] Task 2: Wire SessionManager to connection lifecycle (AC: 5, 6)
  - [x] 2.1: In `main.ts`, instantiate `SessionManager`
  - [x] 2.2: In the ConnectionLifecycleManager callback (when status is `connected`): call `sessionManager.startSession()` with server config + decrypted password
  - [x] 2.3: In the callback (when status is `disconnected`, `cancelled`, or `error`): call `sessionManager.endSession()`
  - [x] 2.4: Pass `SessionManager` to `registerIpcHandlers()`

- [x] Task 3: Add data command routing to IPC (AC: 1, 2, 3, 7)
  - [x] 3.1: Extend `routeCommand()` in `ipc.ts` with new commands:
    - `getNamespaces` → `sessionManager.getMetadataService().getNamespaces()` → send `namespaceList` event
    - `getTables` → `sessionManager.getMetadataService().getTables()` → send `tableList` event
    - `selectTable` → `sessionManager.getMetadataService().getTableSchema()` → send `tableSchema` event
    - `requestData` → `sessionManager.getQueryExecutor().getTableData()` → send `tableData` event
    - `saveCell` → `sessionManager.getQueryExecutor().updateRow()` → send `saveCellResult` event
    - `insertRow` → `sessionManager.getQueryExecutor().insertRow()` → send `insertRowResult` event
    - `deleteRow` → `sessionManager.getQueryExecutor().deleteRow()` → send `deleteRowResult` event
    - `refresh` → same as `requestData` (re-query current data)
    - `paginateNext` / `paginatePrev` → `requestData` with offset calculation
  - [x] 3.2: Each data command checks `sessionManager.isActive()` first — sends error if not connected
  - [x] 3.3: Extract `requireSession()` helper that returns session or sends error event
  - [x] 3.4: Track current table context (namespace + tableName + schema) in SessionManager for paginate/refresh
  - [x] 3.5: Import necessary types from `@iris-te/core` for payloads

- [x] Task 4: Add channel validation to preload (AC: 4)
  - [x] 4.1: Define `ALLOWED_COMMANDS` set in channelValidation.ts with all valid command names
  - [x] 4.2: In `sendCommand()`, validate command name against allowlist before sending
  - [x] 4.3: Define `ALLOWED_EVENTS` set with all valid event names
  - [x] 4.4: In `onEvent()`, validate event name against allowlist before subscribing
  - [x] 4.5: Log warning and reject for invalid command/event names

- [x] Task 5: Update SessionManager with table context (AC: 3)
  - [x] 5.1: Add `currentNamespace: string | null` to SessionManager
  - [x] 5.2: Add `currentTableName: string | null` and `currentSchema: ITableSchema | null`
  - [x] 5.3: `setNamespace(namespace: string): void`
  - [x] 5.4: `setTable(tableName: string, schema: ITableSchema): void`
  - [x] 5.5: `clearTable(): void` — clear current table (but keep namespace)
  - [x] 5.6: Getters for currentNamespace, currentTableName, currentSchema

- [x] Task 6: Export SessionManager (AC: all)
  - [x] 6.1: Export `SessionManager` from `packages/desktop/src/index.ts`

- [x] Task 7: Write tests (AC: all)
  - [x] 7.1: Unit tests for `SessionManager`: startSession, endSession, isActive, getters, credential clearing
  - [x] 7.2: Unit tests for `SessionManager` table context: setNamespace, setTable, clearTable
  - [x] 7.3: Unit tests for data command routing: getNamespaces, getTables, requestData, saveCell, insertRow, deleteRow
  - [x] 7.4: Unit tests for session guard: data commands without active session return error
  - [x] 7.5: Unit tests for channel validation in preload (test the validation function, not contextBridge)
  - [x] 7.6: Tests in `packages/desktop/src/test/`

- [x] Task 8: Validate (AC: all)
  - [x] 8.1: Run `npm run compile` — all packages compile
  - [x] 8.2: Run `npm run lint` — no new lint errors
  - [x] 8.3: Run `npm run test` — all tests pass
  - [x] 8.4: Verify packages/desktop has no `vscode` imports

## Dev Notes

### Architecture Context

Story 11.1 built the Electron shell with IPC routing for all 10 desktop connection commands. Story 11.2 extends this with:
1. **SessionManager** — maintains active connection context (services, credentials, table state)
2. **Data command routing** — namespace browsing, table data operations
3. **Channel validation** — defense-in-depth for the preload bridge

**Session lifecycle:**
```
ConnectionLifecycleManager callback(status: 'connected')
  → SessionManager.startSession(serverName, spec, username, password)
    → Creates AtelierApiService (30s timeout), QueryExecutor, TableMetadataService
  → Data commands now work (getNamespaces, getTables, requestData, etc.)

ConnectionLifecycleManager callback(status: 'disconnected'|'cancelled'|'error')
  → SessionManager.endSession()
    → Clears all services, nulls credentials
  → Data commands return "Not connected" error
```

### Important Design Decisions

1. **SessionManager as separate class**: Holds the active connection context (AtelierApiService, QueryExecutor, TableMetadataService, credentials). This separates connection state from ConnectionLifecycleManager (which manages the lifecycle state machine) and from ConnectionManager (which manages CRUD).

2. **In-memory credentials only**: Password stored in SessionManager only during active session. `endSession()` nulls it out. Never persisted beyond memory.

3. **30-second API timeout**: Data operations use 30s timeout (matching the VS Code extension's `iris-table-editor.apiTimeout` default), not 10s like the connection test.

4. **Channel validation in preload**: Defense-in-depth — even though contextIsolation prevents renderer access to ipcRenderer, the preload validates command/event names against an allowlist. This prevents accidental typos from silently failing and limits the attack surface if the renderer is somehow compromised.

5. **Table context in SessionManager**: The SessionManager tracks `currentNamespace`, `currentTableName`, `currentSchema` so that paginate/refresh commands don't need to re-specify everything. This mirrors how the VS Code extension tracks active table context.

### Service Method Signatures

**TableMetadataService:**
```typescript
getNamespaces(spec, username, password) → { success, namespaces?, error? }
getTables(spec, namespace, username, password) → { success, tables?, error? }
getTableSchema(spec, namespace, tableName, username, password) → { success, schema?, error? }
```

**QueryExecutor:**
```typescript
getTableData(spec, namespace, tableName, schema, pageSize, offset, username, password, filters?, sortColumn?, sortDirection?)
  → { success, rows?, totalRows?, error? }
updateRow(spec, namespace, tableName, columnName, newValue, pkColumn, pkValue, username, password)
  → { success, error? }
insertRow(spec, namespace, tableName, columns, values, username, password)
  → { success, error? }
deleteRow(spec, namespace, tableName, pkColumn, pkValue, username, password)
  → { success, error? }
```

### Previous Story Intelligence (11.1)

**Story 11.1 established:**
- `ipc.ts` with `routeCommand()` handling all 10 DesktopConnectionCommand variants
- `sendEvent()` helper with destroyed-window guard
- `sendError()` helper for error events
- `toServerInfo()` converter
- `registerIpcHandlers()` with duplicate listener prevention
- `main.ts` with BrowserWindow, service instantiation, CSS injection
- `preload.ts` with `window.iteMessageBridge` via contextBridge
- 511 total tests (241 vscode + 270 desktop)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#IPC Bridge]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.2: IPC Bridge]
- [Source: 11-1-electron-bootstrap.md — Previous story]
- [Source: packages/core/src/services/QueryExecutor.ts]
- [Source: packages/core/src/services/TableMetadataService.ts]
- [Source: packages/desktop/src/main/ipc.ts — Current IPC routing]

## Dev Agent Record

### Completion Notes

**SessionManager** (`SessionManager.ts`): A new service class that manages active connection session state. Holds server spec, credentials (in-memory only), and three service instances (AtelierApiService, QueryExecutor, TableMetadataService). Also tracks table context (current namespace, table name, schema) for paginate/refresh commands. `startSession()` creates all service instances with 30s API timeout; `endSession()` nulls all references including password.

**Data Command Routing** (`ipc.ts`): Extended `routeCommand()` with 10 new data command cases: `getNamespaces`, `getTables`, `selectTable`, `requestData`, `refresh`, `paginateNext`, `paginatePrev`, `saveCell`, `insertRow`, `deleteRow`. Added `requireSession()` helper that checks `sessionManager.isActive()` and sends "Not connected to a server" error if inactive. The `sessionManager` parameter is optional on `routeCommand()` and `registerIpcHandlers()` to maintain backward compatibility with existing tests.

**Channel Validation** (`channelValidation.ts`): Extracted ALLOWED_COMMANDS (20 commands) and ALLOWED_EVENTS (19 events) into a separate module from preload.ts for testability without Electron runtime. The preload script imports `isValidCommand()` and `isValidEvent()` functions and rejects invalid commands/events with a console warning.

**Lifecycle Wiring** (`main.ts`): SessionManager is instantiated at startup. The ConnectionLifecycleManager callback now starts a session on `connected` status (building IServerSpec from ServerConfig) and ends it on `disconnected`, `cancelled`, or `error` status. SessionManager is passed through to `registerIpcHandlers()`.

**Key design decision**: Channel validation was extracted into `channelValidation.ts` (separate from `preload.ts`) because preload.ts imports from `electron` and calls `contextBridge.exposeInMainWorld()` at module level, making it impossible to import in Node.js test environment. The validation functions are pure logic with no Electron dependencies.

### Test Results

- **VS Code tests**: 241 passing
- **Desktop tests**: 348 passing (was 270, added 78 new)
- **Total**: 589 tests, 0 failures
- **New test files**:
  - `sessionManager.test.ts`: 24 tests (session lifecycle, credential clearing, table context)
  - `ipcDataCommands.test.ts`: 37 tests (data command routing, session guard, requireSession helper)
  - `channelValidation.test.ts`: 17 tests (ALLOWED_COMMANDS, ALLOWED_EVENTS, isValidCommand, isValidEvent)

### Files Modified

- `packages/desktop/src/main/ipc.ts` — Added SessionManager parameter, 10 data command cases, requireSession helper
- `packages/desktop/src/main/main.ts` — SessionManager instantiation, lifecycle callback wiring, passed to createWindow/registerIpcHandlers
- `packages/desktop/src/main/preload.ts` — Imports isValidCommand/isValidEvent from channelValidation, validates in sendCommand/onEvent
- `packages/desktop/src/index.ts` — Added SessionManager export
- `_bmad-output/implementation-artifacts/11-2-ipc-bridge.md` — Story status and Dev Agent Record

### Files Created

- `packages/desktop/src/main/SessionManager.ts` — Active session state manager
- `packages/desktop/src/main/channelValidation.ts` — Channel allowlists and validation functions
- `packages/desktop/src/test/sessionManager.test.ts` — SessionManager unit tests
- `packages/desktop/src/test/ipcDataCommands.test.ts` — IPC data command routing tests
- `packages/desktop/src/test/channelValidation.test.ts` — Channel validation tests
