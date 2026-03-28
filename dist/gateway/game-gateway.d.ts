import type { ClientEvent, DomainResult } from "../types.js";
import type { ITransport, IGatewayHandler } from "../transport/interfaces.js";
/**
 * Game Gateway — routes client events to domain services and dispatches results.
 * Owns the connection registry (connectionId ↔ playerId mapping).
 * Knows about events and players, but NOT about WebSocket.
 */
export declare class GameGateway implements IGatewayHandler {
    private transport;
    private connectionToPlayer;
    private playerToConnection;
    private lobbySubscribers;
    constructor(transport: ITransport);
    onConnect(connectionId: string): void;
    onMessage(connectionId: string, event: ClientEvent): void;
    onDisconnect(connectionId: string): void;
    private handleCreate;
    private handleJoin;
    private handleReady;
    private handleStart;
    private handleRaceTap;
    private handleTugTap;
    private handleLeave;
    private handleRoomList;
    private bindConnection;
    private removeFromLobbySubscribers;
    /** Broadcast updated room lists to all lobby subscribers */
    private broadcastRoomLists;
    /** Dispatch a DomainResult to the appropriate connections via transport */
    dispatchResult(result: DomainResult): void;
}
//# sourceMappingURL=game-gateway.d.ts.map