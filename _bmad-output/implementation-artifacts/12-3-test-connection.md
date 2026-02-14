# Story 12.3: Test Connection

Status: review

## Story

As a **user**,
I want **to test a server connection before saving it**,
so that **I can verify my settings are correct**.

## Acceptance Criteria

1. **Given** the server form is open with all required fields filled, **When** I click "Test Connection", **Then** the button shows a spinner and "Testing..." text **And** the button is disabled during the test

2. **Given** the test connection succeeds, **When** the result returns, **Then** I see a green "Connection successful" message **And** the message appears near the Test Connection button **And** the button returns to normal state

3. **Given** the test connection fails (wrong host, wrong credentials, timeout), **When** the result returns, **Then** I see a red error message explaining the failure:
   - "Could not reach host" (network error)
   - "Authentication failed" (wrong credentials)
   - "Connection timed out" (timeout)
   **And** the button returns to normal state

4. **Given** the test connection is in progress, **When** the connection attempt takes more than 10 seconds, **Then** the test times out **And** I see "Connection timed out. Check host and port."

5. **Given** I test with empty required fields, **When** I click "Test Connection", **Then** form validation runs first **And** if fields are missing, validation errors show instead of testing

## Tasks / Subtasks

- [x] Task 1: Add test connection method to ConnectionManager (AC: 2, 3, 4)
  - [x] 1.1: Add `testConnection(config)` method to `ConnectionManager` that takes `{ hostname, port, pathPrefix?, ssl, username, password }`
  - [x] 1.2: Method creates an `IServerSpec` from the config, instantiates `AtelierApiService`, sets 10s timeout, calls `testConnection()`
  - [x] 1.3: Return `{ success: boolean, message: string }` — map AtelierApiService error codes to user-friendly messages:
    - `SERVER_UNREACHABLE` → "Could not reach server. Check host and port."
    - `AUTH_FAILED` → "Authentication failed. Check username and password."
    - `CONNECTION_TIMEOUT` → "Connection timed out. Check host and port."
    - Success → "Connection successful!"
  - [x] 1.4: Export any new types from `@iris-te/core` if needed

- [x] Task 2: Add test connection UI to server form (AC: 1, 2, 3, 4, 5)
  - [x] 2.1: Add "Test Connection" button to `server-form.html` — placed between form fields and Save/Cancel buttons
  - [x] 2.2: Add test result display area (`.ite-form__test-result`) below the Test Connection button
  - [x] 2.3: Add CSS for test button, spinner (CSS-only animation), success (green) and error (red) result states in `server-form.css`
  - [x] 2.4: Add BEM classes: `.ite-form__test-btn`, `.ite-form__test-btn--testing`, `.ite-form__test-result`, `.ite-form__test-result--success`, `.ite-form__test-result--error`

- [x] Task 3: Add test connection JS behavior (AC: 1, 2, 3, 4, 5)
  - [x] 3.1: In `server-form.js`, add `handleTestConnection()` function
  - [x] 3.2: Validate form first (AC: 5) — reuse existing `validateForm()`. Password IS required for test (even in edit mode)
  - [x] 3.3: Disable test button, show "Testing..." text with CSS spinner (AC: 1)
  - [x] 3.4: Collect form data and send `testFormConnection` command via IMessageBridge
  - [x] 3.5: Listen for `testConnectionResult` event — show success (green) or error (red) message (AC: 2, 3)
  - [x] 3.6: Clear previous test result when form fields change
  - [x] 3.7: Reset button state after result received (AC: 2, 3)
  - [x] 3.8: Announce result to screen readers via `announce()`

- [x] Task 4: Add message types (AC: all)
  - [x] 4.1: Add `IDesktopTestConnectionPayload` interface: `{ hostname, port, pathPrefix?, ssl, username, password }`
  - [x] 4.2: Add `IDesktopTestConnectionResultPayload` interface: `{ success, message }`
  - [x] 4.3: Extend `DesktopConnectionCommand` with `testFormConnection` command
  - [x] 4.4: Extend `DesktopConnectionEvent` with `testConnectionResult` event
  - [x] 4.5: Export new types from `@iris-te/core`

- [x] Task 5: Write tests (AC: all)
  - [x] 5.1: Unit tests for `ConnectionManager.testConnection()` — mock AtelierApiService, verify timeout, error mapping
  - [x] 5.2: Unit tests for form test connection UI logic — validation gate, button state, result display
  - [x] 5.3: Tests in `packages/desktop/src/test/`

- [x] Task 6: Validate (AC: all)
  - [x] 6.1: Run `npm run compile` — all packages compile
  - [x] 6.2: Run `npm run lint` — no new lint errors
  - [x] 6.3: Run `npm run test` — all tests pass
  - [x] 6.4: Verify packages/desktop has no `vscode` imports

## Dev Notes

### Architecture Context

The test connection feature spans two layers:
1. **ConnectionManager service** (`packages/desktop/src/main/ConnectionManager.ts`): New `testConnection()` method that orchestrates the actual connection test using `AtelierApiService` from `@iris-te/core`.
2. **Server form UI** (`packages/desktop/src/ui/connection/server-form.js`): "Test Connection" button that sends form data to host via IMessageBridge and displays results.

The `AtelierApiService.testConnection()` method already exists in `@iris-te/core` and handles:
- HTTP GET to root Atelier endpoint (`/api/atelier/`)
- 401 → `AUTH_FAILED` error code
- Timeout via AbortController → `CONNECTION_TIMEOUT` error code
- Network errors → `SERVER_UNREACHABLE` error code
- Success → `{ success: true }`

### Important Design Decisions

1. **Form testing vs saved server testing**: The existing `testConnection` command in `DesktopConnectionCommand` takes `IDesktopServerNamePayload` (server name only) for testing already-saved servers from the context menu. Story 12.3 adds `testFormConnection` which takes full connection details from the form — the server may not be saved yet.

2. **Password required for test**: Even in edit mode (where password is optional for save), the password is required for test connection since we need actual credentials to authenticate.

3. **10-second timeout**: Set `AtelierApiService.setTimeout(10000)` before calling `testConnection()`. This matches the AC and the existing `iris-table-editor.connectionTimeout` default.

4. **ConnectionManager.testConnection()**: Creates a temporary `AtelierApiService` instance, builds `IServerSpec` from the provided config, and delegates to `AtelierApiService.testConnection()`. The method maps error codes to user-friendly messages.

5. **No Electron dependency**: Same as previous stories — pure Node.js + plain HTML/CSS/JS. The `testFormConnection` command will be handled by the Electron IPC bridge in Epic 11, calling `ConnectionManager.testConnection()`.

### Previous Story Intelligence (12.2)

**Story 12.2 established:**
- Server form at `packages/desktop/src/ui/connection/server-form.{html,css,js}`
- `window.iteServerForm` API with `openAddForm()`, `openEditForm()`, `closeForm()`
- Form validation via `validateForm()` with inline error display
- `formState` object tracking `isOpen`, `mode`, `originalName`, `isSaving`
- Save button shows "Saving..." while in progress
- IMessageBridge pattern: `sendCommand()` for outgoing, `messageBridge.onEvent()` for incoming
- Focus trap for modal dialog
- IIFE pattern, `escapeHtml()`/`escapeAttr()`, `announce()` for screen readers
- 46 tests for form logic in `packages/desktop/src/test/serverForm.test.ts`
- All message types in `@iris-te/core` IMessages.ts
- 328 total tests (241 vscode + 87 desktop)

**AtelierApiService (`@iris-te/core`):**
- `testConnection(spec, username, password, externalSignal?)` → `{ success, error? }`
- `IServerSpec`: `{ name, scheme, host, port, pathPrefix, username? }`
- Error codes: `ErrorCodes.AUTH_FAILED`, `ErrorCodes.CONNECTION_TIMEOUT`, `ErrorCodes.SERVER_UNREACHABLE`, `ErrorCodes.CONNECTION_FAILED`
- `setTimeout(ms)` to configure timeout
- `buildAuthHeaders(username, password)` for Basic Auth

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Electron Architecture]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 12.3: Test Connection]
- [Source: 12-2-server-form.md — Previous story implementation]
- [Source: packages/core/src/services/AtelierApiService.ts — testConnection method]

## Dev Agent Record

### Completion Notes

All 6 tasks implemented successfully. The test connection feature spans 3 layers:

1. **Message types** (`@iris-te/core`): Added `IDesktopTestConnectionPayload` and `IDesktopTestConnectionResultPayload` interfaces, extended `DesktopConnectionCommand` with `testFormConnection` and `DesktopConnectionEvent` with `testConnectionResult`, exported from core index.

2. **ConnectionManager service**: Added `testConnection(config)` method with `TestConnectionConfig` and `TestConnectionResult` types. Creates temporary `AtelierApiService` with 10s timeout, builds `IServerSpec` from config, delegates to `AtelierApiService.testConnection()`, and maps error codes (`SERVER_UNREACHABLE`, `AUTH_FAILED`, `CONNECTION_TIMEOUT`, `CONNECTION_FAILED`, `CONNECTION_CANCELLED`) to user-friendly messages.

3. **Server form UI**: Added "Test Connection" button between form fields and Save/Cancel. CSS-only spinner animation using `@keyframes ite-spin` with `border-top-color: transparent` technique. Success results shown in green (`--ite-success-fg`), errors in red (`--ite-error-fg`). Separate `validateFormForTest()` that always requires password (even in edit mode). Results cleared on form field input changes. Screen reader announcements via `announce()`. Test state tracked via `formState.isTesting` with proper reset on open/close/result.

### Test Results

- 241 VS Code extension tests passing
- 132 desktop tests passing (45 new test connection tests added)
- 0 failures
- No lint errors
- No `vscode` imports in desktop package

### Files Modified

- `packages/core/src/models/IMessages.ts` — Added `IDesktopTestConnectionPayload`, `IDesktopTestConnectionResultPayload`, extended union types
- `packages/core/src/index.ts` — Exported new message types
- `packages/desktop/src/main/ConnectionManager.ts` — Added `TestConnectionConfig`, `TestConnectionResult`, `testConnection()` method, error message map
- `packages/desktop/src/ui/connection/server-form.html` — Added Test Connection button and result display area
- `packages/desktop/src/ui/connection/server-form.css` — Added test section styles, spinner animation, success/error result states
- `packages/desktop/src/ui/connection/server-form.js` — Added `handleTestConnection()`, `validateFormForTest()`, `showTestResult()`, `clearTestResult()`, `resetTestButton()`, event handlers, form state management

### Files Created

- `packages/desktop/src/test/testConnection.test.ts` — 45 tests covering ConnectionManager.testConnection() error mapping, form validation for test, UI state, data collection, result payloads, and display logic
