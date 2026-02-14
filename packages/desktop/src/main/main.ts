/**
 * Electron main process entry point
 * Story 11.1: Electron Bootstrap
 *
 * Creates the BrowserWindow with security-hardened webPreferences,
 * instantiates services, registers IPC handlers, and loads the server list UI.
 */
import { app, BrowserWindow, Menu, nativeTheme, dialog } from 'electron';
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

const LOG_PREFIX = '[IRIS-TE]';

let mainWindow: BrowserWindow | null = null;

// Module-level service references for macOS activate handler
let connectionManagerRef: ConnectionManager | null = null;
let lifecycleManagerRef: ConnectionLifecycleManager | null = null;
let sessionManagerRef: SessionManager | null = null;

// Story 11.4: Menu state tracking
const menuState: MenuState = {
    isConnected: false,
    hasOpenTabs: false,
    themeSource: 'system',
};

/**
 * Create the main application window with security-hardened settings.
 */
function createWindow(
    connectionManager: ConnectionManager,
    lifecycleManager: ConnectionLifecycleManager,
    sessionManager: SessionManager
): BrowserWindow {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'IRIS Table Editor',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

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
    registerIpcHandlers(win, connectionManager, lifecycleManager, sessionManager, {
        onTabStateChanged: (payload: { tabCount: number }) => {
            menuState.hasOpenTabs = payload.tabCount > 0;
            updateMenuState(menuState);
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
        },
        onShowShortcuts: () => {
            sendEvent(win, 'menuAction', { action: 'showShortcuts' });
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
    win.webContents.on('did-finish-load', () => {
        injectThemeCSS(win);
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
