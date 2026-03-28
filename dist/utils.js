"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRoomId = generateRoomId;
exports.generateConnectionId = generateConnectionId;
exports.nowMs = nowMs;
const uuid_1 = require("uuid");
const ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
function generateRoomId() {
    let id = "";
    for (let i = 0; i < 6; i++) {
        id += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
    }
    return id;
}
function generateConnectionId() {
    return (0, uuid_1.v4)();
}
function nowMs() {
    return Date.now();
}
//# sourceMappingURL=utils.js.map