/**
 * Abstraction for webview-to-host communication.
 * The webview never knows which target (VS Code, Electron) it's running in.
 */
export interface IMessageBridge {
    /** Send a command from webview to host */
    sendCommand(command: string, payload: unknown): void;

    /** Register a handler for events from host */
    onEvent(event: string, handler: (payload: unknown) => void): void;

    /** Remove an event handler */
    offEvent(event: string, handler: (payload: unknown) => void): void;

    /** Get persisted webview state */
    getState(): Record<string, unknown> | undefined;

    /** Persist webview state */
    setState(state: Record<string, unknown>): void;
}
