import * as assert from 'assert';
import { ErrorHandler, ErrorCodes, IUserError, ErrorCode } from '../utils/ErrorHandler';

suite('ErrorHandler Test Suite', () => {

    test('ErrorHandler can be used statically', () => {
        assert.ok(ErrorHandler, 'ErrorHandler class should exist');
        assert.ok(typeof ErrorHandler.parse === 'function', 'parse should be a function');
        assert.ok(typeof ErrorHandler.getUserMessage === 'function', 'getUserMessage should be a function');
        assert.ok(typeof ErrorHandler.createError === 'function', 'createError should be a function');
    });

    test('ErrorCodes contains expected values', () => {
        assert.strictEqual(ErrorCodes.CONNECTION_FAILED, 'CONNECTION_FAILED');
        assert.strictEqual(ErrorCodes.CONNECTION_TIMEOUT, 'CONNECTION_TIMEOUT');
        assert.strictEqual(ErrorCodes.SERVER_UNREACHABLE, 'SERVER_UNREACHABLE');
        assert.strictEqual(ErrorCodes.AUTH_FAILED, 'AUTH_FAILED');
        assert.strictEqual(ErrorCodes.AUTH_EXPIRED, 'AUTH_EXPIRED');
        assert.strictEqual(ErrorCodes.INVALID_RESPONSE, 'INVALID_RESPONSE');
        assert.strictEqual(ErrorCodes.UNKNOWN_ERROR, 'UNKNOWN_ERROR');
    });

    test('parse returns null for null/undefined', () => {
        assert.strictEqual(ErrorHandler.parse(null, 'test'), null);
        assert.strictEqual(ErrorHandler.parse(undefined, 'test'), null);
    });

    test('parse handles standard Error objects', () => {
        const error = new Error('Test error message');
        const result = ErrorHandler.parse(error, 'testContext');

        assert.ok(result, 'Should return an error');
        assert.strictEqual(result?.context, 'testContext');
        assert.ok(result?.message.includes('Test error message'), 'Message should contain error message');
    });

    test('parse handles AbortError for timeouts', () => {
        const abortError = new Error('Aborted');
        abortError.name = 'AbortError';

        const result = ErrorHandler.parse(abortError, 'connect');

        assert.ok(result, 'Should return an error');
        assert.strictEqual(result?.code, ErrorCodes.CONNECTION_TIMEOUT);
        assert.strictEqual(result?.recoverable, true);
    });

    test('parse handles HTTP 401 status', () => {
        const response = { status: 401 };
        const result = ErrorHandler.parse(response, 'connect');

        assert.ok(result, 'Should return an error');
        assert.strictEqual(result?.code, ErrorCodes.AUTH_FAILED);
        assert.strictEqual(result?.recoverable, true);
    });

    test('parse handles HTTP 403 status', () => {
        const response = { status: 403 };
        const result = ErrorHandler.parse(response, 'connect');

        assert.ok(result, 'Should return an error');
        assert.strictEqual(result?.code, ErrorCodes.AUTH_FAILED);
    });

    test('parse handles HTTP 404 status', () => {
        const response = { status: 404 };
        const result = ErrorHandler.parse(response, 'connect');

        assert.ok(result, 'Should return an error');
        assert.strictEqual(result?.code, ErrorCodes.SERVER_UNREACHABLE);
    });

    test('parse handles HTTP 500+ status', () => {
        const response = { status: 500 };
        const result = ErrorHandler.parse(response, 'connect');

        assert.ok(result, 'Should return an error');
        assert.strictEqual(result?.code, ErrorCodes.CONNECTION_FAILED);
    });

    test('parse returns null for successful HTTP status', () => {
        const response = { status: 200 };
        const result = ErrorHandler.parse(response, 'connect');

        assert.strictEqual(result, null, 'Should return null for success');
    });

    test('parse handles Atelier API errors', () => {
        const atelierResponse = {
            status: {
                errors: [{ error: 'ERROR #123: Some IRIS error' }]
            }
        };

        const result = ErrorHandler.parse(atelierResponse, 'query');

        assert.ok(result, 'Should return an error');
        assert.ok(result?.message.includes('ERROR #123'), 'Should include error message');
    });

    test('parse handles Atelier auth errors in response', () => {
        const atelierResponse = {
            status: {
                errors: [{ error: 'Authentication failed for user test' }]
            }
        };

        const result = ErrorHandler.parse(atelierResponse, 'query');

        assert.ok(result, 'Should return an error');
        assert.strictEqual(result?.code, ErrorCodes.AUTH_FAILED);
    });

    test('parse returns null for Atelier success response', () => {
        const atelierResponse = {
            status: {
                errors: []
            }
        };

        const result = ErrorHandler.parse(atelierResponse, 'query');
        assert.strictEqual(result, null, 'Should return null for no errors');
    });

    test('getUserMessage returns appropriate messages for all error codes', () => {
        const testCases: Array<{ code: ErrorCode; contains: string }> = [
            { code: ErrorCodes.AUTH_FAILED, contains: 'Authentication' },
            { code: ErrorCodes.CONNECTION_TIMEOUT, contains: 'timed out' },
            { code: ErrorCodes.SERVER_UNREACHABLE, contains: 'Cannot reach' },
            { code: ErrorCodes.UNKNOWN_ERROR, contains: 'unexpected' }
        ];

        for (const testCase of testCases) {
            const error: IUserError = {
                message: 'Test',
                code: testCase.code,
                recoverable: true,
                context: 'test'
            };

            const message = ErrorHandler.getUserMessage(error);
            assert.ok(
                message.toLowerCase().includes(testCase.contains.toLowerCase()),
                `${testCase.code} message should contain "${testCase.contains}"`
            );
        }
    });

    test('createError creates proper IUserError', () => {
        const error = ErrorHandler.createError(ErrorCodes.AUTH_FAILED, 'connect');

        assert.strictEqual(error.code, ErrorCodes.AUTH_FAILED);
        assert.strictEqual(error.context, 'connect');
        assert.strictEqual(error.recoverable, true);
        assert.ok(error.message.length > 0, 'Should have a message');
    });

    test('createError accepts custom message', () => {
        const customMessage = 'Custom error message';
        const error = ErrorHandler.createError(ErrorCodes.UNKNOWN_ERROR, 'test', customMessage);

        assert.strictEqual(error.message, customMessage);
    });

    test('AUTH_EXPIRED is not recoverable', () => {
        const error = ErrorHandler.createError(ErrorCodes.AUTH_EXPIRED, 'test');
        assert.strictEqual(error.recoverable, false, 'AUTH_EXPIRED should not be recoverable');
    });
});
