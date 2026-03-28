import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server as HttpServer } from "http";
import { GAME_CONFIG } from "../config.js";
import { ClientEventSchema } from "../schemas.js";
import { ErrorCodes } from "../types.js";
import type { ServerEvent } from "../types.js";
import type { ITransport, IGatewayHandler } from "./interfaces.js";
import { generateConnectionId } from "../utils.js";

interface SocketMeta {
  connectionId: string;
  isAlive: boolean;
  socket: WebSocket;
}

/**
 * Raw WebSocket transport adapter.
 * Handles: JSON parse, Zod validation, heartbeat, stale cleanup, dead socket protection.
 * Zero game logic here.
 */
export class WsTransport implements ITransport {
  private wss: WebSocketServer;
  private connections = new Map<string, SocketMeta>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private gateway: IGatewayHandler | null = null;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
  }

  /** Attach the gateway handler and start listening */
  start(gateway: IGatewayHandler): void {
    this.gateway = gateway;

    this.wss.on("connection", (socket: WebSocket, _req: IncomingMessage) => {
      const connectionId = generateConnectionId();
      const meta: SocketMeta = { connectionId, isAlive: true, socket };
      this.connections.set(connectionId, meta);

      // Heartbeat pong handler
      socket.on("pong", () => {
        meta.isAlive = true;
      });

      // Message handler
      socket.on("message", (data) => {
        try {
          const raw = JSON.parse(data.toString());
          const result = ClientEventSchema.safeParse(raw);

          if (!result.success) {
            this.send(connectionId, {
              type: "error",
              payload: {
                code: ErrorCodes.INVALID_MESSAGE,
                message: "Invalid message format",
              },
            });
            return;
          }

          this.gateway?.onMessage(connectionId, result.data);
        } catch {
          this.send(connectionId, {
            type: "error",
            payload: {
              code: ErrorCodes.INVALID_MESSAGE,
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

  send(connectionId: string, event: ServerEvent): void {
    const meta = this.connections.get(connectionId);
    if (!meta || meta.socket.readyState !== WebSocket.OPEN) return;

    try {
      meta.socket.send(JSON.stringify(event));
    } catch {
      // Silent fail — socket may have closed between check and send
    }
  }

  broadcast(connectionIds: string[], event: ServerEvent): void {
    const payload = JSON.stringify(event);
    for (const id of connectionIds) {
      const meta = this.connections.get(id);
      if (meta && meta.socket.readyState === WebSocket.OPEN) {
        try {
          meta.socket.send(payload);
        } catch {
          // Silent fail
        }
      }
    }
  }

  isConnected(connectionId: string): boolean {
    const meta = this.connections.get(connectionId);
    return meta !== undefined && meta.socket.readyState === WebSocket.OPEN;
  }

  close(connectionId: string): void {
    const meta = this.connections.get(connectionId);
    if (meta) {
      meta.socket.terminate();
      this.connections.delete(connectionId);
    }
  }

  /** Graceful shutdown */
  shutdown(): void {
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

  private startHeartbeat(): void {
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
    }, GAME_CONFIG.HEARTBEAT_INTERVAL_MS);
  }
}
