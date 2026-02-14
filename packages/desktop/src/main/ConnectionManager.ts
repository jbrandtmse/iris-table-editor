/**
 * ConnectionManager - Server CRUD + JSON file persistence
 * Story 12.1: Server List UI
 *
 * Manages server configurations for the desktop application.
 * Uses plain Node.js file I/O for persistence (JSON file store).
 * Story 12.4 will add safeStorage encryption for credentials.
 */
import * as fs from 'fs';
import * as path from 'path';

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
    /** Password stored in plaintext (Story 12.4 adds encryption) */
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
}

const LOG_PREFIX = '[IRIS-TE]';
const STORE_VERSION = 1;
const DEFAULT_CONFIG_FILENAME = 'servers.json';

/**
 * Required fields for server config validation
 */
const REQUIRED_FIELDS: Array<keyof ServerConfig> = ['name', 'hostname', 'port', 'username'];

/**
 * Manages server configurations with JSON file persistence.
 * Provides CRUD operations and validation for server entries.
 */
export class ConnectionManager {
    private readonly configPath: string;
    private store: ServerStore;

    constructor(options: ConnectionManagerOptions) {
        const fileName = options.configFileName || DEFAULT_CONFIG_FILENAME;
        this.configPath = path.join(options.configDir, fileName);
        this.store = { version: STORE_VERSION, servers: [] };
        this.loadFromDisk();
    }

    /**
     * Get all saved servers
     * @returns Array of server configurations (copies to prevent mutation)
     */
    getServers(): ServerConfig[] {
        return this.store.servers.map(s => ({ ...s }));
    }

    /**
     * Get a single server by name
     * @param name - Server name to look up
     * @returns Server configuration or undefined if not found
     */
    getServer(name: string): ServerConfig | undefined {
        const server = this.store.servers.find(s => s.name === name);
        return server ? { ...server } : undefined;
    }

    /**
     * Get the count of saved servers
     * @returns Number of stored servers
     */
    getServerCount(): number {
        return this.store.servers.length;
    }

    /**
     * Save a new server configuration
     * @param config - Server configuration to save
     * @throws Error if validation fails or name already exists
     */
    saveServer(config: ServerConfig): void {
        this.validateConfig(config);

        if (this.store.servers.some(s => s.name === config.name)) {
            throw new Error(`Server with name "${config.name}" already exists`);
        }

        this.store.servers.push({ ...config });
        this.saveToDisk();
        console.log(`${LOG_PREFIX} Server "${config.name}" saved`);
    }

    /**
     * Update an existing server configuration
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

        this.store.servers[index] = { ...config };
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
     * Get the path to the config file (for testing/debugging)
     */
    getConfigPath(): string {
        return this.configPath;
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
