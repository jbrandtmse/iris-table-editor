/**
 * API Proxy - Routes browser requests to IRIS Atelier API
 * Story 15.2: Atelier API Proxy - Tasks 1, 3, 4
 *
 * The browser never communicates directly with IRIS. All requests go through
 * this proxy which validates the session, injects auth headers, and forwards
 * the request to the target IRIS server.
 *
 * Security:
 * - IRIS server details (host, port) are never leaked in error responses
 * - Credentials are injected from the session store, never from the browser
 * - Session tokens are delivered via HTTP-only cookies
 */
import type { Express, Request, Response } from 'express';
import { UrlBuilder, ErrorCodes } from '@iris-te/core';
import type { IServerSpec } from '@iris-te/core';
import { SessionManager, SESSION_COOKIE_NAME } from './sessionManager';
import type { ConnectionDetails, SessionData } from './sessionManager';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Default timeout for proxied IRIS requests (30 seconds)
 */
const DEFAULT_PROXY_TIMEOUT = 30000;

/**
 * Read proxy timeout from environment or use default
 */
function getProxyTimeout(): number {
    const envTimeout = process.env.IRIS_PROXY_TIMEOUT;
    if (envTimeout) {
        const parsed = parseInt(envTimeout, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return DEFAULT_PROXY_TIMEOUT;
}

/**
 * Build IServerSpec from session data for UrlBuilder
 */
function buildServerSpec(session: SessionData): IServerSpec {
    return {
        name: 'proxy-target',
        scheme: session.useHTTPS ? 'https' : 'http',
        host: session.host,
        port: session.port,
        pathPrefix: session.pathPrefix || '',
    };
}

/**
 * Build Basic Auth header value from session credentials
 */
function buildAuthHeader(session: SessionData): string {
    return `Basic ${Buffer.from(`${session.username}:${session.password}`).toString('base64')}`;
}

/**
 * Set session cookie on response.
 * Includes Secure flag in production (Story 15.4, Task 4.3).
 */
function setSessionCookie(res: Response, token: string): void {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie',
        `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/${secure}`
    );
}

/**
 * Clear session cookie on response
 */
function clearSessionCookie(res: Response): void {
    res.setHeader('Set-Cookie',
        `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
    );
}

/**
 * Classify a fetch error into an appropriate HTTP status and user-friendly message.
 * Never leaks internal IRIS server details (AC: 4.5).
 */
function classifyProxyError(error: unknown): { status: number; message: string; code: string } {
    if (error instanceof Error) {
        // Timeout (AbortError from our timeout controller)
        if (error.name === 'AbortError') {
            return {
                status: 504,
                message: 'The database server did not respond in time. Please try again.',
                code: ErrorCodes.CONNECTION_TIMEOUT,
            };
        }

        // Network errors - ECONNREFUSED, ENOTFOUND, etc.
        const cause = (error as NodeJS.ErrnoException).cause as NodeJS.ErrnoException | undefined;
        const errorCode = cause?.code || (error as NodeJS.ErrnoException).code || '';
        if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' ||
            errorCode === 'ECONNRESET' || errorCode === 'EHOSTUNREACH') {
            return {
                status: 502,
                message: 'Cannot reach the database server. Please check that IRIS is running.',
                code: ErrorCodes.SERVER_UNREACHABLE,
            };
        }

        // TypeError from fetch usually means network issue
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return {
                status: 502,
                message: 'Cannot reach the database server. Please check that IRIS is running.',
                code: ErrorCodes.SERVER_UNREACHABLE,
            };
        }
    }

    // Unknown error - generic message, no internal details
    return {
        status: 502,
        message: 'An error occurred while communicating with the database server.',
        code: ErrorCodes.CONNECTION_FAILED,
    };
}

/**
 * Options for configuring the API proxy
 */
export interface ApiProxyOptions {
    /** Custom fetch function for IRIS requests (defaults to globalThis.fetch). Used for testing. */
    fetchFn?: typeof globalThis.fetch;
}

/**
 * Set up all API proxy routes on the Express app.
 * Must be called BEFORE the SPA catch-all route.
 *
 * Routes:
 * - POST /api/iris/query - Proxy SQL queries to IRIS
 * - POST /api/connect - Establish a session
 * - POST /api/disconnect - Destroy a session
 * - GET  /api/session - Check session status
 */
export function setupApiProxy(app: Express, sessionManager: SessionManager, options?: ApiProxyOptions): void {
    const timeout = getProxyTimeout();
    // Use injected fetch or global fetch. Wrapped in a getter so tests can swap it.
    const irisFetch = options?.fetchFn ?? ((...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args));

    // ============================================
    // POST /api/iris/query - Proxy query to IRIS (Task 1)
    // ============================================
    app.post('/api/iris/query', async (req: Request, res: Response) => {
        // Validate session (AC: 4)
        const session = sessionManager.validate(req);
        if (!session) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { query, parameters } = req.body;
        if (!query || typeof query !== 'string') {
            res.status(400).json({ error: 'Missing or invalid "query" field' });
            return;
        }

        // Build Atelier API URL using UrlBuilder from @iris-te/core (Task 1.3)
        const spec = buildServerSpec(session);
        const baseUrl = UrlBuilder.buildBaseUrl(spec);
        const irisUrl = UrlBuilder.buildQueryUrl(baseUrl, session.namespace);

        // Build auth header (Task 1.4)
        const authHeader = buildAuthHeader(session);

        // Forward request with timeout (Task 1.5, 1.6)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const irisResponse = await irisFetch(irisUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                },
                body: JSON.stringify({ query, parameters: parameters || [] }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Handle IRIS auth failure (Task 4.3)
            if (irisResponse.status === 401 || irisResponse.status === 403) {
                res.status(401).json({
                    error: 'IRIS authentication failed',
                    code: ErrorCodes.AUTH_FAILED,
                });
                return;
            }

            // Return IRIS response to browser (AC: 3)
            const data = await irisResponse.json();
            res.status(irisResponse.status).json(data);

        } catch (error) {
            clearTimeout(timeoutId);
            const classified = classifyProxyError(error);
            console.error(`${LOG_PREFIX} Proxy error:`, error instanceof Error ? error.message : error);
            res.status(classified.status).json({
                error: classified.message,
                code: classified.code,
            });
        }
    });

    // ============================================
    // POST /api/connect - Establish session (Task 3)
    // ============================================
    app.post('/api/connect', async (req: Request, res: Response) => {
        // HTTPS enforcement: reject non-HTTPS connect requests in production (Story 16.2, Task 1.5)
        // Check req.secure (which respects Express 'trust proxy') and x-forwarded-proto header
        // for deployments behind a reverse proxy (nginx, load balancer, etc.)
        if (process.env.NODE_ENV === 'production') {
            const isSecure = req.secure ||
                req.headers['x-forwarded-proto'] === 'https';
            if (!isSecure) {
                res.status(403).json({
                    error: 'HTTPS is required for credential transmission.',
                    code: ErrorCodes.AUTH_FAILED,
                });
                return;
            }
        }

        const { host, port, namespace, username, password, pathPrefix, useHTTPS } = req.body as Partial<ConnectionDetails>;

        // Validate required fields
        if (!host || !port || !namespace || !username || !password) {
            res.status(400).json({ error: 'Missing required connection fields: host, port, namespace, username, password' });
            return;
        }

        // Build spec for test connection (Task 3.2)
        const spec: IServerSpec = {
            name: 'test-connection',
            scheme: useHTTPS ? 'https' : 'http',
            host,
            port,
            pathPrefix: pathPrefix || '',
        };

        // Test connection to IRIS before creating session
        const testUrl = UrlBuilder.buildBaseUrl(spec);
        const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const testResponse = await irisFetch(testUrl, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (testResponse.status === 401 || testResponse.status === 403) {
                res.status(401).json({
                    error: 'IRIS authentication failed. Check username and password.',
                    code: ErrorCodes.AUTH_FAILED,
                });
                return;
            }

            if (!testResponse.ok) {
                res.status(502).json({
                    error: 'Failed to connect to IRIS server.',
                    code: ErrorCodes.CONNECTION_FAILED,
                });
                return;
            }

            // Connection successful - create session (Task 3.3)
            const token = sessionManager.createSession({
                host, port, namespace, username, password,
                pathPrefix, useHTTPS,
            });

            setSessionCookie(res, token);
            res.json({ status: 'connected' });

        } catch (error) {
            clearTimeout(timeoutId);
            const classified = classifyProxyError(error);
            console.error(`${LOG_PREFIX} Connect error:`, error instanceof Error ? error.message : error);
            res.status(classified.status).json({
                error: classified.message,
                code: classified.code,
            });
        }
    });

    // ============================================
    // POST /api/disconnect - Destroy session (Task 3.4)
    // ============================================
    app.post('/api/disconnect', (req: Request, res: Response) => {
        // Extract token and destroy session if it exists
        const token = sessionManager.extractToken(req);
        if (token) {
            sessionManager.destroySession(token);
        }

        clearSessionCookie(res);
        res.json({ status: 'disconnected' });
    });

    // ============================================
    // GET /api/session - Session status (Task 3.5, Story 15.5 Task 6)
    // ============================================
    app.get('/api/session', (req: Request, res: Response) => {
        const session = sessionManager.validate(req);
        if (!session) {
            res.json({ status: 'disconnected' });
            return;
        }

        // Calculate timeout remaining (Story 15.5, Task 6)
        const timeoutMs = sessionManager.getSessionTimeoutMs();
        const elapsed = Date.now() - session.lastActivity;
        const timeoutRemaining = Math.max(0, timeoutMs - elapsed);

        // Return session info without password or internal server details (AC: security)
        res.json({
            status: 'connected',
            server: {
                namespace: session.namespace,
                username: session.username,
            },
            createdAt: session.createdAt,
            timeoutRemaining,
        });
    });
}
