# IRIS Table Editor

Excel-like grid editing for InterSystems IRIS database tables. Available as a **VS Code extension** and a **standalone desktop application** (Electron).

## Features

### Connection & Browsing
- Connect to InterSystems IRIS servers via the Atelier REST API (HTTP)
- Browse namespaces and tables in a schema-organized tree view
- Schema folders group related tables; standalone tables and folders are alphabetized together
- Open multiple tables simultaneously (tabs in desktop, separate panels in VS Code)
- Connection status indicator with disconnect support

### Grid Display
- Excel-like data grid with sticky column headers
- Type-aware column formatting:
  - **Numbers**: Right-aligned with thousands separators
  - **Booleans**: Interactive checkboxes (checked/unchecked/null)
  - **Dates/Times/Timestamps**: Locale-formatted display
  - **NULL values**: Gray italic placeholder
- Adjustable column width via toolbar slider
- Alternating row colors and hover highlighting
- Theme support (dark, light, and high contrast)

### Inline Cell Editing
- Double-click or press Enter/F2 to edit any cell
- Type-specific editors:
  - **Date columns**: Text input with calendar popup (supports YYYY-MM-DD, MM/DD/YYYY, natural language)
  - **Time columns**: Validates HH:MM:SS, 12-hour and 24-hour formats
  - **Timestamp columns**: Combined date-time input with ISO 8601 support
  - **Numeric columns**: Validates integers and decimals per column type
  - **Boolean columns**: Click to toggle; right-click to set NULL
- Auto-save on blur or Enter with optimistic UI feedback
- Ctrl+Z to undo, Escape to cancel, Ctrl+Shift+N to set NULL
- Visual save confirmation (success flash) and error indicators (red border + toast)

### Row Operations
- **Insert**: Ctrl+N adds a new row with yellow highlight; edit fields and Ctrl+S to save
- **Duplicate**: Ctrl+D copies current row (excluding auto-generated primary key)
- **Delete**: Ctrl+- with confirmation dialog showing the row's primary key value

### Column Filtering
- Filter row below headers with per-column text input
- Wildcard support: `*` (any characters) and `?` (single character)
- Case-insensitive matching with AND logic across columns
- Filter panel showing active filters with remove buttons
- Ctrl+F to focus filter, Ctrl+Shift+F to clear all filters
- Auto-refresh after cell save to reflect filter changes

### Column Sorting
- Click column header to cycle: none, ascending, descending
- Sort indicator arrows in header
- Combined with filtering (filter first, then sort)

### Pagination
- Configurable page size (default 50 rows)
- First/Previous/Next/Last navigation buttons
- Direct page input field for jumping to specific pages
- Row count display with thousands separators
- Keyboard shortcuts: Ctrl+PageDown/PageUp
- Ctrl+G to go to a specific row number

### CSV & Excel Export
- Export dropdown with three options per format:
  - **Current page**: Export visible rows
  - **All data**: Export entire table across all pages
  - **Filtered data**: Export only rows matching active filters
- CSV format (RFC 4180 compliant, UTF-8)
- Excel format (.xlsx with formatted headers and borders)
- Progress bar with cancel button for large exports

### CSV & Excel Import
- Import from CSV or Excel (.xlsx) files
- Column mapping UI: map CSV/Excel columns to table columns
- Auto-mapping by matching column names (excludes read-only columns)
- Identity and computed columns detected and marked as read-only
- Data preview showing first 5 rows
- Optional pre-import validation with error report
- Import valid rows only (skip invalid) or cancel on errors
- Progress bar with cancel button for large imports

### Keyboard Shortcuts

Press **?** or **F1** to view the full shortcuts help dialog.

> **Note:** On Mac, use **Cmd** instead of **Ctrl** for all shortcuts below.

| Category | Shortcut | Action |
|----------|----------|--------|
| Navigation | Arrow keys | Move to adjacent cell |
| | Tab / Shift+Tab | Next / previous cell |
| | Home / End | First / last cell in row |
| | Ctrl+Home / Ctrl+End | First / last cell in grid |
| | Page Up / Page Down | Scroll one page |
| Editing | Enter / F2 | Enter edit mode |
| | Escape | Cancel edit |
| | Shift+Enter | Save and move up |
| | Ctrl+Enter | Save and stay |
| | Ctrl+Z | Undo edit |
| | Delete | Clear cell |
| | Backspace | Clear and edit |
| | Ctrl+Shift+N | Set cell to NULL |
| Row Ops | Ctrl+N | New row |
| | Ctrl+D | Duplicate row |
| | Ctrl+- | Delete row |
| | Ctrl+S | Save new row |
| Data | Ctrl+R / F5 | Refresh data |
| | Ctrl+G | Go to row |
| | Ctrl+F | Focus column filter |
| | Ctrl+Shift+F | Clear all filters |
| | Ctrl+E | Toggle export menu |
| Pagination | Ctrl+Page Down | Next page |
| | Ctrl+Page Up | Previous page |

### Accessibility
- Full keyboard navigation (no mouse required)
- ARIA roles and attributes (grid, row, gridcell, dialog, checkbox)
- Screen reader announcements for selections, edits, saves, and errors
- Focus trap in dialogs with focus restoration on close
- High contrast theme support (Windows forced-colors mode)

## Installation

### Desktop Application (Windows)

For users who don't use VS Code — a standalone application with the same feature set.

1. Download **IRIS Table Editor Setup 0.2.0.exe** from the [latest release](https://github.com/jbrandtmse/iris-table-editor/releases/latest)
2. Run the installer — no admin rights required (per-user install)
3. Launch **IRIS Table Editor** from the Start Menu
4. Click **+** or **File → New Connection** to add an IRIS server

> **Note:** The installer is not code-signed. Windows SmartScreen may show a warning on first launch — click "More info" → "Run anyway" to proceed.

**Requirements:** Windows 10 or later. Connects to InterSystems IRIS 2021.1+ via the Atelier REST API.

### VS Code Extension

1. Download **iris-table-editor-0.2.0.vsix** from the [latest release](https://github.com/jbrandtmse/iris-table-editor/releases/latest)
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Extensions: Install from VSIX...**
3. Select the downloaded `.vsix` file
4. Reload VS Code when prompted

Alternatively, install from the command line:

```bash
code --install-extension iris-table-editor-0.2.0.vsix
```

**Requirements:**
- VS Code 1.85.0 or higher
- [InterSystems Server Manager](https://marketplace.visualstudio.com/items?itemName=intersystems-community.servermanager) extension
- Access to an InterSystems IRIS instance (2021.1+)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or higher
- [VS Code](https://code.visualstudio.com/) 1.85.0 or higher (for extension development)

### Setup

```bash
git clone https://github.com/jbrandtmse/iris-table-editor.git
cd iris-table-editor
npm install
```

### Project Structure

This is an npm workspaces monorepo:

```
packages/
├── core/       # Shared services, models, and utilities (TypeScript)
├── webview/    # Shared grid UI: HTML, CSS, and vanilla JS
├── vscode/     # VS Code extension wrapper
└── desktop/    # Electron desktop application
```

### Build Commands

```bash
# Build all packages (type-check + esbuild)
npm run compile

# Run linter across all packages
npm run lint

# Run tests (VS Code extension + desktop)
npm run test

# Watch mode for VS Code extension development
npm run watch
```

### VS Code Extension Development

1. Open this repository in VS Code
2. Run `npm run watch` in a terminal
3. Press **F5** to launch the Extension Development Host
4. The IRIS Table Editor icon appears in the Activity Bar

### Desktop App Development

```bash
# Run the desktop app in dev mode
npm run start:desktop

# Build the Windows installer (.exe)
npm run dist:win --workspace=packages/desktop

# Build a directory (unpacked, for testing)
npm run pack --workspace=packages/desktop
```

### Packaging

```bash
# VS Code extension → .vsix
cd packages/vscode && npx vsce package --no-dependencies

# Desktop app → platform installer
npm run dist:desktop
```

## Technical Overview

- **API**: Atelier REST API over HTTP — no superserver port required
- **Security**: Parameterized SQL queries for all database operations; Content Security Policy enforcement in webviews; channel validation allowlists for IPC
- **VS Code**: Integrates with InterSystems Server Manager for connection and credential management
- **Desktop**: Electron with context isolation and sandbox enabled; encrypted credential storage; auto-update via GitHub Releases
- **Build**: TypeScript, esbuild bundling, npm workspaces monorepo

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
