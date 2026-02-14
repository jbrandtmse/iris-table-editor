/**
 * WebSocket server for IMessageBridge communication
 * Story 15.3: WebSocket Server - Tasks 1-5
 *
 * Attaches a WebSocket server to the existing HTTP server from Story 15.1.
 * Validates session tokens during the upgrade handshake.
 * Routes commands to @iris-te/core services via commandHandler.
 *
 * Security:
 * - WebSocket connections require a valid session token (cookie or query param)
 * - Invalid sessions are rejected with close code 4001 (Unauthorized)
 * - Expired sessions trigger close code 4002 (Session Expired)
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import { SessionManager, SESSION_COOKIE_NAME } from './sessionManager';
import type { SessionData } from './sessionManager';
import { handleCommand, createDefaultServiceFactory } from './commandHandler';
import type { ConnectionContext, ServiceFactory } from './commandHandler';

const LOG_PREFIX = '[IRIS-TE WS]';

/**
 * Custom WebSocket close codes
 */
export const WS_CLOSE_UNAUTHORIZED = 4001;
export const WS_CLOSE_SESSION_EXPIRED = 4002;

/**
 * Options for setting up the WebSocket server
 */
export interface SetupWebSocketOptions {
    /** Custom service factory for testing (injects mock services) */
    serviceFactory?: ServiceFactory;
}

/**
 * Tracks WebSocket connections by session token.
 * When a session is destroyed, all associated connections are notified.
 */
type ConnectionEntry = {
    ws: WebSocket;
    context: ConnectionContext;
    services: ReturnType<ServiceFactory['createServices']>;
};

/**
 * Result of setupWebSocket, returned for testing and cleanup.
 */
export interface WebSocketServerHandle {
    /** The underlying WebSocketServer instance */
    wss: WebSocketServer;
    /** Notify connections that a session has expired (called by SessionManager) */
    notifySessionExpired(token: string): void;
    /** Get count of active connections (for testing/monitoring) */
    getConnectionCount(): number;
}

/**
 * Extract session token from WebSocket upgrade request.
 * Checks cookies first, then query parameter `?token=`.
 */
function extractTokenFromUpgrade(req: IncomingMessage): string | null {
    // Check cookie
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = cookieHeader.split(';');
        for (const cookie of cookies) {
            const [name, ...valueParts] = cookie.trim().split('=');
            if (name === SESSION_COOKIE_NAME) {
                return valueParts.join('=');
            }
        }
    }

    // Check query parameter ?token=
    const url = req.url || '';
    const queryStart = url.indexOf('?');
    if (queryStart !== -1) {
        const params = new URLSearchParams(url.slice(queryStart));
        const token = params.get('token');
        if (token) {
            return token;
        }
    }

    return null;
}

/**
 * Validate session from a WebSocket upgrade request.
 * Returns session data and token if valid, null otherwise.
 */
function validateFromUpgrade(
    req: IncomingMessage,
    sessionManager: SessionManager
): { token: string; session: SessionData } | null {
    const token = extractTokenFromUpgrade(req);
    if (!token) {
        return null;
    }

    // Use SessionManager's internal session lookup by creating a minimal
    // Express-like request with the token in a cookie header
    const fakeReq = {
        headers: {
            cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
    } as import('express').Request;

    const session = sessionManager.validate(fakeReq);
    if (!session) {
        return null;
    }

    return { token, session };
}

/**
 * Set up the WebSocket server, attached to the existing HTTP server.
 *
 * @param server - HTTP server from Story 15.1
 * @param sessionManager - SessionManager for session validation
 * @param options - Optional configuration (e.g., custom service factory)
 * @returns WebSocketServerHandle for testing and session expiry notifications
 */
export function setupWebSocket(
    server: HttpServer,
    sessionManager: SessionManager,
    options?: SetupWebSocketOptions
): WebSocketServerHandle {
    const factory = options?.serviceFactory ?? createDefaultServiceFactory();

    // Track connections by session token (one token may have multiple connections)
    const connectionsByToken = new Map<string, Set<ConnectionEntry>>();

    // Create WebSocketServer that handles upgrade manually (noServer mode)
    // maxPayload limits incoming message size to 1MB to prevent abuse
    const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

    // Handle HTTP upgrade requests
    server.on('upgrade', (req: IncomingMessage, socket, head) => {
        const validated = validateFromUpgrade(req, sessionManager);

        if (!validated) {
            console.log(`${LOG_PREFIX} WebSocket upgrade rejected: unauthorized`);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req, validated.token, validated.session);
        });
    });

    // Handle new WebSocket connections
    wss.on('connection', (
        ws: WebSocket,
        _req: IncomingMessage,
        token: string,
        session: SessionData
    ) => {
        console.log(`${LOG_PREFIX} WebSocket connected for ${session.username}@${session.host}:${session.port}`);

        // Create per-connection state
        const context: ConnectionContext = {
            namespace: null,
            tableName: null,
            schema: null,
        };
        const services = factory.createServices();

        const entry: ConnectionEntry = { ws, context, services };

        // Track by session token
        if (!connectionsByToken.has(token)) {
            connectionsByToken.set(token, new Set());
        }
        connectionsByToken.get(token)!.add(entry);

        // Handle incoming messages
        ws.on('message', async (data: Buffer | string) => {
            // Update session activity on every WebSocket message (Story 15.5, Task 3.2)
            sessionManager.touchSession(token);

            let command: string;
            let payload: unknown;

            try {
                const message = JSON.parse(data.toString());
                command = message.command;
                payload = message.payload;

                if (typeof command !== 'string') {
                    ws.send(JSON.stringify({
                        event: 'error',
                        payload: {
                            message: 'Invalid message: "command" must be a string',
                            code: 'INVALID_MESSAGE',
                            recoverable: true,
                            context: 'wsServer',
                        },
                    }));
                    return;
                }
            } catch {
                // Malformed JSON
                ws.send(JSON.stringify({
                    event: 'error',
                    payload: {
                        message: 'Invalid JSON message',
                        code: 'INVALID_JSON',
                        recoverable: true,
                        context: 'wsServer',
                    },
                }));
                return;
            }

            try {
                const result = await handleCommand(command, payload, session, context, services);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(result));
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`${LOG_PREFIX} Error handling command "${command}": ${errorMessage}`);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        event: 'error',
                        payload: {
                            message: errorMessage,
                            code: 'COMMAND_ERROR',
                            recoverable: true,
                            context: command,
                        },
                    }));
                }
            }
        });

        // Handle connection close
        ws.on('close', () => {
            console.log(`${LOG_PREFIX} WebSocket disconnected`);
            const entries = connectionsByToken.get(token);
            if (entries) {
                entries.delete(entry);
                if (entries.size === 0) {
                    connectionsByToken.delete(token);
                }
            }
        });

        // Handle connection error
        ws.on('error', (err) => {
            console.error(`${LOG_PREFIX} WebSocket error: ${err.message}`);
            const entries = connectionsByToken.get(token);
            if (entries) {
                entries.delete(entry);
                if (entries.size === 0) {
                    connectionsByToken.delete(token);
                }
            }
        });
    });

    /**
     * Notify all WebSocket connections for a given session token that the session expired.
     * Sends a sessionExpired event and closes with code 4002.
     */
    function notifySessionExpired(expiredToken: string): void {
        const entries = connectionsByToken.get(expiredToken);
        if (!entries) {
            return;
        }

        console.log(`${LOG_PREFIX} Notifying ${entries.size} connection(s) of session expiry`);

        for (const entry of entries) {
            try {
                entry.ws.send(JSON.stringify({
                    event: 'sessionExpired',
                    payload: {},
                }));
                entry.ws.close(WS_CLOSE_SESSION_EXPIRED, 'Session Expired');
            } catch {
                // Connection may already be closed
            }
        }

        connectionsByToken.delete(expiredToken);
    }

    /**
     * Get the total number of active WebSocket connections.
     */
    function getConnectionCount(): number {
        let count = 0;
        for (const entries of connectionsByToken.values()) {
            count += entries.size;
        }
        return count;
    }

    console.log(`${LOG_PREFIX} WebSocket server initialized`);

    return { wss, notifySessionExpired, getConnectionCount };
}
