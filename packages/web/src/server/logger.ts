/**
 * Structured Logger - JSON in production, human-readable in development
 * Story 18.5: Monitoring & Logging - Task 2
 *
 * Provides structured logging with sensitive field sanitization.
 * No external dependencies — wraps Node.js console methods.
 *
 * Production (NODE_ENV=production): JSON to stdout
 *   {"timestamp":"2026-02-14T20:30:00.000Z","level":"info","message":"Request completed","method":"GET"}
 *
 * Development: human-readable with [IRIS-TE] prefix
 *   [IRIS-TE] info: Request completed method=GET
 */

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Fields whose values are replaced with [REDACTED] before logging.
 */
const SENSITIVE_KEYS = ['password', 'secret', 'token', 'cookie', 'authorization', 'credential'];

/**
 * Sanitize metadata by replacing values of sensitive keys with [REDACTED].
 * Checks are case-insensitive substring matches on the key name.
 */
export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = SENSITIVE_KEYS.some((s) => lowerKey.includes(s));
        sanitized[key] = isSensitive ? '[REDACTED]' : value;
    }
    return sanitized;
}

/**
 * Error category types for classifying unhandled errors.
 */
export type ErrorCategory = 'connection' | 'authentication' | 'proxy' | 'internal';

/**
 * Categorize an error by its code or status code.
 */
export function categorizeError(err: Error & { code?: string; statusCode?: number }): ErrorCategory {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        return 'connection';
    }
    if (err.statusCode === 401 || err.statusCode === 403) {
        return 'authentication';
    }
    if (err.statusCode === 502 || err.statusCode === 504) {
        return 'proxy';
    }
    return 'internal';
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Format a log entry for production (JSON) output.
 */
function formatJson(level: LogLevel, message: string, metadata?: Record<string, unknown>): string {
    const entry: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        level,
        message,
    };
    if (metadata) {
        Object.assign(entry, sanitizeMetadata(metadata));
    }
    return JSON.stringify(entry);
}

/**
 * Format a log entry for development (human-readable) output.
 */
function formatDev(level: LogLevel, message: string, metadata?: Record<string, unknown>): string {
    let line = `${LOG_PREFIX} ${level}: ${message}`;
    if (metadata) {
        const sanitized = sanitizeMetadata(metadata);
        const parts = Object.entries(sanitized).map(([k, v]) => `${k}=${v}`);
        if (parts.length > 0) {
            line += ' ' + parts.join(' ');
        }
    }
    return line;
}

/**
 * Structured logger with JSON output in production and human-readable output in development.
 */
export class Logger {
    private isProduction(): boolean {
        return process.env.NODE_ENV === 'production';
    }

    private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
        const formatted = this.isProduction()
            ? formatJson(level, message, metadata)
            : formatDev(level, message, metadata);

        switch (level) {
            case 'error':
                console.error(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            case 'debug':
                console.debug(formatted);
                break;
            default:
                console.log(formatted);
                break;
        }
    }

    info(message: string, metadata?: Record<string, unknown>): void {
        this.log('info', message, metadata);
    }

    warn(message: string, metadata?: Record<string, unknown>): void {
        this.log('warn', message, metadata);
    }

    error(message: string, metadata?: Record<string, unknown>): void {
        this.log('error', message, metadata);
    }

    debug(message: string, metadata?: Record<string, unknown>): void {
        this.log('debug', message, metadata);
    }
}

/** Singleton logger instance */
export const logger = new Logger();
