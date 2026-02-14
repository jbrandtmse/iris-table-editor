/**
 * IRIS Table Editor - Client-Side SPA Router
 * Story 17.1: SPA Shell - Task 4
 * Story 17.5: Browser Navigation - Tasks 1-4
 *
 * Parses URL paths to extract table context (namespace and table name).
 * Uses HTML5 History API for client-side routing.
 * On page load with a table URL + active bridge: sends selectTable command.
 * Updates URL when tables are selected and handles browser back/forward.
 *
 * Route format: /table/{namespace}/{tableName}
 *
 * Uses vanilla JS.
 */
(function () {
    'use strict';

    var LOG_PREFIX = '[IRIS-TE Router]';

    // Track current route to avoid duplicate pushState calls
    var currentRoute = null;

    /**
     * Parse the current URL path for table context.
     * Expected format: /table/{namespace}/{tableName}
     * @param {string} pathname - URL pathname to parse
     * @returns {{ namespace: string, tableName: string } | null}
     */
    function parseTableRoute(pathname) {
        // Match /table/{namespace}/{tableName}
        var match = pathname.match(/^\/table\/([^/]+)\/([^/]+)$/);
        if (match) {
            try {
                return {
                    namespace: decodeURIComponent(match[1]),
                    tableName: decodeURIComponent(match[2])
                };
            } catch (e) {
                // Malformed percent-encoding (e.g., %ZZ) throws URIError
                console.warn(LOG_PREFIX, 'Failed to decode URL components:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Build a table URL path from namespace and table name.
     * @param {string} namespace
     * @param {string} tableName
     * @returns {string}
     */
    function buildTablePath(namespace, tableName) {
        return '/table/' + encodeURIComponent(namespace) + '/' + encodeURIComponent(tableName);
    }

    /**
     * Check if a route matches the current tracked route.
     * @param {string} namespace
     * @param {string} tableName
     * @returns {boolean}
     */
    function isSameRoute(namespace, tableName) {
        return currentRoute !== null &&
            currentRoute.namespace === namespace &&
            currentRoute.tableName === tableName;
    }

    // ============================================
    // URL Updates on Table Events (Tasks 1, 4)
    // ============================================

    /**
     * Update the browser URL when a table is selected.
     * Called from bridge event handler for tableSelected events.
     * @param {object} payload - tableSelected event payload
     */
    function handleTableSelectedEvent(payload) {
        if (!payload || !payload.namespace || !payload.tableName) {
            return;
        }

        var namespace = payload.namespace;
        var tableName = payload.tableName;

        // Don't push duplicate history entries for the same table
        if (isSameRoute(namespace, tableName)) {
            return;
        }

        var path = buildTablePath(namespace, tableName);
        console.debug(LOG_PREFIX, 'Updating URL to', path);
        history.pushState({ namespace: namespace, tableName: tableName }, '', path);
        currentRoute = { namespace: namespace, tableName: tableName };
    }

    /**
     * Register bridge event handlers for URL updates.
     * Called when the bridge becomes available.
     */
    function registerBridgeHandlers() {
        if (!window.iteMessageBridge || typeof window.iteMessageBridge.onEvent !== 'function') {
            return;
        }

        console.debug(LOG_PREFIX, 'Registering bridge event handlers for URL updates');
        window.iteMessageBridge.onEvent('tableSelected', handleTableSelectedEvent);
    }

    // ============================================
    // Browser Back/Forward Navigation (Task 2)
    // ============================================

    /**
     * Handle browser back/forward navigation.
     * Parses the new URL and sends selectTable command if it's a table route.
     */
    window.addEventListener('popstate', function () {
        var route = parseTableRoute(window.location.pathname);

        if (route) {
            console.debug(LOG_PREFIX, 'Popstate: navigating to', route.namespace, route.tableName);
            currentRoute = { namespace: route.namespace, tableName: route.tableName };

            if (window.iteMessageBridge) {
                window.iteMessageBridge.sendCommand('selectTable', {
                    tableName: route.tableName,
                    namespace: route.namespace
                });
            }
        } else {
            // Navigated to root or non-table route
            console.debug(LOG_PREFIX, 'Popstate: non-table route, clearing current route');
            currentRoute = null;
        }
    });

    // ============================================
    // Initial Route & Post-Connect Redirect (Task 3)
    // ============================================

    /**
     * Send selectTable command for the given route via bridge.
     * @param {{ namespace: string, tableName: string }} route
     */
    function navigateToRoute(route) {
        if (window.iteMessageBridge) {
            console.debug(LOG_PREFIX, 'Bridge available, sending selectTable for', route.tableName);
            currentRoute = { namespace: route.namespace, tableName: route.tableName };
            window.iteMessageBridge.sendCommand('selectTable', {
                tableName: route.tableName,
                namespace: route.namespace
            });
        }
    }

    /**
     * Attempt to load a table from the URL on page load.
     * Only fires if the bridge exists and URL contains a table route.
     * Polls for bridge availability for up to 30 seconds to handle
     * post-connect redirect (user fills form, connects, bridge initializes).
     */
    function handleInitialRoute() {
        var route = parseTableRoute(window.location.pathname);
        if (!route) {
            return;
        }

        console.debug(LOG_PREFIX, 'Table route detected:', route.namespace, route.tableName);

        // If bridge is already available, navigate immediately
        if (window.iteMessageBridge) {
            navigateToRoute(route);
            registerBridgeHandlers();
            return;
        }

        // Poll for bridge availability for up to 30 seconds.
        // This handles the post-connect redirect case where the user
        // opens a bookmarked URL, fills in the connection form, and
        // the bridge becomes available after connection.
        var attempts = 0;
        var maxAttempts = 300;
        var checkInterval = setInterval(function () {
            attempts++;
            if (window.iteMessageBridge) {
                clearInterval(checkInterval);
                navigateToRoute(route);
                registerBridgeHandlers();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.debug(LOG_PREFIX, 'Bridge not available after timeout, skipping route load');
            }
        }, 100);
    }

    // ============================================
    // Bridge Lifecycle Hooks
    // ============================================

    // Register handlers when bridge becomes available on reconnect
    document.addEventListener('ite-ws-reconnected', function () {
        // Small delay to let WebMessageBridge re-initialize first
        setTimeout(function () {
            registerBridgeHandlers();

            // If we have a current table route, re-send selectTable to restore state
            var route = parseTableRoute(window.location.pathname);
            if (route && window.iteMessageBridge) {
                console.debug(LOG_PREFIX, 'Reconnected, restoring route for', route.tableName);
                window.iteMessageBridge.sendCommand('selectTable', {
                    tableName: route.tableName,
                    namespace: route.namespace
                });
            }
        }, 50);
    });

    // ============================================
    // Initialization
    // ============================================

    // Sync currentRoute from initial URL
    var initialRoute = parseTableRoute(window.location.pathname);
    if (initialRoute) {
        currentRoute = { namespace: initialRoute.namespace, tableName: initialRoute.tableName };
    }

    // Handle initial page load route
    handleInitialRoute();

    // If bridge is already available at script load time, register handlers
    if (window.iteMessageBridge) {
        registerBridgeHandlers();
    }

    // Expose for testing
    window.iteSpaRouter = {
        parseTableRoute: parseTableRoute,
        buildTablePath: buildTablePath,
        handleTableSelectedEvent: handleTableSelectedEvent,
        getCurrentRoute: function () { return currentRoute; },
        _resetCurrentRoute: function () { currentRoute = null; },
        registerBridgeHandlers: registerBridgeHandlers
    };
})();
