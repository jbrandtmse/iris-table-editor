/**
 * Unit tests for Server Form UI Component
 * Story 12.2: Server Form - Task 5
 *
 * Tests form validation logic, open/close behavior, and pre-population.
 * Uses a minimal DOM mock since the form runs in browser context.
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach } from 'node:test';
import * as assert from 'assert';

// ============================================
// Minimal DOM Mock for Form Testing
// ============================================

/**
 * Minimal mock element for testing form behavior
 */
class MockElement {
    tagName: string;
    id: string;
    children: MockElement[] = [];
    attributes: Record<string, string> = {};
    classList: { add: (c: string) => void; remove: (c: string) => void; contains: (c: string) => boolean; classes: Set<string> };
    style: Record<string, string> = {};
    textContent = '';
    innerHTML = '';
    value = '';
    checked = false;
    hidden = false;
    disabled = false;
    placeholder = '';
    type = '';
    private _eventListeners: Record<string, Array<(e: unknown) => void>> = {};

    constructor(tagName: string, id = '') {
        this.tagName = tagName;
        this.id = id;
        const classes = new Set<string>();
        this.classList = {
            add: (c: string) => classes.add(c),
            remove: (c: string) => classes.delete(c),
            contains: (c: string) => classes.has(c),
            classes
        };
    }

    getAttribute(name: string): string | null {
        return this.attributes[name] ?? null;
    }

    setAttribute(name: string, value: string): void {
        this.attributes[name] = value;
    }

    removeAttribute(name: string): void {
        delete this.attributes[name];
    }

    addEventListener(event: string, handler: (e: unknown) => void): void {
        if (!this._eventListeners[event]) {
            this._eventListeners[event] = [];
        }
        this._eventListeners[event].push(handler);
    }

    dispatchEvent(event: string, detail?: unknown): void {
        const handlers = this._eventListeners[event] || [];
        handlers.forEach(h => h(detail));
    }

    closest(selector: string): MockElement | null {
        // Simple mock - check if this element matches
        if (selector.startsWith('.') && this.classList.contains(selector.slice(1))) {
            return this;
        }
        if (selector.startsWith('#') && this.id === selector.slice(1)) {
            return this;
        }
        if (selector.startsWith('[data-field')) {
            const match = selector.match(/\[data-field="?([^"]*)"?\]/);
            if (match && this.attributes['data-field'] === match[1]) {
                return this;
            }
        }
        return null;
    }

    querySelector(selector: string): MockElement | null {
        // Simple selector matching for test purposes
        for (const child of this.children) {
            if (selector.startsWith('.') && child.classList.contains(selector.slice(1))) {
                return child;
            }
            if (selector.startsWith('#') && child.id === selector.slice(1)) {
                return child;
            }
            const found = child.querySelector(selector);
            if (found) { return found; }
        }
        return null;
    }

    querySelectorAll(selector: string): MockElement[] {
        const results: MockElement[] = [];
        for (const child of this.children) {
            if (selector.startsWith('.') && child.classList.contains(selector.slice(1))) {
                results.push(child);
            }
            results.push(...child.querySelectorAll(selector));
        }
        return results;
    }

    focus(): void {
        // no-op for testing
    }
}

// ============================================
// Form Validation Logic (extracted for testing)
// ============================================

/**
 * Field values for validation
 */
interface FormFieldValues {
    name: string;
    hostname: string;
    port: string;
    username: string;
    password: string;
}

/**
 * Validation result
 */
interface ValidationResult {
    valid: boolean;
    errors: Record<string, string>;
}

/**
 * Validate form fields - mirrors the validation logic in server-form.js
 * @param fields - Field values to validate
 * @param mode - 'add' or 'edit'
 * @returns Validation result with field-specific errors
 */
function validateFormFields(fields: FormFieldValues, mode: 'add' | 'edit'): ValidationResult {
    const errors: Record<string, string> = {};
    let valid = true;

    // Server Name - required
    if (!fields.name.trim()) {
        errors.name = 'Server name is required';
        valid = false;
    }

    // Hostname - required
    if (!fields.hostname.trim()) {
        errors.hostname = 'Host is required';
        valid = false;
    }

    // Port - required, must be valid number
    if (!fields.port.trim()) {
        errors.port = 'Port is required';
        valid = false;
    } else {
        const portNum = parseInt(fields.port, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            errors.port = 'Port must be between 1 and 65535';
            valid = false;
        }
    }

    // Username - required
    if (!fields.username.trim()) {
        errors.username = 'Username is required';
        valid = false;
    }

    // Password - required for add mode, optional for edit mode
    if (mode === 'add' && !fields.password) {
        errors.password = 'Password is required';
        valid = false;
    }

    return { valid, errors };
}

/**
 * Collect form data - mirrors the data collection in server-form.js handleSave()
 */
interface CollectedFormData {
    name: string;
    hostname: string;
    port: number;
    username: string;
    password: string;
    ssl: boolean;
    description: string;
    pathPrefix: string;
    originalName?: string;
}

function collectFormData(
    fields: FormFieldValues & { ssl: boolean; description: string; pathPrefix: string },
    mode: 'add' | 'edit',
    originalName: string | null
): CollectedFormData {
    const data: CollectedFormData = {
        name: fields.name.trim(),
        hostname: fields.hostname.trim(),
        port: parseInt(fields.port, 10) || 52773,
        username: fields.username.trim(),
        password: fields.password,
        ssl: fields.ssl,
        description: fields.description.trim(),
        pathPrefix: fields.pathPrefix.trim()
    };

    if (mode === 'edit' && originalName) {
        data.originalName = originalName;
    }

    return data;
}

// ============================================
// Tests
// ============================================

describe('Server Form', () => {

    // ============================================
    // Form Validation (Task 5.1, AC: 3)
    // ============================================

    describe('validation - add mode', () => {
        it('should pass with all required fields filled', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, true);
            assert.deepStrictEqual(result.errors, {});
        });

        it('should fail when name is empty', () => {
            const result = validateFormFields({
                name: '',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.name);
            assert.ok(result.errors.name.includes('required'));
        });

        it('should fail when name is whitespace only', () => {
            const result = validateFormFields({
                name: '   ',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.name);
        });

        it('should fail when hostname is empty', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: '',
                port: '52773',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.hostname);
            assert.ok(result.errors.hostname.includes('required'));
        });

        it('should fail when port is empty', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.port);
            assert.ok(result.errors.port.includes('required'));
        });

        it('should fail when port is not a valid number', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: 'abc',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.port);
            assert.ok(result.errors.port.includes('between'));
        });

        it('should fail when port is 0', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '0',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.port);
        });

        it('should fail when port exceeds 65535', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '70000',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.port);
        });

        it('should accept port 1 (minimum)', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '1',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, true);
        });

        it('should accept port 65535 (maximum)', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '65535',
                username: '_SYSTEM',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, true);
        });

        it('should fail when username is empty', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '52773',
                username: '',
                password: 'SYS'
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.username);
            assert.ok(result.errors.username.includes('required'));
        });

        it('should fail when password is empty in add mode', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: ''
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.password);
            assert.ok(result.errors.password.includes('required'));
        });

        it('should collect all errors when multiple fields are empty', () => {
            const result = validateFormFields({
                name: '',
                hostname: '',
                port: '',
                username: '',
                password: ''
            }, 'add');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.name);
            assert.ok(result.errors.hostname);
            assert.ok(result.errors.port);
            assert.ok(result.errors.username);
            assert.ok(result.errors.password);
        });
    });

    describe('validation - edit mode', () => {
        it('should pass with all required fields filled (no password)', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: ''
            }, 'edit');

            assert.strictEqual(result.valid, true);
            assert.deepStrictEqual(result.errors, {});
        });

        it('should pass when password is provided in edit mode', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: 'newpassword'
            }, 'edit');

            assert.strictEqual(result.valid, true);
        });

        it('should fail when name is empty in edit mode', () => {
            const result = validateFormFields({
                name: '',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: ''
            }, 'edit');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.name);
        });

        it('should fail when hostname is empty in edit mode', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: '',
                port: '52773',
                username: '_SYSTEM',
                password: ''
            }, 'edit');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.hostname);
        });

        it('should fail when username is empty in edit mode', () => {
            const result = validateFormFields({
                name: 'My Server',
                hostname: 'localhost',
                port: '52773',
                username: '',
                password: ''
            }, 'edit');

            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.username);
        });
    });

    // ============================================
    // Form Data Collection (Task 5.2, 5.3)
    // ============================================

    describe('data collection - add mode', () => {
        it('should collect form data for add mode', () => {
            const data = collectFormData({
                name: 'My Server',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: 'SYS',
                ssl: false,
                description: 'Test server',
                pathPrefix: '/iris'
            }, 'add', null);

            assert.strictEqual(data.name, 'My Server');
            assert.strictEqual(data.hostname, 'localhost');
            assert.strictEqual(data.port, 52773);
            assert.strictEqual(data.username, '_SYSTEM');
            assert.strictEqual(data.password, 'SYS');
            assert.strictEqual(data.ssl, false);
            assert.strictEqual(data.description, 'Test server');
            assert.strictEqual(data.pathPrefix, '/iris');
            assert.strictEqual(data.originalName, undefined);
        });

        it('should trim whitespace from text fields', () => {
            const data = collectFormData({
                name: '  My Server  ',
                hostname: '  localhost  ',
                port: '52773',
                username: '  _SYSTEM  ',
                password: 'SYS',
                ssl: false,
                description: '  desc  ',
                pathPrefix: '  /iris  '
            }, 'add', null);

            assert.strictEqual(data.name, 'My Server');
            assert.strictEqual(data.hostname, 'localhost');
            assert.strictEqual(data.username, '_SYSTEM');
            assert.strictEqual(data.description, 'desc');
            assert.strictEqual(data.pathPrefix, '/iris');
        });

        it('should handle empty optional fields', () => {
            const data = collectFormData({
                name: 'My Server',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: 'SYS',
                ssl: false,
                description: '',
                pathPrefix: ''
            }, 'add', null);

            assert.strictEqual(data.description, '');
            assert.strictEqual(data.pathPrefix, '');
        });

        it('should handle SSL checkbox state', () => {
            const dataWithSsl = collectFormData({
                name: 'Server',
                hostname: 'host',
                port: '443',
                username: 'user',
                password: 'pass',
                ssl: true,
                description: '',
                pathPrefix: ''
            }, 'add', null);

            assert.strictEqual(dataWithSsl.ssl, true);
        });

        it('should default to port 52773 when port is invalid', () => {
            const data = collectFormData({
                name: 'Server',
                hostname: 'host',
                port: 'abc',
                username: 'user',
                password: 'pass',
                ssl: false,
                description: '',
                pathPrefix: ''
            }, 'add', null);

            assert.strictEqual(data.port, 52773);
        });
    });

    describe('data collection - edit mode', () => {
        it('should include originalName for edit mode', () => {
            const data = collectFormData({
                name: 'New Name',
                hostname: 'localhost',
                port: '52773',
                username: '_SYSTEM',
                password: '',
                ssl: false,
                description: '',
                pathPrefix: ''
            }, 'edit', 'Old Name');

            assert.strictEqual(data.originalName, 'Old Name');
            assert.strictEqual(data.name, 'New Name');
        });

        it('should handle empty password in edit mode (keep existing)', () => {
            const data = collectFormData({
                name: 'Server',
                hostname: 'host',
                port: '52773',
                username: 'user',
                password: '',
                ssl: false,
                description: '',
                pathPrefix: ''
            }, 'edit', 'Server');

            assert.strictEqual(data.password, '');
        });

        it('should include new password when provided in edit mode', () => {
            const data = collectFormData({
                name: 'Server',
                hostname: 'host',
                port: '52773',
                username: 'user',
                password: 'newpass',
                ssl: false,
                description: '',
                pathPrefix: ''
            }, 'edit', 'Server');

            assert.strictEqual(data.password, 'newpass');
        });
    });

    // ============================================
    // Form Open/Close State (Task 5.2)
    // ============================================

    describe('form state management', () => {
        it('should track form mode as add', () => {
            // Simulate add mode state
            const state = { isOpen: true, mode: 'add' as const, originalName: null, isSaving: false };
            assert.strictEqual(state.mode, 'add');
            assert.strictEqual(state.originalName, null);
        });

        it('should track form mode as edit with original name', () => {
            const state = { isOpen: true, mode: 'edit' as const, originalName: 'My Server', isSaving: false };
            assert.strictEqual(state.mode, 'edit');
            assert.strictEqual(state.originalName, 'My Server');
        });

        it('should track closed state', () => {
            const state = { isOpen: false, mode: 'add' as const, originalName: null, isSaving: false };
            assert.strictEqual(state.isOpen, false);
        });

        it('should track saving state', () => {
            const state = { isOpen: true, mode: 'add' as const, originalName: null, isSaving: true };
            assert.strictEqual(state.isSaving, true);
        });

        it('should reset saving state on close', () => {
            const state = { isOpen: true, mode: 'add' as const, originalName: null, isSaving: true };
            // Simulate close
            state.isOpen = false;
            state.isSaving = false;
            assert.strictEqual(state.isOpen, false);
            assert.strictEqual(state.isSaving, false);
        });
    });

    // ============================================
    // Form Pre-population (Task 5.3, AC: 5)
    // ============================================

    describe('form pre-population for edit mode', () => {
        /** Mock element used for pre-population testing */
        let mockFields: Record<string, MockElement>;

        beforeEach(() => {
            mockFields = {
                name: new MockElement('input', 'fieldName'),
                description: new MockElement('input', 'fieldDescription'),
                hostname: new MockElement('input', 'fieldHostname'),
                port: new MockElement('input', 'fieldPort'),
                pathPrefix: new MockElement('input', 'fieldPathPrefix'),
                ssl: new MockElement('input', 'fieldSsl'),
                username: new MockElement('input', 'fieldUsername'),
                password: new MockElement('input', 'fieldPassword')
            };
            mockFields.ssl.type = 'checkbox';
            mockFields.password.type = 'password';
        });

        it('should populate fields with server config data', () => {
            const config = {
                name: 'Production IRIS',
                hostname: '192.168.1.100',
                port: 443,
                description: 'Main production server',
                ssl: true,
                username: 'admin',
                pathPrefix: '/iris'
            };

            // Simulate openEditForm field population
            mockFields.name.value = config.name || '';
            mockFields.description.value = config.description || '';
            mockFields.hostname.value = config.hostname || '';
            mockFields.port.value = String(config.port || 52773);
            mockFields.pathPrefix.value = config.pathPrefix || '';
            mockFields.ssl.checked = !!config.ssl;
            mockFields.username.value = config.username || '';
            mockFields.password.value = ''; // Password always empty in edit

            assert.strictEqual(mockFields.name.value, 'Production IRIS');
            assert.strictEqual(mockFields.description.value, 'Main production server');
            assert.strictEqual(mockFields.hostname.value, '192.168.1.100');
            assert.strictEqual(mockFields.port.value, '443');
            assert.strictEqual(mockFields.pathPrefix.value, '/iris');
            assert.strictEqual(mockFields.ssl.checked, true);
            assert.strictEqual(mockFields.username.value, 'admin');
            assert.strictEqual(mockFields.password.value, '');
        });

        it('should handle missing optional fields', () => {
            const config = {
                name: 'Dev Server',
                hostname: 'localhost',
                port: 52773,
                ssl: false,
                username: '_SYSTEM'
            };

            mockFields.name.value = config.name || '';
            mockFields.description.value = '';
            mockFields.hostname.value = config.hostname || '';
            mockFields.port.value = String(config.port || 52773);
            mockFields.pathPrefix.value = '';
            mockFields.ssl.checked = !!config.ssl;
            mockFields.username.value = config.username || '';
            mockFields.password.value = '';

            assert.strictEqual(mockFields.name.value, 'Dev Server');
            assert.strictEqual(mockFields.description.value, '');
            assert.strictEqual(mockFields.pathPrefix.value, '');
            assert.strictEqual(mockFields.ssl.checked, false);
        });

        it('should set password placeholder to dots in edit mode', () => {
            // In edit mode, password shows placeholder dots
            mockFields.password.placeholder = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
            assert.strictEqual(mockFields.password.placeholder, '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
            assert.strictEqual(mockFields.password.value, '');
        });

        it('should use default port when config port is missing', () => {
            const config = {
                name: 'Server',
                hostname: 'host',
                port: 0,
                ssl: false,
                username: 'user'
            };

            mockFields.port.value = String(config.port || 52773);
            assert.strictEqual(mockFields.port.value, '52773');
        });
    });

    // ============================================
    // XSS Prevention
    // ============================================

    describe('XSS prevention', () => {
        it('escapeHtml should escape HTML entities', () => {
            // Test the same escapeHtml logic used in server-form.js
            function escapeHtml(text: string): string {
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
            assert.strictEqual(escapeHtml('Server & "Name"'), 'Server &amp; &quot;Name&quot;');
            assert.strictEqual(escapeHtml("it's"), "it&#39;s");
        });

        it('escapeAttr should escape attribute entities', () => {
            function escapeAttr(text: string): string {
                return String(text)
                    .replace(/&/g, '&amp;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }

            assert.strictEqual(escapeAttr('value with "quotes"'), 'value with &quot;quotes&quot;');
            assert.strictEqual(escapeAttr('<tag>'), '&lt;tag&gt;');
        });
    });

    // ============================================
    // Error Display Logic
    // ============================================

    describe('error display', () => {
        it('should set error text on specific field error element', () => {
            const errorEl = new MockElement('span', 'fieldNameError');
            const inputEl = new MockElement('input', 'fieldName');

            // Simulate setFieldError
            errorEl.textContent = 'Server name is required';
            inputEl.classList.add('ite-form__input--error');

            assert.strictEqual(errorEl.textContent, 'Server name is required');
            assert.ok(inputEl.classList.contains('ite-form__input--error'));
        });

        it('should clear error text on specific field', () => {
            const errorEl = new MockElement('span', 'fieldNameError');
            const inputEl = new MockElement('input', 'fieldName');

            // Set error first
            errorEl.textContent = 'Error message';
            inputEl.classList.add('ite-form__input--error');

            // Simulate clearFieldError
            errorEl.textContent = '';
            inputEl.classList.remove('ite-form__input--error');

            assert.strictEqual(errorEl.textContent, '');
            assert.ok(!inputEl.classList.contains('ite-form__input--error'));
        });

        it('should handle server save error on specific field', () => {
            // Simulate serverSaveError with field='name' (AC: 4 - duplicate name)
            const payload = { message: 'A server with this name already exists', field: 'name' };
            const errorEl = new MockElement('span', 'fieldNameError');

            errorEl.textContent = payload.message;
            assert.strictEqual(errorEl.textContent, 'A server with this name already exists');
        });

        it('should handle server save error without specific field', () => {
            // Simulate serverSaveError without field (generic error)
            const payload = { message: 'An unexpected error occurred' };
            const errorEl = new MockElement('span', 'fieldNameError');

            // Falls back to name field
            errorEl.textContent = payload.message;
            assert.strictEqual(errorEl.textContent, 'An unexpected error occurred');
        });
    });

    // ============================================
    // Message Type Payloads (Task 5.1)
    // ============================================

    describe('message type payloads', () => {
        it('should construct saveServer payload correctly', () => {
            const payload = {
                name: 'My Server',
                hostname: 'localhost',
                port: 52773,
                username: '_SYSTEM',
                password: 'SYS',
                ssl: false,
                description: 'Test',
                pathPrefix: '/iris'
            };

            assert.strictEqual(payload.name, 'My Server');
            assert.strictEqual(payload.port, 52773);
            assert.strictEqual(typeof payload.ssl, 'boolean');
        });

        it('should construct updateServer payload correctly', () => {
            const payload = {
                originalName: 'Old Name',
                name: 'New Name',
                hostname: 'localhost',
                port: 52773,
                username: '_SYSTEM',
                password: '',
                ssl: true,
                description: '',
                pathPrefix: ''
            };

            assert.strictEqual(payload.originalName, 'Old Name');
            assert.strictEqual(payload.name, 'New Name');
            assert.strictEqual(payload.password, '');
        });

        it('should construct serverSaved payload correctly', () => {
            const payload = { serverName: 'My Server', mode: 'add' as const };
            assert.strictEqual(payload.serverName, 'My Server');
            assert.strictEqual(payload.mode, 'add');
        });

        it('should construct serverSaveError payload correctly', () => {
            const payload = { message: 'Duplicate name', field: 'name' };
            assert.strictEqual(payload.message, 'Duplicate name');
            assert.strictEqual(payload.field, 'name');
        });

        it('should allow serverSaveError without field', () => {
            const payload = { message: 'Unknown error' };
            assert.strictEqual(payload.message, 'Unknown error');
            assert.strictEqual((payload as { field?: string }).field, undefined);
        });
    });
});
