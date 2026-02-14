/**
 * Electron preload script - exposed as window.iteMessageBridge
 * Story 11.1: Electron Bootstrap
 *
 * Exposes the IMessageBridge interface to the renderer process via contextBridge.
 * Uses ipcRenderer for communication with the main process.
 *
 * Security: Only exposes typed wrapper functions, never raw ipcRenderer.
 * State: In-memory state persistence (no disk persistence yet, Story 11.5).
 *
 * IPC channel design:
 * - Outbound (renderer -> main): ipcRenderer.send('command', { command, payload })
 * - Inbound (main -> renderer): ipcRenderer.on('event:{eventName}', (_, payload) => ...)
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

const LOG_PREFIX = '[IRIS-TE Preload]';

/**
 * In-memory state store for webview state persistence.
 * Will be replaced with persistent storage in Story 11.5.
 */
let webviewState: Record<string, unknown> | undefined;

/**
 * WeakMap to track wrapper functions for proper offEvent removal.
 * Maps original handler -> Map of eventName -> wrapper function.
 * This is necessary because ipcRenderer.on() receives an IpcRendererEvent
 * as the first argument, but the IMessageBridge handler only expects the payload.
 */
const handlerWrapperMap = new WeakMap<
    (payload: unknown) => void,
    Map<string, (event: IpcRendererEvent, payload: unknown) => void>
>();

/**
 * Get or create a wrapper function for an event handler.
 * The wrapper strips the IpcRendererEvent and passes only the payload.
 */
function getWrapper(
    eventName: string,
    handler: (payload: unknown) => void
): (event: IpcRendererEvent, payload: unknown) => void {
    let eventMap = handlerWrapperMap.get(handler);
    if (!eventMap) {
        eventMap = new Map();
        handlerWrapperMap.set(handler, eventMap);
    }

    let wrapper = eventMap.get(eventName);
    if (!wrapper) {
        wrapper = (_event: IpcRendererEvent, payload: unknown) => handler(payload);
        eventMap.set(eventName, wrapper);
    }

    return wrapper;
}

/**
 * Remove and return the wrapper function for proper cleanup.
 */
function removeWrapper(
    eventName: string,
    handler: (payload: unknown) => void
): ((event: IpcRendererEvent, payload: unknown) => void) | undefined {
    const eventMap = handlerWrapperMap.get(handler);
    if (!eventMap) {
        return undefined;
    }

    const wrapper = eventMap.get(eventName);
    if (wrapper) {
        eventMap.delete(eventName);
        // Clean up empty maps
        if (eventMap.size === 0) {
            handlerWrapperMap.delete(handler);
        }
    }

    return wrapper;
}

/**
 * IMessageBridge implementation exposed to the renderer via contextBridge.
 * Matches the interface defined in @iris-te/core.
 */
const messageBridge = {
    /**
     * Send a command from the renderer to the main process.
     * @param command - Command name (e.g., 'getServers', 'connectServer')
     * @param payload - Command payload data
     */
    sendCommand(command: string, payload: unknown): void {
        console.log(`${LOG_PREFIX} Sending command: ${command}`);
        ipcRenderer.send('command', { command, payload });
    },

    /**
     * Register a handler for events from the main process.
     * @param event - Event name (e.g., 'serversLoaded', 'connectionProgress')
     * @param handler - Callback receiving the event payload
     */
    onEvent(event: string, handler: (payload: unknown) => void): void {
        const wrapper = getWrapper(event, handler);
        ipcRenderer.on(`event:${event}`, wrapper);
    },

    /**
     * Remove an event handler registered with onEvent.
     * @param event - Event name to unsubscribe from
     * @param handler - The original handler passed to onEvent
     */
    offEvent(event: string, handler: (payload: unknown) => void): void {
        const wrapper = removeWrapper(event, handler);
        if (wrapper) {
            ipcRenderer.removeListener(`event:${event}`, wrapper);
        } else {
            console.warn(`${LOG_PREFIX} No wrapper found for offEvent("${event}"), handler may not have been registered`);
        }
    },

    /**
     * Get persisted webview state (in-memory only for now).
     * @returns The stored state object, or undefined if none set
     */
    getState(): Record<string, unknown> | undefined {
        return webviewState;
    },

    /**
     * Persist webview state (in-memory only for now).
     * @param state - State object to store
     */
    setState(state: Record<string, unknown>): void {
        webviewState = state;
    },
};

// Expose the message bridge to the renderer via contextBridge
contextBridge.exposeInMainWorld('iteMessageBridge', messageBridge);

console.log(`${LOG_PREFIX} Message bridge exposed`);
