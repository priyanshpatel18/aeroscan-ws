import { WebSocketServer } from "ws";
import "dotenv/config";
import { CONNECTED, SENSOR_DATA } from "./types/message";

const PORT = Number(process.env.PORT) || 5555;

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("connection", (ws, req) => {
  console.log(`🟢 New WebSocket Connection from: ${req.socket.remoteAddress}`);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === CONNECTED) {
        ws.send(JSON.stringify({ type: CONNECTED }));
      }

      if (data.type === SENSOR_DATA) {
        console.log("📡 Sensor Data Received:", data);
      }
    } catch (err) {
      console.error("❌ Error parsing JSON:", err);
    }
  });

  ws.on("close", () => {
    console.log("🔴 WebSocket Disconnected");
  });
}
);

console.log(`LISTENING ON PORT ${PORT}`);