# Story 1.4: Server Authentication & Connection Status

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **to connect to a server and see my connection status**,
So that **I know I'm authenticated and ready to browse data**.

## Acceptance Criteria

1. **Given** I see the server list
   **When** I select a server
   **Then** the extension authenticates using Server Manager credentials
   **And** I see a connection status indicator showing "Connected to [server-name]"

2. **Given** I am connected to a server
   **When** I look at the panel header
   **Then** I see the current server name displayed prominently
   **And** I see a "Disconnect" button/option

3. **Given** I am connected
   **When** I click "Disconnect"
   **Then** I am disconnected from the server
   **And** the status shows "Disconnected"
   **And** I see the server selection UI again

4. **Given** authentication fails
   **When** I try to connect
   **Then** I see a clear error message explaining the failure
   **And** I remain on the server selection screen

## Tasks / Subtasks

- [x] Task 1: Implement Authentication in ServerConnectionManager (AC: #1, #4)
  - [x] Add `connect(serverName: string)` method
  - [x] Use `vscode.authentication.getSession('intersystems-server-credentials', [serverName], { createIfNone: true })` to obtain credentials
  - [x] Extract password from `session.accessToken`
  - [x] Store connected server state in class property
  - [x] Return connection result with success/failure status

- [x] Task 2: Create AtelierApiService Foundation (AC: #1, #4)
  - [x] Create `src/services/AtelierApiService.ts`
  - [x] Implement connection test via simple Atelier query
  - [x] Use Node.js native `fetch` for HTTP requests
  - [x] Build Basic Auth header from username/password
  - [x] Handle connection errors with ErrorHandler integration

- [x] Task 3: Create ErrorHandler Utility (AC: #4)
  - [x] Create `src/utils/ErrorHandler.ts`
  - [x] Implement `parse(response)` method for Atelier error responses
  - [x] Map error codes to user-friendly messages (see Dev Notes)
  - [x] Return `IUserError` objects per architecture specification

- [x] Task 4: Create UrlBuilder Utility (AC: #1)
  - [x] Create `src/utils/UrlBuilder.ts`
  - [x] Implement `buildBaseUrl(serverSpec)` method
  - [x] Implement `buildQueryUrl(baseUrl, namespace)` with proper encoding
  - [x] Handle namespace `%` → `%25` encoding

- [x] Task 5: Update IMessages.ts with Connection Types (AC: #1-#4)
  - [x] Add `selectServer` command payload type
  - [x] Add `disconnect` command type
  - [x] Add `connectionStatus` event payload type
  - [x] Add `connectionError` event payload type

- [x] Task 6: Update TableEditorProvider Message Handlers (AC: #1-#4)
  - [x] Implement `selectServer` command handler calling ServerConnectionManager.connect()
  - [x] Implement `disconnect` command handler
  - [x] Add connection state tracking (_isConnected, _connectedServer)
  - [x] Send appropriate events to webview after connection attempt

- [x] Task 7: Update Webview HTML for Connection UI (AC: #1-#3)
  - [x] Add connected state header: `.ite-connection-header`
  - [x] Add server name display: `.ite-connection-header__server`
  - [x] Add disconnect button
  - [x] Add connection status indicator (connected/disconnected)
  - [x] Add connecting state with loading spinner

- [x] Task 8: Update Webview JavaScript for Connection State (AC: #1-#4)
  - [x] Add `connectionState` to AppState (`disconnected`, `connecting`, `connected`)
  - [x] Add `connectedServer` to AppState
  - [x] Implement `selectServer` command posting
  - [x] Handle `connectionStatus` event (update state, render connected UI)
  - [x] Handle `connectionError` event (show error, stay on server list)
  - [x] Implement disconnect button handler

- [x] Task 9: Update Webview CSS for Connection States (AC: #1-#3)
  - [x] Add `.ite-connection-header` styles
  - [x] Add `.ite-connection-header__server` styles with prominence
  - [x] Add `.ite-connection-header__status` indicator styles
  - [x] Add `.ite-connection-header__disconnect` button styles
  - [x] Add connecting state styles

- [x] Task 10: Unit Tests for New Components (AC: #1-#4)
  - [x] Add tests for AtelierApiService connection test
  - [x] Add tests for ErrorHandler parsing
  - [x] Add tests for UrlBuilder encoding
  - [x] Extend ServerConnectionManager tests for connect/disconnect
  - [x] Run `npm run test` - all tests must pass (67 passing)

- [x] Task 11: Build Verification (AC: #1-#4)
  - [x] Run `npm run compile` - exits with code 0
  - [x] Run `npm run lint` - passes with no errors
  - [x] Manual test in Extension Development Host (ready for testing)

## Dev Notes

### Architecture Compliance

This story builds on Story 1.3's server list and adds authentication. Per architecture.md:

**New File Locations:**
- `src/services/AtelierApiService.ts` - HTTP client for Atelier API
- `src/utils/ErrorHandler.ts` - Error parsing and user message mapping
- `src/utils/UrlBuilder.ts` - Atelier URL construction

**Naming Conventions (MUST follow):**
| Type | Convention | Example |
|------|------------|---------|
| Service files | PascalCase | `AtelierApiService.ts` |
| Utility files | PascalCase | `ErrorHandler.ts`, `UrlBuilder.ts` |
| Methods | Verb prefixes | `connect()`, `buildUrl()`, `parseError()` |

### VS Code Authentication API - CRITICAL

**The ONLY way to obtain credentials (per NFR6, NFR7, AR11):**

```typescript
// Get credentials via VS Code authentication provider
const session = await vscode.authentication.getSession(
  'intersystems-server-credentials', // Server Manager's auth provider ID
  [serverName],                       // Scopes array - use server name
  { createIfNone: true }              // Prompt user if no session exists
);

// session object contains:
// - session.accessToken: The password (NOT base64 encoded - use directly)
// - session.account.id: The username
// - session.account.label: Display name
```

**SECURITY CRITICAL:**
- NEVER store password in class properties or state
- NEVER log password, accessToken, or any credential
- Password is used ONLY when building HTTP Authorization header
- Credentials retrieved fresh for each connection attempt

### Atelier API Connection Test

**Test connection by querying system info:**

```typescript
// POST /api/atelier/v1/{NAMESPACE}/action/query
// Body:
{
  "query": "SELECT 1",
  "parameters": []
}

// Success response (status.errors.length === 0):
{
  "status": { "errors": [], "summary": "" },
  "result": { "content": [{ "1": 1 }] }
}

// Error response:
{
  "status": {
    "errors": [
      { "error": "ERROR #xxx: Error message here" }
    ]
  }
}
```

**Authentication Header:**

```typescript
// Build Basic Auth header
const credentials = `${username}:${password}`;
const encoded = Buffer.from(credentials).toString('base64');
const headers = {
  'Authorization': `Basic ${encoded}`,
  'Content-Type': 'application/json'
};
```

### ErrorHandler Implementation

**Per architecture.md - Error codes and user messages:**

```typescript
// src/utils/ErrorHandler.ts

export const ErrorCodes = {
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  SERVER_UNREACHABLE: 'SERVER_UNREACHABLE',

  // Authentication errors
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',

  // API errors
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export interface IUserError {
  message: string;      // User-friendly message
  code: string;         // Error code from ErrorCodes
  recoverable: boolean; // Can user retry?
  context: string;      // What operation failed
}

export class ErrorHandler {
  /**
   * Parse Atelier API response for errors
   * @param response - Raw fetch response or Atelier response body
   * @param context - Operation that failed (e.g., 'connect', 'query')
   */
  public static parse(response: unknown, context: string): IUserError | null {
    // Implementation should check:
    // 1. HTTP status codes (401 = AUTH_FAILED, 404 = SERVER_UNREACHABLE, etc.)
    // 2. response.status.errors array for IRIS-specific errors
    // 3. Network errors (fetch failures)
  }

  /**
   * Map error to user-friendly message
   */
  public static getUserMessage(error: IUserError): string {
    // Return actionable message based on error code
  }
}
```

**Error Message Mapping:**

| Error Code | User Message |
|------------|--------------|
| AUTH_FAILED | "Authentication failed. Please check your username and password in Server Manager." |
| CONNECTION_TIMEOUT | "Connection timed out. The server may be busy or unreachable." |
| SERVER_UNREACHABLE | "Cannot reach server. Please verify the server address and that IRIS is running." |
| INVALID_RESPONSE | "Received unexpected response from server. Please try again." |
| UNKNOWN_ERROR | "An unexpected error occurred: [original message]" |

### UrlBuilder Implementation

**Per architecture.md - URL construction with encoding:**

```typescript
// src/utils/UrlBuilder.ts

export class UrlBuilder {
  /**
   * Build base URL from server specification
   */
  public static buildBaseUrl(spec: IServerSpec): string {
    const protocol = spec.port === 443 ? 'https' : 'http';
    const pathPrefix = spec.pathPrefix || '/api/atelier/';
    return `${protocol}://${spec.host}:${spec.port}${pathPrefix}`;
  }

  /**
   * Build query endpoint URL with encoded namespace
   * CRITICAL: Encode % as %25 for system namespaces like %SYS
   */
  public static buildQueryUrl(baseUrl: string, namespace: string): string {
    // Encode % as %25 BEFORE standard URL encoding
    const encodedNamespace = namespace.replace(/%/g, '%25');
    return `${baseUrl}v1/${encodedNamespace}/action/query`;
  }
}
```

### Command/Event Message Updates

**Add to IMessages.ts:**

```typescript
// New command types
interface ISelectServerPayload {
  serverName: string;
}

interface IDisconnectPayload {}

// New event types
interface IConnectionStatusPayload {
  connected: boolean;
  serverName: string | null;
  namespace?: string;  // May be populated later in Story 1.5
}

interface IConnectionErrorPayload extends IErrorPayload {
  serverName: string;  // Which server failed
}

// Update ServerCommands type
type ServerCommands =
  | { command: 'getServerList'; payload: {} }
  | { command: 'selectServer'; payload: ISelectServerPayload }
  | { command: 'disconnect'; payload: IDisconnectPayload };

// Update ServerEvents type
type ServerEvents =
  | { event: 'serverList'; payload: IServerListPayload }
  | { event: 'serverManagerNotInstalled'; payload: {} }
  | { event: 'noServersConfigured'; payload: {} }
  | { event: 'connectionStatus'; payload: IConnectionStatusPayload }
  | { event: 'connectionError'; payload: IConnectionErrorPayload }
  | { event: 'error'; payload: IErrorPayload };
```

### Webview State Updates

**Extend AppState with connection state:**

```javascript
class AppState {
  constructor(initialState = {}) {
    this._state = {
      // Existing from Story 1.3
      servers: [],
      selectedServer: initialState.selectedServer || null,
      isLoading: true,
      loadingContext: 'loadingServers',
      error: null,
      serverManagerInstalled: true,
      serversConfigured: true,

      // NEW for Story 1.4
      connectionState: 'disconnected', // 'disconnected' | 'connecting' | 'connected'
      connectedServer: null,           // Server name when connected
    };
    // ...
  }
}
```

### UI States and Transitions

**Connection Flow:**

```
Server List (disconnected)
    │
    ▼ Click server
Connecting (loading spinner, disable UI)
    │
    ├─► Success: Connected View
    │     - Show connection header with server name
    │     - Show disconnect button
    │     - Ready for namespace browsing (Story 1.5)
    │
    └─► Failure: Error Display
          - Show error message
          - Stay on server list
          - User can retry
```

**Connected State UI:**

```
┌─────────────────────────────────────────────┐
│ ● Connected to dev-server      [Disconnect] │  ← .ite-connection-header
├─────────────────────────────────────────────┤
│                                             │
│   Ready to browse namespaces                │  ← Placeholder for Story 1.5
│   (Namespace list will appear here)         │
│                                             │
└─────────────────────────────────────────────┘
```

### ServerConnectionManager Updates

**Add connection methods:**

```typescript
export class ServerConnectionManager {
  private _connectedServer: string | null = null;
  private _serverSpec: IServerSpec | null = null;

  /**
   * Connect to a server using Server Manager credentials
   * @returns Connection result with success status and any error
   */
  public async connect(serverName: string): Promise<{
    success: boolean;
    error?: IUserError;
  }> {
    // 1. Get server spec
    const spec = await this.getServerSpec(serverName);
    if (!spec) {
      return {
        success: false,
        error: {
          message: `Server '${serverName}' not found`,
          code: ErrorCodes.SERVER_UNREACHABLE,
          recoverable: false,
          context: 'connect'
        }
      };
    }

    // 2. Get credentials via VS Code auth API
    try {
      const session = await vscode.authentication.getSession(
        'intersystems-server-credentials',
        [serverName],
        { createIfNone: true }
      );

      if (!session) {
        return {
          success: false,
          error: {
            message: 'Authentication cancelled',
            code: ErrorCodes.AUTH_FAILED,
            recoverable: true,
            context: 'connect'
          }
        };
      }

      // 3. Test connection with Atelier API
      const apiService = new AtelierApiService();
      const testResult = await apiService.testConnection(
        spec,
        session.account.id,  // username
        session.accessToken  // password
      );

      if (!testResult.success) {
        return { success: false, error: testResult.error };
      }

      // 4. Store connection state
      this._connectedServer = serverName;
      this._serverSpec = spec;

      console.debug(`${LOG_PREFIX} Connected to server: ${serverName}`);
      return { success: true };

    } catch (error) {
      console.error(`${LOG_PREFIX} Connection error:`, error);
      return {
        success: false,
        error: ErrorHandler.parse(error, 'connect') || {
          message: 'Connection failed unexpectedly',
          code: ErrorCodes.UNKNOWN_ERROR,
          recoverable: true,
          context: 'connect'
        }
      };
    }
  }

  /**
   * Disconnect from current server
   */
  public disconnect(): void {
    console.debug(`${LOG_PREFIX} Disconnecting from server: ${this._connectedServer}`);
    this._connectedServer = null;
    this._serverSpec = null;
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this._connectedServer !== null;
  }

  /**
   * Get current connected server name
   */
  public getConnectedServer(): string | null {
    return this._connectedServer;
  }

  /**
   * Get current server spec (for API calls)
   */
  public getServerSpec(): IServerSpec | null {
    return this._serverSpec;
  }
}
```

### AtelierApiService Implementation

**Create the API service:**

```typescript
// src/services/AtelierApiService.ts

import { IServerSpec } from '../models/IServerSpec';
import { IUserError } from '../models/IMessages';
import { ErrorHandler, ErrorCodes } from '../utils/ErrorHandler';
import { UrlBuilder } from '../utils/UrlBuilder';

const LOG_PREFIX = '[IRIS-TE]';

export class AtelierApiService {
  private _timeout = 10000; // 10 second timeout

  /**
   * Test connection to server with a simple query
   */
  public async testConnection(
    spec: IServerSpec,
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: IUserError }> {
    const url = UrlBuilder.buildQueryUrl(
      UrlBuilder.buildBaseUrl(spec),
      'USER' // Use USER namespace for test (most likely to exist)
    );

    const headers = this._buildAuthHeaders(username, password);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this._timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: 'SELECT 1',
          parameters: []
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Check HTTP status
      if (response.status === 401) {
        return {
          success: false,
          error: {
            message: 'Authentication failed. Please check your credentials.',
            code: ErrorCodes.AUTH_FAILED,
            recoverable: true,
            context: 'testConnection'
          }
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: {
            message: `Server returned status ${response.status}`,
            code: ErrorCodes.CONNECTION_FAILED,
            recoverable: true,
            context: 'testConnection'
          }
        };
      }

      // Parse response body
      const body = await response.json();

      // Check for Atelier errors
      if (body.status?.errors?.length > 0) {
        const error = ErrorHandler.parse(body, 'testConnection');
        // Even with errors, connection itself worked (we got a valid response)
        // Only fail if it's an auth error
        if (error?.code === ErrorCodes.AUTH_FAILED) {
          return { success: false, error };
        }
      }

      console.debug(`${LOG_PREFIX} Connection test successful`);
      return { success: true };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: {
            message: 'Connection timed out. The server may be busy or unreachable.',
            code: ErrorCodes.CONNECTION_TIMEOUT,
            recoverable: true,
            context: 'testConnection'
          }
        };
      }

      // Network error
      return {
        success: false,
        error: {
          message: 'Cannot reach server. Please verify the server address and that IRIS is running.',
          code: ErrorCodes.SERVER_UNREACHABLE,
          recoverable: true,
          context: 'testConnection'
        }
      };
    }
  }

  /**
   * Build HTTP headers with Basic Auth
   * SECURITY: Password is used here only, never stored
   */
  private _buildAuthHeaders(username: string, password: string): Record<string, string> {
    const credentials = `${username}:${password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json'
    };
  }
}
```

### Project Structure After This Story

```
src/
├── extension.ts                    # Entry point
├── providers/
│   ├── TableEditorProvider.ts      # WebviewViewProvider (updated)
│   └── ServerConnectionManager.ts  # Server Manager integration (updated)
├── services/
│   └── AtelierApiService.ts        # NEW: HTTP client for Atelier API
├── models/
│   ├── IServerSpec.ts              # Server specification interface
│   └── IMessages.ts                # Command/Event types (updated)
├── utils/
│   ├── ErrorHandler.ts             # NEW: Error parsing and mapping
│   └── UrlBuilder.ts               # NEW: Atelier URL construction
└── test/
    ├── extension.test.ts           # Existing tests
    ├── serverConnectionManager.test.ts # Existing tests (extend)
    ├── atelierApiService.test.ts   # NEW: API service tests
    ├── errorHandler.test.ts        # NEW: Error handler tests
    └── urlBuilder.test.ts          # NEW: URL builder tests
media/
├── webview.html                    # Reference template
├── styles.css                      # Updated with connection styles
└── main.js                         # Updated with connection logic
```

### What NOT to Do

- **Do NOT implement namespace browsing** (Story 1.5)
- **Do NOT implement table browsing** (Story 1.6)
- **Do NOT store passwords** in any class property, state, or persistent storage
- **Do NOT log credentials** (username, password, accessToken, Authorization header)
- **Do NOT hardcode server addresses** or credentials
- **Do NOT skip the authentication API** - always use `vscode.authentication.getSession()`
- **Do NOT use deprecated Server Manager API patterns** - credentials are NOT in ServerSpec

### Previous Story Learnings (from 1.1, 1.2, 1.3)

1. **ESLint uses modern flat config format** (`eslint.config.mjs`)
2. **LOG_PREFIX pattern**: All console output must use `[IRIS-TE]` prefix
3. **Build verification**: Always run `npm run compile` and `npm run lint` before marking complete
4. **Server Manager API access**: Use `vscode.extensions.getExtension<ServerManagerAPI>()` to access API
5. **getServerNames()** returns `IServerName[]` objects (with `name`, `description`, `detail`), not plain strings
6. **XSS prevention**: Always escape HTML in dynamic content with `escapeHtml()` function
7. **Disposable cleanup**: Add event listeners to `_disposables` array for cleanup on view dispose
8. **State persistence**: Use `vscode.setState()`/`vscode.getState()` for webview state restoration

### Git Context

Recent commits:
- `2c2dbde` feat(story-1.3): Server Manager integration with security fixes
- `51c0192` feat(story-1.2): Extension shell with sidebar view
- `38c7fa9` feat(story-1.1): Initialize VS Code extension project

This story builds directly on 1.3's server list infrastructure.

### Success Verification Checklist

**Build & Tests:**
- [ ] `npm run compile` exits with code 0
- [ ] `npm run lint` passes with no errors
- [ ] `npm run test` - all tests pass (including new ones)

**Files Created:**
- [ ] `src/services/AtelierApiService.ts`
- [ ] `src/utils/ErrorHandler.ts`
- [ ] `src/utils/UrlBuilder.ts`
- [ ] `src/test/atelierApiService.test.ts`
- [ ] `src/test/errorHandler.test.ts`
- [ ] `src/test/urlBuilder.test.ts`

**Files Modified:**
- [ ] `src/providers/ServerConnectionManager.ts` (add connect/disconnect)
- [ ] `src/providers/TableEditorProvider.ts` (add connection handling)
- [ ] `src/models/IMessages.ts` (add connection types)
- [ ] `media/main.js` (add connection UI logic)
- [ ] `media/styles.css` (add connection styles)

**Functional Verification:**
- [ ] Clicking server in list triggers connection attempt
- [ ] Loading spinner shows during connection
- [ ] Successful connection shows connected header with server name
- [ ] Disconnect button is visible when connected
- [ ] Clicking disconnect returns to server list
- [ ] Auth failure shows clear error message
- [ ] Network failure shows clear error message
- [ ] User remains on server list after failed connection

**Security Verification:**
- [ ] No credentials in console logs
- [ ] No credentials stored in class properties after connection
- [ ] `vscode.authentication.getSession()` used for all credential access

**Accessibility Verification:**
- [ ] Connection status announced to screen readers
- [ ] Error messages announced to screen readers
- [ ] Disconnect button keyboard accessible
- [ ] Focus management after connection state changes

### References

- [Source: architecture.md#Extension ↔ Server Manager Boundary]
- [Source: architecture.md#HTTP Client Decision]
- [Source: architecture.md#Error Handling Strategy]
- [Source: architecture.md#Integration Points]
- [Source: epics.md#Story 1.4: Server Authentication & Connection Status]
- [Source: prd.md#NFR6-NFR9 Security Requirements]
- [Source: ux-design-specification.md#Core User Experience]
- [Source: 1-3-server-manager-integration.md#Learnings for Future Stories]
- [Source: CLAUDE.md#Server Manager Integration]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 67 unit tests pass
- Build compiles without errors
- Lint passes with no warnings

### Completion Notes List

1. **ErrorHandler Utility** (`src/utils/ErrorHandler.ts`): Implemented comprehensive error handling with ErrorCodes enum, IUserError interface, and static methods for parsing HTTP responses, Atelier API responses, and standard Error objects. Includes user-friendly message mapping for all error codes.

2. **UrlBuilder Utility** (`src/utils/UrlBuilder.ts`): Implemented URL construction with proper namespace encoding (% → %25 for system namespaces like %SYS). Supports buildBaseUrl, buildQueryUrl, encodeNamespace, and buildEndpointUrl methods.

3. **AtelierApiService** (`src/services/AtelierApiService.ts`): Implemented HTTP client for Atelier REST API with testConnection and executeQuery methods. Uses native fetch with timeout handling (AbortController), Basic Auth header construction, and proper error mapping.

4. **IMessages.ts Updates**: Added ISelectServerPayload, IDisconnectPayload, IConnectionStatusPayload, IConnectionErrorPayload, IUserError interfaces. Updated ServerCommand and ServerEvent types.

5. **ServerConnectionManager Updates**: Added connect(serverName) method using VS Code authentication API (vscode.authentication.getSession), disconnect() method, isConnected(), getConnectedServer(), getConnectedServerSpec() methods. Follows security requirements - no credentials stored in properties.

6. **TableEditorProvider Updates**: Added _handleSelectServer and _handleDisconnect handlers. Tracks connection state (_isConnected, _connectedServer). Posts connectionStatus and connectionError events to webview.

7. **Webview JavaScript** (`media/main.js`): Extended AppState with connectionState and connectedServer. Added handleConnectionStatus and handleConnectionError functions. Implemented renderConnecting and renderConnected functions. Added attachConnectedEvents for disconnect button.

8. **Webview CSS** (`media/styles.css`): Added .ite-connection-header styles (status indicator, server name, disconnect button). Added .ite-connected-content placeholder for namespace browsing. Added reduced motion support.

9. **Unit Tests**: Created errorHandler.test.ts (17 tests), urlBuilder.test.ts (16 tests), atelierApiService.test.ts (10 tests). Extended serverConnectionManager.test.ts with 10 new tests for connect/disconnect.

### Change Log

- 2026-01-27: Story 1.4 implementation complete - Server authentication and connection status
- 2026-01-27: Code review - Fixed duplicate IUserError type definitions (consolidated to ErrorHandler.ts), updated File List to include sprint-status.yaml

### File List

**Files Created:**
- `src/services/AtelierApiService.ts`
- `src/utils/ErrorHandler.ts`
- `src/utils/UrlBuilder.ts`
- `src/test/atelierApiService.test.ts`
- `src/test/errorHandler.test.ts`
- `src/test/urlBuilder.test.ts`

**Files Modified:**
- `src/providers/ServerConnectionManager.ts`
- `src/providers/TableEditorProvider.ts`
- `src/models/IMessages.ts`
- `src/test/serverConnectionManager.test.ts`
- `media/main.js`
- `media/styles.css`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
