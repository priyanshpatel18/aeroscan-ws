import "dotenv/config";
import { parse } from "url";
import { WebSocketServer } from "ws";
import { redis } from "./db/redis";
import { CONNECTED, ONLINE_USERS } from "./messages";
import socketManager, { MessageData, User, Worker } from "./services/SocketManager";

const PORT = Number(process.env.PORT) || 3000;

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

let broadcastTimeout: NodeJS.Timeout | null = null;
const BROADCAST_DEBOUNCE = 100;

function scheduleUserCountBroadcast() {
  if (!broadcastTimeout) {
    broadcastTimeout = setTimeout(() => {
      const onlineCount = socketManager.getUserCount();
      const message: MessageData = {
        type: ONLINE_USERS,
        payload: {
          count: onlineCount,
          timestamp: Date.now()
        }
      };

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });

      broadcastTimeout = null;
    }, BROADCAST_DEBOUNCE);
  }
}

// ====================
// 🧪 Redis Event Logs
// ====================
redis.on("connect", () => console.log("🔌 Redis connected"));
redis.on("ready", () => console.log("🚀 Redis ready"));
redis.on("error", (err) => console.error("🔥 Redis error:", err));
redis.on("close", () => console.warn("🔒 Redis connection closed"));
redis.on("reconnecting", () => console.info("♻️ Redis reconnecting..."));

wss.on("connection", (ws: WebSocket, req) => {
  ws.send(JSON.stringify({
    type: CONNECTED,
    initialCount: socketManager.getUserCount() + 1
  }));

  const { query } = parse(req.url || "", true);
  const publicKey = typeof query.publicKey === "string" ? query.publicKey : "";
  const token = typeof query.token === "string" ? query.token : "";

  if (token === process.env.WORKER_TOKEN) {
    const worker = new Worker(ws, token);
    socketManager.addWorker(worker);
  } else if (publicKey) {
    const user = new User(ws, publicKey);
    socketManager.addUser(user);
    scheduleUserCountBroadcast();
  }


  ws.onclose = () => {
    socketManager.removeUser(ws);
    scheduleUserCountBroadcast();
  };
});

console.log(`LISTENING ON PORT ${PORT}`);
