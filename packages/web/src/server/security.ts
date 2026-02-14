/**
 * Security Middleware - OWASP best-practice protections
 * Story 15.4: Security Middleware - Tasks 2-4
 *
 * Configures helmet (security headers), CORS, CSRF (double-submit cookie),
 * and rate limiting. Must be applied BEFORE route handlers.
 *
 * Environment variables:
 * - SESSION_SECRET: secret for cookie signing and CSRF tokens (recommended for production)
 * - ALLOWED_ORIGINS: comma-separated list of allowed CORS origins
 * - RATE_LIMIT_MAX: max requests per minute window (default: 100)
 * - CSRF_SECRET: secret for CSRF token signing (falls back to SESSION_SECRET, then auto-generated)
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { ServerResponse } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import { doubleCsrf } from 'csrf-csrf';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { getConfig } from './config';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Paths exempt from CSRF validation.
 * - /api/connect: first request before client has a CSRF cookie
 * - /api/test-connection: stateless pre-auth probe (Story 16.3)
 * - /health: read-only health check
 */
const CSRF_EXEMPT_PATHS = ['/api/connect', '/api/test-connection', '/health'];

/**
 * HTTP methods that are "safe" (read-only) and skip CSRF checks.
 */
const CSRF_SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Result of setupSecurity — exposes the CSRF token generator so the
 * server can wire the GET /api/csrf-token endpoint.
 */
export interface SecurityHandle {
    generateCsrfToken: (req: Request, res: Response) => string;
}

/**
 * Options for configuring security middleware (primarily for testing).
 */
export interface SecurityOptions {
    /** Override the CSRF secret (for deterministic testing) */
    csrfSecret?: string;
}

/**
 * Apply all security middleware to the Express app.
 * Ordering: helmet -> CORS -> cookie-parser -> CSRF -> rate-limit
 *
 * @param app - Express application
 * @param options - Optional overrides (mainly for testing)
 * @returns SecurityHandle with CSRF token generator
 */
export function setupSecurity(app: Express, options?: SecurityOptions): SecurityHandle {
    const cfg = getConfig();
    const allowedOrigins = cfg.allowedOrigins;

    // --- HTTPS redirect (before other middleware) ---
    if (cfg.forceHttps) {
        app.use((req: Request, res: Response, next: NextFunction) => {
            if (req.path === '/health') { next(); return; }
            if (!req.secure) {
                res.redirect(301, `https://${req.headers.host}${req.url}`);
                return;
            }
            next();
        });
    }

    // --- Helmet: security headers ---
    // CSP connect-src needs ws:/wss: for WebSocket, but scheme-only wildcards
    // (ws:, wss:) allow connections to ANY host. Instead, dynamically derive
    // the WebSocket origin from the request Host header so connections are
    // restricted to same-origin only.
    app.use((_req: Request, res: Response, next: NextFunction) => {
        const host = _req.headers.host || 'localhost';
        const isSecure = _req.secure || _req.headers['x-forwarded-proto'] === 'https';
        res.locals.wsOrigin = `${isSecure ? 'wss' : 'ws'}://${host}`;
        next();
    });

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
                connectSrc: ["'self'", (_req, res: ServerResponse) => (res as unknown as Response).locals.wsOrigin as string],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
            },
        },
    }));

    // --- CORS ---
    if (allowedOrigins) {
        app.use(cors({
            origin: allowedOrigins,
            credentials: true,
        }));
        console.log(`${LOG_PREFIX} CORS configured for origins: ${allowedOrigins.join(', ')}`);
    }
    // When ALLOWED_ORIGINS is not set, no CORS headers are added (same-origin behavior).

    // --- Cookie parser (required for csrf-csrf to read cookies) ---
    app.use(cookieParser());

    // --- CSRF (double-submit cookie via csrf-csrf) ---
    const csrfSecret = options?.csrfSecret || cfg.csrfSecret;

    const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
        getSecret: () => csrfSecret,
        getSessionIdentifier: (req: Request) => {
            // Use our session cookie as identifier; fallback uses IP to avoid
            // shared identifiers across different unauthenticated users
            return req.cookies?.iris_session || req.ip || 'anonymous';
        },
        cookieName: '__csrf',
        cookieOptions: {
            httpOnly: true,
            sameSite: 'strict',
            secure: cfg.nodeEnv === 'production',
            path: '/',
        },
        getCsrfTokenFromRequest: (req: Request) => {
            return req.headers['x-csrf-token'] as string || '';
        },
    });

    // CSRF protection with exemptions for specific paths and WebSocket upgrades
    app.use((req: Request, res: Response, next: NextFunction) => {
        // Safe methods don't need CSRF
        if (CSRF_SAFE_METHODS.includes(req.method)) {
            next();
            return;
        }

        // Exempt specific paths
        if (CSRF_EXEMPT_PATHS.includes(req.path)) {
            next();
            return;
        }

        // WebSocket upgrade requests are exempt (authenticated via session token)
        if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
            next();
            return;
        }

        // Apply CSRF protection
        doubleCsrfProtection(req, res, next);
    });

    // CSRF error handler — returns JSON instead of Express default HTML
    app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
        if (err.name === 'ForbiddenError' || (err.message && err.message.includes('csrf'))) {
            res.status(403).json({ error: 'Invalid or missing CSRF token' });
            return;
        }
        next(err);
    });

    // --- CSRF token endpoint ---
    app.get('/api/csrf-token', (req: Request, res: Response) => {
        const token = generateCsrfToken(req, res);
        res.json({ csrfToken: token });
    });

    // --- Rate limiting ---
    app.use(rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: cfg.rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later.' },
    }));

    console.log(`${LOG_PREFIX} Security middleware configured (rate limit: ${cfg.rateLimitMax} req/min)`);

    return { generateCsrfToken };
}
