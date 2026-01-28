import * as vscode from 'vscode';
import type { ServerManagerAPI, IServerName, IServerSpec as ISMServerSpec } from '@intersystems-community/intersystems-servermanager';
import { IServerSpec } from '../models/IServerSpec';
import { IUserError } from '../models/IMessages';
import { AtelierApiService } from '../services/AtelierApiService';
import { ErrorHandler, ErrorCodes } from '../utils/ErrorHandler';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Manages server connections via InterSystems Server Manager extension
 */
export class ServerConnectionManager {
    private _serverManagerApi: ServerManagerAPI | undefined;
    private _connectedServer: string | null = null;
    private _serverSpec: IServerSpec | null = null;
    private _atelierApiService: AtelierApiService;

    constructor() {
        this._atelierApiService = new AtelierApiService();
    }

    /**
     * Check if Server Manager extension is installed and active
     */
    public isServerManagerInstalled(): boolean {
        const extension = vscode.extensions.getExtension('intersystems-community.servermanager');
        return extension !== undefined;
    }

    /**
     * Get list of configured server names
     * @returns Array of server names or empty array if none configured
     */
    public async getServerList(): Promise<string[]> {
        if (!this.isServerManagerInstalled()) {
            console.debug(`${LOG_PREFIX} Server Manager not installed`);
            return [];
        }

        try {
            const api = await this._getServerManagerApi();
            if (!api) {
                return [];
            }
            const serverNames: IServerName[] = api.getServerNames();
            const names = serverNames.map(s => s.name);
            console.debug(`${LOG_PREFIX} Found ${names.length} configured servers`);
            return names;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting server list:`, error);
            return [];
        }
    }

    /**
     * Get server specification by name
     * @param serverName - Name of the server to get specification for
     * @returns Server specification or undefined if not found
     */
    public async getServerSpec(serverName: string): Promise<IServerSpec | undefined> {
        if (!this.isServerManagerInstalled()) {
            return undefined;
        }

        try {
            const api = await this._getServerManagerApi();
            if (!api) {
                return undefined;
            }
            const spec: ISMServerSpec | undefined = await api.getServerSpec(serverName);
            if (!spec) {
                console.debug(`${LOG_PREFIX} Server '${serverName}' not found`);
                return undefined;
            }
            return {
                name: spec.name,
                host: spec.webServer.host || 'localhost',
                port: spec.webServer.port || 52773,
                pathPrefix: spec.webServer.pathPrefix || '/api/atelier/',
                username: spec.username
            };
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting server spec:`, error);
            return undefined;
        }
    }

    /**
     * Connect to a server using Server Manager credentials
     * @param serverName - Name of the server to connect to
     * @returns Connection result with success status and any error
     */
    public async connect(serverName: string): Promise<{
        success: boolean;
        error?: IUserError;
    }> {
        console.debug(`${LOG_PREFIX} Attempting to connect to server: ${serverName}`);

        // 1. Get server spec
        const spec = await this.getServerSpec(serverName);
        if (!spec) {
            return {
                success: false,
                error: {
                    message: `Server '${serverName}' not found`,
                    code: ErrorCodes.SERVER_UNREACHABLE,
                    recoverable: false,
                    context: 'connect'
                }
            };
        }

        // 2. Get credentials via VS Code auth API
        try {
            const session = await vscode.authentication.getSession(
                'intersystems-server-credentials',
                [serverName],
                { createIfNone: true }
            );

            if (!session) {
                return {
                    success: false,
                    error: {
                        message: 'Authentication cancelled',
                        code: ErrorCodes.AUTH_FAILED,
                        recoverable: true,
                        context: 'connect'
                    }
                };
            }

            // 3. Test connection with Atelier API
            const testResult = await this._atelierApiService.testConnection(
                spec,
                session.account.id,  // username
                session.accessToken  // password
            );

            if (!testResult.success) {
                return { success: false, error: testResult.error };
            }

            // 4. Store connection state
            this._connectedServer = serverName;
            this._serverSpec = spec;

            console.debug(`${LOG_PREFIX} Connected to server: ${serverName}`);
            return { success: true };

        } catch (error) {
            console.error(`${LOG_PREFIX} Connection error:`, error);
            return {
                success: false,
                error: ErrorHandler.parse(error, 'connect') || {
                    message: 'Connection failed unexpectedly',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'connect'
                }
            };
        }
    }

    /**
     * Disconnect from current server
     */
    public disconnect(): void {
        console.debug(`${LOG_PREFIX} Disconnecting from server: ${this._connectedServer}`);
        this._connectedServer = null;
        this._serverSpec = null;
    }

    /**
     * Get list of available namespaces from connected server
     * SECURITY: Gets fresh credentials each time - never stores password
     * @returns Result with success flag, namespaces array, and optional error
     */
    public async getNamespaces(): Promise<{
        success: boolean;
        namespaces?: string[];
        error?: IUserError;
    }> {
        if (!this._connectedServer || !this._serverSpec) {
            return {
                success: false,
                error: {
                    message: 'Not connected to a server',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'getNamespaces'
                }
            };
        }

        // Get FRESH credentials each time - NEVER store password
        try {
            const session = await vscode.authentication.getSession(
                'intersystems-server-credentials',
                [this._connectedServer],
                { createIfNone: false }
            );

            if (!session) {
                return {
                    success: false,
                    error: {
                        message: 'Session expired. Please reconnect.',
                        code: ErrorCodes.AUTH_EXPIRED,
                        recoverable: true,
                        context: 'getNamespaces'
                    }
                };
            }

            return this._atelierApiService.getNamespaces(
                this._serverSpec,
                session.account.id,
                session.accessToken
            );

        } catch (error) {
            console.error(`${LOG_PREFIX} Get namespaces error:`, error);
            return {
                success: false,
                error: ErrorHandler.parse(error, 'getNamespaces') || {
                    message: 'Failed to get namespaces',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'getNamespaces'
                }
            };
        }
    }

    /**
     * Check if currently connected
     */
    public isConnected(): boolean {
        return this._connectedServer !== null;
    }

    /**
     * Get current connected server name
     */
    public getConnectedServer(): string | null {
        return this._connectedServer;
    }

    /**
     * Get current server spec (for API calls)
     */
    public getConnectedServerSpec(): IServerSpec | null {
        return this._serverSpec;
    }

    /**
     * Get the Server Manager extension API
     * Activates the extension if not already active
     */
    private async _getServerManagerApi(): Promise<ServerManagerAPI | undefined> {
        if (this._serverManagerApi) {
            return this._serverManagerApi;
        }

        try {
            const extension = vscode.extensions.getExtension<ServerManagerAPI>('intersystems-community.servermanager');
            if (!extension) {
                console.debug(`${LOG_PREFIX} Server Manager extension not found`);
                return undefined;
            }

            // Activate the extension if not already active
            if (!extension.isActive) {
                console.debug(`${LOG_PREFIX} Activating Server Manager extension`);
                await extension.activate();
            }

            this._serverManagerApi = extension.exports;
            return this._serverManagerApi;
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to get Server Manager API:`, error);
            return undefined;
        }
    }
}
