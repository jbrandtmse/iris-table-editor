/**
 * Desktop Polish Verification Tests
 * Story 14.3: Desktop Polish
 *
 * Verifies that polish features are correctly implemented by reading
 * actual source files and confirming required patterns exist. Tests cover:
 *
 * - Task 1: App icon configuration (electron-builder.yml, build-resources, BrowserWindow)
 * - Task 2: About dialog completeness (app name, version, description)
 * - Task 3: First-run welcome experience (sidebar welcome, main content placeholder)
 * - Task 4: Memory leak prevention patterns (dispose, cleanup, removeListener)
 * - Task 5: Theme toggle infrastructure (nativeTheme, CSS variables, desktopThemeBridge)
 * - Task 6: Error handling patterns (IPC error responses, ErrorHandler, grid error display)
 *
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Resolve paths
// ============================================

const desktopDir = path.resolve(__dirname, '../..');
const rootDir = path.resolve(desktopDir, '../..');

const electronBuilderPath = path.join(desktopDir, 'electron-builder.yml');
const mainTsPath = path.join(desktopDir, 'src', 'main', 'main.ts');
const menuBuilderPath = path.join(desktopDir, 'src', 'main', 'menuBuilder.ts');
const autoUpdatePath = path.join(desktopDir, 'src', 'main', 'AutoUpdateManager.ts');
const windowStatePath = path.join(desktopDir, 'src', 'main', 'WindowStateManager.ts');
const ipcPath = path.join(desktopDir, 'src', 'main', 'ipc.ts');
const serverListJsPath = path.join(desktopDir, 'src', 'ui', 'connection', 'server-list.js');
const serverListCssPath = path.join(desktopDir, 'src', 'ui', 'connection', 'server-list.css');
const tabBarJsPath = path.join(desktopDir, 'src', 'ui', 'tabs', 'tab-bar.js');
const sidebarResizePath = path.join(desktopDir, 'src', 'ui', 'sidebar-resize.js');
const appShellHtmlPath = path.join(desktopDir, 'src', 'ui', 'app-shell.html');
const appShellCssPath = path.join(desktopDir, 'src', 'ui', 'app-shell.css');
const themeBridgePath = path.join(rootDir, 'packages', 'webview', 'src', 'desktopThemeBridge.css');
const errorHandlerPath = path.join(rootDir, 'packages', 'core', 'src', 'utils', 'ErrorHandler.ts');
const gridJsPath = path.join(rootDir, 'packages', 'webview', 'src', 'grid.js');

// ============================================
// Load all source files once at module level
// ============================================

const builderRaw = fs.readFileSync(electronBuilderPath, 'utf-8');
const mainSource = fs.readFileSync(mainTsPath, 'utf-8');
const menuBuilderSource = fs.readFileSync(menuBuilderPath, 'utf-8');
const autoUpdateSource = fs.readFileSync(autoUpdatePath, 'utf-8');
const windowStateSource = fs.readFileSync(windowStatePath, 'utf-8');
const ipcSource = fs.readFileSync(ipcPath, 'utf-8');
const serverListJsSource = fs.readFileSync(serverListJsPath, 'utf-8');
const serverListCssSource = fs.readFileSync(serverListCssPath, 'utf-8');
const tabBarJsSource = fs.readFileSync(tabBarJsPath, 'utf-8');
const sidebarResizeSource = fs.readFileSync(sidebarResizePath, 'utf-8');
const appShellHtml = fs.readFileSync(appShellHtmlPath, 'utf-8');
const appShellCss = fs.readFileSync(appShellCssPath, 'utf-8');
const themeBridgeSource = fs.readFileSync(themeBridgePath, 'utf-8');
const errorHandlerSource = fs.readFileSync(errorHandlerPath, 'utf-8');
const gridJsSource = fs.readFileSync(gridJsPath, 'utf-8');

// ============================================
// Task 1: Verify app icon configuration (AC: 1)
// ============================================

describe('Story 14.3 Task 1: App icon configuration', () => {
    // Note: Icon file existence (icon.ico, icon.png) and productName are already
    // tested in crossPlatform.test.ts Task 1. Tests below focus on polish-specific
    // checks not covered there.

    it('should reference icon.ico for Windows in electron-builder.yml', () => {
        assert.ok(
            builderRaw.includes('icon: build-resources/icon.ico'),
            'win.icon should reference build-resources/icon.ico'
        );
    });

    it('should reference icon.png for macOS in electron-builder.yml', () => {
        assert.ok(
            builderRaw.includes('icon: build-resources/icon.png'),
            'mac.icon should reference build-resources/icon.png'
        );
    });

    it('should have icon paths under build-resources/ directory (not default Electron icon)', () => {
        // Both icon paths must be under build-resources/ to override the default Electron icon
        const winIconMatch = builderRaw.match(/win:[\s\S]*?icon:\s*(.+)/m);
        const macIconMatch = builderRaw.match(/mac:[\s\S]*?icon:\s*(.+)/m);

        assert.ok(winIconMatch, 'win section should have an icon property');
        assert.ok(macIconMatch, 'mac section should have an icon property');
        assert.ok(
            winIconMatch![1].trim().startsWith('build-resources/'),
            'Windows icon must be in build-resources/'
        );
        assert.ok(
            macIconMatch![1].trim().startsWith('build-resources/'),
            'macOS icon must be in build-resources/'
        );
    });

    it('should have a non-zero icon.ico file', () => {
        const icoPath = path.join(desktopDir, 'build-resources', 'icon.ico');
        const stats = fs.statSync(icoPath);
        assert.ok(stats.size > 0, 'icon.ico must not be empty');
    });

    it('should have a non-zero icon.png file', () => {
        const pngPath = path.join(desktopDir, 'build-resources', 'icon.png');
        const stats = fs.statSync(pngPath);
        assert.ok(stats.size > 0, 'icon.png must not be empty');
    });
});

// ============================================
// Task 2: Verify About dialog completeness (AC: 2)
// ============================================

describe('Story 14.3 Task 2: About dialog completeness', () => {

    it('should have onShowAbout callback in main.ts', () => {
        assert.ok(
            mainSource.includes('onShowAbout'),
            'main.ts must define onShowAbout callback'
        );
    });

    it('should call dialog.showMessageBox in onShowAbout', () => {
        assert.ok(
            mainSource.includes('dialog.showMessageBox'),
            'onShowAbout must call dialog.showMessageBox'
        );
    });

    it('should display app name "IRIS Table Editor" in About dialog', () => {
        assert.ok(
            mainSource.includes("message: 'IRIS Table Editor'"),
            'About dialog must show app name "IRIS Table Editor"'
        );
    });

    it('should use app.getVersion() for version display', () => {
        assert.ok(
            mainSource.includes('app.getVersion()'),
            'About dialog must use app.getVersion() for the version number'
        );
    });

    it('should include a description mentioning InterSystems IRIS', () => {
        assert.ok(
            mainSource.includes('Desktop application for editing InterSystems IRIS database tables'),
            'About dialog detail must describe the application purpose'
        );
    });

    it('should set dialog title to "About IRIS Table Editor"', () => {
        assert.ok(
            mainSource.includes("title: 'About IRIS Table Editor'"),
            'About dialog must have title "About IRIS Table Editor"'
        );
    });

    it('should guard against destroyed window before showing dialog', () => {
        // The onShowAbout callback checks win.isDestroyed() before calling dialog
        assert.ok(
            mainSource.includes('win.isDestroyed()'),
            'About dialog must check if window is destroyed before showing'
        );
    });

    it('should have "About IRIS Table Editor" menu item in Help menu', () => {
        assert.ok(
            menuBuilderSource.includes("label: 'About IRIS Table Editor'"),
            'Help menu must include "About IRIS Table Editor" item'
        );
    });

    it('should wire onShowAbout callback to Help > About menu item', () => {
        assert.ok(
            menuBuilderSource.includes('onShowAbout'),
            'MenuCallbacks interface must include onShowAbout'
        );
    });
});

// ============================================
// Task 3: Verify first-run welcome experience (AC: 3)
// ============================================

describe('Story 14.3 Task 3: First-run welcome experience', () => {

    describe('3.1-3.3: Sidebar welcome screen (server-list.js)', () => {

        it('should have renderWelcome() function', () => {
            assert.ok(
                serverListJsSource.includes('function renderWelcome()'),
                'server-list.js must define renderWelcome() function'
            );
        });

        it('should render welcome when servers list is empty', () => {
            // The render function checks servers.length === 0 and calls renderWelcome
            assert.ok(
                serverListJsSource.includes('currentState.servers.length === 0'),
                'render() must check for empty server list'
            );
            assert.ok(
                serverListJsSource.includes('renderWelcome()'),
                'render() must call renderWelcome() when no servers'
            );
        });

        it('should display welcome title "Welcome to IRIS Table Editor"', () => {
            assert.ok(
                serverListJsSource.includes('Welcome to IRIS Table Editor'),
                'Welcome screen must have title "Welcome to IRIS Table Editor"'
            );
        });

        it('should have "Add Your First Server" button in welcome screen', () => {
            assert.ok(
                serverListJsSource.includes('Add Your First Server'),
                'Welcome screen must have "Add Your First Server" button text'
            );
        });

        it('should have welcomeAddServerBtn ID on the button', () => {
            assert.ok(
                serverListJsSource.includes('id="welcomeAddServerBtn"'),
                'Welcome button must have id="welcomeAddServerBtn"'
            );
        });

        it('should open server form when welcome button is clicked', () => {
            // Click handler checks for #welcomeAddServerBtn and calls openAddForm
            assert.ok(
                serverListJsSource.includes("target.closest('#welcomeAddServerBtn')"),
                'Click handler must detect welcome button clicks'
            );
            assert.ok(
                serverListJsSource.includes('window.iteServerForm.openAddForm()'),
                'Welcome button must open the server form via iteServerForm.openAddForm()'
            );
        });

        it('should include an icon in the welcome screen', () => {
            assert.ok(
                serverListJsSource.includes('ite-welcome__icon'),
                'Welcome screen must include an icon element'
            );
        });

        it('should include a description in the welcome screen', () => {
            assert.ok(
                serverListJsSource.includes('ite-welcome__description'),
                'Welcome screen must include a description element'
            );
        });

        it('should use role="status" on the welcome container', () => {
            assert.ok(
                serverListJsSource.includes('role="status"'),
                'Welcome container must have role="status" for screen readers'
            );
        });
    });

    describe('3.4: Main content area welcome placeholder', () => {

        it('should have welcomePlaceholder element in app-shell.html', () => {
            assert.ok(
                appShellHtml.includes('id="welcomePlaceholder"'),
                'app-shell.html must have welcomePlaceholder element'
            );
        });

        it('should display "No Table Open" in the welcome placeholder', () => {
            assert.ok(
                appShellHtml.includes('No Table Open'),
                'Welcome placeholder must display "No Table Open" text'
            );
        });

        it('should include instructions to connect and open a table', () => {
            assert.ok(
                appShellHtml.includes('Connect to a server, then double-click a table'),
                'Welcome placeholder must instruct users to connect and open a table'
            );
        });

        it('should have ite-welcome--main class for main content styling', () => {
            assert.ok(
                appShellHtml.includes('ite-welcome--main'),
                'Welcome placeholder must use ite-welcome--main class'
            );
        });

        it('should style ite-welcome--main in app-shell.css', () => {
            assert.ok(
                appShellCss.includes('.ite-welcome--main'),
                'app-shell.css must style the .ite-welcome--main class'
            );
        });

        it('should have grid container hidden by default (display: none)', () => {
            assert.ok(
                appShellHtml.includes('id="gridContainer" style="display: none;"'),
                'Grid container must be hidden by default until a tab is opened'
            );
        });
    });

    describe('3.5: Welcome CSS styling', () => {

        it('should style ite-welcome class for centering', () => {
            assert.ok(
                serverListCssSource.includes('.ite-welcome {'),
                'server-list.css must style the .ite-welcome class'
            );
            assert.ok(
                serverListCssSource.includes('align-items: center'),
                'Welcome container must center items'
            );
            assert.ok(
                serverListCssSource.includes('justify-content: center'),
                'Welcome container must center content vertically'
            );
        });

        it('should style the welcome add button', () => {
            assert.ok(
                serverListCssSource.includes('.ite-welcome__add-btn'),
                'server-list.css must style the welcome add button'
            );
        });

        it('should use CSS custom properties for theme-aware colors', () => {
            assert.ok(
                serverListCssSource.includes('var(--ite-fg)'),
                'server-list.css must use --ite-fg for foreground color'
            );
            assert.ok(
                serverListCssSource.includes('var(--ite-bg)'),
                'server-list.css must use --ite-bg for background color'
            );
        });
    });
});

// ============================================
// Task 4: Audit memory leak prevention patterns (AC: 4)
// ============================================

describe('Story 14.3 Task 4: Memory leak prevention patterns', () => {

    describe('4.1: Main process cleanup (main.ts)', () => {

        it('should handle window-all-closed event', () => {
            assert.ok(
                mainSource.includes("app.on('window-all-closed'"),
                'main.ts must handle window-all-closed event'
            );
        });

        it('should call app.quit() on window-all-closed', () => {
            assert.ok(
                mainSource.includes('app.quit()'),
                'main.ts must call app.quit() to exit cleanly'
            );
        });

        it('should set mainWindow to null on closed event', () => {
            assert.ok(
                mainSource.includes("win.on('closed'"),
                'main.ts must handle window closed event'
            );
            assert.ok(
                mainSource.includes('mainWindow = null'),
                'main.ts must null out mainWindow reference on close'
            );
        });

        it('should cancel debounced save on window close', () => {
            assert.ok(
                mainSource.includes('debouncedSave.cancel()'),
                'main.ts must cancel debounced save timer on window close'
            );
        });

        it('should dispose AutoUpdateManager before creating new instance', () => {
            assert.ok(
                mainSource.includes('autoUpdateManagerRef?.dispose()'),
                'main.ts must dispose previous AutoUpdateManager to prevent duplicate event handlers'
            );
        });
    });

    describe('4.2: AutoUpdateManager dispose pattern', () => {

        it('should have dispose() method', () => {
            assert.ok(
                autoUpdateSource.includes('dispose(): void'),
                'AutoUpdateManager must have a dispose() method'
            );
        });

        it('should track event handlers for cleanup', () => {
            assert.ok(
                autoUpdateSource.includes('eventHandlers'),
                'AutoUpdateManager must track event handlers in an array'
            );
        });

        it('should call removeListener in dispose()', () => {
            assert.ok(
                autoUpdateSource.includes('this.updater.removeListener(event, handler)'),
                'dispose() must call removeListener for each tracked handler'
            );
        });

        it('should clear eventHandlers array in dispose()', () => {
            assert.ok(
                autoUpdateSource.includes('this.eventHandlers = []'),
                'dispose() must reset the event handlers array'
            );
        });
    });

    describe('4.3: WindowStateManager debounced save cleanup', () => {

        it('should export createDebouncedSave utility', () => {
            assert.ok(
                windowStateSource.includes('export function createDebouncedSave'),
                'WindowStateManager must export createDebouncedSave'
            );
        });

        it('should provide cancel() method on debounced save', () => {
            assert.ok(
                windowStateSource.includes('cancel(): void'),
                'createDebouncedSave must return an object with cancel() method'
            );
        });

        it('should call clearTimeout in cancel()', () => {
            assert.ok(
                windowStateSource.includes('clearTimeout(timeout)'),
                'cancel() must call clearTimeout to prevent pending saves'
            );
        });

        it('should set timeout to null after cancellation', () => {
            assert.ok(
                windowStateSource.includes('timeout = null'),
                'cancel() must set timeout reference to null'
            );
        });
    });

    describe('4.4: Tab bar cleanup on remove (tab-bar.js)', () => {

        it('should clean up tab state when closing a tab', () => {
            assert.ok(
                tabBarJsSource.includes('this.tabs.splice(tabIndex, 1)'),
                'closeTab must remove tab from array'
            );
        });

        it('should clear messageBridge state when all tabs closed', () => {
            assert.ok(
                tabBarJsSource.includes("messageBridge.setState({})"),
                'Tab bar must clear messageBridge state when no tabs remain'
            );
        });

        it('should null out activeTabId when last tab closed', () => {
            assert.ok(
                tabBarJsSource.includes('this.activeTabId = null'),
                'closeTab must null activeTabId when no tabs remain'
            );
        });

        it('should clean up on disconnect (clear all tabs)', () => {
            assert.ok(
                tabBarJsSource.includes('handleDisconnect()'),
                'Tab bar must have handleDisconnect method'
            );
            assert.ok(
                tabBarJsSource.includes('this.tabs = []'),
                'handleDisconnect must clear all tabs'
            );
        });
    });

    describe('4.5: Sidebar resize drag event cleanup (sidebar-resize.js)', () => {

        it('should add mousedown listener on resize handle', () => {
            assert.ok(
                sidebarResizeSource.includes("resizeHandle.addEventListener('mousedown', onMouseDown)"),
                'sidebar-resize.js must add mousedown listener on resize handle'
            );
        });

        it('should add mousemove listener on document', () => {
            assert.ok(
                sidebarResizeSource.includes("document.addEventListener('mousemove', onMouseMove)"),
                'sidebar-resize.js must add mousemove listener on document'
            );
        });

        it('should add mouseup listener on document', () => {
            assert.ok(
                sidebarResizeSource.includes("document.addEventListener('mouseup', onMouseUp)"),
                'sidebar-resize.js must add mouseup listener on document'
            );
        });

        it('should restore user-select and cursor on mouseup', () => {
            assert.ok(
                sidebarResizeSource.includes("document.body.style.userSelect = ''"),
                'onMouseUp must restore user-select style'
            );
            assert.ok(
                sidebarResizeSource.includes("document.body.style.cursor = ''"),
                'onMouseUp must restore cursor style'
            );
        });

        it('should use isDragging flag to guard mousemove and mouseup handlers', () => {
            // Both onMouseMove and onMouseUp check isDragging before executing
            const moveGuard = sidebarResizeSource.includes('if (!isDragging)');
            assert.ok(moveGuard, 'onMouseMove/onMouseUp must guard with isDragging check');
        });

        it('should set isDragging to false on mouseup to stop tracking', () => {
            assert.ok(
                sidebarResizeSource.includes('isDragging = false'),
                'onMouseUp must set isDragging = false'
            );
        });
    });

    describe('4.6: IPC handler registration cleanup (ipc.ts)', () => {

        it('should remove all previous command listeners before re-registering', () => {
            assert.ok(
                ipcSource.includes("ipcMain.removeAllListeners('command')"),
                'registerIpcHandlers must call removeAllListeners to prevent stacking'
            );
        });

        it('should have registerIpcHandlers exported', () => {
            assert.ok(
                ipcSource.includes('export function registerIpcHandlers'),
                'registerIpcHandlers must be exported'
            );
        });

        it('should catch errors in command routing', () => {
            assert.ok(
                ipcSource.includes('} catch (error)'),
                'IPC command handler must catch errors'
            );
        });

        it('should send error event on command handler failure', () => {
            assert.ok(
                ipcSource.includes('sendError(win, errorMessage, command)'),
                'IPC error handler must send error event back to renderer'
            );
        });
    });
});

// ============================================
// Task 5: Verify theme toggle infrastructure (AC: 5)
// ============================================

describe('Story 14.3 Task 5: Theme toggle infrastructure', () => {

    describe('5.1: Theme toggle IPC handling (main.ts)', () => {

        it('should set nativeTheme.themeSource on theme change', () => {
            assert.ok(
                mainSource.includes('nativeTheme.themeSource = theme'),
                'onSetTheme must set nativeTheme.themeSource'
            );
        });

        it('should persist theme change to state manager', () => {
            assert.ok(
                mainSource.includes('currentAppState.theme = theme'),
                'Theme change must be persisted to currentAppState'
            );
            assert.ok(
                mainSource.includes('stateManager.save(currentAppState)'),
                'Theme change must be saved via stateManager'
            );
        });

        it('should restore theme from saved state on startup', () => {
            assert.ok(
                mainSource.includes('nativeTheme.themeSource = savedState.theme'),
                'main.ts must restore theme from saved state on window creation'
            );
        });

        it('should update menu state after theme change', () => {
            assert.ok(
                mainSource.includes('menuState.themeSource = theme'),
                'Theme change must update menuState.themeSource'
            );
        });

        it('should have three theme options: light, dark, system', () => {
            assert.ok(
                menuBuilderSource.includes("'light'"),
                'Menu must support light theme'
            );
            assert.ok(
                menuBuilderSource.includes("'dark'"),
                'Menu must support dark theme'
            );
            assert.ok(
                menuBuilderSource.includes("'system'"),
                'Menu must support system theme'
            );
        });
    });

    describe('5.2: Desktop theme bridge CSS', () => {

        it('should exist at the expected path', () => {
            assert.ok(
                fs.existsSync(themeBridgePath),
                'desktopThemeBridge.css must exist in webview/src/'
            );
        });

        it('should define light theme variables in :root', () => {
            assert.ok(
                themeBridgeSource.includes(':root {'),
                'desktopThemeBridge.css must have :root block for light theme'
            );
        });

        it('should define dark theme variables in :root[data-theme="dark"]', () => {
            assert.ok(
                themeBridgeSource.includes(':root[data-theme="dark"]'),
                'desktopThemeBridge.css must have dark theme block'
            );
        });

        it('should define --ite-theme-fg variable', () => {
            assert.ok(
                themeBridgeSource.includes('--ite-theme-fg:'),
                'desktopThemeBridge.css must define --ite-theme-fg'
            );
        });

        it('should define --ite-theme-bg variable', () => {
            assert.ok(
                themeBridgeSource.includes('--ite-theme-bg:'),
                'desktopThemeBridge.css must define --ite-theme-bg'
            );
        });

        it('should define sidebar theme variables', () => {
            assert.ok(
                themeBridgeSource.includes('--ite-theme-sidebar-bg:'),
                'desktopThemeBridge.css must define --ite-theme-sidebar-bg'
            );
        });

        it('should define button theme variables', () => {
            assert.ok(
                themeBridgeSource.includes('--ite-theme-button-bg:'),
                'desktopThemeBridge.css must define --ite-theme-button-bg'
            );
            assert.ok(
                themeBridgeSource.includes('--ite-theme-button-fg:'),
                'desktopThemeBridge.css must define --ite-theme-button-fg'
            );
        });

        it('should define list/selection theme variables', () => {
            assert.ok(
                themeBridgeSource.includes('--ite-theme-list-active-selection-bg:'),
                'desktopThemeBridge.css must define list selection variables'
            );
        });

        it('should define input theme variables', () => {
            assert.ok(
                themeBridgeSource.includes('--ite-theme-input-bg:'),
                'desktopThemeBridge.css must define input variables'
            );
        });

        it('should define menu theme variables', () => {
            assert.ok(
                themeBridgeSource.includes('--ite-theme-menu-bg:'),
                'desktopThemeBridge.css must define menu variables'
            );
        });
    });

    describe('5.3: Theme injection via main.ts', () => {

        it('should have injectThemeCSS function', () => {
            assert.ok(
                mainSource.includes('function injectThemeCSS'),
                'main.ts must define injectThemeCSS function'
            );
        });

        it('should resolve path to desktopThemeBridge.css', () => {
            assert.ok(
                mainSource.includes('desktopThemeBridge.css'),
                'injectThemeCSS must reference desktopThemeBridge.css'
            );
        });

        it('should use webContents.insertCSS for injection', () => {
            assert.ok(
                mainSource.includes('win.webContents.insertCSS'),
                'injectThemeCSS must use insertCSS to inject theme CSS'
            );
        });

        it('should inject theme CSS after page loads (did-finish-load)', () => {
            assert.ok(
                mainSource.includes("win.webContents.on('did-finish-load'"),
                'Theme CSS injection must happen after did-finish-load event'
            );
            assert.ok(
                mainSource.includes('injectThemeCSS(win)'),
                'did-finish-load handler must call injectThemeCSS'
            );
        });
    });

    describe('5.4: Theme-aware styles in UI files', () => {

        it('server-list.css should use --ite-fg variable', () => {
            assert.ok(
                serverListCssSource.includes('var(--ite-fg)'),
                'server-list.css must use --ite-fg CSS variable'
            );
        });

        it('server-list.css should use --ite-bg variable', () => {
            assert.ok(
                serverListCssSource.includes('var(--ite-bg)'),
                'server-list.css must use --ite-bg CSS variable'
            );
        });

        it('server-list.css should use --ite-border variable', () => {
            assert.ok(
                serverListCssSource.includes('var(--ite-border)'),
                'server-list.css must use --ite-border CSS variable'
            );
        });

        it('server-list.css should use --ite-button-bg variable', () => {
            assert.ok(
                serverListCssSource.includes('var(--ite-button-bg)'),
                'server-list.css must use --ite-button-bg CSS variable'
            );
        });

        it('server-list.css should use --ite-focus-ring variable', () => {
            assert.ok(
                serverListCssSource.includes('var(--ite-focus-ring)'),
                'server-list.css must use --ite-focus-ring CSS variable'
            );
        });

        it('app-shell.css should use --ite-border variable', () => {
            assert.ok(
                appShellCss.includes('var(--ite-border)'),
                'app-shell.css must use --ite-border CSS variable'
            );
        });

        it('app-shell.css should use --ite-sidebar-bg variable', () => {
            assert.ok(
                appShellCss.includes('var(--ite-sidebar-bg'),
                'app-shell.css must use --ite-sidebar-bg CSS variable'
            );
        });

        it('app-shell.css should use --ite-description-fg variable', () => {
            assert.ok(
                appShellCss.includes('var(--ite-description-fg)'),
                'app-shell.css must use --ite-description-fg CSS variable'
            );
        });
    });

    describe('5.5: View menu has theme radio items', () => {

        it('should have Light Theme radio item in menu', () => {
            assert.ok(
                menuBuilderSource.includes("label: 'Light Theme'"),
                'View menu must have Light Theme item'
            );
            assert.ok(
                menuBuilderSource.includes("id: 'themeLight'"),
                'Light Theme must have id themeLight'
            );
        });

        it('should have Dark Theme radio item in menu', () => {
            assert.ok(
                menuBuilderSource.includes("label: 'Dark Theme'"),
                'View menu must have Dark Theme item'
            );
            assert.ok(
                menuBuilderSource.includes("id: 'themeDark'"),
                'Dark Theme must have id themeDark'
            );
        });

        it('should have System Theme radio item in menu (default checked)', () => {
            assert.ok(
                menuBuilderSource.includes("label: 'System Theme'"),
                'View menu must have System Theme item'
            );
            assert.ok(
                menuBuilderSource.includes("id: 'themeSystem'"),
                'System Theme must have id themeSystem'
            );
        });

        it('should have updateMenuState function for dynamic theme radio updates', () => {
            assert.ok(
                menuBuilderSource.includes('export function updateMenuState'),
                'menuBuilder must export updateMenuState function'
            );
        });

        it('updateMenuState should update theme radio checked state', () => {
            assert.ok(
                menuBuilderSource.includes("state.themeSource === 'light'"),
                'updateMenuState must check for light theme'
            );
            assert.ok(
                menuBuilderSource.includes("state.themeSource === 'dark'"),
                'updateMenuState must check for dark theme'
            );
            assert.ok(
                menuBuilderSource.includes("state.themeSource === 'system'"),
                'updateMenuState must check for system theme'
            );
        });
    });
});

// ============================================
// Task 6: Verify error handling completeness (AC: 6)
// ============================================

describe('Story 14.3 Task 6: Error handling patterns', () => {

    describe('6.1: ErrorHandler error codes (core)', () => {

        it('should define CONNECTION_FAILED error code', () => {
            assert.ok(
                errorHandlerSource.includes("CONNECTION_FAILED: 'CONNECTION_FAILED'"),
                'ErrorCodes must include CONNECTION_FAILED'
            );
        });

        it('should define AUTH_FAILED error code', () => {
            assert.ok(
                errorHandlerSource.includes("AUTH_FAILED: 'AUTH_FAILED'"),
                'ErrorCodes must include AUTH_FAILED'
            );
        });

        it('should define CONNECTION_TIMEOUT error code', () => {
            assert.ok(
                errorHandlerSource.includes("CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT'"),
                'ErrorCodes must include CONNECTION_TIMEOUT'
            );
        });

        it('should define SERVER_UNREACHABLE error code', () => {
            assert.ok(
                errorHandlerSource.includes("SERVER_UNREACHABLE: 'SERVER_UNREACHABLE'"),
                'ErrorCodes must include SERVER_UNREACHABLE'
            );
        });

        it('should define UNKNOWN_ERROR error code', () => {
            assert.ok(
                errorHandlerSource.includes("UNKNOWN_ERROR: 'UNKNOWN_ERROR'"),
                'ErrorCodes must include UNKNOWN_ERROR'
            );
        });

        it('should define INVALID_INPUT error code', () => {
            assert.ok(
                errorHandlerSource.includes("INVALID_INPUT: 'INVALID_INPUT'"),
                'ErrorCodes must include INVALID_INPUT'
            );
        });

        it('should define TABLE_NOT_FOUND error code', () => {
            assert.ok(
                errorHandlerSource.includes("TABLE_NOT_FOUND: 'TABLE_NOT_FOUND'"),
                'ErrorCodes must include TABLE_NOT_FOUND'
            );
        });

        it('should have user-friendly message for each error code', () => {
            // Verify ERROR_MESSAGES mapping exists for all codes
            assert.ok(
                errorHandlerSource.includes('AUTH_FAILED]: \'Authentication failed'),
                'Must have user-friendly message for AUTH_FAILED'
            );
            assert.ok(
                errorHandlerSource.includes('CONNECTION_TIMEOUT]: \'Connection timed out'),
                'Must have user-friendly message for CONNECTION_TIMEOUT'
            );
            assert.ok(
                errorHandlerSource.includes('SERVER_UNREACHABLE]: \'Cannot reach server'),
                'Must have user-friendly message for SERVER_UNREACHABLE'
            );
        });

        it('should have parse() method for converting errors to IUserError', () => {
            assert.ok(
                errorHandlerSource.includes('public static parse('),
                'ErrorHandler must have static parse() method'
            );
        });

        it('should have getUserMessage() for extracting user-friendly strings', () => {
            assert.ok(
                errorHandlerSource.includes('public static getUserMessage('),
                'ErrorHandler must have static getUserMessage() method'
            );
        });

        it('should have createError() factory method', () => {
            assert.ok(
                errorHandlerSource.includes('public static createError('),
                'ErrorHandler must have static createError() method'
            );
        });

        it('should export IUserError interface with required fields', () => {
            assert.ok(
                errorHandlerSource.includes('message: string'),
                'IUserError must have message field'
            );
            assert.ok(
                errorHandlerSource.includes('code: ErrorCode'),
                'IUserError must have code field'
            );
            assert.ok(
                errorHandlerSource.includes('recoverable: boolean'),
                'IUserError must have recoverable field'
            );
            assert.ok(
                errorHandlerSource.includes('context: string'),
                'IUserError must have context field'
            );
        });
    });

    describe('6.2: IPC error response patterns (ipc.ts)', () => {

        it('should have sendError helper function', () => {
            assert.ok(
                ipcSource.includes('function sendError('),
                'ipc.ts must define sendError helper'
            );
        });

        it('should include IPC_ERROR code in error events', () => {
            assert.ok(
                ipcSource.includes("code: 'IPC_ERROR'"),
                'sendError must include IPC_ERROR code'
            );
        });

        it('should mark IPC errors as recoverable', () => {
            assert.ok(
                ipcSource.includes('recoverable: true'),
                'sendError must mark errors as recoverable'
            );
        });

        it('should include context in error events', () => {
            assert.ok(
                ipcSource.includes('context,'),
                'sendError must include the context (command name) in error payload'
            );
        });

        it('should send error for missing serverName on connectServer', () => {
            assert.ok(
                ipcSource.includes("sendError(win, 'No server name provided', 'connectServer')"),
                'connectServer must validate serverName'
            );
        });

        it('should send error for missing serverName on deleteServer', () => {
            assert.ok(
                ipcSource.includes("sendError(win, 'No server name provided', 'deleteServer')"),
                'deleteServer must validate serverName'
            );
        });

        it('should send error for unknown commands', () => {
            assert.ok(
                ipcSource.includes("sendError(win, `Unknown command: ${command}`, 'routeCommand')"),
                'Unknown commands must produce an error event'
            );
        });

        it('should have requireSession guard for data commands', () => {
            assert.ok(
                ipcSource.includes('export function requireSession'),
                'ipc.ts must export requireSession function'
            );
            assert.ok(
                ipcSource.includes("sendError(win, 'Not connected to a server', context)"),
                'requireSession must send error when not connected'
            );
        });

        it('should wrap routeCommand calls in try/catch', () => {
            // The ipcMain.on handler wraps routeCommand in try/catch
            assert.ok(
                /try\s*\{[\s\S]*?await routeCommand[\s\S]*?\}\s*catch\s*\(error\)/.test(ipcSource),
                'IPC handler must wrap routeCommand in try/catch'
            );
        });

        it('should send structured error on data command failures', () => {
            // Verify saveCell, insertRow, deleteRow return structured error objects
            assert.ok(
                ipcSource.includes("error: updateResult.error ? {"),
                'saveCell must return structured error'
            );
            assert.ok(
                ipcSource.includes("error: insertResult.error ? {"),
                'insertRow must return structured error'
            );
            assert.ok(
                ipcSource.includes("error: deleteResult.error ? {"),
                'deleteRow must return structured error'
            );
        });
    });

    describe('6.3: Grid error display (grid.js)', () => {

        it('should have handleError function for error events', () => {
            assert.ok(
                gridJsSource.includes('function handleError('),
                'grid.js must have handleError function definition'
            );
        });

        it('should handle error event in message handler switch', () => {
            assert.ok(
                gridJsSource.includes("case 'error':"),
                'grid.js handleMessage must have error case'
            );
        });

        it('should have showError function for user-facing error display', () => {
            assert.ok(
                gridJsSource.includes('function showError'),
                'grid.js must have showError function for user-facing errors'
            );
        });

        it('should display error messages from saveCellResult failures', () => {
            // When save fails, grid.js should show an error toast
            assert.ok(
                /saveCellResult[\s\S]*?showError/.test(gridJsSource),
                'saveCellResult handler must call showError on failure'
            );
        });

        it('should display error messages from insertRowResult failures', () => {
            assert.ok(
                /insertRowResult[\s\S]*?showError/.test(gridJsSource),
                'insertRowResult handler must call showError on failure'
            );
        });

        it('should display error messages from deleteRowResult failures', () => {
            assert.ok(
                /handleDeleteRowResult[\s\S]*?showToast/.test(gridJsSource),
                'deleteRowResult handler must call showToast on failure'
            );
        });

        it('should have formatErrorMessage function for user-friendly messages', () => {
            assert.ok(
                gridJsSource.includes('function formatErrorMessage('),
                'grid.js must have formatErrorMessage function definition'
            );
        });
    });

    describe('6.4: Connection error display (server-list.js)', () => {

        it('should handle connectionProgress error status', () => {
            assert.ok(
                serverListJsSource.includes("case 'error':"),
                'server-list.js must handle error status in connectionProgress'
            );
        });

        it('should store connection error message in state', () => {
            assert.ok(
                serverListJsSource.includes("connectionError: payload.message || 'Connection failed.'"),
                'server-list.js must store connection error message in state'
            );
        });

        it('should display inline error with retry and edit buttons', () => {
            assert.ok(
                serverListJsSource.includes('ite-server-list__inline-error'),
                'server-list.js must render inline error element'
            );
            assert.ok(
                serverListJsSource.includes("data-action=\"retryConnection\""),
                'Inline error must have Retry button'
            );
            assert.ok(
                serverListJsSource.includes('ite-server-list__retry-btn'),
                'Inline error must have styled retry button'
            );
        });

        it('should handle error event from IPC', () => {
            assert.ok(
                serverListJsSource.includes("messageBridge.onEvent('error'"),
                'server-list.js must listen for error events'
            );
        });

        it('should render error state with retry button', () => {
            assert.ok(
                serverListJsSource.includes('function renderError('),
                'server-list.js must have renderError function'
            );
            assert.ok(
                serverListJsSource.includes('id="retryBtn"'),
                'renderError must include a retry button'
            );
        });

        it('should announce errors via ARIA live region', () => {
            assert.ok(
                serverListJsSource.includes("announce('Error: '"),
                'server-list.js must announce errors for screen readers'
            );
        });
    });

    describe('6.5: Structured error responses in all IPC data commands', () => {
        // Verify that all data commands return structured error payloads
        const dataCommands = [
            'getNamespaces', 'getTables', 'selectTable',
            'requestData', 'refresh', 'paginateNext', 'paginatePrev',
            'saveCell', 'insertRow', 'deleteRow',
        ];

        for (const cmd of dataCommands) {
            it(`should handle errors in ${cmd} command`, () => {
                // Every data command must either:
                // - call sendError() on failure, or
                // - return a structured error response
                const cmdRegex = new RegExp(`case '${cmd}':[\\s\\S]*?(?:sendError|error:)`, 'm');
                assert.ok(
                    cmdRegex.test(ipcSource),
                    `${cmd} command must have error handling (sendError or structured error response)`
                );
            });
        }
    });
});
