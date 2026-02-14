/**
 * VS Code implementation of IMessageBridge.
 * Runs IN the webview (renderer context), not in the extension host.
 * Wraps acquireVsCodeApi() for webview-to-extension communication.
 */
class VSCodeMessageBridge {
    constructor() {
        // @ts-ignore - acquireVsCodeApi is provided by VS Code webview runtime
        this._vscodeApi = acquireVsCodeApi();
        /** @type {Map<string, Set<function>>} */
        this._handlers = new Map();

        // Listen for messages from extension host
        this._messageListener = (e) => {
            const message = e.data;
            if (message && message.event) {
                const handlers = this._handlers.get(message.event);
                if (handlers) {
                    handlers.forEach(handler => handler(message.payload));
                }
            }
        };
        window.addEventListener('message', this._messageListener);
    }

    /**
     * Send a command from webview to host
     * @param {string} command - Command name
     * @param {unknown} payload - Command payload
     */
    sendCommand(command, payload) {
        this._vscodeApi.postMessage({ command, payload });
    }

    /**
     * Register a handler for events from host
     * @param {string} event - Event name
     * @param {function} handler - Event handler
     */
    onEvent(event, handler) {
        if (!this._handlers.has(event)) {
            this._handlers.set(event, new Set());
        }
        this._handlers.get(event).add(handler);
    }

    /**
     * Remove an event handler
     * @param {string} event - Event name
     * @param {function} handler - Event handler to remove
     */
    offEvent(event, handler) {
        const handlers = this._handlers.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    /**
     * Get persisted webview state
     * @returns {Record<string, unknown> | undefined}
     */
    getState() {
        return this._vscodeApi.getState();
    }

    /**
     * Persist webview state
     * @param {Record<string, unknown>} state
     */
    setState(state) {
        this._vscodeApi.setState(state);
    }
}
