"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const config_js_1 = require("./config.js");
const ws_transport_js_1 = require("./transport/ws-transport.js");
const game_gateway_js_1 = require("./gateway/game-gateway.js");
const broadcast_scheduler_js_1 = require("./gateway/broadcast-scheduler.js");
const room_cleanup_js_1 = require("./domain/room-cleanup.js");
// Create HTTP server with health check
const server = (0, http_1.createServer)((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
        return;
    }
    res.writeHead(404);
    res.end("Not found");
});
// Create transport layer
const transport = new ws_transport_js_1.WsTransport(server);
// Create gateway
const gateway = new game_gateway_js_1.GameGateway(transport);
// Create broadcast scheduler
const broadcastScheduler = new broadcast_scheduler_js_1.BroadcastScheduler(transport);
// Wire everything together
transport.start(gateway);
broadcastScheduler.start();
room_cleanup_js_1.roomCleanup.start();
// Start listening
server.listen(config_js_1.GAME_CONFIG.PORT, "127.0.0.1", () => {
    console.log(`[TapTapJoy] Server running on port ${config_js_1.GAME_CONFIG.PORT}`);
    console.log(`[TapTapJoy] Health check: http://localhost:${config_js_1.GAME_CONFIG.PORT}/health`);
    console.log(`[TapTapJoy] WebSocket: ws://localhost:${config_js_1.GAME_CONFIG.PORT}`);
});
// Graceful shutdown
function shutdown() {
    console.log("\n[TapTapJoy] Shutting down...");
    broadcastScheduler.stop();
    room_cleanup_js_1.roomCleanup.stop();
    transport.shutdown();
    server.close(() => {
        console.log("[TapTapJoy] Server closed");
        process.exit(0);
    });
    // Force exit after 5 seconds
    setTimeout(() => {
        console.log("[TapTapJoy] Forced exit");
        process.exit(1);
    }, 5000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
//# sourceMappingURL=index.js.map