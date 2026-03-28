"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadcastScheduler = void 0;
const config_js_1 = require("../config.js");
const room_service_js_1 = require("../domain/room-service.js");
const types_js_1 = require("../types.js");
/**
 * Global broadcast scheduler.
 * Runs a single 100ms interval, iterates racing rooms with dirty progress,
 * broadcasts progress updates, and clears the dirty flag.
 */
class BroadcastScheduler {
    interval = null;
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    start() {
        this.interval = setInterval(() => {
            this.tick();
        }, config_js_1.GAME_CONFIG.BROADCAST_INTERVAL_MS);
        console.log(`[BroadcastScheduler] Started, ticking every ${config_js_1.GAME_CONFIG.BROADCAST_INTERVAL_MS}ms`);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    tick() {
        const rooms = (0, room_service_js_1.getAllRooms)();
        for (const [, room] of rooms) {
            if (room.status !== "playing" || !room.dirtyProgress)
                continue;
            // Only broadcast race progress for tap-race rooms (tug-war handles its own broadcast)
            if (room.gameType !== "tap-race")
                continue;
            // Build progress view
            const players = room.players.map(types_js_1.buildRacePlayerView);
            // Get connection IDs for all connected players
            const connectionIds = room.players
                .filter((p) => p.isConnected && p.connectionId)
                .map((p) => p.connectionId);
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
exports.BroadcastScheduler = BroadcastScheduler;
//# sourceMappingURL=broadcast-scheduler.js.map