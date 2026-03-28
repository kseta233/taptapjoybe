"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsTransport = void 0;
const ws_1 = require("ws");
const config_js_1 = require("../config.js");
const schemas_js_1 = require("../schemas.js");
const types_js_1 = require("../types.js");
const utils_js_1 = require("../utils.js");
/**
 * Raw WebSocket transport adapter.
 * Handles: JSON parse, Zod validation, heartbeat, stale cleanup, dead socket protection.
 * Zero game logic here.
 */
class WsTransport {
    wss;
    connections = new Map();
    heartbeatInterval = null;
    gateway = null;
    constructor(server) {
        this.wss = new ws_1.WebSocketServer({ server });
    }
    /** Attach the gateway handler and start listening */
    start(gateway) {
        this.gateway = gateway;
        this.wss.on("connection", (socket, _req) => {
            const connectionId = (0, utils_js_1.generateConnectionId)();
            const meta = { connectionId, isAlive: true, socket };
            this.connections.set(connectionId, meta);
            // Heartbeat pong handler
            socket.on("pong", () => {
                meta.isAlive = true;
            });
            // Message handler
            socket.on("message", (data) => {
                try {
                    const raw = JSON.parse(data.toString());
                    const result = schemas_js_1.ClientEventSchema.safeParse(raw);
                    if (!result.success) {
                        this.send(connectionId, {
                            type: "error",
                            payload: {
                                code: types_js_1.ErrorCodes.INVALID_MESSAGE,
                                message: "Invalid message format",
                            },
                        });
                        return;
                    }
                    this.gateway?.onMessage(connectionId, result.data);
                }
                catch {
                    this.send(connectionId, {
                        type: "error",
                        payload: {
                            code: types_js_1.ErrorCodes.INVALID_MESSAGE,
                            message: "Failed to parse JSON",
                        },
                    });
                }
            });
            // Close handler
            socket.on("close", () => {
                this.connections.delete(connectionId);
                this.gateway?.onDisconnect(connectionId);
            });
            // Error handler
            socket.on("error", () => {
                this.connections.delete(connectionId);
                this.gateway?.onDisconnect(connectionId);
            });
            // Notify gateway
            this.gateway?.onConnect(connectionId);
        });
        // Start heartbeat
        this.startHeartbeat();
        console.log("[WsTransport] WebSocket server started");
    }
    send(connectionId, event) {
        const meta = this.connections.get(connectionId);
        if (!meta || meta.socket.readyState !== ws_1.WebSocket.OPEN)
            return;
        try {
            meta.socket.send(JSON.stringify(event));
        }
        catch {
            // Silent fail — socket may have closed between check and send
        }
    }
    broadcast(connectionIds, event) {
        const payload = JSON.stringify(event);
        for (const id of connectionIds) {
            const meta = this.connections.get(id);
            if (meta && meta.socket.readyState === ws_1.WebSocket.OPEN) {
                try {
                    meta.socket.send(payload);
                }
                catch {
                    // Silent fail
                }
            }
        }
    }
    isConnected(connectionId) {
        const meta = this.connections.get(connectionId);
        return meta !== undefined && meta.socket.readyState === ws_1.WebSocket.OPEN;
    }
    close(connectionId) {
        const meta = this.connections.get(connectionId);
        if (meta) {
            meta.socket.terminate();
            this.connections.delete(connectionId);
        }
    }
    /** Graceful shutdown */
    shutdown() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        for (const [, meta] of this.connections) {
            meta.socket.close(1001, "Server shutting down");
        }
        this.connections.clear();
        this.wss.close();
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            for (const [connectionId, meta] of this.connections) {
                if (!meta.isAlive) {
                    // No pong received since last ping — connection is dead
                    console.log(`[WsTransport] Terminating stale connection: ${connectionId}`);
                    meta.socket.terminate();
                    this.connections.delete(connectionId);
                    this.gateway?.onDisconnect(connectionId);
                    continue;
                }
                meta.isAlive = false;
                meta.socket.ping();
            }
        }, config_js_1.GAME_CONFIG.HEARTBEAT_INTERVAL_MS);
    }
}
exports.WsTransport = WsTransport;
//# sourceMappingURL=ws-transport.js.map