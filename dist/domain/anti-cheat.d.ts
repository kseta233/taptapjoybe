/**
 * Anti-cheat rate limiter using sliding window.
 * Owns its own registry — tapTimestamps never pollute PlayerState.
 */
declare class AntiCheat {
    /** Map<playerId, timestamp[]> */
    private tapRegistry;
    /**
     * Check if a tap is allowed for this player.
     * Returns true if under rate limit, false if should be silently ignored.
     */
    checkTap(playerId: string, now: number): boolean;
    /** Clear rate limit data for a player (on leave/disconnect) */
    clearPlayer(playerId: string): void;
    /** Clear all rate limit data (on room destroy) */
    clearRoom(playerIds: string[]): void;
}
export declare const antiCheat: AntiCheat;
export {};
//# sourceMappingURL=anti-cheat.d.ts.map