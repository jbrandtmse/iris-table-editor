# Story 11.3: Tab Bar

Status: review

## Story

As a **user**,
I want **to open multiple tables as tabs within the desktop window**,
so that **I can work with several tables simultaneously**.

## Acceptance Criteria

1. **Given** the desktop app is running and connected to a server, **When** I double-click a table in the sidebar, **Then** a new tab opens in the tab bar with the table name **And** the grid loads in the main content area

2. **Given** I have multiple tabs open, **When** I click a different tab, **Then** the active tab changes **And** the main content area shows that tab's grid **And** each tab retains its own state (filters, sort, scroll position, page)

3. **Given** I have a tab open, **When** I click the close button on the tab, **Then** the tab closes **And** if there are unsaved changes, a confirmation prompt appears

4. **Given** the tab bar has many tabs, **When** tabs exceed the available width, **Then** the tab bar scrolls horizontally

5. **Given** I open a table that is already open in another tab, **When** the table matches by name and namespace, **Then** the existing tab is focused (no duplicate tab created)

6. **Given** keyboard navigation, **When** I press Ctrl+Tab, **Then** focus moves to the next tab **And** Ctrl+Shift+Tab moves to the previous tab **And** Ctrl+W closes the current tab

## Tasks / Subtasks

- [x] Task 1: Create desktop app shell layout (AC: 1)
  - [x] 1.1: Create `packages/desktop/src/ui/app-shell.html` with three-panel layout: sidebar + tab bar + content area
  - [x] 1.2: Create `packages/desktop/src/ui/app-shell.css` with flexbox layout styling
  - [x] 1.3: Sidebar panel contains all existing server-list.html content (server list, context menu, form overlay, ARIA live regions)
  - [x] 1.4: Main panel has tab bar area (empty initially) + content area
  - [x] 1.5: Content area has welcome placeholder (shown when no tabs) and grid container (hidden until first tab opens)
  - [x] 1.6: Grid container includes full grid HTML structure from `packages/vscode/src/providers/GridPanelManager.ts` (lines ~1854-2020: toolbar, loading overlay, grid wrapper with `#dataGrid`, pagination, toast container, delete dialog)
  - [x] 1.7: Link CSS: `server-list.css`, `server-form.css`, `app-shell.css`, `tab-bar.css`, and webview CSS (`theme.css`, `styles.css`, `grid-styles.css`) via relative paths to `../../../webview/src/`
  - [x] 1.8: Link JS: `server-list.js`, `server-form.js`, `tab-bar.js`, and `grid.js` via relative path to `../../../webview/src/grid.js`
  - [x] 1.9: Update `main.ts` to load `app-shell.html` instead of `server-list.html`
  - [x] 1.10: Verify `injectThemeCSS()` path still resolves correctly from the new HTML location

- [x] Task 2: Add namespace/table browsing to sidebar (AC: 1)
  - [x] 2.1: In `server-list.js`, after `connectionProgress` status='connected': send `getNamespaces` command via `messageBridge.sendCommand('getNamespaces', {})`
  - [x] 2.2: Listen for `namespaceList` event: render collapsible namespace tree below the connected server in the sidebar
  - [x] 2.3: Click namespace item: send `getTables` command with `{ namespace }` payload
  - [x] 2.4: Listen for `tableList` event: render table list under the expanded namespace
  - [x] 2.5: Double-click table item: dispatch custom DOM event `new CustomEvent('ite:openTable', { detail: { namespace, tableName }, bubbles: true })`
  - [x] 2.6: Show loading spinners during namespace/table fetches
  - [x] 2.7: Group tables by schema prefix (schema.tableName format) — display as collapsible schema groups within each namespace
  - [x] 2.8: Add CSS for namespace/table tree in `server-list.css` (`.ite-sidebar__tree`, `.ite-sidebar__namespace`, `.ite-sidebar__table`)
  - [x] 2.9: On disconnect: clear namespace/table tree from sidebar

- [x] Task 3: Add `emitLocalEvent()` to preload bridge (AC: 2)
  - [x] 3.1: In `preload.ts`, maintain a `Map<string, Set<Function>>` of registered callbacks alongside existing ipcRenderer listeners
  - [x] 3.2: In `onEvent()`, also register callback in the local map
  - [x] 3.3: In `offEvent()`, also remove callback from the local map
  - [x] 3.4: Add `emitLocalEvent(eventName: string, payload: unknown): void` — iterates local callbacks for the event and calls each with the payload
  - [x] 3.5: Expose `emitLocalEvent` via `contextBridge.exposeInMainWorld()` alongside existing methods
  - [x] 3.6: Validate eventName against `isValidEvent()` in `emitLocalEvent` (same as `onEvent`)
  - [x] 3.7: Update `channelValidation.ts` `ALLOWED_EVENTS` to include `restoreGridState` event

- [x] Task 4: Add `restoreGridState` event handler to grid.js (AC: 2)
  - [x] 4.1: In `grid.js` `init()`, add `restoreGridState` to the `gridEventTypes` array
  - [x] 4.2: In `handleMessage()`, add case `restoreGridState`: read state from `messageBridge.getState()`, merge into grid `state` object (using `Object.assign(new AppState(), savedState)` pattern from init), then call `renderGrid()` and update UI state (filter badges, sort indicators, pagination, delete button state)
  - [x] 4.3: Ensure `restoreGridState` properly initializes Maps for filters (JSON serialization loses Map type)

- [x] Task 5: Create tab bar component (AC: 1, 2, 4, 5)
  - [x] 5.1: Create `packages/desktop/src/ui/tabs/tab-bar.css` — tab bar styling
  - [x] 5.2: Create `packages/desktop/src/ui/tabs/tab-bar.js` — TabBarManager class
  - [x] 5.3: Tab model: `{ id: string, namespace: string, tableName: string, label: string, cachedSchema: object|null, cachedData: object|null, gridState: object|null, isDirty: boolean }`
  - [x] 5.4: `openTab(namespace, tableName)` — check duplicate first (getTabByTable), send `selectTable` command, create tab when schema received
  - [x] 5.5: `switchTab(tabId)` — save current grid state, set new active tab, restore target grid state, send `activateTab` command to update main process context
  - [x] 5.6: `closeTab(tabId)` — dirty check, remove tab, activate adjacent (prefer right, then left), show welcome if no tabs remain
  - [x] 5.7: `getTabByTable(namespace, tableName)` — find existing tab for duplicate prevention
  - [x] 5.8: Render tab bar: tab label shows `schema.tableName` (or just `tableName`), active tab highlighted, close button (x) on each tab
  - [x] 5.9: Tab bar scrolls horizontally when overflowing (`overflow-x: auto`)
  - [x] 5.10: Listen for `tableSchema` event — cache schema in active tab, or pending tab if opening
  - [x] 5.11: Listen for `tableData` event — cache data (rows, totalRows) in active tab
  - [x] 5.12: Listen for `ite:openTable` DOM event — trigger `openTab()`
  - [x] 5.13: On tab open: hide welcome placeholder, show grid container
  - [x] 5.14: On last tab close: hide grid container, show welcome placeholder

- [x] Task 6: Add `activateTab` IPC command (AC: 2)
  - [x] 6.1: Add `activateTab` to `channelValidation.ts` `ALLOWED_COMMANDS`
  - [x] 6.2: Add `activateTab` case to `routeCommand()` in `ipc.ts`: extract `{ namespace, tableName, schema }` from payload, call `sessionManager.setNamespace(namespace)` and `sessionManager.setTable(tableName, schema)` — no response event sent
  - [x] 6.3: `activateTab` uses `requireSession()` guard (must be connected)

- [x] Task 7: Tab close with unsaved changes detection (AC: 3)
  - [x] 7.1: Track dirty state per tab: set `isDirty = true` when grid has pending saves (`pendingSaves.size > 0`) or new unsaved rows (`newRows.length > 0`)
  - [x] 7.2: Listen for `saveCellResult` / `insertRowResult` events to update dirty state
  - [x] 7.3: On close button click: if `isDirty`, show `confirm('You have unsaved changes. Close this tab?')` — native dialog
  - [x] 7.4: If confirmed or not dirty: close tab; if cancelled: keep tab open
  - [x] 7.5: Activate adjacent tab after close (prefer tab to the right, then left)

- [x] Task 8: Keyboard shortcuts (AC: 6)
  - [x] 8.1: `Ctrl+Tab` → switch to next tab (wrap around to first)
  - [x] 8.2: `Ctrl+Shift+Tab` → switch to previous tab (wrap around to last)
  - [x] 8.3: `Ctrl+W` → close current tab (with dirty check)
  - [x] 8.4: Register `keydown` listener at document level in tab-bar.js
  - [x] 8.5: Prevent shortcuts when modal dialogs are open (check for visible overlays)
  - [x] 8.6: `preventDefault()` to prevent browser/Electron default behavior for these combos

- [x] Task 9: Write tests (AC: all)
  - [x] 9.1: Unit tests for TabBarManager: openTab, closeTab, switchTab, getTabByTable
  - [x] 9.2: Unit tests for duplicate tab prevention (same namespace+tableName)
  - [x] 9.3: Unit tests for tab switching state save/restore
  - [x] 9.4: Unit tests for dirty check on close
  - [x] 9.5: Unit tests for keyboard shortcut handling (next tab, prev tab, close)
  - [x] 9.6: Unit tests for `activateTab` IPC command routing
  - [x] 9.7: Unit tests for channel validation updates (new commands/events)
  - [x] 9.8: Unit tests for `emitLocalEvent` in preload (test the callback registry logic, not contextBridge)
  - [x] 9.9: Tests in `packages/desktop/src/test/`

- [x] Task 10: Validate (AC: all)
  - [x] 10.1: Run `npm run compile` — all packages compile
  - [x] 10.2: Run `npm run lint` — no new lint errors
  - [x] 10.3: Run `npm run test` — all tests pass
  - [x] 10.4: Verify packages/desktop has no `vscode` imports

## Dev Notes

### Architecture Context

The desktop app currently has a sidebar-only UI (`server-list.html` for connection management). This story adds three things:
1. **Namespace/table browsing** in the sidebar (after connecting)
2. **Tab bar** for managing multiple open tables
3. **Grid content area** where the data grid renders

The grid is the `grid.js` from `packages/webview/src/grid.js` — a self-contained IIFE that registers for messageBridge events and renders into DOM elements by ID.

### Grid Integration Details

**READ THESE FILES before implementing:**
- `packages/webview/src/grid.js` — the grid component (self-initializing IIFE, ~5900 lines)
- `packages/vscode/src/providers/GridPanelManager.ts` lines ~1854-2020 — the grid HTML template (copy this DOM structure into the content area of app-shell.html)
- `packages/webview/src/styles.css` — general styles
- `packages/webview/src/grid-styles.css` — grid-specific styles

**How grid.js works:**
- IIFE with internal `AppState` class (columns, rows, pagination, filters, sort, etc.)
- `init()` called at bottom — registers for messageBridge events: `tableSchema`, `tableData`, `tableLoading`, `saveCellResult`, `insertRowResult`, `deleteRowResult`, `importPreview`, `importProgress`, `importResult`, `importValidationResult`, `exportProgress`, `exportResult`, `error`
- Attaches DOM event listeners to elements by ID: `dataGrid`, `refreshBtn`, `addRowBtn`, `saveRowBtn`, `deleteRowBtn`, `clearFiltersBtn`, `toggleFiltersBtn`, `filterPanelBtn`, `importBtn`, `exportBtn`, `columnWidthSlider`, pagination buttons, etc.
- Saves state via `messageBridge.setState(state)` after each change
- Restores from `messageBridge.getState()` in `init()` (one-time at load)
- Uses `window.iteMessageBridge` for all communication

**Grid DOM requirements (from GridPanelManager.ts):**
```
.ite-grid-container
  .ite-toolbar (with all toolbar buttons by ID)
  .ite-grid-loading#loadingOverlay
  .ite-grid-wrapper#gridWrapper
    .ite-grid#dataGrid[role="grid"]
  .ite-pagination#paginationContainer
  #toastContainer
  .ite-dialog-overlay#deleteDialogOverlay (delete confirmation dialog)
```

### Tab Switching Strategy: State Save/Restore

Grid.js uses messageBridge's getState/setState for persistence. Use this for per-tab state:

**Save current tab:**
```javascript
// tab-bar.js reads grid state before switching
const currentGridState = messageBridge.getState();
currentTab.gridState = currentGridState;
currentTab.cachedSchema = currentGridState?.columns;
currentTab.cachedData = { rows: currentGridState?.rows, totalRows: currentGridState?.totalRows };
```

**Restore target tab:**
```javascript
// Set the target tab's cached state, then tell grid to reload
messageBridge.setState(targetTab.gridState);
messageBridge.emitLocalEvent('restoreGridState', {});
// Also update main process context
messageBridge.sendCommand('activateTab', {
    namespace: targetTab.namespace,
    tableName: targetTab.tableName,
    schema: targetTab.cachedSchema
});
```

**Grid.js handles `restoreGridState`:**
```javascript
case 'restoreGridState': {
    const savedState = messageBridge ? messageBridge.getState() : null;
    if (savedState) {
        state = Object.assign(new AppState(), savedState);
        // Reconstruct Map from plain object (JSON serialization loses Map)
        if (savedState.filters && !(savedState.filters instanceof Map)) {
            state.filters = new Map(Object.entries(savedState.filters));
        }
        if (state.columns.length > 0) {
            renderGrid();
            updateDeleteButtonState();
            updateFilterToolbarButtons();
            updateFilterBadge();
        }
    }
    break;
}
```

### Local Event Emission (emitLocalEvent)

Grid.js registers event listeners via `messageBridge.onEvent()`. For tab switching, tab-bar.js needs to emit events that grid.js receives WITHOUT going through IPC. Solution:

In `preload.ts`, maintain a parallel callback registry:
```typescript
const localCallbacks = new Map<string, Set<(payload: unknown) => void>>();

// In onEvent: also register in localCallbacks
// In offEvent: also remove from localCallbacks

emitLocalEvent(eventName: string, payload: unknown): void {
    if (!isValidEvent(eventName)) {
        console.warn(`Invalid event name for local emit: ${eventName}`);
        return;
    }
    const callbacks = localCallbacks.get(eventName);
    if (callbacks) {
        callbacks.forEach(cb => {
            try { cb(payload); } catch (e) { console.error('Error in local event callback:', e); }
        });
    }
}
```

This allows renderer-side event dispatch without modifying the IPC flow.

### Namespace/Table Browsing

After the sidebar shows "Connected to {server}", add a collapsible tree:
```
Namespaces
  ├── HSCUSTOM
  │   ├── SQLUser (schema group)
  │   │   ├── Patient (double-click → open tab)
  │   │   └── Visit
  │   └── HS (schema group)
  │       └── Config
  └── %SYS
      └── %Dictionary
          └── ClassDefinition
```

Use existing IPC commands:
- `getNamespaces` → receives `namespaceList` event with `{ namespaces: string[] }`
- `getTables` with `{ namespace }` → receives `tableList` event with `{ tables: string[] }`

Table names have format `schema.tableName` — split on first `.` to group by schema.

### CSS Architecture

Follow existing BEM patterns:
- `.ite-app-shell` — root layout (flexbox row: sidebar + main)
- `.ite-app-shell__sidebar` — left panel (existing sidebar content)
- `.ite-app-shell__main` — right panel (tab bar + content, flexbox column)
- `.ite-tab-bar` — tab bar container (overflow-x: auto for horizontal scroll)
- `.ite-tab-bar__tab` — individual tab (inline-flex, label + close button)
- `.ite-tab-bar__tab--active` — active tab indicator (border-bottom accent color)
- `.ite-tab-bar__label` — tab label text
- `.ite-tab-bar__close` — close button (x)
- `.ite-welcome` — welcome placeholder in content area

Use `--ite-*` CSS variables for theming (from desktopThemeBridge.css).

### Tab Open Flow

```
Sidebar: user double-clicks table
  → dispatches ite:openTable DOM event { namespace, tableName }

Tab-bar.js: receives ite:openTable
  → getTabByTable(namespace, tableName) — check duplicates
  → If exists: switchTab(existingTab.id)
  → If new:
    → Create pending tab (shows "Loading..." in tab label)
    → sendCommand('selectTable', { namespace, tableName })
    → On 'tableSchema' event: cache schema in tab
    → sendCommand('requestData', { namespace, tableName, pageSize: 50, offset: 0 })
    → On 'tableData' event: cache data in tab, finalize tab label, mark as loaded
```

### Previous Story Intelligence

**Story 11.1 established:** BrowserWindow, preload with IMessageBridge, IPC registration, CSS injection
**Story 11.2 added:** SessionManager (table context), 10 data command routes (getNamespaces, getTables, selectTable, requestData, refresh, paginateNext/Prev, saveCell, insertRow, deleteRow), channel validation
**Current test count:** 590 (241 vscode + 349 desktop)

### Important: IPC Command Signatures

From `ipc.ts`, the data commands use SessionManager for context:
- `selectTable` → `{ namespace?, tableName }` — sets SessionManager context, sends `tableSchema`
- `requestData` → `{ pageSize?, offset?, filters?, sortColumn?, sortDirection? }` — uses SessionManager's current table
- `activateTab` (NEW) → `{ namespace, tableName, schema }` — sets SessionManager context, NO response event

### References

- [Source: packages/webview/src/grid.js — Grid component]
- [Source: packages/vscode/src/providers/GridPanelManager.ts — Grid HTML template]
- [Source: packages/desktop/src/main/main.ts — Current Electron main process]
- [Source: packages/desktop/src/main/ipc.ts — Current IPC routing]
- [Source: packages/desktop/src/main/SessionManager.ts — Session state]
- [Source: packages/desktop/src/main/channelValidation.ts — Channel validation]
- [Source: packages/desktop/src/main/preload.ts — Preload bridge]

---

## Dev Agent Record

### Completion Notes

All 10 tasks implemented and validated. The desktop app now has a three-panel layout (sidebar + tab bar + grid content area) with full tab management for multiple open tables.

**Key implementation decisions:**
- `app-shell.html` replaces `server-list.html` as the entry point, combining sidebar content (server list, context menu, server form) with a tab bar and grid content area in a flexbox layout.
- Grid HTML structure was copied from `GridPanelManager.ts` into the content area, minus the context bar (which is replaced by tab labels).
- `emitLocalEvent` in preload.ts uses a parallel `Map<string, Set<Function>>` callback registry alongside the existing ipcRenderer listeners, enabling renderer-side event dispatch without IPC round-trip.
- `restoreGridState` event in grid.js follows the same state restoration pattern as `init()`, including Map reconstruction for filters.
- `activateTab` IPC command calls `sessionManager.setNamespace()` then `sessionManager.setTable()` to update context without sending response events.
- Namespace/table browsing groups tables by schema prefix with collapsible tree nodes.
- TabBarManager is a pure browser-side IIFE exposed as `window.iteTabBarManager`, tested via a parallel `TestTabBarManager` class in the test file that replicates the core logic without DOM dependencies.
- Dirty state tracking checks both `pendingSaves` (Map or plain object) and `newRows` array length.
- Keyboard shortcuts (Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+W) are guarded against modal dialog visibility.

### Files Modified

- `packages/desktop/src/main/main.ts` — Updated HTML path from `server-list.html` to `app-shell.html`
- `packages/desktop/src/main/ipc.ts` — Added `activateTab` command case
- `packages/desktop/src/main/preload.ts` — Added `localCallbacks` registry, `emitLocalEvent()`, updated `onEvent()`/`offEvent()` to register/unregister in local map
- `packages/desktop/src/main/channelValidation.ts` — Added `activateTab` to `ALLOWED_COMMANDS`, `restoreGridState` to `ALLOWED_EVENTS`
- `packages/desktop/src/ui/connection/server-list.js` — Added namespace/table browsing state, tree rendering, event handlers, click/dblclick delegation
- `packages/desktop/src/ui/connection/server-list.css` — Added namespace/table tree styles (`.ite-sidebar__tree`, `.ite-sidebar__namespace`, `.ite-sidebar__schema`, `.ite-sidebar__table`)
- `packages/webview/src/grid.js` — Added `restoreGridState` to `gridEventTypes` and `handleMessage` switch case
- `packages/desktop/src/test/channelValidation.test.ts` — Updated command count to 21, event count to 20, added tab command/event assertions

### Files Created

- `packages/desktop/src/ui/app-shell.html` — Three-panel app shell layout (sidebar + tab bar + grid)
- `packages/desktop/src/ui/app-shell.css` — Flexbox layout styling for the app shell
- `packages/desktop/src/ui/tabs/tab-bar.js` — TabBarManager class (open, close, switch, duplicate prevention, dirty check, keyboard shortcuts)
- `packages/desktop/src/ui/tabs/tab-bar.css` — Tab bar styling (BEM, theme variables, horizontal scrolling)
- `packages/desktop/src/test/tabBar.test.ts` — 50 unit tests for tab bar logic, IPC routing, channel validation, emitLocalEvent

### Test Results

- **Total tests: 640** (241 vscode + 399 desktop)
- **New tests added: 50** (in `tabBar.test.ts`)
- **All tests pass** (`npm run test` exits cleanly)
- **Compile: clean** (`npm run compile` succeeds for all 3 packages)
- **Lint: clean** (`npm run lint` produces no errors or warnings)
- **No vscode imports** in `packages/desktop/src/`
