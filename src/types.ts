// ============================================================
// Domain Models (internal — never sent to client directly)
// ============================================================

export type GameType = "tap-race" | "tug-war";
export type RoomStatus = "waiting" | "countdown" | "playing" | "finished";

export type Room = {
  roomId: string;
  gameType: GameType;
  status: RoomStatus;
  hostPlayerId: string;
  players: PlayerState[];
  maxPlayers: number;
  finishProgress: number;
  finishOrder: string[]; // ordered playerIds who finished (tap-race)
  dirtyProgress: boolean; // broadcast throttle flag
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  tugState?: TugWarState; // only for tug-war rooms
};

export type PlayerState = {
  playerId: string; // = sessionPlayerId from client
  connectionId?: string; // runtime socket id, managed by gateway
  name: string;
  isConnected: boolean;
  isReady: boolean;
  progress: number;
  tapCount: number;
  finishOrder?: number; // 1-indexed finish position (tap-race)
  finishedAtMs?: number; // server timestamp when finished (tap-race)
  joinedAt: number;
  team?: "left" | "right"; // tug-war team assignment
};

// Tug of war physics state
export type TugWarState = {
  ropePosition: number; // -100 to +100
  leftForce: number;
  rightForce: number;
  timeLeftMs: number;
  leftTeam: string[]; // playerIds
  rightTeam: string[];
  leftTotalTaps: number;
  rightTotalTaps: number;
  winnerTeam?: "left" | "right" | "draw";
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
  team?: "left" | "right";
};

export type RoomView = {
  roomId: string;
  gameType: GameType;
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

export type RoomListItem = {
  roomId: string;
  gameType: GameType;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: "waiting";
};

export type TugStateView = {
  ropePosition: number;
  timeLeftMs: number;
  leftForce: number;
  rightForce: number;
};

export type TugResultView = {
  winnerTeam: "left" | "right" | "draw";
  finalRopePosition: number;
  leftTotalTaps: number;
  rightTotalTaps: number;
  players: Array<{
    playerId: string;
    name: string;
    team: "left" | "right";
    tapCount: number;
  }>;
};

// ============================================================
// Client → Server Events
// ============================================================

export type ClientEvent =
  | { type: "room.create"; payload: { sessionPlayerId: string; name: string; maxPlayers?: number; gameType?: GameType } }
  | { type: "room.join"; payload: { sessionPlayerId: string; roomId: string; name: string } }
  | { type: "room.ready"; payload: { roomId: string; isReady: boolean } }
  | { type: "room.start"; payload: { roomId: string } }
  | { type: "room.leave"; payload: { roomId: string } }
  | { type: "room.list"; payload: { gameType: GameType } }
  | { type: "race.tap"; payload: { roomId: string; clientTs?: number } }
  | { type: "tug.tap"; payload: { roomId: string; clientTs?: number } };

// ============================================================
// Server → Client Events
// ============================================================

export type ServerEvent =
  | { type: "room.created"; payload: { roomId: string; playerId: string } }
  | { type: "room.joined"; payload: { roomId: string; playerId: string } }
  | { type: "room.state"; payload: RoomView }
  | { type: "room.listResult"; payload: { rooms: RoomListItem[] } }
  | { type: "game.countdown"; payload: { value: number } }
  | { type: "race.progress"; payload: { players: RacePlayerView[] } }
  | { type: "race.finished"; payload: { rankings: RacePlayerView[] } }
  | { type: "tug.state"; payload: TugStateView }
  | { type: "tug.finished"; payload: TugResultView }
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
    team: p.team,
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

export function buildRoomListItem(room: Room): RoomListItem {
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
