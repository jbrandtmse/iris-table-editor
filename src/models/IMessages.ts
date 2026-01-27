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
 * Empty payload type for events with no data
 */
export type IEmptyPayload = Record<string, never>;

/**
 * Server-related commands sent from webview to extension
 */
export type ServerCommand =
    | { command: 'getServerList'; payload: IEmptyPayload }
    | { command: 'selectServer'; payload: { serverName: string } }
    | { command: 'openServerManager'; payload: IEmptyPayload };

/**
 * Server-related events sent from extension to webview
 */
export type ServerEvent =
    | { event: 'serverList'; payload: IServerListPayload }
    | { event: 'serverManagerNotInstalled'; payload: IEmptyPayload }
    | { event: 'noServersConfigured'; payload: IEmptyPayload }
    | { event: 'error'; payload: IErrorPayload };
