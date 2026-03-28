import { GAME_CONFIG } from "../config.js";
import { getAllRooms } from "../domain/room-service.js";
import { buildRacePlayerView } from "../types.js";
import type { ITransport } from "../transport/interfaces.js";

/**
 * Global broadcast scheduler.
 * Runs a single 100ms interval, iterates racing rooms with dirty progress,
 * broadcasts progress updates, and clears the dirty flag.
 */
export class BroadcastScheduler {
  private interval: NodeJS.Timeout | null = null;
  private transport: ITransport;

  constructor(transport: ITransport) {
    this.transport = transport;
  }

  start(): void {
    this.interval = setInterval(() => {
      this.tick();
    }, GAME_CONFIG.BROADCAST_INTERVAL_MS);

    console.log(
      `[BroadcastScheduler] Started, ticking every ${GAME_CONFIG.BROADCAST_INTERVAL_MS}ms`
    );
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    const rooms = getAllRooms();

    for (const [, room] of rooms) {
      if (room.status !== "racing" || !room.dirtyProgress) continue;

      // Build progress view
      const players = room.players.map(buildRacePlayerView);

      // Get connection IDs for all connected players
      const connectionIds = room.players
        .filter((p) => p.isConnected && p.connectionId)
        .map((p) => p.connectionId!);

      if (connectionIds.length > 0) {
        this.transport.broadcast(connectionIds, {
          type: "race.progress",
          payload: { players },
        });
      }

      // Clear dirty flag
      room.dirtyProgress = false;
    }
  }
}
