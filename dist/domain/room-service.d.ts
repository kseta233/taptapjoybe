import type { Room, PlayerState, DomainResult } from "../types.js";
export declare function getRoom(roomId: string): Room | undefined;
export declare function getAllRooms(): Map<string, Room>;
export declare function getPlayerRoom(playerId: string): string | undefined;
export declare function findPlayerInRoom(room: Room, playerId: string): PlayerState | undefined;
export declare function createRoom(sessionPlayerId: string, name: string, maxPlayers?: number): DomainResult;
export declare function joinRoom(sessionPlayerId: string, roomId: string, name: string): DomainResult;
export declare function setReady(roomId: string, playerId: string, isReady: boolean): DomainResult;
export declare function canStart(roomId: string, playerId: string): DomainResult | null;
export declare function leaveRoom(roomId: string, playerId: string): DomainResult;
/**
 * Handle player disconnect (socket closed).
 * Returns the roomId the player was in, or undefined.
 */
export declare function handleDisconnect(playerId: string): {
    roomId?: string;
    result: DomainResult;
};
/**
 * Set the connection ID for a player (called by gateway on connect/rebind).
 */
export declare function setPlayerConnection(roomId: string, playerId: string, connectionId: string): void;
/**
 * Delete a room (used by cleanup).
 */
export declare function deleteRoom(roomId: string): void;
//# sourceMappingURL=room-service.d.ts.map