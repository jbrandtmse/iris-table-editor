/**
 * IPC handler registration for Electron main process
 * Story 11.1: Electron Bootstrap
 *
 * Routes commands from the renderer process to appropriate service methods.
 * Sends event responses back to the renderer via BrowserWindow.webContents.
 *
 * IPC channel design:
 * - Inbound: ipcMain.on('command', ...) — receives { command, payload } from renderer
 * - Outbound: win.webContents.send('event:{name}', payload) — sends events to renderer
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { ConnectionManager, ServerConfig } from './ConnectionManager';
import type { ConnectionLifecycleManager } from './ConnectionLifecycleManager';
import type {
    IDesktopSaveServerPayload,
    IDesktopUpdateServerPayload,
    IDesktopTestConnectionPayload,
    IDesktopServerNamePayload,
    IDesktopServerInfo,
} from '@iris-te/core';

const LOG_PREFIX = '[IRIS-TE IPC]';

/**
 * Command payload received from the renderer process.
 */
export interface IpcCommandMessage {
    command: string;
    payload: unknown;
}

/**
 * Send an event to the renderer process via BrowserWindow.
 * @param win - The target BrowserWindow
 * @param eventName - Event name (will be prefixed with 'event:')
 * @param payload - Event payload data
 */
export function sendEvent(win: BrowserWindow, eventName: string, payload: unknown): void {
    if (win.isDestroyed()) {
        console.warn(`${LOG_PREFIX} Cannot send event "${eventName}" — window is destroyed`);
        return;
    }
    win.webContents.send(`event:${eventName}`, payload);
}

/**
 * Send an error event to the renderer process.
 * @param win - The target BrowserWindow
 * @param message - User-friendly error message
 * @param context - Context where the error occurred (e.g., command name)
 */
function sendError(win: BrowserWindow, message: string, context: string): void {
    sendEvent(win, 'error', {
        message,
        code: 'IPC_ERROR',
        recoverable: true,
        context,
    });
}

/**
 * Convert a ServerConfig to IDesktopServerInfo for the renderer.
 */
function toServerInfo(config: ServerConfig): IDesktopServerInfo {
    return {
        name: config.name,
        hostname: config.hostname,
        port: config.port,
        description: config.description,
        ssl: config.ssl,
    };
}

/**
 * Route a command to the appropriate service method.
 * Extracted as a standalone function for testability without Electron runtime.
 *
 * @param command - Command name from the renderer
 * @param payload - Command payload
 * @param win - The BrowserWindow to send events back to
 * @param connectionManager - ConnectionManager instance
 * @param lifecycleManager - ConnectionLifecycleManager instance
 */
export async function routeCommand(
    command: string,
    payload: unknown,
    win: BrowserWindow,
    connectionManager: ConnectionManager,
    lifecycleManager: ConnectionLifecycleManager
): Promise<void> {
    switch (command) {
        case 'getServers': {
            const servers = connectionManager.getServers();
            const serverInfos: IDesktopServerInfo[] = servers.map(toServerInfo);
            sendEvent(win, 'serversLoaded', { servers: serverInfos });
            break;
        }

        case 'connectServer': {
            const { serverName } = payload as IDesktopServerNamePayload;
            if (!serverName) {
                sendError(win, 'No server name provided', 'connectServer');
                return;
            }
            // ConnectionLifecycleManager.connect() emits progress events via its callback
            await lifecycleManager.connect(serverName);
            break;
        }

        case 'disconnectServer': {
            lifecycleManager.disconnect();
            break;
        }

        case 'cancelConnection': {
            lifecycleManager.cancelConnection();
            break;
        }

        case 'deleteServer': {
            const { serverName } = payload as IDesktopServerNamePayload;
            if (!serverName) {
                sendError(win, 'No server name provided', 'deleteServer');
                return;
            }
            connectionManager.deleteServer(serverName);
            sendEvent(win, 'serverDeleted', { serverName });
            break;
        }

        case 'editServer': {
            const { serverName } = payload as IDesktopServerNamePayload;
            if (!serverName) {
                sendError(win, 'No server name provided', 'editServer');
                return;
            }
            const server = connectionManager.getServer(serverName);
            if (!server) {
                sendError(win, `Server "${serverName}" not found`, 'editServer');
                return;
            }
            sendEvent(win, 'serverConfigLoaded', {
                name: server.name,
                hostname: server.hostname,
                port: server.port,
                username: server.username,
                ssl: server.ssl,
                description: server.description,
                pathPrefix: server.pathPrefix,
            });
            break;
        }

        case 'saveServer': {
            const savePayload = payload as IDesktopSaveServerPayload;
            const config: ServerConfig = {
                name: savePayload.name,
                hostname: savePayload.hostname,
                port: savePayload.port,
                username: savePayload.username,
                ssl: savePayload.ssl,
                description: savePayload.description,
                pathPrefix: savePayload.pathPrefix,
                encryptedPassword: savePayload.password,
            };
            connectionManager.saveServer(config);
            sendEvent(win, 'serverSaved', { serverName: savePayload.name, mode: 'add' });
            break;
        }

        case 'updateServer': {
            const updatePayload = payload as IDesktopUpdateServerPayload;
            const updateConfig: ServerConfig = {
                name: updatePayload.name,
                hostname: updatePayload.hostname,
                port: updatePayload.port,
                username: updatePayload.username,
                ssl: updatePayload.ssl,
                description: updatePayload.description,
                pathPrefix: updatePayload.pathPrefix,
                encryptedPassword: updatePayload.password,
            };
            connectionManager.updateServer(updatePayload.originalName, updateConfig);
            sendEvent(win, 'serverSaved', { serverName: updatePayload.name, mode: 'edit' });
            break;
        }

        case 'testFormConnection': {
            const testPayload = payload as IDesktopTestConnectionPayload;
            const result = await connectionManager.testConnection({
                hostname: testPayload.hostname,
                port: testPayload.port,
                pathPrefix: testPayload.pathPrefix,
                ssl: testPayload.ssl,
                username: testPayload.username,
                password: testPayload.password,
            });
            sendEvent(win, 'testConnectionResult', result);
            break;
        }

        case 'selectServer': {
            const { serverName } = payload as IDesktopServerNamePayload;
            if (!serverName) {
                sendError(win, 'No server name provided', 'selectServer');
                return;
            }
            sendEvent(win, 'serverSelected', { serverName });
            break;
        }

        default: {
            console.warn(`${LOG_PREFIX} Unknown command: ${command}`);
            sendError(win, `Unknown command: ${command}`, 'routeCommand');
            break;
        }
    }
}

/**
 * Register IPC handlers for the main process.
 * Listens on the 'command' channel and routes to service methods.
 *
 * @param win - The BrowserWindow to communicate with
 * @param connectionManager - ConnectionManager instance for server CRUD
 * @param lifecycleManager - ConnectionLifecycleManager for connect/disconnect
 */
export function registerIpcHandlers(
    win: BrowserWindow,
    connectionManager: ConnectionManager,
    lifecycleManager: ConnectionLifecycleManager
): void {
    // Remove any previously registered 'command' listeners to avoid duplicates
    // when window is recreated (e.g., macOS activate). ipcMain.on is global,
    // not per-window, so re-calling registerIpcHandlers would stack listeners.
    ipcMain.removeAllListeners('command');

    ipcMain.on('command', async (_event, message: IpcCommandMessage) => {
        const { command, payload } = message;
        console.log(`${LOG_PREFIX} Received command: ${command}`);

        try {
            await routeCommand(command, payload, win, connectionManager, lifecycleManager);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`${LOG_PREFIX} Error handling command "${command}": ${errorMessage}`);
            sendError(win, errorMessage, command);
        }
    });

    console.log(`${LOG_PREFIX} IPC handlers registered`);
}
