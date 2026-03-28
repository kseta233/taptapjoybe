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
    constructor(transport) {
        this.transport = transport;
        // Register grace period callback
        raceEngine.setOnGraceExpired((roomId, result) => {
            this.dispatchResult(result);
        });
    }
    // ============================================================
    // IGatewayHandler implementation
    // ============================================================
    onConnect(connectionId) {
        // Connection established, but no player identity yet.
        // Identity is established on room.create/room.join with sessionPlayerId.
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
                this.handleTap(connectionId, event);
                break;
            case "room.leave":
                this.handleLeave(connectionId, event);
                break;
        }
    }
    onDisconnect(connectionId) {
        const playerId = this.connectionToPlayer.get(connectionId);
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
                // Countdown was cancelled by handleDisconnect (status reverted to waiting)
                raceEngine.cancelCountdown(roomId);
            }
        }
        this.dispatchResult(result);
    }
    // ============================================================
    // Event Handlers
    // ============================================================
    handleCreate(connectionId, event) {
        const { sessionPlayerId, name, maxPlayers } = event.payload;
        // Bind connection to player
        this.bindConnection(connectionId, sessionPlayerId);
        const result = roomService.createRoom(sessionPlayerId, name, maxPlayers);
        // Set connectionId on the player in the room
        if (result.stateChanged) {
            const roomId = roomService.getPlayerRoom(sessionPlayerId);
            if (roomId) {
                roomService.setPlayerConnection(roomId, sessionPlayerId, connectionId);
            }
        }
        this.dispatchResult(result);
    }
    handleJoin(connectionId, event) {
        const { sessionPlayerId, roomId, name } = event.payload;
        // Bind connection to player
        this.bindConnection(connectionId, sessionPlayerId);
        const result = roomService.joinRoom(sessionPlayerId, roomId, name);
        // Set connectionId on the player in the room
        if (result.stateChanged) {
            roomService.setPlayerConnection(roomId, sessionPlayerId, connectionId);
        }
        this.dispatchResult(result);
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
        // Start countdown
        const countdownResult = raceEngine.startCountdown(roomId, 
        // onTick
        (rid, value) => {
            const room = roomService.getRoom(rid);
            if (!room)
                return;
            const connectionIds = room.players
                .filter((p) => p.isConnected && p.connectionId)
                .map((p) => p.connectionId);
            this.transport.broadcast(connectionIds, {
                type: "race.countdown",
                payload: { value },
            });
        }, 
        // onComplete
        (rid) => {
            const racingResult = raceEngine.startRacing(rid);
            this.dispatchResult(racingResult);
        });
        this.dispatchResult(countdownResult);
    }
    handleTap(connectionId, event) {
        const playerId = this.connectionToPlayer.get(connectionId);
        if (!playerId)
            return;
        const result = raceEngine.handleTap(event.payload.roomId, playerId);
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
    }
    // ============================================================
    // Connection Registry
    // ============================================================
    bindConnection(connectionId, playerId) {
        // If player had an old connection, clean it up
        const oldConnection = this.playerToConnection.get(playerId);
        if (oldConnection && oldConnection !== connectionId) {
            this.connectionToPlayer.delete(oldConnection);
            // Don't close the old socket — it may already be closed
        }
        // If this connection was bound to a different player, clean it up
        const oldPlayer = this.connectionToPlayer.get(connectionId);
        if (oldPlayer && oldPlayer !== playerId) {
            this.playerToConnection.delete(oldPlayer);
        }
        this.connectionToPlayer.set(connectionId, playerId);
        this.playerToConnection.set(playerId, connectionId);
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