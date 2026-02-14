import * as vscode from 'vscode';
import { ServerConnectionManager } from './ServerConnectionManager';
import { GridPanelManager } from './GridPanelManager';
import {
    ICommand,
    IEvent,
    IEmptyPayload,
    IServerListPayload,
    ISelectServerPayload,
    IConnectionStatusPayload,
    IConnectionErrorPayload,
    IConnectionProgressPayload,
    ISelectNamespacePayload,
    INamespaceListPayload,
    INamespaceSelectedPayload,
    IGetTablesPayload,
    ISelectTablePayload,
    ITableListPayload,
    ITableSelectedPayload,
    IErrorPayload,
    IOpenTablePayload
} from '@iris-te/core';

const LOG_PREFIX = '[IRIS-TE]';

export class TableEditorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'iris-table-editor.mainView';

    private _view?: vscode.WebviewView;
    private _serverConnectionManager: ServerConnectionManager;
    private _gridPanelManager: GridPanelManager;
    private _disposables: vscode.Disposable[] = [];
    private _isConnected = false;
    private _connectedServer: string | null = null;
    private _selectedNamespace: string | null = null;
    private _selectedTable: string | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri
    ) {
        this._serverConnectionManager = new ServerConnectionManager();
        this._gridPanelManager = new GridPanelManager(this._extensionUri, this._serverConnectionManager);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        console.debug(`${LOG_PREFIX} Resolving webview view`);

        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'webview'),
                vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'codicons'),
                vscode.Uri.joinPath(this._extensionUri, 'src')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        this._disposables.push(
            webviewView.webview.onDidReceiveMessage(
                message => this._handleMessage(message)
            )
        );

        // Clean up disposables when view is disposed
        webviewView.onDidDispose(() => {
            console.debug(`${LOG_PREFIX} Webview view disposed`);
            this._disposables.forEach(d => d.dispose());
            this._disposables = [];
            this._gridPanelManager.dispose();
        });

        // Send initial server list
        this._sendServerList();
    }

    public revealView(): void {
        if (this._view) {
            this._view.show(true);
        }
    }

    /**
     * Handle messages from the webview
     */
    private async _handleMessage(message: ICommand): Promise<void> {
        console.debug(`${LOG_PREFIX} Received command: ${message.command}`);

        switch (message.command) {
            case 'getServerList':
                await this._sendServerList();
                break;
            case 'openServerManager':
                await vscode.commands.executeCommand('workbench.view.extension.intersystems-community-servermanager');
                break;
            case 'installServerManager':
                await vscode.commands.executeCommand('workbench.extensions.installExtension', 'intersystems-community.servermanager');
                break;
            case 'selectServer':
                await this._handleSelectServer((message.payload as ISelectServerPayload).serverName);
                break;
            case 'disconnect':
                this._handleDisconnect();
                break;
            case 'getNamespaces':
                await this._handleGetNamespaces();
                break;
            case 'selectNamespace':
                await this._handleSelectNamespace(message.payload as ISelectNamespacePayload);
                break;
            case 'getTables':
                await this._handleGetTables(message.payload as IGetTablesPayload);
                break;
            case 'selectTable':
                this._handleSelectTable(message.payload as ISelectTablePayload);
                break;
            case 'openTable':
                await this._handleOpenTable(message.payload as IOpenTablePayload);
                break;
            case 'cancelConnection':
                this._handleCancelConnection();
                break;
        }
    }

    /**
     * Handle server selection and connection
     * @param serverName - Name of the server to connect to
     */
    private async _handleSelectServer(serverName: string): Promise<void> {
        console.debug(`${LOG_PREFIX} Connecting to server: ${serverName}`);

        // Post connecting progress event
        this._postMessage({
            event: 'connectionProgress',
            payload: {
                status: 'connecting',
                serverName
            } as IConnectionProgressPayload
        });

        const result = await this._serverConnectionManager.connect(serverName);

        if (result.success) {
            this._isConnected = true;
            this._connectedServer = serverName;
            this._selectedNamespace = null; // Reset namespace selection on new connection

            // Post connected progress event
            this._postMessage({
                event: 'connectionProgress',
                payload: {
                    status: 'connected',
                    serverName
                } as IConnectionProgressPayload
            });

            this._postMessage({
                event: 'connectionStatus',
                payload: {
                    connected: true,
                    serverName: serverName
                } as IConnectionStatusPayload
            });

            // Auto-fetch namespaces after successful connection
            await this._handleGetNamespaces();
        } else {
            const errorCode = result.error?.code || 'UNKNOWN_ERROR';

            // Determine connection progress status based on error code
            if (errorCode === 'CONNECTION_CANCELLED') {
                this._postMessage({
                    event: 'connectionProgress',
                    payload: {
                        status: 'cancelled',
                        serverName
                    } as IConnectionProgressPayload
                });
            } else if (errorCode === 'CONNECTION_TIMEOUT') {
                this._postMessage({
                    event: 'connectionProgress',
                    payload: {
                        status: 'timeout',
                        serverName,
                        message: result.error?.message
                    } as IConnectionProgressPayload
                });
            } else {
                this._postMessage({
                    event: 'connectionProgress',
                    payload: {
                        status: 'error',
                        serverName,
                        message: result.error?.message
                    } as IConnectionProgressPayload
                });
            }

            // Also post the legacy connectionError for backwards compatibility
            this._postMessage({
                event: 'connectionError',
                payload: {
                    serverName: serverName,
                    message: result.error?.message || 'Connection failed',
                    code: errorCode,
                    recoverable: result.error?.recoverable ?? true,
                    context: result.error?.context || 'connect'
                } as IConnectionErrorPayload
            });
        }
    }

    /**
     * Handle cancel connection command (Story 1.7)
     */
    private _handleCancelConnection(): void {
        console.debug(`${LOG_PREFIX} Cancel connection requested`);
        this._serverConnectionManager.cancelConnection();
    }

    /**
     * Handle disconnect from server
     */
    private _handleDisconnect(): void {
        console.debug(`${LOG_PREFIX} Disconnecting from server: ${this._connectedServer}`);

        this._serverConnectionManager.disconnect();
        this._isConnected = false;
        this._connectedServer = null;
        this._selectedNamespace = null;
        this._selectedTable = null;

        this._postMessage({
            event: 'connectionStatus',
            payload: {
                connected: false,
                serverName: null
            } as IConnectionStatusPayload
        });

        // Send the server list again so user can reconnect
        this._sendServerList();
    }

    /**
     * Handle get namespaces request
     */
    private async _handleGetNamespaces(): Promise<void> {
        console.debug(`${LOG_PREFIX} Fetching namespaces`);

        const result = await this._serverConnectionManager.getNamespaces();

        if (!result.success) {
            this._postMessage({
                event: 'error',
                payload: {
                    message: result.error?.message || 'Failed to get namespaces',
                    code: result.error?.code || 'UNKNOWN_ERROR',
                    recoverable: result.error?.recoverable ?? true,
                    context: result.error?.context || 'getNamespaces'
                } as IErrorPayload
            });
            return;
        }

        console.debug(`${LOG_PREFIX} Sending namespace list: ${result.namespaces?.length || 0} namespaces`);
        this._postMessage({
            event: 'namespaceList',
            payload: { namespaces: result.namespaces || [] } as INamespaceListPayload
        });
    }

    /**
     * Handle namespace selection
     * @param payload - Namespace selection payload
     */
    private async _handleSelectNamespace(payload: ISelectNamespacePayload): Promise<void> {
        this._selectedNamespace = payload.namespace;
        this._selectedTable = null;  // Clear table selection when namespace changes
        console.debug(`${LOG_PREFIX} Selected namespace: ${payload.namespace}`);

        this._postMessage({
            event: 'namespaceSelected',
            payload: { namespace: payload.namespace } as INamespaceSelectedPayload
        });

        // Auto-fetch tables for selected namespace
        await this._handleGetTables({ namespace: payload.namespace });
    }

    /**
     * Handle get tables request
     * @param payload - Get tables payload with namespace
     */
    private async _handleGetTables(payload: IGetTablesPayload): Promise<void> {
        console.debug(`${LOG_PREFIX} Fetching tables for namespace: ${payload.namespace}`);

        const result = await this._serverConnectionManager.getTables(payload.namespace);

        if (!result.success) {
            this._postMessage({
                event: 'error',
                payload: {
                    message: result.error?.message || 'Failed to get tables',
                    code: result.error?.code || 'UNKNOWN_ERROR',
                    recoverable: result.error?.recoverable ?? true,
                    context: result.error?.context || 'getTables'
                } as IErrorPayload
            });
            return;
        }

        console.debug(`${LOG_PREFIX} Sending table list: ${result.tables?.length || 0} tables`);
        this._postMessage({
            event: 'tableList',
            payload: {
                tables: result.tables || [],
                namespace: payload.namespace
            } as ITableListPayload
        });
    }

    /**
     * Handle table selection
     * @param payload - Table selection payload
     */
    private _handleSelectTable(payload: ISelectTablePayload): void {
        this._selectedTable = payload.tableName;
        console.debug(`${LOG_PREFIX} Selected table: ${payload.tableName} in ${payload.namespace}`);

        this._postMessage({
            event: 'tableSelected',
            payload: {
                tableName: payload.tableName,
                namespace: payload.namespace
            } as ITableSelectedPayload
        });
    }

    /**
     * Handle open table command - opens grid panel in editor area
     * @param payload - Open table payload with namespace and table name
     */
    private async _handleOpenTable(payload: IOpenTablePayload): Promise<void> {
        if (!this._connectedServer) {
            this._postMessage({
                event: 'error',
                payload: {
                    message: 'Not connected to a server',
                    code: 'CONNECTION_FAILED',
                    recoverable: true,
                    context: 'openTable'
                } as IErrorPayload
            });
            return;
        }

        console.debug(`${LOG_PREFIX} Opening grid for table: ${payload.tableName} in ${payload.namespace}`);

        await this._gridPanelManager.openTableGrid(
            this._connectedServer,
            payload.namespace,
            payload.tableName
        );
    }

    /**
     * Send server list to webview based on Server Manager state
     */
    private async _sendServerList(): Promise<void> {
        if (!this._serverConnectionManager.isServerManagerInstalled()) {
            console.debug(`${LOG_PREFIX} Server Manager not installed`);
            this._postMessage({ event: 'serverManagerNotInstalled', payload: {} as IEmptyPayload });
            return;
        }

        const servers = await this._serverConnectionManager.getServerList();

        if (servers.length === 0) {
            console.debug(`${LOG_PREFIX} No servers configured`);
            this._postMessage({ event: 'noServersConfigured', payload: {} as IEmptyPayload });
            return;
        }

        console.debug(`${LOG_PREFIX} Sending server list: ${servers.length} servers`);
        this._postMessage({ event: 'serverList', payload: { servers } as IServerListPayload });
    }

    /**
     * Send a message/event to the webview
     */
    private _postMessage(event: IEvent): void {
        if (this._view) {
            this._view.webview.postMessage(event);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Theme CSS load order: theme.css -> vscodeThemeBridge.css -> styles.css
        const themeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'webview', 'theme.css')
        );
        const themeBridgeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'vscodeThemeBridge.css')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'webview', 'styles.css')
        );
        const codiconUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'codicons', 'codicon.css')
        );
        // JS load order: VSCodeMessageBridge -> main.js
        const bridgeScriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'VSCodeMessageBridge.js')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-dist', 'webview', 'main.js')
        );

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${codiconUri}" rel="stylesheet">
    <link href="${themeUri}" rel="stylesheet">
    <link href="${themeBridgeUri}" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>IRIS Table Editor</title>
</head>
<body>
    <div class="ite-container">
        <div class="ite-loading">
            <div class="ite-loading__spinner"></div>
            <p class="ite-loading__text">Loading servers...</p>
        </div>
    </div>
    <div id="ite-live-region" class="visually-hidden" aria-live="polite" aria-atomic="true"></div>
    <script nonce="${nonce}" src="${bridgeScriptUri}"></script>
    <script nonce="${nonce}">window.iteMessageBridge = new VSCodeMessageBridge();</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
