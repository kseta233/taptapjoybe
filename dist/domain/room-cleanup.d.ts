/**
 * Room cleanup service.
 * Periodically removes stale/finished rooms to prevent memory leaks.
 */
declare class RoomCleanup {
    private interval;
    start(): void;
    stop(): void;
    private sweep;
}
export declare const roomCleanup: RoomCleanup;
export {};
//# sourceMappingURL=room-cleanup.d.ts.map