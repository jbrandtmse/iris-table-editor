/**
 * IRIS Table Editor - Server List UI Component
 * Story 12.1: Server List UI
 *
 * Renders the server list sidebar with:
 * - Welcome screen when no servers saved (AC: 1)
 * - Server list with status, name, description, host:port (AC: 2)
 * - Click to select, edit/delete actions (AC: 3)
 * - Double-click to connect (AC: 4)
 * - Right-click context menu (AC: 5)
 *
 * Uses IMessageBridge pattern, BEM CSS, event delegation, escapeHtml() for XSS.
 */
(function () {
    'use strict';

    const LOG_PREFIX = '[IRIS-TE ServerList]';

    // Message bridge injected by the host environment (Electron preload)
    const messageBridge = window.iteMessageBridge;

    // ============================================
    // XSS Prevention
    // ============================================

    /**
     * Escape text for safe use in innerHTML
     * @param {string} text - Raw text to escape
     * @returns {string} HTML-safe text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Escape text for safe use in HTML attributes
     * @param {string} text - Raw text to escape
     * @returns {string} Attribute-safe text
     */
    function escapeAttr(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ============================================
    // Screen Reader Announcements
    // ============================================

    /**
     * Announce a message via ARIA live region
     * @param {string} message - Message for screen readers
     */
    function announce(message) {
        const liveRegion = document.getElementById('ite-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    // ============================================
    // Application State
    // ============================================

    /**
     * @typedef {Object} ServerInfo
     * @property {string} name - Server display name
     * @property {string} hostname - Server hostname
     * @property {number} port - Server port
     * @property {string} [description] - Optional description
     * @property {boolean} ssl - Whether SSL is enabled
     * @property {string} [status] - Connection status: 'connected' | 'disconnected'
     */

    /**
     * Application state management
     */
    const state = {
        /** @type {ServerInfo[]} */
        servers: [],
        /** @type {string|null} Currently selected server name */
        selectedServer: null,
        /** @type {string|null} Currently connected server name */
        connectedServer: null,
        /** @type {boolean} Whether the server list is loading */
        isLoading: true,
        /** @type {Object|null} Current error */
        error: null,
        /** @type {string|null} Server name of the context menu target */
        contextMenuServer: null
    };

    /** @type {Function[]} */
    const stateListeners = [];

    /**
     * Update state and notify listeners
     * @param {Partial<typeof state>} changes - State changes to apply
     */
    function updateState(changes) {
        Object.assign(state, changes);
        stateListeners.forEach(fn => fn(state));
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback on state change
     * @returns {Function} Unsubscribe function
     */
    function subscribe(listener) {
        stateListeners.push(listener);
        return () => {
            const idx = stateListeners.indexOf(listener);
            if (idx > -1) { stateListeners.splice(idx, 1); }
        };
    }

    // ============================================
    // Message Bridge Communication (Task 5)
    // ============================================

    /**
     * Send a command to the host via message bridge
     * @param {string} command - Command name
     * @param {object} [payload] - Command payload
     */
    function sendCommand(command, payload) {
        if (!messageBridge) {
            console.error(LOG_PREFIX, 'Message bridge not initialized');
            return;
        }
        messageBridge.sendCommand(command, payload || {});
    }

    // ============================================
    // Render Functions
    // ============================================

    /**
     * Render the welcome/empty state (AC: 1)
     * @returns {string} HTML string
     */
    function renderWelcome() {
        return `
            <div class="ite-welcome" role="status">
                <div class="ite-welcome__icon" aria-hidden="true">&#128421;</div>
                <h3 class="ite-welcome__title">Welcome to IRIS Table Editor</h3>
                <p class="ite-welcome__description">
                    Connect to InterSystems IRIS databases to browse and edit tables
                    with an Excel-like grid editor.
                </p>
                <button class="ite-button ite-button--primary ite-welcome__add-btn"
                        id="welcomeAddServerBtn">
                    Add Your First Server
                </button>
            </div>
        `;
    }

    /**
     * Render the loading state
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
     * Render the server list (AC: 2, 3)
     * @param {ServerInfo[]} servers - List of servers
     * @param {string|null} selectedServer - Currently selected server name
     * @param {string|null} connectedServer - Currently connected server name
     * @returns {string} HTML string
     */
    function renderServerList(servers, selectedServer, connectedServer) {
        const items = servers.map((server, index) => {
            const isSelected = server.name === selectedServer;
            const isConnected = server.name === connectedServer;
            const selectedClass = isSelected ? 'ite-server-list__item--selected' : '';
            const statusClass = isConnected
                ? 'ite-server-list__status--connected'
                : 'ite-server-list__status--disconnected';
            const statusLabel = isConnected ? 'Connected' : 'Disconnected';
            const safeName = escapeHtml(server.name);
            const safeNameAttr = escapeAttr(server.name);
            const hostPort = escapeHtml(`${server.hostname}:${server.port}`);
            const descriptionHtml = server.description
                ? `<span class="ite-server-list__description">${escapeHtml(server.description)}</span>`
                : '';

            return `
                <div class="ite-server-list__item ${selectedClass}"
                     data-server="${safeNameAttr}"
                     data-index="${index}"
                     tabindex="0"
                     role="option"
                     aria-selected="${isSelected}"
                     aria-label="${safeNameAttr} - ${statusLabel}">
                    <span class="ite-server-list__status ${statusClass}"
                          title="${statusLabel}"
                          aria-label="${statusLabel}"></span>
                    <div class="ite-server-list__info">
                        <span class="ite-server-list__name">${safeName}</span>
                        ${descriptionHtml}
                        <span class="ite-server-list__detail">${hostPort}</span>
                    </div>
                    <div class="ite-server-list__actions">
                        <button class="ite-button ite-button--icon"
                                data-action="edit" data-server="${safeNameAttr}"
                                title="Edit server" aria-label="Edit ${safeNameAttr}">&#9998;</button>
                        <button class="ite-button ite-button--icon"
                                data-action="delete" data-server="${safeNameAttr}"
                                title="Delete server" aria-label="Delete ${safeNameAttr}">&#10005;</button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="ite-server-list" role="listbox" aria-label="Server connections">
                ${items}
            </div>
        `;
    }

    /**
     * Render error state
     * @param {Object} error - Error with message property
     * @returns {string} HTML string
     */
    function renderError(error) {
        const safeMessage = escapeHtml(error.message || 'An unknown error occurred');
        return `
            <div class="ite-message ite-message--error" role="alert">
                <h3 class="ite-message__title">Error</h3>
                <p class="ite-message__text">${safeMessage}</p>
                <button class="ite-button ite-button--secondary" id="retryBtn">
                    Try Again
                </button>
            </div>
        `;
    }

    /**
     * Main render function - renders into the container based on current state
     * @param {typeof state} currentState - Current application state
     */
    function render(currentState) {
        const container = document.getElementById('serverListContainer');
        if (!container) { return; }

        if (currentState.isLoading) {
            container.innerHTML = renderLoading();
            return;
        }

        if (currentState.error) {
            container.innerHTML = renderError(currentState.error);
            return;
        }

        if (currentState.servers.length === 0) {
            container.innerHTML = renderWelcome();
            return;
        }

        container.innerHTML = renderServerList(
            currentState.servers,
            currentState.selectedServer,
            currentState.connectedServer
        );

        // Focus management after render
        const serverList = container.querySelector('.ite-server-list');
        if (serverList) {
            const selectedItem = serverList.querySelector('.ite-server-list__item--selected');
            const firstItem = serverList.querySelector('.ite-server-list__item');
            (selectedItem || firstItem)?.focus();
        }
    }

    // ============================================
    // Context Menu (AC: 5)
    // ============================================

    const contextMenuEl = document.getElementById('contextMenu');

    /**
     * Show the context menu at the specified position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} serverName - Server name for actions
     */
    function showContextMenu(x, y, serverName) {
        if (!contextMenuEl) { return; }

        updateState({ contextMenuServer: serverName });
        contextMenuEl.hidden = false;
        contextMenuEl.style.left = x + 'px';
        contextMenuEl.style.top = y + 'px';

        // Ensure menu stays within viewport
        const rect = contextMenuEl.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenuEl.style.left = (window.innerWidth - rect.width - 4) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            contextMenuEl.style.top = (window.innerHeight - rect.height - 4) + 'px';
        }

        // Focus first menu item
        const firstItem = contextMenuEl.querySelector('.ite-context-menu__item');
        firstItem?.focus();
    }

    /**
     * Hide the context menu
     */
    function hideContextMenu() {
        if (contextMenuEl) {
            contextMenuEl.hidden = true;
        }
        updateState({ contextMenuServer: null });
    }

    /**
     * Handle context menu action
     * @param {string} action - Action name (connect, edit, delete, testConnection)
     */
    function handleContextMenuAction(action) {
        const serverName = state.contextMenuServer;
        if (!serverName) { return; }

        hideContextMenu();

        switch (action) {
            case 'connect':
                sendCommand('connectServer', { serverName });
                break;
            case 'edit':
                sendCommand('editServer', { serverName });
                break;
            case 'delete':
                sendCommand('deleteServer', { serverName });
                break;
            case 'testConnection':
                sendCommand('testConnection', { serverName });
                break;
            default:
                console.warn(LOG_PREFIX, 'Unknown context menu action:', action);
        }
    }

    // ============================================
    // Event Handling (Event Delegation)
    // ============================================

    // Track double-click timing for server items
    let lastClickTime = 0;
    let lastClickServer = null;
    const DOUBLE_CLICK_THRESHOLD = 400; // ms

    /**
     * Handle click on a server list item (AC: 3, 4)
     * Single click = select, double click = connect
     * @param {string} serverName - Clicked server name
     */
    function handleServerClick(serverName) {
        const now = Date.now();

        // Check for double click (AC: 4)
        if (lastClickServer === serverName && (now - lastClickTime) < DOUBLE_CLICK_THRESHOLD) {
            // Double click - connect
            lastClickTime = 0;
            lastClickServer = null;
            sendCommand('connectServer', { serverName });
            announce('Connecting to ' + serverName);
            return;
        }

        // Single click - select (AC: 3)
        lastClickTime = now;
        lastClickServer = serverName;

        updateState({ selectedServer: serverName });
        announce('Selected ' + serverName);
    }

    // Container-level event delegation
    const sidebarContent = document.getElementById('serverListContainer');

    if (sidebarContent) {
        // Click delegation
        sidebarContent.addEventListener('click', function (e) {
            const target = /** @type {HTMLElement} */ (e.target);

            // Server item click
            const serverItem = target.closest('.ite-server-list__item');
            if (serverItem) {
                // Check if an action button was clicked
                const actionBtn = target.closest('[data-action]');
                if (actionBtn) {
                    const action = actionBtn.getAttribute('data-action');
                    const server = actionBtn.getAttribute('data-server');
                    if (action && server) {
                        if (action === 'edit') {
                            sendCommand('editServer', { serverName: server });
                        } else if (action === 'delete') {
                            sendCommand('deleteServer', { serverName: server });
                        }
                    }
                    return;
                }

                const clickedServer = serverItem.getAttribute('data-server');
                if (clickedServer) {
                    handleServerClick(clickedServer);
                }
                return;
            }

            // Welcome "Add First Server" button
            if (target.closest('#welcomeAddServerBtn')) {
                sendCommand('editServer', { serverName: null });
                return;
            }

            // Retry button
            if (target.closest('#retryBtn')) {
                updateState({ error: null, isLoading: true });
                sendCommand('getServers', {});
                return;
            }
        });

        // Right-click context menu (AC: 5)
        sidebarContent.addEventListener('contextmenu', function (e) {
            const target = /** @type {HTMLElement} */ (e.target);
            const serverItem = target.closest('.ite-server-list__item');

            if (serverItem) {
                e.preventDefault();
                const serverName = serverItem.getAttribute('data-server');
                if (serverName) {
                    // Select the server as well
                    updateState({ selectedServer: serverName });
                    showContextMenu(e.clientX, e.clientY, serverName);
                }
            }
        });

        // Keyboard navigation
        sidebarContent.addEventListener('keydown', function (e) {
            const target = /** @type {HTMLElement} */ (e.target);
            const serverItem = target.closest('.ite-server-list__item');

            if (serverItem) {
                const serverList = document.querySelector('.ite-server-list');
                if (!serverList) { return; }

                const items = Array.from(serverList.querySelectorAll('.ite-server-list__item'));
                const currentIndex = parseInt(serverItem.getAttribute('data-index') || '0', 10);

                switch (e.key) {
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        {
                            const keyServer = serverItem.getAttribute('data-server');
                            if (keyServer) {
                                handleServerClick(keyServer);
                            }
                        }
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
                        if (items[0]) { items[0].focus(); }
                        break;
                    case 'End':
                        e.preventDefault();
                        if (items.length > 0) { items[items.length - 1].focus(); }
                        break;
                }
            }
        });
    }

    // Header add button
    const addServerBtn = document.getElementById('addServerBtn');
    if (addServerBtn) {
        addServerBtn.addEventListener('click', function () {
            sendCommand('editServer', { serverName: null });
        });
    }

    // Context menu event handling
    if (contextMenuEl) {
        contextMenuEl.addEventListener('click', function (e) {
            const target = /** @type {HTMLElement} */ (e.target);
            const menuItem = target.closest('.ite-context-menu__item');
            if (menuItem) {
                const action = menuItem.getAttribute('data-action');
                if (action) {
                    handleContextMenuAction(action);
                }
            }
        });

        // Keyboard navigation in context menu
        contextMenuEl.addEventListener('keydown', function (e) {
            const items = Array.from(contextMenuEl.querySelectorAll('.ite-context-menu__item'));
            const focusedIndex = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    hideContextMenu();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (focusedIndex < items.length - 1) {
                        items[focusedIndex + 1].focus();
                    } else {
                        items[0].focus();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (focusedIndex > 0) {
                        items[focusedIndex - 1].focus();
                    } else {
                        items[items.length - 1].focus();
                    }
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    if (focusedIndex >= 0) {
                        const action = items[focusedIndex].getAttribute('data-action');
                        if (action) {
                            handleContextMenuAction(action);
                        }
                    }
                    break;
            }
        });
    }

    // Dismiss context menu when clicking outside
    document.addEventListener('click', function (e) {
        if (contextMenuEl && !contextMenuEl.hidden) {
            if (!contextMenuEl.contains(/** @type {Node} */ (e.target))) {
                hideContextMenu();
            }
        }
    });

    // ============================================
    // Message Bridge Event Handlers (Task 5)
    // ============================================

    if (messageBridge) {
        // serversLoaded event - receive full server list
        messageBridge.onEvent('serversLoaded', function (payload) {
            console.debug(LOG_PREFIX, 'Received serversLoaded:', payload);
            updateState({
                servers: payload.servers || [],
                isLoading: false,
                error: null
            });
            announce(payload.servers.length + ' servers available');
        });

        // serverSelected event - a server was selected/confirmed by host
        messageBridge.onEvent('serverSelected', function (payload) {
            console.debug(LOG_PREFIX, 'Received serverSelected:', payload);
            updateState({ selectedServer: payload.serverName });
        });

        // connectionStatus event - server connected/disconnected
        messageBridge.onEvent('connectionStatus', function (payload) {
            console.debug(LOG_PREFIX, 'Received connectionStatus:', payload);
            if (payload.connected) {
                updateState({ connectedServer: payload.serverName });
                announce('Connected to ' + payload.serverName);
            } else {
                updateState({ connectedServer: null });
                announce('Disconnected');
            }
        });

        // serverDeleted event - a server was deleted
        messageBridge.onEvent('serverDeleted', function (payload) {
            console.debug(LOG_PREFIX, 'Received serverDeleted:', payload);
            // Remove from local list
            const filtered = state.servers.filter(function (s) { return s.name !== payload.serverName; });
            const changes = { servers: filtered };
            if (state.selectedServer === payload.serverName) {
                changes.selectedServer = null;
            }
            if (state.connectedServer === payload.serverName) {
                changes.connectedServer = null;
            }
            updateState(changes);
            announce('Server ' + payload.serverName + ' deleted');
        });

        // error event
        messageBridge.onEvent('error', function (payload) {
            console.error(LOG_PREFIX, 'Received error:', payload);
            updateState({
                isLoading: false,
                error: payload
            });
            announce('Error: ' + (payload.message || 'Unknown error'));
        });
    } else {
        console.error(LOG_PREFIX, 'Message bridge not initialized - cannot register event handlers');
    }

    // ============================================
    // Initialize
    // ============================================

    // Subscribe render to state changes
    subscribe(render);

    // Trigger initial render
    render(state);

    // Request server list from host
    sendCommand('getServers', {});

    console.debug(LOG_PREFIX, 'Server list UI initialized');
})();
