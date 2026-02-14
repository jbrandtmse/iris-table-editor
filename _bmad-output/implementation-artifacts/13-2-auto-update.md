# Story 13.2: Auto-Update

Status: done

## Story

As a **user**,
I want **the application to automatically check for and install updates**,
so that **I always have the latest features and fixes without manual downloads**.

## Acceptance Criteria

1. **Given** the app uses electron-updater, **When** the app launches, **Then** it checks for updates from GitHub Releases in the background **And** the update check does not block app startup

2. **Given** an update is available, **When** the check completes, **Then** I see a non-intrusive notification: "Update available (v1.2.0). Restart to update." **And** I can choose to "Restart Now" or "Later"

3. **Given** I click "Restart Now", **When** the update installs, **Then** the app closes, installs the update, and restarts **And** I see the new version running

4. **Given** I click "Later", **When** the app continues, **Then** the update is downloaded in the background **And** it installs automatically on next app close/restart

5. **Given** there is no update available, **When** the check completes, **Then** no notification is shown **And** the app continues normally

6. **Given** the update check fails (no internet, server down), **When** the check times out, **Then** no error is shown to the user **And** the app continues normally **And** the next check occurs on next launch

## Tasks / Subtasks

- [x] Task 1: Add electron-updater dependency (AC: 1)
  - [x] 1.1: Add `electron-updater` as a production dependency in `packages/desktop/package.json` (it runs in the main process at runtime)
  - [x] 1.2: Run `npm install` to update package-lock.json
  - [x] 1.3: Update `packages/desktop/scripts/stage-assets.js` to stage `electron-updater` and its transitive dependencies into `app-dist` — electron-updater must be available at runtime in the packaged app

- [x] Task 2: Configure publish provider in electron-builder.yml (AC: 1)
  - [x] 2.1: Add `publish` section to `packages/desktop/electron-builder.yml`:
    ```yaml
    publish:
      provider: github
      owner: jbrandtmse
      repo: iris-table-editor
    ```
  - [x] 2.2: This tells electron-updater where to check for releases (GitHub Releases API)

- [x] Task 3: Create AutoUpdateManager service (AC: 1, 2, 3, 4, 5, 6)
  - [x] 3.1: Create `packages/desktop/src/main/AutoUpdateManager.ts`
  - [x] 3.2: Import `autoUpdater` from `electron-updater` — use conditional import so tests can run without electron-updater installed
  - [x] 3.3: `AutoUpdateManager` class with constructor taking `{ win: BrowserWindow, logger?: { info: Function, error: Function } }`
  - [x] 3.4: `initialize()` method: configure autoUpdater settings:
    - `autoUpdater.autoDownload = true` (download automatically when available)
    - `autoUpdater.autoInstallOnAppQuit = true` (install on quit if "Later" chosen)
    - `autoUpdater.logger = logger` (use provided logger or default console)
  - [x] 3.5: Register event handlers in `initialize()`:
    - `checking-for-update`: log only
    - `update-available`: log version info, update is being downloaded automatically
    - `update-not-available`: log only, no user notification (AC: 5)
    - `download-progress`: log progress percentage
    - `update-downloaded`: show dialog with "Restart Now" / "Later" buttons (AC: 2)
    - `error`: log error, no user notification (AC: 6)
  - [x] 3.6: `checkForUpdates()` method: calls `autoUpdater.checkForUpdates()` wrapped in try/catch (silent failures per AC: 6)
  - [x] 3.7: `checkForUpdatesInteractive()` method: same as checkForUpdates but shows "No updates available" dialog if update-not-available fires (for manual "Check for Updates" menu item)
  - [x] 3.8: On `update-downloaded`: use `dialog.showMessageBox()` with buttons `['Restart Now', 'Later']`
    - "Restart Now" (index 0): call `autoUpdater.quitAndInstall()`
    - "Later" (index 1): do nothing — `autoInstallOnAppQuit` handles it
  - [x] 3.9: Guard against showing dialog on destroyed window (same pattern as onShowAbout)

- [x] Task 4: Integrate AutoUpdateManager in main.ts (AC: 1)
  - [x] 4.1: Import AutoUpdateManager in main.ts
  - [x] 4.2: After window creation and `did-finish-load`, instantiate AutoUpdateManager with the window reference
  - [x] 4.3: Call `autoUpdateManager.checkForUpdates()` — this is a non-blocking background check
  - [x] 4.4: Store reference for menu callback use

- [x] Task 5: Add "Check for Updates" menu item (AC: 2)
  - [x] 5.1: Add `onCheckForUpdates` callback to `MenuCallbacks` interface in `menuBuilder.ts`
  - [x] 5.2: Add "Check for Updates..." menu item to Help submenu (before "About IRIS Table Editor"), with a separator before "About"
  - [x] 5.3: Wire callback in main.ts to call `autoUpdateManager.checkForUpdatesInteractive()`

- [x] Task 6: Update stage-assets.js for electron-updater (AC: 1)
  - [x] 6.1: electron-updater is a runtime dependency — it must be in the staged `node_modules/` of `app-dist`
  - [x] 6.2: Add logic to stage-assets.js to copy `node_modules/electron-updater/` (and its transitive deps) into `app-dist/desktop/node_modules/` (or wherever the staged package.json resolves from)
  - [x] 6.3: Alternative approach: add electron-updater to the staged package.json's dependencies and let electron-builder's `npm install --production` handle it during build. Check if electron-builder does this automatically when `directories.app` points to a directory with its own package.json.
  - [x] 6.4: Update staged package.json to include `electron-updater` in dependencies

- [x] Task 7: Write tests (AC: all)
  - [x] 7.1: Unit tests for AutoUpdateManager:
    - Constructor stores window reference
    - initialize() configures autoUpdater settings
    - checkForUpdates() calls autoUpdater.checkForUpdates()
    - checkForUpdates() handles errors silently
    - checkForUpdatesInteractive() shows dialog when no update available
    - update-downloaded handler shows dialog with correct buttons
    - "Restart Now" calls quitAndInstall
    - "Later" does nothing (autoInstallOnAppQuit handles it)
    - Destroyed window guard
  - [x] 7.2: Test for menuBuilder: verify Help menu has "Check for Updates..." item
  - [x] 7.3: Tests in `packages/desktop/src/test/`
  - [x] 7.4: Mock autoUpdater with EventEmitter pattern for testability

- [x] Task 8: Validate (AC: all)
  - [x] 8.1: Run `npm run compile` — all packages compile
  - [x] 8.2: Run `npm run lint` — no new lint errors
  - [x] 8.3: Run `npm run test` — all tests pass
  - [x] 8.4: Run `npm run pack --workspace=packages/desktop` — unpacked build succeeds
  - [x] 8.5: Verify packages/desktop has no `vscode` imports

## Dev Agent Record

### Completion Notes

All 8 tasks implemented successfully. The AutoUpdateManager service wraps electron-updater's autoUpdater singleton with a testable design that accepts an injected mock EventEmitter in the constructor. Key implementation decisions:

- **Conditional import**: `require('electron-updater')` is wrapped in try/catch so tests work without the Electron runtime. When a mock updater is provided via the constructor, the real import is skipped entirely.
- **Interactive vs background mode**: The `isInteractive` flag distinguishes menu-triggered checks (which show a "You are up to date" dialog) from silent startup checks.
- **Event handler cleanup**: All event handlers are tracked in an array and removed on `dispose()` to prevent memory leaks.
- **Staging approach**: Used Option 2 (add to staged package.json dependencies) -- electron-builder handles `npm install --production` in the app-dist directory during build. No manual node_modules copying needed.
- **Type safety**: Event handlers use `(...args: unknown[])` signatures with internal casts to avoid TypeScript errors while maintaining clean external API.

### Test Results

- `npm run compile`: PASS (all 3 workspaces)
- `npm run lint`: PASS (0 errors, 0 warnings)
- `npm run test`: PASS (241 vscode + 591 desktop = 832 total, up from 800)
- No vscode imports in packages/desktop

32 new tests added covering:
- Constructor and initialization (4 tests)
- checkForUpdates and checkForUpdatesInteractive (5 tests)
- Event handlers: checking-for-update, update-available, update-not-available, download-progress, error (8 tests)
- update-downloaded with destroyed window guard (3 tests)
- Dispose cleanup (2 tests)
- Interactive mode dialog behavior (2 tests)
- "Restart Now" vs "Later" behavior (1 test)
- Menu builder structure (4 tests)
- stage-assets.js electron-updater in dependencies (2 tests)
- electron-builder.yml publish config (1 test)

### Files Created

- `packages/desktop/src/main/AutoUpdateManager.ts` — Core auto-update service
- `packages/desktop/src/test/autoUpdateManager.test.ts` — 32 unit tests

### Files Modified

- `packages/desktop/package.json` — Added `electron-updater` production dependency
- `packages/desktop/electron-builder.yml` — Added `publish` section (github provider)
- `packages/desktop/src/main/main.ts` — Import AutoUpdateManager, initialize after did-finish-load, wire menu callback
- `packages/desktop/src/main/menuBuilder.ts` — Added `onCheckForUpdates` to MenuCallbacks, added "Check for Updates..." menu item in Help submenu
- `packages/desktop/scripts/stage-assets.js` — Added `electron-updater` to staged package.json dependencies
- `package-lock.json` — Updated by npm install

## Dev Notes

### Architecture Context

Auto-update uses `electron-updater` (from electron-builder ecosystem) to check GitHub Releases for new versions. The flow:

1. App starts -> `autoUpdater.checkForUpdates()` (background, non-blocking)
2. If update available -> downloaded automatically (autoDownload: true)
3. After download -> dialog: "Restart Now" / "Later"
4. "Restart Now" -> `autoUpdater.quitAndInstall()`
5. "Later" -> installs on next quit (`autoInstallOnAppQuit: true`)

### electron-updater Events

```
checking-for-update -> update-available -> download-progress -> update-downloaded
                    -> update-not-available
                    -> error
```

### Code Signing Requirement

**Important:** Auto-update requires code-signed installers on macOS (notarized .dmg) and is recommended on Windows (signed .exe). Without signing:
- macOS: auto-update will fail (Gatekeeper blocks unsigned updates)
- Windows: auto-update works but SmartScreen may warn

Since Story 13.4 (Code Signing) is optional, the auto-update code should handle the unsigned case gracefully -- log the error, don't crash, don't show error to user.

### Testing Strategy

Since `electron-updater`'s `autoUpdater` is a singleton with Electron runtime dependencies, tests should:
1. Mock `autoUpdater` as an EventEmitter with stub methods
2. Verify event handler registration and behavior
3. Mock `dialog.showMessageBox` to test button responses
4. Never actually call real update check in tests

### Staging Considerations

electron-updater is a runtime dependency (runs in main process). Two approaches:
1. **Manual staging**: Copy electron-updater and its deps into app-dist/node_modules/
2. **Let electron-builder handle it**: Add electron-updater to staged package.json dependencies, and electron-builder will run `npm install --production` in the app-dist directory

Option 2 is cleaner -- electron-builder handles dependency resolution. The stage-assets script just needs to add electron-updater to the staged package.json's dependencies.

### Previous Story Intelligence

**Story 13.1**: electron-builder.yml, stage-assets.js, build-resources, npm scripts
**Story 11.4**: menuBuilder.ts with MenuCallbacks and MenuState interfaces
**Current test count**: 832 (241 vscode + 591 desktop)

### References

- [electron-updater docs: https://www.electron.build/auto-update.html]
- [Source: packages/desktop/src/main/menuBuilder.ts -- Menu structure]
- [Source: packages/desktop/src/main/main.ts -- App initialization]
- [Source: packages/desktop/electron-builder.yml -- Current build config]
- [Source: packages/desktop/scripts/stage-assets.js -- Asset staging]
