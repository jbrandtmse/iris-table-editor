/**
 * Electron main process entry point
 * Story 11.1: Electron Bootstrap
 *
 * Creates the BrowserWindow with security-hardened webPreferences,
 * instantiates services, registers IPC handlers, and loads the server list UI.
 */
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ConnectionManager } from './ConnectionManager';
import { NodeCryptoCredentialStore } from './NodeCryptoCredentialStore';
import { ConnectionLifecycleManager } from './ConnectionLifecycleManager';
import type { IDesktopConnectionProgressPayload } from '@iris-te/core';
import { registerIpcHandlers, sendEvent } from './ipc';

const LOG_PREFIX = '[IRIS-TE]';

let mainWindow: BrowserWindow | null = null;

// Module-level service references for macOS activate handler
let connectionManagerRef: ConnectionManager | null = null;
let lifecycleManagerRef: ConnectionLifecycleManager | null = null;

/**
 * Create the main application window with security-hardened settings.
 */
function createWindow(
    connectionManager: ConnectionManager,
    lifecycleManager: ConnectionLifecycleManager
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

    // Register IPC handlers for renderer communication
    registerIpcHandlers(win, connectionManager, lifecycleManager);

    // Load the server list HTML from the UI directory
    const htmlPath = path.join(__dirname, '../../src/ui/connection/server-list.html');
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

    // Create lifecycle manager with callback that sends events to the renderer
    const lifecycleManager = new ConnectionLifecycleManager(
        connectionManager,
        (payload: IDesktopConnectionProgressPayload) => {
            if (mainWindow) {
                sendEvent(mainWindow, 'connectionProgress', payload);
            }
        }
    );

    // Store service references at module level for macOS activate handler
    connectionManagerRef = connectionManager;
    lifecycleManagerRef = lifecycleManager;

    mainWindow = createWindow(connectionManager, lifecycleManager);

    console.log(`${LOG_PREFIX} Application ready`);
});

// Quit when all windows are closed (all platforms for MVP)
app.on('window-all-closed', () => {
    app.quit();
});

// macOS: Recreate window when dock icon is clicked and no windows exist
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && connectionManagerRef && lifecycleManagerRef) {
        console.log(`${LOG_PREFIX} Recreating window on activate`);
        mainWindow = createWindow(connectionManagerRef, lifecycleManagerRef);
    }
});
