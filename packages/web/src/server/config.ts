/**
 * Centralized Environment Configuration
 * Story 18.2: Environment Configuration - Task 1
 *
 * Single source of truth for all environment variables.
 * Reads, parses, and validates configuration at startup.
 *
 * Environment variables:
 * - PORT: Server port (default: 3000)
 * - NODE_ENV: Environment mode (default: "development")
 * - ALLOWED_ORIGINS: Comma-separated CORS origins (default: none)
 * - SESSION_SECRET: Secret for cookie signing (required in production)
 * - CSRF_SECRET: Secret for CSRF tokens (falls back to SESSION_SECRET)
 * - SESSION_TIMEOUT: Session timeout in seconds (default: 1800)
 * - RATE_LIMIT_MAX: Max requests per minute (default: 100)
 * - TLS_CERT: Path to TLS certificate (optional)
 * - TLS_KEY: Path to TLS private key (optional)
 */
import * as crypto from 'crypto';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Fallback random secret, generated once per process lifetime.
 * Used when SESSION_SECRET is not set in the environment.
 */
const fallbackSecret = crypto.randomBytes(32).toString('hex');

export interface AppConfig {
    port: number;
    nodeEnv: string;
    allowedOrigins: string[] | undefined;
    sessionSecret: string;
    /** Whether SESSION_SECRET was explicitly set via environment variable */
    sessionSecretExplicit: boolean;
    csrfSecret: string;
    sessionTimeout: number;
    rateLimitMax: number;
    tlsCert: string | undefined;
    tlsKey: string | undefined;
}

/**
 * Parse a comma-separated string into a trimmed, non-empty string array.
 * Returns undefined if the input is empty/undefined.
 */
function parseCommaSeparated(value: string | undefined): string[] | undefined {
    if (!value) {
        return undefined;
    }
    const items = value.split(',').map((s) => s.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
}

/**
 * Parse a string as a positive integer, returning the default if invalid, missing, or <= 0.
 */
function parseIntWithDefault(value: string | undefined, defaultValue: number): number {
    if (!value) {
        return defaultValue;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
}

/**
 * Build config from current process.env values.
 * Re-reads env vars on each call so tests can set env vars before creating servers.
 */
function loadConfig(): AppConfig {
    const sessionSecretExplicit = !!process.env.SESSION_SECRET;
    const sessionSecret = process.env.SESSION_SECRET || fallbackSecret;
    const csrfSecret = process.env.CSRF_SECRET || sessionSecret;

    return {
        port: parseIntWithDefault(process.env.PORT, 3000),
        nodeEnv: process.env.NODE_ENV || 'development',
        allowedOrigins: parseCommaSeparated(process.env.ALLOWED_ORIGINS),
        sessionSecret,
        sessionSecretExplicit,
        csrfSecret,
        sessionTimeout: parseIntWithDefault(process.env.SESSION_TIMEOUT, 1800),
        rateLimitMax: parseIntWithDefault(process.env.RATE_LIMIT_MAX, 100),
        tlsCert: process.env.TLS_CERT || undefined,
        tlsKey: process.env.TLS_KEY || undefined,
    };
}

/**
 * Get the current application config by reading process.env.
 * Each call reads fresh values, so env var changes (e.g., in tests) are reflected.
 */
export function getConfig(): AppConfig {
    return loadConfig();
}

/**
 * Validate config for production readiness.
 * - In production: SESSION_SECRET must be explicitly set (not random).
 * - TLS: both TLS_CERT and TLS_KEY must be provided, or neither.
 *
 * Logs errors and calls process.exit(1) in production.
 * Logs warnings in development.
 *
 * @returns true if validation passed, false if it would have failed
 *          (only returns false in dev; in prod it exits)
 */
export function validateConfig(config: AppConfig): boolean {
    const isProduction = config.nodeEnv === 'production';
    let valid = true;

    // SESSION_SECRET must be explicitly set in production
    if (!config.sessionSecretExplicit) {
        if (isProduction) {
            console.error(`${LOG_PREFIX} ERROR: SESSION_SECRET must be set in production. Exiting.`);
            process.exit(1);
        } else {
            console.warn(`${LOG_PREFIX} WARNING: SESSION_SECRET is not set. Using a random secret that changes on restart.`);
            valid = false;
        }
    }

    // TLS: both or neither
    const hasCert = !!config.tlsCert;
    const hasKey = !!config.tlsKey;
    if (hasCert !== hasKey) {
        const missing = hasCert ? 'TLS_KEY' : 'TLS_CERT';
        if (isProduction) {
            console.error(`${LOG_PREFIX} ERROR: ${missing} is required when ${hasCert ? 'TLS_CERT' : 'TLS_KEY'} is set. Exiting.`);
            process.exit(1);
        } else {
            console.warn(`${LOG_PREFIX} WARNING: ${missing} is required when ${hasCert ? 'TLS_CERT' : 'TLS_KEY'} is set. TLS disabled.`);
            valid = false;
        }
    }

    return valid;
}

/**
 * Log startup configuration (without exposing secrets).
 */
export function logStartupConfig(config: AppConfig): void {
    console.log(`${LOG_PREFIX} Configuration:`);
    console.log(`${LOG_PREFIX}   PORT=${config.port}`);
    console.log(`${LOG_PREFIX}   NODE_ENV=${config.nodeEnv}`);
    console.log(`${LOG_PREFIX}   SESSION_SECRET=${config.sessionSecretExplicit ? '(set)' : '(not set, using random)'}`);
    console.log(`${LOG_PREFIX}   ALLOWED_ORIGINS=${config.allowedOrigins ? config.allowedOrigins.join(', ') : '(not set, same-origin only)'}`);
    console.log(`${LOG_PREFIX}   SESSION_TIMEOUT=${config.sessionTimeout}s`);
    console.log(`${LOG_PREFIX}   RATE_LIMIT_MAX=${config.rateLimitMax} req/min`);
    console.log(`${LOG_PREFIX}   TLS=${config.tlsCert && config.tlsKey ? 'enabled' : 'disabled'}`);
}
