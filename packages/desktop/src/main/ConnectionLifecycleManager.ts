/**
 * ConnectionLifecycleManager - Connection state machine for IRIS servers
 * Story 12.5: Connection Lifecycle
 *
 * Manages connect/disconnect/cancel operations with state tracking.
 * Uses callback-based event emission (wired to Electron IPC in Epic 11).
 * Separate from ConnectionManager (which handles CRUD + persistence).
 */
import { AtelierApiService, ErrorCodes } from '@iris-te/core';
import type { IServerSpec, IDesktopConnectionProgressPayload } from '@iris-te/core';
import type { ConnectionManager, ServerConfig } from './ConnectionManager';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Connection lifecycle states
 */
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Callback type for connection lifecycle events
 */
export type ConnectionLifecycleCallback = (payload: IDesktopConnectionProgressPayload) => void;

/**
 * Map of AtelierApiService error codes to user-friendly messages for connection lifecycle
 * Reuses the same pattern as TEST_CONNECTION_ERROR_MESSAGES from ConnectionManager (Story 12.3)
 */
const CONNECTION_ERROR_MESSAGES: Record<string, string> = {
    [ErrorCodes.SERVER_UNREACHABLE]: 'Could not reach server. Check host and port.',
    [ErrorCodes.AUTH_FAILED]: 'Authentication failed. Check username and password.',
    [ErrorCodes.CONNECTION_TIMEOUT]: 'Connection timed out. Check host and port.',
    [ErrorCodes.CONNECTION_FAILED]: 'Connection failed. Check your settings.',
    [ErrorCodes.CONNECTION_CANCELLED]: 'Connection cancelled.',
};

/**
 * Manages connection lifecycle (connect, disconnect, cancel) for IRIS servers.
 * Maintains current connection state and emits progress events via callback.
 *
 * State machine:
 * idle -> connecting -> connected -> disconnected -> connecting -> ...
 *                    -> error -> disconnected -> ...
 *                    -> cancelled (disconnected) -> ...
 */
export class ConnectionLifecycleManager {
    private readonly connectionManager: ConnectionManager;
    private readonly eventCallback: ConnectionLifecycleCallback;
    private state: ConnectionState = 'idle';
    private connectedServerName: string | null = null;
    private connectingServerName: string | null = null;
    private abortController: AbortController | null = null;

    constructor(connectionManager: ConnectionManager, eventCallback: ConnectionLifecycleCallback) {
        this.connectionManager = connectionManager;
        this.eventCallback = eventCallback;
    }

    /**
     * Get the current connection state
     */
    getState(): ConnectionState {
        return this.state;
    }

    /**
     * Get the name of the currently connected server, or null if not connected
     */
    getConnectedServer(): string | null {
        return this.connectedServerName;
    }

    /**
     * Whether a connection attempt is currently in progress
     */
    isConnecting(): boolean {
        return this.state === 'connecting';
    }

    /**
     * Connect to a server by name.
     *
     * - If already connected to the same server, this is a no-op.
     * - If already connected to a different server, disconnects first.
     * - If already connecting, cancels the previous connection attempt.
     *
     * @param serverName - Name of the server to connect to
     */
    async connect(serverName: string): Promise<void> {
        // No-op if already connected to this server
        if (this.state === 'connected' && this.connectedServerName === serverName) {
            console.log(`${LOG_PREFIX} Already connected to "${serverName}"`);
            return;
        }

        // Cancel previous connection attempt if currently connecting
        if (this.state === 'connecting') {
            this.cancelConnection();
        }

        // Disconnect from current server if connected to a different one
        if (this.state === 'connected' && this.connectedServerName !== null) {
            this.disconnect();
        }

        // Retrieve server config
        const serverConfig = this.connectionManager.getServer(serverName);
        if (!serverConfig) {
            this.state = 'error';
            this.eventCallback({
                status: 'error',
                serverName,
                message: `Server "${serverName}" not found.`,
            });
            return;
        }

        // Get decrypted password
        const password = this.connectionManager.getDecryptedPassword(serverName);
        if (!password) {
            this.state = 'error';
            this.eventCallback({
                status: 'error',
                serverName,
                message: 'Password not available. Edit the server to set a password.',
            });
            return;
        }

        // Emit connecting state
        this.state = 'connecting';
        this.connectingServerName = serverName;
        this.abortController = new AbortController();

        this.eventCallback({
            status: 'connecting',
            serverName,
        });

        // Build server spec from config
        const spec = this.buildServerSpec(serverConfig);

        // Create AtelierApiService and set timeout
        const api = new AtelierApiService();
        api.setTimeout(10000); // 10 second timeout

        console.log(`${LOG_PREFIX} Connecting to "${serverName}" at ${spec.host}:${spec.port}`);

        try {
            const result = await api.testConnection(spec, serverConfig.username, password, this.abortController.signal);

            // Check if cancelled while awaiting (race condition guard)
            if (this.state !== 'connecting' || this.connectingServerName !== serverName) {
                return;
            }

            if (result.success) {
                this.state = 'connected';
                this.connectedServerName = serverName;
                this.connectingServerName = null;
                this.abortController = null;

                console.log(`${LOG_PREFIX} Connected to "${serverName}"`);

                this.eventCallback({
                    status: 'connected',
                    serverName,
                });
            } else {
                const errorCode = result.error?.code || '';
                const message = CONNECTION_ERROR_MESSAGES[errorCode] || 'Connection failed. Check your settings.';

                // Check if it was a cancellation
                if (errorCode === ErrorCodes.CONNECTION_CANCELLED) {
                    // Already handled by cancelConnection()
                    return;
                }

                this.state = 'error';
                this.connectingServerName = null;
                this.abortController = null;

                console.log(`${LOG_PREFIX} Connection to "${serverName}" failed: ${errorCode}`);

                this.eventCallback({
                    status: 'error',
                    serverName,
                    message,
                });
            }
        } catch (error) {
            // Check if cancelled while awaiting (race condition guard)
            if (this.state !== 'connecting' || this.connectingServerName !== serverName) {
                return;
            }

            this.state = 'error';
            this.connectingServerName = null;
            this.abortController = null;

            const message = error instanceof Error ? error.message : 'Connection failed unexpectedly.';
            console.error(`${LOG_PREFIX} Connection to "${serverName}" threw: ${message}`);

            this.eventCallback({
                status: 'error',
                serverName,
                message: 'Connection failed. Check your settings.',
            });
        }
    }

    /**
     * Disconnect from the currently connected server.
     * Transitions state to 'disconnected' and emits event.
     * No-op if not currently connected or connecting.
     */
    disconnect(): void {
        if (this.state !== 'connected' && this.state !== 'connecting') {
            return;
        }

        const serverName = this.connectedServerName || this.connectingServerName || 'unknown';

        this.state = 'disconnected';
        this.connectedServerName = null;
        this.connectingServerName = null;
        this.abortController = null;

        console.log(`${LOG_PREFIX} Disconnected from "${serverName}"`);

        this.eventCallback({
            status: 'disconnected',
            serverName,
        });
    }

    /**
     * Cancel an in-progress connection attempt.
     * Aborts the AbortController, transitions to 'disconnected', emits 'cancelled'.
     * No-op if not currently connecting.
     */
    cancelConnection(): void {
        if (this.state !== 'connecting') {
            return;
        }

        const serverName = this.connectingServerName || 'unknown';

        // Abort the pending request
        if (this.abortController) {
            this.abortController.abort();
        }

        this.state = 'disconnected';
        this.connectingServerName = null;
        this.abortController = null;

        console.log(`${LOG_PREFIX} Connection to "${serverName}" cancelled`);

        this.eventCallback({
            status: 'cancelled',
            serverName,
        });
    }

    /**
     * Build an IServerSpec from a ServerConfig for use with AtelierApiService
     */
    private buildServerSpec(config: ServerConfig): IServerSpec {
        return {
            name: config.name,
            scheme: config.ssl ? 'https' : 'http',
            host: config.hostname,
            port: config.port,
            pathPrefix: config.pathPrefix || '',
            username: config.username,
        };
    }
}
