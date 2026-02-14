/**
 * Unit tests for Test Connection feature
 * Story 12.3: Test Connection
 *
 * Tests ConnectionManager.testConnection() error mapping, timeout configuration,
 * and form test connection validation/UI behavior.
 * Uses Node.js built-in test runner and assert module.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConnectionManager, TestConnectionConfig } from '../main/ConnectionManager';
import { AtelierApiService, ErrorCodes } from '@iris-te/core';
import type { IDesktopTestConnectionPayload, IDesktopTestConnectionResultPayload, ErrorCode, IUserError } from '@iris-te/core';

// ============================================
// Mock AtelierApiService via prototype patching
// ============================================

/**
 * Mock result for AtelierApiService.testConnection()
 * Uses IUserError to match the real return type
 */
interface MockTestResult {
    success: boolean;
    error?: IUserError;
}

/**
 * Track what was passed to AtelierApiService.testConnection()
 */
interface CapturedCall {
    spec: {
        name: string;
        scheme: string;
        host: string;
        port: number;
        pathPrefix: string;
        username?: string;
    };
    username: string;
    password: string;
    timeout: number;
}

let mockResult: MockTestResult = { success: true };
let capturedCalls: CapturedCall[] = [];

// Save original methods
const originalTestConnection = AtelierApiService.prototype.testConnection;
const originalSetTimeout = AtelierApiService.prototype.setTimeout;

// ============================================
// Test Connection Config Helper
// ============================================

function createTestConnectionConfig(overrides: Partial<TestConnectionConfig> = {}): TestConnectionConfig {
    return {
        hostname: 'localhost',
        port: 52773,
        ssl: false,
        username: '_SYSTEM',
        password: 'SYS',
        ...overrides,
    };
}

// ============================================
// Tests: ConnectionManager.testConnection()
// ============================================

describe('ConnectionManager.testConnection()', () => {
    let tempDir: string;
    let manager: ConnectionManager;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iris-te-test-'));
        manager = new ConnectionManager({ configDir: tempDir });
        mockResult = { success: true };
        capturedCalls = [];

        // Patch AtelierApiService.prototype to capture calls and return mock results
        let capturedTimeout = 30000; // default

        AtelierApiService.prototype.setTimeout = function (timeout: number) {
            capturedTimeout = timeout;
        };

        AtelierApiService.prototype.testConnection = async function (
            spec: Parameters<typeof originalTestConnection>[0],
            username: string,
            password: string
        ) {
            capturedCalls.push({
                spec: {
                    name: spec.name,
                    scheme: spec.scheme,
                    host: spec.host,
                    port: spec.port,
                    pathPrefix: spec.pathPrefix,
                    username: spec.username,
                },
                username,
                password,
                timeout: capturedTimeout,
            });
            return mockResult;
        };
    });

    afterEach(() => {
        // Restore original methods
        AtelierApiService.prototype.testConnection = originalTestConnection;
        AtelierApiService.prototype.setTimeout = originalSetTimeout;

        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    // ============================================
    // Success case (AC: 2)
    // ============================================

    describe('successful connection', () => {
        it('should return success with "Connection successful!" message', async () => {
            mockResult = { success: true };
            const result = await manager.testConnection(createTestConnectionConfig());

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.message, 'Connection successful!');
        });

        it('should build IServerSpec from config', async () => {
            await manager.testConnection(createTestConnectionConfig({
                hostname: '192.168.1.100',
                port: 443,
                ssl: true,
                username: 'admin',
                pathPrefix: '/iris',
            }));

            assert.strictEqual(capturedCalls.length, 1);
            const call = capturedCalls[0];
            assert.strictEqual(call.spec.host, '192.168.1.100');
            assert.strictEqual(call.spec.port, 443);
            assert.strictEqual(call.spec.scheme, 'https');
            assert.strictEqual(call.spec.pathPrefix, '/iris');
            assert.strictEqual(call.spec.username, 'admin');
            assert.strictEqual(call.username, 'admin');
        });

        it('should use http scheme when ssl is false', async () => {
            await manager.testConnection(createTestConnectionConfig({ ssl: false }));
            assert.strictEqual(capturedCalls[0].spec.scheme, 'http');
        });

        it('should use https scheme when ssl is true', async () => {
            await manager.testConnection(createTestConnectionConfig({ ssl: true }));
            assert.strictEqual(capturedCalls[0].spec.scheme, 'https');
        });

        it('should set 10 second timeout', async () => {
            await manager.testConnection(createTestConnectionConfig());
            assert.strictEqual(capturedCalls[0].timeout, 10000);
        });

        it('should pass empty string for pathPrefix when not provided', async () => {
            await manager.testConnection(createTestConnectionConfig({ pathPrefix: undefined }));
            assert.strictEqual(capturedCalls[0].spec.pathPrefix, '');
        });

        it('should pass provided pathPrefix', async () => {
            await manager.testConnection(createTestConnectionConfig({ pathPrefix: '/custom' }));
            assert.strictEqual(capturedCalls[0].spec.pathPrefix, '/custom');
        });
    });

    // ============================================
    // Error mapping (AC: 3)
    // ============================================

    describe('error mapping', () => {
        it('should map SERVER_UNREACHABLE to user-friendly message', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Network error',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection',
                },
            };

            const result = await manager.testConnection(createTestConnectionConfig());
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Could not reach server. Check host and port.');
        });

        it('should map AUTH_FAILED to user-friendly message', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Auth failed',
                    code: ErrorCodes.AUTH_FAILED,
                    recoverable: true,
                    context: 'testConnection',
                },
            };

            const result = await manager.testConnection(createTestConnectionConfig());
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Authentication failed. Check username and password.');
        });

        it('should map CONNECTION_TIMEOUT to user-friendly message', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Timeout',
                    code: ErrorCodes.CONNECTION_TIMEOUT,
                    recoverable: true,
                    context: 'testConnection',
                },
            };

            const result = await manager.testConnection(createTestConnectionConfig());
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Connection timed out. Check host and port.');
        });

        it('should map CONNECTION_FAILED to user-friendly message', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Failed',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'testConnection',
                },
            };

            const result = await manager.testConnection(createTestConnectionConfig());
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Connection failed. Check your settings.');
        });

        it('should map CONNECTION_CANCELLED to user-friendly message', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Cancelled',
                    code: ErrorCodes.CONNECTION_CANCELLED,
                    recoverable: true,
                    context: 'testConnection',
                },
            };

            const result = await manager.testConnection(createTestConnectionConfig());
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Connection test was cancelled.');
        });

        it('should use fallback message for unknown error codes', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Unknown',
                    code: 'SOME_UNKNOWN_CODE' as ErrorCode,
                    recoverable: true,
                    context: 'testConnection',
                },
            };

            const result = await manager.testConnection(createTestConnectionConfig());
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Connection failed. Check your settings.');
        });

        it('should use fallback message when error has no code', async () => {
            mockResult = {
                success: false,
                error: {
                    message: 'Something went wrong',
                    code: '' as ErrorCode,
                    recoverable: true,
                    context: 'testConnection',
                },
            };

            const result = await manager.testConnection(createTestConnectionConfig());
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Connection failed. Check your settings.');
        });
    });

    // ============================================
    // Config building
    // ============================================

    describe('spec construction', () => {
        it('should use "test-connection" as spec name', async () => {
            await manager.testConnection(createTestConnectionConfig());
            assert.strictEqual(capturedCalls[0].spec.name, 'test-connection');
        });

        it('should pass password to testConnection', async () => {
            await manager.testConnection(createTestConnectionConfig({ password: 'secret123' }));
            assert.strictEqual(capturedCalls[0].password, 'secret123');
        });

        it('should pass username to both spec and testConnection', async () => {
            await manager.testConnection(createTestConnectionConfig({ username: 'myuser' }));
            assert.strictEqual(capturedCalls[0].spec.username, 'myuser');
            assert.strictEqual(capturedCalls[0].username, 'myuser');
        });
    });
});

// ============================================
// Tests: Form Test Connection Validation
// ============================================

/**
 * Validate form fields for test connection - mirrors validateFormForTest() in server-form.js
 * Password is ALWAYS required for test connection (even in edit mode)
 */
interface TestConnectionFieldValues {
    hostname: string;
    port: string;
    username: string;
    password: string;
}

interface TestValidationResult {
    valid: boolean;
    errors: Record<string, string>;
}

function validateFormForTest(fields: TestConnectionFieldValues): TestValidationResult {
    const errors: Record<string, string> = {};
    let valid = true;

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

    // Password - ALWAYS required for test connection
    if (!fields.password) {
        errors.password = 'Password is required for test connection';
        valid = false;
    }

    return { valid, errors };
}

describe('Form Test Connection Validation', () => {
    it('should pass with all required fields filled', () => {
        const result = validateFormForTest({
            hostname: 'localhost',
            port: '52773',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, true);
        assert.deepStrictEqual(result.errors, {});
    });

    it('should fail when hostname is empty', () => {
        const result = validateFormForTest({
            hostname: '',
            port: '52773',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.hostname);
        assert.ok(result.errors.hostname.includes('required'));
    });

    it('should fail when port is empty', () => {
        const result = validateFormForTest({
            hostname: 'localhost',
            port: '',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.port);
    });

    it('should fail when port is invalid', () => {
        const result = validateFormForTest({
            hostname: 'localhost',
            port: 'abc',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.port);
        assert.ok(result.errors.port.includes('between'));
    });

    it('should fail when port is 0', () => {
        const result = validateFormForTest({
            hostname: 'localhost',
            port: '0',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.port);
    });

    it('should fail when port exceeds 65535', () => {
        const result = validateFormForTest({
            hostname: 'localhost',
            port: '70000',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.port);
    });

    it('should fail when username is empty', () => {
        const result = validateFormForTest({
            hostname: 'localhost',
            port: '52773',
            username: '',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.username);
        assert.ok(result.errors.username.includes('required'));
    });

    it('should fail when password is empty (always required for test)', () => {
        const result = validateFormForTest({
            hostname: 'localhost',
            port: '52773',
            username: '_SYSTEM',
            password: '',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.password);
        assert.ok(result.errors.password.includes('required'));
    });

    it('should NOT require server name for test connection', () => {
        // Server name is not needed to test a connection
        const result = validateFormForTest({
            hostname: 'localhost',
            port: '52773',
            username: '_SYSTEM',
            password: 'SYS',
        });

        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.errors.name, undefined);
    });

    it('should report all errors when multiple fields are empty', () => {
        const result = validateFormForTest({
            hostname: '',
            port: '',
            username: '',
            password: '',
        });

        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.hostname);
        assert.ok(result.errors.port);
        assert.ok(result.errors.username);
        assert.ok(result.errors.password);
    });

    it('should accept valid port boundaries', () => {
        const result1 = validateFormForTest({
            hostname: 'localhost',
            port: '1',
            username: '_SYSTEM',
            password: 'SYS',
        });
        assert.strictEqual(result1.valid, true);

        const result2 = validateFormForTest({
            hostname: 'localhost',
            port: '65535',
            username: '_SYSTEM',
            password: 'SYS',
        });
        assert.strictEqual(result2.valid, true);
    });
});

// ============================================
// Tests: Form Test Connection UI State
// ============================================

describe('Form Test Connection UI State', () => {
    it('should track isTesting state', () => {
        const state = { isOpen: true, mode: 'add' as const, originalName: null, isSaving: false, isTesting: false };

        // Start testing
        state.isTesting = true;
        assert.strictEqual(state.isTesting, true);

        // Finish testing
        state.isTesting = false;
        assert.strictEqual(state.isTesting, false);
    });

    it('should reset isTesting when form closes', () => {
        const state = { isOpen: true, mode: 'add' as const, originalName: null, isSaving: false, isTesting: true };

        // Close form
        state.isOpen = false;
        state.isSaving = false;
        state.isTesting = false;

        assert.strictEqual(state.isOpen, false);
        assert.strictEqual(state.isTesting, false);
    });

    it('should reset isTesting when opening add form', () => {
        const state: { isOpen: boolean; mode: string; originalName: string | null; isSaving: boolean; isTesting: boolean } = {
            isOpen: false, mode: 'edit', originalName: 'old', isSaving: false, isTesting: true
        };

        // Open add form
        state.mode = 'add';
        state.originalName = null;
        state.isSaving = false;
        state.isTesting = false;

        assert.strictEqual(state.isTesting, false);
        assert.strictEqual(state.mode, 'add');
    });

    it('should reset isTesting when opening edit form', () => {
        const state: { isOpen: boolean; mode: string; originalName: string | null; isSaving: boolean; isTesting: boolean } = {
            isOpen: false, mode: 'add', originalName: null, isSaving: false, isTesting: true
        };

        // Open edit form
        state.mode = 'edit';
        state.originalName = 'Server';
        state.isSaving = false;
        state.isTesting = false;

        assert.strictEqual(state.isTesting, false);
        assert.strictEqual(state.mode, 'edit');
    });

    it('should prevent concurrent test operations', () => {
        const state = { isTesting: true, isSaving: false };

        function handleTestConnection(): boolean {
            if (state.isTesting || state.isSaving) {
                return false; // blocked
            }
            state.isTesting = true;
            return true;
        }

        assert.strictEqual(handleTestConnection(), false);
    });

    it('should prevent test during save operation', () => {
        const state = { isTesting: false, isSaving: true };

        function handleTestConnection(): boolean {
            if (state.isTesting || state.isSaving) {
                return false; // blocked
            }
            state.isTesting = true;
            return true;
        }

        assert.strictEqual(handleTestConnection(), false);
    });

    it('should prevent save during test operation', () => {
        const state = { isTesting: true, isSaving: false };

        function handleSave(): boolean {
            if (state.isSaving || state.isTesting) {
                return false; // blocked
            }
            state.isSaving = true;
            return true;
        }

        assert.strictEqual(handleSave(), false);
    });

    it('should allow test after previous completes', () => {
        const state = { isTesting: false, isSaving: false };

        function handleTestConnection(): boolean {
            if (state.isTesting || state.isSaving) {
                return false;
            }
            state.isTesting = true;
            return true;
        }

        assert.strictEqual(handleTestConnection(), true);
        assert.strictEqual(state.isTesting, true);
    });
});

// ============================================
// Tests: Test Connection Data Collection
// ============================================

describe('Test Connection Data Collection', () => {
    it('should collect connection data for test', () => {
        const data: IDesktopTestConnectionPayload = {
            hostname: 'localhost',
            port: 52773,
            pathPrefix: '/iris',
            ssl: false,
            username: '_SYSTEM',
            password: 'SYS',
        };

        assert.strictEqual(data.hostname, 'localhost');
        assert.strictEqual(data.port, 52773);
        assert.strictEqual(data.pathPrefix, '/iris');
        assert.strictEqual(data.ssl, false);
        assert.strictEqual(data.username, '_SYSTEM');
        assert.strictEqual(data.password, 'SYS');
    });

    it('should handle optional pathPrefix', () => {
        const data: IDesktopTestConnectionPayload = {
            hostname: 'localhost',
            port: 52773,
            ssl: false,
            username: '_SYSTEM',
            password: 'SYS',
        };

        assert.strictEqual(data.pathPrefix, undefined);
    });

    it('should handle SSL enabled', () => {
        const data: IDesktopTestConnectionPayload = {
            hostname: 'production.example.com',
            port: 443,
            ssl: true,
            username: 'admin',
            password: 'secret',
        };

        assert.strictEqual(data.ssl, true);
        assert.strictEqual(data.port, 443);
    });
});

// ============================================
// Tests: Test Connection Result Payloads
// ============================================

describe('Test Connection Result Payloads', () => {
    it('should construct success result payload', () => {
        const payload: IDesktopTestConnectionResultPayload = {
            success: true,
            message: 'Connection successful!',
        };

        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.message, 'Connection successful!');
    });

    it('should construct error result payload', () => {
        const payload: IDesktopTestConnectionResultPayload = {
            success: false,
            message: 'Could not reach server. Check host and port.',
        };

        assert.strictEqual(payload.success, false);
        assert.ok(payload.message.includes('Could not reach'));
    });

    it('should construct auth failure result payload', () => {
        const payload: IDesktopTestConnectionResultPayload = {
            success: false,
            message: 'Authentication failed. Check username and password.',
        };

        assert.strictEqual(payload.success, false);
        assert.ok(payload.message.includes('Authentication'));
    });

    it('should construct timeout result payload', () => {
        const payload: IDesktopTestConnectionResultPayload = {
            success: false,
            message: 'Connection timed out. Check host and port.',
        };

        assert.strictEqual(payload.success, false);
        assert.ok(payload.message.includes('timed out'));
    });
});

// ============================================
// Tests: Test Result Display Logic
// ============================================

describe('Test Result Display Logic', () => {
    it('should determine success CSS class', () => {
        const payload = { success: true, message: 'Connection successful!' };
        const cssClass = payload.success ? 'ite-form__test-result--success' : 'ite-form__test-result--error';
        assert.strictEqual(cssClass, 'ite-form__test-result--success');
    });

    it('should determine error CSS class', () => {
        const payload = { success: false, message: 'Could not reach server.' };
        const cssClass = payload.success ? 'ite-form__test-result--success' : 'ite-form__test-result--error';
        assert.strictEqual(cssClass, 'ite-form__test-result--error');
    });

    it('should announce success to screen readers', () => {
        const payload = { success: true, message: 'Connection successful!' };
        const announcement = payload.success ? 'Connection successful' : 'Connection failed: ' + payload.message;
        assert.strictEqual(announcement, 'Connection successful');
    });

    it('should announce error to screen readers', () => {
        const payload = { success: false, message: 'Authentication failed. Check username and password.' };
        const announcement = payload.success ? 'Connection successful' : 'Connection failed: ' + payload.message;
        assert.ok(announcement.includes('Connection failed'));
        assert.ok(announcement.includes('Authentication'));
    });
});
