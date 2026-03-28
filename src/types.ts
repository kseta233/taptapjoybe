// ============================================================
// Domain Models (internal — never sent to client directly)
// ============================================================

export type RoomStatus = "waiting" | "countdown" | "racing" | "finished";

export type Room = {
  roomId: string;
  gameType: "tap-race";
  status: RoomStatus;
  hostPlayerId: string;
  players: PlayerState[];
  maxPlayers: number;
  finishProgress: number;
  finishOrder: string[]; // ordered playerIds who finished
  dirtyProgress: boolean; // broadcast throttle flag
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
};

export type PlayerState = {
  playerId: string; // = sessionPlayerId from client
  connectionId?: string; // runtime socket id, managed by gateway
  name: string;
  isConnected: boolean;
  isReady: boolean;
  progress: number;
  tapCount: number;
  finishOrder?: number; // 1-indexed finish position
  finishedAtMs?: number; // server timestamp when finished
  joinedAt: number;
};

// ============================================================
// Output Contracts (what FE receives — no internal fields leak)
// ============================================================

export type PlayerView = {
  playerId: string;
  name: string;
  isConnected: boolean;
  isReady: boolean;
  progress: number;
  tapCount: number;
};

export type RoomView = {
  roomId: string;
  gameType: "tap-race";
  status: RoomStatus;
  hostPlayerId: string;
  players: PlayerView[];
  maxPlayers: number;
  finishProgress: number;
};

export type RacePlayerView = {
  playerId: string;
  name: string;
  progress: number;
  tapCount: number;
  finishOrder?: number;
  isConnected: boolean;
};

// ============================================================
// Client → Server Events
// ============================================================

export type ClientEvent =
  | { type: "room.create"; payload: { sessionPlayerId: string; name: string; maxPlayers?: number } }
  | { type: "room.join"; payload: { sessionPlayerId: string; roomId: string; name: string } }
  | { type: "room.ready"; payload: { roomId: string; isReady: boolean } }
  | { type: "room.start"; payload: { roomId: string } }
  | { type: "race.tap"; payload: { roomId: string; clientTs?: number } }
  | { type: "room.leave"; payload: { roomId: string } };

// ============================================================
// Server → Client Events
// ============================================================

export type ServerEvent =
  | { type: "room.created"; payload: { roomId: string; playerId: string } }
  | { type: "room.joined"; payload: { roomId: string; playerId: string } }
  | { type: "room.state"; payload: RoomView }
  | { type: "race.countdown"; payload: { value: number } }
  | { type: "race.progress"; payload: { players: RacePlayerView[] } }
  | { type: "race.finished"; payload: { rankings: RacePlayerView[] } }
  | { type: "error"; payload: { code: string; message: string } };

// ============================================================
// Error Codes
// ============================================================

export const ErrorCodes = {
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
} as const;

// ============================================================
// DomainResult — outbox pattern for gateway dispatch
// ============================================================

export type DomainResult = {
  /** Events targeted at a specific player */
  toPlayer?: Array<{ playerId: string; event: ServerEvent }>;
  /** Events broadcast to all players in a room */
  toRoom?: Array<{ roomId: string; event: ServerEvent }>;
  /** Signals that game state changed */
  stateChanged?: boolean;
};

// ============================================================
// View Builders
// ============================================================

export function buildPlayerView(p: PlayerState): PlayerView {
  return {
    playerId: p.playerId,
    name: p.name,
    isConnected: p.isConnected,
    isReady: p.isReady,
    progress: p.progress,
    tapCount: p.tapCount,
  };
}

export function buildRoomView(room: Room): RoomView {
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

export function buildRacePlayerView(p: PlayerState): RacePlayerView {
  return {
    playerId: p.playerId,
    name: p.name,
    progress: p.progress,
    tapCount: p.tapCount,
    finishOrder: p.finishOrder,
    isConnected: p.isConnected,
  };
}
