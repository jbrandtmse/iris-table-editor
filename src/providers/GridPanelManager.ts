import * as vscode from 'vscode';
import ExcelJS from 'exceljs';
import { ServerConnectionManager } from './ServerConnectionManager';
import {
    ICommand,
    IEvent,
    ITableSchemaPayload,
    ITableDataPayload,
    ITableLoadingPayload,
    IErrorPayload,
    IRequestDataPayload,
    IPaginatePayload,
    IRefreshPayload,
    IFilterCriterion,
    SortDirection,
    ISaveCellPayload,
    ISaveCellResultPayload,
    IInsertRowPayload,
    IInsertRowResultPayload,
    IDeleteRowPayload,
    IDeleteRowResultPayload
} from '../models/IMessages';

const LOG_PREFIX = '[IRIS-TE]';
const DEFAULT_PAGE_SIZE = 50;

/**
 * Context for a table grid panel
 * Story 6.2: Added filters tracking
 * Story 6.4: Added sort tracking
 */
interface IGridPanelContext {
    serverName: string;
    namespace: string;
    tableName: string;
    pageSize: number;
    currentPage: number;
    filters: IFilterCriterion[];
    sortColumn: string | null;
    sortDirection: SortDirection;
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
        // Story 6.2: Initialize filters as empty
        // Story 6.4: Initialize sort as null
        this._panels.set(panelKey, panel);
        this._panelContexts.set(panelKey, {
            serverName,
            namespace,
            tableName,
            pageSize: DEFAULT_PAGE_SIZE,
            currentPage: 0,
            filters: [],
            sortColumn: null,
            sortDirection: null
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
                // Story 6.2: Update filters from payload
                context.filters = payload.filters || [];
                // Story 6.4: Update sort from payload
                context.sortColumn = payload.sortColumn || null;
                context.sortDirection = payload.sortDirection || null;
                await this._loadTableData(panelKey, payload.page, payload.pageSize, context.filters, context.sortColumn, context.sortDirection);
                break;
            }
            case 'refresh': {
                // Story 6.2: Extract filters from refresh payload
                const refreshPayload = message.payload as IRefreshPayload;
                if (refreshPayload?.filters) {
                    context.filters = refreshPayload.filters;
                }
                // Story 6.4: Extract sort from refresh payload
                if (refreshPayload?.sortColumn !== undefined) {
                    context.sortColumn = refreshPayload.sortColumn || null;
                }
                if (refreshPayload?.sortDirection !== undefined) {
                    context.sortDirection = refreshPayload.sortDirection || null;
                }
                await this._loadTableData(panelKey, context.currentPage, context.pageSize, context.filters, context.sortColumn, context.sortDirection);
                break;
            }
            case 'paginateNext': {
                const payload = message.payload as IPaginatePayload;
                // Input validation: ensure payload has valid positive numbers
                if (!payload || typeof payload.currentPage !== 'number' || payload.currentPage < 1 ||
                    typeof payload.pageSize !== 'number' || payload.pageSize < 1) {
                    console.warn(`${LOG_PREFIX} Invalid paginateNext payload`);
                    return;
                }
                // Story 6.2: Update filters from payload
                if (payload.filters) {
                    context.filters = payload.filters;
                }
                // Story 6.4: Update sort from payload
                if (payload.sortColumn !== undefined) {
                    context.sortColumn = payload.sortColumn || null;
                }
                if (payload.sortDirection !== undefined) {
                    context.sortDirection = payload.sortDirection || null;
                }
                // Page conversion: webview sends 1-indexed page (1, 2, 3...)
                // API uses 0-indexed offset calculation: offset = page * pageSize
                // So 1-indexed page N -> 0-indexed page N-1 for current, we want N for next
                // When user is on page 1 and clicks Next: currentPage=1, API page=1, offset=50 (rows 51-100)
                const newPage = payload.currentPage;
                context.currentPage = newPage;
                await this._loadTableData(panelKey, newPage, payload.pageSize, context.filters, context.sortColumn, context.sortDirection);
                break;
            }
            case 'paginatePrev': {
                const payload = message.payload as IPaginatePayload;
                // Input validation: ensure payload has valid positive numbers
                // currentPage must be >= 2 for prev to make sense
                if (!payload || typeof payload.currentPage !== 'number' || payload.currentPage < 2 ||
                    typeof payload.pageSize !== 'number' || payload.pageSize < 1) {
                    console.warn(`${LOG_PREFIX} Invalid paginatePrev payload`);
                    return;
                }
                // Story 6.2: Update filters from payload
                if (payload.filters) {
                    context.filters = payload.filters;
                }
                // Story 6.4: Update sort from payload
                if (payload.sortColumn !== undefined) {
                    context.sortColumn = payload.sortColumn || null;
                }
                if (payload.sortDirection !== undefined) {
                    context.sortDirection = payload.sortDirection || null;
                }
                // Page conversion: webview sends 1-indexed page (1, 2, 3...)
                // When user is on page 2 and clicks Prev: currentPage=2, want API page=0, offset=0 (rows 1-50)
                // Formula: (1-indexed current) - 2 = 0-indexed previous page
                const newPage = Math.max(0, payload.currentPage - 2);
                context.currentPage = newPage;
                await this._loadTableData(panelKey, newPage, payload.pageSize, context.filters, context.sortColumn, context.sortDirection);
                break;
            }
            // Story 3.3: Handle cell save command
            case 'saveCell': {
                const payload = message.payload as ISaveCellPayload;
                await this._handleSaveCell(panelKey, payload);
                break;
            }
            // Story 4.3: Handle insert row command
            case 'insertRow': {
                const payload = message.payload as IInsertRowPayload;
                await this._handleInsertRow(panelKey, payload);
                break;
            }
            // Story 5.3: Handle delete row command
            case 'deleteRow': {
                const payload = message.payload as IDeleteRowPayload;
                await this._handleDeleteRow(panelKey, payload);
                break;
            }
            // Story 9.1: Handle export all CSV command
            case 'exportAllCsv': {
                const exportPayload = message.payload as { filters?: IFilterCriterion[]; sortColumn?: string; sortDirection?: SortDirection; filtered?: boolean };
                await this._handleExportAllCsv(panelKey, exportPayload);
                break;
            }
            // Story 9.2: Handle export Excel commands
            case 'exportCurrentPageExcel': {
                const excelPayload = message.payload as { rows: Record<string, unknown>[]; columns: Array<{ name: string; dataType: string }> };
                await this._handleExportCurrentPageExcel(panelKey, excelPayload);
                break;
            }
            case 'exportAllExcel': {
                const excelAllPayload = message.payload as { filters?: IFilterCriterion[]; sortColumn?: string; sortDirection?: SortDirection; filtered?: boolean };
                await this._handleExportAllExcel(panelKey, excelAllPayload);
                break;
            }
        }
    }

    /**
     * Handle saveCell command from grid webview
     * Story 3.3: Cell update with server persistence
     */
    private async _handleSaveCell(panelKey: string, payload: ISaveCellPayload): Promise<void> {
        const panel = this._panels.get(panelKey);
        const context = this._panelContexts.get(panelKey);

        if (!panel || !context) {
            return;
        }

        // Validate payload
        if (!payload || typeof payload.rowIndex !== 'number' || typeof payload.colIndex !== 'number' ||
            !payload.columnName || !payload.primaryKeyColumn) {
            console.warn(`${LOG_PREFIX} Invalid saveCell payload`);
            this._postMessage(panel, {
                event: 'saveCellResult',
                payload: {
                    success: false,
                    rowIndex: payload?.rowIndex ?? -1,
                    colIndex: payload?.colIndex ?? -1,
                    columnName: payload?.columnName ?? '',
                    oldValue: payload?.oldValue,
                    newValue: payload?.newValue,
                    primaryKeyValue: payload?.primaryKeyValue,
                    error: {
                        message: 'Invalid save request',
                        code: 'INVALID_INPUT'
                    }
                } as ISaveCellResultPayload
            });
            return;
        }

        console.debug(`${LOG_PREFIX} Saving cell: ${context.tableName}.${payload.columnName} = ${payload.newValue}`);

        try {
            const result = await this._serverConnectionManager.updateCell(
                context.namespace,
                context.tableName,
                payload.columnName,
                payload.newValue,
                payload.primaryKeyColumn,
                payload.primaryKeyValue
            );

            if (result.success) {
                console.debug(`${LOG_PREFIX} Cell saved successfully`);
                this._postMessage(panel, {
                    event: 'saveCellResult',
                    payload: {
                        success: true,
                        rowIndex: payload.rowIndex,
                        colIndex: payload.colIndex,
                        columnName: payload.columnName,
                        oldValue: payload.oldValue,
                        newValue: payload.newValue,
                        primaryKeyValue: payload.primaryKeyValue
                    } as ISaveCellResultPayload
                });
            } else {
                console.debug(`${LOG_PREFIX} Cell save failed: ${result.error?.message}`);
                this._postMessage(panel, {
                    event: 'saveCellResult',
                    payload: {
                        success: false,
                        rowIndex: payload.rowIndex,
                        colIndex: payload.colIndex,
                        columnName: payload.columnName,
                        oldValue: payload.oldValue,
                        newValue: payload.newValue,
                        primaryKeyValue: payload.primaryKeyValue,
                        error: {
                            message: result.error?.message || 'Failed to save cell',
                            code: result.error?.code || 'UNKNOWN_ERROR'
                        }
                    } as ISaveCellResultPayload
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Save cell error:`, error);
            this._postMessage(panel, {
                event: 'saveCellResult',
                payload: {
                    success: false,
                    rowIndex: payload.rowIndex,
                    colIndex: payload.colIndex,
                    columnName: payload.columnName,
                    oldValue: payload.oldValue,
                    newValue: payload.newValue,
                    primaryKeyValue: payload.primaryKeyValue,
                    error: {
                        message: 'An unexpected error occurred while saving',
                        code: 'UNKNOWN_ERROR'
                    }
                } as ISaveCellResultPayload
            });
        }
    }

    /**
     * Handle insertRow command from grid webview
     * Story 4.3: New row insertion
     */
    private async _handleInsertRow(panelKey: string, payload: IInsertRowPayload): Promise<void> {
        const panel = this._panels.get(panelKey);
        const context = this._panelContexts.get(panelKey);

        if (!panel || !context) {
            return;
        }

        // Validate payload
        if (!payload || typeof payload.newRowIndex !== 'number' ||
            !Array.isArray(payload.columns) || !Array.isArray(payload.values) ||
            payload.columns.length === 0 || payload.columns.length !== payload.values.length) {
            console.warn(`${LOG_PREFIX} Invalid insertRow payload`);
            this._postMessage(panel, {
                event: 'insertRowResult',
                payload: {
                    success: false,
                    newRowIndex: payload?.newRowIndex ?? -1,
                    error: {
                        message: 'Invalid insert request',
                        code: 'INVALID_INPUT'
                    }
                } as IInsertRowResultPayload
            });
            return;
        }

        console.debug(`${LOG_PREFIX} Inserting row into ${context.tableName}`);

        try {
            const result = await this._serverConnectionManager.insertRow(
                context.namespace,
                context.tableName,
                payload.columns,
                payload.values
            );

            if (result.success) {
                console.debug(`${LOG_PREFIX} Row inserted successfully`);
                this._postMessage(panel, {
                    event: 'insertRowResult',
                    payload: {
                        success: true,
                        newRowIndex: payload.newRowIndex
                    } as IInsertRowResultPayload
                });
            } else {
                console.debug(`${LOG_PREFIX} Row insert failed: ${result.error?.message}`);
                this._postMessage(panel, {
                    event: 'insertRowResult',
                    payload: {
                        success: false,
                        newRowIndex: payload.newRowIndex,
                        error: {
                            message: result.error?.message || 'Failed to insert row',
                            code: result.error?.code || 'UNKNOWN_ERROR'
                        }
                    } as IInsertRowResultPayload
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Insert row error:`, error);
            this._postMessage(panel, {
                event: 'insertRowResult',
                payload: {
                    success: false,
                    newRowIndex: payload.newRowIndex,
                    error: {
                        message: 'An unexpected error occurred while inserting',
                        code: 'UNKNOWN_ERROR'
                    }
                } as IInsertRowResultPayload
            });
        }
    }

    /**
     * Handle deleteRow command from grid webview
     * Story 5.3: Row deletion with server persistence
     */
    private async _handleDeleteRow(panelKey: string, payload: IDeleteRowPayload): Promise<void> {
        const panel = this._panels.get(panelKey);
        const context = this._panelContexts.get(panelKey);

        if (!panel || !context) {
            return;
        }

        // Validate payload (including rowIndex >= 0 check)
        if (!payload || typeof payload.rowIndex !== 'number' || payload.rowIndex < 0 ||
            !payload.primaryKeyColumn || payload.primaryKeyValue === undefined) {
            console.warn(`${LOG_PREFIX} Invalid deleteRow payload`);
            this._postMessage(panel, {
                event: 'deleteRowResult',
                payload: {
                    success: false,
                    rowIndex: payload?.rowIndex ?? -1,
                    error: {
                        message: 'Invalid delete request',
                        code: 'INVALID_INPUT'
                    }
                } as IDeleteRowResultPayload
            });
            return;
        }

        console.debug(`${LOG_PREFIX} Deleting row from ${context.tableName} WHERE ${payload.primaryKeyColumn}=${payload.primaryKeyValue}`);

        try {
            const result = await this._serverConnectionManager.deleteRow(
                context.namespace,
                context.tableName,
                payload.primaryKeyColumn,
                payload.primaryKeyValue
            );

            if (result.success) {
                console.debug(`${LOG_PREFIX} Row deleted successfully`);
                this._postMessage(panel, {
                    event: 'deleteRowResult',
                    payload: {
                        success: true,
                        rowIndex: payload.rowIndex
                    } as IDeleteRowResultPayload
                });
            } else {
                console.debug(`${LOG_PREFIX} Row delete failed: ${result.error?.message}`);
                this._postMessage(panel, {
                    event: 'deleteRowResult',
                    payload: {
                        success: false,
                        rowIndex: payload.rowIndex,
                        error: {
                            message: result.error?.message || 'Failed to delete row',
                            code: result.error?.code || 'UNKNOWN_ERROR'
                        }
                    } as IDeleteRowResultPayload
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Delete row error:`, error);
            this._postMessage(panel, {
                event: 'deleteRowResult',
                payload: {
                    success: false,
                    rowIndex: payload.rowIndex,
                    error: {
                        message: 'An unexpected error occurred while deleting',
                        code: 'UNKNOWN_ERROR'
                    }
                } as IDeleteRowResultPayload
            });
        }
    }

    /**
     * Handle exportAllCsv command from grid webview
     * Story 9.1: Export all data (or filtered results) to CSV file
     */
    private async _handleExportAllCsv(panelKey: string, payload: {
        filters?: IFilterCriterion[];
        sortColumn?: string;
        sortDirection?: SortDirection;
        filtered?: boolean;
    }): Promise<void> {
        const panel = this._panels.get(panelKey);
        const context = this._panelContexts.get(panelKey);

        if (!panel || !context) {
            return;
        }

        // Show save dialog
        const defaultFileName = `${context.tableName.replace(/[^a-zA-Z0-9._-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultFileName),
            filters: { 'CSV Files': ['csv'], 'All Files': ['*'] },
            title: payload.filtered ? 'Export Filtered Results to CSV' : 'Export All Data to CSV'
        });

        if (!uri) {
            return; // User cancelled
        }

        // Send progress to webview
        this._postMessage(panel, {
            event: 'exportProgress',
            payload: { progress: 0, message: 'Starting export...' }
        });

        try {
            // Get schema for column headers
            const schemaResult = await this._serverConnectionManager.getTableSchema(
                context.namespace,
                context.tableName
            );

            if (!schemaResult.success || !schemaResult.schema) {
                this._postMessage(panel, {
                    event: 'exportResult',
                    payload: { success: false, error: 'Failed to get table schema' }
                });
                return;
            }

            const columns = schemaResult.schema.columns;
            const columnNames = columns.map(c => c.name);
            const filters = payload.filters || [];
            const sortColumn = payload.sortColumn || null;
            const sortDirection = (payload.sortDirection || null) as SortDirection;

            // Build CSV with UTF-8 BOM for Excel compatibility
            const BOM = '\uFEFF';
            let csvContent = BOM;

            // Header row
            csvContent += columnNames.map(n => this._csvEscapeValue(n)).join(',') + '\r\n';

            // Fetch data in chunks
            const chunkSize = 1000;
            let offset = 0;
            let totalRows = 0;
            let fetchedRows = 0;
            let isFirstChunk = true;

            while (true) {
                const dataResult = await this._serverConnectionManager.getTableData(
                    context.namespace,
                    context.tableName,
                    chunkSize,
                    offset,
                    filters,
                    sortColumn,
                    sortDirection
                );

                if (!dataResult.success || !dataResult.rows) {
                    this._postMessage(panel, {
                        event: 'exportResult',
                        payload: { success: false, error: dataResult.error?.message || 'Failed to fetch data' }
                    });
                    return;
                }

                if (isFirstChunk) {
                    totalRows = dataResult.totalRows || 0;
                    isFirstChunk = false;
                }

                // Append rows to CSV
                for (const row of dataResult.rows) {
                    const values = columnNames.map(col => {
                        const val = row[col];
                        if (val === null || val === undefined) {
                            return '';
                        }
                        return this._csvEscapeValue(String(val));
                    });
                    csvContent += values.join(',') + '\r\n';
                }

                fetchedRows += dataResult.rows.length;
                offset += chunkSize;

                // Send progress
                const progress = totalRows > 0 ? Math.round((fetchedRows / totalRows) * 100) : 100;
                this._postMessage(panel, {
                    event: 'exportProgress',
                    payload: { progress, message: `Exporting... ${fetchedRows.toLocaleString()} of ${totalRows.toLocaleString()} rows` }
                });

                // Done when we got fewer rows than chunk size
                if (dataResult.rows.length < chunkSize) {
                    break;
                }
            }

            // Write file
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(uri, encoder.encode(csvContent));

            // Send success
            this._postMessage(panel, {
                event: 'exportResult',
                payload: { success: true, rowCount: fetchedRows, filePath: uri.fsPath }
            });

            vscode.window.showInformationMessage(
                `Exported ${fetchedRows.toLocaleString()} rows to ${uri.fsPath}`
            );

        } catch (error) {
            console.error(`${LOG_PREFIX} Export error:`, error);
            this._postMessage(panel, {
                event: 'exportResult',
                payload: { success: false, error: 'An unexpected error occurred during export' }
            });
        }
    }

    /**
     * Escape a value for CSV format per RFC 4180
     * Story 9.1: CSV value escaping
     */
    private _csvEscapeValue(value: string): string {
        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
    }

    /**
     * Handle exportCurrentPageExcel command from grid webview
     * Story 9.2: Export current page rows to Excel file
     */
    private async _handleExportCurrentPageExcel(panelKey: string, payload: {
        rows: Record<string, unknown>[];
        columns: Array<{ name: string; dataType: string }>;
    }): Promise<void> {
        const panel = this._panels.get(panelKey);
        const context = this._panelContexts.get(panelKey);

        if (!panel || !context) {
            return;
        }

        const defaultFileName = `${context.tableName.replace(/[^a-zA-Z0-9._-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultFileName),
            filters: { 'Excel Files': ['xlsx'], 'All Files': ['*'] },
            title: 'Export Current Page to Excel'
        });

        if (!uri) {
            return;
        }

        try {
            const buffer = await this._buildExcelBuffer(payload.columns, payload.rows, context.tableName);
            await vscode.workspace.fs.writeFile(uri, new Uint8Array(buffer));

            this._postMessage(panel, {
                event: 'exportResult',
                payload: { success: true, rowCount: payload.rows.length, filePath: uri.fsPath }
            });

            vscode.window.showInformationMessage(
                `Exported ${payload.rows.length} rows to ${uri.fsPath}`
            );
        } catch (error) {
            console.error(`${LOG_PREFIX} Excel export error:`, error);
            this._postMessage(panel, {
                event: 'exportResult',
                payload: { success: false, error: 'Failed to create Excel file' }
            });
        }
    }

    /**
     * Handle exportAllExcel command from grid webview
     * Story 9.2: Export all data (or filtered results) to Excel file
     */
    private async _handleExportAllExcel(panelKey: string, payload: {
        filters?: IFilterCriterion[];
        sortColumn?: string;
        sortDirection?: SortDirection;
        filtered?: boolean;
    }): Promise<void> {
        const panel = this._panels.get(panelKey);
        const context = this._panelContexts.get(panelKey);

        if (!panel || !context) {
            return;
        }

        const defaultFileName = `${context.tableName.replace(/[^a-zA-Z0-9._-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultFileName),
            filters: { 'Excel Files': ['xlsx'], 'All Files': ['*'] },
            title: payload.filtered ? 'Export Filtered Results to Excel' : 'Export All Data to Excel'
        });

        if (!uri) {
            return;
        }

        this._postMessage(panel, {
            event: 'exportProgress',
            payload: { progress: 0, message: 'Starting Excel export...' }
        });

        try {
            // Get schema
            const schemaResult = await this._serverConnectionManager.getTableSchema(
                context.namespace,
                context.tableName
            );

            if (!schemaResult.success || !schemaResult.schema) {
                this._postMessage(panel, {
                    event: 'exportResult',
                    payload: { success: false, error: 'Failed to get table schema' }
                });
                return;
            }

            const columns = schemaResult.schema.columns;
            const filters = payload.filters || [];
            const sortColumn = payload.sortColumn || null;
            const sortDirection = (payload.sortDirection || null) as SortDirection;

            // Fetch all data in chunks
            const allRows: Record<string, unknown>[] = [];
            const chunkSize = 1000;
            let offset = 0;
            let totalRows = 0;
            let isFirstChunk = true;

            while (true) {
                const dataResult = await this._serverConnectionManager.getTableData(
                    context.namespace,
                    context.tableName,
                    chunkSize,
                    offset,
                    filters,
                    sortColumn,
                    sortDirection
                );

                if (!dataResult.success || !dataResult.rows) {
                    this._postMessage(panel, {
                        event: 'exportResult',
                        payload: { success: false, error: dataResult.error?.message || 'Failed to fetch data' }
                    });
                    return;
                }

                if (isFirstChunk) {
                    totalRows = dataResult.totalRows || 0;
                    isFirstChunk = false;
                }

                allRows.push(...dataResult.rows);
                offset += chunkSize;

                const progress = totalRows > 0 ? Math.round((allRows.length / totalRows) * 100) : 100;
                this._postMessage(panel, {
                    event: 'exportProgress',
                    payload: { progress, message: `Fetching... ${allRows.length.toLocaleString()} of ${totalRows.toLocaleString()} rows` }
                });

                if (dataResult.rows.length < chunkSize) {
                    break;
                }
            }

            // Build Excel file
            this._postMessage(panel, {
                event: 'exportProgress',
                payload: { progress: 95, message: 'Building Excel file...' }
            });

            const buffer = await this._buildExcelBuffer(columns, allRows, context.tableName);
            await vscode.workspace.fs.writeFile(uri, new Uint8Array(buffer));

            this._postMessage(panel, {
                event: 'exportResult',
                payload: { success: true, rowCount: allRows.length, filePath: uri.fsPath }
            });

            vscode.window.showInformationMessage(
                `Exported ${allRows.length.toLocaleString()} rows to ${uri.fsPath}`
            );

        } catch (error) {
            console.error(`${LOG_PREFIX} Excel export error:`, error);
            this._postMessage(panel, {
                event: 'exportResult',
                payload: { success: false, error: 'An unexpected error occurred during Excel export' }
            });
        }
    }

    /**
     * Build an Excel buffer from columns and rows
     * Story 9.2: Excel file generation with ExcelJS
     */
    private async _buildExcelBuffer(
        columns: Array<{ name: string; dataType: string }>,
        rows: Record<string, unknown>[],
        sheetName: string
    ): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'IRIS Table Editor';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet(sheetName.substring(0, 31)); // Excel max sheet name is 31 chars

        // Define columns with appropriate widths
        worksheet.columns = columns.map(col => ({
            header: col.name,
            key: col.name,
            width: Math.min(30, Math.max(10, col.name.length + 4))
        }));

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data rows with type-appropriate values
        for (const row of rows) {
            const rowData: Record<string, unknown> = {};
            for (const col of columns) {
                const val = row[col.name];
                if (val === null || val === undefined) {
                    rowData[col.name] = null;
                } else {
                    rowData[col.name] = this._convertExcelValue(val, col.dataType);
                }
            }
            worksheet.addRow(rowData);
        }

        // Auto-filter on header row
        if (columns.length > 0) {
            worksheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: 1, column: columns.length }
            };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /**
     * Convert a value to the appropriate Excel type based on IRIS data type
     * Story 9.2: Type-aware Excel export
     */
    private _convertExcelValue(value: unknown, dataType: string): unknown {
        if (value === null || value === undefined) {
            return null;
        }

        const dt = dataType.toUpperCase();
        const strVal = String(value);

        // Boolean types
        if (dt === 'BIT' || dt === 'BOOLEAN' || dt === '%LIBRARY.BOOLEAN') {
            return strVal === '1' || strVal.toLowerCase() === 'true';
        }

        // Numeric types
        if (dt.includes('INT') || dt === 'BIGINT' || dt === 'SMALLINT' || dt === 'TINYINT') {
            const num = parseInt(strVal, 10);
            return isNaN(num) ? strVal : num;
        }

        if (dt.includes('DECIMAL') || dt.includes('NUMERIC') || dt === 'FLOAT' || dt === 'DOUBLE' || dt === 'REAL' || dt === 'MONEY') {
            const num = parseFloat(strVal);
            return isNaN(num) ? strVal : num;
        }

        // Date types
        if (dt === 'DATE' || dt === '%LIBRARY.DATE') {
            const d = new Date(strVal);
            return isNaN(d.getTime()) ? strVal : d;
        }

        // Timestamp types
        if (dt === 'TIMESTAMP' || dt === 'DATETIME' || dt === '%LIBRARY.TIMESTAMP' || dt === '%LIBRARY.POSIXTIME') {
            const d = new Date(strVal);
            return isNaN(d.getTime()) ? strVal : d;
        }

        // Everything else as string
        return strVal;
    }

    /**
     * Load table schema and data for a panel
     * Story 2.2: Default pageSize changed to 50
     * Story 6.2: Added filters parameter
     * Story 6.4: Added sort parameters
     */
    private async _loadTableData(
        panelKey: string,
        page = 0,
        pageSize = DEFAULT_PAGE_SIZE,
        filters: IFilterCriterion[] = [],
        sortColumn: string | null = null,
        sortDirection: SortDirection = null
    ): Promise<void> {
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
            // Story 6.2: Pass filters to getTableData
            // Story 6.4: Pass sort parameters to getTableData
            const offset = page * pageSize;
            const dataResult = await this._serverConnectionManager.getTableData(
                context.namespace,
                context.tableName,
                pageSize,
                offset,
                filters,
                sortColumn,
                sortDirection
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
        <!-- Story 2.5: Context bar with tooltip for full path (UX5, UX17) -->
        <div class="ite-context-bar" title="${escapeHtml(serverName)} > ${escapeHtml(namespace)} > ${escapeHtml(tableName)}">
            <span class="ite-context-bar__server" title="${escapeHtml(serverName)}">${escapeHtml(serverName)}</span>
            <span class="ite-context-bar__separator">&gt;</span>
            <span class="ite-context-bar__namespace" title="${escapeHtml(namespace)}">${escapeHtml(namespace)}</span>
            <span class="ite-context-bar__separator">&gt;</span>
            <span class="ite-context-bar__table" title="${escapeHtml(tableName)}">${escapeHtml(tableName)}</span>
        </div>

        <div class="ite-toolbar">
            <button class="ite-toolbar__button" id="refreshBtn" title="Refresh data">
                <i class="codicon codicon-refresh"></i>
            </button>
            <button class="ite-toolbar__button" id="addRowBtn" title="Add new row (Ctrl+N)">
                <i class="codicon codicon-add"></i>
            </button>
            <button class="ite-toolbar__button" id="saveRowBtn" title="Save new row (Ctrl+S)" disabled>
                <i class="codicon codicon-save"></i>
            </button>
            <button class="ite-toolbar__button" id="deleteRowBtn" title="Delete row (Del)" disabled>
                <i class="codicon codicon-trash"></i>
            </button>
            <span class="ite-toolbar__separator"></span>
            <button class="ite-toolbar__button" id="clearFiltersBtn" title="Clear all filters" disabled>
                <i class="codicon codicon-clear-all"></i>
            </button>
            <button class="ite-toolbar__button" id="toggleFiltersBtn" title="Disable filters">
                <i class="codicon codicon-filter"></i>
            </button>
            <button class="ite-toolbar__button" id="filterPanelBtn" title="Filter panel">
                <i class="codicon codicon-list-filter"></i>
                <span class="ite-toolbar__badge" id="filterBadge" style="display: none;">0</span>
            </button>
            <span class="ite-toolbar__separator"></span>
            <div class="ite-toolbar__export-group" style="position: relative;">
                <button class="ite-toolbar__button" id="exportBtn" title="Export data (Ctrl+E)">
                    <i class="codicon codicon-desktop-download"></i>
                </button>
                <div class="ite-export-menu" id="exportMenu" style="display: none;">
                    <button class="ite-export-menu__item" id="exportCurrentPageCsv">
                        <i class="codicon codicon-file"></i> Export Current Page (CSV)
                    </button>
                    <button class="ite-export-menu__item" id="exportAllCsv">
                        <i class="codicon codicon-files"></i> Export All Data (CSV)
                    </button>
                    <button class="ite-export-menu__item" id="exportFilteredCsv" style="display: none;">
                        <i class="codicon codicon-filter"></i> Export Filtered Results (CSV)
                    </button>
                    <div class="ite-export-menu__divider"></div>
                    <button class="ite-export-menu__item" id="exportCurrentPageExcel">
                        <i class="codicon codicon-file"></i> Export Current Page (Excel)
                    </button>
                    <button class="ite-export-menu__item" id="exportAllExcel">
                        <i class="codicon codicon-files"></i> Export All Data (Excel)
                    </button>
                    <button class="ite-export-menu__item" id="exportFilteredExcel" style="display: none;">
                        <i class="codicon codicon-filter"></i> Export Filtered Results (Excel)
                    </button>
                </div>
            </div>
            <span class="ite-toolbar__separator"></span>
            <div class="ite-toolbar__slider-group">
                <i class="codicon codicon-text-size" title="Column width"></i>
                <input type="range"
                       id="columnWidthSlider"
                       class="ite-toolbar__slider"
                       min="80"
                       max="400"
                       value="150"
                       title="Adjust column width" />
            </div>
            <!-- Story 6.3: Filter Panel (hidden by default) - inside toolbar for positioning -->
            <div class="ite-filter-panel" id="filterPanel" style="display: none;">
                <div class="ite-filter-panel__header">
                    <h4 class="ite-filter-panel__title">Active Filters</h4>
                    <button class="ite-filter-panel__close" id="filterPanelClose" title="Close panel">
                        <i class="codicon codicon-close"></i>
                    </button>
                </div>
                <div class="ite-filter-panel__content" id="filterPanelContent">
                    <!-- Filter chips will be rendered here by JavaScript -->
                    <p class="ite-filter-panel__empty">No active filters</p>
                </div>
            </div>
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
        <!-- Story 6.5: Enhanced with First/Last buttons and page input -->
        <div class="ite-pagination" id="paginationContainer" role="navigation" aria-label="Table pagination" style="display: none;">
            <span class="ite-pagination__info" id="paginationInfo" aria-live="polite">
                Rows 1-50 of 0
            </span>
            <div class="ite-pagination__controls">
                <button class="ite-pagination__button ite-pagination__button--icon"
                        id="firstPageBtn"
                        aria-label="First page"
                        title="First page"
                        disabled>
                    ⏮
                </button>
                <button class="ite-pagination__button ite-pagination__button--icon"
                        id="prevPageBtn"
                        aria-label="Previous page"
                        title="Previous page"
                        disabled>
                    ◀
                </button>
                <div class="ite-pagination__page-input-container">
                    <input type="text"
                           class="ite-pagination__page-input"
                           id="pageInput"
                           aria-label="Page number"
                           value="1" />
                    <span class="ite-pagination__page-total" id="pageTotalLabel">of 1</span>
                </div>
                <button class="ite-pagination__button ite-pagination__button--icon"
                        id="nextPageBtn"
                        aria-label="Next page"
                        title="Next page">
                    ▶
                </button>
                <button class="ite-pagination__button ite-pagination__button--icon"
                        id="lastPageBtn"
                        aria-label="Last page"
                        title="Last page">
                    ⏭
                </button>
            </div>
        </div>

        <div class="ite-status-bar" id="statusBar">
            <span class="ite-status-bar__text" id="statusText">Loading...</span>
        </div>

        <!-- Story 3.5: Toast notification container -->
        <div id="toastContainer" class="ite-toast-container" aria-live="assertive" aria-atomic="true"></div>

        <!-- Story 5.2: Delete confirmation dialog -->
        <div class="ite-dialog-overlay" id="deleteDialogOverlay" style="display: none;" role="presentation">
            <div class="ite-dialog" role="dialog" aria-modal="true" aria-labelledby="deleteDialogTitle" aria-describedby="deleteDialogDesc">
                <div class="ite-dialog__content">
                    <h2 id="deleteDialogTitle" class="ite-dialog__title">Delete Row</h2>
                    <p id="deleteDialogDesc" class="ite-dialog__message">Delete this row? This action cannot be undone.</p>
                </div>
                <div class="ite-dialog__actions">
                    <button type="button" class="ite-dialog__button ite-dialog__button--secondary" id="deleteDialogCancel">Cancel</button>
                    <button type="button" class="ite-dialog__button ite-dialog__button--danger" id="deleteDialogConfirm">Delete</button>
                </div>
            </div>
        </div>
    </div>
    <div id="ite-live-region" class="visually-hidden" aria-live="polite" aria-atomic="true"></div>
    <script nonce="${nonce}">
        // Pass initial context to webview - JSON-escaped for security
        window.iteContext = ${JSON.stringify({
            serverName: serverName,
            namespace: namespace,
            tableName: tableName
        })};
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
