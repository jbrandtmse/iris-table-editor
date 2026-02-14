# Story 18.3: CI/CD Pipeline (Web)

Status: review

## Story

As a **developer**,
I want **a CI/CD pipeline that builds, tests, and deploys the web target**,
So that **releases are automated and reliable**.

## Acceptance Criteria

1. When I push to main, the CI pipeline runs lint, compile, and test for all packages including @iris-te/web
2. When a release tag is created, the Docker image is built and tagged with the version, and pushed to GitHub Container Registry (ghcr.io)

## Tasks / Subtasks

- [x] Task 1: Update CI workflow to include web tests (AC: 1)
  - [x] 1.1: Add `npm run test --workspace=packages/web` step to `.github/workflows/ci.yml`
  - [x] 1.2: Place it after desktop tests and before VS Code tests (web tests don't need xvfb)

- [x] Task 2: Update release workflow with Docker build (AC: 2)
  - [x] 2.1: Add web tests to the `lint-and-test` quality gate in `.github/workflows/release.yml`
  - [x] 2.2: Add a `build-docker` job after `lint-and-test` quality gate
  - [x] 2.3: Use `docker/setup-buildx-action` for efficient builds
  - [x] 2.4: Use `docker/login-action` to authenticate with ghcr.io
  - [x] 2.5: Use `docker/build-push-action` to build and push the image
  - [x] 2.6: Tag the image with: version tag (from git tag), `latest`, and git SHA
  - [x] 2.7: Set build context to repo root, Dockerfile path to `packages/web/Dockerfile`
  - [x] 2.8: Add `build-docker` to `create-release` `needs` array

- [x] Task 3: Write tests (AC: 1-2)
  - [x] 3.1: Create `packages/web/src/test/cicd.test.ts`
  - [x] 3.2: Test that ci.yml includes web test step
  - [x] 3.3: Test that release.yml includes Docker build job
  - [x] 3.4: Test that release.yml uses ghcr.io login
  - [x] 3.5: Test that release.yml tags Docker image with version
  - [x] 3.6: Test that Dockerfile is referenced correctly in the release workflow
  - [x] 3.7: Run compile + lint + test to validate

## Dev Notes

### Existing CI/CD Pattern
The project already has:
- `.github/workflows/ci.yml` — Runs on push to main and PRs. Steps: checkout, setup-node, npm ci, compile, lint, desktop tests, vscode tests (xvfb)
- `.github/workflows/release.yml` — Runs on `v*.*.*` tags. Quality gate → parallel builds (vsix, windows, macos) → create release

### What to Add
**ci.yml**: Simply add a `npm run test --workspace=packages/web` step. Web tests use node:test and don't need xvfb.

**release.yml**: Add a `build-docker` job that:
1. Checks out code
2. Sets up Docker Buildx
3. Logs into ghcr.io using `${{ github.token }}`
4. Builds and pushes the Docker image with proper tags
5. The build context is the repo root since the Dockerfile needs workspace access

### Docker Image Tags
For a push of tag `v1.2.3`:
- `ghcr.io/${{ github.repository }}/web:1.2.3`
- `ghcr.io/${{ github.repository }}/web:latest`
- `ghcr.io/${{ github.repository }}/web:sha-<short-sha>`

### Key Workflow Actions
- `docker/setup-buildx-action@v3` — Buildx for multi-platform support
- `docker/login-action@v3` — Authenticate with registry
- `docker/build-push-action@v6` — Build and push in one step
- `docker/metadata-action@v5` — Generate image tags from git context

### Project Structure Notes
- `.github/workflows/ci.yml` — MODIFY: add web test step
- `.github/workflows/release.yml` — MODIFY: add web tests + Docker build job
- `packages/web/src/test/cicd.test.ts` — NEW: CI/CD configuration tests

### Files Changed
- `.github/workflows/ci.yml` — MODIFIED: Added web test step after desktop tests
- `.github/workflows/release.yml` — MODIFIED: Added web test step to quality gate + build-docker job + updated create-release needs
- `packages/web/src/test/cicd.test.ts` — NEW: 21 CI/CD configuration tests

### Completion Notes
- All 3 tasks implemented and verified
- 21 new CI/CD tests across 4 test suites (CI workflow, release quality gate, build-docker job, create-release dependencies)
- Total web package tests: 442 passing (120 suites), 0 failures
- `npm run compile` — pass
- `npm run lint` — pass
- `npm run test --workspace=packages/web` — 442 tests pass

### References
- [Source: epics.md#Story 18.3] — Acceptance criteria
- [Source: .github/workflows/ci.yml] — Existing CI workflow
- [Source: .github/workflows/release.yml] — Existing release workflow
- [Source: packages/web/Dockerfile] — Docker build file
