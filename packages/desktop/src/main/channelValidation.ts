/**
 * Channel validation for IPC bridge
 * Story 11.2: IPC Bridge
 *
 * Defines allowed command and event names for the preload bridge.
 * Extracted as a separate module for testability without Electron runtime.
 *
 * Defense-in-depth: Even though contextIsolation prevents renderer access
 * to ipcRenderer, validating command/event names against an allowlist
 * prevents accidental typos from silently failing and limits the attack
 * surface if the renderer is somehow compromised.
 */

/**
 * Allowed command names that can be sent from the renderer to the main process.
 * Includes all connection commands (Story 11.1) and data commands (Story 11.2).
 */
export const ALLOWED_COMMANDS = new Set([
    // Connection commands (Story 11.1)
    'getServers',
    'connectServer',
    'disconnectServer',
    'cancelConnection',
    'editServer',
    'deleteServer',
    'saveServer',
    'updateServer',
    'testFormConnection',
    'selectServer',
    // Data commands (Story 11.2)
    'getNamespaces',
    'getTables',
    'selectTable',
    'requestData',
    'refresh',
    'paginateNext',
    'paginatePrev',
    'saveCell',
    'insertRow',
    'deleteRow',
    // Tab commands (Story 11.3)
    'activateTab',
    // Menu commands (Story 11.4)
    'tabStateChanged',
]);

/**
 * Allowed event names that the renderer can subscribe to.
 * Includes all connection events (Story 11.1) and data events (Story 11.2).
 */
export const ALLOWED_EVENTS = new Set([
    // Connection events (Story 11.1)
    'serversLoaded',
    'serverSelected',
    'connectionStatus',
    'connectionProgress',
    'serverDeleted',
    'serverSaved',
    'serverSaveError',
    'serverConfigLoaded',
    'testConnectionResult',
    'credentialWarning',
    'error',
    // Data events (Story 11.2)
    'namespaceList',
    'tableList',
    'tableSchema',
    'tableData',
    'tableLoading',
    'saveCellResult',
    'insertRowResult',
    'deleteRowResult',
    // Tab events (Story 11.3)
    'restoreGridState',
    // Menu events (Story 11.4)
    'menuAction',
    'menuSetNull',
    'menuToggleFilterPanel',
    'menuShowShortcuts',
]);

/**
 * Validate a command name against the allowlist.
 *
 * @param command - Command name to validate
 * @returns true if the command is allowed
 */
export function isValidCommand(command: string): boolean {
    return ALLOWED_COMMANDS.has(command);
}

/**
 * Validate an event name against the allowlist.
 *
 * @param eventName - Event name to validate
 * @returns true if the event is allowed
 */
export function isValidEvent(eventName: string): boolean {
    return ALLOWED_EVENTS.has(eventName);
}
