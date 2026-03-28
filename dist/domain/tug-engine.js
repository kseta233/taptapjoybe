"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setOnTickBroadcast = setOnTickBroadcast;
exports.initTugWar = initTugWar;
exports.handleTugTap = handleTugTap;
exports.cleanupTugTimers = cleanupTugTimers;
const config_js_1 = require("../config.js");
const types_js_1 = require("../types.js");
const room_service_js_1 = require("./room-service.js");
const anti_cheat_js_1 = require("./anti-cheat.js");
const utils_js_1 = require("../utils.js");
// Tick timers per room
const tickTimers = new Map();
// Callback for broadcasting tick state — set by gateway
let onTickBroadcastCallback = null;
function setOnTickBroadcast(cb) {
    onTickBroadcastCallback = cb;
}
/**
 * Initialize tug of war: assign teams, create state, start tick loop.
 */
function initTugWar(roomId) {
    const room = (0, room_service_js_1.getRoom)(roomId);
    if (!room)
        return {};
    room.status = "playing";
    room.startedAt = (0, utils_js_1.nowMs)();
    // Assign teams by alternating join order
    const sortedPlayers = [...room.players]
        .filter((p) => p.isConnected)
        .sort((a, b) => a.joinedAt - b.joinedAt);
    const leftTeam = [];
    const rightTeam = [];
    sortedPlayers.forEach((p, i) => {
        if (i % 2 === 0) {
            p.team = "left";
            leftTeam.push(p.playerId);
        }
        else {
            p.team = "right";
            rightTeam.push(p.playerId);
        }
    });
    // Also assign disconnected players (for display)
    room.players
        .filter((p) => !p.isConnected)
        .forEach((p, i) => {
        if ((sortedPlayers.length + i) % 2 === 0) {
            p.team = "left";
            leftTeam.push(p.playerId);
        }
        else {
            p.team = "right";
            rightTeam.push(p.playerId);
        }
    });
    // Initialize tug state
    const tugState = {
        ropePosition: 0,
        leftForce: 0,
        rightForce: 0,
        timeLeftMs: config_js_1.GAME_CONFIG.TUG_MATCH_DURATION_MS,
        leftTeam,
        rightTeam,
        leftTotalTaps: 0,
        rightTotalTaps: 0,
    };
    room.tugState = tugState;
    room.dirtyProgress = true;
    // Start the physics tick loop
    startTickLoop(roomId);
    return {
        toRoom: [{ roomId, event: { type: "room.state", payload: (0, types_js_1.buildRoomView)(room) } }],
        stateChanged: true,
    };
}
/**
 * Handle a tug tap from a player.
 */
function handleTugTap(roomId, playerId) {
    const room = (0, room_service_js_1.getRoom)(roomId);
    if (!room)
        return errorToPlayer(playerId, types_js_1.ErrorCodes.ROOM_NOT_FOUND, "Room not found");
    if (room.status !== "playing" || !room.tugState) {
        return errorToPlayer(playerId, types_js_1.ErrorCodes.TAP_NOT_ALLOWED, "Game not active");
    }
    const player = room.players.find((p) => p.playerId === playerId);
    if (!player || !player.isConnected || !player.team) {
        return errorToPlayer(playerId, types_js_1.ErrorCodes.TAP_NOT_ALLOWED, "Not a valid player");
    }
    const now = (0, utils_js_1.nowMs)();
    // Rate limit check
    if (!anti_cheat_js_1.antiCheat.checkTap(playerId, now)) {
        return {}; // Silent ignore
    }
    // Add force to team
    const tug = room.tugState;
    if (player.team === "left") {
        tug.leftForce += config_js_1.GAME_CONFIG.TUG_TAP_FORCE;
        tug.leftTotalTaps += 1;
    }
    else {
        tug.rightForce += config_js_1.GAME_CONFIG.TUG_TAP_FORCE;
        tug.rightTotalTaps += 1;
    }
    player.tapCount += 1;
    room.dirtyProgress = true;
    return { stateChanged: true };
}
/**
 * Start the 50ms physics tick loop for a room.
 */
function startTickLoop(roomId) {
    // Clear any existing timer
    const existing = tickTimers.get(roomId);
    if (existing)
        clearInterval(existing);
    const timer = setInterval(() => {
        tick(roomId);
    }, config_js_1.GAME_CONFIG.TUG_TICK_MS);
    tickTimers.set(roomId, timer);
}
/**
 * Physics tick — runs every 50ms.
 */
function tick(roomId) {
    const room = (0, room_service_js_1.getRoom)(roomId);
    if (!room || !room.tugState || room.status !== "playing") {
        stopTickLoop(roomId);
        return;
    }
    const tug = room.tugState;
    // Apply force → rope movement
    const netForce = tug.rightForce - tug.leftForce;
    tug.ropePosition += netForce * config_js_1.GAME_CONFIG.TUG_MOVE_MULTIPLIER;
    // Force decay
    tug.leftForce *= config_js_1.GAME_CONFIG.TUG_FORCE_DECAY;
    tug.rightForce *= config_js_1.GAME_CONFIG.TUG_FORCE_DECAY;
    // Clamp rope position
    tug.ropePosition = Math.max(-config_js_1.GAME_CONFIG.TUG_ROPE_LIMIT, Math.min(config_js_1.GAME_CONFIG.TUG_ROPE_LIMIT, tug.ropePosition));
    // Countdown timer
    tug.timeLeftMs -= config_js_1.GAME_CONFIG.TUG_TICK_MS;
    // Win check: edge win
    if (tug.ropePosition <= -config_js_1.GAME_CONFIG.TUG_ROPE_LIMIT) {
        tug.winnerTeam = "left";
        const result = finishTugWar(room);
        if (onTickBroadcastCallback)
            onTickBroadcastCallback(roomId, result);
        return;
    }
    if (tug.ropePosition >= config_js_1.GAME_CONFIG.TUG_ROPE_LIMIT) {
        tug.winnerTeam = "right";
        const result = finishTugWar(room);
        if (onTickBroadcastCallback)
            onTickBroadcastCallback(roomId, result);
        return;
    }
    // Win check: timeout
    if (tug.timeLeftMs <= 0) {
        tug.timeLeftMs = 0;
        if (tug.ropePosition < 0) {
            tug.winnerTeam = "left";
        }
        else if (tug.ropePosition > 0) {
            tug.winnerTeam = "right";
        }
        else {
            tug.winnerTeam = "draw";
        }
        const result = finishTugWar(room);
        if (onTickBroadcastCallback)
            onTickBroadcastCallback(roomId, result);
        return;
    }
    // Broadcast state update
    if (onTickBroadcastCallback) {
        const stateResult = {
            toRoom: [
                {
                    roomId,
                    event: {
                        type: "tug.state",
                        payload: {
                            ropePosition: Math.round(tug.ropePosition * 100) / 100,
                            timeLeftMs: tug.timeLeftMs,
                            leftForce: Math.round(tug.leftForce * 100) / 100,
                            rightForce: Math.round(tug.rightForce * 100) / 100,
                        },
                    },
                },
            ],
        };
        onTickBroadcastCallback(roomId, stateResult);
    }
}
/**
 * Finish the tug of war — freeze game, broadcast result.
 */
function finishTugWar(room) {
    room.status = "finished";
    room.finishedAt = (0, utils_js_1.nowMs)();
    room.dirtyProgress = false;
    stopTickLoop(room.roomId);
    const tug = room.tugState;
    const resultPayload = {
        winnerTeam: tug.winnerTeam ?? "draw",
        finalRopePosition: Math.round(tug.ropePosition * 100) / 100,
        leftTotalTaps: tug.leftTotalTaps,
        rightTotalTaps: tug.rightTotalTaps,
        players: room.players.map((p) => ({
            playerId: p.playerId,
            name: p.name,
            team: p.team ?? "left",
            tapCount: p.tapCount,
        })),
    };
    // Clean up anti-cheat data
    anti_cheat_js_1.antiCheat.clearRoom(room.players.map((p) => p.playerId));
    return {
        toRoom: [
            {
                roomId: room.roomId,
                event: { type: "tug.finished", payload: resultPayload },
            },
        ],
        stateChanged: true,
    };
}
/**
 * Stop the tick loop for a room.
 */
function stopTickLoop(roomId) {
    const timer = tickTimers.get(roomId);
    if (timer) {
        clearInterval(timer);
        tickTimers.delete(roomId);
    }
}
/**
 * Clean up timers for a room (called on room deletion).
 */
function cleanupTugTimers(roomId) {
    stopTickLoop(roomId);
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
//# sourceMappingURL=tug-engine.js.map