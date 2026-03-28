import { GAME_CONFIG } from "../config.js";

/**
 * Anti-cheat rate limiter using sliding window.
 * Owns its own registry — tapTimestamps never pollute PlayerState.
 */
class AntiCheat {
  /** Map<playerId, timestamp[]> */
  private tapRegistry = new Map<string, number[]>();

  /**
   * Check if a tap is allowed for this player.
   * Returns true if under rate limit, false if should be silently ignored.
   */
  checkTap(playerId: string, now: number): boolean {
    let timestamps = this.tapRegistry.get(playerId);
    if (!timestamps) {
      timestamps = [];
      this.tapRegistry.set(playerId, timestamps);
    }

    // Sliding window: remove timestamps older than 1 second
    const windowStart = now - 1000;
    const filtered = timestamps.filter((ts) => ts > windowStart);

    if (filtered.length >= GAME_CONFIG.MAX_TAPS_PER_SECOND) {
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
  clearPlayer(playerId: string): void {
    this.tapRegistry.delete(playerId);
  }

  /** Clear all rate limit data (on room destroy) */
  clearRoom(playerIds: string[]): void {
    for (const id of playerIds) {
      this.tapRegistry.delete(id);
    }
  }
}

export const antiCheat = new AntiCheat();
