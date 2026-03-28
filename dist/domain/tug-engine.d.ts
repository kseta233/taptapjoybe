import type { DomainResult } from "../types.js";
export declare function setOnTickBroadcast(cb: (roomId: string, result: DomainResult) => void): void;
/**
 * Initialize tug of war: assign teams, create state, start tick loop.
 */
export declare function initTugWar(roomId: string): DomainResult;
/**
 * Handle a tug tap from a player.
 */
export declare function handleTugTap(roomId: string, playerId: string): DomainResult;
/**
 * Clean up timers for a room (called on room deletion).
 */
export declare function cleanupTugTimers(roomId: string): void;
//# sourceMappingURL=tug-engine.d.ts.map