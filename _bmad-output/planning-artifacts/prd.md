---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain-skipped
  - step-06-innovation-skipped
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
inputDocuments:
  - docs/initial-prompt.md
documentCounts:
  briefs: 0
  research: 0
  projectDocs: 1
workflowType: 'prd'
projectType: 'greenfield'
classification:
  projectType: developer_tool
  projectTypeDetail: VS Code Extension + Standalone Desktop Application + Web-Hosted Application
  domain: general
  domainDetail: Developer Tooling
  complexity: medium
  distribution: open_source_marketplace
  distributionTargets:
    - VS Code Marketplace (extension)
    - GitHub Releases (desktop installer)
    - Centralized web URL (browser)
  targetAudience:
    - IRIS developers (VS Code extension)
    - Operations and support staff (standalone desktop)
    - Operations/support/any staff (web browser)
---

# Product Requirements Document - iris-table-editor

**Author:** Developer
**Date:** 2026-01-26

## Executive Summary

**IRIS Table Editor** is a multi-target tool for visual editing of InterSystems IRIS database tables without writing SQL. It provides an Excel-like grid interface available as a **VS Code extension** for developers, a **standalone desktop application** (Windows/macOS) for operations and support staff, and a **web-hosted application** for zero-install browser access.

**Core Value Proposition:** Edit IRIS table data in 30 seconds instead of minutes spent writing SQL queries — regardless of whether users have VS Code installed.

**Target Users:**
- **IRIS developers** — VS Code extension integrated into their existing development environment
- **Operations and support staff** — Standalone desktop application with built-in connection management, no VS Code required
- **Web users** — Any user with a browser and network access to IRIS

**Distribution:** Open source. VS Code extension via Marketplace; desktop application via GitHub Releases (Windows .exe, macOS .dmg); web application via centralized hosted URL.

**Key Dependencies:** Atelier REST API (all targets). InterSystems Server Manager extension (VS Code target only). Electron (desktop target). Node.js server with Express/Fastify (web target).

## Success Criteria

### User Success

- **Primary Value**: Users can view and edit IRIS table data in an Excel-like grid without writing SQL
- **Aha Moment**: First successful inline edit and save - "I just changed a value and hit save, no SQL required"
- **Pain Eliminated**: No more writing manual UPDATE/INSERT statements for simple data changes
- **Target Experience (VS Code)**: Browse → Select table → View grid → Edit cell → Save — all within VS Code
- **Target Experience (Desktop)**: Launch app → Connect to server → Select table → Edit → Save — no IDE required
- **Target Experience (Web)**: Navigate to URL → Enter credentials → Select table → Edit → Save — zero installation

### Business Success

| Milestone | Target | Indicators |
|-----------|--------|------------|
| 3 months | Internal dev adoption | Development team actively using VS Code extension daily instead of manual SQL |
| 6 months | Ops/support adoption | Operations and support staff using standalone desktop app for routine data fixes |
| 12 months | Community adoption | External users installing from VS Code Marketplace and GitHub Releases, positive reviews (4+ stars) |
| 6 months | Zero-install adoption | Staff using web app for ad-hoc data edits without installing anything |
| 12 months | Cross-team standard | Both developer and operations teams using IRIS Table Editor as primary data editing tool |

### Technical Success

- Server Manager integration works seamlessly for authentication (VS Code target)
- Built-in connection manager with secure credential storage (desktop target)
- All CRUD operations use HTTP-only Atelier API (no superserver port required)
- Secure credential handling — VS Code auth provider (extension) / OS keychain via safeStorage (desktop)
- SQL injection prevention through parameterized queries
- Responsive performance with tables up to 1000+ rows (MVP)
- Full support for light and dark themes via abstracted CSS variable layer
- Shared core logic and webview UI across both targets (~80% code reuse)
- **(Growth - Epic 6)** Scalable navigation for namespaces with thousands of tables
- **(Growth - Epic 6)** Efficient handling of tables with millions of rows via server-side operations
- **(Growth - Epic 7)** Type-appropriate controls for boolean, date, time, numeric, and NULL values
- **(Growth - Epic 8)** Full keyboard navigation and editing without mouse dependency
- **(Growth - Epic 9)** Reliable CSV/Excel export and import for bulk data operations
- **(Desktop - Epic 10-14)** Monorepo structure enabling single-source bug fixes across both targets
- **(Desktop - Epic 11)** Desktop app launches in under 3 seconds
- **(Desktop - Epic 12)** Connection manager supports add/edit/delete/test with OS-encrypted credentials
- **(Desktop - Epic 14)** Feature parity across 24 checkpoints between VS Code and desktop targets
- **(Web - Epic 15)** Node.js server proxies Atelier API securely with session management
- **(Web - Epic 16)** Browser-based connection form with session-scoped credential handling
- **(Web - Epic 17)** WebSocket-based IMessageBridge enables real-time browser↔server communication
- **(Web - Epic 18)** Docker containerization enables single-command deployment
- **(Web - Epic 19)** Feature parity across all three targets verified (24+ checkpoints)

### Measurable Outcomes

- Users can complete a data edit in under 30 seconds (vs. minutes writing SQL)
- Zero credential exposure in logs or extension state
- Extension loads table data within 2 seconds for typical tables (<500 rows)
- **(Growth - Epic 6)** Page navigation completes within 1 second for tables with millions of rows
- **(Growth - Epic 6)** Filter and sort operations complete within 2 seconds
- **(Growth - Epic 7)** Boolean edits complete with single click (no typing required)
- **(Growth - Epic 8)** Power users can perform common operations without leaving keyboard
- **(Growth - Epic 9)** Export 10,000 rows to CSV in under 10 seconds
- **(Growth - Epic 9)** Import 10,000 rows from CSV in under 30 seconds
- **(Desktop - Epic 11)** Desktop app launches in under 3 seconds on standard hardware
- **(Desktop - Epic 12)** Ops/support staff can go from install to first edit in under 60 seconds
- **(Desktop - Epic 14)** All 24 feature parity checkpoints pass between VS Code and desktop targets
- **(Web - Epic 15)** API proxy responds within 500ms for typical requests
- **(Web - Epic 17)** Web app loads and is interactive within 3 seconds
- **(Web - Epic 19)** All 24 feature parity checkpoints pass across three targets

## Product Scope

### MVP - Minimum Viable Product

- Connect to IRIS server via InterSystems Server Manager
- Browse and select tables within a namespace
- Display table data in Excel-like grid (vscode-data-grid)
- Inline cell editing with save (UPDATE)
- Insert new rows via form/dialog (INSERT)
- Delete rows with confirmation (DELETE)
- Basic error handling with user-friendly messages
- Light and dark theme support

### Growth Features (Post-MVP)

**Scalability & Advanced Navigation (Epic 6) - COMPLETE:**
- Schema-based table tree view with collapsible folder hierarchy for namespaces with thousands of tables
- Inline column filtering with smart UI: checklist for low-cardinality columns (≤10 values), text input with wildcard support (* and ?) for high-cardinality columns
- Filter panel with advanced operators (contains, starts with, equals, greater than, less than, is empty, etc.)
- Filter toggle to disable/enable filters without losing criteria
- Column sorting via header click (ascending/descending/clear)
- Enhanced pagination with First, Previous, page number input, Next, Last buttons
- Server-side filtering, sorting, and pagination for tables with millions of rows
- Lazy loading verification ensuring only current page is fetched

**Data Type Polish (Epic 7):**
- Boolean fields display as clickable checkboxes (toggle with single click, no typing 1/0)
- Date fields with calendar picker popup and flexible format recognition (YYYY-MM-DD, MM/DD/YYYY, etc.)
- Time fields accepting common formats (HH:MM, 2:30 PM, HH:MM:SS)
- Timestamp/DateTime fields with combined date-time picker
- Numeric fields with right-alignment, thousands separators display, and input validation
- NULL values displayed distinctly (italic gray "NULL") vs. empty strings (blank)
- Explicit NULL entry via context menu or keyboard shortcut (Ctrl+Shift+N)

**Keyboard Shortcuts (Epic 8):**
- Grid navigation: Arrow keys, Tab/Shift+Tab, Home/End, Ctrl+Home/End, Page Up/Down
- Cell editing: F2 to edit, Enter/Tab to save+move, Escape to cancel, Ctrl+Enter to save+stay
- Row operations: Ctrl+Plus to insert, Ctrl+Minus to delete, Ctrl+D to duplicate
- Data operations: F5 to refresh, Ctrl+C/V to copy/paste, Ctrl+F to focus filter
- Shortcut discovery: Help panel, tooltips showing shortcuts on toolbar buttons

**CSV/Excel Export & Import (Epic 9):**
- Export current page, all data, or filtered results to CSV
- Export to Excel format (.xlsx) with proper data types and formatting
- Import from CSV with column mapping, preview, and validation
- Import from Excel with sheet selection
- Pre-import validation with error reporting and partial import options
- Large dataset handling with streaming, progress indicators, and cancellation support

### Standalone Desktop Application (Epics 10-14)

**Monorepo Restructure (Epic 10):**
- Restructure into monorepo: packages/core, packages/webview, packages/vscode, packages/desktop
- Extract shared services, models, and utilities into packages/core
- Extract shared webview UI into packages/webview with abstracted theme variables
- Verify VS Code extension builds and functions identically after restructure

**Electron Shell & Window Management (Epic 11):**
- Electron main process with context isolation and secure preload script
- IPC bridge implementing IMessageBridge abstraction (same interface as VS Code messaging)
- Tab bar for multiple open tables within single window
- Native menu bar with standard application menus
- Window state persistence (position, size, last connection)

**Connection Manager (Epic 12):**
- Server list UI with add/edit/delete operations
- Server form with hostname, port, namespace, username/password fields
- Test connection functionality with timeout and cancel
- Credential storage via Electron safeStorage (OS keychain encryption)
- Connection lifecycle management (connect, disconnect, reconnect)

**Build, Package & Distribution (Epic 13):**
- electron-builder configuration for Windows .exe and macOS .dmg
- Auto-update via electron-updater + GitHub Releases
- CI/CD pipeline for dual-target builds
- Code signing (optional — can ship unsigned initially)

**Integration Testing & Feature Parity (Epic 14):**
- Feature parity verification across 24 checkpoints
- Cross-platform testing (Windows + macOS)
- Desktop-specific polish (first-run experience, native feel)

### Web-Hosted Application (Epics 15-19)

**Web Server Foundation (Epic 15):**
- Node.js server (Express/Fastify) serving the web application
- Atelier API proxy forwarding requests to user-specified IRIS servers
- WebSocket server for IMessageBridge communication between browser and server
- Security middleware: CORS, CSRF protection, rate limiting, helmet headers
- Session management with JWT or cookie-based sessions

**Web Authentication & Connection Management (Epic 16):**
- Browser-based connection form (hostname, port, namespace, credentials)
- Session-scoped credential handling (credentials stored in browser session, passed per API call)
- Connection test with timeout and cancel support via server proxy
- Multi-connection support (switch between IRIS servers within a session)
- Session persistence and auto-reconnect on page reload

**Web Application Shell & Message Bridge (Epic 17):**
- Serve shared webview as a single-page application from packages/web
- WebSocket-based IMessageBridge implementation (browser sends commands, receives events via WebSocket)
- Web theme bridge with light/dark tokens and prefers-color-scheme detection
- Full-window responsive grid layout optimized for browser viewport
- Tab management for multiple open tables with URL-based navigation

**Web Build, Deploy & Distribution (Epic 18):**
- Docker containerization with multi-stage build
- Environment configuration (IRIS server allowlists, TLS settings, port config)
- CI/CD pipeline for web target (GitHub Actions)
- HTTPS/TLS configuration with reverse proxy setup
- Health check endpoints and structured logging

**Web Integration Testing & Feature Parity (Epic 19):**
- Feature parity verification across all three targets (24+ checkpoints)
- Browser compatibility testing (Chrome, Firefox, Safari, Edge)
- Performance testing with concurrent user load
- Security audit (OWASP top 10, credential handling, proxy security)
- Web-specific polish (loading states, offline detection, responsive edge cases)

### Vision (Future)

- Query builder UI for custom SELECT queries
- Schema/relationship visualization
- Custom SQL execution panel
- Multiple namespace support
- Auto-refresh capability
- Multi-window support for desktop (multiple independent windows)

## User Journeys

### Journey 1: Developer - Daily Development Flow

**Persona: Marcus, Backend Developer**

Marcus is building a healthcare integration using IRIS. He's just written code that should insert patient records into a staging table.

- **Opening Scene**: Marcus runs his code. Did it work? He needs to check the data. Currently, he'd have to open Management Portal in a browser, navigate to the SQL explorer, write a SELECT query...
- **Rising Action**: Instead, Marcus clicks the IRIS Table Editor in VS Code sidebar. He selects his dev server, picks the `Staging.PatientRecords` table. The grid loads instantly.
- **Climax**: He spots a typo in one record - "Jhon" instead of "John". He double-clicks the cell, fixes it, hits Tab. Done. No SQL written.
- **Resolution**: Marcus continues coding. The round-trip that used to take 2 minutes now takes 10 seconds.

**Capabilities Revealed**: Server selection, table browsing, grid display, inline cell editing, quick save

---

### Journey 2: Operations User - Production Data Fix

**Persona: Sarah, Application Support Specialist**

Sarah gets a support ticket: "Customer record has wrong email address, causing notification failures."

- **Opening Scene**: Sarah needs to fix one field in production. The old way: request database access, write an UPDATE statement, get it reviewed, run it carefully...
- **Rising Action**: Sarah opens VS Code with IRIS Table Editor already connected to the production server. She browses to the customer table and locates the record.
- **Climax**: She finds the record, sees the typo in the email field. She edits it inline, confirms the change.
- **Resolution**: Ticket resolved in 3 minutes instead of 30. Customer starts receiving notifications.

**Capabilities Revealed**: Production server connection, table navigation, record location, inline editing, change confirmation

---

### Journey 3: Developer - Error Recovery

**Persona: Marcus encounters a constraint violation**

- **Opening Scene**: Marcus tries to update a row, but the save fails.
- **Rising Action**: The extension displays a clear, user-friendly error: "Constraint violation: Email must be unique"
- **Climax**: Marcus realizes another record has the same email. He searches the table, finds the duplicate, and resolves the conflict.
- **Resolution**: Marcus appreciates that the error was clear and actionable, not a cryptic SQL error code.

**Capabilities Revealed**: Clear error messaging, error recovery guidance, data search/filtering

---

### Journey 4: Developer - Bulk Data Migration (Growth)

**Persona: Marcus needs to load test data**

Marcus is setting up a test environment and needs to load 5,000 patient records from an Excel spreadsheet provided by the QA team.

- **Opening Scene**: Marcus has an Excel file with test data. The old way: write an import script, handle data type conversions, deal with errors one by one...
- **Rising Action**: Marcus opens the target table in IRIS Table Editor. He clicks "Import" and selects the Excel file. The extension shows a preview with column mapping.
- **Climax**: The import validates all rows upfront, showing 3 rows with date format issues. Marcus fixes those in Excel and re-imports. All 5,000 rows load successfully with a progress bar.
- **Resolution**: Test environment populated in 5 minutes instead of an hour writing import code.

**Capabilities Revealed**: Excel import, column mapping, bulk validation, progress feedback, error reporting

---

### Journey 5: Power User - Keyboard-First Workflow (Growth)

**Persona: Sarah becomes a power user**

After using IRIS Table Editor daily, Sarah wants to work faster without constantly switching between keyboard and mouse.

- **Opening Scene**: Sarah needs to update 20 records quickly. She knows where they are but reaching for the mouse each time is slowing her down.
- **Rising Action**: Sarah uses Ctrl+F to filter, arrow keys to navigate, F2 to edit, Tab to save and move. She never touches the mouse.
- **Climax**: She presses Ctrl+/ to see the shortcut help, learns Ctrl+D to duplicate a row, and completes her updates in half the usual time.
- **Resolution**: Sarah's productivity doubles. She exports the updated data to CSV for her report using Ctrl+E (shortcut for export).

**Capabilities Revealed**: Keyboard navigation, keyboard shortcuts, shortcut discovery, keyboard-driven export

---

### Journey 6: Operations User - Standalone Desktop (Desktop Target)

**Persona: Sarah, Application Support Specialist (no VS Code)**

Sarah's team has adopted IRIS Table Editor but she doesn't use VS Code for any other purpose. Installing an entire IDE just for table editing feels like overkill.

- **Opening Scene**: Sarah downloads the IRIS Table Editor desktop app from the team's shared drive. She runs the installer — it takes 30 seconds.
- **Rising Action**: On first launch, a welcome screen guides her through adding her first server connection. She enters the hostname, port, and credentials. She clicks "Test Connection" and sees a green checkmark.
- **Climax**: Sarah selects the production namespace, picks the customer table, and sees the same familiar grid she saw in the VS Code demo. She fixes the email address from the support ticket, saves, done.
- **Resolution**: Sarah resolves 5 tickets that afternoon using the standalone app. No IDE installation, no learning curve beyond the grid she already understood.

**Capabilities Revealed**: Desktop installer, first-run setup, connection manager, credential storage, feature parity with VS Code

---

### Journey 7: Web User - Zero-Install Data Editing

**Persona: Alex, Database Administrator**

Alex manages several IRIS instances across the organization. He needs to make quick data fixes from any computer without installing software.

- **Opening Scene**: Alex gets a call about incorrect data in a production table. He's at a colleague's computer with no VS Code or IRIS Table Editor installed.
- **Rising Action**: Alex opens a browser, navigates to the team's IRIS Table Editor web URL. He enters the production server credentials and clicks Connect.
- **Climax**: The familiar grid loads instantly. Alex finds the incorrect record, double-clicks the cell, fixes the value, and presses Tab. Done — exactly the same experience as the VS Code extension and desktop app.
- **Resolution**: Alex resolves the issue in 2 minutes from an unfamiliar computer. No installation required, no admin rights needed, no setup time.

**Capabilities Revealed**: Zero-install browser access, web connection form, credential handling, feature parity with other targets

---

### Journey Requirements Summary

| Capability | Revealed By Journey |
|------------|---------------------|
| Server selection & connection | Marcus (J1), Sarah (J2) |
| Table browsing & selection | Marcus (J1), Sarah (J2) |
| Grid data display | All journeys |
| Inline cell editing | Marcus (J1), Sarah (J2), Sarah Power (J5), Sarah Desktop (J6) |
| Quick save (UPDATE) | Marcus (J1), Sarah (J2), Sarah Desktop (J6) |
| User-friendly error messages | Marcus - Error (J3) |
| Change confirmation | Sarah (J2) |
| **(Growth)** Excel/CSV import | Marcus Bulk (J4) |
| **(Growth)** Column mapping & validation | Marcus Bulk (J4) |
| **(Growth)** Progress feedback | Marcus Bulk (J4) |
| **(Growth)** Keyboard navigation | Sarah Power (J5) |
| **(Growth)** Keyboard shortcuts | Sarah Power (J5) |
| **(Growth)** Shortcut discovery | Sarah Power (J5) |
| **(Growth)** CSV/Excel export | Sarah Power (J5) |
| **(Desktop)** Desktop installer | Sarah Desktop (J6) |
| **(Desktop)** First-run setup | Sarah Desktop (J6) |
| **(Desktop)** Connection manager | Sarah Desktop (J6) |
| **(Desktop)** Credential storage | Sarah Desktop (J6) |
| **(Desktop)** Feature parity | Sarah Desktop (J6) |
| **(Web)** Zero-install browser access | Alex Web (J7) |
| **(Web)** Web connection form | Alex Web (J7) |
| **(Web)** Session-scoped credentials | Alex Web (J7) |
| **(Web)** Feature parity | Alex Web (J7) |

## Developer Tool Specific Requirements

### Project-Type Overview

IRIS Table Editor is a **multi-target tool** providing visual database editing capabilities for InterSystems IRIS. It ships as a **VS Code extension** (for developers), a **standalone Electron desktop application** (for operations/support staff), and a **web-hosted application** (for zero-install browser access). All three targets share core logic and webview UI via a monorepo structure, connecting to IRIS through the Atelier REST API.

### Technical Stack

| Component | Technology | Target |
|-----------|------------|--------|
| Language | TypeScript | Both |
| Runtime | Node.js 20+ | Both |
| Package Manager | npm (workspaces) | Both |
| Build Tool | esbuild | Both |
| Codebase Structure | Monorepo (npm workspaces) | Both |
| IDE Platform | VS Code 1.85.0+ | VS Code |
| Desktop Shell | Electron 28+ | Desktop |
| UI Framework | VS Code Webview API | VS Code |
| UI Framework | Electron BrowserWindow | Desktop |
| Data Grid | Custom grid component | Both (shared webview) |
| API Layer | Atelier REST API (HTTP-based) | Both |
| Message Bridge | IMessageBridge abstraction | Both |
| Theme System | `--ite-*` CSS variable abstraction | Both |
| Credential Storage | Server Manager auth provider | VS Code |
| Credential Storage | Electron safeStorage API | Desktop |
| Packaging | vsce (VS Code), electron-builder (desktop) | Per-target |
| Auto-Update | electron-updater + GitHub Releases | Desktop |
| Web Shell | Express/Fastify (Node.js) | Web |
| Real-time Communication | WebSocket (ws) | Web |
| Message Bridge | WebMessageBridge (WebSocket) | Web |
| Credential Handling | Browser SessionStorage | Web |
| Containerization | Docker + docker-compose | Web |
| Reverse Proxy | nginx/caddy | Web |
| Session Management | JWT or cookie-based | Web |

### VS Code Integration

- **Extension Type**: WebviewViewProvider (sidebar panel)
- **Activation**: On command or when view is opened
- **Extension Dependency**: `intersystems-community.servermanager`
- **Authentication**: Delegated to Server Manager's authentication provider
- **Commands**:
  - `iris-table-editor.openTableEditor` - Launch editor
  - `iris-table-editor.editTable` - Context menu integration

### Desktop Application Architecture

- **Window Model**: Single window with tab bar (MVP)
- **Security**: Context isolation enabled, nodeIntegration disabled, preload script with contextBridge
- **IPC**: Typed channels via IMessageBridge abstraction (same interface as VS Code webview messaging)
- **Connection Management**: Built-in server list, add/edit/delete/test connections
- **Credential Storage**: OS keychain via Electron safeStorage (Windows Credential Manager / macOS Keychain)
- **Theme System**: Light/dark mode toggle with `--ite-*` CSS variables mapped to hardcoded design tokens

### Web Application Architecture

- **Server Model**: Node.js Express/Fastify server proxying Atelier API requests
- **Communication**: WebSocket-based IMessageBridge (browser↔server real-time messaging)
- **Security**: CORS policy, CSRF protection, rate limiting, helmet security headers
- **Authentication**: Session-based (JWT/cookie), credentials stored in browser SessionStorage
- **Credential Flow**: Browser → server proxy → IRIS (credentials never stored server-side)
- **Theme System**: Light/dark toggle via `--ite-*` CSS variables + `prefers-color-scheme` detection
- **Deployment**: Docker container with nginx/caddy reverse proxy for TLS termination

### Installation Methods

| Method | Description | Target |
|--------|-------------|--------|
| VS Code Marketplace | Primary distribution for developers | VS Code |
| .vsix package | Manual installation for offline/enterprise | VS Code |
| Windows .exe installer | Desktop app for Windows 10+ | Desktop |
| macOS .dmg installer | Desktop app for macOS 11+ | Desktop |
| Portable .zip | No-install option for locked-down machines | Desktop |
| Web URL | Navigate to hosted URL in any browser | Web |
| Docker deployment | docker-compose for self-hosting | Web |
| Source build | `npm run compile` for development | Both |

### Compatibility Requirements

| Dependency | Minimum Version | Target |
|------------|-----------------|--------|
| VS Code | 1.85.0+ | VS Code |
| Node.js | 20+ | Both |
| InterSystems IRIS | 2021.1+ | Both |
| Server Manager Extension | Latest | VS Code |
| Electron | 28+ | Desktop |
| Windows | 10+ | Desktop |
| macOS | 11+ (Big Sur) | Desktop |
| Chrome | Latest 2 versions | Web |
| Firefox | Latest 2 versions | Web |
| Safari | Latest 2 versions | Web |
| Edge | Latest 2 versions | Web |

### Documentation Requirements

- **README.md**: Installation, quickstart guide, screenshots, feature overview (per target)
- **CHANGELOG.md**: Version history and release notes (shared)
- **Marketplace Description**: Feature highlights, requirements, usage examples (VS Code)
- **Desktop Install Guide**: Download, install, first-run setup for non-developer audience
- **In-app**: Tooltips on UI elements, clear error messages (both targets)

### Implementation Considerations

- **Security (VS Code)**: Credentials handled by Server Manager (never stored in extension state)
- **Security (Desktop)**: Credentials encrypted via OS keychain (safeStorage API), never plaintext on disk
- **Performance**: Lazy loading of table data, pagination for large datasets
- **Theming**: Abstracted `--ite-*` CSS variables with per-target bridge files
- **Error Handling**: User-friendly messages, no raw SQL errors exposed
- **Code Sharing**: Monorepo with shared core (services, models, utils) and shared webview (UI, styles)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP
- Deliver working solution to the core pain: visual table editing without SQL
- Reliability over polish - CRUD operations must work correctly
- Leverage existing ecosystem (Server Manager) to reduce scope

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Developer daily workflow (Marcus - J1)
- Operations data fix (Sarah - J2)
- Error recovery (Marcus - J3)

**Must-Have Capabilities:**
- Server Manager integration for authentication
- Namespace and table browsing
- Excel-like grid data display
- Inline cell editing with UPDATE
- Row insertion with INSERT
- Row deletion with DELETE (confirmation required)
- User-friendly error messages
- VS Code theme compatibility

### Post-MVP Features

**Phase 2 (Growth):**
- Pagination for large tables
- Keyboard shortcuts
- Column sorting and filtering
- Performance optimization
- Multiple namespace support
- Auto-refresh

**Phase 3 (Expansion):**
- Query builder UI
- Export to CSV/Excel
- Schema visualization
- Custom SQL execution panel

### Risk Mitigation Strategy

| Risk Type | Level | Mitigation |
|-----------|-------|------------|
| Technical | Low | Atelier API is stable; Server Manager provides auth |
| Market | Low | Clear gap - no existing solution |
| Resource | Low | MVP scope appropriate for solo/small team |

## Functional Requirements

### Server Connection

- **FR1**: User can view a list of available IRIS servers from Server Manager
- **FR2**: User can select an IRIS server to connect to
- **FR3**: User can authenticate with the selected server using Server Manager credentials
- **FR4**: User can see the current connection status (connected/disconnected)
- **FR4a**: Connection attempts must timeout after a configurable period (default: 30 seconds) and display a cancel option during the attempt. On timeout, the user is presented with "Retry" and "Select Different Server" options.
- **FR5**: User can disconnect from the current server

### Table Navigation

- **FR6**: User can view a list of namespaces available on the connected server
- **FR7**: User can select a namespace to browse
- **FR8**: User can view a list of tables within the selected namespace
- **FR9**: User can select a table to view its data
- **FR10**: User can refresh the table list

### Data Display

- **FR11**: User can view table data in an Excel-like grid format
- **FR12**: User can see column headers with column names
- **FR13**: User can scroll through table rows
- **FR14**: User can see data formatted appropriately for its type (text, numbers, dates)
- **FR15**: User can refresh table data to see latest changes

### Data Editing

- **FR16**: User can edit a cell value by clicking/double-clicking on it
- **FR17**: User can save changes to a single cell (UPDATE operation)
- **FR18**: User can cancel an edit before saving
- **FR19**: User can see visual feedback when a cell has unsaved changes
- **FR20**: System confirms successful save operations

### Data Creation

- **FR21**: User can initiate creation of a new row
- **FR22**: User can enter values for each column in the new row
- **FR23**: User can save the new row (INSERT operation)
- **FR24**: User can cancel new row creation before saving
- **FR25**: System validates required fields before saving

### Data Deletion

- **FR26**: User can select a row for deletion
- **FR27**: User can confirm deletion before it executes
- **FR28**: User can cancel deletion at confirmation prompt
- **FR29**: System executes DELETE operation upon confirmation
- **FR30**: System confirms successful deletion

### Error Handling

- **FR31**: System displays error messages that identify the failed operation and suggest resolution steps
- **FR32**: System shows specific error context (which operation failed and why)
- **FR33**: User can dismiss error notifications
- **FR34**: System prevents operations that would violate database constraints (with messages identifying the specific constraint violated)

### User Interface

- **FR35**: Extension displays correctly in VS Code light theme
- **FR36**: Extension displays correctly in VS Code dark theme
- **FR37**: User can access the table editor from VS Code sidebar
- **FR38**: User can access the table editor via command palette

### Desktop Connection Management (Desktop Target)

- **FR39**: User can view a list of saved IRIS server connections
- **FR40**: User can add a new server connection (hostname, port, namespace, credentials)
- **FR41**: User can edit an existing server connection
- **FR42**: User can delete a saved server connection with confirmation
- **FR43**: User can test a server connection before saving (with timeout and cancel)
- **FR44**: User can see connection test results (success with server version, or failure with actionable error)

### Desktop Window Management (Desktop Target)

- **FR45**: User can open multiple tables in tabs within a single window
- **FR46**: User can switch between open table tabs
- **FR47**: User can close individual table tabs

### Desktop Application Lifecycle (Desktop Target)

- **FR48**: Application remembers window position, size, and last-used connection on restart
- **FR49**: Application checks for updates on startup and notifies user when an update is available
- **FR50**: Application provides a first-run welcome screen with guided server setup

### Web Connection Management (Web Target)

- **FR51**: User can enter IRIS server connection details (hostname, port, namespace, credentials) in a browser form
- **FR52**: User can test a server connection via the web proxy with timeout and cancel
- **FR53**: User can save connection details to browser session for the current session
- **FR54**: User can switch between multiple configured IRIS server connections
- **FR55**: User can reconnect automatically when reloading the page (if session is active)

### Web Application Shell (Web Target)

- **FR56**: User can access the table editor by navigating to a URL in any modern browser
- **FR57**: User can open multiple tables in browser tabs within the application
- **FR58**: User can bookmark specific table views via URL state
- **FR59**: User can use browser back/forward navigation between table views
- **FR60**: User can toggle between light and dark themes (with system preference detection)

## Non-Functional Requirements

### Performance

- **NFR1**: Table data loads within 2 seconds for tables with <500 rows
- **NFR2**: Cell edit save operations complete within 1 second
- **NFR3**: Table list and namespace list load within 1 second
- **NFR4**: UI interactions respond within 100ms during background data operations (no blocking)
- **NFR5**: Extension activation adds less than 50ms to VS Code activation time

### Security

- **NFR6**: Credentials are never stored in extension state or settings
- **NFR7**: Credentials are obtained exclusively via Server Manager authentication provider
- **NFR8**: All SQL operations use parameterized queries (no string concatenation)
- **NFR9**: No sensitive data (passwords, tokens) appears in extension logs
- **NFR10**: HTTPS is used when available for server connections

### Integration

- **NFR11**: Extension gracefully handles Server Manager extension not being installed
- **NFR12**: Extension remains functional across Server Manager version updates
- **NFR13**: Extension properly encodes namespace names for Atelier API (% → %25)
- **NFR14**: Extension handles Atelier API version differences gracefully

### Reliability

- **NFR15**: Failed operations display clear, actionable error messages
- **NFR16**: Partial failures do not corrupt data or leave UI in inconsistent state
- **NFR17**: Network disconnection is detected and reported to user
- **NFR18**: Extension recovers gracefully from server connection loss, including when re-entering the extension with a previously selected server that is no longer available. Connection attempts must be cancellable and time-bounded.

### Desktop Performance (Desktop Target)

- **NFR19**: Desktop application launches and displays the main window in under 3 seconds on standard hardware
- **NFR20**: Desktop application installer size is under 200MB

### Desktop Security (Desktop Target)

- **NFR21**: Credentials are encrypted using OS-provided keychain (Electron safeStorage API) — never stored in plaintext
- **NFR22**: Electron renderer runs with context isolation enabled and nodeIntegration disabled
- **NFR23**: All IPC communication between main and renderer processes uses typed, validated channels

### Desktop Reliability (Desktop Target)

- **NFR24**: Desktop application persists window state (position, size, last connection) across restarts via electron-store

### Web Performance (Web Target)

- **NFR25**: Web application loads and is interactive within 3 seconds on standard broadband
- **NFR26**: API proxy adds no more than 100ms latency to IRIS requests
- **NFR27**: WebSocket connection establishes within 1 second

### Web Security (Web Target)

- **NFR28**: Server implements CORS policy restricting origins
- **NFR29**: All API proxy requests include CSRF protection
- **NFR30**: Rate limiting prevents abuse (configurable requests per minute)
- **NFR31**: Security headers (helmet) applied to all responses
- **NFR32**: Credentials are never stored server-side; passed per-request from browser session
- **NFR33**: HTTPS required for production deployment

### Web Reliability (Web Target)

- **NFR34**: Web application detects WebSocket disconnection and displays reconnection UI
- **NFR35**: Browser session persists connection state across page reloads
- **NFR36**: Concurrent users (10+) can use the application without interference

### Web Compatibility (Web Target)

- **NFR37**: Application works in Chrome, Firefox, Safari, and Edge (latest 2 versions)
- **NFR38**: Application is responsive across viewport sizes (minimum 1024px width)

