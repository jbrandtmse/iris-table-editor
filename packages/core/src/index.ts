// Models
export type { IMessageBridge } from './models/IMessageBridge';
export type { IServerSpec } from './models/IServerSpec';
export type { IColumnInfo, ITableSchema } from './models/ITableSchema';
export type { ITableRow, ITableDataResult } from './models/ITableData';
export type {
    ICommand,
    IEvent,
    IServerListPayload,
    IErrorPayload,
    IUserError,
    ErrorCode,
    IEmptyPayload,
    ISelectServerPayload,
    IDisconnectPayload,
    IConnectionStatusPayload,
    IConnectionErrorPayload,
    IGetNamespacesPayload,
    ISelectNamespacePayload,
    INamespaceListPayload,
    INamespaceSelectedPayload,
    IGetTablesPayload,
    ISelectTablePayload,
    ITableListPayload,
    ITableSelectedPayload,
    IOpenTablePayload,
    ICancelConnectionPayload,
    IConnectionProgressPayload,
    ITableSchemaPayload,
    ITableDataPayload,
    ITableLoadingPayload,
    IFilterCriterion,
    SortDirection,
    IRequestDataPayload,
    IPaginatePayload,
    IRefreshPayload,
    ISaveCellPayload,
    ISaveCellResultPayload,
    IInsertRowPayload,
    IInsertRowResultPayload,
    IDeleteRowPayload,
    IDeleteRowResultPayload,
    ServerCommand,
    GridCommand,
    ServerEvent,
    GridEvent,
    // Story 12.1: Desktop Connection Manager message types
    IDesktopServerInfo,
    IDesktopServersLoadedPayload,
    IDesktopServerDeletedPayload,
    IDesktopServerNamePayload,
    DesktopConnectionCommand,
    DesktopConnectionEvent,
    // Story 12.2: Server Form message types
    IDesktopSaveServerPayload,
    IDesktopUpdateServerPayload,
    IDesktopServerSavedPayload,
    IDesktopServerSaveErrorPayload,
    IDesktopServerConfigPayload,
    // Story 12.3: Test Connection message types
    IDesktopTestConnectionPayload,
    IDesktopTestConnectionResultPayload,
    // Story 12.4: Credential Storage message types
    IDesktopCredentialWarningPayload,
    // Story 12.5: Connection Lifecycle message types
    IDesktopConnectionProgressPayload,
} from './models/IMessages';

// Services
export { AtelierApiService } from './services/AtelierApiService';
export { QueryExecutor } from './services/QueryExecutor';
export { TableMetadataService } from './services/TableMetadataService';

// Utils
export { ErrorHandler, ErrorCodes } from './utils/ErrorHandler';
export { UrlBuilder } from './utils/UrlBuilder';
export {
    validateAndEscapeIdentifier,
    validateNumeric,
    parseQualifiedTableName,
    escapeTableName,
    buildFilterWhereClause,
    buildOrderByClause
} from './utils/SqlBuilder';
export {
    formatDateTimeValue,
    formatNumericValue,
    parseUserTimeInput,
    formatTimeForIRIS,
    parseUserDateInput,
    formatDateForIRIS,
    parseUserTimestampInput,
    formatTimestampForIRIS,
    parseNumericInput
} from './utils/DataTypeFormatter';
export type {
    ITimeParts,
    ITimestampParts,
    INumericParseResult
} from './utils/DataTypeFormatter';
