# Story 11.4: Native Menu

Status: review

## Story

As a **user**,
I want **a native menu bar with standard application menus**,
so that **the desktop app feels like a proper native application**.

## Acceptance Criteria

1. **Given** the desktop app is running, **When** I look at the title bar area, **Then** I see a native menu bar with: File, Edit, View, Help

2. **File menu** contains: New Connection (opens server form), Disconnect (if connected), Close Tab (Ctrl+W), Close All Tabs, separator, Exit (Alt+F4)

3. **Edit menu** contains: Undo (Ctrl+Z), separator, Copy (Ctrl+C), Paste (Ctrl+V), separator, Set NULL (Ctrl+Shift+N)

4. **View menu** contains: Toggle Sidebar (Ctrl+B), Toggle Filter Panel, separator, Light Theme / Dark Theme (radio selection), separator, Keyboard Shortcuts (Ctrl+/)

5. **Help menu** contains: Keyboard Shortcuts, About IRIS Table Editor

6. **Given** menu items with keyboard shortcuts, **When** I use the shortcut directly, **Then** the action fires without opening the menu

## Tasks / Subtasks

- [x] Task 1: Create MenuBuilder module (AC: 1)
  - [x] 1.1: Create `packages/desktop/src/main/menuBuilder.ts`
  - [x] 1.2: Export `buildApplicationMenu(win, callbacks)` function that returns `Menu` using `Menu.buildFromTemplate()`
  - [x] 1.3: Define the four top-level menus: File, Edit, View, Help
  - [x] 1.4: `callbacks` parameter typed as `MenuCallbacks` interface with handlers for each custom action
  - [x] 1.5: Export `updateMenuState(state)` function that enables/disables dynamic items
  - [x] 1.6: Export `MenuState` interface: `{ isConnected: boolean, hasOpenTabs: boolean, themeSource: 'light' | 'dark' | 'system' }`

- [x] Task 2: Implement File menu (AC: 2, 6)
  - [x] 2.1: "New Connection" — accelerator: none (no standard shortcut); calls `callbacks.onNewConnection()`
  - [x] 2.2: "Disconnect" — no accelerator; calls `callbacks.onDisconnect()`; enabled only when connected
  - [x] 2.3: Separator
  - [x] 2.4: "Close Tab" — accelerator: `CommandOrControl+W`; calls `callbacks.onCloseTab()`; set `registerAccelerator: false` so renderer also receives the keydown (grid may need Ctrl+W for other purposes)
  - [x] 2.5: "Close All Tabs" — accelerator: `CommandOrControl+Shift+W`; calls `callbacks.onCloseAllTabs()`
  - [x] 2.6: Separator
  - [x] 2.7: "Exit" — role: `quit` (Electron handles Alt+F4/Cmd+Q automatically)

- [x] Task 3: Implement Edit menu (AC: 3, 6)
  - [x] 3.1: "Undo" — role: `undo` (Electron native, handles Ctrl+Z)
  - [x] 3.2: Separator
  - [x] 3.3: "Copy" — role: `copy` (Electron native, handles Ctrl+C)
  - [x] 3.4: "Paste" — role: `paste` (Electron native, handles Ctrl+V)
  - [x] 3.5: Separator
  - [x] 3.6: "Set NULL" — accelerator: `CommandOrControl+Shift+N`; calls `callbacks.onSetNull()` which sends `menuAction` event to renderer

- [x] Task 4: Implement View menu (AC: 4, 6)
  - [x] 4.1: "Toggle Sidebar" — accelerator: `CommandOrControl+B`; calls `callbacks.onToggleSidebar()`
  - [x] 4.2: "Toggle Filter Panel" — no accelerator; calls `callbacks.onToggleFilterPanel()`
  - [x] 4.3: Separator
  - [x] 4.4: "Light Theme" — type: `radio`; calls `callbacks.onSetTheme('light')`, checked when theme is light
  - [x] 4.5: "Dark Theme" — type: `radio`; calls `callbacks.onSetTheme('dark')`, checked when theme is dark
  - [x] 4.6: "System Theme" — type: `radio`; calls `callbacks.onSetTheme('system')`, checked when theme is system
  - [x] 4.7: Separator
  - [x] 4.8: "Keyboard Shortcuts" — accelerator: `CommandOrControl+/`; calls `callbacks.onShowShortcuts()`

- [x] Task 5: Implement Help menu (AC: 5)
  - [x] 5.1: "Keyboard Shortcuts" — calls `callbacks.onShowShortcuts()` (same as View menu)
  - [x] 5.2: "About IRIS Table Editor" — calls `callbacks.onShowAbout()` which uses `dialog.showMessageBox()` with app name, version from package.json, description

- [x] Task 6: Wire MenuBuilder to main.ts (AC: 1, 6)
  - [x] 6.1: Import `buildApplicationMenu`, `updateMenuState` from `menuBuilder.ts`
  - [x] 6.2: After window creation, call `buildApplicationMenu()` with callbacks
  - [x] 6.3: Callbacks send `menuAction` events to the renderer via `sendEvent(win, 'menuAction', { action, payload })`
  - [x] 6.4: `onDisconnect` calls `lifecycleManager.disconnect()` directly in main process
  - [x] 6.5: `onSetTheme` calls `nativeTheme.themeSource = themeValue` (Electron sets `prefers-color-scheme` accordingly, desktopThemeBridge.css reacts)
  - [x] 6.6: `onShowAbout` shows `dialog.showMessageBox()` with app info
  - [x] 6.7: Call `Menu.setApplicationMenu(menu)` to apply

- [x] Task 7: Add menuAction event handler in renderer (AC: all)
  - [x] 7.1: Create `packages/desktop/src/ui/menu-handler.js` — handles `menuAction` events
  - [x] 7.2: Listen for `menuAction` event via `messageBridge.onEvent('menuAction', handler)`
  - [x] 7.3: Dispatch actions:
    - `newConnection` -> `window.iteServerForm.openAddForm()`
    - `closeTab` -> `window.iteTabBarManager.closeTab(activeTabId)` using `getActiveTab()`
    - `closeAllTabs` -> iterate all tabs and close each (with dirty check per tab)
    - `toggleSidebar` -> toggle `.ite-app-shell__sidebar` display
    - `toggleFilterPanel` -> emit local `menuToggleFilterPanel` event (grid.js can listen)
    - `showShortcuts` -> emit local event to show keyboard shortcuts help (grid.js has this)
    - `setNull` -> emit local event for grid to set current cell to NULL
  - [x] 7.4: Include `menu-handler.js` in `app-shell.html` script tags

- [x] Task 8: Dynamic menu state updates (AC: 2)
  - [x] 8.1: Track `isConnected` in main.ts from the lifecycleManager callback (already exists)
  - [x] 8.2: After connection state changes, call `updateMenuState({ isConnected, hasOpenTabs, themeSource })`
  - [x] 8.3: `updateMenuState` finds menu items by id and toggles `enabled` property
  - [x] 8.4: Use `Menu.getApplicationMenu().getMenuItemById()` for finding items
  - [x] 8.5: Assign `id` to dynamic items: `disconnect`, `closeTab`, `closeAllTabs`
  - [x] 8.6: For tab state: listen for new `tabStateChanged` command from renderer (tab-bar.js sends when tab count changes)
  - [x] 8.7: Add `tabStateChanged` to `ALLOWED_COMMANDS` in channelValidation.ts
  - [x] 8.8: Handle `tabStateChanged` in `routeCommand()` — update menu state

- [x] Task 9: IPC and channel validation updates (AC: all)
  - [x] 9.1: Add `menuAction` to `ALLOWED_EVENTS` in channelValidation.ts
  - [x] 9.2: Add `tabStateChanged` to `ALLOWED_COMMANDS` in channelValidation.ts
  - [x] 9.3: Add `menuToggleFilterPanel` and `menuSetNull` and `menuShowShortcuts` to `ALLOWED_EVENTS` for local emit
  - [x] 9.4: Handle `tabStateChanged` command in `ipc.ts` — calls `updateMenuState()`

- [x] Task 10: Wire tab-bar.js to send tab state changes (AC: 2)
  - [x] 10.1: In `tab-bar.js`, after openTab/closeTab: send `tabStateChanged` command with `{ tabCount: tabs.length }`
  - [x] 10.2: This allows main process to enable/disable "Close Tab" and "Close All Tabs"

- [x] Task 11: Write tests (AC: all)
  - [x] 11.1: Unit tests for MenuBuilder: buildApplicationMenu returns correct structure (4 submenus), menu item labels, accelerators, roles
  - [x] 11.2: Unit tests for updateMenuState: enable/disable items based on connection and tab state
  - [x] 11.3: Unit tests for menuAction event handling (routing to correct action)
  - [x] 11.4: Unit tests for theme switching (nativeTheme.themeSource assignment)
  - [x] 11.5: Unit tests for tabStateChanged IPC command routing
  - [x] 11.6: Unit tests for channel validation updates
  - [x] 11.7: Tests in `packages/desktop/src/test/`

- [x] Task 12: Validate (AC: all)
  - [x] 12.1: Run `npm run compile` — all packages compile
  - [x] 12.2: Run `npm run lint` — no new lint errors
  - [x] 12.3: Run `npm run test` — all tests pass
  - [x] 12.4: Verify packages/desktop has no `vscode` imports

## Dev Notes

### Architecture Context

The desktop app currently has a BrowserWindow with no application menu. Electron shows a default menu or none depending on the platform. This story adds a proper native menu bar with standard File/Edit/View/Help menus.

**Key pattern:** Menu is in the main process (Electron `Menu` API). Custom menu actions send `menuAction` events to the renderer via IPC. The renderer dispatches these to the appropriate handler (tab-bar.js, server-form, grid.js).

### Menu -> Renderer Communication

Menu items run in the main process. To trigger renderer-side actions:
```
Menu click handler (main process)
  -> sendEvent(win, 'menuAction', { action: 'closeTab' })
  -> Renderer receives via messageBridge.onEvent('menuAction', ...)
  -> menu-handler.js dispatches to window.iteTabBarManager.closeTab()
```

Some actions can stay in the main process:
- **Exit**: `role: 'quit'` (Electron built-in)
- **Disconnect**: `lifecycleManager.disconnect()` (already in main process)
- **Theme switch**: `nativeTheme.themeSource = 'dark'` (main process, affects CSS media queries)
- **About**: `dialog.showMessageBox()` (main process)

### Edit Menu Roles

Electron's built-in roles handle standard edit operations:
```typescript
{ label: 'Undo', role: 'undo' }     // Ctrl+Z - native undo
{ label: 'Copy', role: 'copy' }     // Ctrl+C - native copy
{ label: 'Paste', role: 'paste' }   // Ctrl+V - native paste
```
These work automatically for text inputs and selections. No custom IPC needed.

### Theme Switching via nativeTheme

The desktop uses `desktopThemeBridge.css` which maps `--ite-*` CSS variables based on `@media (prefers-color-scheme: light/dark)`. Electron's `nativeTheme.themeSource` controls what `prefers-color-scheme` evaluates to:
```typescript
import { nativeTheme } from 'electron';
nativeTheme.themeSource = 'dark';   // Forces dark mode
nativeTheme.themeSource = 'light';  // Forces light mode
nativeTheme.themeSource = 'system'; // Follow OS preference
```
No CSS changes needed — the existing media queries react automatically.

### Accelerator Conflicts

Some keyboard shortcuts are already handled by:
- **Grid.js**: Ctrl+N (new row), Ctrl+S (save), Ctrl+R/F5 (refresh), Ctrl+F (filter), etc.
- **Tab-bar.js**: Ctrl+Tab (next tab), Ctrl+Shift+Tab (prev tab), Ctrl+W (close tab)

For menu accelerators:
- Use `registerAccelerator: false` on items where the renderer also handles the shortcut (e.g., Ctrl+W) to allow both menu display AND renderer handling
- Standard edit roles (Ctrl+Z, Ctrl+C, Ctrl+V) use Electron built-in handling — no conflict

### Dynamic State

Menu items that need enabling/disabling:
- **Disconnect**: enabled only when `isConnected === true`
- **Close Tab**: enabled only when `hasOpenTabs === true`
- **Close All Tabs**: enabled only when `hasOpenTabs === true`

State sources:
- `isConnected`: from the existing lifecycleManager callback in main.ts
- `hasOpenTabs`: from `tabStateChanged` command sent by renderer's tab-bar.js
- `themeSource`: tracked in main.ts (defaults to `'system'`)

### About Dialog

Use Electron's `dialog.showMessageBox()`:
```typescript
dialog.showMessageBox(win, {
    type: 'info',
    title: 'About IRIS Table Editor',
    message: 'IRIS Table Editor',
    detail: `Version ${app.getVersion()}\nDesktop application for editing InterSystems IRIS database tables.`,
    buttons: ['OK']
});
```

### Set NULL Action

When "Set NULL" is triggered from the menu:
1. Main sends `menuAction` with `{ action: 'setNull' }`
2. `menu-handler.js` emits a local event `menuSetNull`
3. Grid.js listens for `menuSetNull` and sets the currently selected cell to NULL (if editing or selected)
4. This requires grid.js to add a `menuSetNull` case in `handleMessage()` or `init()`

### Renderer Global References

The renderer exposes these globals for menu-handler.js:
- `window.iteTabBarManager` — TabBarManager instance (tab operations)
- `window.iteServerForm` — Server form (openAddForm, etc.)
- `window.iteMessageBridge` — IPC bridge (sendCommand, emitLocalEvent)

### Previous Story Intelligence

**Story 11.1**: BrowserWindow creation, preload, IPC
**Story 11.2**: SessionManager, data commands, channel validation
**Story 11.3**: Tab bar (TabBarManager), app-shell layout, emitLocalEvent, restoreGridState
**Current test count**: 640 (241 vscode + 399 desktop)

### References

- [Source: packages/desktop/src/main/main.ts — Electron main process]
- [Source: packages/desktop/src/main/ipc.ts — IPC routing]
- [Source: packages/desktop/src/ui/tabs/tab-bar.js — Tab bar manager]
- [Source: packages/desktop/src/ui/connection/server-list.js — Server list operations]
- [Source: packages/webview/src/desktopThemeBridge.css — Theme CSS variables]
- [Electron Menu API: https://www.electronjs.org/docs/latest/api/menu]
- [Electron nativeTheme: https://www.electronjs.org/docs/latest/api/native-theme]

---

## Dev Agent Record

### Completion Notes

All 12 tasks implemented successfully. The implementation adds a full native application menu to the Electron desktop app with File, Edit, View, and Help menus. Key design decisions:

1. **MenuBuilder module** (`menuBuilder.ts`): Clean separation of menu template building from wiring logic. Exports `buildApplicationMenu()` and `updateMenuState()` functions with typed interfaces (`MenuCallbacks`, `MenuState`).

2. **IPC callbacks pattern**: Added `IpcCallbacks` interface to `routeCommand()` and `registerIpcHandlers()` as an optional parameter, allowing main.ts to react to `tabStateChanged` commands without breaking existing API consumers. This is backwards-compatible since the parameter is optional.

3. **Renderer-side dispatch**: `menu-handler.js` acts as a bridge between IPC `menuAction` events and the existing UI components. Actions that stay in the main process (disconnect, theme, about, exit) skip the renderer entirely.

4. **Grid.js integration**: Added three new event handlers (`menuSetNull`, `menuToggleFilterPanel`, `menuShowShortcuts`) to grid.js's `handleMessage()` and event listener registration, allowing the native menu to trigger grid operations via local events.

5. **Tab state tracking**: `tab-bar.js` now sends `tabStateChanged` commands after `openTab()`, `closeTab()`, and `handleDisconnect()` to keep the main process informed of tab count for menu enable/disable.

6. **Theme switching**: Uses Electron's `nativeTheme.themeSource` to control `prefers-color-scheme`, which the existing `desktopThemeBridge.css` media queries react to automatically. No CSS changes needed.

7. **Testing approach**: Since Electron's `Menu` API cannot be imported in Node.js test runner, tests use mock menu structures that mirror the real template. Tests validate: channel validation (new commands/events and counts), IPC routing (tabStateChanged callback invocation), menu template structure (labels, accelerators, roles, IDs, radio buttons, enabled states), menu state update logic, and event dispatching.

### Files Modified

- `packages/desktop/src/main/main.ts` — Added Menu, nativeTheme, dialog imports; menuState tracking; buildApplicationMenu with all callbacks; updateMenuState on connection changes; IPC callbacks for tabStateChanged
- `packages/desktop/src/main/ipc.ts` — Added IpcCallbacks interface; tabStateChanged case in routeCommand; callbacks parameter to routeCommand and registerIpcHandlers
- `packages/desktop/src/main/channelValidation.ts` — Added tabStateChanged to ALLOWED_COMMANDS; menuAction, menuSetNull, menuToggleFilterPanel, menuShowShortcuts to ALLOWED_EVENTS
- `packages/desktop/src/ui/tabs/tab-bar.js` — Added _notifyTabStateChanged() method; called after openTab, closeTab, handleDisconnect
- `packages/desktop/src/ui/app-shell.html` — Added menu-handler.js script tag
- `packages/webview/src/grid.js` — Added menuSetNull, menuToggleFilterPanel, menuShowShortcuts handlers to handleMessage(); added to gridEventTypes array
- `packages/desktop/src/test/channelValidation.test.ts` — Updated command/event counts; added Story 11.4 command/event validation tests

### Files Created

- `packages/desktop/src/main/menuBuilder.ts` — MenuBuilder module with buildApplicationMenu(), updateMenuState(), MenuCallbacks, MenuState interfaces
- `packages/desktop/src/ui/menu-handler.js` — Renderer-side menu action handler dispatching to UI components
- `packages/desktop/src/test/menuBuilder.test.ts` — 75 unit tests covering menu structure, state updates, IPC routing, channel validation, and event dispatching

### Test Results

- `npm run compile` — All packages compile successfully (0 errors)
- `npm run lint` — No lint errors (0 errors, 0 warnings)
- `npm run test` — All tests pass:
  - VS Code: 241 passing
  - Desktop: 474 passing (was 399, +75 new tests)
  - Total: 715 tests, 0 failures
- No `vscode` imports in packages/desktop
