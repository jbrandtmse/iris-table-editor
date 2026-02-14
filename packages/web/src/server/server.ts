import express from 'express';
import { createServer } from 'http';
import * as path from 'path';

const LOG_PREFIX = '[IRIS-TE]';

const app = express();
const server = createServer(app);

// Body parser
app.use(express.json({ limit: '10mb' }));

// Serve static files from public directory
const publicDir = path.join(__dirname, '..', '..', 'public');
app.use(express.static(publicDir));

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// SPA fallback: serve index.html for non-API routes
app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: publicDir }, (err) => {
        if (err && !res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});

const PORT = parseInt(process.env.PORT || '3000', 10);

function startServer(port: number = PORT): Promise<typeof server> {
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

export { app, server, startServer };
