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
    finishOrder: string[];
    dirtyProgress: boolean;
    createdAt: number;
    startedAt?: number;
    finishedAt?: number;
    tugState?: TugWarState;
};
export type PlayerState = {
    playerId: string;
    connectionId?: string;
    name: string;
    isConnected: boolean;
    isReady: boolean;
    progress: number;
    tapCount: number;
    finishOrder?: number;
    finishedAtMs?: number;
    joinedAt: number;
    team?: "left" | "right";
};
export type TugWarState = {
    ropePosition: number;
    leftForce: number;
    rightForce: number;
    timeLeftMs: number;
    leftTeam: string[];
    rightTeam: string[];
    leftTotalTaps: number;
    rightTotalTaps: number;
    winnerTeam?: "left" | "right" | "draw";
};
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
export type ClientEvent = {
    type: "room.create";
    payload: {
        sessionPlayerId: string;
        name: string;
        maxPlayers?: number;
        gameType?: GameType;
    };
} | {
    type: "room.join";
    payload: {
        sessionPlayerId: string;
        roomId: string;
        name: string;
    };
} | {
    type: "room.ready";
    payload: {
        roomId: string;
        isReady: boolean;
    };
} | {
    type: "room.start";
    payload: {
        roomId: string;
    };
} | {
    type: "room.leave";
    payload: {
        roomId: string;
    };
} | {
    type: "room.list";
    payload: {
        gameType: GameType;
    };
} | {
    type: "race.tap";
    payload: {
        roomId: string;
        clientTs?: number;
    };
} | {
    type: "tug.tap";
    payload: {
        roomId: string;
        clientTs?: number;
    };
};
export type ServerEvent = {
    type: "room.created";
    payload: {
        roomId: string;
        playerId: string;
    };
} | {
    type: "room.joined";
    payload: {
        roomId: string;
        playerId: string;
    };
} | {
    type: "room.state";
    payload: RoomView;
} | {
    type: "room.listResult";
    payload: {
        rooms: RoomListItem[];
    };
} | {
    type: "game.countdown";
    payload: {
        value: number;
    };
} | {
    type: "race.progress";
    payload: {
        players: RacePlayerView[];
    };
} | {
    type: "race.finished";
    payload: {
        rankings: RacePlayerView[];
    };
} | {
    type: "tug.state";
    payload: TugStateView;
} | {
    type: "tug.finished";
    payload: TugResultView;
} | {
    type: "error";
    payload: {
        code: string;
        message: string;
    };
};
export declare const ErrorCodes: {
    readonly ROOM_NOT_FOUND: "ROOM_NOT_FOUND";
    readonly ROOM_FULL: "ROOM_FULL";
    readonly ROOM_ALREADY_STARTED: "ROOM_ALREADY_STARTED";
    readonly PLAYER_ALREADY_IN_ROOM: "PLAYER_ALREADY_IN_ROOM";
    readonly PLAYER_ACTIVE_IN_OTHER_ROOM: "PLAYER_ACTIVE_IN_OTHER_ROOM";
    readonly NOT_HOST: "NOT_HOST";
    readonly NOT_ALL_READY: "NOT_ALL_READY";
    readonly NOT_ENOUGH_PLAYERS: "NOT_ENOUGH_PLAYERS";
    readonly TAP_NOT_ALLOWED: "TAP_NOT_ALLOWED";
    readonly INVALID_MESSAGE: "INVALID_MESSAGE";
};
export type DomainResult = {
    /** Events targeted at a specific player */
    toPlayer?: Array<{
        playerId: string;
        event: ServerEvent;
    }>;
    /** Events broadcast to all players in a room */
    toRoom?: Array<{
        roomId: string;
        event: ServerEvent;
    }>;
    /** Signals that game state changed */
    stateChanged?: boolean;
};
export declare function buildPlayerView(p: PlayerState): PlayerView;
export declare function buildRoomView(room: Room): RoomView;
export declare function buildRacePlayerView(p: PlayerState): RacePlayerView;
export declare function buildRoomListItem(room: Room): RoomListItem;
//# sourceMappingURL=types.d.ts.map