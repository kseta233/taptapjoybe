"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomCleanup = void 0;
const config_js_1 = require("../config.js");
const room_service_js_1 = require("./room-service.js");
const race_engine_js_1 = require("./race-engine.js");
const anti_cheat_js_1 = require("./anti-cheat.js");
/**
 * Room cleanup service.
 * Periodically removes stale/finished rooms to prevent memory leaks.
 */
class RoomCleanup {
    interval = null;
    start() {
        this.interval = setInterval(() => {
            this.sweep();
        }, config_js_1.GAME_CONFIG.CLEANUP_INTERVAL_MS);
        console.log(`[RoomCleanup] Started, sweeping every ${config_js_1.GAME_CONFIG.CLEANUP_INTERVAL_MS / 1000}s`);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    sweep() {
        const now = Date.now();
        const rooms = (0, room_service_js_1.getAllRooms)();
        let cleaned = 0;
        for (const [roomId, room] of rooms) {
            let shouldDelete = false;
            // Empty waiting room > TTL
            if (room.status === "waiting" && room.players.length === 0) {
                shouldDelete = true;
            }
            // Idle waiting room (with players but no activity) > TTL
            if (room.status === "waiting" && now - room.createdAt > config_js_1.GAME_CONFIG.ROOM_IDLE_TTL_MS) {
                const anyConnected = room.players.some((p) => p.isConnected);
                if (!anyConnected) {
                    shouldDelete = true;
                }
            }
            // Finished room > TTL
            if (room.status === "finished" &&
                room.finishedAt &&
                now - room.finishedAt > config_js_1.GAME_CONFIG.ROOM_FINISHED_TTL_MS) {
                shouldDelete = true;
            }
            if (shouldDelete) {
                (0, race_engine_js_1.cleanupRoomTimers)(roomId);
                anti_cheat_js_1.antiCheat.clearRoom(room.players.map((p) => p.playerId));
                (0, room_service_js_1.deleteRoom)(roomId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[RoomCleanup] Swept ${cleaned} room(s), ${rooms.size} remaining`);
        }
    }
}
exports.roomCleanup = new RoomCleanup();
//# sourceMappingURL=room-cleanup.js.map