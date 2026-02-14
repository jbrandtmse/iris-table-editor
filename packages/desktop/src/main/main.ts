/**
 * Electron main process entry point
 * Story 11.1: Electron Bootstrap
 * Story 11.5: Window State Persistence
 *
 * Creates the BrowserWindow with security-hardened webPreferences,
 * instantiates services, registers IPC handlers, and loads the server list UI.
 * Persists and restores window bounds, sidebar state, and theme preference.
 */
import { app, BrowserWindow, Menu, nativeTheme, dialog, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ConnectionManager } from './ConnectionManager';
import { NodeCryptoCredentialStore } from './NodeCryptoCredentialStore';
import { ConnectionLifecycleManager } from './ConnectionLifecycleManager';
import { SessionManager } from './SessionManager';
import type { IDesktopConnectionProgressPayload, IServerSpec } from '@iris-te/core';
import { registerIpcHandlers, sendEvent } from './ipc';
import { buildApplicationMenu, updateMenuState } from './menuBuilder';
import type { MenuState } from './menuBuilder';
import {
    WindowStateManager,
    isOnScreen,
    createDebouncedSave,
} from './WindowStateManager';
import type { AppPersistentState } from './WindowStateManager';
import { AutoUpdateManager } from './AutoUpdateManager';

const LOG_PREFIX = '[IRIS-TE]';

let mainWindow: BrowserWindow | null = null;

// Module-level service references for macOS activate handler
let connectionManagerRef: ConnectionManager | null = null;
let lifecycleManagerRef: ConnectionLifecycleManager | null = null;
let sessionManagerRef: SessionManager | null = null;

// Story 11.5: Module-level state manager reference
let windowStateManagerRef: WindowStateManager | null = null;
let currentAppState: AppPersistentState | null = null;

// Story 13.2: Auto-update manager reference
let autoUpdateManagerRef: AutoUpdateManager | null = null;

// Story 11.4: Menu state tracking
const menuState: MenuState = {
    isConnected: false,
    hasOpenTabs: false,
    themeSource: 'system',
};

/**
 * Create the main application window with security-hardened settings.
 * Story 11.5: Applies saved window state (bounds, maximize, theme).
 */
function createWindow(
    connectionManager: ConnectionManager,
    lifecycleManager: ConnectionLifecycleManager,
    sessionManager: SessionManager
): BrowserWindow {
    // Story 11.5: Load saved state
    const stateManager = windowStateManagerRef!;
    const savedState = stateManager.load();
    currentAppState = savedState;

    // Story 11.5: Build BrowserWindow options from saved state
    const windowOptions: Electron.BrowserWindowConstructorOptions = {
        width: savedState.window.width,
        height: savedState.window.height,
        title: 'IRIS Table Editor',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    };

    // Story 11.5: Apply saved position if on-screen
    if (savedState.window.x !== undefined && savedState.window.y !== undefined) {
        const displays = screen.getAllDisplays().map(d => d.bounds);
        if (isOnScreen(
            savedState.window.x,
            savedState.window.y,
            savedState.window.width,
            savedState.window.height,
            displays
        )) {
            windowOptions.x = savedState.window.x;
            windowOptions.y = savedState.window.y;
        } else {
            console.log(`${LOG_PREFIX} Saved window position is off-screen, centering on primary display`);
        }
    }

    const win = new BrowserWindow(windowOptions);

    // Story 11.5: Restore maximized state after creation
    if (savedState.window.isMaximized) {
        win.maximize();
    }

    // Story 11.5: Restore theme from saved state
    nativeTheme.themeSource = savedState.theme;
    menuState.themeSource = savedState.theme;

    // Security: Prevent navigation away from the app's own file:// pages.
    // This blocks phishing attacks where injected content navigates to a malicious URL.
    win.webContents.on('will-navigate', (event, url) => {
        // Only allow file:// protocol (loadFile uses file://)
        if (!url.startsWith('file://')) {
            console.warn(`${LOG_PREFIX} Blocked navigation to: ${url}`);
            event.preventDefault();
        }
    });

    // Security: Block all new window creation from the renderer.
    // Prevents window.open() or target="_blank" from opening arbitrary URLs.
    win.webContents.setWindowOpenHandler(({ url }) => {
        console.warn(`${LOG_PREFIX} Blocked new window request for: ${url}`);
        return { action: 'deny' };
    });

    // Story 11.4: Register IPC handlers with menu state callback
    // Story 11.5: Add sidebarStateChanged callback
    registerIpcHandlers(win, connectionManager, lifecycleManager, sessionManager, {
        onTabStateChanged: (payload: { tabCount: number }) => {
            menuState.hasOpenTabs = payload.tabCount > 0;
            updateMenuState(menuState);
        },
        onSidebarStateChanged: (payload: { width: number; isVisible: boolean }) => {
            if (currentAppState) {
                currentAppState.sidebar.width = payload.width;
                currentAppState.sidebar.isVisible = payload.isVisible;
                stateManager.save(currentAppState);
                console.log(`${LOG_PREFIX} Sidebar state saved: width=${payload.width}, visible=${payload.isVisible}`);
            }
        },
    });

    // Story 11.4: Build and set the application menu
    const appMenu = buildApplicationMenu(win, {
        onNewConnection: () => {
            sendEvent(win, 'menuAction', { action: 'newConnection' });
        },
        onDisconnect: () => {
            lifecycleManager.disconnect();
        },
        onCloseTab: () => {
            sendEvent(win, 'menuAction', { action: 'closeTab' });
        },
        onCloseAllTabs: () => {
            sendEvent(win, 'menuAction', { action: 'closeAllTabs' });
        },
        onSetNull: () => {
            sendEvent(win, 'menuAction', { action: 'setNull' });
        },
        onToggleSidebar: () => {
            sendEvent(win, 'menuAction', { action: 'toggleSidebar' });
        },
        onToggleFilterPanel: () => {
            sendEvent(win, 'menuAction', { action: 'toggleFilterPanel' });
        },
        onSetTheme: (theme: 'light' | 'dark' | 'system') => {
            nativeTheme.themeSource = theme;
            menuState.themeSource = theme;
            updateMenuState(menuState);

            // Tell the renderer to update the data-theme attribute
            const resolvedTheme = theme === 'system'
                ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
                : theme;
            sendEvent(win, 'themeChanged', { theme: resolvedTheme });

            // Story 11.5: Persist theme change
            if (currentAppState) {
                currentAppState.theme = theme;
                stateManager.save(currentAppState);
                console.log(`${LOG_PREFIX} Theme state saved: ${theme}`);
            }
        },
        onShowShortcuts: () => {
            sendEvent(win, 'menuAction', { action: 'showShortcuts' });
        },
        onCheckForUpdates: () => {
            autoUpdateManagerRef?.checkForUpdatesInteractive();
        },
        onShowAbout: () => {
            if (win.isDestroyed()) {
                return;
            }
            dialog.showMessageBox(win, {
                type: 'info',
                title: 'About IRIS Table Editor',
                message: 'IRIS Table Editor',
                detail: `Version ${app.getVersion()}\nDesktop application for editing InterSystems IRIS database tables.`,
                buttons: ['OK'],
            });
        },
    });
    Menu.setApplicationMenu(appMenu);
    updateMenuState(menuState);

    // Story 11.3: Load the app shell HTML (combines sidebar + tab bar + grid)
    const htmlPath = path.join(__dirname, '../../src/ui/app-shell.html');
    win.loadFile(htmlPath);

    // Inject desktopThemeBridge.css after the page loads
    // Story 11.5: Send restoreAppState event after page loads
    win.webContents.on('did-finish-load', () => {
        injectThemeCSS(win);

        // Send initial theme to renderer so data-theme attribute is set
        const resolvedTheme = savedState.theme === 'system'
            ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
            : savedState.theme;
        sendEvent(win, 'themeChanged', { theme: resolvedTheme });

        // Story 11.5: Restore sidebar state in the renderer
        sendEvent(win, 'restoreAppState', {
            sidebar: savedState.sidebar,
        });

        // Story 13.2: Initialize auto-updater after page loads
        // Dispose previous instance to avoid duplicate event handlers
        // (e.g., macOS window recreation via dock icon activate)
        autoUpdateManagerRef?.dispose();
        const autoUpdateManager = new AutoUpdateManager({ win });
        autoUpdateManager.initialize();
        autoUpdateManager.checkForUpdates();
        autoUpdateManagerRef = autoUpdateManager;
    });

    // Story 11.5: Track window state changes
    const debouncedSave = createDebouncedSave(() => {
        if (currentAppState) {
            stateManager.save(currentAppState);
        }
    }, 500);

    win.on('resize', () => {
        if (!win.isMaximized()) {
            const bounds = win.getBounds();
            if (currentAppState) {
                currentAppState.window.width = bounds.width;
                currentAppState.window.height = bounds.height;
                currentAppState.window.x = bounds.x;
                currentAppState.window.y = bounds.y;
            }
            debouncedSave.call();
        }
    });

    win.on('move', () => {
        if (!win.isMaximized()) {
            const bounds = win.getBounds();
            if (currentAppState) {
                currentAppState.window.x = bounds.x;
                currentAppState.window.y = bounds.y;
            }
            debouncedSave.call();
        }
    });

    win.on('maximize', () => {
        if (currentAppState) {
            currentAppState.window.isMaximized = true;
            stateManager.save(currentAppState);
        }
    });

    win.on('unmaximize', () => {
        if (currentAppState) {
            currentAppState.window.isMaximized = false;
            // Capture the restored (unmaximized) bounds
            const bounds = win.getBounds();
            currentAppState.window.width = bounds.width;
            currentAppState.window.height = bounds.height;
            currentAppState.window.x = bounds.x;
            currentAppState.window.y = bounds.y;
            stateManager.save(currentAppState);
        }
    });

    // Story 11.5: Final synchronous save on close (capture last state)
    win.on('close', () => {
        debouncedSave.cancel();
        if (currentAppState) {
            if (!win.isMaximized()) {
                const bounds = win.getBounds();
                currentAppState.window.width = bounds.width;
                currentAppState.window.height = bounds.height;
                currentAppState.window.x = bounds.x;
                currentAppState.window.y = bounds.y;
            }
            stateManager.save(currentAppState);
            console.log(`${LOG_PREFIX} Final window state saved on close`);
        }
    });

    win.on('closed', () => {
        mainWindow = null;
    });

    return win;
}

/**
 * Inject desktopThemeBridge.css into the renderer process.
 * Reads the CSS file from the webview package and injects it via insertCSS.
 */
function injectThemeCSS(win: BrowserWindow): void {
    try {
        // Resolve path to desktopThemeBridge.css in the webview package
        const cssPath = path.join(__dirname, '../../../webview/src/desktopThemeBridge.css');
        if (fs.existsSync(cssPath)) {
            const cssContent = fs.readFileSync(cssPath, 'utf-8');
            win.webContents.insertCSS(cssContent);
            console.log(`${LOG_PREFIX} Injected desktopThemeBridge.css`);
        } else {
            console.warn(`${LOG_PREFIX} desktopThemeBridge.css not found at ${cssPath}`);
        }
    } catch (error) {
        console.error(`${LOG_PREFIX} Failed to inject theme CSS: ${error}`);
    }
}

// Application lifecycle
app.whenReady().then(() => {
    console.log(`${LOG_PREFIX} Application starting`);

    // Instantiate services
    const credentialStore = new NodeCryptoCredentialStore();
    const configDir = app.getPath('userData');
    const connectionManager = new ConnectionManager({
        configDir,
        credentialStore,
    });

    // Story 11.5: Instantiate WindowStateManager
    windowStateManagerRef = new WindowStateManager(configDir);

    // Create session manager for data operations
    const sessionManager = new SessionManager();

    // Create lifecycle manager with callback that sends events to the renderer
    // and wires session start/end to connection status changes
    const lifecycleManager = new ConnectionLifecycleManager(
        connectionManager,
        (payload: IDesktopConnectionProgressPayload) => {
            // Wire session lifecycle to connection state
            if (payload.status === 'connected') {
                // Start session when connected
                const serverConfig = connectionManager.getServer(payload.serverName);
                if (serverConfig) {
                    const password = connectionManager.getDecryptedPassword(payload.serverName);
                    if (password) {
                        const spec: IServerSpec = {
                            name: serverConfig.name,
                            scheme: serverConfig.ssl ? 'https' : 'http',
                            host: serverConfig.hostname,
                            port: serverConfig.port,
                            pathPrefix: serverConfig.pathPrefix || '',
                            username: serverConfig.username,
                        };
                        sessionManager.startSession(
                            payload.serverName, spec, serverConfig.username, password
                        );
                    } else {
                        console.warn(`${LOG_PREFIX} Connected to "${payload.serverName}" but failed to retrieve password — data commands will not work`);
                    }
                } else {
                    console.warn(`${LOG_PREFIX} Connected to "${payload.serverName}" but server config not found — data commands will not work`);
                }
            } else if (payload.status === 'disconnected' || payload.status === 'cancelled' || payload.status === 'error') {
                // End session on disconnect/cancel/error
                sessionManager.endSession();
            }

            // Story 11.4: Update menu state based on connection status
            if (payload.status === 'connected') {
                menuState.isConnected = true;
            } else if (payload.status === 'disconnected' || payload.status === 'cancelled' || payload.status === 'error') {
                menuState.isConnected = false;
                menuState.hasOpenTabs = false;
            }
            updateMenuState(menuState);

            if (mainWindow) {
                sendEvent(mainWindow, 'connectionProgress', payload);
            }
        }
    );

    // Store service references at module level for macOS activate handler
    connectionManagerRef = connectionManager;
    lifecycleManagerRef = lifecycleManager;
    sessionManagerRef = sessionManager;

    mainWindow = createWindow(connectionManager, lifecycleManager, sessionManager);

    console.log(`${LOG_PREFIX} Application ready`);
});

// Quit when all windows are closed (all platforms for MVP)
app.on('window-all-closed', () => {
    app.quit();
});

// macOS: Recreate window when dock icon is clicked and no windows exist
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && connectionManagerRef && lifecycleManagerRef && sessionManagerRef) {
        console.log(`${LOG_PREFIX} Recreating window on activate`);
        mainWindow = createWindow(connectionManagerRef, lifecycleManagerRef, sessionManagerRef);
    }
});
