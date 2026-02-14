/**
 * HTTP client for InterSystems Atelier REST API
 * Thin transport layer: handles connection testing and query execution.
 * Business logic (CRUD, metadata, SQL building) lives in QueryExecutor,
 * TableMetadataService, and SqlBuilder respectively.
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
export interface IAtelierServerDescriptor {
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
 * HTTP transport service for Atelier REST API
 */
export class AtelierApiService {
    private _timeout = 30000; // 30 second default (matches iris-table-editor.apiTimeout setting)

    /**
     * Test connection to server by hitting the root Atelier endpoint
     * This endpoint returns server info and available namespaces without requiring a specific namespace
     * @param spec - Server specification
     * @param username - Authentication username
     * @param password - Authentication password
     * @param externalSignal - Optional abort signal for user cancellation
     * @returns Result with success flag and optional error
     */
    public async testConnection(
        spec: IServerSpec,
        username: string,
        password: string,
        externalSignal?: AbortSignal
    ): Promise<{ success: boolean; error?: IUserError }> {
        // Use root Atelier endpoint - doesn't require a namespace
        const url = UrlBuilder.buildBaseUrl(spec);
        const headers = this.buildAuthHeaders(username, password);

        console.debug(`${LOG_PREFIX} Testing connection to ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this._timeout);

        // Link external signal to internal controller for user cancellation
        const onExternalAbort = () => controller.abort();
        externalSignal?.addEventListener('abort', onExternalAbort);

        try {
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
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                // Distinguish user cancellation from timeout
                if (externalSignal?.aborted) {
                    console.debug(`${LOG_PREFIX} Connection test cancelled by user`);
                    return {
                        success: false,
                        error: {
                            message: 'Connection cancelled.',
                            code: ErrorCodes.CONNECTION_CANCELLED,
                            recoverable: true,
                            context: 'testConnection'
                        }
                    };
                }
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
        } finally {
            externalSignal?.removeEventListener('abort', onExternalAbort);
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
     * @param externalSignal - Optional abort signal for user cancellation
     * @returns Query response or error
     */
    public async executeQuery(
        spec: IServerSpec,
        namespace: string,
        username: string,
        password: string,
        query: string,
        parameters: unknown[] = [],
        externalSignal?: AbortSignal
    ): Promise<{ success: boolean; data?: unknown[]; error?: IUserError }> {
        const url = UrlBuilder.buildQueryUrl(
            UrlBuilder.buildBaseUrl(spec),
            namespace
        );

        const headers = this.buildAuthHeaders(username, password);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this._timeout);

        // Link external signal to internal controller for user cancellation
        const onExternalAbort = () => controller.abort();
        externalSignal?.addEventListener('abort', onExternalAbort);

        try {
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
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError' && externalSignal?.aborted) {
                return {
                    success: false,
                    error: {
                        message: 'Operation cancelled.',
                        code: ErrorCodes.CONNECTION_CANCELLED,
                        recoverable: true,
                        context: 'executeQuery'
                    }
                };
            }
            const parsedError = ErrorHandler.parse(error, 'executeQuery');
            return {
                success: false,
                error: parsedError || ErrorHandler.createError(ErrorCodes.UNKNOWN_ERROR, 'executeQuery')
            };
        } finally {
            externalSignal?.removeEventListener('abort', onExternalAbort);
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
     * Get the current request timeout
     * @returns Timeout in milliseconds
     */
    public getTimeout(): number {
        return this._timeout;
    }

    /**
     * Build HTTP headers with Basic Auth
     * SECURITY: Password is used here only, never stored
     * @param username - Authentication username
     * @param password - Authentication password
     * @returns Headers object with Authorization
     */
    public buildAuthHeaders(username: string, password: string): Record<string, string> {
        const credentials = `${username}:${password}`;
        const encoded = Buffer.from(credentials).toString('base64');
        return {
            'Authorization': `Basic ${encoded}`,
            'Content-Type': 'application/json'
        };
    }
}
