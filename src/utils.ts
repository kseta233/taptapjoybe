import { v4 as uuidv4 } from "uuid";

const ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion

export function generateRoomId(): string {
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
  }
  return id;
}

export function generateConnectionId(): string {
  return uuidv4();
}

export function nowMs(): number {
  return Date.now();
}
