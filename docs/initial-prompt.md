# IRIS Table Editor VS Code Extension Development Prompt

You are tasked with developing a comprehensive VS Code extension called **IRIS Table Editor** that enables developers to browse, view, and edit InterSystems IRIS database tables directly within VS Code using an Excel-like grid interface. The extension must connect to IRIS servers using the Atelier REST API (HTTP-based connectivity) and leverage the InterSystems Server Manager for connection management.

## Project Overview

### Goals
1. Create a VS Code extension that integrates with the InterSystems Server Manager
2. Provide Excel-like table editing capabilities for IRIS database tables
3. Use the Atelier REST API's Query method for all database operations (SELECT, INSERT, UPDATE, DELETE)
4. Support HTTP-only connectivity (no superserver port exposure required)
5. Deliver a production-ready, fully functional table editor

### Key Technical Stack
- **Language**: TypeScript
- **Extension API**: VS Code Extension API
- **UI Framework**: VS Code Webview API with vscode-webview-ui-toolkit
- **Data Grid**: vscode-data-grid component for tabular display
- **Server Connection**: InterSystems Server Manager integration
- **API**: Atelier REST API (HTTP-based queries)
- **Package Manager**: npm
- **Build Tools**: esbuild (for extension bundling)

---

## Architecture & Components

### 1. Extension Structure
The extension should follow this directory structure:

```
iris-table-editor/
├── src/
│   ├── extension.ts              # Main extension entry point and activation
│   ├── providers/
│   │   ├── TableEditorProvider.ts    # Webview provider for table editor
│   │   └── ServerConnectionManager.ts # Server Manager integration
│   ├── services/
│   │   ├── AtelierApiService.ts      # Atelier REST API client
│   │   ├── QueryExecutor.ts          # SQL query execution logic
│   │   └── TableMetadataService.ts   # Table schema and metadata retrieval
│   ├── models/
│   │   ├── IServerSpec.ts           # Server specification interface
│   │   ├── ITableData.ts            # Table data interface
│   │   ├── IAtelierResponse.ts      # Atelier API response interface
│   │   └── ITableSchema.ts          # Table schema interface
│   └── utils/
│       ├── ErrorHandler.ts          # Centralized error handling
│       ├── SqlBuilder.ts            # SQL query builder for INSERT/UPDATE/DELETE
│       └── UrlBuilder.ts            # Atelier API URL builder
├── media/
│   ├── webview.html                # Main webview HTML structure
│   ├── styles.css                  # Webview styles
│   └── main.js                     # Webview JavaScript/client-side logic
├── package.json                    # Extension manifest and dependencies
├── tsconfig.json                   # TypeScript configuration
├── esbuild.js                      # Build configuration
└── .vscodeignore                   # Files to exclude from packaging
```

### 2. Core Components

#### Extension.ts (Main Entry Point)
- **Responsibilities**: 
  - Activate the extension when VS Code starts
  - Register commands for opening the table editor
  - Ensure InterSystems Server Manager is available (dependency check)
  - Set up webview view container and register providers
  - Handle command registration for context menus
  
- **Key Features**:
  - Register command `iris-table-editor.openTableEditor` to launch the editor
  - Register command `iris-table-editor.editTable` for context menu integration
  - Create webview view container in the Explorer sidebar
  - Initialize the TableEditorProvider

#### ServerConnectionManager.ts
- **Responsibilities**:
  - Interface with InterSystems Server Manager API
  - Retrieve available server connections
  - Get server specifications (host, port, namespace, credentials)
  - Handle authentication (leverage Server Manager's auth provider for password management)
  - Cache server connections in memory
  
- **Key Features**:
  - Use `@intersystems-community/intersystems-servermanager` package
  - Import `ServerManagerAPI`, `IServerSpec`, `EXTENSION_ID`, `AUTHENTICATION_PROVIDER` from server manager
  - Detect if Server Manager is installed; prompt user to install if missing
  - Implement `getServerSpec(serverName: string)` to fetch connection details
  - Implement `getAvailableServers()` to list all configured servers
  - Handle authentication via `vscode.authentication.getSession()` using Server Manager's provider
  - Support namespace filtering

**Server Manager Integration Examples:**

```typescript
// Detecting and activating Server Manager extension
import * as serverManager from '@intersystems-community/intersystems-servermanager';

let extension = vscode.extensions.getExtension(serverManager.EXTENSION_ID);
if (!extension) {
  await vscode.commands.executeCommand('workbench.extensions.installExtension', serverManager.EXTENSION_ID);
  extension = vscode.extensions.getExtension(serverManager.EXTENSION_ID);
}
if (!extension.isActive) {
  await extension.activate();
}
const serverManagerApi: serverManager.ServerManagerAPI = extension.exports;

// Getting server specification
const serverSpec = await serverManagerApi.getServerSpec(serverName);

// Getting password securely via authentication provider
if (typeof serverSpec.password === 'undefined') {
  const scopes = [serverSpec.name, serverSpec.username || ''];
  const account = serverManagerApi.getAccount(serverSpec);
  let session = await vscode.authentication.getSession(
    serverManager.AUTHENTICATION_PROVIDER,
    scopes,
    { silent: true, account }
  );
  if (!session) {
    session = await vscode.authentication.getSession(
      serverManager.AUTHENTICATION_PROVIDER,
      scopes,
      { createIfNone: true, account }
    );
  }
  if (session) {
    serverSpec.username = session.scopes[1];
    serverSpec.password = session.accessToken;
  }
}

// Getting a list of all servers
const allServerNames: serverManager.IServerName[] = await serverManagerApi.getServerNames();

// Using quick pick for user to select server
const selectedServerName: string = await serverManagerApi.pickServer();
```

**Important Notes:**
- **No need to download Server Manager source code** - the NPM package (`@intersystems-community/intersystems-servermanager`) includes full TypeScript type definitions
- Complete documentation and examples are available in the [official GitHub repository](https://github.com/intersystems-community/intersystems-servermanager)
- Always use the authentication provider (`vscode.authentication.getSession()`) for password management instead of storing credentials in settings
- The Server Manager leverages VS Code's native authentication system, which stores credentials securely in the OS keystore

#### TableEditorProvider.ts (WebviewViewProvider)
- **Responsibilities**:
  - Implement `vscode.WebviewViewProvider` interface
  - Create and manage the webview that displays the table editor
  - Handle communication between extension and webview
  - Manage state (selected server, selected table, current data)
  - Forward user actions (select table, edit row, save changes) to appropriate services
  
- **Key Features**:
  - Generate webview HTML with security best practices (nonce, CSP)
  - Implement `resolveWebviewView()` to set up initial webview content
  - Register message listeners from webview using `webviewView.webview.onDidReceiveMessage()`
  - Send messages to webview using `webviewView.webview.postMessage()`
  - Implement message handlers for:
    - `selectServer`: Change active IRIS server
    - `loadTables`: Fetch list of tables in selected namespace
    - `selectTable`: Load table schema and data
    - `updateRow`: Execute UPDATE query
    - `insertRow`: Execute INSERT query
    - `deleteRow`: Execute DELETE query
    - `refreshData`: Reload table data
    - `paginate`: Load next/previous page of results
  - Include proper error handling with user-facing messages
  - Support pagination (e.g., 50 rows per page)

#### AtelierApiService.ts
- **Responsibilities**:
  - Encapsulate all Atelier REST API HTTP calls
  - Build proper URLs with server host, port, namespace, and API version
  - Handle HTTP authentication
  - Parse Atelier API responses
  - Map API responses to application data models
  
- **Key Features**:
  - Create async method `executeQuery(serverSpec: IServerSpec, namespace: string, query: string, parameters?: any[])`
  - Handle URL encoding of special characters (especially `%` as `%25` for system namespaces)
  - Support parameterized queries to prevent SQL injection
  - Parse Atelier response structure: `status`, `console`, `result.content`
  - Check `status.errors` array for errors; throw descriptive exceptions
  - Handle HTTP status codes (200 = success, 500 = error with details in status)
  - Return strongly-typed result objects
  - Support query parameter `max` for row limiting
  - Implement timeout handling (suggest 30-second timeout)
  - Log all API calls for debugging (conditionally, respecting security)

#### QueryExecutor.ts
- **Responsibilities**:
  - Execute various SQL operations (SELECT, INSERT, UPDATE, DELETE)
  - Validate query results
  - Transform Atelier API results into application data models
  - Handle CRUD operation logic
  
- **Key Features**:
  - Implement `selectTableData(serverSpec, namespace, tableName, offset, limit)` - use SQL SELECT
  - Implement `getTableSchema(serverSpec, namespace, tableName)` - SELECT with LIMIT 0 to get column info
  - Implement `insertRow(serverSpec, namespace, tableName, rowData)` - generate and execute INSERT
  - Implement `updateRow(serverSpec, namespace, tableName, primaryKey, rowData)` - generate and execute UPDATE
  - Implement `deleteRow(serverSpec, namespace, tableName, primaryKey)` - generate and execute DELETE
  - Handle transaction-like semantics (rollback on error)
  - Validate data types match IRIS column types before submission

#### TableMetadataService.ts
- **Responsibilities**:
  - Retrieve table metadata (schema, columns, data types)
  - Cache metadata to reduce API calls
  - Determine primary keys for tables
  
- **Key Features**:
  - Query IRIS metadata tables (e.g., `%Dictionary.ClassDefinition`, `%Dictionary.PropertyDefinition`)
  - Extract column names, data types, nullability, and constraints
  - Identify primary key columns
  - Implement caching with cache invalidation
  - Support both class-based tables (Objects) and SQL tables

#### SqlBuilder.ts
- **Responsibilities**:
  - Generate parameterized SQL statements for CRUD operations
  - Build INSERT, UPDATE, DELETE queries safely
  
- **Key Features**:
  - Implement `buildSelectQuery(tableName, columns?, whereClause?, orderBy?, limit?, offset?)`
  - Implement `buildInsertQuery(tableName, rowData)` - returns query and parameters array
  - Implement `buildUpdateQuery(tableName, rowData, whereClause)` - returns query and parameters array
  - Implement `buildDeleteQuery(tableName, whereClause)` - returns query and parameters array
  - Use parameter placeholders (?) for safety
  - Properly escape table and column names
  - Handle NULL values correctly
  - Support WHERE clauses with AND conditions for multi-column primary keys

#### ErrorHandler.ts
- **Responsibilities**:
  - Centralize error handling and formatting
  - Provide user-friendly error messages
  - Log errors for debugging
  
- **Key Features**:
  - Parse Atelier API error responses
  - Extract SQL error details from `status.errors` array
  - Convert technical errors into user-friendly messages
  - Display error notifications in VS Code
  - Log full error stack for debugging (respecting privacy)

#### UrlBuilder.ts
- **Responsibilities**:
  - Build Atelier API URLs correctly
  
- **Key Features**:
  - Implement `buildQueryUrl(serverSpec, namespace, maxRows?)`
  - Properly encode namespace (convert % to %25)
  - Use HTTPS when available
  - Return full URL: `https://host:port/api/atelier/v1/NAMESPACE/action/query`

### 3. Data Models (TypeScript Interfaces)

```typescript
// IServerSpec.ts - Server connection details
interface IServerSpec {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  description?: string;
  secure?: boolean;
}

// ITableData.ts - Table row data
interface ITableData {
  [columnName: string]: any;
}

// ITableSchema.ts - Column metadata
interface ITableColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  size?: number;
}

interface ITableSchema {
  tableName: string;
  columns: ITableColumn[];
  primaryKeyColumns: string[];
}

// IAtelierResponse.ts - Atelier API response structure
interface IAtelierStatus {
  errors: Array<{
    message: string;
    code?: string;
  }>;
  summary?: string;
}

interface IAtelierResponse {
  status: IAtelierStatus;
  console?: string[];
  result?: {
    content?: any[];
  };
}
```

---

## Webview Implementation

### HTML Structure (media/webview.html)
- Build HTML that loads the webview UI toolkit stylesheets
- Create main container div for dynamic content
- Include toolbar with:
  - Server selector dropdown (populated by extension)
  - Namespace selector
  - Table selector
  - Refresh button
  - New Row button
- Include vscode-data-grid container for table display
- Include hidden form for inline editing (will be shown as modal or inline)
- Include status bar for messages and errors
- Load main.js script with proper CSP nonce

### Styles (media/styles.css)
- Use VS Code theme colors via CSS variables (e.g., `var(--vscode-foreground)`)
- Style vscode-data-grid for professional appearance
- Implement cell editing styles (input fields, borders)
- Add hover effects for interactive elements
- Ensure dark and light theme compatibility
- Make grid scrollable with fixed header
- Style buttons, dropdowns, and forms using VS Code component patterns

### Client-Side JavaScript (media/main.js)
- Acquire VS Code API using `const vscode = acquireVsCodeApi();`
- Implement functions:
  - `initializeUI()` - Set up event listeners
  - `populateServerDropdown(servers)` - Load server list from extension
  - `onServerChange()` - Load tables when server changes
  - `onTableSelect(tableName)` - Load table data and schema
  - `onCellEdit(rowIndex, columnName, newValue)` - Allow inline editing
  - `onSaveRow(rowIndex, originalData, changedFields)` - Send update to extension
  - `onInsertRow()` - Open dialog for new row
  - `onDeleteRow(rowIndex)` - Confirm and delete row
  - `displayTableData(rows, schema)` - Render grid using vscode-data-grid
  - `handleRefresh()` - Reload current table
  - `showError(message)` - Display error notifications
  - `showSuccess(message)` - Display success notifications
- Implement message handlers:
  - Listen for messages from extension using `window.addEventListener('message')`
  - Handle: `serverList`, `tableList`, `tableSchema`, `tableData`, `error`, `success`
- Build vscode-data-grid rows dynamically from table data
- Support inline editing (edit mode on double-click)
- Implement pagination controls
- Validate input before sending to extension

---

## Atelier API Integration

### Query Method Usage

#### SELECT Query
```
POST https://server:52773/api/atelier/v1/NAMESPACE/action/query?max=50
Content-Type: application/json
Authorization: Basic [base64(username:password)]

{
  "query": "SELECT * FROM TableName",
  "parameters": []
}

Response:
{
  "status": {
    "errors": [],
    "summary": ""
  },
  "result": {
    "content": [
      { "Column1": "Value1", "Column2": "Value2" },
      ...
    ]
  }
}
```

#### INSERT Query
```
POST https://server:52773/api/atelier/v1/NAMESPACE/action/query
Content-Type: application/json
Authorization: Basic [base64(username:password)]

{
  "query": "INSERT INTO TableName (Col1, Col2, Col3) VALUES (?, ?, ?)",
  "parameters": ["value1", "value2", "value3"]
}

Response:
{
  "status": { "errors": [] },
  "result": { "content": [] }
}
```

#### UPDATE Query
```
POST https://server:52773/api/atelier/v1/NAMESPACE/action/query
Content-Type: application/json
Authorization: Basic [base64(username:password)]

{
  "query": "UPDATE TableName SET Col1=?, Col2=? WHERE PrimaryKey=?",
  "parameters": ["newValue1", "newValue2", "pkValue"]
}

Response:
{
  "status": { "errors": [] },
  "result": { "content": [] }
}
```

#### DELETE Query
```
POST https://server:52773/api/atelier/v1/NAMESPACE/action/query
Content-Type: application/json
Authorization: Basic [base64(username:password)]

{
  "query": "DELETE FROM TableName WHERE PrimaryKey=?",
  "parameters": ["pkValue"]
}

Response:
{
  "status": { "errors": [] },
  "result": { "content": [] }
}
```

### Error Handling
- **HTTP 500**: Check `status.errors` array for details
- **SQL Errors**: Parse error messages from `status.errors[].message`
- **Common Errors**:
  - "Table does not exist" - User specified wrong table
  - "Permission denied" - User lacks rights
  - "Constraint violation" - Foreign key or unique constraint failed
  - "Type mismatch" - Column data type error

---

## Package.json Configuration

### Required Dependencies
```json
{
  "name": "iris-table-editor",
  "version": "0.1.0",
  "description": "InterSystems IRIS table editor with Excel-like grid interface",
  "publisher": "YOUR_PUBLISHER_NAME",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "Database",
    "Other"
  ],
  "extensionDependencies": [
    "intersystems-community.servermanager"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "iris-table-editor.openTableEditor",
        "title": "Open IRIS Table Editor"
      },
      {
        "command": "iris-table-editor.editTable",
        "title": "Edit in IRIS Table Editor",
        "when": "explorerResourceIsFolder"
      }
    ],
    "views": {
      "explorer": [
        {
          "id": "iris-table-editor.view",
          "name": "IRIS Table Editor",
          "when": "true"
        }
      ]
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "iris-tools",
          "title": "IRIS Tools",
          "icon": "$(database)"
        }
      ]
    }
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "@vscode/webview-ui-toolkit": "^1.4.0",
    "typescript": "^5.0.0",
    "esbuild": "^0.19.0"
  },
  "dependencies": {
    "@intersystems-community/intersystems-servermanager": "^3.8.0"
  },
  "scripts": {
    "compile": "esbuild ./src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --platform=node --target=node20",
    "watch": "npm run compile -- --watch",
    "package": "vsce package",
    "publish": "vsce publish"
  }
}
```

---

## Development Workflow

### Phase 1: Setup & Configuration
1. Create project structure using `yo code` or manual setup
2. Configure TypeScript with strict mode enabled
3. Set up esbuild for bundling
4. Create base extension.ts with activation logic
5. Configure package.json with all dependencies and contributions
6. Ensure Server Manager dependency is specified

### Phase 2: Core Services
1. Implement ServerConnectionManager to interface with Server Manager API
2. Implement AtelierApiService for HTTP API calls
3. Implement QueryExecutor for SQL operations
4. Implement TableMetadataService for schema retrieval
5. Implement SqlBuilder for safe query generation
6. Add error handling utilities
7. Test each service independently with a real IRIS instance

### Phase 3: UI & Webview
1. Create webview HTML structure with layout
2. Implement webview styles using VS Code theme variables
3. Implement webview JavaScript for client-side logic
4. Integrate vscode-data-grid for table display
5. Implement message passing between extension and webview
6. Test server selection, table browsing, data loading

### Phase 4: CRUD Operations
1. Implement row editing (inline or modal)
2. Implement new row insertion
3. Implement row updates with conflict detection
4. Implement row deletion with confirmation
5. Implement transaction rollback on errors
6. Add validation before submission

### Phase 5: Polish & Testing
1. Add pagination support
2. Improve error messages and user feedback
3. Add keyboard shortcuts for common operations
4. Test with multiple IRIS versions
5. Test with various table types (SQL, Classes, etc.)
6. Performance optimization for large tables
7. Security review (no sensitive data in logs, secure credential handling)

### Phase 6: Documentation & Packaging
1. Create README with installation and usage instructions
2. Add CHANGELOG documenting features
3. Create icon files for marketplace
4. Package extension (.vsix file)
5. Test marketplace installation

---

## Testing Requirements

### Unit Tests
- Test SqlBuilder with various table structures
- Test AtelierApiService error parsing
- Test URL building with special characters
- Test QueryExecutor with mock data

### Integration Tests
- Connect to real IRIS instance
- Create test table with various column types
- Test SELECT, INSERT, UPDATE, DELETE operations
- Test with NULL values and constraints
- Test error scenarios (invalid table, permission denied)

### Manual Testing Checklist
- [ ] Server Manager integration works
- [ ] Can select different servers
- [ ] Can select different namespaces
- [ ] Can list all tables in namespace
- [ ] Can load table data without errors
- [ ] Can edit a cell and save changes
- [ ] Can insert a new row
- [ ] Can delete a row with confirmation
- [ ] Can handle large datasets with pagination
- [ ] Error messages are clear and helpful
- [ ] Works with dark and light themes
- [ ] Performance is acceptable for >1000 rows

---

## Security Considerations

1. **Credentials**: Never log passwords. Use Server Manager's authentication provider.
2. **SQL Injection**: Always use parameterized queries with ? placeholders.
3. **HTTPS**: Support secure connections to IRIS servers.
4. **Error Messages**: Don't expose internal server errors to avoid information disclosure.
5. **Authentication**: Support both basic auth and token-based auth from Server Manager.
6. **Content Security Policy**: Use strict CSP in webview to prevent script injection.
7. **Sensitive Data**: Never store passwords in extension state; use native OS keystore via Server Manager.

---

## Performance Optimization

1. **Pagination**: Load 50 rows at a time by default, with user-configurable limit.
2. **Metadata Caching**: Cache table schemas for 1 hour to reduce API calls.
3. **Lazy Loading**: Load table list only when server is selected.
4. **Debouncing**: Debounce search/filter operations to reduce API calls.
5. **Async Operations**: Ensure all API calls are non-blocking; use async/await.
6. **Connection Reuse**: Reuse HTTP connections where possible.

---

## Extension Configuration (settings.json)

Support these user settings:

```json
{
  "iris-table-editor.pageSize": {
    "type": "number",
    "default": 50,
    "description": "Number of rows to display per page"
  },
  "iris-table-editor.autoRefreshInterval": {
    "type": "number",
    "default": 0,
    "description": "Auto-refresh interval in seconds (0 = disabled)"
  },
  "iris-table-editor.defaultServer": {
    "type": "string",
    "description": "Default server to connect to on startup"
  },
  "iris-table-editor.defaultNamespace": {
    "type": "string",
    "default": "USER",
    "description": "Default namespace to browse"
  }
}
```

---

## Deliverables Checklist

- [ ] Extension source code (TypeScript)
- [ ] All core services implemented and tested
- [ ] Webview UI fully functional with vscode-data-grid
- [ ] Server Manager integration working
- [ ] Atelier API integration working with all CRUD operations
- [ ] Error handling comprehensive and user-friendly
- [ ] README documentation with screenshots
- [ ] CHANGELOG documenting all features
- [ ] Packaged .vsix file ready for installation
- [ ] Published to VS Code Marketplace (optional)
- [ ] Unit test suite with >80% coverage
- [ ] Security review completed
- [ ] Performance tested with large datasets
- [ ] Compatible with IRIS 2021.1 and later

---

## Success Criteria

1. ✅ Can connect to IRIS server via Server Manager integration
2. ✅ Can browse and select any table in any namespace
3. ✅ Can view table data in Excel-like grid with proper formatting
4. ✅ Can edit cells and save changes back to database
5. ✅ Can insert new rows with validation
6. ✅ Can delete rows with confirmation
7. ✅ Can handle errors gracefully with user-friendly messages
8. ✅ All operations use HTTP-only connectivity (Atelier API)
9. ✅ Extension is performant even with large tables
10. ✅ Extension follows VS Code best practices and design patterns
11. ✅ Extension is secure (no credential leaks, SQL injection prevention)
12. ✅ Extension works in light and dark themes
13. ✅ Extension is documented and ready for production use

---

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [vscode-webview-ui-toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit)
- [InterSystems Server Manager API](https://github.com/intersystems-community/intersystems-servermanager)
- [InterSystems IRIS Atelier REST API Documentation](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=GSCF_ref)
- [VS Code Extension Examples](https://github.com/microsoft/vscode-extension-samples)

---

## Next Steps

1. Review this prompt for completeness and clarity
2. Set up development environment with Node.js, npm, and VS Code
3. Begin Phase 1 (Setup & Configuration)
4. Create git repository for version control
5. Set up CI/CD pipeline for testing
6. Assign team members to component development
7. Schedule regular progress reviews

---

**Prompt Version**: 1.1  
**Last Updated**: January 26, 2026  
**Target IRIS Versions**: 2021.1+  
**Target VS Code Versions**: 1.85.0+
