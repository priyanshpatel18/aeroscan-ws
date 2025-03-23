import "dotenv/config";
import cron from "node-cron";
import { WebSocket, WebSocketServer } from "ws";
import { calculateStatistics } from "./lib/calculateStats";
import { SensorData } from "./types";
import { CREATE_TRANSACTION, INITIAL_DATA, SENSOR_DATA, USER_AUTH } from "./types/message";
import { getUserSubscribedSensors } from "./db";

const PORT = Number(process.env.PORT) || 5555;
const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

const sensorReadings: SensorData[] = [];
let dailyStats: ReturnType<typeof calculateStatistics> | null = null;

interface SensorUserMapping {
  sensorId: string;
  email: string;
}

// Track client connections
interface CustomWebSocket extends WebSocket {
  isESP32?: boolean;
  userId?: string;
  email?: string;
  subscribedSensors?: string[];
}

// Cache of sensor-to-users mapping
// This avoids querying the database on every transaction
const sensorUserCache: Record<string, Set<string>> = {};

// Update sensor-user cache every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  console.log("⏳ Updating sensor-user mapping cache...");
  try {
    // This would be your function to get all sensor-user mappings
    const mappings = await getAllSensorUserMappings();

    // Reset the cache
    for (const sensorId in sensorUserCache) {
      sensorUserCache[sensorId] = new Set();
    }

    // Update cache with fresh mappings
    mappings.forEach(mapping => {
      if (!sensorUserCache[mapping.sensorId]) {
        sensorUserCache[mapping.sensorId] = new Set();
      }
      sensorUserCache[mapping.sensorId].add(mapping.email);
    });

    console.log("✅ Sensor-user cache updated");
  } catch (err) {
    console.error("❌ Failed to update sensor-user cache:", err);
  }
});

// Calculate daily stats at midnight
cron.schedule("0 0 * * *", () => {
  console.log("⏳ Running daily statistics calculation...");
  dailyStats = calculateStatistics(sensorReadings);
  console.log("✅ Daily stats updated");
});

wss.on("connection", async (ws: CustomWebSocket, req) => {
  console.log(`🟢 New WebSocket Connection from: ${req.socket.remoteAddress}`);

  // Initialize as unknown client type
  ws.isESP32 = false;

  ws.send(
    JSON.stringify({
      type: INITIAL_DATA,
      data: sensorReadings.slice(-100), // Send latest 100 readings
      stats: dailyStats || calculateStatistics(sensorReadings),
    })
  );

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Handle user authentication
      if (data.type === USER_AUTH) {
        const { userId, email } = data;
        console.log(data);


        if (email) {
          ws.email = email;

          try {
            ws.subscribedSensors = await getUserSubscribedSensors(email);
            console.log(`👤 User ${email} authenticated with ${ws.subscribedSensors?.length} subscribed sensors`);
          } catch (err) {
            console.error(`❌ Failed to get subscribed sensors for user ${userId}:`, err);
          }


          ws.send(JSON.stringify({
            type: USER_AUTH,
            success: true,
            message: "Authentication successful"
          }));
        }
      }

      // Handle ESP32 device messages
      if (data.type === SENSOR_DATA || data.type === CREATE_TRANSACTION) {
        // Mark as ESP32 client
        ws.isESP32 = true;

        if (data.type === SENSOR_DATA) {
          const reading: SensorData = {
            ...data.data,
            timestamp: Date.now(),
            sensorId: data.data.sensorId || "aeroscan-s1"
          };

          // Process sensor data as before...
          const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
          while (sensorReadings.length > 0 && sensorReadings[0].timestamp < cutoffTime) {
            sensorReadings.shift();
          }
          sensorReadings.push(reading);
          dailyStats = calculateStatistics(sensorReadings);

          // Broadcast to web clients (not ESP32)
          wss.clients.forEach((client: CustomWebSocket) => {
            if (client.readyState === WebSocket.OPEN && !client.isESP32) {
              client.send(
                JSON.stringify({ type: SENSOR_DATA, data: reading, stats: dailyStats })
              );
            }
          });
        }

        // Process transactions - this is where we route to specific users
        if (data.type === CREATE_TRANSACTION) {
          const { sensorId } = data.data;
          console.log(`📊 Received transaction from sensor: ${sensorId}`);

          // Find all clients subscribed to this sensor
          let subscribedClientCount = 0;
          wss.clients.forEach((client: CustomWebSocket) => {
            // Check if this client should receive data from this sensor
            const isSubscribed =
              client.readyState === WebSocket.OPEN &&
              !client.isESP32 &&
              client.subscribedSensors?.includes(sensorId);

            if (isSubscribed) {
              subscribedClientCount++;
              client.send(JSON.stringify({
                type: CREATE_TRANSACTION,
                data: data.data
              }));
            }
          });

          console.log(`📨 Transaction sent to ${subscribedClientCount} subscribed clients`);
        }
      }
    } catch (err) {
      console.error("❌ Error processing message:", err);
    }
  });

  ws.on("close", () => {
    console.log("🔴 WebSocket Disconnected");
  });
});

// Placeholder function - implement with your actual database query
async function getAllSensorUserMappings(): Promise<SensorUserMapping[]> {
  // This should return an array of { sensorId, userId } mappings
  return [];
}

console.log(`🚀 WebSocket Server Running on PORT ${PORT}`);