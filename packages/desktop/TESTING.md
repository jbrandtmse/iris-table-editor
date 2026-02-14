# IRIS Table Editor Desktop - Manual Verification Checklist

Story 14.1: Feature Parity Verification

This document provides a comprehensive manual testing checklist for the desktop
Electron app. Each feature area includes steps to test, expected behavior,
and references to automated test coverage.

## Prerequisites

### IRIS Server Setup
- InterSystems IRIS instance accessible on the network
- A user account with SQL privileges (`%SQL`, `%Developer`, or equivalent)
- At least one namespace with user tables (e.g., `HSCUSTOM`, `USER`, `SAMPLES`)
- A test table with:
  - At least one writable column (non-identity, non-computed)
  - A primary key column (typically `ID`)
  - Multiple rows for pagination testing (50+ recommended)
  - Various data types: VARCHAR, INTEGER, DATE, BOOLEAN, etc.

### Desktop App
- Built desktop app (`npm run compile` from root, or `npx electron .` from packages/desktop)
- No IRIS server connections pre-configured (clean state) for connection tests

### Platform Notes
- **Windows**: Tested on Windows 10/11. Native menu appears in the window title bar.
- **macOS**: Native menu appears in the system menu bar (top of screen). Window controls are in the standard macOS position (top-left).
- **Linux**: Native menu behavior depends on desktop environment. Tested on Ubuntu with GNOME.

---

## Feature Checklist

### 1. Server List Display
**Description**: App loads and displays configured servers on startup.

**Steps to test**:
1. Launch the desktop app
2. Observe the sidebar (left panel)
3. If no servers configured, the empty state message should appear
4. Add a server, restart, verify it appears in the list

**Expected behavior**: Server list loads with name, hostname:port for each entry. Empty state shows guidance to add a server.

**Automated coverage**: `channelValidation.test.ts` (getServers command), `ipc.test.ts` (getServers routing), `featureParity.test.ts` (Server List feature area)

**Status**: [ ] Not tested

---

### 2. Server Connect
**Description**: Connect to an IRIS server using stored credentials.

**Steps to test**:
1. Click on a configured server in the server list
2. Click the Connect button (or double-click the server)
3. Observe the connection progress indicator
4. Wait for the connection to complete

**Expected behavior**: Progress indicator shows "Connecting...", then transitions to "Connected". Namespace list becomes available.

**Automated coverage**: `connectionLifecycle.test.ts`, `ipc.test.ts` (connectServer routing), `featureParity.test.ts` (Server Connect feature area)

**Status**: [ ] Not tested

---

### 3. Server Disconnect
**Description**: Disconnect from the currently connected server.

**Steps to test**:
1. While connected, click Disconnect (or use the connection action menu)
2. Observe the connection status change

**Expected behavior**: Status changes to "Disconnected". Namespace list clears. Grid data clears. All tabs close.

**Automated coverage**: `connectionLifecycle.test.ts`, `ipc.test.ts` (disconnectServer routing), `featureParity.test.ts` (Server Disconnect feature area)

**Status**: [ ] Not tested

---

### 4. Cancel Connection
**Description**: Cancel an in-progress connection attempt.

**Steps to test**:
1. Start connecting to a server (especially one with slow network)
2. Click the Cancel button during the connecting state

**Expected behavior**: Connection attempt is cancelled. Status returns to "Disconnected". No error message shown.

**Automated coverage**: `connectionLifecycle.test.ts`, `featureParity.test.ts` (Cancel Connection feature area)

**Status**: [ ] Not tested

---

### 5. Server Add (Save)
**Description**: Add a new server configuration through the server form.

**Steps to test**:
1. Click the "Add Server" button
2. Fill in: Name, Hostname, Port, Username, Password
3. Optionally set SSL and Path Prefix
4. Click Save

**Expected behavior**: Server appears in the list. Configuration is persisted to disk. Password is encrypted.

**Automated coverage**: `serverForm.test.ts`, `connectionManager.test.ts`, `ipc.test.ts` (saveServer routing), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 6. Server Edit (Update)
**Description**: Edit an existing server configuration.

**Steps to test**:
1. Right-click a server (or click the edit icon)
2. Modify fields (e.g., change port or description)
3. Leave password blank to keep existing
4. Click Save

**Expected behavior**: Server config updates. Leaving password blank preserves existing encrypted password.

**Automated coverage**: `serverForm.test.ts`, `connectionManager.test.ts`, `ipc.test.ts` (updateServer routing), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 7. Server Delete
**Description**: Delete a server configuration.

**Steps to test**:
1. Right-click a server (or click the delete icon)
2. Confirm deletion

**Expected behavior**: Server removed from list and from disk storage.

**Automated coverage**: `connectionManager.test.ts`, `ipc.test.ts` (deleteServer routing), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 8. Test Connection
**Description**: Test connection with unsaved form values.

**Steps to test**:
1. Open Add/Edit server form
2. Enter connection details
3. Click "Test Connection"

**Expected behavior**: Shows "Testing..." state, then success or failure message with details.

**Automated coverage**: `testConnection.test.ts`, `ipc.test.ts` (testFormConnection routing), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 9. Credential Storage
**Description**: Passwords are encrypted at rest using the OS keychain or fallback encryption.

**Steps to test**:
1. Add a server with a password
2. Check the config file on disk (should not contain plaintext password)
3. If OS keychain is unavailable, verify the credential warning appears

**Expected behavior**: Passwords are encrypted in config. If safeStorage unavailable, a warning banner appears.

**Automated coverage**: `credentialStore.test.ts`, `featureParity.test.ts` (Credential Warning feature area)

**Status**: [ ] Not tested

---

### 10. Get Namespaces
**Description**: After connecting, namespaces load in the sidebar tree.

**Steps to test**:
1. Connect to a server
2. Observe the namespace tree in the sidebar

**Expected behavior**: Namespaces appear as expandable tree nodes (e.g., HSCUSTOM, USER, %SYS).

**Automated coverage**: `ipcDataCommands.test.ts` (getNamespaces), `sessionManager.test.ts`, `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 11. Get Tables
**Description**: Expanding a namespace loads its tables.

**Steps to test**:
1. Click to expand a namespace node
2. Observe the table list loading

**Expected behavior**: Tables appear under the namespace node. Loading spinner during fetch.

**Automated coverage**: `ipcDataCommands.test.ts` (getTables), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 12. Select Table (Schema + Data)
**Description**: Clicking a table opens it in a grid tab with schema and data.

**Steps to test**:
1. Click a table name in the namespace tree
2. Observe the grid panel opening with data

**Expected behavior**: A tab opens with the table name. Column headers show schema info. First page of data loads.

**Automated coverage**: `ipcDataCommands.test.ts` (selectTable), `tabBar.test.ts`, `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 13. Request Data (Load)
**Description**: Grid loads table data with proper pagination.

**Steps to test**:
1. Open a table with 50+ rows
2. Verify first page shows rows 1-50 (or configured page size)
3. Verify pagination info shows correct total count

**Expected behavior**: Data loads in grid cells. Pagination shows "Rows 1-50 of N". Column headers match schema.

**Automated coverage**: `ipcDataCommands.test.ts` (requestData), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 14. Refresh Data
**Description**: Refresh button reloads current table data.

**Steps to test**:
1. Open a table
2. Make a change via another client (IRIS Terminal, SMP)
3. Click the Refresh button (or Ctrl+R)

**Expected behavior**: Data reloads from server. Any external changes are reflected. Current filters and sort are preserved.

**Automated coverage**: `ipcDataCommands.test.ts` (refresh), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 15. Pagination (Next/Previous)
**Description**: Navigate between pages of table data.

**Steps to test**:
1. Open a table with 100+ rows
2. Click Next page button
3. Verify page 2 data loads
4. Click Previous page button
5. Verify page 1 data loads
6. Use First/Last page buttons

**Expected behavior**: Pages load correctly. Pagination info updates. Navigation buttons disable at boundaries.

**Automated coverage**: `ipcDataCommands.test.ts` (paginateNext, paginatePrev), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 16. Cell Editing (Save Cell)
**Description**: Edit a cell value inline and save to the database.

**Steps to test**:
1. Double-click (or press F2) on a writable cell
2. Change the value
3. Press Enter to save (or Tab to save and move)
4. Press Escape to cancel editing

**Expected behavior**: Cell enters edit mode. On save, value persists to database. Toast notification shows success/failure. On cancel, original value restores.

**Automated coverage**: `ipcDataCommands.test.ts` (saveCell), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 17. Insert Row
**Description**: Add a new row to the table.

**Steps to test**:
1. Click the Add Row button (or Ctrl+N)
2. Fill in values for required columns
3. Click Save Row button (or Ctrl+S)

**Expected behavior**: New row appears at the bottom of the grid (highlighted). Save persists to database. Refresh shows the new row in server data.

**Automated coverage**: `ipcDataCommands.test.ts` (insertRow), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 18. Delete Row
**Description**: Delete a row from the table.

**Steps to test**:
1. Click on a row to select it
2. Click the Delete button (or press Delete key)
3. Confirm the deletion in the dialog

**Expected behavior**: Confirmation dialog appears. On confirm, row is deleted from the database and removed from the grid. Toast notification shows success.

**Automated coverage**: `ipcDataCommands.test.ts` (deleteRow), `featureParity.test.ts`

**Status**: [ ] Not tested

---

### 19. Column Filtering
**Description**: Filter table data by column values.

**Steps to test**:
1. Type a value in the filter input below a column header
2. Wait for the debounced filter to apply
3. Verify filtered results appear
4. Clear the filter and verify all data returns
5. Toggle filters on/off with the filter toggle button

**Expected behavior**: Grid updates with filtered results. Pagination adjusts to filtered row count. Filter badge shows count.

**Automated coverage**: Shared grid.js code (same for both targets). Filter criteria sent via requestData/refresh commands.

**Status**: [ ] Not tested

---

### 20. Column Sorting
**Description**: Sort table data by clicking column headers.

**Steps to test**:
1. Click a column header to sort ascending
2. Click again to sort descending
3. Click again to clear sort

**Expected behavior**: Sort indicator shows arrow direction. Data reloads sorted. Sort persists across pagination.

**Automated coverage**: Shared grid.js code. Sort params sent via requestData/refresh commands.

**Status**: [ ] Not tested

---

### 21. Tab Bar (Multi-Table)
**Description**: Open multiple tables in tabs.

**Steps to test**:
1. Open a table (tab appears)
2. Open a second table (second tab appears)
3. Switch between tabs by clicking
4. Close a tab with the X button
5. Verify grid state restores when switching tabs

**Expected behavior**: Each tab shows its table name. Switching restores that table's data, filters, sort, and scroll position. Closing a tab removes it.

**Automated coverage**: `tabBar.test.ts`, `featureParity.test.ts` (Tab Switching feature area)

**Status**: [ ] Not tested

---

### 22. Native Menu
**Description**: Desktop native menu bar with table operations.

**Steps to test**:
1. Verify menu bar has: File, Edit, View, Help menus
2. With a table open, verify Edit menu has: Set Null, Delete Row
3. Verify View menu has: Toggle Filter Panel, Toggle Sidebar
4. Verify Help menu has: Keyboard Shortcuts
5. Test each menu action

**Expected behavior**: Menu items work correctly. Items that require a table selection are disabled when no table is open. Keyboard shortcuts work (Ctrl+N, Ctrl+S, etc.).

**Automated coverage**: `menuBuilder.test.ts`, `featureParity.test.ts` (Native Menu feature area)

**Status**: [ ] Not tested

---

### 23. Window State Persistence
**Description**: Window position, size, and sidebar width persist across restarts.

**Steps to test**:
1. Resize the window
2. Move it to a specific position
3. Resize the sidebar
4. Close and reopen the app
5. Verify window state restores

**Expected behavior**: Window opens at the saved position and size. Sidebar width restores. Maximized state restores.

**Automated coverage**: `windowStateManager.test.ts`, `featureParity.test.ts` (State Persistence feature area)

**Status**: [ ] Not tested

---

### 24. Theme Support
**Description**: App respects OS dark/light theme.

**Steps to test**:
1. Set OS to light theme, verify app uses light colors
2. Set OS to dark theme, verify app uses dark colors
3. Switch theme while app is running

**Expected behavior**: Grid, sidebar, toolbar, and dialog colors update to match OS theme. No flickering or unstyled elements.

**Automated coverage**: Theme CSS shared from @iris-te/webview. Desktop uses desktopThemeBridge.js + nativeTheme.

**Status**: [ ] Not tested

---

## Known Limitations (VS Code-Only Features)

The following features are available in the VS Code extension but **not yet** in the desktop app. These are intentional architectural gaps documented in Story 14.1.

### Export Data (CSV/Excel)
- **VS Code commands**: `exportAllCsv`, `exportCurrentPageExcel`, `exportAllExcel`
- **VS Code events**: `exportProgress`, `exportResult`
- **Reason**: Uses VS Code `showSaveDialog` and `workspace.fs` APIs
- **Future**: Will be implemented with Electron `dialog.showSaveDialog` in a future story

### Import Data (CSV/Excel)
- **VS Code commands**: `importSelectFile`, `importValidate`, `importExecute`, `cancelOperation`
- **VS Code events**: `importPreview`, `importProgress`, `importResult`, `importValidationResult`
- **Reason**: Uses VS Code `showOpenDialog` and `workspace.fs` APIs
- **Future**: Will be implemented with Electron `dialog.showOpenDialog` in a future story

### Server Manager Integration
- **VS Code**: Uses `@intersystems-community/intersystems-servermanager` extension for server discovery and `vscode.authentication` for credential management
- **Desktop**: Has its own `ConnectionManager` with encrypted local storage via Electron `safeStorage`
- **This is an intentional architectural difference**, not a missing feature

### WebviewViewProvider Sidebar
- **VS Code**: Uses `WebviewViewProvider` to display the connection sidebar in VS Code's sidebar panel
- **Desktop**: Uses its own `server-list.js` + `server-form.js` in the app shell sidebar
- **This is an intentional architectural difference**

### VS Code Theme Variables
- **VS Code**: Inherits CSS variables from VS Code (e.g., `--vscode-editor-background`)
- **Desktop**: Uses `nativeTheme` + `desktopThemeBridge.js` to map OS theme to CSS variables
- **Both share the same base `theme.css`** from `@iris-te/webview`

---

## Cross-Platform Testing (Story 14.2)

The following sections cover platform-specific manual testing for Windows and macOS.
Automated cross-platform verification tests are in `crossPlatform.test.ts`.

---

### Windows-Specific Tests

#### W1. Windows Installer (NSIS)

**Description**: Verify the NSIS installer works correctly on Windows.

**Steps to test**:
1. Build the Windows installer: `npx electron-builder --win` (from packages/desktop)
2. Run the generated `.exe` installer from `release/`
3. Verify the installer shows installation directory selection (not one-click)
4. Choose a custom installation directory and proceed
5. Verify the app installs and launches

**Expected behavior**: Installer allows directory selection, installs app, creates desktop shortcut and Start Menu entry.

**Config reference**: `electron-builder.yml` nsis section: `oneClick: false`, `allowToChangeInstallationDirectory: true`, `createDesktopShortcut: true`, `createStartMenuShortcut: true`

**Status**: [ ] Not tested

---

#### W2. Windows Desktop Shortcut

**Description**: Desktop shortcut is created during installation.

**Steps to test**:
1. After installing, check the Windows Desktop for an "IRIS Table Editor" shortcut
2. Double-click the shortcut to launch the app

**Expected behavior**: Shortcut exists with correct name and icon (icon.ico). App launches from shortcut.

**Status**: [ ] Not tested

---

#### W3. Windows Start Menu Shortcut

**Description**: Start Menu shortcut is created during installation.

**Steps to test**:
1. Open the Windows Start Menu
2. Search for "IRIS Table Editor"
3. Click to launch

**Expected behavior**: App appears in Start Menu with correct name and icon.

**Status**: [ ] Not tested

---

#### W4. Windows Menu Bar Position

**Description**: Native menu appears in the window title bar area.

**Steps to test**:
1. Launch the app on Windows
2. Observe the menu bar position

**Expected behavior**: File, Edit, View, Help menus appear at the top of the application window, within the window chrome (not in a system-level menu bar).

**Status**: [ ] Not tested

---

#### W5. Windows Keyboard Shortcuts

**Description**: Verify Ctrl-based shortcuts work on Windows.

**Steps to test**:
1. Open a table
2. Test: Ctrl+N (new row), Ctrl+S (save), Ctrl+W (close tab)
3. Test: Ctrl+B (toggle sidebar), Ctrl+Shift+N (set null)
4. Test: Ctrl+R (refresh), Ctrl+F (filter), Ctrl+G (go to row)
5. Test: Ctrl+Z (undo in edit mode), Ctrl+D (duplicate row)
6. Test: F5 (refresh), F1 (shortcuts help)

**Expected behavior**: All Ctrl-based shortcuts trigger the expected action. Menu items display "Ctrl+..." in accelerator text.

**Status**: [ ] Not tested

---

#### W6. Windows Credential Storage

**Description**: Passwords are encrypted using Node.js crypto (AES-256-GCM).

**Steps to test**:
1. Add a server with a password
2. Navigate to `%APPDATA%/IRIS Table Editor/` and inspect the config file
3. Verify password value is base64-encoded (not plaintext)

**Expected behavior**: Password stored as encrypted base64 string. App can decrypt and connect successfully.

**Status**: [ ] Not tested

---

#### W7. Windows Auto-Update

**Description**: Auto-update checks GitHub Releases for new versions.

**Steps to test**:
1. Launch the app (auto-update check happens on startup)
2. Go to Help > Check for Updates...
3. Observe the update check behavior

**Expected behavior**: If no update available, shows "You are up to date" dialog. If update available, downloads in background and prompts restart. Update metadata uses `latest.yml`.

**Status**: [ ] Not tested

---

### macOS-Specific Tests

#### M1. macOS Installer (DMG)

**Description**: Verify the DMG installer works correctly on macOS.

**Steps to test**:
1. Build the macOS installer: `npx electron-builder --mac` (from packages/desktop)
2. Open the generated `.dmg` file from `release/`
3. Verify the DMG window shows the app icon and an Applications folder link
4. Drag the app to Applications
5. Launch from Applications

**Expected behavior**: DMG opens with app icon and Applications alias. Drag-to-install works. App launches from Applications.

**Config reference**: `electron-builder.yml` dmg section has `contents` with app position and `/Applications` link

**Status**: [ ] Not tested

---

#### M2. macOS Application Category

**Description**: App is categorized as a developer tool in macOS.

**Steps to test**:
1. After installing, right-click the app in Applications > Get Info
2. Check the "Kind" field

**Expected behavior**: App is categorized under Developer Tools (`public.app-category.developer-tools`).

**Status**: [ ] Not tested

---

#### M3. macOS System Menu Bar

**Description**: Native menu appears in the macOS system menu bar.

**Steps to test**:
1. Launch the app on macOS
2. Observe the system menu bar at the top of the screen

**Expected behavior**: Menu bar shows: IRIS Table Editor (app menu), File, Edit, View, Help in the macOS system menu bar (not in the window).

**Status**: [ ] Not tested

---

#### M4. macOS Dock Behavior

**Description**: Clicking the dock icon recreates the window if all windows are closed.

**Steps to test**:
1. Launch the app
2. Close all windows (Cmd+W or close button)
3. Click the dock icon

**Expected behavior**: A new window is created. Current MVP behavior: app quits when all windows close (future improvement: keep alive in dock on macOS). If window was already closed and app is still running, dock click recreates it.

**Note**: Current implementation calls `app.quit()` on `window-all-closed` for all platforms (MVP). The `activate` handler exists for future macOS-specific behavior.

**Status**: [ ] Not tested

---

#### M5. macOS Keyboard Shortcuts (Cmd)

**Description**: Verify Cmd-based shortcuts work on macOS.

**Steps to test**:
1. Open a table
2. Test: Cmd+N (new row), Cmd+S (save), Cmd+W (close tab)
3. Test: Cmd+B (toggle sidebar), Cmd+Shift+N (set null via menu)
4. Test: Cmd+R (refresh), Cmd+F (filter), Cmd+G (go to row)
5. Test: Cmd+Z (undo in edit mode), Cmd+D (duplicate row)
6. Test: F5 (refresh), F1 (shortcuts help)

**Expected behavior**: All Cmd-based shortcuts trigger the expected action. Menu items display the Cmd symbol in accelerator text.

**Known gap**: The grid-level Ctrl+Shift+N handler (`handleCellKeydown`) checks `event.ctrlKey` only, not `event.metaKey`. However, the native menu accelerator `CommandOrControl+Shift+N` provides macOS coverage through the menu system.

**Status**: [ ] Not tested

---

#### M6. macOS Credential Storage

**Description**: Passwords are encrypted using Node.js crypto (AES-256-GCM).

**Steps to test**:
1. Add a server with a password
2. Navigate to `~/Library/Application Support/IRIS Table Editor/` and inspect the config file
3. Verify password value is base64-encoded (not plaintext)

**Expected behavior**: Password stored as encrypted base64 string. App can decrypt and connect successfully.

**Note**: Current implementation uses `NodeCryptoCredentialStore` (Node.js crypto), not macOS Keychain/safeStorage. This is a cross-platform solution that works on all platforms.

**Status**: [ ] Not tested

---

#### M7. macOS Auto-Update

**Description**: Auto-update checks GitHub Releases for new versions.

**Steps to test**:
1. Launch the app (auto-update check happens on startup)
2. Go to Help > Check for Updates...
3. Observe the update check behavior

**Expected behavior**: If no update available, shows "You are up to date" dialog. If update available, downloads in background and prompts restart. Update metadata uses `latest-mac.yml`.

**Status**: [ ] Not tested

---

### Keyboard Shortcut Cross-Platform Verification Table

The following table maps each keyboard shortcut to its Windows and macOS equivalents.
All menu accelerators use `CommandOrControl` which maps to Ctrl on Windows and Cmd on macOS.
Grid.js keyboard handlers use `(event.ctrlKey || event.metaKey)` for cross-platform support.

| Action | Windows | macOS | Source | Cross-Platform |
|---|---|---|---|---|
| Close Tab | Ctrl+W | Cmd+W | Menu accelerator | Yes (CommandOrControl) |
| Close All Tabs | Ctrl+Shift+W | Cmd+Shift+W | Menu accelerator | Yes (CommandOrControl) |
| Set NULL | Ctrl+Shift+N | Cmd+Shift+N | Menu accelerator + grid.js | Partial (menu: yes, grid handler: ctrlKey only) |
| Toggle Sidebar | Ctrl+B | Cmd+B | Menu accelerator | Yes (CommandOrControl) |
| Keyboard Shortcuts | Ctrl+/ | Cmd+/ | Menu accelerator | Yes (CommandOrControl) |
| New Row | Ctrl+N | Cmd+N | grid.js handler | Yes (ctrlKey or metaKey) |
| Save Row | Ctrl+S | Cmd+S | grid.js handler | Yes (ctrlKey or metaKey) |
| Duplicate Row | Ctrl+D | Cmd+D | grid.js handler | Yes (ctrlKey or metaKey) |
| Delete Row | Ctrl+- | Cmd+- | grid.js handler | Yes (ctrlKey or metaKey) |
| New Row (Alt) | Ctrl+Shift+= | Cmd+Shift+= | grid.js handler | Yes (ctrlKey or metaKey) |
| Refresh | Ctrl+R / F5 | Cmd+R / F5 | grid.js handler | Yes (ctrlKey or metaKey) |
| Filter Column | Ctrl+F | Cmd+F | grid.js handler | Yes (ctrlKey or metaKey) |
| Clear All Filters | Ctrl+Shift+F | Cmd+Shift+F | grid.js handler | Yes (ctrlKey or metaKey) |
| Go to Row | Ctrl+G | Cmd+G | grid.js handler | Yes (ctrlKey or metaKey) |
| Export Menu | Ctrl+E | Cmd+E | grid.js handler | Yes (ctrlKey or metaKey) |
| Undo (edit mode) | Ctrl+Z | Cmd+Z | grid.js handler | Yes (ctrlKey or metaKey) |
| Save & Stay (edit) | Ctrl+Enter | Cmd+Enter | grid.js handler | Yes (ctrlKey or metaKey) |
| Next Page | Ctrl+PageDown | Alt+Right | grid.js handler | Yes (dual binding) |
| Previous Page | Ctrl+PageUp | Alt+Left | grid.js handler | Yes (dual binding) |
| Ctrl+Home/End | Ctrl+Home | Ctrl+Home | grid.js handler | Windows-centric (no Cmd equiv) |
| Help / Shortcuts | F1 / ? | F1 / ? | grid.js handler | Yes (no modifier needed) |

---

### Auto-Update Manual Verification

#### AU1. Background Update Check (Both Platforms)

**Steps to test**:
1. Build a version with a lower version number than the latest GitHub Release
2. Launch the app
3. Observe the console output for update check messages

**Expected behavior**: App logs "Checking for update..." then either "Update available: vX.Y.Z" (downloads automatically) or "No update available". No user-facing dialog on background check unless update is downloaded.

**Status**: [ ] Not tested

---

#### AU2. Interactive Update Check (Both Platforms)

**Steps to test**:
1. Launch the app
2. Go to Help > Check for Updates...
3. If already up to date, verify "You are up to date" dialog appears
4. If update available, verify it downloads and shows restart prompt

**Expected behavior**: Interactive check shows feedback dialog. "You are up to date" shows current version. Update downloaded shows "Restart Now" / "Later" buttons.

**Status**: [ ] Not tested

---

#### AU3. Update Download and Install (Both Platforms)

**Steps to test**:
1. Ensure a newer version is published as a GitHub Release
2. Launch the older version
3. Wait for auto-download to complete
4. Verify the restart dialog appears
5. Click "Restart Now" to apply the update
6. After restart, verify the app version has updated (Help > About)

**Expected behavior**: Update downloads in background. Restart applies the update. New version visible in About dialog.

**Status**: [ ] Not tested

---

#### AU4. Update Error Handling (Both Platforms)

**Steps to test**:
1. Disconnect from the internet
2. Go to Help > Check for Updates...
3. Observe the behavior

**Expected behavior**: Error is logged silently. No crash or error dialog. App continues to function normally.

**Status**: [ ] Not tested

---

### Cross-Platform Known Gaps

The following items are documented cross-platform gaps discovered during the Story 14.2 audit:

1. **handleCellKeydown Ctrl+Shift+N (Set NULL)**: The grid-level keyboard handler at `grid.js` line ~3386 checks `event.ctrlKey` only, not `event.metaKey`. On macOS, this shortcut only works via the native menu (which uses `CommandOrControl+Shift+N`). The grid-level handler will not fire when pressing Cmd+Shift+N directly in the grid. Severity: Low (menu provides coverage).

2. **Home/End + Ctrl navigation**: The `handleCellKeydown` Home/End handlers check `event.ctrlKey` only. macOS keyboards do not typically have Home/End keys, so this is a non-issue in practice.

3. **window-all-closed quits on macOS**: Current MVP implementation calls `app.quit()` on all platforms. macOS convention is to keep the app alive in the dock when all windows close. The `activate` handler exists to recreate windows, but since the app quits immediately, it never fires. This is documented as an MVP trade-off.

4. **Credential storage uses Node.js crypto**: The app uses `NodeCryptoCredentialStore` (AES-256-GCM) instead of Electron's `safeStorage` (which wraps OS keychain). This works cross-platform but does not provide OS-level keychain integration. This is an intentional architectural decision for the current phase.
