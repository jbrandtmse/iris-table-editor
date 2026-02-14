// IRIS Table Editor - Webview main script

(function() {
    const LOG_PREFIX = '[IRIS-TE Webview]';

    // Message bridge is injected by the host environment
    // eslint-disable-next-line no-undef
    const messageBridge = window.iteMessageBridge;

    // Restore previous state if available
    const previousState = (messageBridge && messageBridge.getState()) || {};

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
                connectionState: initialState.connectionState || 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'timeout'
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
                tableError: null,

                // Schema tree state (Story 6.1)
                expandedSchema: initialState.expandedSchema || null,

                // Connection timeout state (Story 1.7)
                connectionCancellable: false,
                connectionTimeoutServer: null,
                connectionTimeoutMessage: null
            };
            this._listeners = [];
        }

        get state() {
            return this._state;
        }

        update(changes) {
            this._state = { ...this._state, ...changes };
            // Persist state for webview restoration
            if (messageBridge) {
                messageBridge.setState({
                    selectedServer: this._state.selectedServer,
                    connectionState: this._state.connectionState,
                    connectedServer: this._state.connectedServer,
                    selectedNamespace: this._state.selectedNamespace,
                    selectedTable: this._state.selectedTable,
                    expandedSchema: this._state.expandedSchema
                });
            }
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

            case 'connectionProgress':
                handleConnectionProgress(message.payload);
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
     * Parse flat table list into schema-grouped structure (Story 6.1)
     * Tables are in format "Schema.TableName"
     * @param {string[]} tables - Flat array of fully qualified table names
     * @returns {object} Parsed structure with schemas and singleTableSchemas
     */
    function parseTablesBySchema(tables) {
        // Group tables by schema
        const schemaMap = new Map();

        tables.forEach(fullName => {
            const dotIndex = fullName.indexOf('.');
            if (dotIndex > 0) {
                const schema = fullName.substring(0, dotIndex);
                const tableName = fullName.substring(dotIndex + 1);

                if (!schemaMap.has(schema)) {
                    schemaMap.set(schema, []);
                }
                schemaMap.get(schema).push({ fullName, tableName });
            } else {
                // No schema prefix - treat as its own "schema"
                if (!schemaMap.has(fullName)) {
                    schemaMap.set(fullName, []);
                }
                schemaMap.get(fullName).push({ fullName, tableName: fullName });
            }
        });

        // Convert to array and sort
        const schemas = [];
        const singleTableSchemas = [];

        // Sort schemas alphabetically
        const sortedSchemas = Array.from(schemaMap.keys()).sort((a, b) =>
            a.toLowerCase().localeCompare(b.toLowerCase())
        );

        sortedSchemas.forEach(schemaName => {
            const schemaTables = schemaMap.get(schemaName);
            // Sort tables within schema alphabetically
            schemaTables.sort((a, b) =>
                a.tableName.toLowerCase().localeCompare(b.tableName.toLowerCase())
            );

            if (schemaTables.length === 1) {
                // Single-table schema - show at root level per AC #4
                singleTableSchemas.push(schemaTables[0].fullName);
            } else {
                // Multi-table schema - show as folder
                schemas.push({
                    name: schemaName,
                    tables: schemaTables,
                    count: schemaTables.length
                });
            }
        });

        return { schemas, singleTableSchemas };
    }

    /**
     * Handle connection progress event (Story 1.7)
     * @param {object} payload - Connection progress payload
     */
    function handleConnectionProgress(payload) {
        switch (payload.status) {
            case 'connecting':
                appState.update({
                    connectionState: 'connecting',
                    connectionCancellable: true,
                    connectionTimeoutServer: null,
                    connectionTimeoutMessage: null,
                    isLoading: true,
                    loadingContext: 'connecting',
                    error: null
                });
                announce(`Connecting to ${payload.serverName}...`);
                break;

            case 'connected':
                appState.update({
                    connectionCancellable: false,
                    connectionTimeoutServer: null,
                    connectionTimeoutMessage: null
                });
                // connectionStatus event handles the rest
                break;

            case 'timeout':
                appState.update({
                    connectionState: 'timeout',
                    connectionCancellable: false,
                    connectionTimeoutServer: payload.serverName,
                    connectionTimeoutMessage: payload.message || 'The server may be offline or slow.',
                    isLoading: false,
                    error: null
                });
                announce(`Could not reach ${payload.serverName}. The server may be offline.`);
                break;

            case 'cancelled':
                appState.update({
                    connectionState: 'disconnected',
                    connectionCancellable: false,
                    connectionTimeoutServer: null,
                    connectionTimeoutMessage: null,
                    isLoading: false,
                    error: null
                });
                announce('Connection cancelled');
                break;

            case 'error':
                appState.update({
                    connectionCancellable: false,
                    connectionTimeoutServer: null,
                    connectionTimeoutMessage: null
                });
                // connectionError event handles the rest
                break;
        }
    }

    /**
     * Handle connection error event
     * @param {object} payload - Connection error payload
     */
    function handleConnectionError(payload) {
        // Skip if already handled by connectionProgress (timeout/cancelled)
        if (appState.state.connectionState === 'timeout' ||
            payload.code === 'CONNECTION_CANCELLED') {
            return;
        }

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
        if (!messageBridge) {
            console.error(`${LOG_PREFIX} Message bridge not initialized`);
            return;
        }
        messageBridge.sendCommand(command, payload);
    }

    /**
     * Handle server selection
     * @param {string} serverName - Selected server name
     */
    function selectServer(serverName) {
        // Show connecting state with cancel button
        appState.update({
            selectedServer: serverName,
            connectionState: 'connecting',
            connectionCancellable: true,
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

        // Show connection timeout error state (Story 1.7)
        if (state.connectionState === 'timeout' && state.connectionTimeoutServer) {
            container.innerHTML = renderConnectionTimeout(state.connectionTimeoutServer, state.connectionTimeoutMessage);
            return;
        }

        // Show connecting state
        if (state.connectionState === 'connecting' || (state.isLoading && state.loadingContext === 'connecting')) {
            container.innerHTML = renderConnecting(state.selectedServer, state.connectionCancellable);
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
     * @param {boolean} cancellable - Whether the cancel button should be shown
     * @returns {string} HTML string
     */
    function renderConnecting(serverName, cancellable) {
        const safeName = escapeHtml(serverName || 'server');
        const cancelButton = cancellable
            ? `<button class="ite-button ite-button--secondary ite-connecting__cancel"
                        id="cancelConnectionBtn"
                        aria-label="Cancel connection attempt">
                    Cancel
                </button>`
            : '';
        return `
            <div class="ite-connecting">
                <p class="ite-connecting__message">Connecting to ${safeName}...</p>
                <div class="ite-connecting__progress" aria-label="Connecting to server">
                    <div class="ite-loading__spinner"></div>
                </div>
                ${cancelButton}
            </div>
        `;
    }

    /**
     * Render connection timeout error state (Story 1.7)
     * @param {string} serverName - Server that timed out
     * @param {string} message - Error message
     * @returns {string} HTML string
     */
    function renderConnectionTimeout(serverName, message) {
        const safeName = escapeHtml(serverName || 'server');
        const safeMessage = escapeHtml(message || 'The server may be offline or slow.');
        return `
            <div class="ite-connection-error" role="alert">
                <h3 class="ite-connection-error__title">Could not reach "${safeName}"</h3>
                <p class="ite-connection-error__message">${safeMessage}</p>
                <div class="ite-connection-error__actions">
                    <button class="ite-button ite-button--primary" id="retryConnectionBtn">
                        <span class="codicon codicon-refresh"></span>
                        Retry
                    </button>
                    <button class="ite-button ite-button--secondary" id="selectDifferentServerBtn">
                        Select Different Server
                    </button>
                </div>
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
     * Render table section (loading, error, empty, or schema tree)
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

        // Render schema tree (Story 6.1)
        const expandedSchema = appState.state.expandedSchema;
        return renderSchemaTree(tables, selectedTable, namespace, expandedSchema);
    }

    /**
     * Render schema tree with collapsible schema folders (Story 6.1)
     * @param {string[]} tables - Array of fully qualified table names (Schema.Table)
     * @param {string|null} selectedTable - Currently selected table
     * @param {string} namespace - Current namespace
     * @param {string|null} expandedSchema - Currently expanded schema (null = all collapsed)
     * @returns {string} HTML string
     */
    function renderSchemaTree(tables, selectedTable, namespace, expandedSchema) {
        const { schemas, singleTableSchemas } = parseTablesBySchema(tables);

        // Build a unified list of items (folders and standalone tables) for alphabetical sorting
        const allItems = [];

        singleTableSchemas.forEach(fullName => {
            allItems.push({ type: 'table', name: fullName, fullName });
        });

        schemas.forEach(schema => {
            allItems.push({ type: 'folder', name: schema.name, schema });
        });

        // Sort all items alphabetically by name (case-insensitive)
        allItems.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        let treeItems = '';
        let itemIndex = 0;

        allItems.forEach(item => {
            if (item.type === 'table') {
                const isSelected = item.fullName === selectedTable;
                const selectedClass = isSelected ? 'ite-schema-tree__table--selected' : '';
                treeItems += `
                    <div class="ite-schema-tree__table ite-schema-tree__table--root ${selectedClass}"
                         data-table="${escapeAttr(item.fullName)}"
                         data-namespace="${escapeAttr(namespace)}"
                         data-index="${itemIndex}"
                         tabindex="0"
                         role="treeitem"
                         aria-selected="${isSelected}">
                        <span class="ite-schema-tree__table-icon codicon codicon-table"></span>
                        <span class="ite-schema-tree__table-name">${escapeHtml(item.fullName)}</span>
                    </div>
                `;
                itemIndex++;
            } else {
                const schema = item.schema;
                const isExpanded = schema.name === expandedSchema;
                const expandedClass = isExpanded ? 'ite-schema-tree__schema--expanded' : '';
                const chevronClass = isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right';

                treeItems += `
                    <div class="ite-schema-tree__schema ${expandedClass}"
                         data-schema="${escapeAttr(schema.name)}"
                         data-index="${itemIndex}"
                         tabindex="0"
                         role="treeitem"
                         aria-expanded="${isExpanded}">
                        <span class="ite-schema-tree__schema-chevron codicon ${chevronClass}"></span>
                        <span class="ite-schema-tree__schema-icon codicon codicon-folder${isExpanded ? '-opened' : ''}"></span>
                        <span class="ite-schema-tree__schema-name">${escapeHtml(schema.name)}</span>
                        <span class="ite-schema-tree__schema-count">${schema.count}</span>
                    </div>
                `;
                itemIndex++;

                // Render nested tables if schema is expanded
                if (isExpanded) {
                    schema.tables.forEach(table => {
                        const isSelected = table.fullName === selectedTable;
                        const selectedClass = isSelected ? 'ite-schema-tree__table--selected' : '';
                        treeItems += `
                            <div class="ite-schema-tree__table ite-schema-tree__table--nested ${selectedClass}"
                                 data-table="${escapeAttr(table.fullName)}"
                                 data-namespace="${escapeAttr(namespace)}"
                                 data-schema="${escapeAttr(schema.name)}"
                                 data-index="${itemIndex}"
                                 tabindex="0"
                                 role="treeitem"
                                 aria-selected="${isSelected}"
                                 aria-level="2">
                                <span class="ite-schema-tree__table-icon codicon codicon-table"></span>
                                <span class="ite-schema-tree__table-name">${escapeHtml(table.tableName)}</span>
                            </div>
                        `;
                        itemIndex++;
                    });
                }
            }
        });

        return `
            <div class="ite-table-list__header-row">
                <h3 class="ite-table-list__header">Select a Table</h3>
                <span class="ite-table-list__count">${tables.length} table${tables.length !== 1 ? 's' : ''}</span>
                <button class="ite-button ite-button--icon" id="refreshTablesBtn"
                        title="Refresh table list" aria-label="Refresh table list">
                    <span class="codicon codicon-refresh"></span>
                </button>
            </div>
            <div class="ite-schema-tree" role="tree" aria-label="Tables organized by schema in ${escapeAttr(namespace)}">
                ${treeItems}
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
                <button class="ite-button ite-button--primary" id="installServerManagerBtn">
                    Install Server Manager
                </button>
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
     * Attach event listeners for table list / schema tree
     * Note: Uses focus management only.
     * Click/keyboard events are handled via container delegation.
     */
    function attachTableListEvents() {
        // Try schema tree first (Story 6.1), fall back to flat table list
        const schemaTree = document.querySelector('.ite-schema-tree');
        if (schemaTree) {
            // Focus first or selected item in schema tree
            const selectedItem = schemaTree.querySelector('.ite-schema-tree__table--selected');
            const firstItem = schemaTree.querySelector('[tabindex="0"]');
            (selectedItem || firstItem)?.focus();
            return;
        }

        const tableList = document.querySelector('.ite-table-list');
        if (!tableList) {
            return;
        }

        // Focus first or selected item after render (legacy flat list)
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
            tableError: null,
            expandedSchema: null  // Clear expansion state when changing namespaces (Story 6.1)
        });
        announce(`Selected namespace ${namespace}`);
        postCommand('selectNamespace', { namespace });
    }

    /**
     * Handle table click - opens the table directly
     * @param {string} tableName - Table name to open
     * @param {string} namespace - Current namespace
     */
    function selectTable(tableName, namespace) {
        // Single-click opens the table directly
        openTable(tableName, namespace);
    }

    /**
     * Toggle schema folder expand/collapse (Story 6.1)
     * Implements accordion behavior - only one schema open at a time (AC #3)
     * @param {string} schemaName - Schema name to toggle
     */
    function toggleSchema(schemaName) {
        const currentExpanded = appState.state.expandedSchema;

        // Save scroll position before re-render
        const tree = document.querySelector('.ite-schema-tree');
        const savedScroll = tree ? tree.scrollTop : 0;

        if (currentExpanded === schemaName) {
            // Collapse if already expanded
            appState.update({ expandedSchema: null });
            announce(`Collapsed schema ${schemaName}`);
        } else {
            // Expand this schema (auto-collapses previous per accordion behavior)
            appState.update({ expandedSchema: schemaName });
            announce(`Expanded schema ${schemaName}`);
        }

        // Restore scroll and ensure the toggled folder is visible
        requestAnimationFrame(() => {
            const newTree = document.querySelector('.ite-schema-tree');
            if (!newTree) return;

            // Restore previous scroll position first
            newTree.scrollTop = savedScroll;

            // Scroll the toggled schema folder into view if needed
            const schemaEl = newTree.querySelector(`.ite-schema-tree__schema[data-schema="${schemaName}"]`);
            if (schemaEl) {
                schemaEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }

    /**
     * Open table in grid editor (Story 2.1)
     * @param {string} tableName - Table name to open
     * @param {string} namespace - Namespace containing the table
     */
    function openTable(tableName, namespace) {
        announce(`Opening table ${tableName}`);
        postCommand('openTable', { tableName, namespace });
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

    // Initialize - register for all host events via message bridge
    // Register a handler for each event type the webview can receive
    const eventTypes = [
        'serverList', 'serverManagerNotInstalled', 'noServersConfigured',
        'connectionStatus', 'connectionProgress', 'connectionError',
        'namespaceList', 'namespaceSelected',
        'tableList', 'tableSelected', 'error'
    ];
    if (!messageBridge) {
        console.error(`${LOG_PREFIX} Message bridge not initialized - cannot register event handlers`);
    } else {
        eventTypes.forEach(eventName => {
            messageBridge.onEvent(eventName, (payload) => {
                console.debug(`${LOG_PREFIX} Received event: ${eventName}`);
                handleMessage({ data: { event: eventName, payload } });
            });
        });
    }
    appState.subscribe(render);

    // Event delegation on container - persists across renders
    // This avoids listener stacking issues when innerHTML is replaced
    const container = document.querySelector('.ite-container');
    if (container) {
        // Note: Native dblclick doesn't work for table items because the re-render
        // between clicks destroys the DOM element. Double-click detection for tables
        // is handled in selectTable() using timestamp comparison instead.

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

            // Schema folder click (Story 6.1) - expand/collapse
            const schemaItem = target.closest('.ite-schema-tree__schema');
            if (schemaItem) {
                toggleSchema(schemaItem.dataset.schema);
                return;
            }

            // Table item click in schema tree (Story 6.1)
            const schemaTreeTableItem = target.closest('.ite-schema-tree__table');
            if (schemaTreeTableItem) {
                selectTable(schemaTreeTableItem.dataset.table, schemaTreeTableItem.dataset.namespace);
                return;
            }

            // Table list item click (legacy flat list fallback)
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
            if (target.closest('#installServerManagerBtn')) {
                postCommand('installServerManager');
                return;
            }
            // Story 1.7: Cancel connection button
            if (target.closest('#cancelConnectionBtn')) {
                postCommand('cancelConnection');
                return;
            }
            // Story 1.7: Retry connection after timeout
            if (target.closest('#retryConnectionBtn')) {
                const serverName = appState.state.connectionTimeoutServer || appState.state.selectedServer;
                if (serverName) {
                    selectServer(serverName);
                }
                return;
            }
            // Story 1.7: Select different server after timeout
            if (target.closest('#selectDifferentServerBtn')) {
                appState.update({
                    connectionState: 'disconnected',
                    connectionTimeoutServer: null,
                    connectionTimeoutMessage: null,
                    isLoading: true,
                    loadingContext: 'loadingServers',
                    error: null
                });
                postCommand('getServerList');
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

            // Schema tree keyboard navigation (Story 6.1)
            const schemaItem = e.target.closest('.ite-schema-tree__schema');
            if (schemaItem) {
                // Enter, Space, or Right arrow expands/toggles schema
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSchema(schemaItem.dataset.schema);
                    return;
                }
                // Right arrow expands if collapsed
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const isExpanded = schemaItem.getAttribute('aria-expanded') === 'true';
                    if (!isExpanded) {
                        toggleSchema(schemaItem.dataset.schema);
                    } else {
                        // Move to first child table if expanded
                        const nextItem = schemaItem.nextElementSibling;
                        if (nextItem && nextItem.classList.contains('ite-schema-tree__table--nested')) {
                            nextItem.focus();
                        }
                    }
                    return;
                }
                // Left arrow collapses if expanded
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const isExpanded = schemaItem.getAttribute('aria-expanded') === 'true';
                    if (isExpanded) {
                        toggleSchema(schemaItem.dataset.schema);
                    }
                    return;
                }
                // Arrow up/down for tree navigation
                handleTreeKeydown(e, schemaItem);
                return;
            }

            // Schema tree table item keyboard navigation
            const schemaTreeTableItem = e.target.closest('.ite-schema-tree__table');
            if (schemaTreeTableItem) {
                // Enter or Space opens the table
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openTable(schemaTreeTableItem.dataset.table, schemaTreeTableItem.dataset.namespace);
                    return;
                }
                // Left arrow moves to parent schema folder
                if (e.key === 'ArrowLeft' && schemaTreeTableItem.classList.contains('ite-schema-tree__table--nested')) {
                    e.preventDefault();
                    const schemaName = schemaTreeTableItem.dataset.schema;
                    const parentSchema = document.querySelector(`.ite-schema-tree__schema[data-schema="${schemaName}"]`);
                    if (parentSchema) {
                        parentSchema.focus();
                    }
                    return;
                }
                // Arrow up/down for tree navigation
                handleTreeKeydown(e, schemaTreeTableItem);
                return;
            }

            // Table list keyboard navigation (legacy flat list fallback)
            const tableItem = e.target.closest('.ite-table-list__item');
            if (tableItem) {
                // Enter or Space opens the table
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openTable(tableItem.dataset.table, tableItem.dataset.namespace);
                    return;
                }
                // Arrow keys for navigation only
                handleListKeydown(e, tableItem, '.ite-table-list', '.ite-table-list__item', () => {
                    // No action on arrow key selection - just navigate
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

    /**
     * Tree keyboard navigation handler for schema tree (Story 6.1)
     * Handles Up/Down arrow keys for navigating visible tree items
     * @param {KeyboardEvent} e - Keyboard event
     * @param {HTMLElement} currentItem - Currently focused item
     */
    function handleTreeKeydown(e, currentItem) {
        const tree = document.querySelector('.ite-schema-tree');
        if (!tree) return;

        // Get all visible focusable items in the tree
        const allItems = Array.from(tree.querySelectorAll('[tabindex="0"]'));
        const currentIndex = allItems.indexOf(currentItem);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < allItems.length - 1) {
                    allItems[currentIndex + 1].focus();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    allItems[currentIndex - 1].focus();
                }
                break;
            case 'Home':
                e.preventDefault();
                allItems[0]?.focus();
                break;
            case 'End':
                e.preventDefault();
                allItems[allItems.length - 1]?.focus();
                break;
        }
    }

    // Request server list on load
    // Even if we were previously "connected", we need to reconnect because
    // the extension doesn't persist credentials across reloads
    // Story 1.7: Also reconnect if previously connecting or timed out
    if ((previousState.connectionState === 'connected' || previousState.connectionState === 'connecting') && previousState.connectedServer) {
        // We had a previous connection - try to reconnect automatically with timeout/cancel flow
        console.debug(`${LOG_PREFIX} Webview initialized, reconnecting to ${previousState.connectedServer}`);
        appState.update({
            selectedServer: previousState.connectedServer,
            connectionState: 'connecting',
            connectionCancellable: true,
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
