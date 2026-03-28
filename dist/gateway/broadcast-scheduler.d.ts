import type { ITransport } from "../transport/interfaces.js";
/**
 * Global broadcast scheduler.
 * Runs a single 100ms interval, iterates racing rooms with dirty progress,
 * broadcasts progress updates, and clears the dirty flag.
 */
export declare class BroadcastScheduler {
    private interval;
    private transport;
    constructor(transport: ITransport);
    start(): void;
    stop(): void;
    private tick;
}
//# sourceMappingURL=broadcast-scheduler.d.ts.map