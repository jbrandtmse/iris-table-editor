/**
 * Unit tests for CI/CD Pipeline (Web)
 * Story 18.3: CI/CD Pipeline - Task 3
 *
 * Static configuration assertions for CI and release workflow files.
 * Verifies that web test steps and Docker build configuration are present.
 * Uses Node.js built-in test runner.
 */
import { describe, it } from 'node:test';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// Resolve paths relative to repo root
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const ciPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml');
const releasePath = path.join(repoRoot, '.github', 'workflows', 'release.yml');

// ============================================
// CI Workflow Tests
// ============================================

describe('CI workflow — web tests', () => {
    it('ci.yml should exist', () => {
        assert.ok(fs.existsSync(ciPath), 'ci.yml not found');
    });

    it('should include web test workspace step', () => {
        const content = fs.readFileSync(ciPath, 'utf-8');
        assert.ok(
            content.includes('npm run test --workspace=packages/web'),
            'ci.yml should run web workspace tests'
        );
    });

    it('should run web tests after desktop tests', () => {
        const content = fs.readFileSync(ciPath, 'utf-8');
        const desktopIndex = content.indexOf('--workspace=packages/desktop');
        const webIndex = content.indexOf('--workspace=packages/web');
        assert.ok(desktopIndex !== -1, 'Desktop test step should exist');
        assert.ok(webIndex !== -1, 'Web test step should exist');
        assert.ok(webIndex > desktopIndex, 'Web tests should come after desktop tests');
    });

    it('should run web tests before VS Code tests', () => {
        const content = fs.readFileSync(ciPath, 'utf-8');
        const webIndex = content.indexOf('--workspace=packages/web');
        const vscodeIndex = content.indexOf('--workspace=packages/vscode');
        assert.ok(webIndex !== -1, 'Web test step should exist');
        assert.ok(vscodeIndex !== -1, 'VS Code test step should exist');
        assert.ok(webIndex < vscodeIndex, 'Web tests should come before VS Code tests');
    });
});

// ============================================
// Release Workflow — Web Tests in Quality Gate
// ============================================

describe('Release workflow — web tests in quality gate', () => {
    it('release.yml should exist', () => {
        assert.ok(fs.existsSync(releasePath), 'release.yml not found');
    });

    it('should include web test workspace step', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(
            content.includes('npm run test --workspace=packages/web'),
            'release.yml should run web workspace tests'
        );
    });

    it('should run web tests after desktop tests in quality gate', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        const desktopIndex = content.indexOf('--workspace=packages/desktop');
        const webIndex = content.indexOf('--workspace=packages/web');
        assert.ok(desktopIndex !== -1, 'Desktop test step should exist');
        assert.ok(webIndex !== -1, 'Web test step should exist');
        assert.ok(webIndex > desktopIndex, 'Web tests should come after desktop tests');
    });
});

// ============================================
// Release Workflow — Docker Build Job
// ============================================

describe('Release workflow — build-docker job', () => {
    it('should include build-docker job', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(content.includes('build-docker:'), 'release.yml should have a build-docker job');
    });

    it('should use ghcr.io login', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(
            content.includes('registry: ghcr.io'),
            'build-docker should log in to ghcr.io'
        );
    });

    it('should reference packages/web/Dockerfile', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(
            content.includes('file: packages/web/Dockerfile'),
            'build-docker should reference packages/web/Dockerfile'
        );
    });

    it('should tag with semver pattern', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(
            content.includes('type=semver,pattern={{version}}'),
            'Docker image should be tagged with semver version'
        );
    });

    it('should tag with major.minor pattern', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(
            content.includes('type=semver,pattern={{major}}.{{minor}}'),
            'Docker image should be tagged with major.minor'
        );
    });

    it('should tag with git SHA', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(
            content.includes('type=sha'),
            'Docker image should be tagged with git SHA'
        );
    });

    it('should use docker/setup-buildx-action', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(
            content.includes('docker/setup-buildx-action@v3'),
            'Should use docker/setup-buildx-action@v3'
        );
    });

    it('should use docker/build-push-action', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(
            content.includes('docker/build-push-action@v6'),
            'Should use docker/build-push-action@v6'
        );
    });

    it('should push the image', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        // Find the build-push-action section and verify push: true
        const buildPushIndex = content.indexOf('docker/build-push-action');
        const pushIndex = content.indexOf('push: true', buildPushIndex);
        assert.ok(pushIndex !== -1, 'build-push-action should have push: true');
    });

    it('should use GHA cache', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(content.includes('cache-from: type=gha'), 'Should use GHA cache-from');
        assert.ok(content.includes('cache-to: type=gha,mode=max'), 'Should use GHA cache-to');
    });

    it('should have packages: write permission', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        assert.ok(content.includes('packages: write'), 'build-docker should have packages: write permission');
    });

    it('should set build context to repo root', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        // In the build-push-action section, context should be "."
        const buildPushIndex = content.indexOf('docker/build-push-action');
        const contextIndex = content.indexOf('context: .', buildPushIndex);
        assert.ok(contextIndex !== -1, 'Build context should be repo root (.)');
    });
});

// ============================================
// Release Workflow — create-release Dependencies
// ============================================

describe('Release workflow — create-release dependencies', () => {
    it('should include build-docker in create-release needs', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        // Find the create-release job's needs line
        const createReleaseIndex = content.indexOf('create-release:');
        assert.ok(createReleaseIndex !== -1, 'create-release job should exist');

        const needsSection = content.substring(createReleaseIndex, createReleaseIndex + 200);
        assert.ok(
            needsSection.includes('build-docker'),
            'create-release needs should include build-docker'
        );
    });

    it('should still include all original build jobs in needs', () => {
        const content = fs.readFileSync(releasePath, 'utf-8');
        const createReleaseIndex = content.indexOf('create-release:');
        const needsSection = content.substring(createReleaseIndex, createReleaseIndex + 200);
        assert.ok(needsSection.includes('build-vsix'), 'create-release needs should include build-vsix');
        assert.ok(needsSection.includes('build-windows'), 'create-release needs should include build-windows');
        assert.ok(needsSection.includes('build-macos'), 'create-release needs should include build-macos');
    });
});
