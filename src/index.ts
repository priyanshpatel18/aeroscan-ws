import "dotenv/config";
import { parse } from "url";
import { WebSocketServer } from "ws";
import SocketManager, { User } from "./services/SocketManager";
import { subscribeToEvents } from "./utils/solanaClient";

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  // 1. Subscribe to Solana program events
  await subscribeToEvents();

  // 2. Start WebSocket server
  const wss = new WebSocketServer({ port: PORT });
  console.log(`WebSocket server running on ws://localhost:${PORT}`);

  wss.on("connection", (ws: WebSocket, req) => {
    const { query } = parse(req.url || "", true);
    const token = typeof query.token === "string" ? query.token : "";

    const user = new User(ws, token === process.env.MC_TOKEN);
    SocketManager.addUser(user);
    
    ws.onclose = () => { SocketManager.removeUser(ws); };
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
