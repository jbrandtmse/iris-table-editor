// IRIS Table Editor - Webview main script

(function() {
    const LOG_PREFIX = '[IRIS-TE Webview]';

    // Acquire VS Code API
    const vscode = acquireVsCodeApi();

    // Restore previous state if available
    const previousState = vscode.getState() || {};

    /**
     * HTML escaping to prevent XSS in text content
     * @param {string} text - Text to escape
     * @returns {string} Escaped text safe for innerHTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape string for use in HTML attributes (includes quote escaping)
     * @param {string} text - Text to escape
     * @returns {string} Escaped text safe for HTML attributes
     */
    function escapeAttr(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Screen reader announcements via ARIA live region
     * @param {string} message - Message to announce
     */
    function announce(message) {
        const liveRegion = document.getElementById('ite-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    /**
     * Application state management
     */
    class AppState {
        constructor(initialState = {}) {
            this._state = {
                // Server list state
                servers: [],
                selectedServer: initialState.selectedServer || null,
                isLoading: true,
                loadingContext: 'loadingServers',
                error: null,
                serverManagerInstalled: true,
                serversConfigured: true,

                // Connection state (Story 1.4)
                connectionState: initialState.connectionState || 'disconnected', // 'disconnected' | 'connecting' | 'connected'
                connectedServer: initialState.connectedServer || null
            };
            this._listeners = [];
        }

        get state() {
            return this._state;
        }

        update(changes) {
            this._state = { ...this._state, ...changes };
            // Persist state for webview restoration
            vscode.setState({
                selectedServer: this._state.selectedServer,
                connectionState: this._state.connectionState,
                connectedServer: this._state.connectedServer
            });
            this._notifyListeners();
        }

        subscribe(listener) {
            this._listeners.push(listener);
            return () => {
                this._listeners = this._listeners.filter(l => l !== listener);
            };
        }

        _notifyListeners() {
            this._listeners.forEach(listener => listener(this._state));
        }
    }

    const appState = new AppState(previousState);

    /**
     * Handle messages from extension
     * @param {MessageEvent} event - Message event
     */
    function handleMessage(event) {
        const message = event.data;
        console.debug(`${LOG_PREFIX} Received event: ${message.event}`);

        switch (message.event) {
            case 'serverList':
                appState.update({
                    servers: message.payload.servers,
                    isLoading: false,
                    serverManagerInstalled: true,
                    serversConfigured: true,
                    error: null
                });
                announce(`${message.payload.servers.length} servers available`);
                break;

            case 'serverManagerNotInstalled':
                appState.update({
                    isLoading: false,
                    serverManagerInstalled: false,
                    error: null
                });
                announce('Server Manager extension required');
                break;

            case 'noServersConfigured':
                appState.update({
                    isLoading: false,
                    serverManagerInstalled: true,
                    serversConfigured: false,
                    servers: [],
                    error: null
                });
                announce('No servers configured');
                break;

            case 'connectionStatus':
                handleConnectionStatus(message.payload);
                break;

            case 'connectionError':
                handleConnectionError(message.payload);
                break;

            case 'error':
                appState.update({
                    isLoading: false,
                    error: message.payload
                });
                announce(`Error: ${message.payload.message}`);
                break;
        }
    }

    /**
     * Handle connection status event
     * @param {object} payload - Connection status payload
     */
    function handleConnectionStatus(payload) {
        if (payload.connected) {
            appState.update({
                connectionState: 'connected',
                connectedServer: payload.serverName,
                isLoading: false,
                error: null
            });
            announce(`Connected to ${payload.serverName}`);
        } else {
            appState.update({
                connectionState: 'disconnected',
                connectedServer: null,
                isLoading: false
            });
            announce('Disconnected from server');
        }
    }

    /**
     * Handle connection error event
     * @param {object} payload - Connection error payload
     */
    function handleConnectionError(payload) {
        appState.update({
            connectionState: 'disconnected',
            isLoading: false,
            error: {
                message: payload.message,
                code: payload.code,
                recoverable: payload.recoverable,
                context: payload.context
            }
        });
        announce(`Connection error: ${payload.message}`);
    }

    /**
     * Post command to extension
     * @param {string} command - Command name
     * @param {object} payload - Command payload
     */
    function postCommand(command, payload = {}) {
        vscode.postMessage({ command, payload });
    }

    /**
     * Handle server selection
     * @param {string} serverName - Selected server name
     */
    function selectServer(serverName) {
        // Show connecting state
        appState.update({
            selectedServer: serverName,
            connectionState: 'connecting',
            isLoading: true,
            loadingContext: 'connecting',
            error: null
        });
        announce(`Connecting to ${serverName}...`);
        postCommand('selectServer', { serverName });
    }

    /**
     * Handle disconnect button click
     */
    function disconnect() {
        postCommand('disconnect');
    }

    /**
     * Main render function
     * @param {object} state - Current application state
     */
    function render(state) {
        const container = document.querySelector('.ite-container');

        // Show connecting state
        if (state.connectionState === 'connecting' || (state.isLoading && state.loadingContext === 'connecting')) {
            container.innerHTML = renderConnecting(state.selectedServer);
            return;
        }

        // Show loading (for servers)
        if (state.isLoading && state.loadingContext === 'loadingServers') {
            container.innerHTML = renderLoading();
            return;
        }

        // Show connected state
        if (state.connectionState === 'connected' && state.connectedServer) {
            container.innerHTML = renderConnected(state.connectedServer);
            attachConnectedEvents();
            return;
        }

        // Check error first so it's not masked by other states
        if (state.error) {
            container.innerHTML = renderError(state.error);
            attachErrorEvents();
            return;
        }

        if (!state.serverManagerInstalled) {
            container.innerHTML = renderServerManagerNotInstalled();
            return;
        }

        if (!state.serversConfigured || state.servers.length === 0) {
            container.innerHTML = renderNoServers();
            attachNoServersEvents();
            return;
        }

        container.innerHTML = renderServerList(state.servers, state.selectedServer);
        attachServerListEvents();
    }

    /**
     * Render loading state
     * @returns {string} HTML string
     */
    function renderLoading() {
        return `
            <div class="ite-loading">
                <div class="ite-loading__spinner"></div>
                <p class="ite-loading__text">Loading servers...</p>
            </div>
        `;
    }

    /**
     * Render connecting state
     * @param {string} serverName - Server being connected to
     * @returns {string} HTML string
     */
    function renderConnecting(serverName) {
        const safeName = escapeHtml(serverName || 'server');
        return `
            <div class="ite-loading">
                <div class="ite-loading__spinner"></div>
                <p class="ite-loading__text">Connecting to ${safeName}...</p>
            </div>
        `;
    }

    /**
     * Render connected state
     * @param {string} serverName - Connected server name
     * @returns {string} HTML string
     */
    function renderConnected(serverName) {
        const safeName = escapeHtml(serverName);
        return `
            <div class="ite-connection-header">
                <div class="ite-connection-header__status">
                    <span class="ite-connection-header__indicator ite-connection-header__indicator--connected"></span>
                    <span class="ite-connection-header__label">Connected to</span>
                </div>
                <div class="ite-connection-header__server">${safeName}</div>
                <button class="ite-button ite-button--secondary ite-connection-header__disconnect"
                        id="disconnectBtn"
                        aria-label="Disconnect from ${escapeAttr(serverName)}">
                    <span class="codicon codicon-debug-disconnect"></span>
                    Disconnect
                </button>
            </div>
            <div class="ite-connected-content">
                <p class="ite-connected-content__placeholder">Ready to browse namespaces</p>
                <p class="ite-connected-content__hint">(Namespace browsing will be available in the next update)</p>
            </div>
        `;
    }

    /**
     * Render Server Manager not installed state
     * @returns {string} HTML string
     */
    function renderServerManagerNotInstalled() {
        return `
            <div class="ite-message ite-message--warning">
                <h3 class="ite-message__title">InterSystems Server Manager extension required</h3>
                <p class="ite-message__text">Install the Server Manager extension to connect to IRIS servers.</p>
                <a href="vscode:extension/intersystems-community.servermanager"
                   class="ite-button ite-button--primary">
                    Install Server Manager
                </a>
            </div>
        `;
    }

    /**
     * Render no servers configured state
     * @returns {string} HTML string
     */
    function renderNoServers() {
        return `
            <div class="ite-message">
                <h3 class="ite-message__title">No Servers Configured</h3>
                <p class="ite-message__text">Add a server in InterSystems Server Manager to get started.</p>
                <button class="ite-button ite-button--secondary" id="openServerManagerBtn">
                    Open Server Manager
                </button>
            </div>
        `;
    }

    /**
     * Render error state
     * @param {object} error - Error object with message property
     * @returns {string} HTML string
     */
    function renderError(error) {
        // SECURITY: Escape error message to prevent XSS
        const safeMessage = escapeHtml(error.message);
        return `
            <div class="ite-message ite-message--error">
                <h3 class="ite-message__title">Connection Error</h3>
                <p class="ite-message__text">${safeMessage}</p>
                <button class="ite-button ite-button--secondary" id="retryBtn">
                    Try Again
                </button>
            </div>
        `;
    }

    /**
     * Render server list
     * @param {string[]} servers - Array of server names
     * @param {string|null} selectedServer - Currently selected server
     * @returns {string} HTML string
     */
    function renderServerList(servers, selectedServer) {
        const serverItems = servers.map((server, index) => {
            const isSelected = server === selectedServer;
            const selectedClass = isSelected ? 'ite-server-list__item--selected' : '';
            // Escape server name for attribute context (quotes) and content context
            const safeAttr = escapeAttr(server);
            const safeName = escapeHtml(server);
            return `
                <div class="ite-server-list__item ${selectedClass}"
                     data-server="${safeAttr}"
                     data-index="${index}"
                     tabindex="0"
                     role="option"
                     aria-selected="${isSelected}">
                    <span class="ite-server-list__icon codicon codicon-server"></span>
                    <span class="ite-server-list__name">${safeName}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="ite-server-list__header-row">
                <h3 class="ite-server-list__header">Select a Server</h3>
                <button class="ite-button ite-button--icon" id="refreshBtn"
                        title="Refresh server list" aria-label="Refresh server list">
                    <span class="codicon codicon-refresh"></span>
                </button>
            </div>
            <div class="ite-server-list" role="listbox" aria-label="Available servers">
                ${serverItems}
            </div>
        `;
    }

    /**
     * Attach event listeners for server list (called after render)
     */
    function attachServerListEvents() {
        const serverList = document.querySelector('.ite-server-list');
        if (!serverList) {
            return;
        }

        // Click handler for server selection
        serverList.addEventListener('click', (e) => {
            const item = e.target.closest('.ite-server-list__item');
            if (item) {
                const serverName = item.dataset.server;
                selectServer(serverName);
            }
        });

        // Keyboard navigation
        serverList.addEventListener('keydown', (e) => {
            const item = e.target.closest('.ite-server-list__item');
            if (!item) {
                return;
            }

            const items = Array.from(serverList.querySelectorAll('.ite-server-list__item'));
            const currentIndex = parseInt(item.dataset.index, 10);

            switch (e.key) {
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    selectServer(item.dataset.server);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex < items.length - 1) {
                        items[currentIndex + 1].focus();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex > 0) {
                        items[currentIndex - 1].focus();
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    items[0]?.focus();
                    break;
                case 'End':
                    e.preventDefault();
                    items[items.length - 1]?.focus();
                    break;
            }
        });

        // Focus first item or selected item after render
        const selectedItem = serverList.querySelector('.ite-server-list__item--selected');
        const firstItem = serverList.querySelector('.ite-server-list__item');
        (selectedItem || firstItem)?.focus();

        // Attach refresh button handler
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', refreshServers);
        }
    }

    /**
     * Attach event listeners for connected state
     */
    function attachConnectedEvents() {
        const disconnectBtn = document.getElementById('disconnectBtn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', disconnect);
        }
    }

    /**
     * Attach event listeners for error state
     */
    function attachErrorEvents() {
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                appState.update({ error: null });
                refreshServers();
            });
        }
    }

    /**
     * Attach event listeners for no servers state
     */
    function attachNoServersEvents() {
        const openBtn = document.getElementById('openServerManagerBtn');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                postCommand('openServerManager');
            });
        }
    }

    /**
     * Refresh the server list
     */
    function refreshServers() {
        appState.update({
            isLoading: true,
            loadingContext: 'loadingServers',
            error: null,
            connectionState: 'disconnected',
            connectedServer: null
        });
        announce('Loading servers');
        postCommand('getServerList');
    }

    // Initialize
    window.addEventListener('message', handleMessage);
    appState.subscribe(render);

    // Request server list on load (unless already connected)
    if (previousState.connectionState !== 'connected') {
        console.debug(`${LOG_PREFIX} Webview initialized, requesting server list`);
        postCommand('getServerList');
    } else {
        // Re-render with previous state
        console.debug(`${LOG_PREFIX} Webview initialized, restoring connected state`);
        appState.update({
            isLoading: false,
            connectionState: previousState.connectionState,
            connectedServer: previousState.connectedServer
        });
    }
})();
