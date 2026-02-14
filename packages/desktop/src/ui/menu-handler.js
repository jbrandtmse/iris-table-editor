/**
 * IRIS Table Editor - Menu Action Handler
 * Story 11.4: Native Menu
 *
 * Handles menuAction events from the main process (native menu clicks).
 * Dispatches actions to the appropriate UI components:
 * - TabBarManager for tab operations
 * - ServerForm for connection operations
 * - Local events for grid operations (setNull, toggleFilterPanel, showShortcuts)
 * - Sidebar toggle for view operations
 *
 * Uses IMessageBridge pattern, BEM CSS conventions.
 */
(function () {
    'use strict';

    var LOG_PREFIX = '[IRIS-TE MenuHandler]';

    var messageBridge = window.iteMessageBridge;
    if (!messageBridge) {
        console.error(LOG_PREFIX, 'Message bridge not initialized — menu handler disabled');
        return;
    }

    /**
     * Handle a menuAction event from the main process.
     * @param {object} payload - { action: string, payload?: unknown }
     */
    function handleMenuAction(payload) {
        if (!payload || !payload.action) {
            console.warn(LOG_PREFIX, 'Received menuAction with no action');
            return;
        }

        var action = payload.action;
        console.log(LOG_PREFIX, 'Handling menu action:', action);

        switch (action) {
            case 'newConnection':
                if (window.iteServerForm) {
                    window.iteServerForm.openAddForm();
                } else {
                    console.warn(LOG_PREFIX, 'Server form not available');
                }
                break;

            case 'closeTab': {
                var tabManager = window.iteTabBarManager;
                if (tabManager) {
                    var activeTab = tabManager.getActiveTab();
                    if (activeTab) {
                        tabManager.closeTab(activeTab.id);
                    }
                }
                break;
            }

            case 'closeAllTabs': {
                var manager = window.iteTabBarManager;
                if (manager) {
                    // Close all tabs with dirty check per tab.
                    // Iterate in reverse to avoid index issues.
                    var tabs = manager.tabs.slice();
                    for (var i = tabs.length - 1; i >= 0; i--) {
                        var closed = manager.closeTab(tabs[i].id);
                        if (!closed) {
                            // User cancelled a dirty tab close — stop
                            break;
                        }
                    }
                }
                break;
            }

            case 'toggleSidebar': {
                var sidebar = document.querySelector('.ite-app-shell__sidebar');
                var resizeHandle = document.getElementById('sidebarResizeHandle');
                if (sidebar) {
                    // Use computed style to detect visibility regardless of how it was hidden
                    var computedDisplay = window.getComputedStyle(sidebar).display;
                    var isHidden = computedDisplay === 'none' || sidebar.style.display === 'none';
                    // Story 11.5: Capture sidebar width BEFORE changing display
                    // so getBoundingClientRect() returns the real width while still visible
                    var sidebarWidth = isHidden
                        ? Math.round(parseFloat(sidebar.style.width) || 280)
                        : Math.round(sidebar.getBoundingClientRect().width || 280);
                    sidebar.style.display = isHidden ? '' : 'none';
                    // Story 11.5: Also toggle resize handle visibility
                    if (resizeHandle) {
                        resizeHandle.style.display = isHidden ? '' : 'none';
                    }
                    // Story 11.5: Send sidebar state to main process for persistence
                    messageBridge.sendCommand('sidebarStateChanged', {
                        width: sidebarWidth,
                        isVisible: isHidden, // was hidden, now visible (or vice versa)
                    });
                }
                break;
            }

            case 'toggleFilterPanel':
                messageBridge.emitLocalEvent('menuToggleFilterPanel', {});
                break;

            case 'showShortcuts':
                messageBridge.emitLocalEvent('menuShowShortcuts', {});
                break;

            case 'setNull':
                messageBridge.emitLocalEvent('menuSetNull', {});
                break;

            default:
                console.warn(LOG_PREFIX, 'Unknown menu action:', action);
        }
    }

    // Register for menuAction events from the main process
    messageBridge.onEvent('menuAction', handleMenuAction);

    console.debug(LOG_PREFIX, 'Menu handler initialized');
})();
