import { CONNECTED, WELCOME } from "../messages";

export class User {
  public socket: WebSocket;
  public publicKey: string;

  constructor(socket: WebSocket, publicKey: string) {
    this.socket = socket;
    this.publicKey = publicKey;
  }
}

type MessageType = "CONNECTED" | "WELCOME";

interface MessageData {
  type: MessageType;
  payload?: any;
}

class SocketManager {
  private users: User[] = [];
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

  addUser(user: User) {
    this.users.push(user);
    this.userHandler(user);
  }

  removeUser(userSocket: WebSocket) {
    this.users = this.users.filter((u) => u.socket !== userSocket);
  }

  private userHandler(user: User) {
    user.socket.onmessage = (message: MessageEvent) => {
      const data: MessageData = JSON.parse(message.data as string);

      switch (data.type) {
        case CONNECTED:
          user.socket.send(JSON.stringify({ type: WELCOME, payload: "Welcome to Power Spree!!" }));
          break;

        default:
          break;
      }
    };
  }
}

export default SocketManager.getInstance();