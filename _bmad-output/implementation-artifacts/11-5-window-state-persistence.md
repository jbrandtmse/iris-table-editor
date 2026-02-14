# Story 11.5: Window State Persistence

Status: done

## Story

As a **user**,
I want **the application to remember my window position and size**,
so that **I don't have to resize and reposition it every time I launch**.

## Acceptance Criteria

1. **Given** I resize the application window, **When** I close and reopen the app, **Then** the window opens at the same position and size

2. **Given** I maximize the window, **When** I close and reopen the app, **Then** the window opens maximized

3. **Given** I adjust the sidebar width by dragging, **When** I close and reopen the app, **Then** the sidebar width is restored

4. **Given** I toggle the sidebar closed, **When** I close and reopen the app, **Then** the sidebar state is restored (closed)

5. **Given** window state is stored, **When** I check the storage location, **Then** settings are in the standard Electron userData directory **And** no sensitive data is stored in the window state file

6. **Given** the stored window position is off-screen (e.g., monitor was disconnected), **When** the app launches, **Then** the window is repositioned to be visible on the primary display

## Tasks / Subtasks

- [x] Task 1: Create WindowStateManager service (AC: 1, 2, 5)
  - [x] 1.1: Create `packages/desktop/src/main/WindowStateManager.ts`
  - [x] 1.2: `WindowState` interface: `{ x?: number, y?: number, width: number, height: number, isMaximized: boolean }`
  - [x] 1.3: `AppPersistentState` interface: `{ window: WindowState, sidebar: { width: number, isVisible: boolean }, theme: 'light' | 'dark' | 'system' }`
  - [x] 1.4: Constructor takes `configDir: string` (same as ConnectionManager — `app.getPath('userData')`)
  - [x] 1.5: `load(): AppPersistentState` — reads `window-state.json` from configDir, returns defaults on missing/corrupted file
  - [x] 1.6: `save(state: AppPersistentState): void` — writes JSON to `window-state.json` with mode 0o644 (no sensitive data)
  - [x] 1.7: Default state: `{ window: { width: 1200, height: 800, isMaximized: false }, sidebar: { width: 280, isVisible: true }, theme: 'system' }`
  - [x] 1.8: Validate loaded state (ensure numbers are reasonable: width >= 400, height >= 300, sidebar width 100-600)
  - [x] 1.9: Use same fs-based pattern as ConnectionManager (no electron-store dependency)

- [x] Task 2: Apply saved window state on startup (AC: 1, 2, 6)
  - [x] 2.1: In `main.ts`, instantiate `WindowStateManager` with `app.getPath('userData')`
  - [x] 2.2: Load saved state before window creation
  - [x] 2.3: Pass `savedState.window.width`, `savedState.window.height`, `savedState.window.x`, `savedState.window.y` to `BrowserWindow` constructor
  - [x] 2.4: After window creation, if `savedState.window.isMaximized`, call `win.maximize()`
  - [x] 2.5: Off-screen detection: before applying saved position, check if the window center point is on any visible display using `screen.getAllDisplays()`. If off-screen, omit x/y (let Electron center on primary display)

- [x] Task 3: Track and persist window state on change (AC: 1, 2)
  - [x] 3.1: Listen for `win.on('resize')` and `win.on('move')` — save current bounds (debounced, 500ms)
  - [x] 3.2: Listen for `win.on('maximize')` — set `isMaximized: true`, save
  - [x] 3.3: Listen for `win.on('unmaximize')` — set `isMaximized: false`, save
  - [x] 3.4: When saving bounds from resize/move, only save if NOT maximized (maximized bounds are the screen size, not the user's preferred size)
  - [x] 3.5: On `win.on('close')` — perform a final synchronous save of current state
  - [x] 3.6: Debounce resize/move saves to avoid excessive disk writes

- [x] Task 4: Sidebar drag-to-resize handle (AC: 3)
  - [x] 4.1: Add a resize handle element between sidebar and main content in `app-shell.html`: `<div class="ite-app-shell__resize-handle" id="sidebarResizeHandle"></div>`
  - [x] 4.2: Add CSS for resize handle in `app-shell.css`: 4px wide, `cursor: col-resize`, subtle visible indicator on hover
  - [x] 4.3: Create resize logic in `packages/desktop/src/ui/sidebar-resize.js`: mousedown on handle starts drag, mousemove updates sidebar width, mouseup ends drag
  - [x] 4.4: Clamp sidebar width to min 200px / max 400px (matching CSS min/max)
  - [x] 4.5: On drag end, send `sidebarStateChanged` command with `{ width, isVisible }`
  - [x] 4.6: Include `sidebar-resize.js` in `app-shell.html` script tags

- [x] Task 5: Sidebar visibility persistence (AC: 4)
  - [x] 5.1: The "Toggle Sidebar" menu action (Ctrl+B) is already handled in `menu-handler.js` — it toggles `.ite-app-shell__sidebar` display
  - [x] 5.2: After toggling sidebar, send `sidebarStateChanged` command with `{ width, isVisible }`
  - [x] 5.3: On app startup, main process sends `restoreAppState` event with saved sidebar state
  - [x] 5.4: Renderer applies sidebar visibility and width from the `restoreAppState` event

- [x] Task 6: Theme state persistence (AC: 5)
  - [x] 6.1: In `main.ts`, when theme changes (onSetTheme callback), save to WindowStateManager
  - [x] 6.2: On startup, restore theme from saved state: set `nativeTheme.themeSource` and `menuState.themeSource`
  - [x] 6.3: This replaces the hardcoded `themeSource: 'system'` default in menuState

- [x] Task 7: Add IPC for state communication (AC: 3, 4)
  - [x] 7.1: Add `sidebarStateChanged` to `ALLOWED_COMMANDS` in channelValidation.ts
  - [x] 7.2: Add `restoreAppState` to `ALLOWED_EVENTS` in channelValidation.ts
  - [x] 7.3: Handle `sidebarStateChanged` command in `ipc.ts` — calls a callback to update and save sidebar state
  - [x] 7.4: After window loads (`did-finish-load`), send `restoreAppState` event with saved sidebar state

- [x] Task 8: Renderer-side state restoration (AC: 3, 4)
  - [x] 8.1: In `sidebar-resize.js` or a new handler, listen for `restoreAppState` event
  - [x] 8.2: Apply `sidebar.width` by setting `sidebar.style.width = '${width}px'`
  - [x] 8.3: Apply `sidebar.isVisible` by setting `sidebar.style.display = isVisible ? '' : 'none'`
  - [x] 8.4: Ensure the resize handle position updates with the sidebar width

- [x] Task 9: Write tests (AC: all)
  - [x] 9.1: Unit tests for WindowStateManager: load (valid, missing file, corrupted JSON, out-of-range values), save, defaults
  - [x] 9.2: Unit tests for off-screen detection logic
  - [x] 9.3: Unit tests for debounce behavior
  - [x] 9.4: Unit tests for sidebarStateChanged IPC command
  - [x] 9.5: Unit tests for channel validation updates
  - [x] 9.6: Tests in `packages/desktop/src/test/`

- [x] Task 10: Validate (AC: all)
  - [x] 10.1: Run `npm run compile` — all packages compile
  - [x] 10.2: Run `npm run lint` — no new lint errors
  - [x] 10.3: Run `npm run test` — all tests pass
  - [x] 10.4: Verify packages/desktop has no `vscode` imports

## Dev Notes

### Architecture Context

The desktop app currently creates a BrowserWindow with hardcoded 1200x800 size and no state persistence. This story adds:
1. **Window bounds persistence** — position, size, maximized state
2. **Sidebar state persistence** — width (with drag-to-resize) and visibility
3. **Theme persistence** — light/dark/system preference
4. **Off-screen detection** — safety check for disconnected monitors

### Storage Pattern

Follow the existing ConnectionManager pattern:
```typescript
// packages/desktop/src/main/ConnectionManager.ts uses:
// - fs.readFileSync / fs.writeFileSync
// - JSON.parse / JSON.stringify
// - configDir from app.getPath('userData')
// - mode: 0o600 for files with sensitive data

// WindowStateManager uses same pattern but with mode 0o644 (no sensitive data)
```

File: `{userData}/window-state.json`
```json
{
  "window": {
    "x": 100,
    "y": 200,
    "width": 1200,
    "height": 800,
    "isMaximized": false
  },
  "sidebar": {
    "width": 280,
    "isVisible": true
  },
  "theme": "system"
}
```

### Off-Screen Detection

When a saved window position is off-screen (e.g., was on a now-disconnected external monitor):
```typescript
import { screen } from 'electron';

function isOnScreen(x: number, y: number, width: number, height: number): boolean {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const displays = screen.getAllDisplays();
    return displays.some(display => {
        const { x: dx, y: dy, width: dw, height: dh } = display.bounds;
        return centerX >= dx && centerX < dx + dw && centerY >= dy && centerY < dy + dh;
    });
}
```
If off-screen, omit x/y from BrowserWindow options (Electron centers on primary display).

### Window Event Debouncing

Resize and move events fire rapidly during drag. Debounce saves:
```typescript
let saveTimeout: NodeJS.Timeout | null = null;
function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        stateManager.save(currentState);
    }, 500);
}
```

On `close` event, save synchronously (no debounce) to capture final state.

### Sidebar Drag-to-Resize

Add a thin resize handle between sidebar and main content:
```
[Sidebar (280px)] [|] [Main Content (flex)]
                   ^
                   resize handle (4px, cursor: col-resize)
```

Implementation:
- `mousedown` on handle → start tracking
- `mousemove` on document → update sidebar width (clamp 200-400px)
- `mouseup` on document → stop tracking, send `sidebarStateChanged` command
- CSS: `user-select: none` during drag to prevent text selection

### Sidebar Visibility Toggle

The menu "Toggle Sidebar" (Ctrl+B) already sends a `menuAction` event handled by `menu-handler.js`. Currently it toggles inline `display: none`. For persistence:
1. After toggling, send `sidebarStateChanged` command
2. Main process saves the visibility state
3. On next launch, send `restoreAppState` event with saved state

### Theme Persistence

Already partially implemented:
- `main.ts` tracks `menuState.themeSource` (in-memory)
- Menu callbacks set `nativeTheme.themeSource`

Just need to:
1. Save to WindowStateManager when theme changes
2. Restore on startup before window creation

### IPC Flow

**Startup:**
```
main.ts loads WindowStateManager
  → Creates BrowserWindow with saved bounds
  → If maximized: win.maximize()
  → Sets nativeTheme.themeSource from saved theme
  → After did-finish-load: sendEvent('restoreAppState', { sidebar })
  → Renderer applies sidebar width and visibility
```

**Runtime:**
```
User resizes window → win.on('resize') → debounced save
User drags sidebar → sidebar-resize.js → sidebarStateChanged command → save
User toggles sidebar → menu-handler.js → sidebarStateChanged command → save
User changes theme → main.ts onSetTheme → save
User maximizes → win.on('maximize') → save
```

### Important: screen module

Electron's `screen` module must be used AFTER `app.whenReady()`. It cannot be imported at module level. Use:
```typescript
const { screen } = require('electron');
// or import inside the function that uses it, after app is ready
```

Actually, with Electron 33+ you can import `screen` normally, but only call its methods after app.whenReady().

### Previous Story Intelligence

**Story 11.1**: BrowserWindow creation (1200x800 hardcoded)
**Story 11.3**: App shell layout (sidebar 280px fixed width)
**Story 11.4**: Menu with Toggle Sidebar and Theme radio buttons
**Current test count**: 717 (241 vscode + 476 desktop)

### References

- [Source: packages/desktop/src/main/main.ts — Current window creation]
- [Source: packages/desktop/src/main/ConnectionManager.ts — fs persistence pattern]
- [Source: packages/desktop/src/ui/app-shell.css — Sidebar dimensions]
- [Source: packages/desktop/src/main/menuBuilder.ts — MenuState with themeSource]
- [Electron screen API: https://www.electronjs.org/docs/latest/api/screen]
- [Electron BrowserWindow bounds: https://www.electronjs.org/docs/latest/api/browser-window#wingetbounds]

## Dev Agent Record

### Completion Notes

All 10 tasks implemented successfully. The implementation follows the existing codebase patterns:
- WindowStateManager follows the ConnectionManager fs-based persistence pattern
- `isOnScreen` and `createDebouncedSave` are exported as standalone functions for testability without Electron runtime
- The `screen` module is imported at module level but only called after `app.whenReady()` (Electron 33+ compatible)
- Sidebar drag-to-resize uses `user-select: none` during drag and clamps to 200-400px
- The resize handle visibility is synced with sidebar visibility on toggle
- Theme is restored before window creation to avoid flash
- Final save on `close` event cancels debounced timer and saves synchronously

### Files Created
- `packages/desktop/src/main/WindowStateManager.ts` — WindowStateManager service with interfaces, load/save, validation, isOnScreen, createDebouncedSave
- `packages/desktop/src/ui/sidebar-resize.js` — Sidebar drag-to-resize handler + restoreAppState event listener
- `packages/desktop/src/test/windowStateManager.test.ts` — 56 unit tests for WindowStateManager, isOnScreen, debounce, channel validation

### Files Modified
- `packages/desktop/src/main/main.ts` — Integrated WindowStateManager: load state on startup, apply to BrowserWindow, track resize/move/maximize/unmaximize/close, persist theme changes, send restoreAppState event
- `packages/desktop/src/main/ipc.ts` — Added `sidebarStateChanged` command routing and `onSidebarStateChanged` callback to IpcCallbacks
- `packages/desktop/src/main/channelValidation.ts` — Added `sidebarStateChanged` to ALLOWED_COMMANDS, `restoreAppState` to ALLOWED_EVENTS
- `packages/desktop/src/ui/app-shell.html` — Added resize handle div and sidebar-resize.js script tag
- `packages/desktop/src/ui/app-shell.css` — Added `.ite-app-shell__resize-handle` styles (4px, col-resize cursor, hover highlight)
- `packages/desktop/src/ui/menu-handler.js` — Updated toggleSidebar to send sidebarStateChanged command and sync resize handle visibility
- `packages/desktop/src/test/channelValidation.test.ts` — Updated command/event counts (22→23, 24→25), added Story 11.5 assertions
- `packages/desktop/src/test/menuBuilder.test.ts` — Updated command/event count assertions (22→23, 24→25)

### Test Results
- **Total tests**: 773 (241 vscode + 532 desktop)
- **New tests added**: 56 (532 - 476 = 56 new desktop tests)
- **All passing**: compile, lint, and test all pass cleanly
- **No vscode imports** in packages/desktop
