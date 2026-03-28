import { GAME_CONFIG } from "../config.js";
import type { Room, PlayerState, DomainResult } from "../types.js";
import { ErrorCodes, buildRoomView } from "../types.js";
import { generateRoomId, nowMs } from "../utils.js";

// In-memory room store
const rooms = new Map<string, Room>();

// Index: playerId → roomId (for "player active in other room" checks)
const playerRoomIndex = new Map<string, string>();

// ============================================================
// Queries
// ============================================================

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getAllRooms(): Map<string, Room> {
  return rooms;
}

export function getPlayerRoom(playerId: string): string | undefined {
  return playerRoomIndex.get(playerId);
}

export function findPlayerInRoom(room: Room, playerId: string): PlayerState | undefined {
  return room.players.find((p) => p.playerId === playerId);
}

// ============================================================
// Commands
// ============================================================

export function createRoom(
  sessionPlayerId: string,
  name: string,
  maxPlayers?: number
): DomainResult {
  // Check if player is already in another room
  const existingRoomId = playerRoomIndex.get(sessionPlayerId);
  if (existingRoomId) {
    const existingRoom = rooms.get(existingRoomId);
    if (existingRoom) {
      const existingPlayer = findPlayerInRoom(existingRoom, sessionPlayerId);
      if (existingPlayer && existingPlayer.isConnected) {
        return {
          toPlayer: [
            {
              playerId: sessionPlayerId,
              event: {
                type: "error",
                payload: {
                  code: ErrorCodes.PLAYER_ACTIVE_IN_OTHER_ROOM,
                  message: `Already active in room ${existingRoomId}`,
                },
              },
            },
          ],
        };
      }
      // Player was disconnected from old room — clean up
      removePlayerFromRoom(existingRoom, sessionPlayerId);
    }
  }

  // Generate unique room ID
  let roomId: string;
  do {
    roomId = generateRoomId();
  } while (rooms.has(roomId));

  const now = nowMs();
  const player: PlayerState = {
    playerId: sessionPlayerId,
    name,
    isConnected: true,
    isReady: false,
    progress: 0,
    tapCount: 0,
    joinedAt: now,
  };

  const room: Room = {
    roomId,
    gameType: "tap-race",
    status: "waiting",
    hostPlayerId: sessionPlayerId,
    players: [player],
    maxPlayers: maxPlayers ?? GAME_CONFIG.MAX_PLAYERS,
    finishProgress: GAME_CONFIG.FINISH_PROGRESS,
    finishOrder: [],
    dirtyProgress: false,
    createdAt: now,
  };

  rooms.set(roomId, room);
  playerRoomIndex.set(sessionPlayerId, roomId);

  return {
    toPlayer: [
      {
        playerId: sessionPlayerId,
        event: { type: "room.created", payload: { roomId, playerId: sessionPlayerId } },
      },
    ],
    toRoom: [
      { roomId, event: { type: "room.state", payload: buildRoomView(room) } },
    ],
    stateChanged: true,
  };
}

export function joinRoom(
  sessionPlayerId: string,
  roomId: string,
  name: string
): DomainResult {
  const room = rooms.get(roomId);
  if (!room) {
    return errorToPlayer(sessionPlayerId, ErrorCodes.ROOM_NOT_FOUND, "Room not found");
  }

  const existingPlayer = findPlayerInRoom(room, sessionPlayerId);

  // Rebind case: same player, same room, was disconnected
  if (existingPlayer) {
    if (existingPlayer.isConnected) {
      return errorToPlayer(sessionPlayerId, ErrorCodes.PLAYER_ALREADY_IN_ROOM, "Already in this room");
    }

    // Rebind — allowed in any phase for existing roster members
    existingPlayer.isConnected = true;
    existingPlayer.name = name; // allow name update on rebind

    return {
      toPlayer: [
        {
          playerId: sessionPlayerId,
          event: { type: "room.joined", payload: { roomId, playerId: sessionPlayerId } },
        },
      ],
      toRoom: [
        { roomId, event: { type: "room.state", payload: buildRoomView(room) } },
      ],
      stateChanged: true,
    };
  }

  // New join — only allowed in waiting
  if (room.status !== "waiting") {
    return errorToPlayer(sessionPlayerId, ErrorCodes.ROOM_ALREADY_STARTED, "Room already started");
  }

  if (room.players.length >= room.maxPlayers) {
    return errorToPlayer(sessionPlayerId, ErrorCodes.ROOM_FULL, "Room is full");
  }

  // Check if player is active in another room
  const otherRoomId = playerRoomIndex.get(sessionPlayerId);
  if (otherRoomId && otherRoomId !== roomId) {
    const otherRoom = rooms.get(otherRoomId);
    if (otherRoom) {
      const otherPlayer = findPlayerInRoom(otherRoom, sessionPlayerId);
      if (otherPlayer && otherPlayer.isConnected) {
        return errorToPlayer(
          sessionPlayerId,
          ErrorCodes.PLAYER_ACTIVE_IN_OTHER_ROOM,
          `Already active in room ${otherRoomId}`
        );
      }
      // Was disconnected from other room — clean up
      removePlayerFromRoom(otherRoom, sessionPlayerId);
    }
  }

  const now = nowMs();
  const player: PlayerState = {
    playerId: sessionPlayerId,
    name,
    isConnected: true,
    isReady: false,
    progress: 0,
    tapCount: 0,
    joinedAt: now,
  };

  room.players.push(player);
  playerRoomIndex.set(sessionPlayerId, roomId);

  return {
    toPlayer: [
      {
        playerId: sessionPlayerId,
        event: { type: "room.joined", payload: { roomId, playerId: sessionPlayerId } },
      },
    ],
    toRoom: [
      { roomId, event: { type: "room.state", payload: buildRoomView(room) } },
    ],
    stateChanged: true,
  };
}

export function setReady(
  roomId: string,
  playerId: string,
  isReady: boolean
): DomainResult {
  const room = rooms.get(roomId);
  if (!room) return errorToPlayer(playerId, ErrorCodes.ROOM_NOT_FOUND, "Room not found");
  if (room.status !== "waiting") {
    return errorToPlayer(playerId, ErrorCodes.ROOM_ALREADY_STARTED, "Cannot change ready during game");
  }

  const player = findPlayerInRoom(room, playerId);
  if (!player) return errorToPlayer(playerId, ErrorCodes.ROOM_NOT_FOUND, "Not in this room");

  player.isReady = isReady;

  return {
    toRoom: [{ roomId, event: { type: "room.state", payload: buildRoomView(room) } }],
    stateChanged: true,
  };
}

export function canStart(roomId: string, playerId: string): DomainResult | null {
  const room = rooms.get(roomId);
  if (!room) return errorToPlayer(playerId, ErrorCodes.ROOM_NOT_FOUND, "Room not found");
  if (room.status !== "waiting") {
    return errorToPlayer(playerId, ErrorCodes.ROOM_ALREADY_STARTED, "Game already started");
  }
  if (room.hostPlayerId !== playerId) {
    return errorToPlayer(playerId, ErrorCodes.NOT_HOST, "Only host can start");
  }

  const connectedPlayers = room.players.filter((p) => p.isConnected);
  if (connectedPlayers.length < GAME_CONFIG.MIN_PLAYERS_TO_START) {
    return errorToPlayer(playerId, ErrorCodes.NOT_ENOUGH_PLAYERS, "Need at least 2 players");
  }

  const allReady = connectedPlayers.every((p) => p.isReady);
  if (!allReady) {
    return errorToPlayer(playerId, ErrorCodes.NOT_ALL_READY, "Not all players are ready");
  }

  // Validation passed — return null (caller proceeds with countdown)
  return null;
}

export function leaveRoom(roomId: string, playerId: string): DomainResult {
  const room = rooms.get(roomId);
  if (!room) return errorToPlayer(playerId, ErrorCodes.ROOM_NOT_FOUND, "Room not found");

  // During countdown/racing/finished — leave is not allowed
  if (room.status !== "waiting") {
    return errorToPlayer(playerId, ErrorCodes.ROOM_ALREADY_STARTED, "Cannot leave during game");
  }

  removePlayerFromRoom(room, playerId);

  // If room is empty, delete it
  if (room.players.length === 0) {
    rooms.delete(roomId);
    return { stateChanged: true };
  }

  // If host left, migrate
  if (room.hostPlayerId === playerId) {
    migrateHost(room);
  }

  return {
    toRoom: [{ roomId, event: { type: "room.state", payload: buildRoomView(room) } }],
    stateChanged: true,
  };
}

/**
 * Handle player disconnect (socket closed).
 * Returns the roomId the player was in, or undefined.
 */
export function handleDisconnect(playerId: string): { roomId?: string; result: DomainResult } {
  const roomId = playerRoomIndex.get(playerId);
  if (!roomId) return { result: {} };

  const room = rooms.get(roomId);
  if (!room) {
    playerRoomIndex.delete(playerId);
    return { result: {} };
  }

  const player = findPlayerInRoom(room, playerId);
  if (!player) return { result: {} };

  player.isConnected = false;
  player.connectionId = undefined;

  if (room.status === "waiting") {
    // In waiting, disconnected player is removed immediately
    removePlayerFromRoom(room, playerId);

    if (room.players.length === 0) {
      rooms.delete(roomId);
      return { roomId, result: { stateChanged: true } };
    }

    // Host migration
    if (room.hostPlayerId === playerId) {
      migrateHost(room);
    }

    return {
      roomId,
      result: {
        toRoom: [{ roomId, event: { type: "room.state", payload: buildRoomView(room) } }],
        stateChanged: true,
      },
    };
  }

  if (room.status === "countdown") {
    // Host disconnect during countdown → cancel, revert to waiting
    if (room.hostPlayerId === playerId) {
      removePlayerFromRoom(room, playerId);
      if (room.players.length === 0) {
        rooms.delete(roomId);
        return { roomId, result: { stateChanged: true } };
      }
      room.status = "waiting";
      // Reset all ready states
      for (const p of room.players) {
        p.isReady = false;
      }
      migrateHost(room);

      return {
        roomId,
        result: {
          toRoom: [{ roomId, event: { type: "room.state", payload: buildRoomView(room) } }],
          stateChanged: true,
        },
      };
    }

    // Non-host disconnect during countdown — they stay in roster but disconnected
    return {
      roomId,
      result: {
        toRoom: [{ roomId, event: { type: "room.state", payload: buildRoomView(room) } }],
        stateChanged: true,
      },
    };
  }

  // During racing/finished — player stays but can't tap (effectively DNF)
  return {
    roomId,
    result: {
      toRoom: [{ roomId, event: { type: "room.state", payload: buildRoomView(room) } }],
      stateChanged: true,
    },
  };
}

/**
 * Set the connection ID for a player (called by gateway on connect/rebind).
 */
export function setPlayerConnection(roomId: string, playerId: string, connectionId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const player = findPlayerInRoom(room, playerId);
  if (player) {
    player.connectionId = connectionId;
  }
}

/**
 * Delete a room (used by cleanup).
 */
export function deleteRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  for (const p of room.players) {
    playerRoomIndex.delete(p.playerId);
  }
  rooms.delete(roomId);
}

// ============================================================
// Helpers (internal)
// ============================================================

function removePlayerFromRoom(room: Room, playerId: string): void {
  room.players = room.players.filter((p) => p.playerId !== playerId);
  playerRoomIndex.delete(playerId);
}

function migrateHost(room: Room): void {
  // Pick earliest joined connected player
  const connected = room.players
    .filter((p) => p.isConnected)
    .sort((a, b) => a.joinedAt - b.joinedAt);

  if (connected.length > 0) {
    room.hostPlayerId = connected[0].playerId;
  } else if (room.players.length > 0) {
    // No one connected — pick earliest joined anyway
    room.hostPlayerId = room.players.sort((a, b) => a.joinedAt - b.joinedAt)[0].playerId;
  }
}

function errorToPlayer(playerId: string, code: string, message: string): DomainResult {
  return {
    toPlayer: [
      {
        playerId,
        event: { type: "error", payload: { code, message } },
      },
    ],
  };
}
