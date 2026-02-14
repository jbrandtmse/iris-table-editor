/**
 * IRIS Table Editor - Client-Side SPA Router
 * Story 17.1: SPA Shell - Task 4
 *
 * Parses URL paths to extract table context (namespace and table name).
 * Uses HTML5 History API for client-side routing.
 * On page load with a table URL + active bridge: sends selectTable command.
 *
 * Route format: /table/{namespace}/{tableName}
 *
 * Uses vanilla JS.
 */
(function () {
    'use strict';

    var LOG_PREFIX = '[IRIS-TE Router]';

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
            return {
                namespace: decodeURIComponent(match[1]),
                tableName: decodeURIComponent(match[2])
            };
        }
        return null;
    }

    /**
     * Attempt to load a table from the URL on page load.
     * Only fires if the bridge exists and URL contains a table route.
     */
    function handleInitialRoute() {
        var route = parseTableRoute(window.location.pathname);
        if (!route) {
            return;
        }

        console.debug(LOG_PREFIX, 'Table route detected:', route.namespace, route.tableName);

        // Wait for bridge to be available (it initializes when connected view is shown)
        // Check periodically for up to 5 seconds
        var attempts = 0;
        var maxAttempts = 50;
        var checkInterval = setInterval(function () {
            attempts++;
            if (window.iteMessageBridge) {
                clearInterval(checkInterval);
                console.debug(LOG_PREFIX, 'Bridge available, sending selectTable for', route.tableName);
                window.iteMessageBridge.sendCommand('selectTable', {
                    tableName: route.tableName,
                    namespace: route.namespace
                });
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.debug(LOG_PREFIX, 'Bridge not available after timeout, skipping route load');
            }
        }, 100);
    }

    // Handle initial page load route
    handleInitialRoute();

    // Expose for testing
    window.iteSpaRouter = {
        parseTableRoute: parseTableRoute
    };
})();
