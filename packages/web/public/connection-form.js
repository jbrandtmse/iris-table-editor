/**
 * IRIS Table Editor - Web Connection Form
 * Story 16.1: Web Connection Form UI
 *
 * Client-side connection form with validation, CSRF protection,
 * recent connections in localStorage, and session management.
 *
 * Uses vanilla JS, BEM CSS, event delegation, textContent for XSS prevention.
 */
(function () {
    'use strict';

    var LOG_PREFIX = '[IRIS-TE WebForm]';
    var MAX_RECENT_CONNECTIONS = 5;
    var STORAGE_KEY = 'ite-recent-connections';

    // ============================================
    // State
    // ============================================

    var state = {
        csrfToken: null,
        isConnecting: false,
        isTesting: false,
        testAbortController: null
    };

    // ============================================
    // DOM References
    // ============================================

    var connectionView = document.getElementById('connectionView');
    var connectedView = document.getElementById('connectedView');
    var form = document.getElementById('connectionForm');
    var connectBtn = document.getElementById('connectBtn');
    var connectBtnText = document.getElementById('connectBtnText');
    var connectSpinner = document.getElementById('connectSpinner');
    var testBtn = document.getElementById('testBtn');
    var testBtnText = document.getElementById('testBtnText');
    var testSpinner = document.getElementById('testSpinner');
    var cancelTestBtn = document.getElementById('cancelTestBtn');
    var testResult = document.getElementById('testResult');
    var formMessage = document.getElementById('formMessage');
    var recentSection = document.getElementById('recentConnections');
    var recentList = document.getElementById('recentList');
    var disconnectBtn = document.getElementById('disconnectBtn');

    var fields = {
        host: document.getElementById('fieldHost'),
        port: document.getElementById('fieldPort'),
        pathPrefix: document.getElementById('fieldPathPrefix'),
        namespace: document.getElementById('fieldNamespace'),
        useHTTPS: document.getElementById('fieldUseHTTPS'),
        username: document.getElementById('fieldUsername'),
        password: document.getElementById('fieldPassword'),
        remember: document.getElementById('fieldRemember')
    };

    var errors = {
        host: document.getElementById('fieldHostError'),
        port: document.getElementById('fieldPortError'),
        namespace: document.getElementById('fieldNamespaceError'),
        username: document.getElementById('fieldUsernameError'),
        password: document.getElementById('fieldPasswordError')
    };

    // ============================================
    // XSS Prevention
    // ============================================

    /**
     * Escape HTML for safe insertion.
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Escape text for safe use in HTML attributes.
     * @param {string} text
     * @returns {string}
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
     * Announce a message to screen readers via ARIA live region.
     * @param {string} message
     */
    function announce(message) {
        var liveRegion = document.getElementById('ite-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    // ============================================
    // Validation
    // ============================================

    /**
     * Clear all field validation errors.
     */
    function clearErrors() {
        for (var key in errors) {
            if (errors[key]) {
                errors[key].textContent = '';
            }
        }
        var errorInputs = form ? form.querySelectorAll('.ite-connection-form__input--error') : [];
        for (var i = 0; i < errorInputs.length; i++) {
            errorInputs[i].classList.remove('ite-connection-form__input--error');
        }
    }

    /**
     * Set an error on a specific field.
     * @param {string} fieldName
     * @param {string} message
     */
    function setFieldError(fieldName, message) {
        if (errors[fieldName]) {
            errors[fieldName].textContent = message;
        }
        if (fields[fieldName]) {
            fields[fieldName].classList.add('ite-connection-form__input--error');
        }
    }

    /**
     * Clear a specific field error on input.
     * @param {string} fieldName
     */
    function clearFieldError(fieldName) {
        if (errors[fieldName]) {
            errors[fieldName].textContent = '';
        }
        if (fields[fieldName]) {
            fields[fieldName].classList.remove('ite-connection-form__input--error');
        }
    }

    /**
     * Validate the connection form.
     * @returns {boolean} true if valid
     */
    function validateForm() {
        clearErrors();
        var valid = true;

        // Host - required
        var hostVal = fields.host ? fields.host.value.trim() : '';
        if (!hostVal) {
            setFieldError('host', 'Host is required');
            valid = false;
        }

        // Port - required, valid range
        var portVal = fields.port ? fields.port.value.trim() : '';
        if (!portVal) {
            setFieldError('port', 'Port is required');
            valid = false;
        } else {
            var portNum = parseInt(portVal, 10);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                setFieldError('port', 'Port must be between 1 and 65535');
                valid = false;
            }
        }

        // Namespace - required
        var nsVal = fields.namespace ? fields.namespace.value.trim() : '';
        if (!nsVal) {
            setFieldError('namespace', 'Namespace is required');
            valid = false;
        }

        // Username - required
        var userVal = fields.username ? fields.username.value.trim() : '';
        if (!userVal) {
            setFieldError('username', 'Username is required');
            valid = false;
        }

        // Password - required
        var passVal = fields.password ? fields.password.value : '';
        if (!passVal) {
            setFieldError('password', 'Password is required');
            valid = false;
        }

        return valid;
    }

    // ============================================
    // CSRF Token Management (Task 5)
    // ============================================

    /**
     * Fetch a CSRF token from the server.
     * @returns {Promise<string|null>}
     */
    function fetchCsrfToken() {
        return fetch('/api/csrf-token', { credentials: 'same-origin' })
            .then(function (res) {
                if (!res.ok) {
                    console.warn(LOG_PREFIX, 'Failed to fetch CSRF token:', res.status);
                    return null;
                }
                return res.json();
            })
            .then(function (data) {
                if (data && data.csrfToken) {
                    state.csrfToken = data.csrfToken;
                    return data.csrfToken;
                }
                return null;
            })
            .catch(function (err) {
                console.warn(LOG_PREFIX, 'CSRF token fetch error:', err);
                return null;
            });
    }

    /**
     * Refresh the CSRF token (called on 403 errors).
     * @returns {Promise<string|null>}
     */
    function refreshCsrfToken() {
        state.csrfToken = null;
        return fetchCsrfToken();
    }

    // ============================================
    // Connection
    // ============================================

    /**
     * Show the connecting spinner and disable form.
     */
    function setConnecting(connecting) {
        state.isConnecting = connecting;

        if (connectBtn) {
            connectBtn.disabled = connecting;
        }
        if (connectBtnText) {
            connectBtnText.textContent = connecting ? 'Connecting...' : 'Connect';
        }
        if (connectSpinner) {
            connectSpinner.classList.toggle('ite-connection-form__spinner--visible', connecting);
        }

        // Disable/enable all form inputs during connection
        var inputElements = form ? form.querySelectorAll('input') : [];
        for (var i = 0; i < inputElements.length; i++) {
            inputElements[i].disabled = connecting;
        }
    }

    /**
     * Show a form-level message.
     * @param {string} message
     * @param {'error'|'success'} type
     */
    function showFormMessage(message, type) {
        if (formMessage) {
            formMessage.textContent = message;
            formMessage.className = 'ite-connection-form__message ite-connection-form__message--' + type;
        }
    }

    /**
     * Clear the form-level message.
     */
    function clearFormMessage() {
        if (formMessage) {
            formMessage.textContent = '';
            formMessage.className = 'ite-connection-form__message';
        }
    }

    /**
     * Handle form submission: validate, send to /api/connect, handle response.
     */
    function handleConnect() {
        if (state.isConnecting) {
            return;
        }

        clearFormMessage();

        if (!validateForm()) {
            var firstError = form ? form.querySelector('.ite-connection-form__input--error') : null;
            if (firstError) {
                firstError.focus();
            }
            announce('Please fix the validation errors before connecting');
            return;
        }

        setConnecting(true);
        announce('Connecting to server...');

        var data = {
            host: fields.host ? fields.host.value.trim() : '',
            port: fields.port ? parseInt(fields.port.value, 10) : 52773,
            pathPrefix: fields.pathPrefix ? fields.pathPrefix.value.trim() : '',
            namespace: fields.namespace ? fields.namespace.value.trim() : '',
            useHTTPS: fields.useHTTPS ? fields.useHTTPS.checked : false,
            username: fields.username ? fields.username.value.trim() : '',
            password: fields.password ? fields.password.value : ''
        };

        var headers = {
            'Content-Type': 'application/json'
        };
        if (state.csrfToken) {
            headers['X-CSRF-Token'] = state.csrfToken;
        }

        fetch('/api/connect', {
            method: 'POST',
            headers: headers,
            credentials: 'same-origin',
            body: JSON.stringify(data)
        })
        .then(function (res) {
            // Handle CSRF token expiry - retry with fresh token
            if (res.status === 403) {
                return refreshCsrfToken().then(function (newToken) {
                    if (newToken) {
                        headers['X-CSRF-Token'] = newToken;
                        return fetch('/api/connect', {
                            method: 'POST',
                            headers: headers,
                            credentials: 'same-origin',
                            body: JSON.stringify(data)
                        });
                    }
                    // No token available, return original response
                    return res;
                });
            }
            return res;
        })
        .then(function (res) {
            return res.json().then(function (body) {
                return { status: res.status, ok: res.ok, body: body };
            });
        })
        .then(function (result) {
            setConnecting(false);

            if (result.ok && result.body.status === 'connected') {
                // Clear password from form and local variable FIRST (Story 16.2, Task 4.2/4.3)
                if (fields.password) {
                    fields.password.value = '';
                }
                data.password = '';

                // Save to recent connections if "Remember" is checked
                // (saveRecentConnection explicitly excludes password from saved entry)
                if (fields.remember && fields.remember.checked) {
                    saveRecentConnection(data);
                }

                announce('Connected to server');
                showConnectedView();
            } else {
                var errorMsg = result.body.error || 'Connection failed. Please check your settings.';
                showFormMessage(errorMsg, 'error');
                announce('Connection failed: ' + errorMsg);
            }
        })
        .catch(function (err) {
            setConnecting(false);
            console.error(LOG_PREFIX, 'Connect error:', err);
            showFormMessage('Network error. Please check your connection.', 'error');
            announce('Connection failed due to network error');
        });
    }

    /**
     * Handle disconnect button click.
     */
    function handleDisconnect() {
        var headers = {
            'Content-Type': 'application/json'
        };
        if (state.csrfToken) {
            headers['X-CSRF-Token'] = state.csrfToken;
        }

        fetch('/api/disconnect', {
            method: 'POST',
            headers: headers,
            credentials: 'same-origin'
        })
        .then(function () {
            showConnectionForm();
            announce('Disconnected from server');
        })
        .catch(function (err) {
            console.error(LOG_PREFIX, 'Disconnect error:', err);
            // Show the connection form anyway
            showConnectionForm();
        });
    }

    // ============================================
    // Test Connection (Story 16.3)
    // ============================================

    /**
     * Show the testing state: change button text, show spinner, disable buttons.
     * @param {boolean} testing
     */
    function setTesting(testing) {
        state.isTesting = testing;

        if (testBtn) {
            testBtn.disabled = testing;
            testBtn.hidden = testing;
        }
        if (testBtnText) {
            testBtnText.textContent = testing ? 'Testing...' : 'Test Connection';
        }
        if (testSpinner) {
            testSpinner.classList.toggle('ite-connection-form__spinner--visible', testing);
        }
        if (cancelTestBtn) {
            cancelTestBtn.hidden = !testing;
        }
        if (connectBtn) {
            connectBtn.disabled = testing;
        }

        // Disable/enable form inputs during testing
        var inputElements = form ? form.querySelectorAll('input') : [];
        for (var i = 0; i < inputElements.length; i++) {
            inputElements[i].disabled = testing;
        }
    }

    /**
     * Show test result message.
     * @param {string} message
     * @param {'success'|'error'} type
     */
    function showTestResult(message, type) {
        if (testResult) {
            testResult.textContent = message;
            testResult.className = 'ite-connection-form__test-result ite-connection-form__test-result--' + type;
        }
    }

    /**
     * Clear the test result message.
     */
    function clearTestResult() {
        if (testResult) {
            testResult.textContent = '';
            testResult.className = 'ite-connection-form__test-result';
        }
    }

    /**
     * Handle "Test Connection" button click.
     * Validates form, POSTs to /api/test-connection, shows results.
     */
    function handleTestConnection() {
        if (state.isTesting || state.isConnecting) {
            return;
        }

        clearFormMessage();
        clearTestResult();

        if (!validateForm()) {
            var firstError = form ? form.querySelector('.ite-connection-form__input--error') : null;
            if (firstError) {
                firstError.focus();
            }
            announce('Please fix the validation errors before testing');
            return;
        }

        setTesting(true);
        announce('Testing connection...');

        var abortController = new AbortController();
        state.testAbortController = abortController;

        var data = {
            host: fields.host ? fields.host.value.trim() : '',
            port: fields.port ? parseInt(fields.port.value, 10) : 52773,
            pathPrefix: fields.pathPrefix ? fields.pathPrefix.value.trim() : '',
            namespace: fields.namespace ? fields.namespace.value.trim() : '',
            useHTTPS: fields.useHTTPS ? fields.useHTTPS.checked : false,
            username: fields.username ? fields.username.value.trim() : '',
            password: fields.password ? fields.password.value : ''
        };

        var headers = {
            'Content-Type': 'application/json'
        };
        if (state.csrfToken) {
            headers['X-CSRF-Token'] = state.csrfToken;
        }

        fetch('/api/test-connection', {
            method: 'POST',
            headers: headers,
            credentials: 'same-origin',
            body: JSON.stringify(data),
            signal: abortController.signal
        })
        .then(function (res) {
            return res.json().then(function (body) {
                return { status: res.status, ok: res.ok, body: body };
            });
        })
        .then(function (result) {
            state.testAbortController = null;
            setTesting(false);

            if (result.ok && result.body.status === 'success') {
                var msg = 'Connection successful';
                if (result.body.version && result.body.version !== 'unknown') {
                    msg += ' — IRIS version: ' + result.body.version;
                }
                showTestResult(msg, 'success');
                announce(msg);
            } else {
                var errorMsg = result.body.error || 'Connection test failed. Please check your settings.';
                showTestResult('Could not connect: ' + errorMsg, 'error');
                announce('Connection test failed: ' + errorMsg);
            }
        })
        .catch(function (err) {
            state.testAbortController = null;
            setTesting(false);

            if (err.name === 'AbortError') {
                clearTestResult();
                announce('Connection test cancelled');
                return;
            }

            console.error(LOG_PREFIX, 'Test connection error:', err);
            showTestResult('Could not connect: Network error. Please check your connection.', 'error');
            announce('Connection test failed due to network error');
        });
    }

    /**
     * Handle "Cancel" button click during test connection.
     */
    function handleCancelTest() {
        if (state.testAbortController) {
            state.testAbortController.abort();
            state.testAbortController = null;
        }
        setTesting(false);
        clearTestResult();
        announce('Connection test cancelled');
    }

    // ============================================
    // View Switching
    // ============================================

    /**
     * Show the connection form, hide the connected view.
     */
    function showConnectionForm() {
        if (connectionView) {
            connectionView.hidden = false;
        }
        if (connectedView) {
            connectedView.hidden = true;
        }
    }

    /**
     * Show the connected view, hide the connection form.
     */
    function showConnectedView() {
        if (connectionView) {
            connectionView.hidden = true;
        }
        if (connectedView) {
            connectedView.hidden = false;
        }
    }

    // ============================================
    // Recent Connections (Task 3)
    // ============================================

    /**
     * Load recent connections from localStorage.
     * @returns {Array}
     */
    function loadRecentConnections() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                var parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    return parsed.slice(0, MAX_RECENT_CONNECTIONS);
                }
            }
        } catch (e) {
            console.warn(LOG_PREFIX, 'Failed to load recent connections:', e);
        }
        return [];
    }

    /**
     * Save a connection to recent connections in localStorage.
     * Does NOT save password.
     * @param {Object} data - Connection data
     */
    function saveRecentConnection(data) {
        var connections = loadRecentConnections();

        var entry = {
            host: data.host,
            port: data.port,
            pathPrefix: data.pathPrefix || '',
            namespace: data.namespace,
            username: data.username,
            useHTTPS: data.useHTTPS || false
        };

        // Remove existing entry for same host:port:namespace:username
        connections = connections.filter(function (c) {
            return !(c.host === entry.host && c.port === entry.port &&
                     c.namespace === entry.namespace && c.username === entry.username);
        });

        // Add to front
        connections.unshift(entry);

        // Limit to max
        connections = connections.slice(0, MAX_RECENT_CONNECTIONS);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
        } catch (e) {
            console.warn(LOG_PREFIX, 'Failed to save recent connections:', e);
        }

        renderRecentConnections();
    }

    /**
     * Remove a recent connection by index.
     * @param {number} index
     */
    function removeRecentConnection(index) {
        var connections = loadRecentConnections();
        connections.splice(index, 1);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
        } catch (e) {
            console.warn(LOG_PREFIX, 'Failed to save recent connections:', e);
        }

        renderRecentConnections();
        announce('Recent connection removed');
    }

    /**
     * Pre-fill the form from a recent connection.
     * @param {Object} conn - Saved connection data
     */
    function prefillFromRecent(conn) {
        if (fields.host) { fields.host.value = conn.host || ''; }
        if (fields.port) { fields.port.value = String(conn.port || 52773); }
        if (fields.pathPrefix) { fields.pathPrefix.value = conn.pathPrefix || ''; }
        if (fields.namespace) { fields.namespace.value = conn.namespace || ''; }
        if (fields.useHTTPS) { fields.useHTTPS.checked = !!conn.useHTTPS; }
        if (fields.username) { fields.username.value = conn.username || ''; }
        if (fields.password) {
            fields.password.value = '';
            fields.password.focus();
        }
        if (fields.remember) { fields.remember.checked = true; }

        clearErrors();
        clearFormMessage();
        announce('Form pre-filled from recent connection. Enter your password to connect.');
    }

    /**
     * Render the recent connections list.
     */
    function renderRecentConnections() {
        var connections = loadRecentConnections();

        if (!recentSection || !recentList) {
            return;
        }

        if (connections.length === 0) {
            recentSection.hidden = true;
            recentList.innerHTML = '';
            return;
        }

        recentSection.hidden = false;
        var html = '';

        for (var i = 0; i < connections.length; i++) {
            var c = connections[i];
            var scheme = c.useHTTPS ? 'https' : 'http';
            var serverText = escapeHtml(c.host + ':' + c.port);
            var detailText = escapeHtml(c.username + ' @ ' + c.namespace);
            if (c.pathPrefix) {
                detailText += escapeHtml(' (' + scheme + ', prefix: ' + c.pathPrefix + ')');
            } else {
                detailText += escapeHtml(' (' + scheme + ')');
            }

            html += '<li class="ite-recent-connections__item" tabindex="0" role="button"'
                + ' data-recent-index="' + i + '"'
                + ' aria-label="Connect to ' + escapeAttr(c.host) + ':' + escapeAttr(String(c.port)) + ' as ' + escapeAttr(c.username) + '">'
                + '<div class="ite-recent-connections__info">'
                + '<div class="ite-recent-connections__server">' + serverText + '</div>'
                + '<div class="ite-recent-connections__details">' + detailText + '</div>'
                + '</div>'
                + '<button class="ite-recent-connections__remove" data-remove-index="' + i + '"'
                + ' title="Remove" aria-label="Remove connection to ' + escapeAttr(c.host) + '">'
                + '&#10005;</button>'
                + '</li>';
        }

        recentList.innerHTML = html;
    }

    // ============================================
    // Session Check (Task 4.4)
    // ============================================

    /**
     * Check session status on page load.
     */
    function checkSession() {
        fetch('/api/session', { credentials: 'same-origin' })
            .then(function (res) {
                if (!res.ok) {
                    return { status: 'disconnected' };
                }
                return res.json();
            })
            .then(function (data) {
                if (data && data.status === 'connected') {
                    showConnectedView();
                } else {
                    showConnectionForm();
                }
            })
            .catch(function () {
                showConnectionForm();
            });
    }

    // ============================================
    // Event Handlers
    // ============================================

    // Form submit
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            handleConnect();
        });
    }

    // Test Connection button
    if (testBtn) {
        testBtn.addEventListener('click', function () {
            handleTestConnection();
        });
    }

    // Cancel Test button
    if (cancelTestBtn) {
        cancelTestBtn.addEventListener('click', function () {
            handleCancelTest();
        });
    }

    // Disconnect button
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', function () {
            handleDisconnect();
        });
    }

    // Clear field errors on input
    if (form) {
        form.addEventListener('input', function (e) {
            var target = e.target;
            var field = target.closest('.ite-connection-form__field');
            if (field) {
                var fieldName = field.getAttribute('data-field');
                if (fieldName && errors[fieldName]) {
                    clearFieldError(fieldName);
                }
            }
            clearFormMessage();
        });
    }

    // Recent connections: click to prefill, click remove button to delete
    if (recentList) {
        recentList.addEventListener('click', function (e) {
            var target = e.target;

            // Check for remove button
            var removeBtn = target.closest('[data-remove-index]');
            if (removeBtn) {
                e.stopPropagation();
                var removeIndex = parseInt(removeBtn.getAttribute('data-remove-index'), 10);
                if (!isNaN(removeIndex)) {
                    removeRecentConnection(removeIndex);
                }
                return;
            }

            // Check for item click (prefill)
            var item = target.closest('[data-recent-index]');
            if (item) {
                var index = parseInt(item.getAttribute('data-recent-index'), 10);
                if (!isNaN(index)) {
                    var connections = loadRecentConnections();
                    if (connections[index]) {
                        prefillFromRecent(connections[index]);
                    }
                }
            }
        });

        // Keyboard: Enter/Space to activate recent connection items
        recentList.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                var item = e.target.closest('[data-recent-index]');
                if (item) {
                    e.preventDefault();
                    item.click();
                }
            }
        });
    }

    // ============================================
    // Initialization
    // ============================================

    // Fetch CSRF token on page load
    fetchCsrfToken();

    // Check session status
    checkSession();

    // Render recent connections
    renderRecentConnections();

    console.debug(LOG_PREFIX, 'Connection form initialized');

    // Expose for testing
    window.iteConnectionForm = {
        validateForm: validateForm,
        loadRecentConnections: loadRecentConnections,
        saveRecentConnection: saveRecentConnection,
        removeRecentConnection: removeRecentConnection,
        prefillFromRecent: prefillFromRecent,
        setConnecting: setConnecting,
        setTesting: setTesting,
        handleTestConnection: handleTestConnection,
        handleCancelTest: handleCancelTest,
        showConnectionForm: showConnectionForm,
        showConnectedView: showConnectedView,
        getState: function () { return state; },
        clearErrors: clearErrors,
        setFieldError: setFieldError,
        escapeAttr: escapeAttr
    };
})();
