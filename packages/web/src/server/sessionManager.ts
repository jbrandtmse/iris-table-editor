/**
 * SessionManager - In-memory session store for web application
 * Story 15.2: Atelier API Proxy - Task 2
 * Story 15.5: Session Management - Tasks 1-3
 *
 * Manages authenticated sessions between the browser and IRIS servers.
 * Sessions are stored in memory and persist until disconnect, expiry, or server restart.
 * Session tokens are cryptographically random for security.
 *
 * Security: Credentials are held in memory only during active sessions.
 * destroySession() removes all references including passwords.
 *
 * Session timeout: Configurable via SESSION_TIMEOUT env var (seconds).
 * Default: 1800 (30 minutes). Sliding window: lastActivity resets on each request.
 */
import * as crypto from 'crypto';
import type { Request } from 'express';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Cookie name used for session token delivery
 */
export const SESSION_COOKIE_NAME = 'iris_session';

/**
 * Default session timeout in milliseconds (30 minutes)
 */
export const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Interval for periodic cleanup of expired sessions (5 minutes)
 */
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Connection details required to establish an IRIS session
 */
export interface ConnectionDetails {
    host: string;
    port: number;
    namespace: string;
    username: string;
    password: string;
    pathPrefix?: string;
    useHTTPS?: boolean;
}

/**
 * Session data stored in memory for each active session
 */
export interface SessionData {
    host: string;
    port: number;
    namespace: string;
    username: string;
    password: string;
    pathPrefix: string;
    useHTTPS: boolean;
    createdAt: number;
    lastActivity: number;
}

/**
 * Callback invoked when a session expires (for WebSocket notification).
 */
export type SessionExpiredCallback = (token: string) => void;

/**
 * Options for constructing a SessionManager.
 */
export interface SessionManagerOptions {
    /** Session timeout in milliseconds. Defaults to SESSION_TIMEOUT env var or 30 minutes. */
    sessionTimeoutMs?: number;
    /** Cleanup interval in milliseconds. Defaults to 5 minutes. Set to 0 to disable. */
    cleanupIntervalMs?: number;
    /** Callback invoked when a session expires during validation or cleanup. */
    onSessionExpired?: SessionExpiredCallback;
}

/**
 * Read session timeout from SESSION_TIMEOUT env var (in seconds) or use default.
 */
function getSessionTimeoutMs(): number {
    const envVal = process.env.SESSION_TIMEOUT;
    if (envVal) {
        const parsed = parseInt(envVal, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed * 1000;
        }
    }
    return DEFAULT_SESSION_TIMEOUT_MS;
}

/**
 * Manages authenticated sessions using an in-memory Map.
 * Tokens are delivered via HTTP-only cookies.
 */
export class SessionManager {
    private sessions: Map<string, SessionData> = new Map();
    private readonly sessionTimeoutMs: number;
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;
    private onSessionExpired: SessionExpiredCallback | null;

    constructor(options?: SessionManagerOptions) {
        this.sessionTimeoutMs = options?.sessionTimeoutMs ?? getSessionTimeoutMs();
        this.onSessionExpired = options?.onSessionExpired ?? null;

        const cleanupInterval = options?.cleanupIntervalMs ?? CLEANUP_INTERVAL_MS;
        if (cleanupInterval > 0) {
            this.cleanupTimer = setInterval(() => this.cleanupExpiredSessions(), cleanupInterval);
            // Allow the process to exit even if the timer is running
            if (this.cleanupTimer.unref) {
                this.cleanupTimer.unref();
            }
        }
    }

    /**
     * Get the configured session timeout in milliseconds.
     */
    getSessionTimeoutMs(): number {
        return this.sessionTimeoutMs;
    }

    /**
     * Set the callback for session expiry notifications (e.g., WebSocket).
     */
    setOnSessionExpired(callback: SessionExpiredCallback | null): void {
        this.onSessionExpired = callback;
    }

    /**
     * Validate a request's session token from cookie or header.
     * Returns null if the session has expired (sliding window timeout).
     * Updates lastActivity on successful validation.
     * @param req - Express request object
     * @returns SessionData if valid, null if invalid, missing, or expired
     */
    validate(req: Request): SessionData | null {
        const token = this.extractToken(req);
        if (!token) {
            return null;
        }

        return this.validateToken(token);
    }

    /**
     * Validate a session by token directly (used internally and by activity tracking).
     * Returns null if expired. Updates lastActivity on success.
     */
    validateToken(token: string): SessionData | null {
        const session = this.sessions.get(token);
        if (!session) {
            return null;
        }

        // Check if session has expired
        const now = Date.now();
        if (now - session.lastActivity > this.sessionTimeoutMs) {
            console.log(`${LOG_PREFIX} Session expired for ${session.username}@${session.host}:${session.port}`);
            this.sessions.delete(token);
            if (this.onSessionExpired) {
                this.onSessionExpired(token);
            }
            return null;
        }

        // Sliding window: update last activity
        session.lastActivity = now;
        return session;
    }

    /**
     * Touch a session to update its lastActivity without full validation.
     * Used by WebSocket message handlers to keep the session alive.
     * @param token - Session token to touch
     * @returns true if session exists and was touched, false otherwise
     */
    touchSession(token: string): boolean {
        const session = this.sessions.get(token);
        if (!session) {
            return false;
        }

        const now = Date.now();
        if (now - session.lastActivity > this.sessionTimeoutMs) {
            // Already expired
            this.sessions.delete(token);
            if (this.onSessionExpired) {
                this.onSessionExpired(token);
            }
            return false;
        }

        session.lastActivity = now;
        return true;
    }

    /**
     * Create a new session with the given connection details.
     * Generates a cryptographically random session token.
     * @param details - IRIS connection details
     * @returns Session token string
     */
    createSession(details: ConnectionDetails): string {
        const token = crypto.randomUUID();
        const now = Date.now();

        const sessionData: SessionData = {
            host: details.host,
            port: details.port,
            namespace: details.namespace,
            username: details.username,
            password: details.password,
            pathPrefix: details.pathPrefix || '',
            useHTTPS: details.useHTTPS || false,
            createdAt: now,
            lastActivity: now,
        };

        this.sessions.set(token, sessionData);
        console.log(`${LOG_PREFIX} Session created for ${details.username}@${details.host}:${details.port}`);

        return token;
    }

    /**
     * Destroy a session by token, clearing all stored data.
     * Notifies the onSessionExpired callback so WebSocket connections are closed.
     * @param token - Session token to destroy
     * @returns true if session existed and was destroyed, false if not found
     */
    destroySession(token: string): boolean {
        const existed = this.sessions.delete(token);
        if (existed) {
            console.log(`${LOG_PREFIX} Session destroyed`);
            if (this.onSessionExpired) {
                this.onSessionExpired(token);
            }
        }
        return existed;
    }

    /**
     * Get the number of active sessions (for testing/monitoring).
     */
    getSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * Clean up expired sessions from the store.
     * Called periodically by the cleanup timer.
     * @returns Number of sessions removed
     */
    cleanupExpiredSessions(): number {
        const now = Date.now();
        let removed = 0;

        for (const [token, session] of this.sessions) {
            if (now - session.lastActivity > this.sessionTimeoutMs) {
                console.log(`${LOG_PREFIX} Cleaning up expired session for ${session.username}@${session.host}:${session.port}`);
                this.sessions.delete(token);
                if (this.onSessionExpired) {
                    this.onSessionExpired(token);
                }
                removed++;
            }
        }

        if (removed > 0) {
            console.log(`${LOG_PREFIX} Cleaned up ${removed} expired session(s)`);
        }

        return removed;
    }

    /**
     * Stop the periodic cleanup timer.
     * Call this for clean shutdown in tests or when the server stops.
     */
    clearCleanupInterval(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Extract session token from request cookie or Authorization header.
     * Checks cookie first, then falls back to Bearer token in header.
     */
    extractToken(req: Request): string | null {
        // Check cookie first
        const cookieHeader = req.headers.cookie;
        if (cookieHeader) {
            const token = this.parseCookie(cookieHeader, SESSION_COOKIE_NAME);
            if (token) {
                return token;
            }
        }

        // Fallback: check Authorization header for Bearer token
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.slice(7);
        }

        return null;
    }

    /**
     * Parse a specific cookie value from the Cookie header string.
     */
    private parseCookie(cookieHeader: string, name: string): string | null {
        const cookies = cookieHeader.split(';');
        for (const cookie of cookies) {
            const [cookieName, ...valueParts] = cookie.trim().split('=');
            if (cookieName === name) {
                return valueParts.join('=');
            }
        }
        return null;
    }
}
