import express from 'express';
import { createServer } from 'http';
import * as https from 'https';
import * as fs from 'fs';
import type { Server } from 'http';
import type { Server as HttpsServer } from 'https';
import * as path from 'path';
import { SessionManager } from './sessionManager';
import { setupApiProxy } from './apiProxy';
import type { ApiProxyOptions } from './apiProxy';
import { setupWebSocket } from './wsServer';
import type { SetupWebSocketOptions, WebSocketServerHandle } from './wsServer';
import { setupSecurity } from './security';
import type { SecurityOptions, SecurityHandle } from './security';
import { getConfig, validateConfig, logStartupConfig as logConfig } from './config';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Options for creating a server instance
 */
export interface CreateServerOptions {
    /** Options passed to setupApiProxy (e.g., custom fetchFn for testing) */
    proxyOptions?: ApiProxyOptions;
    /** Options passed to setupWebSocket (e.g., custom service factory for testing) */
    wsOptions?: SetupWebSocketOptions;
    /** Options passed to setupSecurity (e.g., custom CSRF secret for testing) */
    securityOptions?: SecurityOptions;
    /** Skip security middleware entirely (for legacy tests that don't need it) */
    skipSecurity?: boolean;
    /** Session timeout in milliseconds (overrides SESSION_TIMEOUT env var) */
    sessionTimeoutMs?: number;
    /** Cleanup interval in milliseconds. Set to 0 to disable periodic cleanup. */
    cleanupIntervalMs?: number;
}

/**
 * Create an Express app + HTTP/HTTPS server with all routes configured.
 * Used by tests to create isolated server instances with injected dependencies.
 */
export function createAppServer(options?: CreateServerOptions) {
    const appInstance = express();
    const cfg = getConfig();

    // Trust proxy headers (X-Forwarded-*) for reverse proxy deployments (Story 18.4)
    if (cfg.trustProxy) {
        appInstance.set('trust proxy', 1);
    }

    // Create HTTPS server if TLS is configured, otherwise HTTP
    let httpServer: Server | HttpsServer;
    if (cfg.tlsCert && cfg.tlsKey) {
        const tlsOptions = {
            cert: fs.readFileSync(cfg.tlsCert),
            key: fs.readFileSync(cfg.tlsKey),
        };
        httpServer = https.createServer(tlsOptions, appInstance);
    } else {
        httpServer = createServer(appInstance);
    }
    const sessionMgr = new SessionManager({
        sessionTimeoutMs: options?.sessionTimeoutMs,
        cleanupIntervalMs: options?.cleanupIntervalMs,
    });

    // Security middleware FIRST: helmet -> cors -> csrf -> rate-limit (Story 15.4)
    let securityHandle: SecurityHandle | undefined;
    if (!options?.skipSecurity) {
        securityHandle = setupSecurity(appInstance, options?.securityOptions);
    }

    // Body parser (after security middleware)
    appInstance.use(express.json({ limit: '10mb' }));

    // Serve static files from public directory
    const publicDir = path.join(__dirname, '..', '..', 'public');
    appInstance.use(express.static(publicDir));

    // Serve shared webview assets from @iris-te/webview package (Story 17.1)
    const webviewPkgPath = path.dirname(require.resolve('@iris-te/webview/package.json'));
    const webviewDir = path.join(webviewPkgPath, 'src');
    appInstance.use('/webview', express.static(webviewDir));

    // Health check endpoint
    appInstance.get('/health', (_req, res) => {
        res.json({ status: 'ok' });
    });

    // API proxy routes - BEFORE SPA catch-all (Task 5.1, 5.2)
    setupApiProxy(appInstance, sessionMgr, options?.proxyOptions);

    // SPA fallback: serve index.html for non-API routes
    appInstance.get('*', (_req, res) => {
        res.sendFile('index.html', { root: publicDir }, (err) => {
            if (err && !res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    });

    // WebSocket server - attach to HTTP server (Story 15.3)
    // Cast is safe: ws accepts both http.Server and https.Server
    const wsHandle = setupWebSocket(httpServer as Server, sessionMgr, options?.wsOptions);

    // Wire WebSocket session expiry notification into SessionManager (Story 15.5, Task 2)
    sessionMgr.setOnSessionExpired((token: string) => {
        wsHandle.notifySessionExpired(token);
    });

    return { app: appInstance, server: httpServer, sessionManager: sessionMgr, wsHandle, securityHandle };
}

// Default instance for production use and backward compatibility
const { app, server, sessionManager, wsHandle } = createAppServer();

const appConfig = getConfig();

function startServer(port: number = appConfig.port): Promise<Server> {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => {
            server.removeListener('error', reject);
            const protocol = appConfig.tlsCert && appConfig.tlsKey ? 'https' : 'http';
            console.log(`${LOG_PREFIX} Server running on ${protocol}://localhost:${port}`);
            resolve(server as Server);
        });
    });
}

/**
 * Log startup configuration (without secrets).
 * @deprecated Use logStartupConfig from config.ts instead. Kept for backward compatibility.
 */
function logStartupConfig(_port?: number): void {
    logConfig(getConfig());
}

// Start server when run directly (not imported as module)
if (require.main === module) {
    validateConfig(appConfig);
    logConfig(appConfig);
    startServer().catch((err) => {
        console.error(`${LOG_PREFIX} Failed to start server:`, err);
        process.exit(1);
    });
}

export { app, server, startServer, sessionManager, wsHandle, logStartupConfig };
