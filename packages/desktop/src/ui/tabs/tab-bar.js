/**
 * IRIS Table Editor - Tab Bar Component
 * Story 11.3: Tab Bar
 *
 * Manages multiple open table tabs:
 * - Open/close/switch tabs
 * - Duplicate tab prevention
 * - Grid state save/restore per tab
 * - Dirty state tracking with unsaved changes confirmation
 * - Keyboard shortcuts (Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+W)
 *
 * Uses IMessageBridge pattern, BEM CSS, event delegation, escapeHtml() for XSS.
 */
(function () {
    'use strict';

    const LOG_PREFIX = '[IRIS-TE TabBar]';

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
    // Tab Model
    // ============================================

    /**
     * @typedef {Object} Tab
     * @property {string} id - Unique tab identifier
     * @property {string} namespace - IRIS namespace
     * @property {string} tableName - Full table name (schema.table)
     * @property {string} label - Display label
     * @property {object|null} cachedSchema - Cached table schema (columns)
     * @property {object|null} cachedData - Cached data (rows, totalRows)
     * @property {object|null} gridState - Saved grid state for restoration
     * @property {boolean} isDirty - Whether tab has unsaved changes
     * @property {boolean} isLoading - Whether tab is still loading initial data
     */

    // ============================================
    // TabBarManager
    // ============================================

    class TabBarManager {
        constructor() {
            /** @type {Tab[]} */
            this.tabs = [];
            /** @type {string|null} */
            this.activeTabId = null;
            /** @type {string|null} Pending tab ID for opening flow */
            this._pendingTabId = null;

            this._tabIdCounter = 0;

            // DOM references
            this._tabBarEl = document.getElementById('tabBar');
            this._welcomeEl = document.getElementById('welcomePlaceholder');
            this._gridContainerEl = document.getElementById('gridContainer');
            this._contentAreaEl = document.getElementById('contentArea');
        }

        /**
         * Generate a unique tab ID
         * @returns {string}
         */
        _generateId() {
            this._tabIdCounter++;
            return 'tab-' + this._tabIdCounter;
        }

        /**
         * Find a tab by namespace + tableName (duplicate prevention)
         * @param {string} namespace
         * @param {string} tableName
         * @returns {Tab|null}
         */
        getTabByTable(namespace, tableName) {
            return this.tabs.find(
                t => t.namespace === namespace && t.tableName === tableName
            ) || null;
        }

        /**
         * Find a tab by ID
         * @param {string} tabId
         * @returns {Tab|null}
         */
        getTabById(tabId) {
            return this.tabs.find(t => t.id === tabId) || null;
        }

        /**
         * Get the currently active tab
         * @returns {Tab|null}
         */
        getActiveTab() {
            if (!this.activeTabId) return null;
            return this.getTabById(this.activeTabId);
        }

        /**
         * Open a table as a tab. Prevents duplicates.
         * @param {string} namespace
         * @param {string} tableName
         */
        openTab(namespace, tableName) {
            // Check for duplicate
            const existing = this.getTabByTable(namespace, tableName);
            if (existing) {
                console.log(LOG_PREFIX, 'Tab already open, switching to:', existing.id);
                this.switchTab(existing.id);
                return;
            }

            // Create new tab
            const tab = {
                id: this._generateId(),
                namespace: namespace,
                tableName: tableName,
                label: tableName,
                cachedSchema: null,
                cachedData: null,
                gridState: null,
                isDirty: false,
                isLoading: true,
            };

            // Save current tab's grid state before switching
            this._saveCurrentTabState();

            this.tabs.push(tab);
            this._pendingTabId = tab.id;
            this.activeTabId = tab.id;

            // Show grid container, hide welcome
            this._showGrid();

            // Render tab bar
            this._render();

            // Send selectTable command to load schema
            if (messageBridge) {
                messageBridge.sendCommand('selectTable', { namespace, tableName });
            }

            // Story 11.4: Notify main process of tab count change for menu state
            this._notifyTabStateChanged();

            announce('Opened table ' + tableName);
            console.log(LOG_PREFIX, 'Opened tab:', tab.id, namespace, tableName);
        }

        /**
         * Switch to a tab by ID.
         * Saves current grid state, restores target tab state.
         * @param {string} tabId
         */
        switchTab(tabId) {
            if (tabId === this.activeTabId) return;

            const targetTab = this.getTabById(tabId);
            if (!targetTab) {
                console.warn(LOG_PREFIX, 'Tab not found:', tabId);
                return;
            }

            // Save current tab's grid state
            this._saveCurrentTabState();

            // Set new active tab
            this.activeTabId = tabId;

            // Restore target tab's grid state
            this._restoreTabState(targetTab);

            // Re-render tab bar
            this._render();

            announce('Switched to ' + targetTab.label);
            console.log(LOG_PREFIX, 'Switched to tab:', tabId);
        }

        /**
         * Close a tab by ID with dirty check.
         * @param {string} tabId
         * @returns {boolean} true if tab was closed, false if cancelled
         */
        closeTab(tabId) {
            const tab = this.getTabById(tabId);
            if (!tab) return false;

            // Dirty check
            if (tab.isDirty) {
                const confirmed = confirm('You have unsaved changes. Close this tab?');
                if (!confirmed) return false;
            }

            const tabIndex = this.tabs.indexOf(tab);
            this.tabs.splice(tabIndex, 1);

            // If we closed the active tab, activate an adjacent one
            if (this.activeTabId === tabId) {
                if (this.tabs.length === 0) {
                    // No tabs left
                    this.activeTabId = null;
                    this._showWelcome();
                    // Clear messageBridge state so grid is clean for next tab
                    if (messageBridge) {
                        messageBridge.setState({});
                    }
                } else {
                    // Prefer tab to the right, then left
                    const nextIndex = Math.min(tabIndex, this.tabs.length - 1);
                    const nextTab = this.tabs[nextIndex];
                    this.activeTabId = nextTab.id;
                    this._restoreTabState(nextTab);
                }
            }

            this._render();

            // Story 11.4: Notify main process of tab count change for menu state
            this._notifyTabStateChanged();

            announce('Closed tab ' + tab.label);
            console.log(LOG_PREFIX, 'Closed tab:', tabId);
            return true;
        }

        /**
         * Switch to the next tab (wrapping around)
         */
        nextTab() {
            if (this.tabs.length <= 1) return;
            const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
            const nextIndex = (currentIndex + 1) % this.tabs.length;
            this.switchTab(this.tabs[nextIndex].id);
        }

        /**
         * Switch to the previous tab (wrapping around)
         */
        prevTab() {
            if (this.tabs.length <= 1) return;
            const currentIndex = this.tabs.findIndex(t => t.id === this.activeTabId);
            const prevIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
            this.switchTab(this.tabs[prevIndex].id);
        }

        /**
         * Save the current active tab's grid state from messageBridge
         * @private
         */
        _saveCurrentTabState() {
            const currentTab = this.getActiveTab();
            if (!currentTab || !messageBridge) return;

            const currentGridState = messageBridge.getState();
            if (currentGridState) {
                currentTab.gridState = currentGridState;
                currentTab.cachedSchema = currentGridState.columns || null;
                currentTab.cachedData = {
                    rows: currentGridState.rows || [],
                    totalRows: currentGridState.totalRows || 0,
                };
                // Update dirty state from grid state
                this._updateDirtyFromState(currentTab, currentGridState);
            }
        }

        /**
         * Restore a tab's grid state via messageBridge
         * @param {Tab} tab
         * @private
         */
        _restoreTabState(tab) {
            if (!messageBridge) return;

            if (tab.gridState) {
                // Convert Maps for serialization compatibility
                const stateToRestore = Object.assign({}, tab.gridState);
                if (stateToRestore.filters instanceof Map) {
                    stateToRestore.filters = Object.fromEntries(stateToRestore.filters);
                }
                if (stateToRestore.pendingSaves instanceof Map) {
                    stateToRestore.pendingSaves = Object.fromEntries(stateToRestore.pendingSaves);
                }
                messageBridge.setState(stateToRestore);
                messageBridge.emitLocalEvent('restoreGridState', {});
            } else {
                // Clear grid state for a fresh load
                messageBridge.setState({});
            }

            // Update main process context
            messageBridge.sendCommand('activateTab', {
                namespace: tab.namespace,
                tableName: tab.tableName,
                schema: tab.cachedSchema ? { columns: tab.cachedSchema, tableName: tab.tableName, namespace: tab.namespace } : null,
            });
        }

        /**
         * Update dirty state from grid state object
         * @param {Tab} tab
         * @param {object} gridState
         * @private
         */
        _updateDirtyFromState(tab, gridState) {
            const hasPendingSaves = gridState.pendingSaves &&
                ((gridState.pendingSaves instanceof Map && gridState.pendingSaves.size > 0) ||
                 (typeof gridState.pendingSaves === 'object' && !(gridState.pendingSaves instanceof Map) && Object.keys(gridState.pendingSaves).length > 0));
            const hasNewRows = gridState.newRows && gridState.newRows.length > 0;
            tab.isDirty = !!(hasPendingSaves || hasNewRows);
        }

        /**
         * Handle tableSchema event — cache schema in the pending/active tab
         * @param {object} payload - { tableName, namespace, serverName, columns }
         */
        handleTableSchema(payload) {
            // Find the pending tab or the active tab
            const targetTab = this._pendingTabId
                ? this.getTabById(this._pendingTabId)
                : this.getActiveTab();

            if (targetTab) {
                targetTab.cachedSchema = payload.columns;
                targetTab.label = payload.tableName;
                targetTab.isLoading = false;
                this._pendingTabId = null;
                this._render();
            }
        }

        /**
         * Handle tableData event — cache data in the active tab
         * @param {object} payload - { rows, totalRows, page, pageSize }
         */
        handleTableData(payload) {
            const activeTab = this.getActiveTab();
            if (activeTab) {
                activeTab.cachedData = {
                    rows: payload.rows || [],
                    totalRows: payload.totalRows || 0,
                };
                activeTab.isLoading = false;
            }
        }

        /**
         * Handle saveCellResult / insertRowResult events — update dirty state
         * @param {object} payload
         */
        handleSaveResult(payload) {
            if (payload && payload.success) {
                const activeTab = this.getActiveTab();
                if (activeTab && messageBridge) {
                    const currentState = messageBridge.getState();
                    if (currentState) {
                        this._updateDirtyFromState(activeTab, currentState);
                        this._render();
                    }
                }
            }
        }

        /**
         * Handle disconnect — close all tabs
         */
        handleDisconnect() {
            this.tabs = [];
            this.activeTabId = null;
            this._pendingTabId = null;
            this._showWelcome();
            this._render();
            if (messageBridge) {
                messageBridge.setState({});
            }
            // Story 11.4: Notify main process of tab count change
            this._notifyTabStateChanged();
        }

        /**
         * Story 11.4: Notify main process of tab count change for menu state updates.
         * Sends tabStateChanged command with the current tab count.
         * @private
         */
        _notifyTabStateChanged() {
            if (messageBridge) {
                messageBridge.sendCommand('tabStateChanged', { tabCount: this.tabs.length });
            }
        }

        /**
         * Show grid container, hide welcome placeholder
         * @private
         */
        _showGrid() {
            if (this._welcomeEl) this._welcomeEl.style.display = 'none';
            if (this._gridContainerEl) this._gridContainerEl.style.display = '';
        }

        /**
         * Show welcome placeholder, hide grid container
         * @private
         */
        _showWelcome() {
            if (this._welcomeEl) this._welcomeEl.style.display = '';
            if (this._gridContainerEl) this._gridContainerEl.style.display = 'none';
        }

        /**
         * Render the tab bar
         * @private
         */
        _render() {
            if (!this._tabBarEl) return;

            if (this.tabs.length === 0) {
                this._tabBarEl.innerHTML = '';
                return;
            }

            const html = this.tabs.map(tab => {
                const isActive = tab.id === this.activeTabId;
                const activeClass = isActive ? ' ite-tab-bar__tab--active' : '';
                const dirtyClass = tab.isDirty ? ' ite-tab-bar__tab--dirty' : '';
                const safeLabel = escapeHtml(tab.label);
                const safeId = escapeAttr(tab.id);
                const safeTitle = escapeAttr(tab.namespace + '.' + tab.tableName);
                const loadingLabel = tab.isLoading ? ' (Loading...)' : '';

                return '<div class="ite-tab-bar__tab' + activeClass + dirtyClass + '"' +
                       ' data-tab-id="' + safeId + '"' +
                       ' role="tab"' +
                       ' aria-selected="' + (isActive ? 'true' : 'false') + '"' +
                       ' title="' + safeTitle + '"' +
                       ' tabindex="' + (isActive ? '0' : '-1') + '">' +
                       '<span class="ite-tab-bar__label">' + safeLabel + loadingLabel + '</span>' +
                       '<button class="ite-tab-bar__close" data-tab-close="' + safeId + '"' +
                       ' aria-label="Close ' + safeLabel + '" title="Close tab" tabindex="-1">&times;</button>' +
                       '</div>';
            }).join('');

            this._tabBarEl.innerHTML = html;

            // Update tabpanel aria-labelledby to reference active tab
            if (this._contentAreaEl && this.activeTabId) {
                const activeTabEl = this._tabBarEl.querySelector('[data-tab-id][aria-selected="true"]');
                if (activeTabEl) {
                    // Set a stable ID on the active tab element for aria-labelledby
                    activeTabEl.id = 'ite-active-tab';
                    this._contentAreaEl.setAttribute('aria-labelledby', 'ite-active-tab');
                }
            } else if (this._contentAreaEl) {
                this._contentAreaEl.removeAttribute('aria-labelledby');
            }
        }
    }

    // ============================================
    // Initialize
    // ============================================

    const tabManager = new TabBarManager();

    // ============================================
    // Event Delegation for Tab Bar
    // ============================================

    const tabBarEl = document.getElementById('tabBar');
    if (tabBarEl) {
        tabBarEl.addEventListener('click', function (e) {
            const target = /** @type {HTMLElement} */ (e.target);

            // Close button click
            const closeBtn = target.closest('[data-tab-close]');
            if (closeBtn) {
                e.stopPropagation();
                const tabId = closeBtn.getAttribute('data-tab-close');
                if (tabId) {
                    tabManager.closeTab(tabId);
                }
                return;
            }

            // Tab click (switch)
            const tabEl = target.closest('[data-tab-id]');
            if (tabEl) {
                const tabId = tabEl.getAttribute('data-tab-id');
                if (tabId) {
                    tabManager.switchTab(tabId);
                }
            }
        });
    }

    // ============================================
    // Listen for ite:openTable custom DOM event
    // (dispatched by sidebar when user double-clicks a table)
    // ============================================

    document.addEventListener('ite:openTable', function (e) {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail && detail.namespace && detail.tableName) {
            tabManager.openTab(detail.namespace, detail.tableName);
        }
    });

    // ============================================
    // Message Bridge Event Handlers
    // ============================================

    if (messageBridge) {
        // tableSchema event — cache in tab
        messageBridge.onEvent('tableSchema', function (payload) {
            tabManager.handleTableSchema(payload);
        });

        // tableData event — cache in tab
        messageBridge.onEvent('tableData', function (payload) {
            tabManager.handleTableData(payload);
        });

        // saveCellResult / insertRowResult — update dirty state
        messageBridge.onEvent('saveCellResult', function (payload) {
            tabManager.handleSaveResult(payload);
        });

        messageBridge.onEvent('insertRowResult', function (payload) {
            tabManager.handleSaveResult(payload);
        });

        // connectionProgress — handle disconnect
        messageBridge.onEvent('connectionProgress', function (payload) {
            if (payload && (payload.status === 'disconnected' || payload.status === 'error')) {
                tabManager.handleDisconnect();
            }
        });
    }

    // ============================================
    // Keyboard Shortcuts (Task 8)
    // ============================================

    document.addEventListener('keydown', function (e) {
        // Skip if modal dialogs are open
        const deleteOverlay = document.getElementById('deleteDialogOverlay');
        if (deleteOverlay && deleteOverlay.style.display !== 'none') {
            return;
        }
        const formOverlay = document.getElementById('serverFormOverlay');
        if (formOverlay && !formOverlay.hidden) {
            return;
        }

        // Ctrl+Tab / Ctrl+Shift+Tab — cycle tabs
        if (e.ctrlKey && e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                tabManager.prevTab();
            } else {
                tabManager.nextTab();
            }
            return;
        }

        // Ctrl+W — close current tab
        if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'w' || e.key === 'W')) {
            e.preventDefault();
            if (tabManager.activeTabId) {
                tabManager.closeTab(tabManager.activeTabId);
            }
            return;
        }
    });

    // ============================================
    // Expose for testing and cross-module access
    // ============================================

    window.iteTabBarManager = tabManager;

    console.debug(LOG_PREFIX, 'Tab bar initialized');
})();
