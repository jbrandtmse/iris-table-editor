import * as vscode from 'vscode';
import { ServerConnectionManager } from './ServerConnectionManager';
import {
    ICommand,
    IEvent,
    ITableSchemaPayload,
    ITableDataPayload,
    ITableLoadingPayload,
    IErrorPayload,
    IRequestDataPayload,
    IPaginatePayload
} from '../models/IMessages';

const LOG_PREFIX = '[IRIS-TE]';

/**
 * Context for a table grid panel
 */
interface IGridPanelContext {
    serverName: string;
    namespace: string;
    tableName: string;
    pageSize: number;
    currentPage: number;
}

/**
 * Manages grid webview panels for table data display
 * Per architecture decision: Uses WebviewPanel for editor area display
 */
export class GridPanelManager {
    private _panels: Map<string, vscode.WebviewPanel> = new Map();
    private _panelContexts: Map<string, IGridPanelContext> = new Map();
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _serverConnectionManager: ServerConnectionManager
    ) {}

    /**
     * Open or focus a grid panel for a table
     * @param serverName - Connected server name
     * @param namespace - Namespace containing the table
     * @param tableName - Table to display
     */
    public async openTableGrid(serverName: string, namespace: string, tableName: string): Promise<void> {
        const panelKey = this._getPanelKey(serverName, namespace, tableName);

        // Check if panel already exists
        const existingPanel = this._panels.get(panelKey);
        if (existingPanel) {
            existingPanel.reveal(vscode.ViewColumn.One);
            console.debug(`${LOG_PREFIX} Revealed existing grid panel for ${tableName}`);
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'irisTableGrid',
            `${tableName} (${namespace}@${serverName})`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'media'),
                    vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')
                ]
            }
        );

        // Store panel and context
        // Story 2.2: Default pageSize is 50 per architecture spec
        this._panels.set(panelKey, panel);
        this._panelContexts.set(panelKey, {
            serverName,
            namespace,
            tableName,
            pageSize: 50,
            currentPage: 0
        });

        // Set HTML content
        panel.webview.html = this._getGridHtml(panel.webview, serverName, namespace, tableName);

        // Handle messages from grid webview
        panel.webview.onDidReceiveMessage(
            message => this._handleGridMessage(panelKey, message),
            undefined,
            this._disposables
        );

        // Handle panel disposal
        panel.onDidDispose(() => {
            console.debug(`${LOG_PREFIX} Grid panel disposed for ${tableName}`);
            this._panels.delete(panelKey);
            this._panelContexts.delete(panelKey);
        }, undefined, this._disposables);

        console.debug(`${LOG_PREFIX} Created grid panel for ${tableName}`);

        // Load schema and initial data
        await this._loadTableData(panelKey);
    }

    /**
     * Dispose all panels
     */
    public dispose(): void {
        this._panels.forEach(panel => panel.dispose());
        this._panels.clear();
        this._panelContexts.clear();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }

    /**
     * Generate unique key for panel lookup
     */
    private _getPanelKey(serverName: string, namespace: string, tableName: string): string {
        return `${serverName}:${namespace}:${tableName}`;
    }

    /**
     * Handle messages from grid webview
     * Story 2.2: Added pagination command handlers
     */
    private async _handleGridMessage(panelKey: string, message: ICommand): Promise<void> {
        console.debug(`${LOG_PREFIX} Grid command: ${message.command}`);

        const context = this._panelContexts.get(panelKey);
        if (!context) {
            console.error(`${LOG_PREFIX} No context for panel ${panelKey}`);
            return;
        }

        switch (message.command) {
            case 'requestData': {
                const payload = message.payload as IRequestDataPayload;
                context.currentPage = payload.page;
                context.pageSize = payload.pageSize;
                await this._loadTableData(panelKey, payload.page, payload.pageSize);
                break;
            }
            case 'refresh':
                await this._loadTableData(panelKey, context.currentPage, context.pageSize);
                break;
            case 'paginateNext': {
                const payload = message.payload as IPaginatePayload;
                // currentPage from webview is 1-indexed, convert to 0-indexed for API
                const newPage = payload.currentPage; // Already next page in 0-indexed terms
                context.currentPage = newPage;
                await this._loadTableData(panelKey, newPage, payload.pageSize);
                break;
            }
            case 'paginatePrev': {
                const payload = message.payload as IPaginatePayload;
                // currentPage from webview is 1-indexed, convert to 0-indexed for API
                const newPage = payload.currentPage - 2; // -1 for prev, -1 for 0-index conversion
                context.currentPage = newPage;
                await this._loadTableData(panelKey, newPage, payload.pageSize);
                break;
            }
        }
    }

    /**
     * Load table schema and data for a panel
     * Story 2.2: Default pageSize changed to 50
     */
    private async _loadTableData(panelKey: string, page = 0, pageSize = 50): Promise<void> {
        const panel = this._panels.get(panelKey);
        const context = this._panelContexts.get(panelKey);

        if (!panel || !context) {
            return;
        }

        // Send loading state
        this._postMessage(panel, {
            event: 'tableLoading',
            payload: { loading: true, context: 'Loading table data...' } as ITableLoadingPayload
        });

        try {
            // Get schema first
            const schemaResult = await this._serverConnectionManager.getTableSchema(
                context.namespace,
                context.tableName
            );

            if (!schemaResult.success || !schemaResult.schema) {
                this._postMessage(panel, {
                    event: 'error',
                    payload: {
                        message: schemaResult.error?.message || 'Failed to load table schema',
                        code: schemaResult.error?.code || 'UNKNOWN_ERROR',
                        recoverable: true,
                        context: 'getTableSchema'
                    } as IErrorPayload
                });
                this._postMessage(panel, {
                    event: 'tableLoading',
                    payload: { loading: false, context: '' } as ITableLoadingPayload
                });
                return;
            }

            // Send schema
            this._postMessage(panel, {
                event: 'tableSchema',
                payload: {
                    tableName: context.tableName,
                    namespace: context.namespace,
                    serverName: context.serverName,
                    columns: schemaResult.schema.columns
                } as ITableSchemaPayload
            });

            // Get data
            const offset = page * pageSize;
            const dataResult = await this._serverConnectionManager.getTableData(
                context.namespace,
                context.tableName,
                pageSize,
                offset
            );

            if (!dataResult.success) {
                this._postMessage(panel, {
                    event: 'error',
                    payload: {
                        message: dataResult.error?.message || 'Failed to load table data',
                        code: dataResult.error?.code || 'UNKNOWN_ERROR',
                        recoverable: true,
                        context: 'getTableData'
                    } as IErrorPayload
                });
                this._postMessage(panel, {
                    event: 'tableLoading',
                    payload: { loading: false, context: '' } as ITableLoadingPayload
                });
                return;
            }

            // Send data
            this._postMessage(panel, {
                event: 'tableData',
                payload: {
                    rows: dataResult.rows || [],
                    totalRows: dataResult.totalRows || 0,
                    page,
                    pageSize
                } as ITableDataPayload
            });

            // Clear loading
            this._postMessage(panel, {
                event: 'tableLoading',
                payload: { loading: false, context: '' } as ITableLoadingPayload
            });

            console.debug(`${LOG_PREFIX} Loaded ${dataResult.rows?.length || 0} rows for ${context.tableName}`);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error loading table data:`, error);
            this._postMessage(panel, {
                event: 'error',
                payload: {
                    message: 'An unexpected error occurred while loading table data',
                    code: 'UNKNOWN_ERROR',
                    recoverable: true,
                    context: 'loadTableData'
                } as IErrorPayload
            });
            this._postMessage(panel, {
                event: 'tableLoading',
                payload: { loading: false, context: '' } as ITableLoadingPayload
            });
        }
    }

    /**
     * Post message to panel webview
     */
    private _postMessage(panel: vscode.WebviewPanel, event: IEvent): void {
        panel.webview.postMessage(event);
    }

    /**
     * Generate HTML for grid webview
     */
    private _getGridHtml(webview: vscode.Webview, serverName: string, namespace: string, tableName: string): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'grid-styles.css')
        );
        const codiconUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'grid.js')
        );

        const nonce = this._getNonce();

        // Escape HTML entities for safety
        const escapeHtml = (str: string) => str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${codiconUri}" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>${escapeHtml(tableName)} - IRIS Table Editor</title>
</head>
<body>
    <div class="ite-grid-container">
        <div class="ite-context-bar">
            <span class="ite-context-bar__server">${escapeHtml(serverName)}</span>
            <span class="ite-context-bar__separator">&gt;</span>
            <span class="ite-context-bar__namespace">${escapeHtml(namespace)}</span>
            <span class="ite-context-bar__separator">&gt;</span>
            <span class="ite-context-bar__table">${escapeHtml(tableName)}</span>
        </div>

        <div class="ite-toolbar">
            <button class="ite-toolbar__button" id="refreshBtn" title="Refresh data">
                <i class="codicon codicon-refresh"></i>
            </button>
        </div>

        <div class="ite-grid-loading" id="loadingOverlay" style="display: flex;">
            <div class="ite-loading__spinner"></div>
            <p class="ite-loading__text">Loading table data...</p>
        </div>

        <div class="ite-grid-wrapper" id="gridWrapper" style="display: none;">
            <div class="ite-grid" id="dataGrid" role="grid" aria-label="Table data">
                <!-- Grid content will be populated by JavaScript -->
            </div>
        </div>

        <!-- Story 2.2: Pagination Controls -->
        <div class="ite-pagination" id="paginationContainer" role="navigation" aria-label="Table pagination" style="display: none;">
            <span class="ite-pagination__info" id="paginationInfo" aria-live="polite">
                Rows 1-50 of 0
            </span>
            <div class="ite-pagination__controls">
                <button class="ite-pagination__button"
                        id="prevPageBtn"
                        aria-label="Previous page"
                        disabled>
                    ◀ Prev
                </button>
                <button class="ite-pagination__button"
                        id="nextPageBtn"
                        aria-label="Next page">
                    Next ▶
                </button>
            </div>
        </div>

        <div class="ite-status-bar" id="statusBar">
            <span class="ite-status-bar__text" id="statusText">Loading...</span>
        </div>
    </div>
    <div id="ite-live-region" class="visually-hidden" aria-live="polite" aria-atomic="true"></div>
    <script nonce="${nonce}">
        // Pass initial context to webview
        window.iteContext = {
            serverName: "${escapeHtml(serverName)}",
            namespace: "${escapeHtml(namespace)}",
            tableName: "${escapeHtml(tableName)}"
        };
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Generate nonce for CSP
     */
    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
