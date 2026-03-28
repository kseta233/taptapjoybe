import type { ClientEvent, ServerEvent } from "../types.js";
/**
 * Transport layer interface — the only place that knows about the wire protocol.
 * Swap this implementation to migrate from ws → Socket.IO → Colyseus → etc.
 */
export interface ITransport {
    /** Send an event to a specific connection */
    send(connectionId: string, event: ServerEvent): void;
    /** Broadcast an event to multiple connections */
    broadcast(connectionIds: string[], event: ServerEvent): void;
    /** Check if a connection is still alive */
    isConnected(connectionId: string): boolean;
    /** Forcefully close a connection */
    close(connectionId: string): void;
}
/**
 * Gateway handler interface — transport calls these, gateway implements them.
 * Transport knows nothing about game logic.
 */
export interface IGatewayHandler {
    onConnect(connectionId: string): void;
    onMessage(connectionId: string, event: ClientEvent): void;
    onDisconnect(connectionId: string): void;
}
//# sourceMappingURL=interfaces.d.ts.map