/**
 * IRIS Table Editor - Web IMessageBridge Implementation
 * Story 17.1: SPA Shell
 *
 * Implements the IMessageBridge interface over WebSocket for the web target.
 * Uses the existing ws-reconnect.js WebSocket connection (does not create its own).
 * State is persisted in sessionStorage.
 *
 * Uses vanilla JS, BEM CSS, event delegation.
 */
(function () {
    'use strict';

    var LOG_PREFIX = '[IRIS-TE Bridge]';
    var STATE_KEY = 'ite-webview-state';

    /**
     * WebMessageBridge implements IMessageBridge for the web target.
     * Sends commands as JSON over WebSocket and dispatches incoming events
     * to registered handlers.
     *
     * @constructor
     */
    function WebMessageBridge() {
        /** @type {Map<string, Set<function>>} */
        this._handlers = new Map();
        /** @type {Array<string>} - Buffered messages when WebSocket is not yet OPEN */
        this._pendingMessages = [];

        // Listen for WebSocket messages dispatched by ws-reconnect.js
        var self = this;
        this._wsMessageHandler = function (e) {
            // Receiving a message means WS is open; flush any buffered commands
            self._flushPendingMessages();
            var data = e.detail;
            if (data && data.event) {
                self._dispatch(data.event, data.payload);
            }
        };
        document.addEventListener('ite-ws-message', this._wsMessageHandler);

        // Flush buffered commands when WebSocket opens
        this._wsOpenHandler = function () {
            self._flushPendingMessages();
        };
        document.addEventListener('ite-ws-reconnected', this._wsOpenHandler);

        console.debug(LOG_PREFIX, 'WebMessageBridge initialized');
    }

    /**
     * Send a command from webview to host via WebSocket.
     * @param {string} command - Command name
     * @param {unknown} payload - Command payload
     */
    WebMessageBridge.prototype.sendCommand = function (command, payload) {
        var message = JSON.stringify({ command: command, payload: payload });
        var wsState = window.iteWsReconnect && window.iteWsReconnect.getState();
        var ws = wsState && wsState.ws;

        if (ws && ws.readyState === WebSocket.OPEN) {
            // Flush any buffered messages first (preserves ordering)
            this._flushPendingMessages();
            ws.send(message);
        } else {
            console.debug(LOG_PREFIX, 'WebSocket not yet open, buffering command:', command);
            this._pendingMessages.push(message);
        }
    };

    /**
     * Flush buffered messages once WebSocket is open.
     * @private
     */
    WebMessageBridge.prototype._flushPendingMessages = function () {
        if (this._pendingMessages.length === 0) {
            return;
        }
        var wsState = window.iteWsReconnect && window.iteWsReconnect.getState();
        var ws = wsState && wsState.ws;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        console.debug(LOG_PREFIX, 'Flushing', this._pendingMessages.length, 'buffered commands');
        for (var i = 0; i < this._pendingMessages.length; i++) {
            ws.send(this._pendingMessages[i]);
        }
        this._pendingMessages = [];
    };

    /**
     * Register a handler for events from host.
     * @param {string} event - Event name
     * @param {function} handler - Event handler
     */
    WebMessageBridge.prototype.onEvent = function (event, handler) {
        if (!this._handlers.has(event)) {
            this._handlers.set(event, new Set());
        }
        this._handlers.get(event).add(handler);
    };

    /**
     * Remove an event handler.
     * @param {string} event - Event name
     * @param {function} handler - Event handler to remove
     */
    WebMessageBridge.prototype.offEvent = function (event, handler) {
        var handlers = this._handlers.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
    };

    /**
     * Get persisted webview state from sessionStorage.
     * @returns {Record<string, unknown> | undefined}
     */
    WebMessageBridge.prototype.getState = function () {
        try {
            var stored = sessionStorage.getItem(STATE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn(LOG_PREFIX, 'Failed to read state from sessionStorage:', e);
        }
        return undefined;
    };

    /**
     * Persist webview state to sessionStorage.
     * @param {Record<string, unknown>} state
     */
    WebMessageBridge.prototype.setState = function (state) {
        try {
            sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn(LOG_PREFIX, 'Failed to write state to sessionStorage:', e);
        }
    };

    /**
     * Dispatch an event to registered handlers.
     * @param {string} event - Event name
     * @param {unknown} payload - Event payload
     * @private
     */
    WebMessageBridge.prototype._dispatch = function (event, payload) {
        var handlers = this._handlers.get(event);
        if (handlers) {
            handlers.forEach(function (handler) {
                try {
                    handler(payload);
                } catch (err) {
                    console.error(LOG_PREFIX, 'Error in event handler for', event, ':', err);
                }
            });
        }
    };

    /**
     * Tear down the bridge: remove all event handlers and DOM listeners.
     */
    WebMessageBridge.prototype.destroy = function () {
        document.removeEventListener('ite-ws-message', this._wsMessageHandler);
        document.removeEventListener('ite-ws-reconnected', this._wsOpenHandler);
        this._handlers.clear();
        this._pendingMessages = [];
        console.debug(LOG_PREFIX, 'WebMessageBridge destroyed');
    };

    // ============================================
    // Bridge Lifecycle Management
    // ============================================

    /**
     * Initialize the bridge and set it on window BEFORE webview scripts load.
     * Called when WebSocket connection is established (connected view shown).
     */
    function initBridge() {
        // Destroy existing bridge if any (e.g., on reconnect)
        if (window.iteMessageBridge && typeof window.iteMessageBridge.destroy === 'function') {
            window.iteMessageBridge.destroy();
        }
        window.iteMessageBridge = new WebMessageBridge();
    }

    /**
     * Tear down the bridge on disconnect.
     */
    function teardownBridge() {
        if (window.iteMessageBridge && typeof window.iteMessageBridge.destroy === 'function') {
            window.iteMessageBridge.destroy();
        }
        window.iteMessageBridge = null;
    }

    // Initialize bridge when connected view becomes visible (WebSocket connected)
    var connectedView = document.getElementById('connectedView');
    if (connectedView) {
        var bridgeObserver = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].attributeName === 'hidden') {
                    if (!connectedView.hidden) {
                        initBridge();
                    } else {
                        teardownBridge();
                    }
                }
            }
        });
        bridgeObserver.observe(connectedView, { attributes: true, attributeFilter: ['hidden'] });

        // If already in connected state at script load time, initialize immediately
        if (!connectedView.hidden) {
            initBridge();
        }
    }

    // Re-initialize bridge on WebSocket reconnect
    document.addEventListener('ite-ws-reconnected', function () {
        console.debug(LOG_PREFIX, 'WebSocket reconnected, re-initializing bridge');
        initBridge();
    });

    // Expose for testing
    window.iteWebMessageBridge = {
        WebMessageBridge: WebMessageBridge,
        initBridge: initBridge,
        teardownBridge: teardownBridge
    };
})();
