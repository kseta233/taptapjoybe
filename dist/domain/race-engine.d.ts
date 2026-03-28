import type { DomainResult } from "../types.js";
/**
 * Start the countdown sequence for a room.
 * Works for both tap-race and tug-war.
 */
export declare function startCountdown(roomId: string, onTick: (roomId: string, value: number) => void, onComplete: (roomId: string) => void): DomainResult;
/**
 * Cancel an active countdown (e.g., host disconnect during countdown).
 */
export declare function cancelCountdown(roomId: string): void;
/**
 * Transition room to playing state (tap-race).
 */
export declare function startRacing(roomId: string): DomainResult;
/**
 * Handle a tap from a player.
 * Returns empty result on rate-limit (silent ignore) or error on invalid state.
 */
export declare function handleTap(roomId: string, playerId: string): DomainResult;
export declare function setOnGraceExpired(cb: (roomId: string, result: DomainResult) => void): void;
/**
 * Clean up timers for a room (called on room deletion).
 */
export declare function cleanupRoomTimers(roomId: string): void;
//# sourceMappingURL=race-engine.d.ts.map