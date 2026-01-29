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
  projectTypeDetail: VS Code Extension
  domain: general
  domainDetail: Developer Tooling
  complexity: low
  distribution: open_source_marketplace
  targetAudience:
    - IRIS developers
    - Operations users
---

# Product Requirements Document - iris-table-editor

**Author:** Developer
**Date:** 2026-01-26

## Executive Summary

**IRIS Table Editor** is a VS Code extension that enables visual editing of InterSystems IRIS database tables without writing SQL. It provides an Excel-like grid interface integrated directly into the VS Code development environment.

**Core Value Proposition:** Edit IRIS table data in 30 seconds instead of minutes spent writing SQL queries.

**Target Users:** IRIS developers and operations users who need to inspect or modify table data during development and maintenance.

**Distribution:** Open source, published on VS Code Marketplace.

**Key Dependencies:** InterSystems Server Manager extension, Atelier REST API.

## Success Criteria

### User Success

- **Primary Value**: Users can view and edit IRIS table data in an Excel-like grid without writing SQL
- **Aha Moment**: First successful inline edit and save - "I just changed a value and hit save, no SQL required"
- **Pain Eliminated**: No more writing manual UPDATE/INSERT statements for simple data changes
- **Target Experience**: Browse → Select table → View grid → Edit cell → Save - all within VS Code

### Business Success

| Milestone | Target | Indicators |
|-----------|--------|------------|
| 3 months | Internal adoption | Development team actively using the tool daily instead of manual SQL |
| 12 months | Community adoption | External users installing from VS Code Marketplace, positive reviews (4+ stars) |

### Technical Success

- Server Manager integration works seamlessly for authentication
- All CRUD operations use HTTP-only Atelier API (no superserver port required)
- Secure credential handling via VS Code authentication provider
- SQL injection prevention through parameterized queries
- Responsive performance with tables up to 1000+ rows (MVP)
- Full support for VS Code light and dark themes
- **(Growth)** Scalable navigation for namespaces with thousands of tables
- **(Growth)** Efficient handling of tables with millions of rows via server-side operations

### Measurable Outcomes

- Users can complete a data edit in under 30 seconds (vs. minutes writing SQL)
- Zero credential exposure in logs or extension state
- Extension loads table data within 2 seconds for typical tables (<500 rows)
- **(Growth)** Page navigation completes within 1 second for tables with millions of rows
- **(Growth)** Filter and sort operations complete within 2 seconds

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

**Scalability & Advanced Navigation (Epic 6):**
- Schema-based table tree view with collapsible folder hierarchy for namespaces with thousands of tables
- Inline column filtering with smart UI: checklist for low-cardinality columns (≤10 values), text input with wildcard support (* and ?) for high-cardinality columns
- Filter panel with advanced operators (contains, starts with, equals, greater than, less than, is empty, etc.)
- Filter toggle to disable/enable filters without losing criteria
- Column sorting via header click (ascending/descending/clear)
- Enhanced pagination with First, Previous, page number input, Next, Last buttons
- Server-side filtering, sorting, and pagination for tables with millions of rows
- Lazy loading verification ensuring only current page is fetched

**Additional Growth Features:**
- Keyboard shortcuts for common operations
- Multiple namespace support
- Auto-refresh capability

### Vision (Future)

- Query builder UI for custom SELECT queries
- Export to CSV/Excel
- Schema/relationship visualization
- Custom SQL execution panel

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

### Journey Requirements Summary

| Capability | Revealed By Journey |
|------------|---------------------|
| Server selection & connection | Marcus (J1), Sarah (J2) |
| Table browsing & selection | Marcus (J1), Sarah (J2) |
| Grid data display | All journeys |
| Inline cell editing | Marcus (J1), Sarah (J2) |
| Quick save (UPDATE) | Marcus (J1), Sarah (J2) |
| User-friendly error messages | Marcus - Error (J3) |
| Change confirmation | Sarah (J2) |

## Developer Tool Specific Requirements

### Project-Type Overview

IRIS Table Editor is a **VS Code Extension** providing visual database editing capabilities for InterSystems IRIS. It integrates with the existing InterSystems ecosystem through the Server Manager extension and Atelier REST API.

### Technical Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Runtime | Node.js 20+ |
| Package Manager | npm |
| Build Tool | esbuild |
| IDE Platform | VS Code 1.85.0+ |
| UI Framework | VS Code Webview API + vscode-webview-ui-toolkit |
| Data Grid | vscode-data-grid component |
| API Layer | Atelier REST API (HTTP-based) |

### IDE Integration

- **Extension Type**: WebviewViewProvider (sidebar panel)
- **Activation**: On command or when view is opened
- **Extension Dependency**: `intersystems-community.servermanager`
- **Authentication**: Delegated to Server Manager's authentication provider
- **Commands**:
  - `iris-table-editor.openTableEditor` - Launch editor
  - `iris-table-editor.editTable` - Context menu integration

### Installation Methods

| Method | Description |
|--------|-------------|
| VS Code Marketplace | Primary distribution (open source) |
| .vsix package | Manual installation for offline/enterprise environments |
| Source build | `npm run compile` for development |

### Compatibility Requirements

| Dependency | Minimum Version |
|------------|-----------------|
| VS Code | 1.85.0+ |
| Node.js | 20+ |
| InterSystems IRIS | 2021.1+ |
| Server Manager Extension | Latest |

### Documentation Requirements

- **README.md**: Installation, quickstart guide, screenshots, feature overview
- **CHANGELOG.md**: Version history and release notes
- **Marketplace Description**: Feature highlights, requirements, usage examples
- **In-extension**: Tooltips on UI elements, clear error messages

### Implementation Considerations

- **Security**: Credentials handled by Server Manager (never stored in extension state)
- **Performance**: Lazy loading of table data, pagination for large datasets
- **Theming**: Full support for VS Code light/dark themes via CSS variables
- **Error Handling**: User-friendly messages, no raw SQL errors exposed

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
- **NFR18**: Extension recovers gracefully from server connection loss

