/**
 * Server specification interface matching the Server Manager API
 */
export interface IServerSpec {
    name: string;
    host: string;
    port: number;
    pathPrefix: string;
    username?: string;
}
