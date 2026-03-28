"use strict";
// ============================================================
// Domain Models (internal — never sent to client directly)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = void 0;
exports.buildPlayerView = buildPlayerView;
exports.buildRoomView = buildRoomView;
exports.buildRacePlayerView = buildRacePlayerView;
exports.buildRoomListItem = buildRoomListItem;
// ============================================================
// Error Codes
// ============================================================
exports.ErrorCodes = {
    ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
    ROOM_FULL: "ROOM_FULL",
    ROOM_ALREADY_STARTED: "ROOM_ALREADY_STARTED",
    PLAYER_ALREADY_IN_ROOM: "PLAYER_ALREADY_IN_ROOM",
    PLAYER_ACTIVE_IN_OTHER_ROOM: "PLAYER_ACTIVE_IN_OTHER_ROOM",
    NOT_HOST: "NOT_HOST",
    NOT_ALL_READY: "NOT_ALL_READY",
    NOT_ENOUGH_PLAYERS: "NOT_ENOUGH_PLAYERS",
    TAP_NOT_ALLOWED: "TAP_NOT_ALLOWED",
    INVALID_MESSAGE: "INVALID_MESSAGE",
};
// ============================================================
// View Builders
// ============================================================
function buildPlayerView(p) {
    return {
        playerId: p.playerId,
        name: p.name,
        isConnected: p.isConnected,
        isReady: p.isReady,
        progress: p.progress,
        tapCount: p.tapCount,
        team: p.team,
    };
}
function buildRoomView(room) {
    return {
        roomId: room.roomId,
        gameType: room.gameType,
        status: room.status,
        hostPlayerId: room.hostPlayerId,
        players: room.players.map(buildPlayerView),
        maxPlayers: room.maxPlayers,
        finishProgress: room.finishProgress,
    };
}
function buildRacePlayerView(p) {
    return {
        playerId: p.playerId,
        name: p.name,
        progress: p.progress,
        tapCount: p.tapCount,
        finishOrder: p.finishOrder,
        isConnected: p.isConnected,
    };
}
function buildRoomListItem(room) {
    const host = room.players.find((p) => p.playerId === room.hostPlayerId);
    return {
        roomId: room.roomId,
        gameType: room.gameType,
        hostName: host?.name ?? "Unknown",
        playerCount: room.players.filter((p) => p.isConnected).length,
        maxPlayers: room.maxPlayers,
        status: "waiting",
    };
}
//# sourceMappingURL=types.js.map