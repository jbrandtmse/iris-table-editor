# IRIS Table Editor

A VS Code extension that provides Excel-like grid editing for InterSystems IRIS database tables directly within VS Code.

## Features

### Connection & Browsing
- Connect to InterSystems IRIS servers via Server Manager integration
- Browse namespaces and tables in a schema-organized tree view
- Schema folders group related tables; standalone tables and folders are alphabetized together
- Open multiple tables simultaneously in separate editor panels
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
- VS Code theme support (dark, light, and high contrast)

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

Press **?** or **F1** to view the full shortcuts help dialog in the extension.

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

## Requirements

- VS Code 1.85.0 or higher
- [InterSystems Server Manager](https://marketplace.visualstudio.com/items?itemName=intersystems-community.servermanager) extension
- Access to an InterSystems IRIS instance (2021.1+)

## Installation

### From VSIX (recommended for now)

1. Download `iris-table-editor-0.1.0.vsix` from the [latest release](https://github.com/jbrandtmse/iris-table-editor/releases/latest)
2. In VS Code, open the Command Palette (Ctrl+Shift+P) and run **Extensions: Install from VSIX...**
3. Select the downloaded `.vsix` file
4. Reload VS Code when prompted

Alternatively, install from the command line:

```bash
code --install-extension iris-table-editor-0.1.0.vsix
```

### From Marketplace

*Coming soon*

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or higher
- [VS Code](https://code.visualstudio.com/) 1.85.0 or higher

### Setup

```bash
# Clone the repository
git clone https://github.com/jbrandtmse/iris-table-editor.git
cd iris-table-editor

# Install dependencies
npm install
```

### Build Commands

```bash
# Build the extension (type-check + esbuild)
npm run compile

# Watch mode for development (auto-rebuilds on file changes)
npm run watch

# Package as .vsix for distribution
npx vsce package

# Run linter
npm run lint
```

### Running in Development

1. Open this repository in VS Code
2. Run `npm run watch` in a terminal
3. Press **F5** to launch the Extension Development Host
4. The IRIS Table Editor icon appears in the Activity Bar of the new VS Code window

## Technical Overview

- Connects via Atelier REST API (HTTP-based, no superserver port required)
- Integrates with InterSystems Server Manager for connection and credential management
- Parameterized SQL queries for all database operations (no string interpolation)
- VS Code Webview API with Content Security Policy enforcement
- Built with TypeScript and esbuild

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
