/**
 * SessionManager - Active connection session state management
 * Story 11.2: IPC Bridge
 *
 * Holds the active connection context (services, credentials, table state)
 * during an active IRIS server session. Separates connection state from
 * ConnectionLifecycleManager (which manages the lifecycle state machine)
 * and ConnectionManager (which manages server CRUD).
 *
 * Security: Credentials are held in memory only during an active session.
 * endSession() nulls out all references including the password.
 */
import { AtelierApiService, QueryExecutor, TableMetadataService } from '@iris-te/core';
import type { IServerSpec, ITableSchema } from '@iris-te/core';

const LOG_PREFIX = '[IRIS-TE Session]';

/**
 * Default API timeout for data operations (30 seconds).
 * Matches the VS Code extension's iris-table-editor.apiTimeout default.
 */
const DEFAULT_API_TIMEOUT = 30000;

/**
 * Manages active session state for an IRIS server connection.
 * Holds service instances, credentials, and current table context.
 */
export class SessionManager {
    // Connection state
    private _serverName: string | null = null;
    private _serverSpec: IServerSpec | null = null;
    private _username: string | null = null;
    private _password: string | null = null;

    // Service instances
    private _apiService: AtelierApiService | null = null;
    private _queryExecutor: QueryExecutor | null = null;
    private _metadataService: TableMetadataService | null = null;

    // Table context (Task 5)
    private _currentNamespace: string | null = null;
    private _currentTableName: string | null = null;
    private _currentSchema: ITableSchema | null = null;

    /**
     * Start a new session with the given server configuration.
     * Creates AtelierApiService (with 30s timeout), QueryExecutor, and TableMetadataService.
     * Stores credentials in memory for the duration of the session.
     *
     * @param serverName - Name of the connected server
     * @param serverSpec - Server connection specification
     * @param username - Authentication username
     * @param password - Authentication password (in-memory only)
     */
    startSession(serverName: string, serverSpec: IServerSpec, username: string, password: string): void {
        // Clear any existing session first
        this.endSession();

        this._serverName = serverName;
        this._serverSpec = serverSpec;
        this._username = username;
        this._password = password;

        // Create service instances with 30s timeout for data operations
        this._apiService = new AtelierApiService();
        this._apiService.setTimeout(DEFAULT_API_TIMEOUT);

        this._queryExecutor = new QueryExecutor(this._apiService);
        this._metadataService = new TableMetadataService(this._apiService);

        console.log(`${LOG_PREFIX} Session started for "${serverName}"`);
    }

    /**
     * End the current session.
     * Clears all fields, nulls out service references and credentials.
     * After this call, isActive() returns false.
     */
    endSession(): void {
        const serverName = this._serverName;

        // Clear connection state
        this._serverName = null;
        this._serverSpec = null;
        this._username = null;
        this._password = null;

        // Clear service instances
        this._apiService = null;
        this._queryExecutor = null;
        this._metadataService = null;

        // Clear table context
        this._currentNamespace = null;
        this._currentTableName = null;
        this._currentSchema = null;

        if (serverName) {
            console.log(`${LOG_PREFIX} Session ended for "${serverName}"`);
        }
    }

    /**
     * Whether the session has all required fields for data operations.
     * @returns true if serverSpec, username, password, and all services are available
     */
    isActive(): boolean {
        return (
            this._serverName !== null &&
            this._serverSpec !== null &&
            this._username !== null &&
            this._password !== null &&
            this._apiService !== null &&
            this._queryExecutor !== null &&
            this._metadataService !== null
        );
    }

    // ============================================
    // Connection state getters
    // ============================================

    getServerName(): string | null {
        return this._serverName;
    }

    getServerSpec(): IServerSpec | null {
        return this._serverSpec;
    }

    getUsername(): string | null {
        return this._username;
    }

    getPassword(): string | null {
        return this._password;
    }

    getQueryExecutor(): QueryExecutor | null {
        return this._queryExecutor;
    }

    getMetadataService(): TableMetadataService | null {
        return this._metadataService;
    }

    // ============================================
    // Table context (Task 5)
    // ============================================

    /**
     * Set the current namespace for browsing.
     * Clears current table context since a namespace change invalidates it.
     */
    setNamespace(namespace: string): void {
        this._currentNamespace = namespace;
        // Clear table context when namespace changes
        this._currentTableName = null;
        this._currentSchema = null;
    }

    /**
     * Set the current table and its schema.
     */
    setTable(tableName: string, schema: ITableSchema): void {
        this._currentTableName = tableName;
        this._currentSchema = schema;
    }

    /**
     * Clear the current table context (but keep the namespace).
     */
    clearTable(): void {
        this._currentTableName = null;
        this._currentSchema = null;
    }

    getCurrentNamespace(): string | null {
        return this._currentNamespace;
    }

    getCurrentTableName(): string | null {
        return this._currentTableName;
    }

    getCurrentSchema(): ITableSchema | null {
        return this._currentSchema;
    }
}
