import { createServer } from "http";
import { GAME_CONFIG } from "./config.js";
import { WsTransport } from "./transport/ws-transport.js";
import { GameGateway } from "./gateway/game-gateway.js";
import { BroadcastScheduler } from "./gateway/broadcast-scheduler.js";
import { roomCleanup } from "./domain/room-cleanup.js";

// Create HTTP server with health check
const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// Create transport layer
const transport = new WsTransport(server);

// Create gateway
const gateway = new GameGateway(transport);

// Create broadcast scheduler
const broadcastScheduler = new BroadcastScheduler(transport);

// Wire everything together
transport.start(gateway);
broadcastScheduler.start();
roomCleanup.start();

// Start listening
// Start listening
server.listen(GAME_CONFIG.PORT, "0.0.0.0", () => {
  console.log(`[TapTapJoy] Server running on port ${GAME_CONFIG.PORT}`);
  console.log(`[TapTapJoy] Health check: http://localhost:${GAME_CONFIG.PORT}/health`);
  console.log(`[TapTapJoy] WebSocket: ws://localhost:${GAME_CONFIG.PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log("\n[TapTapJoy] Shutting down...");
  broadcastScheduler.stop();
  roomCleanup.stop();
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
