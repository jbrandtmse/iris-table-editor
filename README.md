# IRIS Table Editor

> **🚧 UNDER HEAVY CONSTRUCTION 🚧**
>
> This project is in active development and not yet ready for production use.

A VS Code extension that provides Excel-like grid editing for InterSystems IRIS database tables directly within VS Code.

## Features

- Browse and select IRIS database tables with schema-based tree view
- View table data in an Excel-like grid interface
- Edit cells inline with automatic save
- Insert new rows with Ctrl+N
- Delete rows with confirmation dialog
- Duplicate rows with Ctrl+D
- Pagination for large datasets
- Column filtering and sorting
- Dark and light theme support
- Comprehensive keyboard shortcuts (press ? or F1 to view)

## Keyboard Shortcuts

Press **?** or **F1** to view the full shortcuts help dialog in the extension.

> **Note:** On Mac, use **Cmd** (⌘) instead of **Ctrl** for all shortcuts below.

### Navigation

| Shortcut | Action |
|----------|--------|
| Arrow keys | Move to adjacent cell |
| Tab | Move to next cell |
| Shift+Tab | Move to previous cell |
| Home | First cell in row |
| End | Last cell in row |
| Ctrl+Home | First cell in grid |
| Ctrl+End | Last cell in grid |
| Page Up/Down | Move one page |

### Editing

| Shortcut | Action |
|----------|--------|
| Enter | Enter edit mode / Save and move down |
| F2 | Enter edit mode |
| Escape | Cancel edit |
| Shift+Enter | Save and move up |
| Ctrl+Enter | Save and stay |
| Ctrl+Z | Undo edit |
| Delete | Clear cell |
| Backspace | Clear and edit |

### Row Operations

| Shortcut | Action |
|----------|--------|
| Ctrl+N | New row |
| Ctrl+D | Duplicate row |
| Ctrl+- | Delete row |
| Ctrl+S | Save new row |
| Ctrl+Shift+N | Set cell to NULL |

### Data Operations

| Shortcut | Action |
|----------|--------|
| Ctrl+R / F5 | Refresh data |
| Ctrl+G | Go to row |
| Ctrl+F | Focus column filter |
| Ctrl+Shift+F | Clear all filters |

### Pagination

| Shortcut | Action |
|----------|--------|
| Ctrl+Page Down | Next page |
| Ctrl+Page Up | Previous page |

## Technical Overview

- Connects via Atelier REST API (HTTP-based, no superserver port required)
- Integrates with InterSystems Server Manager for connection management
- Uses VS Code Webview API with vscode-webview-ui-toolkit

## Requirements

- VS Code 1.85.0 or higher
- [InterSystems Server Manager](https://marketplace.visualstudio.com/items?itemName=intersystems-community.servermanager) extension
- Access to an InterSystems IRIS instance (2021.1+)

## Installation

*Coming soon - extension not yet published to marketplace*

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run compile

# Watch mode for development
npm run watch

# Package for distribution
npm run package
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
