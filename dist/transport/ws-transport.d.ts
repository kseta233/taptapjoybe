import type { Server as HttpServer } from "http";
import type { ServerEvent } from "../types.js";
import type { ITransport, IGatewayHandler } from "./interfaces.js";
/**
 * Raw WebSocket transport adapter.
 * Handles: JSON parse, Zod validation, heartbeat, stale cleanup, dead socket protection.
 * Zero game logic here.
 */
export declare class WsTransport implements ITransport {
    private wss;
    private connections;
    private heartbeatInterval;
    private gateway;
    constructor(server: HttpServer);
    /** Attach the gateway handler and start listening */
    start(gateway: IGatewayHandler): void;
    send(connectionId: string, event: ServerEvent): void;
    broadcast(connectionIds: string[], event: ServerEvent): void;
    isConnected(connectionId: string): boolean;
    close(connectionId: string): void;
    /** Graceful shutdown */
    shutdown(): void;
    private startHeartbeat;
}
//# sourceMappingURL=ws-transport.d.ts.map