import { GAME_CONFIG } from "../config.js";
import type { Room, DomainResult } from "../types.js";
import { ErrorCodes, buildRoomView, buildRacePlayerView } from "../types.js";
import { getRoom } from "./room-service.js";
import { antiCheat } from "./anti-cheat.js";
import { nowMs } from "../utils.js";

// Timers stored outside Room to keep domain model serializable
const countdownTimers = new Map<string, NodeJS.Timeout>();
const graceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Start the countdown sequence for a room.
 * Works for both tap-race and tug-war.
 */
export function startCountdown(
  roomId: string,
  onTick: (roomId: string, value: number) => void,
  onComplete: (roomId: string) => void
): DomainResult {
  const room = getRoom(roomId);
  if (!room) return errorToPlayer("", ErrorCodes.ROOM_NOT_FOUND, "Room not found");

  room.status = "countdown";

  let count = GAME_CONFIG.COUNTDOWN_SECONDS;

  // Send initial countdown value immediately
  onTick(roomId, count);

  const timer = setInterval(() => {
    count--;

    if (count > 0) {
      onTick(roomId, count);
    } else {
      // Countdown complete
      clearInterval(timer);
      countdownTimers.delete(roomId);

      onTick(roomId, 0); // "GO!"
      onComplete(roomId);
    }
  }, 1000);

  countdownTimers.set(roomId, timer);

  return {
    toRoom: [{ roomId, event: { type: "room.state", payload: buildRoomView(room) } }],
    stateChanged: true,
  };
}

/**
 * Cancel an active countdown (e.g., host disconnect during countdown).
 */
export function cancelCountdown(roomId: string): void {
  const timer = countdownTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    countdownTimers.delete(roomId);
  }
}

/**
 * Transition room to playing state (tap-race).
 */
export function startRacing(roomId: string): DomainResult {
  const room = getRoom(roomId);
  if (!room) return {};

  room.status = "playing";
  room.startedAt = nowMs();

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
    toRoom: [{ roomId, event: { type: "room.state", payload: buildRoomView(room) } }],
    stateChanged: true,
  };
}

/**
 * Handle a tap from a player.
 * Returns empty result on rate-limit (silent ignore) or error on invalid state.
 */
export function handleTap(roomId: string, playerId: string): DomainResult {
  const room = getRoom(roomId);
  if (!room) return errorToPlayer(playerId, ErrorCodes.ROOM_NOT_FOUND, "Room not found");

  if (room.status !== "playing") {
    return errorToPlayer(playerId, ErrorCodes.TAP_NOT_ALLOWED, "Race not active");
  }

  const player = room.players.find((p) => p.playerId === playerId);
  if (!player || !player.isConnected) {
    return errorToPlayer(playerId, ErrorCodes.TAP_NOT_ALLOWED, "Not a valid player");
  }

  // Already finished
  if (player.finishOrder !== undefined) {
    return {}; // Silent ignore
  }

  const now = nowMs();

  // Rate limit check
  if (!antiCheat.checkTap(playerId, now)) {
    return {}; // Silent ignore — over rate limit
  }

  // Accept tap
  player.progress += GAME_CONFIG.PROGRESS_PER_TAP;
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
    if (raceResult) return raceResult;

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
function checkRaceEnd(room: Room): DomainResult | null {
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
function startGracePeriod(roomId: string): void {
  // Clear any existing grace timer
  const existing = graceTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    graceTimers.delete(roomId);
    const room = getRoom(roomId);
    if (room && room.status === "playing") {
      const result = finishRace(room);
      // We need a way to dispatch this — use the onGraceExpired callback
      if (onGraceExpiredCallback) {
        onGraceExpiredCallback(roomId, result);
      }
    }
  }, GAME_CONFIG.RACE_GRACE_PERIOD_MS);

  graceTimers.set(roomId, timer);
}

// Callback for grace period expiration — set by gateway
let onGraceExpiredCallback: ((roomId: string, result: DomainResult) => void) | null = null;

export function setOnGraceExpired(cb: (roomId: string, result: DomainResult) => void): void {
  onGraceExpiredCallback = cb;
}

/**
 * Finish the race — calculate rankings, freeze game.
 */
function finishRace(room: Room): DomainResult {
  room.status = "finished";
  room.finishedAt = nowMs();
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
    .sort((a, b) => a.finishOrder! - b.finishOrder!);

  const unfinished = room.players
    .filter((p) => p.finishOrder === undefined)
    .sort((a, b) => b.progress - a.progress);

  // Assign finish order to unfinished players
  let order = finished.length + 1;
  for (const p of unfinished) {
    p.finishOrder = order++;
  }

  const rankings = [...finished, ...unfinished].map(buildRacePlayerView);

  // Clean up anti-cheat data
  antiCheat.clearRoom(room.players.map((p) => p.playerId));

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
export function cleanupRoomTimers(roomId: string): void {
  cancelCountdown(roomId);
  const graceTimer = graceTimers.get(roomId);
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimers.delete(roomId);
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
