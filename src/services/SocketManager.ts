import { MessageType } from "../messages";
import { updateReading } from "../utils/solanaClient";

export class User {
  public socket: WebSocket;
  public lastActive: number;
  public isMicrocontroller: boolean;
  public heartbeatInterval?: NodeJS.Timeout;

  constructor(socket: WebSocket, isMicrocontroller: boolean) {
    this.socket = socket;
    this.lastActive = Date.now();
    this.isMicrocontroller = isMicrocontroller;
  }
}

interface AQIBreakpoint {
  concentrationLow: number;
  concentrationHigh: number;
  indexLow: number;
  indexHigh: number;
}

const pm25Breakpoints: AQIBreakpoint[] = [
  { concentrationLow: 0, concentrationHigh: 12, indexLow: 0, indexHigh: 50 },
  { concentrationLow: 12.1, concentrationHigh: 35.4, indexLow: 51, indexHigh: 100 },
  { concentrationLow: 35.5, concentrationHigh: 55.4, indexLow: 101, indexHigh: 150 },
  { concentrationLow: 55.5, concentrationHigh: 150.4, indexLow: 151, indexHigh: 200 },
  { concentrationLow: 150.5, concentrationHigh: 250.4, indexLow: 201, indexHigh: 300 },
  { concentrationLow: 250.5, concentrationHigh: 350.4, indexLow: 301, indexHigh: 400 },
  { concentrationLow: 350.5, concentrationHigh: 500.4, indexLow: 401, indexHigh: 500 }
];

const pm10Breakpoints: AQIBreakpoint[] = [
  { concentrationLow: 0, concentrationHigh: 54, indexLow: 0, indexHigh: 50 },
  { concentrationLow: 55, concentrationHigh: 154, indexLow: 51, indexHigh: 100 },
  { concentrationLow: 155, concentrationHigh: 254, indexLow: 101, indexHigh: 150 },
  { concentrationLow: 255, concentrationHigh: 354, indexLow: 151, indexHigh: 200 },
  { concentrationLow: 355, concentrationHigh: 424, indexLow: 201, indexHigh: 300 },
  { concentrationLow: 425, concentrationHigh: 504, indexLow: 301, indexHigh: 400 },
  { concentrationLow: 505, concentrationHigh: 604, indexLow: 401, indexHigh: 500 }
];

export interface MessageData {
  type: MessageType;
  payload?: any;
}

interface Reading {
  timestamp: number;
  temperature: number;
  humidity: number;
  pm25: number;
  pm10: number;
  aqi: number;
}

class SocketManager {
  public users: User[] = [];
  public static instance: SocketManager;
  public history: Reading[] = [];
  public readonly HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000; // 24h

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  async addUser(user: User) {
    this.users.push(user);

    user.heartbeatInterval = setInterval(() => {
      if (user.socket.readyState === user.socket.OPEN) {
        user.socket.send(JSON.stringify({ type: MessageType.HEARTBEAT }));
      }
    }, 5000);

    this.userHandler(user);
  }

  removeUser(userSocket: WebSocket) {
    this.users = this.users.filter((u) => {
      if (u.socket === userSocket) {
        if (u.heartbeatInterval) clearInterval(u.heartbeatInterval);
        return false;
      }
      return true;
    });
  }

  private userHandler(user: User) {
    user.socket.onmessage = async (message: MessageEvent) => {
      const data: MessageData = JSON.parse(message.data as string);

      switch (data.type) {
        case MessageType.CONNECTED:
          user.socket.send(
            JSON.stringify({ type: MessageType.WELCOME, payload: "Welcome to aeroscan!!" })
          )
          break;
        case MessageType.HEARTBEAT:
          user.lastActive = Date.now();
          break;
        case MessageType.UPDATE_DATA:
          if (!user.isMicrocontroller) {
            console.warn("UPDATE_DATA received from a non-microcontroller user.");
            return;
          }

          try {
            const { temperature, humidity, pm25, pm10 } = data.payload;

            // function calculateSubIndex(concentration: number, breakpoints: AQIBreakpoint[]): number {
            //   const bp = breakpoints.find(b => concentration >= b.concentrationLow && concentration <= b.concentrationHigh);
            //   if (!bp) return 500;
            //   const { concentrationLow, concentrationHigh, indexLow, indexHigh } = bp;
            //   return Math.round(((indexHigh - indexLow) / (concentrationHigh - concentrationLow)) * (concentration - concentrationLow) + indexLow);
            // }

            // const aqiPm25 = calculateSubIndex(pm25, pm25Breakpoints);
            // const aqiPm10 = calculateSubIndex(pm10, pm10Breakpoints);

            // const aqi = Math.max(aqiPm25, aqiPm10);

            // TODO: Add pm25, pm10, and aqi
            updateReading(0, 0, temperature, humidity, 0);
          } catch (err) {
            console.error("Error handling UPDATE_DATA:", err);
          }
          break;
        default:
          console.warn(`Received unknown message type: ${data.type}`);
          break;
      }
    };

    user.socket.onclose = () => {
      this.removeUser(user.socket);
      console.log("User disconnected");
    };
  }
}

export default SocketManager.getInstance();
