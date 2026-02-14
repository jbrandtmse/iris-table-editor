/**
 * Electron preload script - exposed as window.iteMessageBridge
 * Story 11.1: Electron Bootstrap
 * Story 11.2: IPC Bridge — channel validation
 * Story 11.3: Tab Bar — emitLocalEvent for renderer-side event dispatch
 *
 * Exposes the IMessageBridge interface to the renderer process via contextBridge.
 * Uses ipcRenderer for communication with the main process.
 *
 * Security: Only exposes typed wrapper functions, never raw ipcRenderer.
 * Channel validation: Validates command and event names against allowlists.
 * State: In-memory state persistence (no disk persistence yet, Story 11.5).
 *
 * IPC channel design:
 * - Outbound (renderer -> main): ipcRenderer.send('command', { command, payload })
 * - Inbound (main -> renderer): ipcRenderer.on('event:{eventName}', (_, payload) => ...)
 * - Local (renderer only): emitLocalEvent dispatches to onEvent callbacks without IPC
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { isValidCommand, isValidEvent } from './channelValidation';

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
 * Story 11.3: Local callback registry for renderer-side event dispatch.
 * Parallel to ipcRenderer listeners, used by emitLocalEvent() to dispatch
 * events that stay within the renderer (e.g., restoreGridState for tab switching).
 */
const localCallbacks = new Map<string, Set<(payload: unknown) => void>>();

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
     * Validates command name against the allowlist before sending.
     * @param command - Command name (e.g., 'getServers', 'connectServer')
     * @param payload - Command payload data
     */
    sendCommand(command: string, payload: unknown): void {
        if (!isValidCommand(command)) {
            console.warn(`${LOG_PREFIX} Rejected invalid command: "${command}"`);
            return;
        }
        console.log(`${LOG_PREFIX} Sending command: ${command}`);
        ipcRenderer.send('command', { command, payload });
    },

    /**
     * Register a handler for events from the main process.
     * Also registers in local callback registry for emitLocalEvent() support.
     * Validates event name against the allowlist before subscribing.
     * @param event - Event name (e.g., 'serversLoaded', 'connectionProgress')
     * @param handler - Callback receiving the event payload
     */
    onEvent(event: string, handler: (payload: unknown) => void): void {
        if (!isValidEvent(event)) {
            console.warn(`${LOG_PREFIX} Rejected invalid event subscription: "${event}"`);
            return;
        }
        // Register IPC listener
        const wrapper = getWrapper(event, handler);
        ipcRenderer.on(`event:${event}`, wrapper);

        // Story 11.3: Also register in local callback registry
        let callbacks = localCallbacks.get(event);
        if (!callbacks) {
            callbacks = new Set();
            localCallbacks.set(event, callbacks);
        }
        callbacks.add(handler);
    },

    /**
     * Remove an event handler registered with onEvent.
     * Also removes from local callback registry.
     * @param event - Event name to unsubscribe from
     * @param handler - The original handler passed to onEvent
     */
    offEvent(event: string, handler: (payload: unknown) => void): void {
        // Remove IPC listener
        const wrapper = removeWrapper(event, handler);
        if (wrapper) {
            ipcRenderer.removeListener(`event:${event}`, wrapper);
        } else {
            console.warn(`${LOG_PREFIX} No wrapper found for offEvent("${event}"), handler may not have been registered`);
        }

        // Story 11.3: Also remove from local callback registry
        const callbacks = localCallbacks.get(event);
        if (callbacks) {
            callbacks.delete(handler);
            if (callbacks.size === 0) {
                localCallbacks.delete(event);
            }
        }
    },

    /**
     * Story 11.3: Emit an event locally within the renderer process.
     * Dispatches to callbacks registered via onEvent() without going through IPC.
     * Used for tab switching (e.g., restoreGridState) where grid.js needs to
     * receive an event triggered by tab-bar.js in the same renderer.
     *
     * @param eventName - Event name (must pass channel validation)
     * @param payload - Event payload data
     */
    emitLocalEvent(eventName: string, payload: unknown): void {
        if (!isValidEvent(eventName)) {
            console.warn(`${LOG_PREFIX} Invalid event name for local emit: "${eventName}"`);
            return;
        }
        const callbacks = localCallbacks.get(eventName);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(payload);
                } catch (e) {
                    console.error(`${LOG_PREFIX} Error in local event callback for "${eventName}":`, e);
                }
            });
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
