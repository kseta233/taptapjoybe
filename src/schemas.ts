import { z } from "zod";

export const RoomCreateSchema = z.object({
  type: z.literal("room.create"),
  payload: z.object({
    sessionPlayerId: z.string().min(1),
    name: z.string().min(1).max(20),
    maxPlayers: z.number().int().min(2).max(4).optional(),
    gameType: z.enum(["tap-race", "tug-war"]).optional(),
  }),
});

export const RoomJoinSchema = z.object({
  type: z.literal("room.join"),
  payload: z.object({
    sessionPlayerId: z.string().min(1),
    roomId: z.string().min(1),
    name: z.string().min(1).max(20),
  }),
});

export const RoomReadySchema = z.object({
  type: z.literal("room.ready"),
  payload: z.object({
    roomId: z.string().min(1),
    isReady: z.boolean(),
  }),
});

export const RoomStartSchema = z.object({
  type: z.literal("room.start"),
  payload: z.object({
    roomId: z.string().min(1),
  }),
});

export const RaceTapSchema = z.object({
  type: z.literal("race.tap"),
  payload: z.object({
    roomId: z.string().min(1),
    clientTs: z.number().optional(),
  }),
});

export const TugTapSchema = z.object({
  type: z.literal("tug.tap"),
  payload: z.object({
    roomId: z.string().min(1),
    clientTs: z.number().optional(),
  }),
});

export const RoomLeaveSchema = z.object({
  type: z.literal("room.leave"),
  payload: z.object({
    roomId: z.string().min(1),
  }),
});

export const RoomListSchema = z.object({
  type: z.literal("room.list"),
  payload: z.object({
    gameType: z.enum(["tap-race", "tug-war"]),
  }),
});

export const ClientEventSchema = z.discriminatedUnion("type", [
  RoomCreateSchema,
  RoomJoinSchema,
  RoomReadySchema,
  RoomStartSchema,
  RaceTapSchema,
  TugTapSchema,
  RoomLeaveSchema,
  RoomListSchema,
]);

export type ValidatedClientEvent = z.infer<typeof ClientEventSchema>;
