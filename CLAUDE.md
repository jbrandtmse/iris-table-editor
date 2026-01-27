# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IRIS Table Editor is a VS Code extension that provides Excel-like grid editing for InterSystems IRIS database tables. It connects via the Atelier REST API (HTTP-based) and uses InterSystems Server Manager for connection management.

## Research First

Always use Perplexity to research topics you are unsure about before making assumptions or proceeding with implementation. This includes:
- Unfamiliar APIs or libraries
- Best practices for specific technologies
- Current documentation for third-party dependencies
- InterSystems IRIS-specific behavior or syntax

## Build Commands

```bash
npm run compile      # Build extension with esbuild
npm run watch        # Development mode with file watching
npm run package      # Create .vsix package (vsce package)
npm run publish      # Publish to VS Code Marketplace
```

## Architecture

### Directory Structure
```
src/
├── extension.ts                    # Entry point, command registration
├── providers/
│   ├── TableEditorProvider.ts      # WebviewViewProvider for table UI
│   └── ServerConnectionManager.ts  # Server Manager API integration
├── services/
│   ├── AtelierApiService.ts        # Atelier REST API HTTP client
│   ├── QueryExecutor.ts            # SQL CRUD operations
│   └── TableMetadataService.ts     # Schema/column metadata retrieval
├── models/                         # TypeScript interfaces
└── utils/
    ├── SqlBuilder.ts               # Parameterized query generation
    ├── UrlBuilder.ts               # Atelier URL construction
    └── ErrorHandler.ts             # Error parsing and user messages
media/
├── webview.html                    # Webview HTML structure
├── styles.css                      # VS Code theme-aware styles
└── main.js                         # Client-side webview logic
```

### Key Technical Patterns

**Server Manager Integration**: Use `@intersystems-community/intersystems-servermanager` package. Get passwords via `vscode.authentication.getSession()` with the Server Manager's authentication provider - never store credentials directly.

**Atelier API**: All database operations use POST to `/api/atelier/v1/{NAMESPACE}/action/query`. Namespace encoding requires `%` → `%25`. Use parameterized queries with `?` placeholders for all user data.

**Webview Communication**: Extension and webview communicate via `postMessage()`. Messages include: `selectServer`, `loadTables`, `selectTable`, `updateRow`, `insertRow`, `deleteRow`, `refreshData`, `paginate`.

### SQL Query Pattern
```typescript
// Always use parameterized queries
{
  "query": "UPDATE TableName SET Col1=?, Col2=? WHERE ID=?",
  "parameters": ["value1", "value2", "pkValue"]
}
```

## Development Phases

1. **Setup**: Project structure, TypeScript config, esbuild
2. **Core Services**: ServerConnectionManager, AtelierApiService, QueryExecutor
3. **UI**: Webview HTML/CSS/JS, vscode-data-grid integration
4. **CRUD**: Cell editing, row insertion, updates, deletion
5. **Polish**: Pagination, error handling, theme support
6. **Package**: Documentation, .vsix creation

## Key Dependencies

- `@intersystems-community/intersystems-servermanager` - Server connection management
- `@vscode/webview-ui-toolkit` - UI components for webview
- Extension dependency: `intersystems-community.servermanager`

## Target Compatibility

- VS Code 1.85.0+
- Node.js 20+
- IRIS 2021.1+
