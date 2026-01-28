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
 * Atelier API server descriptor response (root endpoint)
 * The actual data is nested inside result.content
 */
interface IAtelierServerDescriptor {
    status: {
        errors: Array<{ error: string }>;
        summary?: string;
    };
    result?: {
        content?: {
            api?: number;
            namespaces?: string[];
            version?: string;
        };
    };
}

/**
 * Service for communicating with InterSystems Atelier REST API
 */
export class AtelierApiService {
    private _timeout = 10000; // 10 second timeout

    /**
     * Test connection to server by hitting the root Atelier endpoint
     * This endpoint returns server info and available namespaces without requiring a specific namespace
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
        // Use root Atelier endpoint - doesn't require a namespace
        const url = UrlBuilder.buildBaseUrl(spec);
        const headers = this._buildAuthHeaders(username, password);

        console.debug(`${LOG_PREFIX} Testing connection to ${url}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'GET',
                headers,
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

            // Parse response body - root endpoint returns server descriptor
            const body = await response.json() as IAtelierServerDescriptor;

            // If we got here with a valid response, connection is successful
            const apiVersion = body.result?.content?.api;
            const namespaceCount = body.result?.content?.namespaces?.length || 0;
            console.debug(`${LOG_PREFIX} Connection test successful - API version: ${apiVersion}, namespaces: ${namespaceCount}`);
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
     * Get list of available namespaces from server
     * @param spec - Server specification
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag, namespaces array, and optional error
     */
    public async getNamespaces(
        spec: IServerSpec,
        username: string,
        password: string
    ): Promise<{ success: boolean; namespaces?: string[]; error?: IUserError }> {
        // Use root endpoint - returns server descriptor with namespaces array
        const url = UrlBuilder.buildBaseUrl(spec);
        const headers = this._buildAuthHeaders(username, password);

        console.debug(`${LOG_PREFIX} Fetching namespaces from URL: ${url}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'GET',
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Get namespaces failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'getNamespaces'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Get namespaces failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'getNamespaces'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierServerDescriptor;

            console.debug(`${LOG_PREFIX} Namespace response:`, JSON.stringify(body));

            // Extract namespaces from result.content.namespaces
            const namespaces = body.result?.content?.namespaces || [];
            console.debug(`${LOG_PREFIX} Retrieved ${namespaces.length} namespaces`);
            return {
                success: true,
                namespaces
            };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Get namespaces failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'getNamespaces'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Get namespaces failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'getNamespaces'
                }
            };
        }
    }

    /**
     * Get list of tables in a namespace
     * @param spec - Server specification
     * @param namespace - Target namespace
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Result with success flag, tables array, and optional error
     */
    public async getTables(
        spec: IServerSpec,
        namespace: string,
        username: string,
        password: string
    ): Promise<{ success: boolean; tables?: string[]; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this._buildAuthHeaders(username, password);

        const query = `
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `;

        console.debug(`${LOG_PREFIX} Fetching tables from ${spec.host}:${spec.port}/${namespace}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    parameters: []
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Check HTTP status
            if (response.status === 401) {
                console.debug(`${LOG_PREFIX} Get tables failed: Authentication error`);
                return {
                    success: false,
                    error: {
                        message: 'Authentication failed. Please check your credentials.',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'getTables'
                    }
                };
            }

            if (!response.ok) {
                console.debug(`${LOG_PREFIX} Get tables failed: HTTP ${response.status}`);
                return {
                    success: false,
                    error: {
                        message: `Server returned status ${response.status}`,
                        code: ErrorCodes.CONNECTION_FAILED,
                        recoverable: true,
                        context: 'getTables'
                    }
                };
            }

            // Parse response body
            const body = await response.json() as IAtelierQueryResponse;

            // Check for Atelier errors
            if (body.status?.errors?.length > 0) {
                const error = ErrorHandler.parse(body, 'getTables');
                if (error) {
                    console.debug(`${LOG_PREFIX} Get tables failed: ${error.message}`);
                    return { success: false, error };
                }
            }

            // Extract table names from result content, filtering out any malformed rows
            const tables = (body.result?.content || [])
                .map((row: unknown) => (row as { TABLE_NAME: string }).TABLE_NAME)
                .filter((name): name is string => typeof name === 'string');

            console.debug(`${LOG_PREFIX} Retrieved ${tables.length} tables`);
            return {
                success: true,
                tables
            };

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.debug(`${LOG_PREFIX} Get tables failed: Timeout`);
                return {
                    success: false,
                    error: {
                        message: 'Connection timed out. The server may be busy or unreachable.',
                        code: ErrorCodes.CONNECTION_TIMEOUT,
                        recoverable: true,
                        context: 'getTables'
                    }
                };
            }

            // Network error
            console.debug(`${LOG_PREFIX} Get tables failed: Network error`, error);
            return {
                success: false,
                error: {
                    message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: true,
                    context: 'getTables'
                }
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
