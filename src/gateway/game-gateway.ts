import type { ClientEvent, DomainResult, ServerEvent } from "../types.js";
import type { ITransport, IGatewayHandler } from "../transport/interfaces.js";
import * as roomService from "../domain/room-service.js";
import * as raceEngine from "../domain/race-engine.js";

/**
 * Game Gateway — routes client events to domain services and dispatches results.
 * Owns the connection registry (connectionId ↔ playerId mapping).
 * Knows about events and players, but NOT about WebSocket.
 */
export class GameGateway implements IGatewayHandler {
  private transport: ITransport;

  // connectionId → playerId
  private connectionToPlayer = new Map<string, string>();
  // playerId → connectionId
  private playerToConnection = new Map<string, string>();

  constructor(transport: ITransport) {
    this.transport = transport;

    // Register grace period callback
    raceEngine.setOnGraceExpired((roomId, result) => {
      this.dispatchResult(result);
    });
  }

  // ============================================================
  // IGatewayHandler implementation
  // ============================================================

  onConnect(connectionId: string): void {
    // Connection established, but no player identity yet.
    // Identity is established on room.create/room.join with sessionPlayerId.
    console.log(`[Gateway] Connection opened: ${connectionId}`);
  }

  onMessage(connectionId: string, event: ClientEvent): void {
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

  onDisconnect(connectionId: string): void {
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

  private handleCreate(connectionId: string, event: Extract<ClientEvent, { type: "room.create" }>) {
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

  private handleJoin(connectionId: string, event: Extract<ClientEvent, { type: "room.join" }>) {
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

  private handleReady(connectionId: string, event: Extract<ClientEvent, { type: "room.ready" }>) {
    const playerId = this.connectionToPlayer.get(connectionId);
    if (!playerId) return;

    const result = roomService.setReady(event.payload.roomId, playerId, event.payload.isReady);
    this.dispatchResult(result);
  }

  private handleStart(connectionId: string, event: Extract<ClientEvent, { type: "room.start" }>) {
    const playerId = this.connectionToPlayer.get(connectionId);
    if (!playerId) return;

    const { roomId } = event.payload;

    // Validate start conditions
    const validationError = roomService.canStart(roomId, playerId);
    if (validationError) {
      this.dispatchResult(validationError);
      return;
    }

    // Start countdown
    const countdownResult = raceEngine.startCountdown(
      roomId,
      // onTick
      (rid, value) => {
        const room = roomService.getRoom(rid);
        if (!room) return;

        const connectionIds = room.players
          .filter((p) => p.isConnected && p.connectionId)
          .map((p) => p.connectionId!);

        this.transport.broadcast(connectionIds, {
          type: "race.countdown",
          payload: { value },
        });
      },
      // onComplete
      (rid) => {
        const racingResult = raceEngine.startRacing(rid);
        this.dispatchResult(racingResult);
      }
    );

    this.dispatchResult(countdownResult);
  }

  private handleTap(connectionId: string, event: Extract<ClientEvent, { type: "race.tap" }>) {
    const playerId = this.connectionToPlayer.get(connectionId);
    if (!playerId) return;

    const result = raceEngine.handleTap(event.payload.roomId, playerId);
    this.dispatchResult(result);
  }

  private handleLeave(connectionId: string, event: Extract<ClientEvent, { type: "room.leave" }>) {
    const playerId = this.connectionToPlayer.get(connectionId);
    if (!playerId) return;

    const result = roomService.leaveRoom(event.payload.roomId, playerId);
    this.dispatchResult(result);

    // Clean up connection mapping
    this.connectionToPlayer.delete(connectionId);
    this.playerToConnection.delete(playerId);
  }

  // ============================================================
  // Connection Registry
  // ============================================================

  private bindConnection(connectionId: string, playerId: string): void {
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
  dispatchResult(result: DomainResult): void {
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
        if (!room) continue;

        const connectionIds = room.players
          .filter((p) => p.isConnected && p.connectionId)
          .map((p) => p.connectionId!);

        this.transport.broadcast(connectionIds, event);
      }
    }
  }
}
