# Sprint Change Proposal - Standalone Desktop Application

**Date:** 2026-02-13
**Author:** John (PM Agent)
**Initiated by:** Developer
**Change Scope:** Major — New product distribution target

---

## Section 1: Issue Summary

### Problem Statement

The IRIS Table Editor VS Code extension is complete (Epics 1-9, all done) and has generated interest from operations and support staff. These users need the same Excel-like table editing capability but have no reason to install VS Code — it's unnecessary overhead for non-developers.

### Context

- **Trigger:** Pull demand from ops/support staff who saw the VS Code version
- **Current pain:** Ops/support write raw SQL in IRIS Management Portal — high friction, error-prone
- **Opportunity:** Adoption window is open; users are excited and waiting
- **Constraint:** Must not disrupt the existing VS Code extension

### Evidence

- Operations and support staff confirmed as target users in original PRD (Sarah persona)
- VS Code is a barrier for non-developers who only need table editing
- The existing IRIS Management Portal provides no visual editing capability
- Users have explicitly requested a standalone version after seeing the VS Code demo

---

## Section 2: Impact Analysis

### Epic Impact

| Impact | Details |
|--------|---------|
| Existing Epics (1-9) | **No impact** — all complete, remain valid |
| New Epics Required | **5 new epics** (10-14) |
| Epics Invalidated | None |
| Epic Resequencing | None — new epics are additive |

**New Epics:**

| Epic | Title | Description |
|------|-------|-------------|
| Epic 10 | Monorepo Restructure & Shared Core Extraction | Restructure into packages/core, packages/webview, packages/vscode, packages/desktop |
| Epic 11 | Electron Shell & Window Management | Electron main process, BrowserWindow, IPC bridge, tabs, native menus |
| Epic 12 | Connection Manager | Server config CRUD, credential storage, test connection, connection lifecycle |
| Epic 13 | Build, Package & Distribution | electron-builder, Windows/macOS installers, auto-update, CI/CD |
| Epic 14 | Integration Testing & Feature Parity | Cross-platform verification, feature parity checklist, polish |

**Sequence:** 10 → 12 → 11 → 13 → 14 (Epic 10 is foundation, 12 is biggest new feature)

### Story Impact

No existing stories are modified. 19 new stories across 5 epics:

- Epic 10: 4 stories (monorepo init, core extraction, webview extraction, regression verification)
- Epic 11: 5 stories (bootstrap, IPC bridge, tab bar, native menu, window state)
- Epic 12: 5 stories (server list UI, server form, test connection, credential storage, connection lifecycle)
- Epic 13: 4 stories (builder config, auto-update, CI/CD pipeline, code signing)
- Epic 14: 3 stories (feature parity, cross-platform testing, desktop polish)

### Artifact Conflicts

| Artifact | Impact Level | Changes Needed |
|----------|-------------|----------------|
| PRD | Medium | Expand product definition, add desktop FRs (FR39-FR50), add desktop NFRs (NFR19-NFR24) |
| Architecture | High | Add monorepo structure, Electron architecture, IPC bridge, theme abstraction, credential storage patterns |
| UX Design | Medium | Add Connection Manager UI (server list, server form, first-run), desktop navigation layout |
| Epics | High | Add 5 new epics with 19 stories |
| Sprint Status | Low | Add new epic/story entries |
| Build/CI | High | Monorepo build pipeline, platform-specific builds, dual-target CI |
| Documentation | Medium | Separate README for desktop app, installation guide for non-developers |

### Technical Impact

**Codebase reuse analysis:**

| Component | Reuse | Notes |
|-----------|-------|-------|
| Webview UI (grid, editing, filtering, sorting, shortcuts, export/import) | 100% | Runs identically in Electron renderer |
| Services (AtelierApiService, QueryExecutor, TableMetadataService) | 100% | Pure TypeScript, no VS Code deps |
| Utils (SqlBuilder, UrlBuilder, ErrorHandler, DataTypeFormatter, etc.) | 100% | Pure TypeScript |
| Models/Interfaces | 100% | Pure TypeScript |
| CSS (styles.css) | ~95% | Needs --vscode-* → --ite-* variable abstraction |
| ServerConnectionManager | 0% | Entirely VS Code Server Manager dependent, must rebuild |
| TableEditorProvider | 0% | VS Code WebviewViewProvider, must rebuild as Electron IPC handler |
| extension.ts | 0% | VS Code activation, replaced by Electron main.ts |

**Estimated reuse: ~80% of total codebase**

---

## Section 3: Recommended Approach

### Selected Path: New Product Phase (Electron + Monorepo)

Create a standalone Electron desktop application that shares core logic and webview UI with the VS Code extension via a monorepo structure.

### Rationale

1. **Maximum code reuse (~80%)** — The hard work (grid engine, CRUD, filtering, keyboard shortcuts, export/import) is already done and ports directly
2. **No risk to existing product** — VS Code extension continues to work unchanged; new epics are purely additive
3. **Same tech stack** — TypeScript/Node.js throughout, no new languages required
4. **Proven architecture** — VS Code itself is Electron; the message-passing pattern maps naturally from webview↔extension to renderer↔main
5. **Pull demand** — Users are waiting; adoption window is open
6. **Concentrated new work** — Only 3 areas need real development: connection manager, Electron shell, and theme abstraction

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop shell | Electron 28+ | Same tech stack, proven for this use case, multi-window native |
| Codebase structure | Monorepo (npm workspaces) | Bug fixes flow to both targets, single source of truth |
| Message bridge | IMessageBridge abstraction | Webview code never knows which target it's running in |
| Theme system | --ite-* CSS variable abstraction | Each target provides values; styles.css is shared |
| Credential storage | Electron safeStorage API | OS-level encryption, never plaintext on disk |
| Window model | Single window with tabs (MVP) | Simpler, matches VS Code paradigm users know |
| Auto-update | electron-updater + GitHub Releases | Free, aligns with open source distribution |
| Packaging | electron-builder | Industry standard, Windows + macOS support |

### Alternatives Considered

| Alternative | Verdict | Reason |
|-------------|---------|--------|
| Tauri (Rust backend) | Rejected | New language, different IPC patterns, less mature for this use case |
| Separate repo/fork | Rejected | Divergence pain, duplicate bug fixes, maintenance burden |
| Web app | Rejected | User requested desktop executable; web app doesn't meet distribution goal |

### Trade-offs

| Trade-off | Mitigation |
|-----------|------------|
| Electron binary size (~150MB) | Acceptable for desktop ops/support machines; not a mobile app |
| Monorepo complexity | npm workspaces is well-understood; turborepo optional for build optimization |
| Theme abstraction migration | One-time effort in Epic 10; automated find-replace for CSS variables |
| Code signing logistics | Story 13.4 marked optional; can ship unsigned initially with known warnings |

### Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Monorepo restructure breaks VS Code extension | High | Story 10.4 is dedicated regression verification; restructure is incremental |
| Theme abstraction introduces visual regressions | Medium | Side-by-side comparison testing in Story 10.3 |
| Credential security in standalone app | Medium | Use OS-provided encryption (safeStorage), never custom crypto |
| Cross-platform inconsistencies | Low | Electron abstracts most platform differences; Story 14.2 covers testing |
| Auto-update mechanism reliability | Low | electron-updater is battle-tested; fallback is manual download |

---

## Section 4: Detailed Change Proposals

### PRD Changes

1. **Executive Summary** — Expand from "VS Code extension" to "multi-target tool" with both distribution models
2. **Target Audience** — Add ops/support staff (standalone desktop) as explicit audience segment
3. **Success Criteria** — Add desktop-specific milestones (6-month ops adoption, 12-month cross-team standard)
4. **Technical Stack** — Add Electron, electron-builder, safeStorage, monorepo tooling with target column
5. **Compatibility** — Add Windows 10+, macOS 11+ requirements for desktop target
6. **Installation Methods** — Add Windows .exe, macOS .dmg, portable .zip
7. **New FRs (FR39-FR50)** — Connection management (FR39-44), window management (FR45-47), application lifecycle (FR48-50)
8. **New NFRs (NFR19-NFR24)** — Desktop performance, security, reliability requirements

### Architecture Changes

1. **Project Structure** — Replace flat directory with monorepo: packages/core, packages/webview, packages/vscode, packages/desktop
2. **IPC Bridge** — Add IMessageBridge abstraction with VS Code and Electron implementations
3. **Theme Abstraction** — Add --ite-* CSS variable layer with target-specific bridge files
4. **Electron Architecture** — Add main process design: context isolation, preload script, IPC handlers
5. **Credential Storage** — Add safeStorage pattern for OS keychain integration
6. **Auto-Update** — Add electron-updater strategy
7. **Window Management** — Add single-window-with-tabs MVP model

### UX Design Changes

1. **Connection Manager** — Server list screen, server form (add/edit), test connection flow
2. **First-Run Experience** — Welcome screen with guided server setup
3. **Desktop Navigation** — Sidebar with connections section, tab bar for tables
4. **Window Chrome** — Native title bar and menu bar specifications

### Epics Changes

1. **Epic 10** — Monorepo Restructure & Shared Core Extraction (4 stories)
2. **Epic 11** — Electron Shell & Window Management (5 stories)
3. **Epic 12** — Connection Manager (5 stories)
4. **Epic 13** — Build, Package & Distribution (4 stories)
5. **Epic 14** — Integration Testing & Feature Parity (3 stories)

---

## Section 5: Implementation Handoff

### Change Scope Classification: Major

This is a fundamental expansion of the product — adding a new distribution target with its own shell, connection management, and build pipeline. Requires PM + Architect + Dev coordination.

### Handoff Plan

| Role | Responsibility |
|------|----------------|
| **Product Manager** | Update PRD with approved changes (FR39-50, NFR19-24, success criteria) |
| **Architect** | Update Architecture document (monorepo structure, Electron architecture, IPC bridge, theme abstraction, credential storage) |
| **UX Designer** | Update UX spec with Connection Manager flows and desktop navigation |
| **Scrum Master** | Update sprint-status.yaml with new Epics 10-14 and stories; create story files via create-story workflow |
| **Developer** | Implement Epics 10-14 in sequence |

### Implementation Sequence

```
Epic 10: Monorepo Restructure (FOUNDATION — must come first)
  ↓
Epic 12: Connection Manager (biggest new feature, unblocks app)
  ↓
Epic 11: Electron Shell (assembles the app using 10 + 12)
  ↓
Epic 13: Build & Distribution (makes it installable)
  ↓
Epic 14: Testing & Polish (validates everything)
```

### Success Criteria

- [ ] VS Code extension builds and functions identically after restructure
- [ ] Desktop app launches in < 3 seconds
- [ ] Connection manager supports add/edit/delete/test with secure credential storage
- [ ] All 24 feature parity checkpoints pass (Story 14.1)
- [ ] Windows .exe and macOS .dmg installers produced by CI
- [ ] Auto-update delivers new versions without manual reinstall
- [ ] Ops/support staff can go from install to first edit in < 60 seconds

---

*Generated by Course Correction workflow, 2026-02-13*
