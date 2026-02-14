/**
 * Unit tests for Docker Containerization
 * Story 18.1: Docker Containerization - Task 5
 *
 * Static configuration assertions for Dockerfile, docker-compose.yml, .dockerignore,
 * and environment variable support. These verify that key configuration patterns are
 * present in the files, serving as regression guards against accidental removal.
 * Uses Node.js built-in test runner.
 */
import { describe, it } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// Resolve paths relative to repo root
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const webPkgDir = path.join(repoRoot, 'packages', 'web');

// ============================================
// Dockerfile Tests
// ============================================

describe('Dockerfile', () => {
    const dockerfilePath = path.join(webPkgDir, 'Dockerfile');

    it('should exist at packages/web/Dockerfile', () => {
        assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile not found at packages/web/Dockerfile');
    });

    it('should use multi-stage build', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        const fromStatements = content.match(/^FROM\s+/gm);
        assert.ok(fromStatements, 'No FROM statements found');
        assert.ok(fromStatements.length >= 2, `Expected at least 2 FROM stages, found ${fromStatements.length}`);
    });

    it('should use node:20-alpine as base image', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(content.includes('node:20-alpine'), 'Dockerfile should use node:20-alpine base image');
    });

    it('should name the build stage', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(/FROM\s+node:20-alpine\s+AS\s+build/i.test(content), 'Build stage should be named "build"');
    });

    it('should set NODE_ENV=production in production stage', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(content.includes('NODE_ENV=production'), 'Should set NODE_ENV=production');
    });

    it('should expose port 3000', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(/EXPOSE\s+3000/.test(content), 'Should expose port 3000');
    });

    it('should use non-root user', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(/USER\s+node/.test(content), 'Should switch to non-root "node" user');
    });

    it('should set CMD to run the server', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(content.includes('packages/web/dist/server/server.js'), 'CMD should run the server entry point');
    });

    it('should include a HEALTHCHECK instruction', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(/HEALTHCHECK/.test(content), 'Should include HEALTHCHECK instruction');
        assert.ok(content.includes('/health'), 'HEALTHCHECK should probe /health endpoint');
    });

    it('should copy package.json and lockfile before npm ci (layer caching)', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        const packageJsonCopyIndex = content.indexOf('COPY package.json package-lock.json');
        const npmCiIndex = content.indexOf('RUN npm ci');
        assert.ok(packageJsonCopyIndex !== -1, 'Should copy package.json and lockfile');
        assert.ok(npmCiIndex !== -1, 'Should run npm ci');
        assert.ok(packageJsonCopyIndex < npmCiIndex, 'Should copy package files before npm ci for layer caching');
    });

    it('should install workspace dependencies', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(content.includes('--workspace=packages/web'), 'Should install web workspace');
        assert.ok(content.includes('--workspace=packages/core'), 'Should install core workspace');
        assert.ok(content.includes('--workspace=packages/webview'), 'Should install webview workspace');
    });

    it('should compile TypeScript in build stage', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(content.includes('npm run compile'), 'Should compile TypeScript');
    });

    it('should use --omit=dev for production dependencies', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(content.includes('--omit=dev'), 'Production stage should use --omit=dev');
    });

    it('should copy compiled dist and public directories', () => {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        assert.ok(content.includes('packages/core/dist/'), 'Should copy core dist');
        assert.ok(content.includes('packages/web/dist/'), 'Should copy web dist');
        assert.ok(content.includes('packages/web/public/'), 'Should copy web public');
        assert.ok(content.includes('packages/webview/src/'), 'Should copy webview src');
    });
});

// ============================================
// docker-compose.yml Tests
// ============================================

describe('docker-compose.yml', () => {
    const composePath = path.join(webPkgDir, 'docker-compose.yml');

    it('should exist at packages/web/docker-compose.yml', () => {
        assert.ok(fs.existsSync(composePath), 'docker-compose.yml not found');
    });

    it('should define a web service', () => {
        const content = fs.readFileSync(composePath, 'utf-8');
        assert.ok(content.includes('services:'), 'Should have services section');
        assert.ok(content.includes('web:'), 'Should define a web service');
    });

    it('should reference the Dockerfile', () => {
        const content = fs.readFileSync(composePath, 'utf-8');
        assert.ok(content.includes('dockerfile:') || content.includes('Dockerfile'), 'Should reference the Dockerfile');
    });

    it('should map port 3000', () => {
        const content = fs.readFileSync(composePath, 'utf-8');
        assert.ok(content.includes('3000'), 'Should map port 3000');
    });

    it('should pass environment variables', () => {
        const content = fs.readFileSync(composePath, 'utf-8');
        assert.ok(content.includes('SESSION_SECRET'), 'Should pass SESSION_SECRET');
        assert.ok(content.includes('ALLOWED_ORIGINS'), 'Should pass ALLOWED_ORIGINS');
        assert.ok(content.includes('SESSION_TIMEOUT'), 'Should pass SESSION_TIMEOUT');
        assert.ok(content.includes('PORT'), 'Should pass PORT');
    });

    it('should set restart policy to unless-stopped', () => {
        const content = fs.readFileSync(composePath, 'utf-8');
        assert.ok(content.includes('unless-stopped'), 'Should use restart: unless-stopped');
    });

    it('should include a healthcheck using node (not wget)', () => {
        const content = fs.readFileSync(composePath, 'utf-8');
        assert.ok(content.includes('healthcheck:'), 'Should include healthcheck');
        assert.ok(content.includes('/health'), 'Healthcheck should use /health endpoint');
        assert.ok(!content.includes('wget'), 'Healthcheck should not use wget (not in alpine)');
        assert.ok(content.includes('node'), 'Healthcheck should use node for HTTP check');
    });

    it('should enable init for proper signal handling', () => {
        const content = fs.readFileSync(composePath, 'utf-8');
        assert.ok(content.includes('init: true'), 'Should enable init for PID 1 signal forwarding');
    });

    it('should set NODE_ENV=production', () => {
        const content = fs.readFileSync(composePath, 'utf-8');
        assert.ok(content.includes('NODE_ENV=production'), 'Should set NODE_ENV=production');
    });

    it('should set build context to repo root', () => {
        const content = fs.readFileSync(composePath, 'utf-8');
        assert.ok(content.includes('context:') && content.includes('../..'), 'Build context should be repo root (../..)');
    });
});

// ============================================
// .dockerignore Tests
// ============================================

describe('.dockerignore', () => {
    const dockerignorePath = path.join(repoRoot, '.dockerignore');

    it('should exist at repo root', () => {
        assert.ok(fs.existsSync(dockerignorePath), '.dockerignore not found at repo root');
    });

    it('should exclude node_modules', () => {
        const content = fs.readFileSync(dockerignorePath, 'utf-8');
        assert.ok(content.includes('node_modules'), 'Should exclude node_modules');
    });

    it('should exclude .git directory', () => {
        const content = fs.readFileSync(dockerignorePath, 'utf-8');
        assert.ok(content.includes('.git'), 'Should exclude .git');
    });

    it('should exclude test files', () => {
        const content = fs.readFileSync(dockerignorePath, 'utf-8');
        assert.ok(content.includes('test'), 'Should exclude test directories');
    });

    it('should exclude dist (rebuilt during build)', () => {
        const content = fs.readFileSync(dockerignorePath, 'utf-8');
        assert.ok(content.includes('dist'), 'Should exclude dist directory');
    });

    it('should exclude .vscode', () => {
        const content = fs.readFileSync(dockerignorePath, 'utf-8');
        assert.ok(content.includes('.vscode'), 'Should exclude .vscode');
    });

    it('should exclude .env files', () => {
        const content = fs.readFileSync(dockerignorePath, 'utf-8');
        assert.ok(content.includes('.env'), 'Should exclude .env files');
    });

    it('should exclude markdown files', () => {
        const content = fs.readFileSync(dockerignorePath, 'utf-8');
        assert.ok(content.includes('*.md'), 'Should exclude markdown files');
    });
});

// ============================================
// Environment Variable Support Tests
// ============================================

describe('Environment variable support', () => {
    it('server.ts should read PORT from environment', () => {
        const serverPath = path.join(webPkgDir, 'src', 'server', 'server.ts');
        const content = fs.readFileSync(serverPath, 'utf-8');
        assert.ok(content.includes('process.env.PORT'), 'server.ts should read PORT from env');
    });

    it('security.ts should read ALLOWED_ORIGINS from environment', () => {
        const securityPath = path.join(webPkgDir, 'src', 'server', 'security.ts');
        const content = fs.readFileSync(securityPath, 'utf-8');
        assert.ok(content.includes('process.env.ALLOWED_ORIGINS'), 'security.ts should read ALLOWED_ORIGINS from env');
    });

    it('security.ts should support SESSION_SECRET as CSRF fallback', () => {
        const securityPath = path.join(webPkgDir, 'src', 'server', 'security.ts');
        const content = fs.readFileSync(securityPath, 'utf-8');
        assert.ok(content.includes('process.env.SESSION_SECRET'), 'security.ts should read SESSION_SECRET from env');
    });

    it('security.ts should warn when SESSION_SECRET is missing in production', () => {
        const securityPath = path.join(webPkgDir, 'src', 'server', 'security.ts');
        const content = fs.readFileSync(securityPath, 'utf-8');
        assert.ok(content.includes('WARNING') && content.includes('SESSION_SECRET'), 'Should warn about missing SESSION_SECRET');
    });

    it('sessionManager.ts should read SESSION_TIMEOUT from environment', () => {
        const sessionMgrPath = path.join(webPkgDir, 'src', 'server', 'sessionManager.ts');
        const content = fs.readFileSync(sessionMgrPath, 'utf-8');
        assert.ok(content.includes('process.env.SESSION_TIMEOUT'), 'sessionManager.ts should read SESSION_TIMEOUT from env');
    });

    it('server.ts should log startup configuration', () => {
        const serverPath = path.join(webPkgDir, 'src', 'server', 'server.ts');
        const content = fs.readFileSync(serverPath, 'utf-8');
        assert.ok(content.includes('logStartupConfig'), 'server.ts should call logStartupConfig');
        assert.ok(content.includes('Configuration:'), 'server.ts should log configuration header');
    });

    it('startup log should not expose secret values', () => {
        const serverPath = path.join(webPkgDir, 'src', 'server', 'server.ts');
        const content = fs.readFileSync(serverPath, 'utf-8');
        // The log should show (set) or (not set), not the actual secret value
        assert.ok(content.includes("'(set)'") || content.includes('"(set)"'), 'Should mask secret as (set) when present');
        assert.ok(content.includes("'(not set,") || content.includes('"(not set,'), 'Should show (not set) when absent');
    });
});

// ============================================
// Monorepo Build Context Tests
// ============================================

describe('Monorepo build context', () => {
    it('root package.json should have workspaces configured', () => {
        const rootPkgPath = path.join(repoRoot, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
        assert.ok(Array.isArray(pkg.workspaces), 'Root package.json should have workspaces');
        assert.ok(pkg.workspaces.includes('packages/*'), 'Workspaces should include packages/*');
    });

    it('@iris-te/core package should exist', () => {
        const corePkgPath = path.join(repoRoot, 'packages', 'core', 'package.json');
        assert.ok(fs.existsSync(corePkgPath), '@iris-te/core package.json should exist');
    });

    it('@iris-te/webview package should exist', () => {
        const webviewPkgPath = path.join(repoRoot, 'packages', 'webview', 'package.json');
        assert.ok(fs.existsSync(webviewPkgPath), '@iris-te/webview package.json should exist');
    });

    it('web package should depend on core and webview', () => {
        const webPkgPath = path.join(webPkgDir, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(webPkgPath, 'utf-8'));
        assert.ok(pkg.dependencies['@iris-te/core'], 'Web should depend on @iris-te/core');
        assert.ok(pkg.dependencies['@iris-te/webview'], 'Web should depend on @iris-te/webview');
    });

    it('Dockerfile should be built from repo root context', () => {
        const dockerfilePath = path.join(webPkgDir, 'Dockerfile');
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        // The Dockerfile references root-level files directly (no ../../ needed)
        assert.ok(content.includes('COPY package.json package-lock.json ./'), 'Should copy root package files from build context');
    });
});
