/**
 * ConnectionManager - Server CRUD + JSON file persistence
 * Story 12.1: Server List UI
 * Story 12.4: Credential Storage - Added ICredentialStore integration
 *
 * Manages server configurations for the desktop application.
 * Uses plain Node.js file I/O for persistence (JSON file store).
 * Optionally encrypts passwords via ICredentialStore abstraction.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AtelierApiService, ErrorCodes } from '@iris-te/core';
import type { IServerSpec } from '@iris-te/core';
import type { ICredentialStore } from './ICredentialStore';

/**
 * Server configuration stored in the JSON file
 */
export interface ServerConfig {
    /** Unique server name (display label) */
    name: string;
    /** Hostname or IP address */
    hostname: string;
    /** Port number */
    port: number;
    /** Default namespace (optional) */
    namespace?: string;
    /** Username for authentication */
    username: string;
    /** Description for display purposes (optional) */
    description?: string;
    /** Whether to use SSL/TLS */
    ssl: boolean;
    /** Encrypted password (or plaintext if no credential store) */
    encryptedPassword: string;
    /** URL path prefix (e.g., "/iris") */
    pathPrefix?: string;
}

/**
 * Internal structure of the JSON storage file
 */
interface ServerStore {
    version: number;
    servers: ServerConfig[];
}

/**
 * Options for constructing a ConnectionManager
 */
export interface ConnectionManagerOptions {
    /** Directory where the config file will be stored */
    configDir: string;
    /** Config file name (default: "servers.json") */
    configFileName?: string;
    /** Optional credential store for encrypting/decrypting passwords (Story 12.4) */
    credentialStore?: ICredentialStore;
}

/**
 * Configuration for testing a connection from the form (not yet saved)
 * Story 12.3: Test Connection
 */
export interface TestConnectionConfig {
    hostname: string;
    port: number;
    pathPrefix?: string;
    ssl: boolean;
    username: string;
    password: string;
}

/**
 * Result of a test connection attempt
 * Story 12.3: Test Connection
 */
export interface TestConnectionResult {
    success: boolean;
    message: string;
}

const LOG_PREFIX = '[IRIS-TE]';
const STORE_VERSION = 1;
const DEFAULT_CONFIG_FILENAME = 'servers.json';

/**
 * Map of AtelierApiService error codes to user-friendly messages for test connection
 * Story 12.3: Test Connection
 */
const TEST_CONNECTION_ERROR_MESSAGES: Record<string, string> = {
    [ErrorCodes.SERVER_UNREACHABLE]: 'Could not reach server. Check host and port.',
    [ErrorCodes.AUTH_FAILED]: 'Authentication failed. Check username and password.',
    [ErrorCodes.CONNECTION_TIMEOUT]: 'Connection timed out. Check host and port.',
    [ErrorCodes.CONNECTION_FAILED]: 'Connection failed. Check your settings.',
    [ErrorCodes.CONNECTION_CANCELLED]: 'Connection test was cancelled.',
};

/**
 * Required fields for server config validation
 */
const REQUIRED_FIELDS: Array<keyof ServerConfig> = ['name', 'hostname', 'port', 'username'];

/**
 * Manages server configurations with JSON file persistence.
 * Provides CRUD operations and validation for server entries.
 * Story 12.4: Optionally encrypts passwords via ICredentialStore.
 */
export class ConnectionManager {
    private readonly configPath: string;
    private readonly credentialStore?: ICredentialStore;
    private store: ServerStore;

    constructor(options: ConnectionManagerOptions) {
        const fileName = options.configFileName || DEFAULT_CONFIG_FILENAME;
        this.configPath = path.join(options.configDir, fileName);
        this.credentialStore = options.credentialStore;
        this.store = { version: STORE_VERSION, servers: [] };
        this.loadFromDisk();
    }

    /**
     * Get all saved servers.
     * Returns copies with passwords stripped (empty string) for display safety.
     * Use getDecryptedPassword() to retrieve the actual password for a specific server.
     * @returns Array of server configurations with passwords stripped
     */
    getServers(): ServerConfig[] {
        return this.store.servers.map(s => ({
            ...s,
            encryptedPassword: this.credentialStore ? '' : s.encryptedPassword,
        }));
    }

    /**
     * Get a single server by name.
     * If a credential store is available, returns the decrypted password.
     * If no credential store, returns the raw stored value (backward compat).
     * @param name - Server name to look up
     * @returns Server configuration or undefined if not found
     */
    getServer(name: string): ServerConfig | undefined {
        const server = this.store.servers.find(s => s.name === name);
        if (!server) {
            return undefined;
        }

        const copy = { ...server };

        if (this.credentialStore) {
            if (this.credentialStore.isAvailable() && copy.encryptedPassword) {
                try {
                    copy.encryptedPassword = this.credentialStore.decrypt(copy.encryptedPassword);
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Failed to decrypt password for "${name}": ${error}`);
                    copy.encryptedPassword = '';
                }
            } else {
                // Store unavailable or empty password — return empty string, not raw ciphertext
                copy.encryptedPassword = '';
            }
        }

        return copy;
    }

    /**
     * Get the decrypted password for a specific server.
     * Convenience method for the connection flow.
     * @param serverName - Server name to look up
     * @returns Decrypted password, or empty string if not found/unavailable
     */
    getDecryptedPassword(serverName: string): string {
        const server = this.getServer(serverName);
        return server?.encryptedPassword ?? '';
    }

    /**
     * Get the count of saved servers
     * @returns Number of stored servers
     */
    getServerCount(): number {
        return this.store.servers.length;
    }

    /**
     * Save a new server configuration.
     * If credential store is available, encrypts the password before storage.
     * If credential store is unavailable (isAvailable() returns false), stores empty
     * string and logs a warning.
     * @param config - Server configuration to save
     * @throws Error if validation fails or name already exists
     */
    saveServer(config: ServerConfig): void {
        this.validateConfig(config);

        if (this.store.servers.some(s => s.name === config.name)) {
            throw new Error(`Server with name "${config.name}" already exists`);
        }

        const toStore = { ...config };
        toStore.encryptedPassword = this.encryptPassword(config.encryptedPassword);

        this.store.servers.push(toStore);
        this.saveToDisk();
        console.log(`${LOG_PREFIX} Server "${config.name}" saved`);
    }

    /**
     * Update an existing server configuration.
     * If new password is provided (non-empty), encrypt it.
     * If password is empty string, preserve the existing encrypted value (edit mode keep-existing).
     * @param name - Current server name to update
     * @param config - New server configuration (name may differ for rename)
     * @throws Error if server not found or validation fails
     */
    updateServer(name: string, config: ServerConfig): void {
        this.validateConfig(config);

        const index = this.store.servers.findIndex(s => s.name === name);
        if (index === -1) {
            throw new Error(`Server "${name}" not found`);
        }

        // If renaming, check that the new name is not already taken by another server
        if (config.name !== name && this.store.servers.some(s => s.name === config.name)) {
            throw new Error(`Server with name "${config.name}" already exists`);
        }

        const toStore = { ...config };

        if (this.credentialStore) {
            if (config.encryptedPassword === '') {
                // Empty password means "keep existing" in edit mode
                toStore.encryptedPassword = this.store.servers[index].encryptedPassword;
            } else {
                // New password provided — encrypt it
                toStore.encryptedPassword = this.encryptPassword(config.encryptedPassword);
            }
        }

        this.store.servers[index] = toStore;
        this.saveToDisk();
        console.log(`${LOG_PREFIX} Server "${name}" updated`);
    }

    /**
     * Delete a server configuration
     * @param name - Server name to delete
     * @throws Error if server not found
     */
    deleteServer(name: string): void {
        const index = this.store.servers.findIndex(s => s.name === name);
        if (index === -1) {
            throw new Error(`Server "${name}" not found`);
        }

        this.store.servers.splice(index, 1);
        this.saveToDisk();
        console.log(`${LOG_PREFIX} Server "${name}" deleted`);
    }

    /**
     * Test a connection using form-provided configuration (not yet saved).
     * Creates a temporary AtelierApiService, builds IServerSpec, sets 10s timeout,
     * and delegates to AtelierApiService.testConnection().
     * Maps error codes to user-friendly messages.
     * Password comes from the form directly (plaintext, not stored).
     *
     * @param config - Connection configuration from the form
     * @returns Result with success flag and user-friendly message
     */
    async testConnection(config: TestConnectionConfig): Promise<TestConnectionResult> {
        const spec: IServerSpec = {
            name: 'test-connection',
            scheme: config.ssl ? 'https' : 'http',
            host: config.hostname,
            port: config.port,
            pathPrefix: config.pathPrefix || '',
            username: config.username,
        };

        const api = new AtelierApiService();
        api.setTimeout(10000); // 10 second timeout per AC: 4

        console.log(`${LOG_PREFIX} Testing connection to ${spec.host}:${spec.port}`);

        const result = await api.testConnection(spec, config.username, config.password);

        if (result.success) {
            console.log(`${LOG_PREFIX} Test connection successful`);
            return { success: true, message: 'Connection successful!' };
        }

        const errorCode = result.error?.code || '';
        const message = TEST_CONNECTION_ERROR_MESSAGES[errorCode] || 'Connection failed. Check your settings.';

        console.log(`${LOG_PREFIX} Test connection failed: ${errorCode}`);
        return { success: false, message };
    }

    /**
     * Get the path to the config file (for testing/debugging)
     */
    getConfigPath(): string {
        return this.configPath;
    }

    /**
     * Encrypt a password using the credential store, if available.
     * - If credential store is available: encrypts and returns encrypted string
     * - If credential store is unavailable (isAvailable() false): returns empty string, logs warning
     * - If no credential store configured: returns password unchanged (backward compat)
     */
    private encryptPassword(password: string): string {
        if (!this.credentialStore) {
            // No credential store — backward compatibility passthrough
            return password;
        }

        if (!this.credentialStore.isAvailable()) {
            // Credential store exists but unavailable — don't persist password
            console.warn(`${LOG_PREFIX} Credential store unavailable, password will not be persisted`);
            return '';
        }

        if (!password) {
            // Empty password — nothing to encrypt
            return '';
        }

        return this.credentialStore.encrypt(password);
    }

    /**
     * Validate a server configuration
     * @param config - Configuration to validate
     * @throws Error with descriptive message if invalid
     */
    private validateConfig(config: ServerConfig): void {
        // Check required fields
        for (const field of REQUIRED_FIELDS) {
            const value = config[field];
            if (value === undefined || value === null || value === '') {
                throw new Error(`Server configuration field "${field}" is required`);
            }
        }

        // Validate name is non-empty after trimming
        if (typeof config.name !== 'string' || config.name.trim().length === 0) {
            throw new Error('Server name cannot be empty');
        }

        // Validate hostname
        if (typeof config.hostname !== 'string' || config.hostname.trim().length === 0) {
            throw new Error('Server hostname cannot be empty');
        }

        // Validate port
        if (typeof config.port !== 'number' || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
            throw new Error('Server port must be an integer between 1 and 65535');
        }

        // Validate username
        if (typeof config.username !== 'string' || config.username.trim().length === 0) {
            throw new Error('Server username cannot be empty');
        }

        // Validate ssl is boolean
        if (typeof config.ssl !== 'boolean') {
            throw new Error('Server ssl must be a boolean');
        }
    }

    /**
     * Load server store from disk
     * Creates the store with defaults if file does not exist or is invalid
     */
    private loadFromDisk(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(data) as ServerStore;

                if (parsed && typeof parsed.version === 'number' && Array.isArray(parsed.servers)) {
                    this.store = parsed;
                    console.log(`${LOG_PREFIX} Loaded ${this.store.servers.length} servers from ${this.configPath}`);
                } else {
                    console.warn(`${LOG_PREFIX} Invalid store format, using empty store`);
                    this.store = { version: STORE_VERSION, servers: [] };
                }
            }
        } catch (error) {
            console.warn(`${LOG_PREFIX} Failed to load config from ${this.configPath}: ${error}`);
            this.store = { version: STORE_VERSION, servers: [] };
        }
    }

    /**
     * Save server store to disk
     * Creates the config directory if it does not exist
     */
    private saveToDisk(): void {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.store, null, 2), {
                encoding: 'utf-8',
                mode: 0o600, // Owner read/write only - file contains credentials
            });
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to save config to ${this.configPath}: ${error}`);
            throw new Error(`Failed to save server configuration: ${error}`);
        }
    }
}
