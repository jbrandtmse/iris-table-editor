/**
 * IRIS Table Editor - Server Form UI Component
 * Story 12.2: Server Form
 *
 * Provides add/edit form for server connections:
 * - openAddForm() — empty form for new server (AC: 1)
 * - openEditForm(serverConfig) — pre-populated form for editing (AC: 5)
 * - Client-side validation with inline errors (AC: 3)
 * - Save via IMessageBridge (AC: 2)
 * - Cancel closes without saving (AC: 6)
 * - Duplicate name error from host (AC: 4)
 *
 * Uses IMessageBridge pattern, BEM CSS, event delegation, escapeHtml() for XSS.
 */
(function () {
    'use strict';

    const LOG_PREFIX = '[IRIS-TE ServerForm]';

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
        const liveRegion = document.getElementById('ite-form-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    // ============================================
    // Form State
    // ============================================

    /**
     * @typedef {Object} FormState
     * @property {boolean} isOpen - Whether the form is visible
     * @property {'add'|'edit'} mode - Current form mode
     * @property {string|null} originalName - Original server name (for edit mode)
     * @property {boolean} isSaving - Whether a save operation is in progress
     */

    /** @type {FormState} */
    const formState = {
        isOpen: false,
        mode: 'add',
        originalName: null,
        isSaving: false,
        isTesting: false
    };

    // ============================================
    // DOM References
    // ============================================

    const overlay = document.getElementById('serverFormOverlay');
    const form = document.getElementById('serverForm');
    const formTitle = document.getElementById('formTitle');
    const closeBtn = document.getElementById('formCloseBtn');
    const cancelBtn = document.getElementById('formCancelBtn');
    const saveBtn = document.getElementById('formSaveBtn');
    const testBtn = document.getElementById('testConnectionBtn');
    const testResult = document.getElementById('testResult');

    // Field references
    const fields = {
        name: document.getElementById('fieldName'),
        description: document.getElementById('fieldDescription'),
        hostname: document.getElementById('fieldHostname'),
        port: document.getElementById('fieldPort'),
        pathPrefix: document.getElementById('fieldPathPrefix'),
        ssl: document.getElementById('fieldSsl'),
        username: document.getElementById('fieldUsername'),
        password: document.getElementById('fieldPassword')
    };

    // Error display references
    const errors = {
        name: document.getElementById('fieldNameError'),
        hostname: document.getElementById('fieldHostnameError'),
        port: document.getElementById('fieldPortError'),
        username: document.getElementById('fieldUsernameError'),
        password: document.getElementById('fieldPasswordError')
    };

    // ============================================
    // Validation
    // ============================================

    /**
     * Clear all validation errors
     */
    function clearErrors() {
        for (const key in errors) {
            if (errors[key]) {
                errors[key].textContent = '';
            }
        }
        // Remove error styling from all inputs
        var fieldElements = form ? form.querySelectorAll('.ite-form__input') : [];
        for (var i = 0; i < fieldElements.length; i++) {
            fieldElements[i].classList.remove('ite-form__input--error');
        }
    }

    /**
     * Set a validation error on a field
     * @param {string} fieldName - Field identifier (name, hostname, port, username, password)
     * @param {string} message - Error message to display
     */
    function setFieldError(fieldName, message) {
        if (errors[fieldName]) {
            errors[fieldName].textContent = message;
        }
        if (fields[fieldName]) {
            fields[fieldName].classList.add('ite-form__input--error');
        }
    }

    /**
     * Clear a specific field error
     * @param {string} fieldName - Field identifier
     */
    function clearFieldError(fieldName) {
        if (errors[fieldName]) {
            errors[fieldName].textContent = '';
        }
        if (fields[fieldName]) {
            fields[fieldName].classList.remove('ite-form__input--error');
        }
    }

    /**
     * Validate the form fields
     * @returns {boolean} true if form is valid
     */
    function validateForm() {
        clearErrors();
        var valid = true;

        // Server Name - required
        var nameVal = fields.name ? fields.name.value.trim() : '';
        if (!nameVal) {
            setFieldError('name', 'Server name is required');
            valid = false;
        }

        // Hostname - required
        var hostnameVal = fields.hostname ? fields.hostname.value.trim() : '';
        if (!hostnameVal) {
            setFieldError('hostname', 'Host is required');
            valid = false;
        }

        // Port - required, must be valid number
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

        // Username - required
        var usernameVal = fields.username ? fields.username.value.trim() : '';
        if (!usernameVal) {
            setFieldError('username', 'Username is required');
            valid = false;
        }

        // Password - required for add mode, optional for edit mode
        var passwordVal = fields.password ? fields.password.value : '';
        if (formState.mode === 'add' && !passwordVal) {
            setFieldError('password', 'Password is required');
            valid = false;
        }

        return valid;
    }

    /**
     * Validate form for test connection - password is ALWAYS required
     * @returns {boolean} true if form is valid for testing
     */
    function validateFormForTest() {
        clearErrors();
        var valid = true;

        // Server Name - NOT required for test connection (not used for testing)
        // Hostname - required
        var hostnameVal = fields.hostname ? fields.hostname.value.trim() : '';
        if (!hostnameVal) {
            setFieldError('hostname', 'Host is required');
            valid = false;
        }

        // Port - required, must be valid number
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

        // Username - required
        var usernameVal = fields.username ? fields.username.value.trim() : '';
        if (!usernameVal) {
            setFieldError('username', 'Username is required');
            valid = false;
        }

        // Password - ALWAYS required for test connection (even in edit mode)
        var passwordVal = fields.password ? fields.password.value : '';
        if (!passwordVal) {
            setFieldError('password', 'Password is required for test connection');
            valid = false;
        }

        return valid;
    }

    // ============================================
    // Test Connection (Story 12.3)
    // ============================================

    /**
     * Handle test connection button click (AC: 1, 2, 3, 4, 5)
     */
    function handleTestConnection() {
        if (formState.isTesting || formState.isSaving) {
            return;
        }

        // Validate form first - password is always required for test (AC: 5)
        if (!validateFormForTest()) {
            var firstError = form ? form.querySelector('.ite-form__input--error') : null;
            if (firstError) {
                firstError.focus();
            }
            announce('Please fix the validation errors before testing');
            return;
        }

        // Set testing state (AC: 1)
        formState.isTesting = true;
        if (testBtn) {
            testBtn.disabled = true;
            testBtn.classList.add('ite-form__test-btn--testing');
            var btnText = testBtn.querySelector('.ite-form__test-btn-text');
            if (btnText) {
                btnText.textContent = 'Testing...';
            }
        }

        // Clear previous test result
        clearTestResult();

        // Collect connection data and send command (AC: 1)
        var data = {
            hostname: fields.hostname ? fields.hostname.value.trim() : '',
            port: fields.port ? parseInt(fields.port.value, 10) : 52773,
            pathPrefix: fields.pathPrefix ? fields.pathPrefix.value.trim() : '',
            ssl: fields.ssl ? fields.ssl.checked : false,
            username: fields.username ? fields.username.value.trim() : '',
            password: fields.password ? fields.password.value : ''
        };

        sendCommand('testFormConnection', data);
    }

    /**
     * Display test connection result (AC: 2, 3)
     * @param {Object} payload - Result payload
     * @param {boolean} payload.success - Whether test succeeded
     * @param {string} payload.message - Result message
     */
    function showTestResult(payload) {
        if (testResult) {
            testResult.textContent = payload.message;
            testResult.classList.remove('ite-form__test-result--success', 'ite-form__test-result--error');
            if (payload.success) {
                testResult.classList.add('ite-form__test-result--success');
            } else {
                testResult.classList.add('ite-form__test-result--error');
            }
        }

        // Announce to screen readers (AC: 2, 3)
        announce(payload.success ? 'Connection successful' : 'Connection failed: ' + payload.message);
    }

    /**
     * Clear the test result display
     */
    function clearTestResult() {
        if (testResult) {
            testResult.textContent = '';
            testResult.classList.remove('ite-form__test-result--success', 'ite-form__test-result--error');
        }
    }

    /**
     * Reset test button to normal state (AC: 2, 3)
     */
    function resetTestButton() {
        formState.isTesting = false;
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.classList.remove('ite-form__test-btn--testing');
            var btnText = testBtn.querySelector('.ite-form__test-btn-text');
            if (btnText) {
                btnText.textContent = 'Test Connection';
            }
        }
    }

    // ============================================
    // Form Open / Close
    // ============================================

    /**
     * Open the form in "add" mode with empty fields (AC: 1)
     */
    function openAddForm() {
        formState.mode = 'add';
        formState.originalName = null;
        formState.isSaving = false;
        formState.isTesting = false;

        if (formTitle) {
            formTitle.textContent = 'Add Server';
        }

        // Reset all fields
        if (form) {
            form.reset();
        }

        // Set default port
        if (fields.port) {
            fields.port.value = '52773';
        }

        // Password is required for add
        if (fields.password) {
            fields.password.placeholder = 'Enter password';
            fields.password.setAttribute('aria-required', 'true');
        }

        // Update required indicator visibility for password
        var passwordField = fields.password ? fields.password.closest('.ite-form__field') : null;
        var passwordRequired = passwordField ? passwordField.querySelector('.ite-form__required') : null;
        if (passwordRequired) {
            passwordRequired.style.display = '';
        }

        clearErrors();
        clearTestResult();
        resetTestButton();
        showOverlay();
        announce('Add server form opened');

        // Focus the first field
        if (fields.name) {
            fields.name.focus();
        }
    }

    /**
     * Open the form in "edit" mode with pre-populated data (AC: 5)
     * @param {Object} serverConfig - Server configuration to edit
     * @param {string} serverConfig.name - Server name
     * @param {string} serverConfig.hostname - Server hostname
     * @param {number} serverConfig.port - Server port
     * @param {string} [serverConfig.description] - Optional description
     * @param {boolean} serverConfig.ssl - Whether SSL is enabled
     * @param {string} serverConfig.username - Username
     * @param {string} [serverConfig.pathPrefix] - Optional path prefix
     */
    function openEditForm(serverConfig) {
        formState.mode = 'edit';
        formState.originalName = serverConfig.name;
        formState.isSaving = false;
        formState.isTesting = false;

        if (formTitle) {
            formTitle.textContent = 'Edit Server';
        }

        // Populate fields
        if (fields.name) {
            fields.name.value = serverConfig.name || '';
        }
        if (fields.description) {
            fields.description.value = serverConfig.description || '';
        }
        if (fields.hostname) {
            fields.hostname.value = serverConfig.hostname || '';
        }
        if (fields.port) {
            fields.port.value = String(serverConfig.port || 52773);
        }
        if (fields.pathPrefix) {
            fields.pathPrefix.value = serverConfig.pathPrefix || '';
        }
        if (fields.ssl) {
            fields.ssl.checked = !!serverConfig.ssl;
        }
        if (fields.username) {
            fields.username.value = serverConfig.username || '';
        }
        if (fields.password) {
            // Password field is empty in edit mode - placeholder shows dots
            fields.password.value = '';
            fields.password.placeholder = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
            fields.password.removeAttribute('aria-required');
        }

        // Hide required indicator for password in edit mode
        var passwordField = fields.password ? fields.password.closest('.ite-form__field') : null;
        var passwordRequired = passwordField ? passwordField.querySelector('.ite-form__required') : null;
        if (passwordRequired) {
            passwordRequired.style.display = 'none';
        }

        clearErrors();
        clearTestResult();
        resetTestButton();
        showOverlay();
        announce('Edit server form opened for ' + (serverConfig.name || ''));

        // Focus the first field
        if (fields.name) {
            fields.name.focus();
        }
    }

    /**
     * Close the form without saving (AC: 6)
     */
    function closeForm() {
        formState.isOpen = false;
        formState.isSaving = false;
        formState.isTesting = false;
        hideOverlay();
        clearErrors();
        clearTestResult();
        resetTestButton();
        announce('Form closed');
    }

    /**
     * Show the form overlay
     */
    function showOverlay() {
        if (overlay) {
            overlay.hidden = false;
            formState.isOpen = true;
        }
    }

    /**
     * Hide the form overlay
     */
    function hideOverlay() {
        if (overlay) {
            overlay.hidden = true;
            formState.isOpen = false;
        }
    }

    // ============================================
    // Form Submission
    // ============================================

    /**
     * Collect form data and send save command via IMessageBridge (AC: 2)
     */
    function handleSave() {
        if (formState.isSaving || formState.isTesting) {
            return;
        }

        if (!validateForm()) {
            // Focus the first field with an error
            var firstError = form ? form.querySelector('.ite-form__input--error') : null;
            if (firstError) {
                firstError.focus();
            }
            announce('Please fix the validation errors');
            return;
        }

        formState.isSaving = true;
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        var data = {
            name: fields.name ? fields.name.value.trim() : '',
            hostname: fields.hostname ? fields.hostname.value.trim() : '',
            port: fields.port ? parseInt(fields.port.value, 10) : 52773,
            username: fields.username ? fields.username.value.trim() : '',
            password: fields.password ? fields.password.value : '',
            ssl: fields.ssl ? fields.ssl.checked : false,
            description: fields.description ? fields.description.value.trim() : '',
            pathPrefix: fields.pathPrefix ? fields.pathPrefix.value.trim() : ''
        };

        if (formState.mode === 'edit') {
            // Add originalName for update
            data.originalName = formState.originalName;
            sendCommand('updateServer', data);
        } else {
            sendCommand('saveServer', data);
        }
    }

    /**
     * Reset save button state after save completes (success or error)
     */
    function resetSaveButton() {
        formState.isSaving = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    }

    // ============================================
    // Message Bridge Communication
    // ============================================

    /**
     * Send a command to the host via message bridge
     * @param {string} command - Command name
     * @param {object} [payload] - Command payload
     */
    function sendCommand(command, payload) {
        if (!messageBridge) {
            console.error(LOG_PREFIX, 'Message bridge not initialized');
            resetSaveButton();
            resetTestButton();
            return;
        }
        messageBridge.sendCommand(command, payload || {});
    }

    // ============================================
    // Event Handling
    // ============================================

    // Form submission
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            handleSave();
        });
    }

    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            closeForm();
        });
    }

    // Close button (X)
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            closeForm();
        });
    }

    // Test Connection button (Story 12.3)
    if (testBtn) {
        testBtn.addEventListener('click', function () {
            handleTestConnection();
        });
    }

    // Escape key closes form + focus trap for aria-modal dialog
    document.addEventListener('keydown', function (e) {
        if (!formState.isOpen) {
            return;
        }

        if (e.key === 'Escape') {
            closeForm();
            return;
        }

        // Focus trap: keep Tab within the dialog overlay
        if (e.key === 'Tab' && overlay) {
            var focusable = overlay.querySelectorAll(
                'input:not([disabled]):not([hidden]), button:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden])'
            );
            if (focusable.length === 0) {
                return;
            }
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
    });

    // Clear field error on input (inline validation feedback)
    // Also clear test result when form fields change (Story 12.3, Task 3.6)
    if (form) {
        form.addEventListener('input', function (e) {
            var target = /** @type {HTMLElement} */ (e.target);
            var field = target.closest('.ite-form__field');
            if (field) {
                var fieldName = field.getAttribute('data-field');
                if (fieldName && errors[fieldName]) {
                    clearFieldError(fieldName);
                }
            }
            // Clear previous test result when any form field changes
            clearTestResult();
        });
    }

    // ============================================
    // Message Bridge Event Handlers
    // ============================================

    if (messageBridge) {
        // Server saved successfully (AC: 2)
        messageBridge.onEvent('serverSaved', function (payload) {
            console.debug(LOG_PREFIX, 'Received serverSaved:', payload);
            resetSaveButton();
            closeForm();
            announce('Server saved successfully');
            // Note: server-list.js handles the getServers refresh on serverSaved
        });

        // Test connection result (Story 12.3, AC: 2, 3)
        messageBridge.onEvent('testConnectionResult', function (payload) {
            console.debug(LOG_PREFIX, 'Received testConnectionResult:', payload);
            resetTestButton();
            showTestResult(payload);
        });

        // Server save error (AC: 4 - duplicate name)
        messageBridge.onEvent('serverSaveError', function (payload) {
            console.debug(LOG_PREFIX, 'Received serverSaveError:', payload);
            resetSaveButton();

            if (payload.field && errors[payload.field]) {
                setFieldError(payload.field, payload.message || 'An error occurred');
                if (fields[payload.field]) {
                    fields[payload.field].focus();
                }
            } else {
                // Generic error - show on name field as fallback
                setFieldError('name', payload.message || 'An error occurred while saving');
                if (fields.name) {
                    fields.name.focus();
                }
            }

            announce('Error: ' + (payload.message || 'Failed to save server'));
        });
    } else {
        console.error(LOG_PREFIX, 'Message bridge not initialized - cannot register event handlers');
    }

    // ============================================
    // Public API (exposed on window for server-list.js integration)
    // ============================================

    window.iteServerForm = {
        openAddForm: openAddForm,
        openEditForm: openEditForm,
        closeForm: closeForm
    };

    console.debug(LOG_PREFIX, 'Server form UI initialized');
})();
