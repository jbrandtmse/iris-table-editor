# Sprint Change Proposal - Web-Hosted Distribution Target

**Date:** 2026-02-14
**Author:** Developer (facilitated by PM Agent)
**Change Type:** Strategic Expansion — New Distribution Channel
**Scope Classification:** Moderate

---

## Section 1: Issue Summary

**Problem Statement:** IRIS Table Editor currently distributes as a VS Code extension and an Electron desktop app. Both require users to download and install software. This creates friction for adoption and limits the audience to users willing to install applications. A centralized, web-hosted version would eliminate distribution barriers entirely — any user with a browser and network access to IRIS could start editing table data immediately.

**Category:** Strategic expansion — new distribution channel

**Motivation:**
- Distribution friction is the primary adoption barrier
- Desktop installers require admin rights in some enterprise environments
- VS Code extension requires VS Code installation (non-developer staff won't have it)
- A browser-based tool has zero install friction and broadens the audience to anyone with a URL

**Decision:** Add a web-hosted application as a **third distribution target** alongside the existing VS Code extension and Electron desktop app. All three targets will coexist, sharing core logic and webview UI via the existing monorepo structure.

---

## Section 2: Impact Analysis

### Existing Epic Impact

**Epics 1-14: NO IMPACT.** All 14 epics are complete. No existing work needs to be modified or rolled back.

### Reusable Components

| Existing Package | Reusable for Web? | Notes |
|---|---|---|
| `packages/core` | **100%** | All services, models, utils are target-agnostic |
| `packages/webview` | **~95%** | HTML/CSS/JS, theme variables, grid — all shared. Minor tweaks for browser context |
| `IMessageBridge` | **Pattern reusable** | Need new `WebMessageBridge` implementation (WebSocket) |
| `--ite-*` theme system | **Pattern reusable** | Need new `webThemeBridge.css` |
| Connection Manager UI | **Pattern reusable** | Desktop's connection form is a good blueprint |

### New Components Required

| Component | Description |
|---|---|
| **Server backend** | Node.js server (Express/Fastify) that proxies Atelier API requests, serves the SPA, and handles WebSocket connections |
| **WebMessageBridge** | WebSocket-based implementation of IMessageBridge for browser-server communication |
| **Web connection UI** | Browser-based server form (hostname, port, namespace, credentials) — credentials stored in browser session, passed per-call |
| **Authentication layer** | Session-based auth for the web app itself (JWT or cookie) |
| **Deployment infrastructure** | Docker container, HTTPS/TLS, environment config |
| `packages/web` | New monorepo package for the web target |

### Artifact Updates Required

**PRD:**
- New target audience: "any user with a browser"
- New distribution method: URL (centralized hosted service)
- New functional requirements: web connection management, session management, browser-specific behaviors
- New NFRs: web performance, browser compatibility, concurrent users, HTTPS, CSRF protection
- New user journey: "Web User — Zero-Install Data Editing"
- Classification update: add "web application" to distribution targets

**Architecture:**
- New package: `packages/web` in monorepo
- Server component architecture: Express/Fastify + WebSocket server
- WebMessageBridge design
- Credential flow: browser -> server proxy -> IRIS (no persistent credential storage on server)
- Deployment architecture: Docker, reverse proxy, TLS termination
- Package dependency rules: `@iris-te/web` can import from `@iris-te/core`, `@iris-te/webview`

**UX Design:**
- Web-specific connection manager (browser form, no OS keychain)
- Responsive browser viewport considerations
- Browser-native interactions (no Electron-specific features like native menus)
- URL-based navigation (bookmarkable tables)
- Web-specific theme bridge (light/dark toggle, system preference detection via `prefers-color-scheme`)

**Other Artifacts:**
- CI/CD pipeline: add web build & deploy stage
- Docker configuration: new
- Hosting/infrastructure documentation: new

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment (Add new epics)

**Rationale:**
1. All existing work is complete — nothing needs to change
2. The monorepo + abstraction layer architecture was designed for new targets
3. The pattern is proven — Epics 10-14 successfully added a desktop target using the same approach
4. Effort is primarily new code, not reworking existing code
5. ~80-95% of core logic and UI is already shared and reusable

**Effort Estimate:** Medium — server backend is new work, but business logic is all in `packages/core`

**Risk Assessment:**

| Risk | Level | Mitigation |
|---|---|---|
| New server component introduces operational concerns | Medium | Docker containerization, health checks, monitoring |
| Larger security surface (web app exposed to network) | Medium | OWASP compliance, CSRF protection, rate limiting, helmet headers |
| CORS / proxy complexity | Low | Server proxies all IRIS requests, same-origin for browser |
| Multi-tenancy (concurrent users, different IRIS servers) | Medium | Stateless proxy design, session isolation |
| Browser compatibility variations | Low | Standard web technologies, progressive enhancement |

**Timeline Impact:** Additive only — new epics added to the backlog, no impact on completed work.

---

## Section 4: Detailed Change Proposals — New Epics

### Epic 15: Web Server Foundation & API Proxy

**Goal:** Create the Node.js server that proxies Atelier API requests, serves the web application, and provides WebSocket communication for the message bridge.

**Stories:**
- **15.1: Server Bootstrap** — Express/Fastify project setup within `packages/web`, health endpoint, dev server with hot reload
- **15.2: Atelier API Proxy** — Forward requests to user-specified IRIS servers, inject auth headers, handle response streaming
- **15.3: WebSocket Server** — WebSocket endpoint for IMessageBridge communication between browser and server
- **15.4: Security Middleware** — CORS policy, CSRF protection, rate limiting, helmet security headers, input validation
- **15.5: Session Management** — JWT or cookie-based sessions, session timeout, concurrent session handling

**FRs to address:** New web-specific FRs (FR51+)
**NFRs to address:** Web performance, security, scalability
**Dependencies:** None — foundation epic

---

### Epic 16: Web Authentication & Connection Management

**Goal:** Browser-based connection management allowing users to add IRIS server connections, authenticate, and manage sessions.

**Stories:**
- **16.1: Web Connection Form UI** — Server details form (hostname, port, namespace, username, password) following desktop connection manager pattern
- **16.2: Browser Credential Handling** — SessionStorage for active session, credentials encrypted in transit (HTTPS), not stored server-side
- **16.3: Connection Test** — Test connection via server proxy with timeout and cancel support
- **16.4: Multi-Connection Support** — Switch between configured IRIS servers within a session
- **16.5: Session Persistence & Auto-Reconnect** — Remember last connection (optional), reconnect on page reload

**FRs to address:** Web connection management FRs
**Dependencies:** Epic 15 (server must exist)

---

### Epic 17: Web Application Shell & Message Bridge

**Goal:** Serve the shared webview as a single-page application with WebSocket-based message bridge, web-specific theme bridge, and responsive browser layout.

**Stories:**
- **17.1: SPA Shell** — Serve shared webview HTML/CSS/JS as single-page application from `packages/web`
- **17.2: WebMessageBridge** — WebSocket-based implementation of IMessageBridge interface (browser side sends commands, receives events via WebSocket)
- **17.3: Web Theme Bridge** — `webThemeBridge.css` with light/dark tokens and `prefers-color-scheme` media query detection
- **17.4: Responsive Layout** — Full-window grid layout optimized for browser viewport (no sidebar constraint like VS Code), responsive breakpoints
- **17.5: Browser Navigation** — Tab management for multiple open tables, URL state for bookmarkable table views, browser back/forward support

**FRs to address:** Web UI FRs
**Dependencies:** Epic 15 (server), Epic 16 (auth/connection)

---

### Epic 18: Web Build, Deploy & Distribution

**Goal:** Containerize the web application, configure CI/CD for automated deployment, and establish hosting infrastructure.

**Stories:**
- **18.1: Docker Containerization** — Dockerfile for production, docker-compose for local development, multi-stage build
- **18.2: Environment Configuration** — IRIS server allowlists (optional), TLS settings, port configuration, environment variables
- **18.3: CI/CD Pipeline** — Build, test, and deploy pipeline for web target (GitHub Actions)
- **18.4: HTTPS/TLS Configuration** — TLS termination, reverse proxy setup (nginx/caddy), certificate management
- **18.5: Monitoring & Logging** — Health check endpoints, structured logging, error tracking, uptime monitoring

**Dependencies:** Epic 17 (working web app)

---

### Epic 19: Web Integration Testing & Feature Parity

**Goal:** Verify feature parity across all three targets. Browser compatibility testing and security audit.

**Stories:**
- **19.1: Feature Parity Verification** — Verify all 24 feature parity checkpoints work in browser (same checklist from Epic 14, extended for web)
- **19.2: Browser Compatibility Testing** — Chrome, Firefox, Safari, Edge on Windows and macOS
- **19.3: Performance Testing** — Concurrent user load testing, response time verification, WebSocket scalability
- **19.4: Security Audit** — OWASP top 10 review, credential handling verification, proxy security, penetration testing checklist
- **19.5: Web-Specific Polish** — Loading states, offline/disconnect detection, responsive edge cases, first-visit experience

**Dependencies:** Epics 15-18

---

## Section 5: Implementation Handoff

### Scope Classification: Moderate

Additive work that doesn't disrupt existing functionality, but introduces a new deployment model (server-hosted) requiring architectural decisions around hosting, security, and operations.

### Handoff Plan

| Role | Responsibility |
|---|---|
| **Product Manager** | Update PRD with web target requirements (FRs, NFRs, user journey) |
| **Architect** | Design server architecture, WebSocket bridge, auth flow, deployment topology |
| **UX Designer** | Web-specific connection UI, responsive layout, browser interaction patterns |
| **Scrum Master** | Create detailed stories from epic outlines, update sprint-status.yaml |
| **Development Team** | Implement Epics 15-19 |

### Recommended Next Steps

1. **Update PRD** — Add web target sections (new FRs, NFRs, user journey, distribution)
2. **Update Architecture** — Design server component, WebSocket bridge, auth model, Docker deployment
3. **Update UX Design** — Web connection manager, responsive layout, browser considerations
4. **Create detailed stories** — Break down Epics 15-19 into implementation-ready stories
5. **Update sprint-status.yaml** — Add Epics 15-19 to the backlog

### Success Criteria

- Web application serves the same grid editing experience as VS Code and Desktop
- User can connect to any reachable IRIS server from a browser
- Zero-install experience: navigate to URL -> enter credentials -> edit data
- All existing features work in the browser (CRUD, filtering, sorting, export/import, keyboard shortcuts)
- Secure credential handling (never stored server-side, encrypted in transit)
- Feature parity across all three targets verified
