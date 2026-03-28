"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.antiCheat = void 0;
const config_js_1 = require("../config.js");
/**
 * Anti-cheat rate limiter using sliding window.
 * Owns its own registry — tapTimestamps never pollute PlayerState.
 */
class AntiCheat {
    /** Map<playerId, timestamp[]> */
    tapRegistry = new Map();
    /**
     * Check if a tap is allowed for this player.
     * Returns true if under rate limit, false if should be silently ignored.
     */
    checkTap(playerId, now) {
        let timestamps = this.tapRegistry.get(playerId);
        if (!timestamps) {
            timestamps = [];
            this.tapRegistry.set(playerId, timestamps);
        }
        // Sliding window: remove timestamps older than 1 second
        const windowStart = now - 1000;
        const filtered = timestamps.filter((ts) => ts > windowStart);
        if (filtered.length >= config_js_1.GAME_CONFIG.MAX_TAPS_PER_SECOND) {
            // Over rate limit — silently ignore
            this.tapRegistry.set(playerId, filtered);
            return false;
        }
        // Accept tap
        filtered.push(now);
        this.tapRegistry.set(playerId, filtered);
        return true;
    }
    /** Clear rate limit data for a player (on leave/disconnect) */
    clearPlayer(playerId) {
        this.tapRegistry.delete(playerId);
    }
    /** Clear all rate limit data (on room destroy) */
    clearRoom(playerIds) {
        for (const id of playerIds) {
            this.tapRegistry.delete(id);
        }
    }
}
exports.antiCheat = new AntiCheat();
//# sourceMappingURL=anti-cheat.js.map