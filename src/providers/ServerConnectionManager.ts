import * as vscode from 'vscode';
import type { ServerManagerAPI, IServerName, IServerSpec as ISMServerSpec } from '@intersystems-community/intersystems-servermanager';
import { AUTHENTICATION_PROVIDER } from '@intersystems-community/intersystems-servermanager';

/**
 * Cached credentials from Server Manager
 * SECURITY: Stored in memory only, cleared on disconnect
 */
interface ICredentials {
    username: string;
    password: string;
}
import { IServerSpec } from '../models/IServerSpec';
import { IUserError, IFilterCriterion, SortDirection } from '../models/IMessages';
import { ITableSchema } from '../models/ITableSchema';
import { ITableRow } from '../models/ITableData';
import { AtelierApiService } from '../services/AtelierApiService';
import { ErrorHandler, ErrorCodes } from '../utils/ErrorHandler';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Manages server connections via InterSystems Server Manager extension
 */
/**
 * Cached schema entry with timestamp for TTL
 */
interface ISchemaCacheEntry {
    schema: ITableSchema;
    timestamp: number;
}

export class ServerConnectionManager {
    private _serverManagerApi: ServerManagerAPI | undefined;
    private _connectedServer: string | null = null;
    private _serverSpec: IServerSpec | null = null;
    private _credentials: ICredentials | null = null;
    private _atelierApiService: AtelierApiService;
    private _schemaCache: Map<string, ISchemaCacheEntry> = new Map();
    private _connectionAbortController: AbortController | null = null;
    private static readonly SCHEMA_CACHE_TTL_MS = 3600000; // 1 hour TTL

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
     * Get server specification by name (without credentials)
     * @param serverName - Name of the server to get specification for
     * @returns Server specification or undefined if not found
     */
    public async getServerSpec(serverName: string): Promise<IServerSpec | undefined> {
        const result = await this._getServerSpecWithCredentials(serverName);
        return result?.spec;
    }

    /**
     * Get server specification with credentials from Server Manager
     * Uses the authentication provider to get password securely
     * @param serverName - Name of the server
     * @returns Server spec with credentials, or undefined if not found
     */
    private async _getServerSpecWithCredentials(serverName: string): Promise<{ spec: IServerSpec; credentials: ICredentials } | undefined> {
        if (!this.isServerManagerInstalled()) {
            return undefined;
        }

        try {
            const api = await this._getServerManagerApi();
            if (!api) {
                return undefined;
            }

            // 1. Get the server spec (may not include password)
            const smSpec: ISMServerSpec | undefined = await api.getServerSpec(serverName);
            if (!smSpec) {
                console.debug(`${LOG_PREFIX} Server '${serverName}' not found`);
                return undefined;
            }

            console.debug(`${LOG_PREFIX} Got spec for '${serverName}' - username: ${smSpec.username}`);

            // Build our spec object
            const spec: IServerSpec = {
                name: smSpec.name,
                scheme: (smSpec.webServer.scheme as 'http' | 'https') || 'http',
                host: smSpec.webServer.host || 'localhost',
                port: smSpec.webServer.port || 52773,
                pathPrefix: smSpec.webServer.pathPrefix || '',
                username: smSpec.username
            };

            // 2. If password is already on spec, use it directly
            if (smSpec.password) {
                console.debug(`${LOG_PREFIX} Password available on spec`);
                return {
                    spec,
                    credentials: {
                        username: smSpec.username || '',
                        password: smSpec.password
                    }
                };
            }

            // 3. Otherwise, get password via authentication provider
            // Scopes should be [serverName, username] per ObjectScript extension pattern
            const username = smSpec.username || '';
            const scopes = [serverName, username];

            console.debug(`${LOG_PREFIX} Getting credentials via auth provider with scopes: ${scopes.join(', ')}`);

            // Try to get account info if available
            const account = api.getAccount ? api.getAccount(smSpec) : undefined;

            // First try silent (use cached credentials)
            let session = await vscode.authentication.getSession(
                AUTHENTICATION_PROVIDER,
                scopes,
                { silent: true, account }
            );

            // If no cached session, prompt user
            if (!session) {
                console.debug(`${LOG_PREFIX} No cached session, prompting for credentials`);
                session = await vscode.authentication.getSession(
                    AUTHENTICATION_PROVIDER,
                    scopes,
                    { createIfNone: true, account }
                );
            }

            if (!session) {
                console.debug(`${LOG_PREFIX} Authentication cancelled or failed`);
                return undefined;
            }

            console.debug(`${LOG_PREFIX} Got session - account.id: ${session.account.id}, scopes: ${session.scopes.join(', ')}`);

            // session.accessToken is the password
            // session.scopes[1] may contain the username if not specified
            const finalUsername = username || session.scopes[1] || session.account.id;

            return {
                spec: {
                    ...spec,
                    username: finalUsername
                },
                credentials: {
                    username: finalUsername,
                    password: session.accessToken
                }
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

        // 1. Get server spec with credentials from Server Manager
        const result = await this._getServerSpecWithCredentials(serverName);
        if (!result) {
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

        const { spec, credentials } = result;

        // 2. Validate we have credentials
        if (!credentials.username || !credentials.password) {
            console.debug(`${LOG_PREFIX} Missing credentials - username: ${!!credentials.username}, password: ${!!credentials.password}`);
            return {
                success: false,
                error: {
                    message: 'Missing credentials. Please configure username and password in Server Manager.',
                    code: ErrorCodes.AUTH_FAILED,
                    recoverable: true,
                    context: 'connect'
                }
            };
        }

        // Read timeout settings from VS Code configuration
        const config = vscode.workspace.getConfiguration('iris-table-editor');
        const connectionTimeoutSec = config.get<number>('connectionTimeout', 10);
        const apiTimeoutSec = config.get<number>('apiTimeout', 30);

        // Set connection timeout for testConnection
        this._atelierApiService.setTimeout(connectionTimeoutSec * 1000);

        // Create abort controller for external cancellation
        this._connectionAbortController = new AbortController();

        try {
            // 3. Test connection with Atelier API (with external cancel signal)
            console.debug(`${LOG_PREFIX} Testing connection with username: ${credentials.username} (timeout: ${connectionTimeoutSec}s)`);
            const testResult = await this._atelierApiService.testConnection(
                spec,
                credentials.username,
                credentials.password,
                this._connectionAbortController.signal
            );

            if (!testResult.success) {
                return { success: false, error: testResult.error };
            }

            // 4. Store connection state (credentials stored in memory only)
            this._connectedServer = serverName;
            this._serverSpec = spec;
            this._credentials = credentials;

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
        } finally {
            this._connectionAbortController = null;
            // Ensure API timeout is restored even on failure
            this._atelierApiService.setTimeout(apiTimeoutSec * 1000);
        }
    }

    /**
     * Cancel an in-progress connection attempt
     * Story 1.7: User-initiated connection cancellation
     */
    public cancelConnection(): void {
        if (this._connectionAbortController) {
            console.debug(`${LOG_PREFIX} Cancelling connection attempt`);
            this._connectionAbortController.abort();
            this._connectionAbortController = null;
        }
    }

    /**
     * Disconnect from current server
     * SECURITY: Clears credentials and cache from memory
     */
    public disconnect(): void {
        console.debug(`${LOG_PREFIX} Disconnecting from server: ${this._connectedServer}`);
        this._connectedServer = null;
        this._serverSpec = null;
        this._credentials = null;
        this._schemaCache.clear();
    }

    /**
     * Get list of available namespaces from connected server
     * Uses cached credentials from connect()
     * @returns Result with success flag, namespaces array, and optional error
     */
    public async getNamespaces(): Promise<{
        success: boolean;
        namespaces?: string[];
        error?: IUserError;
    }> {
        console.debug(`${LOG_PREFIX} getNamespaces called - connected: ${!!this._connectedServer}, hasSpec: ${!!this._serverSpec}, hasCredentials: ${!!this._credentials}`);

        if (!this._connectedServer || !this._serverSpec || !this._credentials) {
            console.debug(`${LOG_PREFIX} getNamespaces: Not connected, returning error`);
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

        try {
            console.debug(`${LOG_PREFIX} getNamespaces: Calling AtelierApiService.getNamespaces`);
            const result = await this._atelierApiService.getNamespaces(
                this._serverSpec,
                this._credentials.username,
                this._credentials.password
            );
            console.debug(`${LOG_PREFIX} getNamespaces result: success=${result.success}, count=${result.namespaces?.length || 0}`);
            return result;

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
     * Get list of tables in a namespace from connected server
     * Uses cached credentials from connect()
     * @param namespace - Target namespace to get tables from
     * @returns Result with success flag, tables array, and optional error
     */
    public async getTables(namespace: string): Promise<{
        success: boolean;
        tables?: string[];
        error?: IUserError;
    }> {
        if (!this._connectedServer || !this._serverSpec || !this._credentials) {
            return {
                success: false,
                error: {
                    message: 'Not connected to a server',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'getTables'
                }
            };
        }

        if (!namespace) {
            return {
                success: false,
                error: {
                    message: 'Namespace is required',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'getTables'
                }
            };
        }

        try {
            return this._atelierApiService.getTables(
                this._serverSpec,
                namespace,
                this._credentials.username,
                this._credentials.password
            );

        } catch (error) {
            console.error(`${LOG_PREFIX} Get tables error:`, error);
            return {
                success: false,
                error: ErrorHandler.parse(error, 'getTables') || {
                    message: 'Failed to get tables',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'getTables'
                }
            };
        }
    }

    /**
     * Get table schema (column metadata) from connected server
     * Uses 1-hour TTL cache per architecture specification
     * @param namespace - Target namespace
     * @param tableName - Name of the table to get schema for
     * @returns Result with success flag, schema, and optional error
     */
    public async getTableSchema(namespace: string, tableName: string): Promise<{
        success: boolean;
        schema?: ITableSchema;
        error?: IUserError;
    }> {
        if (!this._connectedServer || !this._serverSpec || !this._credentials) {
            return {
                success: false,
                error: {
                    message: 'Not connected to a server',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'getTableSchema'
                }
            };
        }

        if (!namespace) {
            return {
                success: false,
                error: {
                    message: 'Namespace is required',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'getTableSchema'
                }
            };
        }

        if (!tableName) {
            return {
                success: false,
                error: {
                    message: 'Table name is required',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'getTableSchema'
                }
            };
        }

        // Check cache first
        const cacheKey = `${namespace}.${tableName}`;
        const cached = this._schemaCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < ServerConnectionManager.SCHEMA_CACHE_TTL_MS) {
            console.debug(`${LOG_PREFIX} Schema cache hit for ${cacheKey}`);
            return { success: true, schema: cached.schema };
        }

        try {
            console.debug(`${LOG_PREFIX} Fetching schema for ${tableName} in ${namespace}`);
            const result = await this._atelierApiService.getTableSchema(
                this._serverSpec,
                namespace,
                tableName,
                this._credentials.username,
                this._credentials.password
            );

            // Cache on success
            if (result.success && result.schema) {
                this._schemaCache.set(cacheKey, {
                    schema: result.schema,
                    timestamp: Date.now()
                });
                console.debug(`${LOG_PREFIX} Schema cached for ${cacheKey}`);
            }

            return result;

        } catch (error) {
            console.error(`${LOG_PREFIX} Get table schema error:`, error);
            return {
                success: false,
                error: ErrorHandler.parse(error, 'getTableSchema') || {
                    message: 'Failed to get table schema',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'getTableSchema'
                }
            };
        }
    }

    /**
     * Get table data with pagination from connected server
     * @param namespace - Target namespace
     * @param tableName - Name of the table to get data from
     * @param pageSize - Number of rows to fetch
     * @param offset - Row offset for pagination
     * @param filters - Story 6.2: Column filter criteria
     * @param sortColumn - Story 6.4: Column to sort by
     * @param sortDirection - Story 6.4: Sort direction (asc/desc/null)
     * @returns Result with success flag, rows, totalRows, and optional error
     */
    public async getTableData(
        namespace: string,
        tableName: string,
        pageSize: number,
        offset: number,
        filters: IFilterCriterion[] = [],
        sortColumn: string | null = null,
        sortDirection: SortDirection = null
    ): Promise<{
        success: boolean;
        rows?: ITableRow[];
        totalRows?: number;
        error?: IUserError;
    }> {
        if (!this._connectedServer || !this._serverSpec || !this._credentials) {
            return {
                success: false,
                error: {
                    message: 'Not connected to a server',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'getTableData'
                }
            };
        }

        if (!namespace) {
            return {
                success: false,
                error: {
                    message: 'Namespace is required',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'getTableData'
                }
            };
        }

        if (!tableName) {
            return {
                success: false,
                error: {
                    message: 'Table name is required',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'getTableData'
                }
            };
        }

        try {
            // First get schema (uses cache)
            const schemaResult = await this.getTableSchema(namespace, tableName);
            if (!schemaResult.success || !schemaResult.schema) {
                return {
                    success: false,
                    error: schemaResult.error || {
                        message: 'Failed to get table schema',
                        code: ErrorCodes.UNKNOWN_ERROR,
                        recoverable: true,
                        context: 'getTableData'
                    }
                };
            }

            console.debug(`${LOG_PREFIX} Fetching data for ${tableName} in ${namespace} (pageSize: ${pageSize}, offset: ${offset}, filters: ${filters.length}, sort: ${sortColumn || 'none'} ${sortDirection || ''})`);
            // Story 6.2: Pass filters to AtelierApiService
            // Story 6.4: Pass sort parameters to AtelierApiService
            return this._atelierApiService.getTableData(
                this._serverSpec,
                namespace,
                tableName,
                schemaResult.schema,
                pageSize,
                offset,
                this._credentials.username,
                this._credentials.password,
                filters,
                sortColumn,
                sortDirection
            );

        } catch (error) {
            console.error(`${LOG_PREFIX} Get table data error:`, error);
            return {
                success: false,
                error: ErrorHandler.parse(error, 'getTableData') || {
                    message: 'Failed to get table data',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'getTableData'
                }
            };
        }
    }

    /**
     * Update a single cell value in a table
     * Story 3.3: Cell update wrapper
     * @param namespace - Target namespace
     * @param tableName - Table name
     * @param columnName - Column to update
     * @param newValue - New value
     * @param primaryKeyColumn - Primary key column name
     * @param primaryKeyValue - Primary key value for the row
     * @returns Result with success flag and optional error
     */
    public async updateCell(
        namespace: string,
        tableName: string,
        columnName: string,
        newValue: unknown,
        primaryKeyColumn: string,
        primaryKeyValue: unknown
    ): Promise<{ success: boolean; rowsAffected?: number; error?: IUserError }> {
        if (!this._connectedServer || !this._serverSpec || !this._credentials) {
            return {
                success: false,
                error: {
                    message: 'Not connected to a server',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'updateCell'
                }
            };
        }

        if (!namespace || !tableName || !columnName || !primaryKeyColumn) {
            return {
                success: false,
                error: {
                    message: 'Missing required parameters for update',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: false,
                    context: 'updateCell'
                }
            };
        }

        try {
            console.debug(`${LOG_PREFIX} Updating cell: ${tableName}.${columnName} WHERE ${primaryKeyColumn}=${primaryKeyValue}`);
            return this._atelierApiService.updateCell(
                this._serverSpec,
                namespace,
                tableName,
                columnName,
                newValue,
                primaryKeyColumn,
                primaryKeyValue,
                this._credentials.username,
                this._credentials.password
            );
        } catch (error) {
            console.error(`${LOG_PREFIX} Update cell error:`, error);
            return {
                success: false,
                error: ErrorHandler.parse(error, 'updateCell') || {
                    message: 'Failed to update cell',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'updateCell'
                }
            };
        }
    }

    /**
     * Insert a new row into a table
     * Story 4.3: Row insertion wrapper
     * @param namespace - Target namespace
     * @param tableName - Table name
     * @param columns - Column names
     * @param values - Column values
     * @returns Result with success flag and optional error
     */
    public async insertRow(
        namespace: string,
        tableName: string,
        columns: string[],
        values: unknown[]
    ): Promise<{ success: boolean; error?: IUserError }> {
        if (!this._connectedServer || !this._serverSpec || !this._credentials) {
            return {
                success: false,
                error: {
                    message: 'Not connected to a server',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'insertRow'
                }
            };
        }

        if (!namespace || !tableName || !columns.length) {
            return {
                success: false,
                error: {
                    message: 'Missing required parameters for insert',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: false,
                    context: 'insertRow'
                }
            };
        }

        try {
            console.debug(`${LOG_PREFIX} Inserting row into ${tableName}`);
            return this._atelierApiService.insertRow(
                this._serverSpec,
                namespace,
                tableName,
                columns,
                values,
                this._credentials.username,
                this._credentials.password
            );
        } catch (error) {
            console.error(`${LOG_PREFIX} Insert row error:`, error);
            return {
                success: false,
                error: ErrorHandler.parse(error, 'insertRow') || {
                    message: 'Failed to insert row',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'insertRow'
                }
            };
        }
    }

    /**
     * Delete a row from a table
     * Story 5.3: Row deletion wrapper
     * @param namespace - Target namespace
     * @param tableName - Table name
     * @param primaryKeyColumn - Primary key column name
     * @param primaryKeyValue - Primary key value for the row
     * @returns Result with success flag and optional error
     */
    public async deleteRow(
        namespace: string,
        tableName: string,
        primaryKeyColumn: string,
        primaryKeyValue: unknown
    ): Promise<{ success: boolean; error?: IUserError }> {
        if (!this._connectedServer || !this._serverSpec || !this._credentials) {
            return {
                success: false,
                error: {
                    message: 'Not connected to a server',
                    code: ErrorCodes.CONNECTION_FAILED,
                    recoverable: true,
                    context: 'deleteRow'
                }
            };
        }

        if (!namespace || !tableName || !primaryKeyColumn) {
            return {
                success: false,
                error: {
                    message: 'Missing required parameters for delete',
                    code: ErrorCodes.INVALID_INPUT,
                    recoverable: false,
                    context: 'deleteRow'
                }
            };
        }

        try {
            console.debug(`${LOG_PREFIX} Deleting row from ${tableName} WHERE ${primaryKeyColumn}=${primaryKeyValue}`);
            return this._atelierApiService.deleteRow(
                this._serverSpec,
                namespace,
                tableName,
                primaryKeyColumn,
                primaryKeyValue,
                this._credentials.username,
                this._credentials.password
            );
        } catch (error) {
            console.error(`${LOG_PREFIX} Delete row error:`, error);
            return {
                success: false,
                error: ErrorHandler.parse(error, 'deleteRow') || {
                    message: 'Failed to delete row',
                    code: ErrorCodes.UNKNOWN_ERROR,
                    recoverable: true,
                    context: 'deleteRow'
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
     * Invalidate cached schema for a table or all tables
     * Call this on refresh operations to ensure fresh schema data
     * @param namespace - Target namespace (optional, clears all if omitted)
     * @param tableName - Table name (optional, clears all in namespace if omitted)
     */
    public invalidateSchemaCache(namespace?: string, tableName?: string): void {
        if (namespace && tableName) {
            const cacheKey = `${namespace}.${tableName}`;
            this._schemaCache.delete(cacheKey);
            console.debug(`${LOG_PREFIX} Schema cache invalidated for ${cacheKey}`);
        } else if (namespace) {
            // Clear all entries for the namespace
            for (const key of this._schemaCache.keys()) {
                if (key.startsWith(`${namespace}.`)) {
                    this._schemaCache.delete(key);
                }
            }
            console.debug(`${LOG_PREFIX} Schema cache invalidated for namespace ${namespace}`);
        } else {
            this._schemaCache.clear();
            console.debug(`${LOG_PREFIX} Schema cache cleared`);
        }
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
