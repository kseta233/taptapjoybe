"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCountdown = startCountdown;
exports.cancelCountdown = cancelCountdown;
exports.startRacing = startRacing;
exports.handleTap = handleTap;
exports.setOnGraceExpired = setOnGraceExpired;
exports.cleanupRoomTimers = cleanupRoomTimers;
const config_js_1 = require("../config.js");
const types_js_1 = require("../types.js");
const room_service_js_1 = require("./room-service.js");
const anti_cheat_js_1 = require("./anti-cheat.js");
const utils_js_1 = require("../utils.js");
// Timers stored outside Room to keep domain model serializable
const countdownTimers = new Map();
const graceTimers = new Map();
/**
 * Start the countdown sequence for a room.
 * Returns a DomainResult for each countdown tick (3, 2, 1, 0).
 * Calls `onCountdownComplete` when done.
 */
function startCountdown(roomId, onTick, onComplete) {
    const room = (0, room_service_js_1.getRoom)(roomId);
    if (!room)
        return errorToPlayer("", types_js_1.ErrorCodes.ROOM_NOT_FOUND, "Room not found");
    room.status = "countdown";
    let count = config_js_1.GAME_CONFIG.COUNTDOWN_SECONDS;
    // Send initial countdown value immediately
    onTick(roomId, count);
    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            onTick(roomId, count);
        }
        else {
            // Countdown complete
            clearInterval(timer);
            countdownTimers.delete(roomId);
            onTick(roomId, 0); // "GO!"
            onComplete(roomId);
        }
    }, 1000);
    countdownTimers.set(roomId, timer);
    return {
        toRoom: [{ roomId, event: { type: "room.state", payload: (0, types_js_1.buildRoomView)(room) } }],
        stateChanged: true,
    };
}
/**
 * Cancel an active countdown (e.g., host disconnect during countdown).
 */
function cancelCountdown(roomId) {
    const timer = countdownTimers.get(roomId);
    if (timer) {
        clearInterval(timer);
        countdownTimers.delete(roomId);
    }
}
/**
 * Transition room to racing state.
 */
function startRacing(roomId) {
    const room = (0, room_service_js_1.getRoom)(roomId);
    if (!room)
        return {};
    room.status = "racing";
    room.startedAt = (0, utils_js_1.nowMs)();
    // Reset all players for race
    for (const player of room.players) {
        player.progress = 0;
        player.tapCount = 0;
        player.finishOrder = undefined;
        player.finishedAtMs = undefined;
    }
    room.finishOrder = [];
    room.dirtyProgress = true;
    return {
        toRoom: [{ roomId, event: { type: "room.state", payload: (0, types_js_1.buildRoomView)(room) } }],
        stateChanged: true,
    };
}
/**
 * Handle a tap from a player.
 * Returns empty result on rate-limit (silent ignore) or error on invalid state.
 */
function handleTap(roomId, playerId) {
    const room = (0, room_service_js_1.getRoom)(roomId);
    if (!room)
        return errorToPlayer(playerId, types_js_1.ErrorCodes.ROOM_NOT_FOUND, "Room not found");
    if (room.status !== "racing") {
        return errorToPlayer(playerId, types_js_1.ErrorCodes.TAP_NOT_ALLOWED, "Race not active");
    }
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player || !player.isConnected) {
        return errorToPlayer(playerId, types_js_1.ErrorCodes.TAP_NOT_ALLOWED, "Not a valid player");
    }
    // Already finished
    if (player.finishOrder !== undefined) {
        return {}; // Silent ignore
    }
    const now = (0, utils_js_1.nowMs)();
    // Rate limit check
    if (!anti_cheat_js_1.antiCheat.checkTap(playerId, now)) {
        return {}; // Silent ignore — over rate limit
    }
    // Accept tap
    player.progress += config_js_1.GAME_CONFIG.PROGRESS_PER_TAP;
    player.tapCount += 1;
    room.dirtyProgress = true;
    // Check if player reached finish
    if (player.progress >= room.finishProgress) {
        player.progress = room.finishProgress; // Cap at finish
        room.finishOrder.push(playerId);
        player.finishOrder = room.finishOrder.length;
        player.finishedAtMs = now;
        // Check if race should end
        const raceResult = checkRaceEnd(room);
        if (raceResult)
            return raceResult;
        // First finisher — start grace period for others
        if (room.finishOrder.length === 1) {
            startGracePeriod(roomId);
        }
    }
    return { stateChanged: true };
}
/**
 * Check if the race should end.
 * Ends when all connected players finish.
 */
function checkRaceEnd(room) {
    const connectedPlayers = room.players.filter((p) => p.isConnected);
    const allFinished = connectedPlayers.every((p) => p.finishOrder !== undefined);
    if (allFinished) {
        return finishRace(room);
    }
    return null;
}
/**
 * Start the grace period timer after first player finishes.
 */
function startGracePeriod(roomId) {
    // Clear any existing grace timer
    const existing = graceTimers.get(roomId);
    if (existing)
        clearTimeout(existing);
    const timer = setTimeout(() => {
        graceTimers.delete(roomId);
        const room = (0, room_service_js_1.getRoom)(roomId);
        if (room && room.status === "racing") {
            const result = finishRace(room);
            // We need a way to dispatch this — use the onGraceExpired callback
            if (onGraceExpiredCallback) {
                onGraceExpiredCallback(roomId, result);
            }
        }
    }, config_js_1.GAME_CONFIG.RACE_GRACE_PERIOD_MS);
    graceTimers.set(roomId, timer);
}
// Callback for grace period expiration — set by gateway
let onGraceExpiredCallback = null;
function setOnGraceExpired(cb) {
    onGraceExpiredCallback = cb;
}
/**
 * Finish the race — calculate rankings, freeze game.
 */
function finishRace(room) {
    room.status = "finished";
    room.finishedAt = (0, utils_js_1.nowMs)();
    room.dirtyProgress = false;
    // Clear grace timer
    const graceTimer = graceTimers.get(room.roomId);
    if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimers.delete(room.roomId);
    }
    // Build rankings:
    // 1. Players who finished (by finishOrder)
    // 2. Players who didn't finish (by progress descending)
    const finished = room.players
        .filter((p) => p.finishOrder !== undefined)
        .sort((a, b) => a.finishOrder - b.finishOrder);
    const unfinished = room.players
        .filter((p) => p.finishOrder === undefined)
        .sort((a, b) => b.progress - a.progress);
    // Assign finish order to unfinished players
    let order = finished.length + 1;
    for (const p of unfinished) {
        p.finishOrder = order++;
    }
    const rankings = [...finished, ...unfinished].map(types_js_1.buildRacePlayerView);
    // Clean up anti-cheat data
    anti_cheat_js_1.antiCheat.clearRoom(room.players.map((p) => p.playerId));
    return {
        toRoom: [
            {
                roomId: room.roomId,
                event: { type: "race.finished", payload: { rankings } },
            },
        ],
        stateChanged: true,
    };
}
/**
 * Clean up timers for a room (called on room deletion).
 */
function cleanupRoomTimers(roomId) {
    cancelCountdown(roomId);
    const graceTimer = graceTimers.get(roomId);
    if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimers.delete(roomId);
    }
}
function errorToPlayer(playerId, code, message) {
    return {
        toPlayer: [
            {
                playerId,
                event: { type: "error", payload: { code, message } },
            },
        ],
    };
}
//# sourceMappingURL=race-engine.js.map