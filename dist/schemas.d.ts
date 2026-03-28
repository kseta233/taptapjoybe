import { z } from "zod";
export declare const RoomCreateSchema: z.ZodObject<{
    type: z.ZodLiteral<"room.create">;
    payload: z.ZodObject<{
        sessionPlayerId: z.ZodString;
        name: z.ZodString;
        maxPlayers: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        sessionPlayerId: string;
        name: string;
        maxPlayers?: number | undefined;
    }, {
        sessionPlayerId: string;
        name: string;
        maxPlayers?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.create";
    payload: {
        sessionPlayerId: string;
        name: string;
        maxPlayers?: number | undefined;
    };
}, {
    type: "room.create";
    payload: {
        sessionPlayerId: string;
        name: string;
        maxPlayers?: number | undefined;
    };
}>;
export declare const RoomJoinSchema: z.ZodObject<{
    type: z.ZodLiteral<"room.join">;
    payload: z.ZodObject<{
        sessionPlayerId: z.ZodString;
        roomId: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sessionPlayerId: string;
        name: string;
        roomId: string;
    }, {
        sessionPlayerId: string;
        name: string;
        roomId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.join";
    payload: {
        sessionPlayerId: string;
        name: string;
        roomId: string;
    };
}, {
    type: "room.join";
    payload: {
        sessionPlayerId: string;
        name: string;
        roomId: string;
    };
}>;
export declare const RoomReadySchema: z.ZodObject<{
    type: z.ZodLiteral<"room.ready">;
    payload: z.ZodObject<{
        roomId: z.ZodString;
        isReady: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        roomId: string;
        isReady: boolean;
    }, {
        roomId: string;
        isReady: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.ready";
    payload: {
        roomId: string;
        isReady: boolean;
    };
}, {
    type: "room.ready";
    payload: {
        roomId: string;
        isReady: boolean;
    };
}>;
export declare const RoomStartSchema: z.ZodObject<{
    type: z.ZodLiteral<"room.start">;
    payload: z.ZodObject<{
        roomId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        roomId: string;
    }, {
        roomId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.start";
    payload: {
        roomId: string;
    };
}, {
    type: "room.start";
    payload: {
        roomId: string;
    };
}>;
export declare const RaceTapSchema: z.ZodObject<{
    type: z.ZodLiteral<"race.tap">;
    payload: z.ZodObject<{
        roomId: z.ZodString;
        clientTs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        roomId: string;
        clientTs?: number | undefined;
    }, {
        roomId: string;
        clientTs?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "race.tap";
    payload: {
        roomId: string;
        clientTs?: number | undefined;
    };
}, {
    type: "race.tap";
    payload: {
        roomId: string;
        clientTs?: number | undefined;
    };
}>;
export declare const RoomLeaveSchema: z.ZodObject<{
    type: z.ZodLiteral<"room.leave">;
    payload: z.ZodObject<{
        roomId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        roomId: string;
    }, {
        roomId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.leave";
    payload: {
        roomId: string;
    };
}, {
    type: "room.leave";
    payload: {
        roomId: string;
    };
}>;
export declare const ClientEventSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"room.create">;
    payload: z.ZodObject<{
        sessionPlayerId: z.ZodString;
        name: z.ZodString;
        maxPlayers: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        sessionPlayerId: string;
        name: string;
        maxPlayers?: number | undefined;
    }, {
        sessionPlayerId: string;
        name: string;
        maxPlayers?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.create";
    payload: {
        sessionPlayerId: string;
        name: string;
        maxPlayers?: number | undefined;
    };
}, {
    type: "room.create";
    payload: {
        sessionPlayerId: string;
        name: string;
        maxPlayers?: number | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"room.join">;
    payload: z.ZodObject<{
        sessionPlayerId: z.ZodString;
        roomId: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sessionPlayerId: string;
        name: string;
        roomId: string;
    }, {
        sessionPlayerId: string;
        name: string;
        roomId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.join";
    payload: {
        sessionPlayerId: string;
        name: string;
        roomId: string;
    };
}, {
    type: "room.join";
    payload: {
        sessionPlayerId: string;
        name: string;
        roomId: string;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"room.ready">;
    payload: z.ZodObject<{
        roomId: z.ZodString;
        isReady: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        roomId: string;
        isReady: boolean;
    }, {
        roomId: string;
        isReady: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.ready";
    payload: {
        roomId: string;
        isReady: boolean;
    };
}, {
    type: "room.ready";
    payload: {
        roomId: string;
        isReady: boolean;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"room.start">;
    payload: z.ZodObject<{
        roomId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        roomId: string;
    }, {
        roomId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.start";
    payload: {
        roomId: string;
    };
}, {
    type: "room.start";
    payload: {
        roomId: string;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"race.tap">;
    payload: z.ZodObject<{
        roomId: z.ZodString;
        clientTs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        roomId: string;
        clientTs?: number | undefined;
    }, {
        roomId: string;
        clientTs?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "race.tap";
    payload: {
        roomId: string;
        clientTs?: number | undefined;
    };
}, {
    type: "race.tap";
    payload: {
        roomId: string;
        clientTs?: number | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"room.leave">;
    payload: z.ZodObject<{
        roomId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        roomId: string;
    }, {
        roomId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "room.leave";
    payload: {
        roomId: string;
    };
}, {
    type: "room.leave";
    payload: {
        roomId: string;
    };
}>]>;
export type ValidatedClientEvent = z.infer<typeof ClientEventSchema>;
//# sourceMappingURL=schemas.d.ts.map