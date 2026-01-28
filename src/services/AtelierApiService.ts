/**
 * HTTP client for InterSystems Atelier REST API
 * Handles connection testing and API communication
 */

import { IServerSpec } from '../models/IServerSpec';
import { IUserError } from '../models/IMessages';
import { ErrorHandler, ErrorCodes } from '../utils/ErrorHandler';
import { UrlBuilder } from '../utils/UrlBuilder';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Atelier API query response structure
 */
interface IAtelierQueryResponse {
    status: {
        errors: Array<{ error: string }>;
        summary?: string;
    };
    result?: {
        content?: unknown[];
    };
}

/**
 * Service for communicating with InterSystems Atelier REST API
 */
export class AtelierApiService {
    private _timeout = 10000; // 10 second timeout

    /**
     * Test connection to server with a simple query
     * @param spec - Server specification
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag and optional error
     */
    public async testConnection(
        spec: IServerSpec,
        username: string,
        password: string
    ): Promise<{ success: boolean; error?: IUserError }> {
        // Use USER namespace for connection test (most likely to exist)
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            'USER'
        );

        const headers = this._buildAuthHeaders(username, password);

        console.debug(`${LOG_PREFIX} Testing connection to ${spec.host}:${spec.port}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: 'SELECT 1',
                    parameters: []
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Connection test failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'testConnection'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Connection test failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'testConnection'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'testConnection');
                // Only fail if it's an auth error - other errors may just be namespace issues
                if (error?.code === ErrorCodes.AUTH_FAILED) {
                    console.debug(`${LOG_PREFIX} Connection test failed: Auth error in response`);
                    return { success: false, error };
                }
                // Log non-auth errors but don't fail (connection itself worked)
                console.debug(`${LOG_PREFIX} Connection successful, but response had errors: ${body.status.errors[0].error}`);
            }

            console.debug(`${LOG_PREFIX} Connection test successful`);
            return { success: true };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Connection test failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'testConnection'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Connection test failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'testConnection'
                }
            };
        }
    }

    /**
     * Execute a SQL query against the server
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param username - Authentication username
     * @param password - Authentication password
     * @param query - SQL query string
     * @param parameters - Query parameters
     * @returns Query response or error
     */
    public async executeQuery(
        spec: IServerSpec,
        namespace: string,
        username: string,
        password: string,
        query: string,
        parameters: unknown[] = []
    ): Promise<{ success: boolean; data?: unknown[]; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this._buildAuthHeaders(username, password);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    parameters
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                return {
                    success: false,
                    error: ErrorHandler.createError(ErrorCodes.AUTH_FAILED, 'executeQuery')
                };
            }

            if (!response.ok) {
                return {
                    success: false,
                    error: ErrorHandler.createError(
                        ErrorCodes.CONNECTION_FAILED,
                        'executeQuery',
                        `Server returned status ${response.status}`
                    )
                };
            }

            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'executeQuery');
                if (error) {
                    return { success: false, error };
                }
            }

            return {
                success: true,
                data: body.result?.content || []
            };

        } catch (error) {
            const parsedError = ErrorHandler.parse(error, 'executeQuery');
            return {
                success: false,
                error: parsedError || ErrorHandler.createError(ErrorCodes.UNKNOWN_ERROR, 'executeQuery')
            };
        }
    }

    /**
     * Set the request timeout
     * @param timeout - Timeout in milliseconds
     */
    public setTimeout(timeout: number): void {
        this._timeout = timeout;
    }

    /**
     * Build HTTP headers with Basic Auth
     * SECURITY: Password is used here only, never stored
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Headers object with Authorization
     */
    private _buildAuthHeaders(username: string, password: string): Record<string, string> {
        const credentials = `${username}:${password}`;
        const encoded = Buffer.from(credentials).toString('base64');
        return {
            'Authorization': `Basic ${encoded}`,
            'Content-Type': 'application/json'
        };
    }
}
