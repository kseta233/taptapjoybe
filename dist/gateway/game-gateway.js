"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const roomService = __importStar(require("../domain/room-service.js"));
const raceEngine = __importStar(require("../domain/race-engine.js"));
const tugEngine = __importStar(require("../domain/tug-engine.js"));
/**
 * Game Gateway — routes client events to domain services and dispatches results.
 * Owns the connection registry (connectionId ↔ playerId mapping).
 * Knows about events and players, but NOT about WebSocket.
 */
class GameGateway {
    transport;
    // connectionId → playerId
    connectionToPlayer = new Map();
    // playerId → connectionId
    playerToConnection = new Map();
    // Lobby subscribers: connectionIds that want room list updates, keyed by gameType
    lobbySubscribers = new Map(); // gameType → Set<connectionId>
    constructor(transport) {
        this.transport = transport;
        // Register grace period callback for tap-race
        raceEngine.setOnGraceExpired((_roomId, result) => {
            this.dispatchResult(result);
        });
        // Register tick broadcast callback for tug-war
        tugEngine.setOnTickBroadcast((_roomId, result) => {
            this.dispatchResult(result);
        });
    }
    // ============================================================
    // IGatewayHandler implementation
    // ============================================================
    onConnect(connectionId) {
        console.log(`[Gateway] Connection opened: ${connectionId}`);
    }
    onMessage(connectionId, event) {
        switch (event.type) {
            case "room.create":
                this.handleCreate(connectionId, event);
                break;
            case "room.join":
                this.handleJoin(connectionId, event);
                break;
            case "room.ready":
                this.handleReady(connectionId, event);
                break;
            case "room.start":
                this.handleStart(connectionId, event);
                break;
            case "race.tap":
                this.handleRaceTap(connectionId, event);
                break;
            case "tug.tap":
                this.handleTugTap(connectionId, event);
                break;
            case "room.leave":
                this.handleLeave(connectionId, event);
                break;
            case "room.list":
                this.handleRoomList(connectionId, event);
                break;
        }
    }
    onDisconnect(connectionId) {
        const playerId = this.connectionToPlayer.get(connectionId);
        // Remove from lobby subscribers
        for (const [, subscribers] of this.lobbySubscribers) {
            subscribers.delete(connectionId);
        }
        if (!playerId) {
            console.log(`[Gateway] Unknown connection disconnected: ${connectionId}`);
            return;
        }
        console.log(`[Gateway] Player disconnected: ${playerId} (conn: ${connectionId})`);
        // Only clean up mapping if this is still the active connection for the player
        const currentConn = this.playerToConnection.get(playerId);
        if (currentConn === connectionId) {
            this.playerToConnection.delete(playerId);
        }
        this.connectionToPlayer.delete(connectionId);
        // Handle disconnect in domain
        const { roomId, result } = roomService.handleDisconnect(playerId);
        // If host disconnected during countdown, also cancel the countdown timer
        if (roomId) {
            const room = roomService.getRoom(roomId);
            if (room && room.status === "waiting") {
                raceEngine.cancelCountdown(roomId);
            }
        }
        this.dispatchResult(result);
        // Notify lobby subscribers since room state changed
        if (result.stateChanged) {
            this.broadcastRoomLists();
        }
    }
    // ============================================================
    // Event Handlers
    // ============================================================
    handleCreate(connectionId, event) {
        const { sessionPlayerId, name, maxPlayers, gameType } = event.payload;
        // Bind connection to player
        this.bindConnection(connectionId, sessionPlayerId);
        // Remove from lobby subscribers (player is now in a room)
        this.removeFromLobbySubscribers(connectionId);
        const result = roomService.createRoom(sessionPlayerId, name, maxPlayers, gameType);
        // Set connectionId on the player in the room
        if (result.stateChanged) {
            const roomId = roomService.getPlayerRoom(sessionPlayerId);
            if (roomId) {
                roomService.setPlayerConnection(roomId, sessionPlayerId, connectionId);
            }
        }
        this.dispatchResult(result);
        // Notify lobby subscribers since a new room was created
        if (result.stateChanged) {
            this.broadcastRoomLists();
        }
    }
    handleJoin(connectionId, event) {
        const { sessionPlayerId, roomId, name } = event.payload;
        // Bind connection to player
        this.bindConnection(connectionId, sessionPlayerId);
        // Remove from lobby subscribers
        this.removeFromLobbySubscribers(connectionId);
        const result = roomService.joinRoom(sessionPlayerId, roomId, name);
        // Set connectionId on the player in the room
        if (result.stateChanged) {
            roomService.setPlayerConnection(roomId, sessionPlayerId, connectionId);
        }
        this.dispatchResult(result);
        // Notify lobby subscribers since room player count changed
        if (result.stateChanged) {
            this.broadcastRoomLists();
        }
    }
    handleReady(connectionId, event) {
        const playerId = this.connectionToPlayer.get(connectionId);
        if (!playerId)
            return;
        const result = roomService.setReady(event.payload.roomId, playerId, event.payload.isReady);
        this.dispatchResult(result);
    }
    handleStart(connectionId, event) {
        const playerId = this.connectionToPlayer.get(connectionId);
        if (!playerId)
            return;
        const { roomId } = event.payload;
        // Validate start conditions
        const validationError = roomService.canStart(roomId, playerId);
        if (validationError) {
            this.dispatchResult(validationError);
            return;
        }
        const room = roomService.getRoom(roomId);
        if (!room)
            return;
        // Start countdown — works for both game types
        const countdownResult = raceEngine.startCountdown(roomId, 
        // onTick
        (rid, value) => {
            const r = roomService.getRoom(rid);
            if (!r)
                return;
            const connectionIds = r.players
                .filter((p) => p.isConnected && p.connectionId)
                .map((p) => p.connectionId);
            this.transport.broadcast(connectionIds, {
                type: "game.countdown",
                payload: { value },
            });
        }, 
        // onComplete — branch by game type
        (rid) => {
            const r = roomService.getRoom(rid);
            if (!r)
                return;
            if (r.gameType === "tap-race") {
                const racingResult = raceEngine.startRacing(rid);
                this.dispatchResult(racingResult);
            }
            else if (r.gameType === "tug-war") {
                const tugResult = tugEngine.initTugWar(rid);
                this.dispatchResult(tugResult);
            }
        });
        this.dispatchResult(countdownResult);
        // Notify lobby subscribers since room is no longer waiting
        this.broadcastRoomLists();
    }
    handleRaceTap(connectionId, event) {
        const playerId = this.connectionToPlayer.get(connectionId);
        if (!playerId)
            return;
        const result = raceEngine.handleTap(event.payload.roomId, playerId);
        this.dispatchResult(result);
    }
    handleTugTap(connectionId, event) {
        const playerId = this.connectionToPlayer.get(connectionId);
        if (!playerId)
            return;
        const result = tugEngine.handleTugTap(event.payload.roomId, playerId);
        this.dispatchResult(result);
    }
    handleLeave(connectionId, event) {
        const playerId = this.connectionToPlayer.get(connectionId);
        if (!playerId)
            return;
        const result = roomService.leaveRoom(event.payload.roomId, playerId);
        this.dispatchResult(result);
        // Clean up connection mapping
        this.connectionToPlayer.delete(connectionId);
        this.playerToConnection.delete(playerId);
        // Notify lobby subscribers since room player count changed
        if (result.stateChanged) {
            this.broadcastRoomLists();
        }
    }
    handleRoomList(connectionId, event) {
        const { gameType } = event.payload;
        // Subscribe this connection to lobby updates for this game type
        if (!this.lobbySubscribers.has(gameType)) {
            this.lobbySubscribers.set(gameType, new Set());
        }
        // Remove from other game type subscriptions
        for (const [gt, subscribers] of this.lobbySubscribers) {
            if (gt !== gameType) {
                subscribers.delete(connectionId);
            }
        }
        this.lobbySubscribers.get(gameType).add(connectionId);
        // Send current room list
        const rooms = roomService.listRooms(gameType);
        this.transport.send(connectionId, {
            type: "room.listResult",
            payload: { rooms },
        });
    }
    // ============================================================
    // Connection Registry
    // ============================================================
    bindConnection(connectionId, playerId) {
        // If player had an old connection, clean it up
        const oldConnection = this.playerToConnection.get(playerId);
        if (oldConnection && oldConnection !== connectionId) {
            this.connectionToPlayer.delete(oldConnection);
        }
        // If this connection was bound to a different player, clean it up
        const oldPlayer = this.connectionToPlayer.get(connectionId);
        if (oldPlayer && oldPlayer !== playerId) {
            this.playerToConnection.delete(oldPlayer);
        }
        this.connectionToPlayer.set(connectionId, playerId);
        this.playerToConnection.set(playerId, connectionId);
    }
    removeFromLobbySubscribers(connectionId) {
        for (const [, subscribers] of this.lobbySubscribers) {
            subscribers.delete(connectionId);
        }
    }
    // ============================================================
    // Lobby Broadcast
    // ============================================================
    /** Broadcast updated room lists to all lobby subscribers */
    broadcastRoomLists() {
        for (const [gameType, subscribers] of this.lobbySubscribers) {
            if (subscribers.size === 0)
                continue;
            const rooms = roomService.listRooms(gameType);
            const connectionIds = Array.from(subscribers);
            this.transport.broadcast(connectionIds, {
                type: "room.listResult",
                payload: { rooms },
            });
        }
    }
    // ============================================================
    // Outbox Dispatch
    // ============================================================
    /** Dispatch a DomainResult to the appropriate connections via transport */
    dispatchResult(result) {
        // Send to specific players
        if (result.toPlayer) {
            for (const { playerId, event } of result.toPlayer) {
                const connId = this.playerToConnection.get(playerId);
                if (connId) {
                    this.transport.send(connId, event);
                }
            }
        }
        // Broadcast to room
        if (result.toRoom) {
            for (const { roomId, event } of result.toRoom) {
                const room = roomService.getRoom(roomId);
                if (!room)
                    continue;
                const connectionIds = room.players
                    .filter((p) => p.isConnected && p.connectionId)
                    .map((p) => p.connectionId);
                this.transport.broadcast(connectionIds, event);
            }
        }
    }
}
exports.GameGateway = GameGateway;
//# sourceMappingURL=game-gateway.js.map