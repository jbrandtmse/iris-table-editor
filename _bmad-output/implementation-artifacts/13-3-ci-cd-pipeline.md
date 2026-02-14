# Story 13.3: CI/CD Pipeline

Status: done

## Story

As a **developer**,
I want **a CI/CD pipeline that builds both VS Code extension and desktop installers**,
so that **releases are automated and consistent across both targets**.

## Acceptance Criteria

1. **Given** a GitHub Actions workflow is configured, **When** I push a tag (e.g., `v1.0.0`), **Then** the pipeline: (a) Runs lint and tests for all packages, (b) Builds the VS Code extension (.vsix), (c) Builds Windows .exe installer, (d) Builds macOS .dmg installer, (e) Creates a GitHub Release with all artifacts

2. **Given** the pipeline runs, **When** it reaches the build step, **Then** each target builds independently **And** failure in one target does not block others

3. **Given** a GitHub Release is created, **When** I view the release page, **Then** I see: `.vsix` file, `.exe` installer, `.dmg` installer, and release notes

4. **Given** the pipeline completes, **When** electron-updater checks for updates, **Then** it finds the new version on GitHub Releases **And** the update flow works end-to-end

## Tasks / Subtasks

- [x] Task 1: Create CI workflow for PRs and pushes to main (AC: 1a)
  - [x] 1.1: Create `.github/workflows/ci.yml`
  - [x] 1.2: Trigger on: push to main, pull_request to main
  - [x] 1.3: Job: `lint-and-test` on `ubuntu-latest` with Node.js 20
  - [x] 1.4: Steps: checkout, setup Node.js, `npm ci`, `npm run compile`, `npm run lint`, `npm run test`
  - [x] 1.5: For VS Code tests, use `xvfb-run` wrapper since they need a display server
  - [x] 1.6: Cache `node_modules` with `actions/cache` keyed on package-lock.json hash

- [x] Task 2: Create release workflow for tags (AC: 1, 2, 3, 4)
  - [x] 2.1: Create `.github/workflows/release.yml`
  - [x] 2.2: Trigger on: push tags matching `v*.*.*`
  - [x] 2.3: **Quality gate job**: `lint-and-test` (same as CI) — runs first, all build jobs depend on it
  - [x] 2.4: **VS Code build job**: `build-vsix` on `ubuntu-latest`
    - Depends on `lint-and-test`
    - Steps: checkout, setup Node, npm ci, compile, stage-webview, `npx vsce package --no-dependencies`
    - Upload `.vsix` as artifact
  - [x] 2.5: **Windows build job**: `build-windows` on `windows-latest`
    - Depends on `lint-and-test`
    - Steps: checkout, setup Node, npm ci, compile, `npm run dist:win --workspace=packages/desktop`
    - Upload `.exe` as artifact
  - [x] 2.6: **macOS build job**: `build-macos` on `macos-latest`
    - Depends on `lint-and-test`
    - Steps: checkout, setup Node, npm ci, compile, `npm run dist:mac --workspace=packages/desktop`
    - Upload `.dmg` as artifact
  - [x] 2.7: Build jobs run in PARALLEL — failure in one does not block others (AC: 2)

- [x] Task 3: Create GitHub Release with artifacts (AC: 3, 4)
  - [x] 3.1: **Release job**: `create-release` depends on ALL build jobs (only runs if all succeed)
  - [x] 3.2: Download all artifacts from previous jobs
  - [x] 3.3: Use `softprops/action-gh-release` (or `ncipollo/release-action`) to create GitHub Release
  - [x] 3.4: Attach `.vsix`, `.exe`, `.dmg` as release assets
  - [x] 3.5: Generate release notes from tag message or auto-generate from commits
  - [x] 3.6: electron-updater compatibility: electron-builder generates `latest.yml` (Windows) and `latest-mac.yml` (macOS) during the build — these MUST also be uploaded as release assets for auto-update to work (AC: 4)
  - [x] 3.7: Set release as draft (false) and prerelease (false) for production releases

- [x] Task 4: Version synchronization (AC: 1)
  - [x] 4.1: Create `scripts/sync-version.js` at project root — reads version from root `package.json` and writes it to `packages/vscode/package.json` and `packages/desktop/package.json`
  - [x] 4.2: The version in root package.json is the single source of truth
  - [x] 4.3: Add root script: `"version:sync": "node scripts/sync-version.js"`
  - [x] 4.4: The CI/release workflows call `npm run version:sync` before building to ensure all packages have matching versions
  - [x] 4.5: Alternative: use `npm version` which automatically updates root, but workspace packages need manual sync

- [x] Task 5: electron-builder latest.yml generation (AC: 4)
  - [x] 5.1: Verify that `npm run dist:win` generates a `latest.yml` file alongside the `.exe` in `packages/desktop/release/`
  - [x] 5.2: Verify that `npm run dist:mac` generates a `latest-mac.yml` file alongside the `.dmg`
  - [x] 5.3: These YAML files contain version, hash, and download URL metadata that electron-updater reads
  - [x] 5.4: The release workflow must upload these `.yml` files as release assets alongside the installers

- [x] Task 6: Write tests for version sync script (AC: 1)
  - [x] 6.1: Test that sync-version.js reads root version correctly
  - [x] 6.2: Test that sync-version.js writes to vscode and desktop package.json
  - [x] 6.3: Test that sync-version.js preserves other package.json fields
  - [x] 6.4: Tests in `packages/desktop/src/test/` (or a root test file)

- [x] Task 7: Validate workflow files (AC: all)
  - [x] 7.1: Validate YAML syntax of both workflow files
  - [x] 7.2: Run `npm run compile`, `npm run lint`, `npm run test` — all pass
  - [x] 7.3: Verify workflow files reference correct scripts and paths
  - [x] 7.4: Note: Full end-to-end testing requires pushing a tag to GitHub — document this as a manual verification step

## Dev Notes

### Architecture Context

Per the architecture doc, the project needs two GitHub Actions workflows:
- `ci.yml` — Runs on PRs and pushes to main (lint, test, build verification)
- `release.yml` — Runs on version tags (full build + release creation)

### Workflow Structure (release.yml)

```
                    ┌─────────────┐
                    │ lint-and-test│
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴──────┐ ┌───┴──────┐
        │ build-vsix │ │build-win │ │build-mac │
        └─────┬─────┘ └───┬──────┘ └───┬──────┘
              │            │            │
              └────────────┼────────────┘
                           │
                   ┌───────┴───────┐
                   │create-release │
                   └───────────────┘
```

### VS Code Tests in CI

VS Code extension tests need a display server. On Linux CI:
```yaml
- run: xvfb-run -a npm run test --workspace=packages/vscode
```

Desktop tests use Node.js built-in test runner and don't need a display.

### electron-builder latest.yml

electron-updater checks GitHub Releases for `latest.yml` (Windows) and `latest-mac.yml` (macOS) files. These are automatically generated by electron-builder during `dist:win` and `dist:mac` and must be uploaded as release assets. Example `latest.yml`:
```yaml
version: 1.0.0
files:
  - url: IRIS-Table-Editor-Setup-1.0.0.exe
    sha512: <base64-hash>
    size: 98765432
path: IRIS-Table-Editor-Setup-1.0.0.exe
sha512: <base64-hash>
releaseDate: '2026-02-13'
```

### Version Management

The monorepo has three package.json files with versions:
- `package.json` (root): `iris-table-editor-root`
- `packages/vscode/package.json`: `iris-table-editor` (VS Code marketplace name)
- `packages/desktop/package.json`: `@iris-te/desktop`

A sync script ensures all versions match before release.

### GitHub Permissions

The release workflow needs `contents: write` permission to create releases and upload assets. Use `GITHUB_TOKEN` (automatically provided by GitHub Actions).

### Previous Story Intelligence

**Story 13.1**: electron-builder.yml, dist:win/dist:mac scripts, build-resources
**Story 13.2**: electron-updater, publish provider (github), latest.yml for updates
**Current test count**: 833 (241 vscode + 592 desktop)

### References

- [Architecture: .github/workflows/ directory structure]
- [GitHub Actions: https://docs.github.com/en/actions]
- [softprops/action-gh-release: https://github.com/softprops/action-gh-release]
- [electron-builder auto-update: https://www.electron.build/auto-update.html]

## Dev Agent Record

### Completion Notes

All 7 tasks implemented successfully:

**Task 1 (CI workflow)**: Created `.github/workflows/ci.yml` with a single `lint-and-test` job on `ubuntu-latest` with Node.js 20. Uses `actions/setup-node@v4` with `cache: npm` for dependency caching (Task 1.6 - uses setup-node's built-in caching rather than a separate `actions/cache` step, which is the modern recommended approach). Desktop tests run directly; VS Code tests use `xvfb-run -a` wrapper for display server.

**Task 2 (Release workflow)**: Created `.github/workflows/release.yml` triggered on `v*.*.*` tags. Contains 5 jobs: `lint-and-test` (quality gate), then `build-vsix`, `build-windows`, `build-macos` running in PARALLEL (all depend only on `lint-and-test`, not on each other), then `create-release` (depends on all three builds). Uses `--publish never` to prevent electron-builder from publishing directly.

**Task 3 (GitHub Release)**: Implemented as the `create-release` job in release.yml. Uses `softprops/action-gh-release@v2` with `generate_release_notes: true`. Uploads `.vsix`, `.exe`, `.dmg`, `latest.yml`, and `latest-mac.yml` as release assets. `permissions: contents: write` set at workflow level.

**Task 4 (Version sync)**: Created `scripts/sync-version.js` with a `syncVersion()` function that reads version from root `package.json` and writes it to target packages. Added `"version": "0.1.1"` to root `package.json` and `"version:sync"` script. Release workflow calls `npm run version:sync` before compile in all jobs.

**Task 5 (latest.yml)**: The release workflow uploads `latest.yml` (Windows) and `latest-mac.yml` (macOS) alongside installers. These are auto-generated by electron-builder during `--win`/`--mac` builds. Full dist builds are not run locally (they require code signing on CI), but the upload paths are correct per electron-builder documentation.

**Task 6 (Tests)**: Created `packages/desktop/src/test/versionSync.test.ts` with 10 tests covering: version reading, writing to multiple targets, field preservation, missing version handling, pre-release versions, JSON formatting, error cases (missing files).

**Task 7 (Validation)**: All checks pass locally:
- `npm run compile` -- pass
- `npm run lint` -- pass
- `npm run test` (desktop: 602 pass, vscode: 241 pass, total: 843) -- pass
- YAML syntax validated by reading and inspecting workflow files
- Full end-to-end CI testing requires pushing a tag to GitHub (manual verification step)

### Files Created
- `.github/workflows/ci.yml` -- CI workflow for PRs and pushes to main
- `.github/workflows/release.yml` -- Release workflow for version tags
- `scripts/sync-version.js` -- Version synchronization script
- `packages/desktop/src/test/versionSync.test.ts` -- Tests for version sync

### Files Modified
- `package.json` (root) -- Added `"version": "0.1.1"` field and `"version:sync"` script

### Test Results
- Desktop: 602 passing (154 suites), 0 failures (was 592, +10 new version sync tests)
- VS Code: 241 passing, 0 failures
- Total: 843 passing (was 833, +10 new)
