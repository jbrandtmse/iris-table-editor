/**
 * Error handling utility for IRIS Table Editor
 * Maps API and network errors to user-friendly messages
 */

/**
 * Error code constants for consistent error handling
 */
export const ErrorCodes = {
    // Connection errors
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
    CONNECTION_CANCELLED: 'CONNECTION_CANCELLED',
    SERVER_UNREACHABLE: 'SERVER_UNREACHABLE',

    // Authentication errors
    AUTH_FAILED: 'AUTH_FAILED',
    AUTH_EXPIRED: 'AUTH_EXPIRED',

    // API errors
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',

    // Data errors
    INVALID_INPUT: 'INVALID_INPUT',
    TABLE_NOT_FOUND: 'TABLE_NOT_FOUND'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * User-facing error interface
 */
export interface IUserError {
    message: string;      // User-friendly message
    code: ErrorCode;      // Error code from ErrorCodes
    recoverable: boolean; // Can user retry?
    context: string;      // What operation failed
}

/**
 * Map of error codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
    [ErrorCodes.AUTH_FAILED]: 'Authentication failed. Please check your username and password in Server Manager.',
    [ErrorCodes.AUTH_EXPIRED]: 'Your session has expired. Please reconnect to the server.',
    [ErrorCodes.CONNECTION_TIMEOUT]: 'Connection timed out. The server may be busy or unreachable.',
    [ErrorCodes.CONNECTION_CANCELLED]: 'Connection cancelled.',
    [ErrorCodes.SERVER_UNREACHABLE]: 'Cannot reach server. Please verify the server address and that IRIS is running.',
    [ErrorCodes.CONNECTION_FAILED]: 'Connection failed. Please check your network and server settings.',
    [ErrorCodes.INVALID_RESPONSE]: 'Received unexpected response from server. Please try again.',
    [ErrorCodes.UNKNOWN_ERROR]: 'An unexpected error occurred.',
    [ErrorCodes.INVALID_INPUT]: 'Invalid input provided. Please check your data and try again.',
    [ErrorCodes.TABLE_NOT_FOUND]: 'The specified table was not found in the database.'
};

/**
 * Atelier API error response structure
 */
interface IAtelierErrorResponse {
    status?: {
        errors?: Array<{ error: string }>;
        summary?: string;
    };
}

/**
 * Error handling utility class
 */
export class ErrorHandler {
    /**
     * Parse Atelier API response for errors
     * @param response - Raw fetch response, error object, or Atelier response body
     * @param context - Operation that failed (e.g., 'connect', 'query')
     * @returns IUserError if error detected, null otherwise
     */
    public static parse(response: unknown, context: string): IUserError | null {
        // Handle null/undefined
        if (response === null || response === undefined) {
            return null;
        }

        // Handle standard Error objects
        if (response instanceof Error) {
            return ErrorHandler._parseError(response, context);
        }

        // Handle HTTP Response-like objects
        if (ErrorHandler._isResponseLike(response)) {
            return ErrorHandler._parseHttpStatus(response.status, context);
        }

        // Handle Atelier API response body
        if (typeof response === 'object') {
            return ErrorHandler._parseAtelierResponse(response as IAtelierErrorResponse, context);
        }

        return null;
    }

    /**
     * Get user-friendly message for an error
     * @param error - IUserError object
     * @returns User-friendly message string
     */
    public static getUserMessage(error: IUserError): string {
        const baseMessage = ERROR_MESSAGES[error.code] || ERROR_MESSAGES[ErrorCodes.UNKNOWN_ERROR];

        // For unknown errors, append the original message if available
        if (error.code === ErrorCodes.UNKNOWN_ERROR && error.message !== baseMessage) {
            return `${baseMessage}: ${error.message}`;
        }

        return baseMessage;
    }

    /**
     * Create an IUserError with a specific code
     * @param code - Error code
     * @param context - Operation context
     * @param customMessage - Optional custom message override
     */
    public static createError(code: ErrorCode, context: string, customMessage?: string): IUserError {
        return {
            message: customMessage || ERROR_MESSAGES[code],
            code,
            recoverable: ErrorHandler._isRecoverable(code),
            context
        };
    }

    /**
     * Check if a response is Response-like (has status property)
     */
    private static _isResponseLike(obj: unknown): obj is { status: number } {
        return typeof obj === 'object' && obj !== null && 'status' in obj && typeof (obj as Record<string, unknown>).status === 'number';
    }

    /**
     * Parse standard Error objects
     */
    private static _parseError(error: Error, context: string): IUserError {
        // Check for timeout/abort errors
        if (error.name === 'AbortError') {
            return {
                message: ERROR_MESSAGES[ErrorCodes.CONNECTION_TIMEOUT],
                code: ErrorCodes.CONNECTION_TIMEOUT,
                recoverable: true,
                context
            };
        }

        // Check for network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return {
                message: ERROR_MESSAGES[ErrorCodes.SERVER_UNREACHABLE],
                code: ErrorCodes.SERVER_UNREACHABLE,
                recoverable: true,
                context
            };
        }

        // Generic error
        return {
            message: error.message || ERROR_MESSAGES[ErrorCodes.UNKNOWN_ERROR],
            code: ErrorCodes.UNKNOWN_ERROR,
            recoverable: true,
            context
        };
    }

    /**
     * Parse HTTP status codes
     */
    private static _parseHttpStatus(status: number, context: string): IUserError | null {
        if (status >= 200 && status < 300) {
            return null; // Success - no error
        }

        if (status === 401 || status === 403) {
            return {
                message: ERROR_MESSAGES[ErrorCodes.AUTH_FAILED],
                code: ErrorCodes.AUTH_FAILED,
                recoverable: true,
                context
            };
        }

        if (status === 404) {
            return {
                message: ERROR_MESSAGES[ErrorCodes.SERVER_UNREACHABLE],
                code: ErrorCodes.SERVER_UNREACHABLE,
                recoverable: true,
                context
            };
        }

        if (status >= 500) {
            return {
                message: `Server returned error status ${status}`,
                code: ErrorCodes.CONNECTION_FAILED,
                recoverable: true,
                context
            };
        }

        return {
            message: `Server returned status ${status}`,
            code: ErrorCodes.UNKNOWN_ERROR,
            recoverable: true,
            context
        };
    }

    /**
     * Parse Atelier API response body for errors
     */
    private static _parseAtelierResponse(response: IAtelierErrorResponse, context: string): IUserError | null {
        const errors = response?.status?.errors;

        if (!errors || errors.length === 0) {
            return null; // No errors
        }

        const firstError = errors[0].error || '';

        // Check for authentication errors in the error message
        if (firstError.toLowerCase().includes('authentication') ||
            firstError.toLowerCase().includes('unauthorized') ||
            firstError.toLowerCase().includes('password')) {
            return {
                message: ERROR_MESSAGES[ErrorCodes.AUTH_FAILED],
                code: ErrorCodes.AUTH_FAILED,
                recoverable: true,
                context
            };
        }

        // Return the first error message
        return {
            message: firstError || ERROR_MESSAGES[ErrorCodes.UNKNOWN_ERROR],
            code: ErrorCodes.UNKNOWN_ERROR,
            recoverable: true,
            context
        };
    }

    /**
     * Determine if an error is recoverable (user can retry)
     */
    private static _isRecoverable(code: ErrorCode): boolean {
        // Most errors are recoverable by retrying
        // Only AUTH_EXPIRED requires re-authentication
        return code !== ErrorCodes.AUTH_EXPIRED;
    }
}
