// Main process exports
export { ConnectionManager } from './main/ConnectionManager';
export type { ServerConfig, ConnectionManagerOptions } from './main/ConnectionManager';
export type { ICredentialStore } from './main/ICredentialStore';
export { NodeCryptoCredentialStore } from './main/NodeCryptoCredentialStore';
export { ConnectionLifecycleManager } from './main/ConnectionLifecycleManager';
export type { ConnectionState, ConnectionLifecycleCallback } from './main/ConnectionLifecycleManager';
export { SessionManager } from './main/SessionManager';
