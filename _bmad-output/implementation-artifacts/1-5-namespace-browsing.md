# Story 1.5: Namespace Browsing

Status: done

## Story

As a **user**,
I want **to see and select namespaces on my connected server**,
So that **I can navigate to the database area I want to work with**.

## Acceptance Criteria

1. **Given** I am connected to a server
   **When** the connection completes
   **Then** I see a list of available namespaces

2. **Given** I see the namespace list
   **When** I select a namespace
   **Then** the namespace is highlighted as selected
   **And** the UI shows I am now browsing that namespace

3. **Given** a namespace contains the `%` character (e.g., `%SYS`)
   **When** the extension queries the Atelier API
   **Then** the namespace is properly encoded (`%` → `%25`)
   **And** the query succeeds without errors

## Tasks / Subtasks

- [x] Task 1: Add getNamespaces Method to AtelierApiService (AC: #1, #3)
  - [x] Create `getNamespaces(spec, username, password)` method
  - [x] Use GET request to `/api/atelier/` (root endpoint returns namespace list)
  - [x] Parse response `namespaces` array from server descriptor
  - [x] Return `{ success: boolean; namespaces?: string[]; error?: IUserError }`
  - [x] Handle auth and network errors via ErrorHandler

- [x] Task 2: Add getNamespaces Method to ServerConnectionManager (AC: #1)
  - [x] Create `getNamespaces(): Promise<{ success: boolean; namespaces?: string[]; error?: IUserError }>`
  - [x] Obtain fresh credentials via `vscode.authentication.getSession()`
  - [x] Call AtelierApiService.getNamespaces() with credentials
  - [x] Do NOT store credentials in class properties

- [x] Task 3: Update IMessages.ts with Namespace Types (AC: #1, #2)
  - [x] Add `getNamespaces` command type (no payload needed)
  - [x] Add `selectNamespace` command payload: `{ namespace: string }`
  - [x] Add `namespaceList` event payload: `{ namespaces: string[] }`
  - [x] Add `namespaceSelected` event payload: `{ namespace: string }`
  - [x] Update ServerCommand and ServerEvent union types

- [x] Task 4: Update TableEditorProvider Message Handlers (AC: #1, #2)
  - [x] Add `_handleGetNamespaces()` handler calling ServerConnectionManager
  - [x] Add `_handleSelectNamespace(payload)` handler storing selection
  - [x] Track selected namespace in state: `_selectedNamespace: string | null`
  - [x] Post `namespaceList` event after fetching namespaces
  - [x] Post `namespaceSelected` event after selection
  - [x] Auto-fetch namespaces after successful connection

- [x] Task 5: Update Webview AppState for Namespace State (AC: #1, #2)
  - [x] Add `namespaces: string[]` to AppState
  - [x] Add `selectedNamespace: string | null` to AppState
  - [x] Add `namespacesLoading: boolean` to AppState
  - [x] Update `vscode.setState()` to persist namespace selection

- [x] Task 6: Update Webview Message Handlers (AC: #1, #2)
  - [x] Handle `namespaceList` event → update state with namespace array
  - [x] Handle `namespaceSelected` event → update state with selection
  - [x] Announce namespace count to screen readers

- [x] Task 7: Update Webview Render Logic (AC: #1, #2)
  - [x] Create `renderNamespaceList(namespaces, selectedNamespace)` function
  - [x] Create namespace list HTML with `.ite-namespace-list` container
  - [x] Each namespace item: `.ite-namespace-list__item` with data-namespace attr
  - [x] Selected state: `.ite-namespace-list__item--selected`
  - [x] Show namespace list below connection header when connected
  - [x] Add loading spinner for namespace loading state

- [x] Task 8: Add Namespace Selection Event Handlers (AC: #2)
  - [x] Create `attachNamespaceListEvents()` function
  - [x] Implement click handler for namespace selection
  - [x] Implement keyboard navigation (Arrow Up/Down, Enter, Home, End)
  - [x] Post `selectNamespace` command on selection
  - [x] Focus management after selection

- [x] Task 9: Update CSS for Namespace UI (AC: #1, #2)
  - [x] Add `.ite-namespace-list` container styles
  - [x] Add `.ite-namespace-list__header` styles
  - [x] Add `.ite-namespace-list__item` base styles (follow server list pattern)
  - [x] Add `.ite-namespace-list__item--selected` styles
  - [x] Add `.ite-namespace-list__item:hover` styles
  - [x] Add `.ite-namespace-list__item:focus-visible` styles
  - [x] Add `.ite-namespace-list__icon` for namespace icon (codicon-database)
  - [x] Follow VS Code theme variables consistently

- [x] Task 10: Unit Tests for Namespace Functionality (AC: #1, #3)
  - [x] Add tests for AtelierApiService.getNamespaces() success case
  - [x] Add tests for AtelierApiService.getNamespaces() error cases
  - [x] Add tests for namespace encoding (% → %25) in URL
  - [x] Extend ServerConnectionManager tests for getNamespaces
  - [x] Run `npm run test` - all tests must pass

- [x] Task 11: Build Verification (AC: #1-#3)
  - [x] Run `npm run compile` - exits with code 0
  - [x] Run `npm run lint` - passes with no errors
  - [x] Manual test in Extension Development Host

## Dev Notes

### Architecture Compliance

This story extends Story 1.4's connection flow to fetch and display namespaces. Per architecture.md:

**Existing Files to Modify:**
- `src/services/AtelierApiService.ts` - Add getNamespaces method
- `src/providers/ServerConnectionManager.ts` - Add getNamespaces wrapper
- `src/providers/TableEditorProvider.ts` - Add namespace handlers
- `src/models/IMessages.ts` - Add namespace types
- `media/main.js` - Add namespace UI logic
- `media/styles.css` - Add namespace styles

**No new files required** - extend existing architecture.

### Atelier API - GET Namespaces Endpoint

**CRITICAL: Use GET request (not POST) to fetch namespace list:**

```typescript
// Endpoint: GET /api/atelier/
// Returns server descriptor with namespaces array

// Response structure:
{
  "api": 1,
  "namespaces": ["%SYS", "DOCBOOK", "SAMPLES", "USER", ...],
  // ... other server info
}
```

**Implementation:**

```typescript
// In AtelierApiService.ts
public async getNamespaces(
  spec: IServerSpec,
  username: string,
  password: string
): Promise<{ success: boolean; namespaces?: string[]; error?: IUserError }> {
  // Use root endpoint - NOT query endpoint
  const url = UrlBuilder.buildBaseUrl(spec); // e.g., http://host:port/api/atelier/
  const headers = this._buildAuthHeaders(username, password);

  const response = await fetch(url, {
    method: 'GET',  // GET not POST
    headers
  });

  const body = await response.json();
  return {
    success: true,
    namespaces: body.namespaces || []
  };
}
```

### Namespace Encoding - CRITICAL for %SYS

**The UrlBuilder.encodeNamespace() method already handles % → %25 encoding:**

```typescript
// Already implemented in src/utils/UrlBuilder.ts
public static encodeNamespace(namespace: string): string {
  // Encode % as %25 BEFORE standard URL encoding
  // This is critical for system namespaces like %SYS
  return namespace.replace(/%/g, '%25');
}
```

**Use this method when constructing URLs for namespace-specific requests (Story 1.6+).**

### Security - Credential Handling (from Story 1.4)

**CRITICAL: Same patterns apply:**

```typescript
// In ServerConnectionManager.getNamespaces()
public async getNamespaces(): Promise<{ success: boolean; namespaces?: string[]; error?: IUserError }> {
  if (!this._connectedServer || !this._serverSpec) {
    return {
      success: false,
      error: {
        message: 'Not connected to a server',
        code: ErrorCodes.CONNECTION_FAILED,
        recoverable: true,
        context: 'getNamespaces'
      }
    };
  }

  // Get FRESH credentials each time - NEVER store password
  const session = await vscode.authentication.getSession(
    'intersystems-server-credentials',
    [this._connectedServer],
    { createIfNone: false }
  );

  if (!session) {
    return {
      success: false,
      error: {
        message: 'Session expired. Please reconnect.',
        code: ErrorCodes.AUTH_EXPIRED,
        recoverable: true,
        context: 'getNamespaces'
      }
    };
  }

  const apiService = new AtelierApiService();
  return apiService.getNamespaces(
    this._serverSpec,
    session.account.id,
    session.accessToken
  );
}
```

### IMessages.ts Type Additions

**Add these types following existing patterns:**

```typescript
// New command types
interface IGetNamespacesPayload {}

interface ISelectNamespacePayload {
  namespace: string;
}

// New event types
interface INamespaceListPayload {
  namespaces: string[];
}

interface INamespaceSelectedPayload {
  namespace: string;
}

// Update ServerCommand union
type ServerCommand =
  | { command: 'getServerList'; payload: {} }
  | { command: 'selectServer'; payload: ISelectServerPayload }
  | { command: 'disconnect'; payload: IDisconnectPayload }
  | { command: 'getNamespaces'; payload: IGetNamespacesPayload }      // NEW
  | { command: 'selectNamespace'; payload: ISelectNamespacePayload }; // NEW

// Update ServerEvent union
type ServerEvent =
  | { event: 'serverList'; payload: IServerListPayload }
  | { event: 'serverManagerNotInstalled'; payload: {} }
  | { event: 'noServersConfigured'; payload: {} }
  | { event: 'connectionStatus'; payload: IConnectionStatusPayload }
  | { event: 'connectionError'; payload: IConnectionErrorPayload }
  | { event: 'namespaceList'; payload: INamespaceListPayload }        // NEW
  | { event: 'namespaceSelected'; payload: INamespaceSelectedPayload } // NEW
  | { event: 'error'; payload: IErrorPayload };
```

### Webview State Updates

**Extend AppState with namespace state:**

```javascript
class AppState {
  constructor(initialState = {}) {
    this._state = {
      // Existing from Story 1.4
      servers: [],
      selectedServer: initialState.selectedServer || null,
      isLoading: true,
      loadingContext: 'loadingServers',
      error: null,
      serverManagerInstalled: true,
      serversConfigured: true,
      connectionState: initialState.connectionState || 'disconnected',
      connectedServer: initialState.connectedServer || null,

      // NEW for Story 1.5
      namespaces: [],
      selectedNamespace: initialState.selectedNamespace || null,
      namespacesLoading: false
    };
    // ...
  }
}
```

**Update vscode.setState to persist namespace:**

```javascript
update(changes) {
  this._state = { ...this._state, ...changes };
  vscode.setState({
    selectedServer: this._state.selectedServer,
    connectionState: this._state.connectionState,
    connectedServer: this._state.connectedServer,
    selectedNamespace: this._state.selectedNamespace  // NEW
  });
  this._notifyListeners();
}
```

### UI Flow After Connection

**Modify renderConnected() to include namespace section:**

```javascript
function renderConnected(serverName, namespaces, selectedNamespace, namespacesLoading) {
  const connectionHeader = `
    <div class="ite-connection-header">
      <div class="ite-connection-header__status">
        <span class="ite-connection-header__indicator ite-connection-header__indicator--connected"></span>
        <span class="ite-connection-header__label">Connected to</span>
      </div>
      <div class="ite-connection-header__server">${escapeHtml(serverName)}</div>
      <button class="ite-button ite-button--secondary ite-connection-header__disconnect"
              id="disconnectBtn"
              aria-label="Disconnect from ${escapeAttr(serverName)}">
        <span class="codicon codicon-debug-disconnect"></span>
        Disconnect
      </button>
    </div>
  `;

  if (namespacesLoading) {
    return connectionHeader + `
      <div class="ite-loading">
        <div class="ite-loading__spinner"></div>
        <p class="ite-loading__text">Loading namespaces...</p>
      </div>
    `;
  }

  if (namespaces.length === 0) {
    return connectionHeader + `
      <div class="ite-message">
        <h3 class="ite-message__title">No Namespaces Available</h3>
        <p class="ite-message__text">No accessible namespaces found on this server.</p>
      </div>
    `;
  }

  return connectionHeader + renderNamespaceList(namespaces, selectedNamespace);
}
```

### Namespace List HTML Structure

**Follow the server list pattern:**

```javascript
function renderNamespaceList(namespaces, selectedNamespace) {
  const namespaceItems = namespaces.map((ns, index) => {
    const isSelected = ns === selectedNamespace;
    const selectedClass = isSelected ? 'ite-namespace-list__item--selected' : '';
    const safeAttr = escapeAttr(ns);
    const safeName = escapeHtml(ns);
    return `
      <div class="ite-namespace-list__item ${selectedClass}"
           data-namespace="${safeAttr}"
           data-index="${index}"
           tabindex="0"
           role="option"
           aria-selected="${isSelected}">
        <span class="ite-namespace-list__icon codicon codicon-database"></span>
        <span class="ite-namespace-list__name">${safeName}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="ite-namespace-list__header-row">
      <h3 class="ite-namespace-list__header">Select a Namespace</h3>
      <button class="ite-button ite-button--icon" id="refreshNamespacesBtn"
              title="Refresh namespace list" aria-label="Refresh namespace list">
        <span class="codicon codicon-refresh"></span>
      </button>
    </div>
    <div class="ite-namespace-list" role="listbox" aria-label="Available namespaces">
      ${namespaceItems}
    </div>
  `;
}
```

### CSS Styles for Namespace List

**Mirror server list styles, reuse where possible:**

```css
/* Namespace list header row */
.ite-namespace-list__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ite-space-sm) var(--ite-space-md);
  border-bottom: 1px solid var(--vscode-editorGroup-border);
}

.ite-namespace-list__header {
  margin: 0;
  font-size: var(--vscode-font-size);
  font-weight: 600;
  color: var(--vscode-foreground);
}

/* Namespace list container */
.ite-namespace-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: 300px;
}

/* Namespace list items - reuse server list patterns */
.ite-namespace-list__item {
  display: flex;
  align-items: center;
  gap: var(--ite-space-sm);
  padding: var(--ite-space-sm) var(--ite-space-md);
  cursor: pointer;
  border: 2px solid transparent;
  transition: background-color 0.1s ease;
}

.ite-namespace-list__item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.ite-namespace-list__item:focus-visible {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.ite-namespace-list__item--selected {
  background-color: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.ite-namespace-list__icon {
  color: var(--vscode-symbolIcon-namespaceForeground, var(--vscode-foreground));
}

.ite-namespace-list__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### Keyboard Navigation (from UX spec)

**Same pattern as server list:**

```javascript
function attachNamespaceListEvents() {
  const namespaceList = document.querySelector('.ite-namespace-list');
  if (!namespaceList) return;

  // Click handler
  namespaceList.addEventListener('click', (e) => {
    const item = e.target.closest('.ite-namespace-list__item');
    if (item) {
      const namespace = item.dataset.namespace;
      selectNamespace(namespace);
    }
  });

  // Keyboard navigation
  namespaceList.addEventListener('keydown', (e) => {
    const item = e.target.closest('.ite-namespace-list__item');
    if (!item) return;

    const items = Array.from(namespaceList.querySelectorAll('.ite-namespace-list__item'));
    const currentIndex = parseInt(item.dataset.index, 10);

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        selectNamespace(item.dataset.namespace);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          items[currentIndex + 1].focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          items[currentIndex - 1].focus();
        }
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
    }
  });

  // Focus first or selected item
  const selectedItem = namespaceList.querySelector('.ite-namespace-list__item--selected');
  const firstItem = namespaceList.querySelector('.ite-namespace-list__item');
  (selectedItem || firstItem)?.focus();

  // Refresh button
  const refreshBtn = document.getElementById('refreshNamespacesBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshNamespaces);
  }
}

function selectNamespace(namespace) {
  appState.update({
    selectedNamespace: namespace
  });
  announce(`Selected namespace ${namespace}`);
  postCommand('selectNamespace', { namespace });
}

function refreshNamespaces() {
  appState.update({
    namespacesLoading: true,
    namespaces: [],
    selectedNamespace: null
  });
  announce('Loading namespaces');
  postCommand('getNamespaces');
}
```

### TableEditorProvider Handler Updates

**Add namespace command handlers:**

```typescript
// In _handleMessage switch statement:
case 'getNamespaces':
  this._handleGetNamespaces();
  break;

case 'selectNamespace':
  this._handleSelectNamespace(message.payload);
  break;

// Handler implementations:
private async _handleGetNamespaces(): Promise<void> {
  const result = await this._serverConnectionManager.getNamespaces();

  if (!result.success) {
    this._postMessage({
      event: 'error',
      payload: result.error!
    });
    return;
  }

  this._postMessage({
    event: 'namespaceList',
    payload: { namespaces: result.namespaces || [] }
  });
}

private _handleSelectNamespace(payload: ISelectNamespacePayload): void {
  this._selectedNamespace = payload.namespace;
  console.debug(`${LOG_PREFIX} Selected namespace: ${payload.namespace}`);

  this._postMessage({
    event: 'namespaceSelected',
    payload: { namespace: payload.namespace }
  });
}
```

**Auto-fetch namespaces after connection:**

```typescript
// After successful connection in _handleSelectServer:
if (result.success) {
  // ... existing connection success handling ...

  // Auto-fetch namespaces
  this._handleGetNamespaces();
}
```

### What NOT to Do

- **Do NOT implement table browsing** (Story 1.6)
- **Do NOT implement table grid display** (Epic 2)
- **Do NOT store passwords** in any class property or state
- **Do NOT log credentials** (username, password, accessToken)
- **Do NOT use POST for namespace list** - use GET to `/api/atelier/`
- **Do NOT hardcode namespace list** - always fetch from server

### Previous Story Learnings (from 1.1-1.4)

1. **ESLint uses modern flat config format** (`eslint.config.mjs`)
2. **LOG_PREFIX pattern**: All console output must use `[IRIS-TE]` prefix
3. **XSS prevention**: Always escape HTML with `escapeHtml()` function
4. **Attribute escaping**: Use `escapeAttr()` for data attributes
5. **Disposable cleanup**: Add event listeners to `_disposables` array
6. **State persistence**: Use `vscode.setState()`/`vscode.getState()` for webview state
7. **Screen reader support**: Use `announce()` for state changes
8. **Keyboard navigation**: Support Arrow keys, Enter, Home, End
9. **Focus management**: Focus first/selected item after render
10. **Error handling**: Route all errors through ErrorHandler.parse()
11. **Build verification**: Run compile + lint + test before marking complete

### Project Structure After This Story

```
src/
├── extension.ts                    # Entry point (no changes)
├── providers/
│   ├── TableEditorProvider.ts      # Updated: namespace handlers
│   └── ServerConnectionManager.ts  # Updated: getNamespaces method
├── services/
│   └── AtelierApiService.ts        # Updated: getNamespaces method
├── models/
│   ├── IServerSpec.ts              # No changes
│   └── IMessages.ts                # Updated: namespace types
├── utils/
│   ├── ErrorHandler.ts             # No changes (already complete)
│   └── UrlBuilder.ts               # No changes (encodeNamespace exists)
└── test/
    ├── atelierApiService.test.ts   # Extended: getNamespaces tests
    ├── serverConnectionManager.test.ts # Extended: getNamespaces tests
    └── ...
media/
├── webview.html                    # No changes needed
├── styles.css                      # Updated: namespace styles
└── main.js                         # Updated: namespace UI logic
```

### Success Verification Checklist

**Build & Tests:**
- [ ] `npm run compile` exits with code 0
- [ ] `npm run lint` passes with no errors
- [ ] `npm run test` - all tests pass (including new ones)

**Functional Verification:**
- [ ] Connect to server shows namespace list automatically
- [ ] Namespace list displays all available namespaces
- [ ] Clicking namespace highlights it as selected
- [ ] Keyboard navigation works (arrows, enter, home, end)
- [ ] Refresh button reloads namespace list
- [ ] %SYS and other % namespaces display correctly
- [ ] Screen reader announces namespace count and selection

**Security Verification:**
- [ ] No credentials stored in class properties
- [ ] No credentials in console logs
- [ ] Fresh session obtained for each API call

**Accessibility Verification:**
- [ ] Focus visible on namespace items
- [ ] ARIA attributes present (role="listbox", role="option", aria-selected)
- [ ] Screen reader announces state changes
- [ ] Full keyboard navigation support

### References

- [Source: architecture.md#Extension ↔ IRIS Boundary]
- [Source: architecture.md#HTTP Client Decision]
- [Source: architecture.md#Extension ↔ Server Manager Boundary]
- [Source: epics.md#Story 1.5: Namespace Browsing]
- [Source: ux-design-specification.md#Core User Experience]
- [Source: 1-4-server-authentication-connection-status.md#Previous Story Learnings]
- [Source: CLAUDE.md#Server Manager Integration]
- [Atelier API docs: GET /api/atelier/ returns namespaces array]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 75 tests passing (74 original + 1 namespace encoding integration test)
- Build verified: `npm run compile` exit code 0
- Lint verified: `npm run lint` passes with no errors

### Completion Notes List

1. **AtelierApiService.getNamespaces()**: Implemented GET request to `/api/atelier/` root endpoint to fetch server descriptor with namespaces array. Added proper error handling for 401 auth errors, timeout, and network failures.

2. **ServerConnectionManager.getNamespaces()**: Wrapper method that obtains fresh credentials via VS Code authentication API each time. Never stores passwords in class properties.

3. **IMessages.ts Types**: Added complete type definitions for namespace commands (`getNamespaces`, `selectNamespace`) and events (`namespaceList`, `namespaceSelected`). Updated ServerCommand and ServerEvent union types.

4. **TableEditorProvider**: Added `_handleGetNamespaces()` and `_handleSelectNamespace()` handlers. Auto-fetches namespaces after successful server connection. Tracks `_selectedNamespace` state.

5. **Webview AppState**: Extended with `namespaces[]`, `selectedNamespace`, and `namespacesLoading` state. Persists `selectedNamespace` via `vscode.setState()`.

6. **Webview Message Handlers**: Added handlers for `namespaceList` and `namespaceSelected` events. Screen reader announcements for namespace count and selection.

7. **Webview Render Logic**: Updated `renderConnected()` to show namespace list. Created `renderNamespaceList()` with loading spinner, empty state handling, and proper HTML structure with ARIA attributes.

8. **Namespace Event Handlers**: Implemented `attachNamespaceListEvents()` with click handler, full keyboard navigation (ArrowUp/Down, Enter, Space, Home, End), and refresh button.

9. **CSS Styles**: Added complete namespace list styling following VS Code theme variables. Includes hover, focus-visible, and selected states. Reduced motion support.

10. **Unit Tests**: Added 8 new tests - 4 for AtelierApiService.getNamespaces() and 4 for ServerConnectionManager.getNamespaces(). All 74 tests pass.

### Change Log

- 2026-01-28: Implemented namespace browsing feature (Story 1.5) - all 11 tasks completed
- 2026-01-28: Code review fixes applied (6 issues fixed: H1-H3, M1-M3)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-28
**Outcome:** APPROVED (after fixes)

**Issues Found & Fixed:**
- **H1** [FIXED]: Added namespace encoding integration test to verify AC#3 (line 144-199 in atelierApiService.test.ts)
- **H2** [FIXED]: Webview now re-fetches namespaces on state restoration (main.js)
- **H3** [FIXED]: Changed AUTH_FAILED to AUTH_EXPIRED for session expiration (ServerConnectionManager.ts:207)
- **M1** [FIXED]: Refactored to event delegation pattern to prevent listener stacking (main.js)
- **M2** [FIXED]: Added context-aware error handling with inline retry for namespace errors (main.js)
- **M3** [FIXED]: Reuse single AtelierApiService instance per ServerConnectionManager (ServerConnectionManager.ts)

**Test Results:**
- 75 tests passing (74 original + 1 new integration test)
- Build: `npm run compile` exits with code 0
- Lint: `npm run lint` passes with no errors

### File List

**Modified:**
- `src/services/AtelierApiService.ts` - Added getNamespaces() method and IAtelierServerDescriptor interface
- `src/providers/ServerConnectionManager.ts` - Added getNamespaces() method with fresh credential handling
- `src/providers/TableEditorProvider.ts` - Added namespace handlers, auto-fetch, and state tracking
- `src/models/IMessages.ts` - Added namespace command/event types
- `media/main.js` - Added namespace AppState, handlers, render functions, and event handlers
- `media/styles.css` - Added namespace list CSS styles
- `src/test/atelierApiService.test.ts` - Added getNamespaces tests
- `src/test/serverConnectionManager.test.ts` - Added getNamespaces tests
