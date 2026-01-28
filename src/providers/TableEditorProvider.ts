import * as vscode from 'vscode';
import { ServerConnectionManager } from './ServerConnectionManager';
import {
    ICommand,
    IEvent,
    IEmptyPayload,
    IServerListPayload,
    ISelectServerPayload,
    IConnectionStatusPayload,
    IConnectionErrorPayload
} from '../models/IMessages';

const LOG_PREFIX = '[IRIS-TE]';

export class TableEditorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'iris-table-editor.mainView';

    private _view?: vscode.WebviewView;
    private _serverConnectionManager: ServerConnectionManager;
    private _disposables: vscode.Disposable[] = [];
    private _isConnected = false;
    private _connectedServer: string | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri
    ) {
        this._serverConnectionManager = new ServerConnectionManager();
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
                vscode.Uri.joinPath(this._extensionUri, 'media'),
                vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')
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
            case 'selectServer':
                await this._handleSelectServer((message.payload as ISelectServerPayload).serverName);
                break;
            case 'disconnect':
                this._handleDisconnect();
                break;
        }
    }

    /**
     * Handle server selection and connection
     * @param serverName - Name of the server to connect to
     */
    private async _handleSelectServer(serverName: string): Promise<void> {
        console.debug(`${LOG_PREFIX} Connecting to server: ${serverName}`);

        const result = await this._serverConnectionManager.connect(serverName);

        if (result.success) {
            this._isConnected = true;
            this._connectedServer = serverName;

            this._postMessage({
                event: 'connectionStatus',
                payload: {
                    connected: true,
                    serverName: serverName
                } as IConnectionStatusPayload
            });
        } else {
            // Connection failed
            this._postMessage({
                event: 'connectionError',
                payload: {
                    serverName: serverName,
                    message: result.error?.message || 'Connection failed',
                    code: result.error?.code || 'UNKNOWN_ERROR',
                    recoverable: result.error?.recoverable ?? true,
                    context: result.error?.context || 'connect'
                } as IConnectionErrorPayload
            });
        }
    }

    /**
     * Handle disconnect from server
     */
    private _handleDisconnect(): void {
        console.debug(`${LOG_PREFIX} Disconnecting from server: ${this._connectedServer}`);

        this._serverConnectionManager.disconnect();
        this._isConnected = false;
        this._connectedServer = null;

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
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css')
        );
        const codiconUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${codiconUri}" rel="stylesheet">
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
