/**
 * IRIS Table Editor - WebSocket Auto-Reconnect Client
 * Story 16.5: Session Persistence & Auto-Reconnect
 *
 * Browser WebSocket client connecting to ws://host/ws.
 * Auto-reconnects with exponential backoff on network disconnect.
 * Distinguishes session expiry (close code 4002) from network errors.
 *
 * Uses vanilla JS, BEM CSS, event delegation.
 */
(function () {
    'use strict';

    var LOG_PREFIX = '[IRIS-TE WS]';

    // ============================================
    // Configuration
    // ============================================

    var BASE_DELAY_MS = 1000;
    var MAX_DELAY_MS = 30000;
    var MAX_RETRIES = 10;
    var JITTER_FACTOR = 0.2;
    var WS_CLOSE_SESSION_EXPIRED = 4002;

    // ============================================
    // State
    // ============================================

    var ws = null;
    var retryCount = 0;
    var retryTimer = null;
    var intentionalClose = false;

    // ============================================
    // DOM References
    // ============================================

    var banner = document.getElementById('reconnectBanner');
    var bannerMessage = document.getElementById('reconnectMessage');
    var bannerRefreshBtn = document.getElementById('reconnectRefreshBtn');

    // ============================================
    // Screen Reader Announcements
    // ============================================

    function announce(message) {
        var liveRegion = document.getElementById('ite-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    // ============================================
    // Backoff Algorithm
    // ============================================

    /**
     * Calculate delay with exponential backoff and jitter.
     * Formula: min(baseDelay * 2^attempt, maxDelay) + random jitter (+-20%)
     * @param {number} attempt - Zero-based attempt number
     * @returns {number} Delay in milliseconds
     */
    function calculateBackoff(attempt) {
        var exponential = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
        var jitter = exponential * JITTER_FACTOR * (2 * Math.random() - 1);
        return Math.max(0, Math.round(exponential + jitter));
    }

    // ============================================
    // Banner Management
    // ============================================

    function showBanner(message) {
        if (banner) {
            banner.hidden = false;
        }
        if (bannerMessage) {
            bannerMessage.textContent = message;
        }
        if (bannerRefreshBtn) {
            bannerRefreshBtn.hidden = true;
        }
    }

    function showBannerWithRefresh(message) {
        if (banner) {
            banner.hidden = false;
        }
        if (bannerMessage) {
            bannerMessage.textContent = message;
        }
        if (bannerRefreshBtn) {
            bannerRefreshBtn.hidden = false;
        }
    }

    function hideBanner() {
        if (banner) {
            banner.hidden = true;
        }
    }

    // ============================================
    // WebSocket Connection
    // ============================================

    function getWsUrl() {
        var wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return wsProtocol + '//' + location.host + '/ws';
    }

    function connect() {
        if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
            return;
        }

        // Clear any pending retry timer to prevent double-connect races
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }

        intentionalClose = false;

        try {
            ws = new WebSocket(getWsUrl());
        } catch (err) {
            console.error(LOG_PREFIX, 'Failed to create WebSocket:', err);
            scheduleReconnect();
            return;
        }

        ws.onopen = function () {
            console.debug(LOG_PREFIX, 'WebSocket connected');
            var wasReconnect = retryCount > 0;
            retryCount = 0;

            if (wasReconnect) {
                hideBanner();
                announce('Connection restored');
                // Fire data refresh event for listeners
                document.dispatchEvent(new CustomEvent('ite-ws-reconnected'));
            }
        };

        ws.onclose = function (event) {
            ws = null;

            if (intentionalClose) {
                return;
            }

            // Session expiry: close code 4002
            if (event.code === WS_CLOSE_SESSION_EXPIRED) {
                console.log(LOG_PREFIX, 'Session expired (WS close code 4002)');
                hideBanner();
                // Delegate to connection form's session expired handler
                if (window.iteConnectionForm && typeof window.iteConnectionForm.handleSessionExpired === 'function') {
                    window.iteConnectionForm.handleSessionExpired();
                }
                return;
            }

            // Network disconnect or other error
            console.log(LOG_PREFIX, 'WebSocket disconnected (code:', event.code, ')');
            showBanner('Connection lost. Reconnecting...');
            announce('Connection lost. Reconnecting...');
            scheduleReconnect();
        };

        ws.onerror = function () {
            // Error is followed by close, so handling happens in onclose
            console.warn(LOG_PREFIX, 'WebSocket error');
        };

        ws.onmessage = function (event) {
            try {
                var data = JSON.parse(event.data);
                // Dispatch WebSocket messages as custom events for other modules
                document.dispatchEvent(new CustomEvent('ite-ws-message', { detail: data }));
            } catch (err) {
                console.warn(LOG_PREFIX, 'Failed to parse WebSocket message:', err);
            }
        };
    }

    // ============================================
    // Reconnection Logic
    // ============================================

    function scheduleReconnect() {
        if (retryCount >= MAX_RETRIES) {
            console.log(LOG_PREFIX, 'Max retries reached (' + MAX_RETRIES + ')');
            showBannerWithRefresh('Connection lost. Please refresh the page.');
            announce('Connection lost. Please refresh the page.');
            return;
        }

        var delay = calculateBackoff(retryCount);
        console.debug(LOG_PREFIX, 'Reconnecting in ' + delay + 'ms (attempt ' + (retryCount + 1) + '/' + MAX_RETRIES + ')');
        retryCount++;

        retryTimer = setTimeout(function () {
            retryTimer = null;
            connect();
        }, delay);
    }

    /**
     * Intentionally close the WebSocket (e.g., on user disconnect).
     */
    function disconnect() {
        intentionalClose = true;
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        retryCount = 0;
        if (ws) {
            ws.close();
            ws = null;
        }
        hideBanner();
    }

    /**
     * Full cleanup: disconnect WebSocket and stop observing DOM changes.
     * Call when the page/component is being torn down.
     */
    function destroy() {
        disconnect();
        if (viewObserver) {
            viewObserver.disconnect();
            viewObserver = null;
        }
    }

    // ============================================
    // Event Handlers
    // ============================================

    // Refresh button click
    if (bannerRefreshBtn) {
        bannerRefreshBtn.addEventListener('click', function () {
            location.reload();
        });
    }

    // ============================================
    // Auto-connect when page loads in connected state
    // ============================================

    // Listen for connection state changes to auto-connect/disconnect WS.
    // The connection form dispatches these implicitly via view switches.
    // This also handles the initial page load: checkSession() calls
    // showConnectedView() which removes the hidden attribute, triggering
    // the observer to call connect().
    var connectedView = document.getElementById('connectedView');
    var viewObserver = null;
    if (connectedView) {
        viewObserver = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].attributeName === 'hidden') {
                    if (!connectedView.hidden) {
                        // Switched to connected view — start WebSocket
                        connect();
                    } else {
                        // Switched to connection form — stop WebSocket
                        disconnect();
                    }
                }
            }
        });
        viewObserver.observe(connectedView, { attributes: true, attributeFilter: ['hidden'] });

        // If already in connected state at script load time (e.g., checkSession
        // completed before this script ran), connect immediately
        if (!connectedView.hidden) {
            connect();
        }
    }

    console.debug(LOG_PREFIX, 'WebSocket reconnect client initialized');

    // ============================================
    // Expose for testing
    // ============================================

    window.iteWsReconnect = {
        connect: connect,
        disconnect: disconnect,
        destroy: destroy,
        calculateBackoff: calculateBackoff,
        getState: function () {
            return {
                ws: ws,
                retryCount: retryCount,
                retryTimer: retryTimer,
                intentionalClose: intentionalClose
            };
        },
        showBanner: showBanner,
        hideBanner: hideBanner,
        showBannerWithRefresh: showBannerWithRefresh,
        _setRetryCount: function (n) { retryCount = n; },
        _constants: {
            BASE_DELAY_MS: BASE_DELAY_MS,
            MAX_DELAY_MS: MAX_DELAY_MS,
            MAX_RETRIES: MAX_RETRIES,
            JITTER_FACTOR: JITTER_FACTOR,
            WS_CLOSE_SESSION_EXPIRED: WS_CLOSE_SESSION_EXPIRED
        }
    };
})();
