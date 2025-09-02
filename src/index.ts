import cors from "cors";
import "dotenv/config";
import express from "express";
import { parse } from "url";
import { WebSocketServer } from "ws";
import SocketManager, { User } from "./services/SocketManager";
import { subscribeToEvents } from "./utils/solanaClient";

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(cors());
app.use(express.json());

app.post("/", (_req, res) => {
  res.sendStatus(200);
});

async function main() {
  // 1. Subscribe to Solana program events
  await subscribeToEvents();

  // 2. Start Express + WebSocket server
  const server = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket, req) => {
    const { query } = parse(req.url || "", true);
    const token = typeof query.token === "string" ? query.token : "";
    console.log("Client token:", token);

    const user = new User(ws, token === process.env.MC_TOKEN);
    SocketManager.addUser(user);

    ws.onclose = () => { SocketManager.removeUser(ws); };
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
