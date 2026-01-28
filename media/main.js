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
                connectedServer: initialState.connectedServer || null,

                // Namespace state (Story 1.5)
                namespaces: [],
                selectedNamespace: initialState.selectedNamespace || null,
                namespacesLoading: false,
                namespaceError: null,

                // Table state (Story 1.6)
                tables: [],
                selectedTable: initialState.selectedTable || null,
                tablesLoading: false,
                tableError: null
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
                connectedServer: this._state.connectedServer,
                selectedNamespace: this._state.selectedNamespace,
                selectedTable: this._state.selectedTable
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

            case 'namespaceList':
                handleNamespaceList(message.payload);
                break;

            case 'namespaceSelected':
                handleNamespaceSelected(message.payload);
                break;

            case 'tableList':
                handleTableList(message.payload);
                break;

            case 'tableSelected':
                handleTableSelected(message.payload);
                break;

            case 'error':
                // Check if this is a namespace-related error (context-aware handling)
                if (message.payload.context === 'getNamespaces' && appState.state.connectionState === 'connected') {
                    // Namespace error while connected - show inline, don't disconnect
                    appState.update({
                        namespacesLoading: false,
                        namespaceError: message.payload
                    });
                } else if (message.payload.context === 'getTables' && appState.state.connectionState === 'connected') {
                    // Table error while connected - show inline, don't disconnect
                    appState.update({
                        tablesLoading: false,
                        tableError: message.payload
                    });
                } else {
                    // General error - show full error state
                    appState.update({
                        isLoading: false,
                        namespacesLoading: false,
                        tablesLoading: false,
                        error: message.payload
                    });
                }
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
                namespacesLoading: true, // Namespaces will be fetched automatically
                error: null
            });
            announce(`Connected to ${payload.serverName}`);
        } else {
            appState.update({
                connectionState: 'disconnected',
                connectedServer: null,
                namespaces: [],
                selectedNamespace: null,
                namespacesLoading: false,
                tables: [],
                selectedTable: null,
                tablesLoading: false,
                isLoading: false
            });
            announce('Disconnected from server');
        }
    }

    /**
     * Handle namespace list event
     * @param {object} payload - Namespace list payload
     */
    function handleNamespaceList(payload) {
        const previousSelectedNamespace = appState.state.selectedNamespace;

        appState.update({
            namespaces: payload.namespaces,
            namespacesLoading: false,
            error: null
        });
        announce(`${payload.namespaces.length} namespaces available`);

        // If we had a previously selected namespace (from state restoration),
        // and it still exists in the new namespace list, re-fetch tables for it
        if (previousSelectedNamespace && payload.namespaces.includes(previousSelectedNamespace)) {
            appState.update({
                tablesLoading: true,
                tableError: null
            });
            postCommand('getTables', { namespace: previousSelectedNamespace });
        } else if (previousSelectedNamespace && !payload.namespaces.includes(previousSelectedNamespace)) {
            // Previous namespace no longer exists - clear selection
            appState.update({
                selectedNamespace: null,
                selectedTable: null
            });
        }
    }

    /**
     * Handle namespace selected event
     * @param {object} payload - Namespace selected payload
     */
    function handleNamespaceSelected(payload) {
        appState.update({
            selectedNamespace: payload.namespace,
            tables: [],
            selectedTable: null,
            tablesLoading: true,  // Tables will be fetched automatically
            tableError: null
        });
        announce(`Selected namespace ${payload.namespace}`);
    }

    /**
     * Handle table list event
     * @param {object} payload - Table list payload
     */
    function handleTableList(payload) {
        appState.update({
            tables: payload.tables,
            tablesLoading: false,
            tableError: null
        });
        announce(`${payload.tables.length} table${payload.tables.length !== 1 ? 's' : ''} available`);
    }

    /**
     * Handle table selected event
     * @param {object} payload - Table selected payload
     */
    function handleTableSelected(payload) {
        appState.update({
            selectedTable: payload.tableName
        });
        announce(`Selected table ${payload.tableName}`);
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
            container.innerHTML = renderConnected(
                state.connectedServer,
                state.namespaces,
                state.selectedNamespace,
                state.namespacesLoading,
                state.namespaceError,
                state.tables,
                state.selectedTable,
                state.tablesLoading,
                state.tableError
            );
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
     * @param {string[]} namespaces - Array of namespace names
     * @param {string|null} selectedNamespace - Currently selected namespace
     * @param {boolean} namespacesLoading - Whether namespaces are being loaded
     * @param {object|null} namespaceError - Namespace-specific error (if any)
     * @param {string[]} tables - Array of table names
     * @param {string|null} selectedTable - Currently selected table
     * @param {boolean} tablesLoading - Whether tables are being loaded
     * @param {object|null} tableError - Table-specific error (if any)
     * @returns {string} HTML string
     */
    function renderConnected(serverName, namespaces, selectedNamespace, namespacesLoading, namespaceError, tables, selectedTable, tablesLoading, tableError) {
        const safeName = escapeHtml(serverName);
        const connectionHeader = `
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
        `;

        // Show loading spinner while fetching namespaces
        if (namespacesLoading) {
            return connectionHeader + `
                <div class="ite-loading">
                    <div class="ite-loading__spinner"></div>
                    <p class="ite-loading__text">Loading namespaces...</p>
                </div>
            `;
        }

        // Show namespace error inline (stays connected, can retry)
        if (namespaceError) {
            const safeMessage = escapeHtml(namespaceError.message);
            return connectionHeader + `
                <div class="ite-message ite-message--error">
                    <h3 class="ite-message__title">Failed to Load Namespaces</h3>
                    <p class="ite-message__text">${safeMessage}</p>
                    <button class="ite-button ite-button--secondary" id="retryNamespacesBtn">
                        <span class="codicon codicon-refresh"></span>
                        Retry
                    </button>
                </div>
            `;
        }

        // Show message if no namespaces available
        if (namespaces.length === 0) {
            return connectionHeader + `
                <div class="ite-message">
                    <h3 class="ite-message__title">No Namespaces Available</h3>
                    <p class="ite-message__text">No accessible namespaces found on this server.</p>
                </div>
            `;
        }

        // Render namespace list
        let html = connectionHeader + renderNamespaceList(namespaces, selectedNamespace);

        // If namespace is selected, show table section
        if (selectedNamespace) {
            html += renderTableSection(selectedNamespace, tables, selectedTable, tablesLoading, tableError);
        }

        return html;
    }

    /**
     * Render table section (loading, error, empty, or list)
     * @param {string} namespace - Selected namespace
     * @param {string[]} tables - Array of table names
     * @param {string|null} selectedTable - Currently selected table
     * @param {boolean} tablesLoading - Whether tables are being loaded
     * @param {object|null} tableError - Table-specific error (if any)
     * @returns {string} HTML string
     */
    function renderTableSection(namespace, tables, selectedTable, tablesLoading, tableError) {
        // Show loading spinner while fetching tables
        if (tablesLoading) {
            return `
                <div class="ite-loading">
                    <div class="ite-loading__spinner"></div>
                    <p class="ite-loading__text">Loading tables...</p>
                </div>
            `;
        }

        // Show table error inline (stays connected, can retry)
        if (tableError) {
            const safeMessage = escapeHtml(tableError.message);
            return `
                <div class="ite-message ite-message--error">
                    <h3 class="ite-message__title">Failed to Load Tables</h3>
                    <p class="ite-message__text">${safeMessage}</p>
                    <button class="ite-button ite-button--secondary" id="retryTablesBtn">
                        <span class="codicon codicon-refresh"></span>
                        Retry
                    </button>
                </div>
            `;
        }

        // Show message if no tables available
        if (tables.length === 0) {
            return `
                <div class="ite-message">
                    <h3 class="ite-message__title">No Tables Found</h3>
                    <p class="ite-message__text">No tables found in namespace "${escapeHtml(namespace)}".</p>
                </div>
            `;
        }

        // Render table list
        return renderTableList(tables, selectedTable, namespace);
    }

    /**
     * Render table list
     * @param {string[]} tables - Array of table names
     * @param {string|null} selectedTable - Currently selected table
     * @param {string} namespace - Current namespace
     * @returns {string} HTML string
     */
    function renderTableList(tables, selectedTable, namespace) {
        const tableItems = tables.map((table, index) => {
            const isSelected = table === selectedTable;
            const selectedClass = isSelected ? 'ite-table-list__item--selected' : '';
            const safeAttr = escapeAttr(table);
            const safeName = escapeHtml(table);
            return `
                <div class="ite-table-list__item ${selectedClass}"
                     data-table="${safeAttr}"
                     data-namespace="${escapeAttr(namespace)}"
                     data-index="${index}"
                     tabindex="0"
                     role="option"
                     aria-selected="${isSelected}">
                    <span class="ite-table-list__icon codicon codicon-table"></span>
                    <span class="ite-table-list__name">${safeName}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="ite-table-list__header-row">
                <h3 class="ite-table-list__header">Select a Table</h3>
                <span class="ite-table-list__count">${tables.length} table${tables.length !== 1 ? 's' : ''}</span>
                <button class="ite-button ite-button--icon" id="refreshTablesBtn"
                        title="Refresh table list" aria-label="Refresh table list">
                    <span class="codicon codicon-refresh"></span>
                </button>
            </div>
            <div class="ite-table-list" role="listbox" aria-label="Available tables in ${escapeAttr(namespace)}">
                ${tableItems}
            </div>
        `;
    }

    /**
     * Render namespace list
     * @param {string[]} namespaces - Array of namespace names
     * @param {string|null} selectedNamespace - Currently selected namespace
     * @returns {string} HTML string
     */
    function renderNamespaceList(namespaces, selectedNamespace) {
        const namespaceItems = namespaces.map((ns, index) => {
            const isSelected = ns === selectedNamespace;
            const selectedClass = isSelected ? 'ite-namespace-list__item--selected' : '';
            const safeAttr = escapeAttr(ns);
            const safeName = escapeHtml(ns);
            return `
                <div class="ite-namespace-list__item ${selectedClass}"
                     data-namespace="${safeAttr}"
                     data-index="${index}"
                     tabindex="0"
                     role="option"
                     aria-selected="${isSelected}">
                    <span class="ite-namespace-list__icon codicon codicon-database"></span>
                    <span class="ite-namespace-list__name">${safeName}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="ite-namespace-list__header-row">
                <h3 class="ite-namespace-list__header">Select a Namespace</h3>
                <button class="ite-button ite-button--icon" id="refreshNamespacesBtn"
                        title="Refresh namespace list" aria-label="Refresh namespace list">
                    <span class="codicon codicon-refresh"></span>
                </button>
            </div>
            <div class="ite-namespace-list" role="listbox" aria-label="Available namespaces">
                ${namespaceItems}
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
     * Note: Uses focusServerListItem for initial focus only.
     * Click/keyboard events are handled via container delegation.
     */
    function attachServerListEvents() {
        const serverList = document.querySelector('.ite-server-list');
        if (!serverList) {
            return;
        }

        // Focus first item or selected item after render
        const selectedItem = serverList.querySelector('.ite-server-list__item--selected');
        const firstItem = serverList.querySelector('.ite-server-list__item');
        (selectedItem || firstItem)?.focus();
    }

    /**
     * Attach event listeners for connected state
     */
    function attachConnectedEvents() {
        const disconnectBtn = document.getElementById('disconnectBtn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', disconnect);
        }

        // Attach namespace list events if namespace list is rendered
        attachNamespaceListEvents();

        // Attach table list events if table list is rendered
        attachTableListEvents();
    }

    /**
     * Attach event listeners for namespace list
     * Note: Uses focus management only.
     * Click/keyboard events are handled via container delegation.
     */
    function attachNamespaceListEvents() {
        const namespaceList = document.querySelector('.ite-namespace-list');
        if (!namespaceList) {
            return;
        }

        // Focus first or selected item after render
        const selectedItem = namespaceList.querySelector('.ite-namespace-list__item--selected');
        const firstItem = namespaceList.querySelector('.ite-namespace-list__item');
        (selectedItem || firstItem)?.focus();
    }

    /**
     * Attach event listeners for table list
     * Note: Uses focus management only.
     * Click/keyboard events are handled via container delegation.
     */
    function attachTableListEvents() {
        const tableList = document.querySelector('.ite-table-list');
        if (!tableList) {
            return;
        }

        // Focus first or selected item after render
        const selectedItem = tableList.querySelector('.ite-table-list__item--selected');
        const firstItem = tableList.querySelector('.ite-table-list__item');
        (selectedItem || firstItem)?.focus();
    }

    /**
     * Handle namespace selection
     * @param {string} namespace - Selected namespace
     */
    function selectNamespace(namespace) {
        appState.update({
            selectedNamespace: namespace,
            tables: [],
            selectedTable: null,
            tablesLoading: true,
            tableError: null
        });
        announce(`Selected namespace ${namespace}`);
        postCommand('selectNamespace', { namespace });
    }

    /**
     * Handle table selection
     * @param {string} tableName - Selected table name
     * @param {string} namespace - Current namespace
     */
    function selectTable(tableName, namespace) {
        appState.update({
            selectedTable: tableName
        });
        announce(`Selected table ${tableName}`);
        postCommand('selectTable', { tableName, namespace });
    }

    /**
     * Refresh the table list
     */
    function refreshTables() {
        const namespace = appState.state.selectedNamespace;
        if (!namespace) return;

        appState.update({
            tablesLoading: true,
            tables: [],
            selectedTable: null,
            tableError: null
        });
        announce('Loading tables');
        postCommand('getTables', { namespace });
    }

    /**
     * Refresh the namespace list
     */
    function refreshNamespaces() {
        appState.update({
            namespacesLoading: true,
            namespaces: [],
            selectedNamespace: null
        });
        announce('Loading namespaces');
        postCommand('getNamespaces');
    }

    /**
     * Attach event listeners for error state
     * Note: Click events handled via container delegation
     */
    function attachErrorEvents() {
        // Events handled via container delegation
    }

    /**
     * Attach event listeners for no servers state
     * Note: Click events handled via container delegation
     */
    function attachNoServersEvents() {
        // Events handled via container delegation
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

    // Event delegation on container - persists across renders
    // This avoids listener stacking issues when innerHTML is replaced
    const container = document.querySelector('.ite-container');
    if (container) {
        // Click delegation
        container.addEventListener('click', (e) => {
            const target = e.target;

            // Server list item click
            const serverItem = target.closest('.ite-server-list__item');
            if (serverItem) {
                selectServer(serverItem.dataset.server);
                return;
            }

            // Namespace list item click
            const namespaceItem = target.closest('.ite-namespace-list__item');
            if (namespaceItem) {
                selectNamespace(namespaceItem.dataset.namespace);
                return;
            }

            // Table list item click
            const tableItem = target.closest('.ite-table-list__item');
            if (tableItem) {
                selectTable(tableItem.dataset.table, tableItem.dataset.namespace);
                return;
            }

            // Button clicks
            if (target.closest('#disconnectBtn')) {
                disconnect();
                return;
            }
            if (target.closest('#refreshBtn')) {
                refreshServers();
                return;
            }
            if (target.closest('#refreshNamespacesBtn')) {
                refreshNamespaces();
                return;
            }
            if (target.closest('#retryNamespacesBtn')) {
                // Clear namespace error and retry
                appState.update({ namespaceError: null });
                refreshNamespaces();
                return;
            }
            if (target.closest('#refreshTablesBtn')) {
                refreshTables();
                return;
            }
            if (target.closest('#retryTablesBtn')) {
                // Clear table error and retry
                appState.update({ tableError: null });
                refreshTables();
                return;
            }
            if (target.closest('#retryBtn')) {
                appState.update({ error: null });
                refreshServers();
                return;
            }
            if (target.closest('#openServerManagerBtn')) {
                postCommand('openServerManager');
                return;
            }
        });

        // Keyboard navigation delegation
        container.addEventListener('keydown', (e) => {
            // Server list keyboard navigation
            const serverItem = e.target.closest('.ite-server-list__item');
            if (serverItem) {
                handleListKeydown(e, serverItem, '.ite-server-list', '.ite-server-list__item', (item) => {
                    selectServer(item.dataset.server);
                });
                return;
            }

            // Namespace list keyboard navigation
            const namespaceItem = e.target.closest('.ite-namespace-list__item');
            if (namespaceItem) {
                handleListKeydown(e, namespaceItem, '.ite-namespace-list', '.ite-namespace-list__item', (item) => {
                    selectNamespace(item.dataset.namespace);
                });
                return;
            }

            // Table list keyboard navigation
            const tableItem = e.target.closest('.ite-table-list__item');
            if (tableItem) {
                handleListKeydown(e, tableItem, '.ite-table-list', '.ite-table-list__item', (item) => {
                    selectTable(item.dataset.table, item.dataset.namespace);
                });
                return;
            }
        });
    }

    /**
     * Generic keyboard navigation handler for list items
     * @param {KeyboardEvent} e - Keyboard event
     * @param {HTMLElement} currentItem - Currently focused item
     * @param {string} listSelector - Selector for the list container
     * @param {string} itemSelector - Selector for list items
     * @param {function} onSelect - Callback when item is selected
     */
    function handleListKeydown(e, currentItem, listSelector, itemSelector, onSelect) {
        const list = document.querySelector(listSelector);
        if (!list) return;

        const items = Array.from(list.querySelectorAll(itemSelector));
        const currentIndex = parseInt(currentItem.dataset.index, 10);

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                onSelect(currentItem);
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
    }

    // Request server list on load
    // Even if we were previously "connected", we need to reconnect because
    // the extension doesn't persist credentials across reloads
    if (previousState.connectionState === 'connected' && previousState.connectedServer) {
        // We had a previous connection - try to reconnect automatically
        console.debug(`${LOG_PREFIX} Webview initialized, reconnecting to ${previousState.connectedServer}`);
        appState.update({
            selectedServer: previousState.connectedServer,
            connectionState: 'connecting',
            isLoading: true,
            loadingContext: 'connecting',
            // Preserve previous selections for restoration after reconnect
            selectedNamespace: previousState.selectedNamespace,
            selectedTable: previousState.selectedTable
        });
        postCommand('selectServer', { serverName: previousState.connectedServer });
    } else {
        console.debug(`${LOG_PREFIX} Webview initialized, requesting server list`);
        postCommand('getServerList');
    }
})();
