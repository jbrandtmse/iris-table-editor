# Story 15.1: Server Bootstrap

Status: review

## Story

As a **developer**,
I want **a Node.js server project set up within the monorepo**,
So that **I have a working foundation for the web application target**.

## Acceptance Criteria

1. `packages/web` is created with package.json, tsconfig.json
2. The package is registered in the root workspace (already uses `packages/*` glob)
3. Express is installed and configured as the HTTP framework
4. A health endpoint (`GET /health`) returns `{ status: "ok" }`
5. A dev server with hot reload (nodemon or tsx watch) is configured
6. `npm run dev --workspace=@iris-te/web` starts the server
7. Accessing the root URL shows a placeholder page confirming the server is operational
8. The server creates an HTTP server instance compatible with WebSocket upgrade (Story 15.3)

## Tasks / Subtasks

- [x] Task 1: Create packages/web directory and package.json (AC: 1, 2)
  - [x] 1.1: Create `packages/web/package.json` with name `@iris-te/web`, version matching other packages (0.2.0)
  - [x] 1.2: Add dependencies: `express`, `@iris-te/core` (workspace `*`), `@iris-te/webview` (workspace `*`)
  - [x] 1.3: Add devDependencies: `@types/express`, `tsx` (for dev mode with watch)
  - [x] 1.4: Add scripts: `compile` (tsc), `dev` (tsx watch), `start` (node dist/server/server.js), `lint`, `test`
  - [x] 1.5: Verify package is auto-discovered by root `packages/*` workspace glob

- [x] Task 2: Create TypeScript configuration (AC: 1)
  - [x] 2.1: Create `packages/web/tsconfig.json` matching core/desktop pattern (CommonJS, ES2022, strict, declaration)
  - [x] 2.2: Include `src/**/*.ts` in compilation

- [x] Task 3: Create Express server entry point (AC: 3, 4, 7, 8)
  - [x] 3.1: Create `packages/web/src/server/server.ts` per architecture spec
  - [x] 3.2: Import express and create app + HTTP server (http.createServer for WebSocket compat)
  - [x] 3.3: Add `express.json({ limit: '10mb' })` body parser
  - [x] 3.4: Add `GET /health` endpoint returning `{ status: "ok" }`
  - [x] 3.5: Serve static files from `packages/web/public/` directory
  - [x] 3.6: Add SPA fallback route (`GET *` returns index.html for non-API routes)
  - [x] 3.7: Read PORT from `process.env.PORT` with default 3000
  - [x] 3.8: Log startup with `[IRIS-TE]` prefix

- [x] Task 4: Create placeholder SPA page (AC: 7)
  - [x] 4.1: Create `packages/web/public/index.html` with placeholder "IRIS Table Editor Web — Server Running"
  - [x] 4.2: Style with basic CSS matching the project's visual identity

- [x] Task 5: Configure dev mode with hot reload (AC: 5, 6)
  - [x] 5.1: Add `tsx watch` script for development mode in package.json
  - [x] 5.2: Verify `npm run dev --workspace=@iris-te/web` starts the server

- [x] Task 6: Update root package.json scripts (AC: 6)
  - [x] 6.1: Add `start:web` script to root package.json
  - [x] 6.2: Update root `test` script to include web package when tests exist

- [x] Task 7: Write tests (AC: 1-8)
  - [x] 7.1: Create `packages/web/src/test/server.test.ts` with tests for health endpoint, static file serving, SPA fallback
  - [x] 7.2: Test server starts on configured port
  - [x] 7.3: Test health endpoint returns correct JSON
  - [x] 7.4: Test SPA fallback returns index.html for unknown routes
  - [x] 7.5: Run compile + lint + test to validate

## Dev Notes

- Follow the architecture spec at `_bmad-output/planning-artifacts/architecture.md` section "Web Server Architecture"
- Use Express (not Fastify) — architecture spec uses Express in all examples
- Create HTTP server via `http.createServer(app)` so WebSocket can attach later (Story 15.3)
- Use `tsx` for dev mode (modern, fast TypeScript execution with watch mode) — simpler than nodemon+ts-node
- Match existing package patterns: CommonJS module system, ES2022 target, `[IRIS-TE]` log prefix
- Tests use Node.js built-in test runner (`node:test`) like desktop package
- For test HTTP requests, use Node.js native `fetch` (available in Node 20+)

### Project Structure Notes

- `packages/web/` is the new monorepo package per architecture spec
- Follows `@iris-te/web` naming convention
- Server code goes in `src/server/` subdirectory (not root src/)
- Client code will go in `src/client/` in later stories
- Public assets in `public/` directory (served via express.static)

### References

- [Source: architecture.md#Web Server Architecture] — Server design, Express setup, http.createServer pattern
- [Source: architecture.md#Package Dependency Rules] — @iris-te/web can import core, webview; cannot import vscode, electron
- [Source: architecture.md#Monorepo Layout] — packages/web directory structure
- [Source: epics.md#Story 15.1] — Acceptance criteria
- [Source: sprint-change-proposal-2026-02-14.md#Epic 15] — Context and motivation

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None required - all tasks completed successfully on first attempt.

### Completion Notes List
- Created `packages/web` as new monorepo package with `@iris-te/web` name and version 0.2.0
- Express server uses `http.createServer(app)` pattern for WebSocket upgrade compatibility (Story 15.3)
- Server exports `app`, `server`, and `startServer` for testability and future extension
- Server only auto-starts when run directly (`require.main === module` guard) to prevent test conflicts
- Tests use port 0 for dynamic port assignment, avoiding port conflicts
- Tests use native `fetch` (Node.js 20+) per dev notes
- `tsx watch` configured for hot-reload dev mode
- Root package.json updated with `start:web` script and web package added to `test` script
- All 9 tests passing, compile and lint clean across all workspaces

### Change Log
- 2026-02-14: Initial implementation of Story 15.1 - Server Bootstrap (all 7 tasks)

### File List
- `packages/web/package.json` (new)
- `packages/web/tsconfig.json` (new)
- `packages/web/src/server/server.ts` (new)
- `packages/web/public/index.html` (new)
- `packages/web/src/test/server.test.ts` (new)
- `package.json` (modified - added start:web script, web package to test script)
