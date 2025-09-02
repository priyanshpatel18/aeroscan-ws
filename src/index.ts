import cors from "cors";
import "dotenv/config";
import express from "express";
import { parse } from "url";
import { WebSocketServer } from "ws";
import SocketManager, { User } from "./services/SocketManager";
import { subscribeToEvents, updateReading } from "./utils/solanaClient";

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.post("/", (_req, res) => {
  res.sendStatus(200);
});

// Fallback API endpoint for sensor data updates
app.post("/api/sensor-data", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') ||
      req.headers['x-api-token'] as string || '';

    if (token !== process.env.MC_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { temperature, humidity, pm25, pm10 } = req.body;

    if (typeof temperature !== 'number' || typeof humidity !== 'number') {
      return res.status(400).json({
        error: "Invalid data format. temperature and humidity are required numbers"
      });
    }

    // Update Solana reading
    // TODO: Add pm25, pm10, and aqi when implemented
    await updateReading(0, 0, temperature, humidity);

    SocketManager.users.forEach((user) => {
      if (user.socket.readyState === user.socket.OPEN) {
        user.socket.send(JSON.stringify({
          type: "UPDATE_DATA", // Using string literal instead of MessageType enum
          payload: {
            temperature,
            humidity,
            // TODO: Add pm25, pm10, and aqi when implemented
            // pm25,
            // pm10,
            // aqi
          }
        }));
      }
    });

    res.status(200).json({
      message: "Sensor data updated successfully",
      data: { temperature, humidity, pm25, pm10 }
    });
  } catch (error) {
    console.error("Error handling fallback API request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
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