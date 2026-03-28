import { GAME_CONFIG } from "../config.js";
import { getAllRooms, deleteRoom } from "./room-service.js";
import { cleanupRoomTimers } from "./race-engine.js";
import { antiCheat } from "./anti-cheat.js";

/**
 * Room cleanup service.
 * Periodically removes stale/finished rooms to prevent memory leaks.
 */
class RoomCleanup {
  private interval: NodeJS.Timeout | null = null;

  start(): void {
    this.interval = setInterval(() => {
      this.sweep();
    }, GAME_CONFIG.CLEANUP_INTERVAL_MS);

    console.log(
      `[RoomCleanup] Started, sweeping every ${GAME_CONFIG.CLEANUP_INTERVAL_MS / 1000}s`
    );
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private sweep(): void {
    const now = Date.now();
    const rooms = getAllRooms();
    let cleaned = 0;

    for (const [roomId, room] of rooms) {
      let shouldDelete = false;

      // Empty waiting room > TTL
      if (room.status === "waiting" && room.players.length === 0) {
        shouldDelete = true;
      }

      // Idle waiting room (with players but no activity) > TTL
      if (room.status === "waiting" && now - room.createdAt > GAME_CONFIG.ROOM_IDLE_TTL_MS) {
        const anyConnected = room.players.some((p) => p.isConnected);
        if (!anyConnected) {
          shouldDelete = true;
        }
      }

      // Finished room > TTL
      if (
        room.status === "finished" &&
        room.finishedAt &&
        now - room.finishedAt > GAME_CONFIG.ROOM_FINISHED_TTL_MS
      ) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        cleanupRoomTimers(roomId);
        antiCheat.clearRoom(room.players.map((p) => p.playerId));
        deleteRoom(roomId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RoomCleanup] Swept ${cleaned} room(s), ${rooms.size} remaining`);
    }
  }
}

export const roomCleanup = new RoomCleanup();
