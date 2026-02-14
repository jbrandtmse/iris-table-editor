/**
 * SessionManager - In-memory session store for web application
 * Story 15.2: Atelier API Proxy - Task 2
 *
 * Manages authenticated sessions between the browser and IRIS servers.
 * Sessions are stored in memory and persist until disconnect or server restart.
 * Session tokens are cryptographically random for security.
 *
 * Security: Credentials are held in memory only during active sessions.
 * destroySession() removes all references including passwords.
 */
import * as crypto from 'crypto';
import type { Request } from 'express';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Cookie name used for session token delivery
 */
export const SESSION_COOKIE_NAME = 'iris_session';

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
}

/**
 * Manages authenticated sessions using an in-memory Map.
 * Tokens are delivered via HTTP-only cookies.
 */
export class SessionManager {
    private sessions: Map<string, SessionData> = new Map();

    /**
     * Validate a request's session token from cookie or header.
     * @param req - Express request object
     * @returns SessionData if valid, null if invalid or missing
     */
    validate(req: Request): SessionData | null {
        const token = this.extractToken(req);
        if (!token) {
            return null;
        }

        const session = this.sessions.get(token);
        if (!session) {
            return null;
        }

        return session;
    }

    /**
     * Create a new session with the given connection details.
     * Generates a cryptographically random session token.
     * @param details - IRIS connection details
     * @returns Session token string
     */
    createSession(details: ConnectionDetails): string {
        const token = crypto.randomUUID();

        const sessionData: SessionData = {
            host: details.host,
            port: details.port,
            namespace: details.namespace,
            username: details.username,
            password: details.password,
            pathPrefix: details.pathPrefix || '',
            useHTTPS: details.useHTTPS || false,
            createdAt: Date.now(),
        };

        this.sessions.set(token, sessionData);
        console.log(`${LOG_PREFIX} Session created for ${details.username}@${details.host}:${details.port}`);

        return token;
    }

    /**
     * Destroy a session by token, clearing all stored data.
     * @param token - Session token to destroy
     * @returns true if session existed and was destroyed, false if not found
     */
    destroySession(token: string): boolean {
        const existed = this.sessions.delete(token);
        if (existed) {
            console.log(`${LOG_PREFIX} Session destroyed`);
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
