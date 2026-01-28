/**
 * Command/Event message types for webview-extension communication
 * Per architecture.md Command/Event Message Format
 */

/**
 * Command message sent from webview to extension
 */
export interface ICommand<T = unknown> {
    command: string;
    payload: T;
}

/**
 * Event message sent from extension to webview
 */
export interface IEvent<T = unknown> {
    event: string;
    payload: T;
}

/**
 * Payload for server list event
 */
export interface IServerListPayload {
    servers: string[];
}

/**
 * Payload for error events
 */
export interface IErrorPayload {
    message: string;
    code: string;
    recoverable: boolean;
    context: string;
}

/**
 * User-facing error interface - re-exported from ErrorHandler for convenience
 * IMPORTANT: ErrorHandler.ts is the source of truth for IUserError
 */
export { IUserError, ErrorCode } from '../utils/ErrorHandler';

/**
 * Empty payload type for events with no data
 */
export type IEmptyPayload = Record<string, never>;

/**
 * Payload for selectServer command
 */
export interface ISelectServerPayload {
    serverName: string;
}

/**
 * Payload for disconnect command
 */
export type IDisconnectPayload = IEmptyPayload;

/**
 * Payload for connectionStatus event
 */
export interface IConnectionStatusPayload {
    connected: boolean;
    serverName: string | null;
    namespace?: string;  // May be populated later in Story 1.5
}

/**
 * Payload for connectionError event
 */
export interface IConnectionErrorPayload extends IErrorPayload {
    serverName: string;  // Which server failed
}

/**
 * Server-related commands sent from webview to extension
 */
export type ServerCommand =
    | { command: 'getServerList'; payload: IEmptyPayload }
    | { command: 'selectServer'; payload: ISelectServerPayload }
    | { command: 'disconnect'; payload: IDisconnectPayload }
    | { command: 'openServerManager'; payload: IEmptyPayload };

/**
 * Server-related events sent from extension to webview
 */
export type ServerEvent =
    | { event: 'serverList'; payload: IServerListPayload }
    | { event: 'serverManagerNotInstalled'; payload: IEmptyPayload }
    | { event: 'noServersConfigured'; payload: IEmptyPayload }
    | { event: 'connectionStatus'; payload: IConnectionStatusPayload }
    | { event: 'connectionError'; payload: IConnectionErrorPayload }
    | { event: 'error'; payload: IErrorPayload };
