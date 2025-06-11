import { redis } from "../db/redis";
import { ValidKeyStroke } from "../helper/ValidKeyStroke";
import { CONNECTED, GAME_ENDED, KEY_PRESSED, KEY_RELEASED, START_GAME, UPDATE_GAME, USER_DISCONNECTED, WAITING, WELCOME } from "../messages";
import { Player } from "../types/gameTypes";
import { pushToQueue, waitingQueue } from "../utils/pushToQueue";

export class User {
  public socket: WebSocket;
  public publicKey: string;
  public lastActive: number;

  constructor(socket: WebSocket, publicKey: string) {
    this.socket = socket;
    this.publicKey = publicKey;
    this.lastActive = Date.now();
  }
}

export class Worker {
  public socket: WebSocket;
  public token: string;

  constructor(socket: WebSocket, token: string) {
    this.socket = socket;
    this.token = token;
  }
}

type MessageType = "CONNECTED" | "WELCOME" | "HEARTBEAT" | "ONLINE_USERS" | "START_GAME" | "UPDATE_GAME" | "WAITING" | "USER_DISCONNECTED" | "KEY_PRESSED" | "KEY_RELEASED" | "GAME_ENDED";

export interface MessageData {
  type: MessageType;
  payload?: any;
}

class SocketManager {
  private users: User[] = [];
  private worker: Worker[] = [];
  public static instance: SocketManager;

  constructor() {
    this.users = [];
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  async addUser(user: User) {
    const existing = this.users.find((u) => u.publicKey === user.publicKey);

    if (existing) {
      existing.socket.close();
      this.users = this.users.filter((u) => u.publicKey !== user.publicKey);
    }

    this.users.push(user);
    // await this.handleReconnect(user);
    this.userHandler(user);
  }

  private async handleReconnect(user: User) {
    // 1. Check if user is in a game
    const gameId = await redis.get(`player:${user.publicKey}:game`);
    if (gameId) {
      const game = await redis.get(`game:${gameId}`);
      if (game) {
        const parsedGame = JSON.parse(game);
        user.socket.send(JSON.stringify({
          type: UPDATE_GAME,
          payload: {
            game: parsedGame,
            gameState: parsedGame.gameState,
            players: parsedGame.players,
            energyOrbs: parsedGame.energyOrbs
          }
        }));
      }
    }
  }

  removeUser(userSocket: WebSocket) {
    const user = this.users.find((u) => u.socket === userSocket);
    if (!user) return;

    // Remove the user
    this.users = this.users.filter((u) => u.socket !== userSocket);

    // Notify all workers that the user has disconnected
    const message: MessageData = {
      type: USER_DISCONNECTED,
      payload: { publicKey: user.publicKey }
    };

    this.worker.forEach((worker) => {
      if (worker.socket.readyState === WebSocket.OPEN) {
        worker.socket.send(JSON.stringify(message));
      }
    });
  }

  getUserCount(): number {
    return this.users.length;
  }

  getActiveUsers(): User[] {
    const now = Date.now();
    return this.users.filter(user =>
      user.socket.readyState === WebSocket.OPEN &&
      now - user.lastActive < 30000
    );
  }

  addWorker(worker: Worker) {
    this.worker.push(worker);
    this.workerHandler(worker);
  }

  getWorkerCount(): number {
    return this.worker.length;
  }

  private userHandler(user: User) {
    user.socket.onmessage = async (message: MessageEvent) => {
      const data: MessageData = JSON.parse(message.data as string);

      switch (data.type) {
        case CONNECTED:
          user.socket.send(JSON.stringify({ type: WELCOME, payload: "Welcome to Power Spree!!" }));
          break;
        case START_GAME:
          if (!data.payload.publicKey || user.publicKey !== data.payload.publicKey) {
            return;
          }

          let waitingUsers = await waitingQueue.getWaiting();
          waitingUsers = waitingUsers.flatMap((user) => user.data);
          if (waitingUsers.includes(data.payload.publicKey)) {
            return;
          }
          pushToQueue(data.payload.publicKey);
          break;
        case KEY_PRESSED:
          if (!data.payload.publicKey || user.publicKey !== data.payload.publicKey) {
            return;
          }
          const pressedKey = ValidKeyStroke(data.payload.key);
          if (!pressedKey) {
            return;
          }
          // Send to Worker
          this.worker.forEach((worker) => {
            if (worker.socket.readyState === WebSocket.OPEN) {
              worker.socket.send(JSON.stringify(data));
            }
          })
          break;
        case KEY_RELEASED:
          if (!data.payload.publicKey || user.publicKey !== data.payload.publicKey) {
            return;
          }
          const releasedKey = ValidKeyStroke(data.payload.key);
          if (!releasedKey) {
            return;
          }
          // Send to Worker
          this.worker.forEach((worker) => {
            if (worker.socket.readyState === WebSocket.OPEN) {
              worker.socket.send(JSON.stringify(data));
            }
          })
        default:
          break;
      }
    };
  }

  private workerHandler(worker: Worker) {
    worker.socket.onmessage = async (message: MessageEvent) => {
      const data: MessageData = JSON.parse(message.data as string);

      switch (data.type) {
        case CONNECTED:
          worker.socket.send(JSON.stringify({ type: WELCOME, payload: "Welcome to Power Spree!!" }));
          break;
        case UPDATE_GAME:
          const { players: updatedPlayers } = data.payload;
          updatedPlayers.forEach((player: Player) => {
            const user = this.users.find((u) => u.publicKey === player.id);
            if (user) {
              user.socket.send(JSON.stringify({
                type: UPDATE_GAME,
                payload: {
                  game: data.payload.game,
                  players: data.payload.players,
                  energyOrbs: data.payload.energyOrbs,
                  player_1_keys: data.payload.player_1_keys,
                  player_2_keys: data.payload.player_2_keys,
                }
              }));
            }
          });
          break;
        case START_GAME:
          const { players: startPlayers } = data.payload;
          startPlayers.forEach((player: Player) => {
            const user = this.users.find((u) => u.publicKey === player.id);
            if (user) {
              user.lastActive = Date.now();
              user.socket.send(JSON.stringify({
                type: START_GAME,
                payload: {
                  game: data.payload.game,
                  players: data.payload.players,
                  energyOrbs: data.payload.energyOrbs,
                  publicKey: player.id,
                  player_1_keys: data.payload.player_1_keys,
                  player_2_keys: data.payload.player_2_keys
                }
              }));
            }
          });
          break;
        case WAITING:
          const { players: waitingPlayers } = data.payload;
          waitingPlayers.forEach((publicKey: string) => {
            const user = this.users.find((u) => u.publicKey === publicKey);
            if (user) {
              user.lastActive = Date.now();
              user.socket.send(JSON.stringify({
                type: WAITING,
                payload: { players: waitingPlayers }
              }));
            }
          });
          break;
        case GAME_ENDED:
          const { players: gameEndedPlayers } = data.payload;
          gameEndedPlayers.forEach((publicKey: string) => {
            const user = this.users.find((u) => u.publicKey === publicKey);
            if (user) {
              user.lastActive = Date.now();
              user.socket.send(JSON.stringify({
                type: GAME_ENDED,
                payload: { 
                  gameID: data.payload.gameID,
                  players: gameEndedPlayers,
                  winner: data.payload.winner
                }
              }));
            }
          });
          break;
        default:
          break;
      }
    };
  }
}

export default SocketManager.getInstance();