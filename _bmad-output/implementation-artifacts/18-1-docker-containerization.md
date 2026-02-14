# Story 18.1: Docker Containerization

Status: review

## Story

As a **developer**,
I want **the web app containerized with Docker**,
So that **it can be deployed consistently across environments**.

## Acceptance Criteria

1. When I run `docker build`, a Docker image is produced with a multi-stage build, the final image contains only production dependencies, and the image size is under 200MB
2. When I run `docker-compose up`, the web application starts and is accessible on the configured port, and environment variables configure the application (port, session secret, allowed origins, session timeout)
3. When the container is running and I access the health endpoint, it returns `{ status: "ok" }`
4. When docker-compose is configured with `restart: unless-stopped`, the container restarts automatically if it crashes

## Tasks / Subtasks

- [x] Task 1: Create Dockerfile (AC: 1)
  - [x] 1.1: Create `packages/web/Dockerfile` with multi-stage build
  - [x] 1.2: Stage 1 (build): Use `node:20-alpine`, copy root package.json + lockfile + workspace configs, `npm ci --workspace=packages/web`, compile TypeScript
  - [x] 1.3: Stage 2 (production): Use `node:20-alpine`, copy only compiled dist/, public/, and production node_modules
  - [x] 1.4: Set `NODE_ENV=production`
  - [x] 1.5: Expose port 3000 (default)
  - [x] 1.6: Use non-root user (`node`) for security
  - [x] 1.7: Set CMD to `node dist/server/server.js`
  - [x] 1.8: Add `.dockerignore` to exclude node_modules, .git, tests, etc.

- [x] Task 2: Create docker-compose.yml (AC: 2, 4)
  - [x] 2.1: Create `packages/web/docker-compose.yml` for local development/testing
  - [x] 2.2: Map port 3000:3000 (configurable via environment variable)
  - [x] 2.3: Pass environment variables: PORT, SESSION_SECRET, ALLOWED_ORIGINS, SESSION_TIMEOUT
  - [x] 2.4: Set `restart: unless-stopped`
  - [x] 2.5: Add healthcheck using the /health endpoint

- [x] Task 3: Environment variable support in server (AC: 2)
  - [x] 3.1: Read existing server.ts to check which env vars are already supported
  - [x] 3.2: Ensure PORT is read from env (already: `process.env.PORT || '3000'`)
  - [x] 3.3: Add SESSION_SECRET env var support (for cookie signing — currently uses random value)
  - [x] 3.4: Add ALLOWED_ORIGINS env var support (for CORS configuration)
  - [x] 3.5: Add SESSION_TIMEOUT env var support (for session manager)
  - [x] 3.6: Log startup configuration (without secrets)

- [x] Task 4: Verify monorepo build in Docker context (AC: 1)
  - [x] 4.1: The build must work from the monorepo root (Dockerfile needs access to root package-lock.json and workspace packages)
  - [x] 4.2: Ensure @iris-te/core and @iris-te/webview are available in the build
  - [x] 4.3: Test that the built image starts correctly

- [x] Task 5: Write tests (AC: 1-3)
  - [x] 5.1: Create `packages/web/src/test/docker.test.ts`
  - [x] 5.2: Test that Dockerfile exists and uses multi-stage build
  - [x] 5.3: Test that Dockerfile uses node:20-alpine base
  - [x] 5.4: Test that docker-compose.yml exists with required services and config
  - [x] 5.5: Test that .dockerignore exists with expected entries
  - [x] 5.6: Test that server reads environment variables (SESSION_SECRET, ALLOWED_ORIGINS, SESSION_TIMEOUT)
  - [x] 5.7: Run compile + lint + test to validate

## Dev Notes

- The monorepo uses npm workspaces. The Dockerfile should be placed at `packages/web/Dockerfile` but built from the repo ROOT (`docker build -f packages/web/Dockerfile .`) to access all workspace packages.
- The web server already reads `process.env.PORT || '3000'` in server.ts line 94.
- Security middleware in `security.ts` may already read some env vars — check before adding duplicates.
- The `@iris-te/core` and `@iris-te/webview` packages are workspace dependencies that need to be available at build time.
- Multi-stage build pattern:
  ```
  FROM node:20-alpine AS build
  # Copy workspace files, install, compile

  FROM node:20-alpine AS production
  # Copy only dist + public + production deps
  ```
- For the SESSION_SECRET, the current implementation likely generates a random one — for production, it should be required via env var.
- `.dockerignore` should exclude: node_modules, .git, *.md, src/test, dist, .vscode, _bmad*

### Project Structure Notes
- `packages/web/Dockerfile` — NEW
- `packages/web/docker-compose.yml` — NEW
- `packages/web/.dockerignore` — NEW
- `packages/web/src/server/server.ts` — MODIFY: env var support
- `packages/web/src/server/security.ts` — MODIFY: env var support for CORS origins
- `packages/web/src/test/docker.test.ts` — NEW

### Completion Notes

**Files created:**
- `packages/web/Dockerfile` — Multi-stage Docker build (build + production stages)
- `packages/web/docker-compose.yml` — Local deployment config with healthcheck, restart policy, env vars
- `.dockerignore` — Excludes node_modules, .git, tests, dist, docs, IDE files, .env
- `packages/web/src/test/docker.test.ts` — 30 tests covering Dockerfile, docker-compose, .dockerignore, env vars, monorepo context

**Files modified:**
- `packages/web/src/server/server.ts` — Added `logStartupConfig()` that logs PORT, SESSION_SECRET (masked), ALLOWED_ORIGINS, SESSION_TIMEOUT, NODE_ENV at startup
- `packages/web/src/server/security.ts` — Added SESSION_SECRET as fallback for CSRF secret (CSRF_SECRET -> SESSION_SECRET -> random)

**Key decisions:**
- SESSION_SECRET is used as a fallback for CSRF_SECRET (not a replacement), so existing CSRF_SECRET deployments continue working
- ALLOWED_ORIGINS and SESSION_TIMEOUT were already supported by security.ts and sessionManager.ts respectively; no changes needed
- Healthcheck uses `wget` (available in alpine) instead of `curl` (not in alpine by default)
- Build context is repo root (`../..` from docker-compose.yml) so all workspace packages are accessible

**Test results:** 372 tests pass, 0 failures (30 new docker tests)

### References
- [Source: epics.md#Story 18.1] — Acceptance criteria
- [Source: web/package.json] — Package configuration
- [Source: web/src/server/server.ts] — Server entry point
- [Source: web/src/server/security.ts] — Security middleware
