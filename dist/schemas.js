"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientEventSchema = exports.RoomListSchema = exports.RoomLeaveSchema = exports.TugTapSchema = exports.RaceTapSchema = exports.RoomStartSchema = exports.RoomReadySchema = exports.RoomJoinSchema = exports.RoomCreateSchema = void 0;
const zod_1 = require("zod");
exports.RoomCreateSchema = zod_1.z.object({
    type: zod_1.z.literal("room.create"),
    payload: zod_1.z.object({
        sessionPlayerId: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1).max(20),
        maxPlayers: zod_1.z.number().int().min(2).max(4).optional(),
        gameType: zod_1.z.enum(["tap-race", "tug-war"]).optional(),
    }),
});
exports.RoomJoinSchema = zod_1.z.object({
    type: zod_1.z.literal("room.join"),
    payload: zod_1.z.object({
        sessionPlayerId: zod_1.z.string().min(1),
        roomId: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1).max(20),
    }),
});
exports.RoomReadySchema = zod_1.z.object({
    type: zod_1.z.literal("room.ready"),
    payload: zod_1.z.object({
        roomId: zod_1.z.string().min(1),
        isReady: zod_1.z.boolean(),
    }),
});
exports.RoomStartSchema = zod_1.z.object({
    type: zod_1.z.literal("room.start"),
    payload: zod_1.z.object({
        roomId: zod_1.z.string().min(1),
    }),
});
exports.RaceTapSchema = zod_1.z.object({
    type: zod_1.z.literal("race.tap"),
    payload: zod_1.z.object({
        roomId: zod_1.z.string().min(1),
        clientTs: zod_1.z.number().optional(),
    }),
});
exports.TugTapSchema = zod_1.z.object({
    type: zod_1.z.literal("tug.tap"),
    payload: zod_1.z.object({
        roomId: zod_1.z.string().min(1),
        clientTs: zod_1.z.number().optional(),
    }),
});
exports.RoomLeaveSchema = zod_1.z.object({
    type: zod_1.z.literal("room.leave"),
    payload: zod_1.z.object({
        roomId: zod_1.z.string().min(1),
    }),
});
exports.RoomListSchema = zod_1.z.object({
    type: zod_1.z.literal("room.list"),
    payload: zod_1.z.object({
        gameType: zod_1.z.enum(["tap-race", "tug-war"]),
    }),
});
exports.ClientEventSchema = zod_1.z.discriminatedUnion("type", [
    exports.RoomCreateSchema,
    exports.RoomJoinSchema,
    exports.RoomReadySchema,
    exports.RoomStartSchema,
    exports.RaceTapSchema,
    exports.TugTapSchema,
    exports.RoomLeaveSchema,
    exports.RoomListSchema,
]);
//# sourceMappingURL=schemas.js.map