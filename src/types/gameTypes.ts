export type GameState = "WAITING" | "RUNNING" | "ENDED";

export interface Game {
  gameID: string;
  gameState: GameState;
  players: Player[];
  energyOrbs: EnergyOrb[];
  nextOrbIndex: number;
  gameRunning: boolean;
  // publickey -> { key: boolean }
  player_1_keys: Record<string, Record<string, boolean>>;
  player_2_keys: Record<string, Record<string, boolean>>;
  gameTime: number;
}

export interface Player {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  dashCooldown: number;
  repulseCooldown: number;
  repulsedTicks: number;
  isDashing: boolean;
  dashTime: number;
  trail: { x: number, y: number, alpha: number }[];
}

export interface EnergyOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  collected: boolean;
}