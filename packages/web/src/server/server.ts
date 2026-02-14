import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import * as path from 'path';
import { SessionManager } from './sessionManager';
import { setupApiProxy } from './apiProxy';
import type { ApiProxyOptions } from './apiProxy';
import { setupWebSocket } from './wsServer';
import type { SetupWebSocketOptions, WebSocketServerHandle } from './wsServer';
import { setupSecurity } from './security';
import type { SecurityOptions, SecurityHandle } from './security';

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
}

/**
 * Create an Express app + HTTP server with all routes configured.
 * Used by tests to create isolated server instances with injected dependencies.
 */
export function createAppServer(options?: CreateServerOptions) {
    const appInstance = express();
    const httpServer = createServer(appInstance);
    const sessionMgr = new SessionManager();

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
    const wsHandle = setupWebSocket(httpServer, sessionMgr, options?.wsOptions);

    return { app: appInstance, server: httpServer, sessionManager: sessionMgr, wsHandle, securityHandle };
}

// Default instance for production use and backward compatibility
const { app, server, sessionManager, wsHandle } = createAppServer();

const PORT = parseInt(process.env.PORT || '3000', 10);

function startServer(port: number = PORT): Promise<Server> {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => {
            server.removeListener('error', reject);
            console.log(`${LOG_PREFIX} Server running on http://localhost:${port}`);
            resolve(server);
        });
    });
}

// Start server when run directly (not imported as module)
if (require.main === module) {
    startServer().catch((err) => {
        console.error(`${LOG_PREFIX} Failed to start server:`, err);
        process.exit(1);
    });
}

export { app, server, startServer, sessionManager, wsHandle };
