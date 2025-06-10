import "dotenv/config";
import { parse } from "url";
import { WebSocketServer } from "ws";
import { CONNECTED } from "./messages";
import socketManager, { User } from "./services/SocketManager";

const PORT = Number(process.env.PORT) || 3000;

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("connection", (ws: WebSocket, req) => {
  ws.send(JSON.stringify({ type: CONNECTED }));

  const { query } = parse(req.url || "", true);
  const publicKey = typeof query.publicKey === "string" ? query.publicKey : "";

  const user = new User(ws, publicKey);
  socketManager.addUser(user);
  

  ws.onclose = () => {
    socketManager.removeUser(ws);
  };
});

console.log(`LISTENING ON PORT ${PORT}`);