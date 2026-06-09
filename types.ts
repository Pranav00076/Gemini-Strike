
export interface Vector2 {
  x: number;
  y: number;
}

export type PowerUpType = 'rapidFire' | 'timeFreeze' | 'multiShot';

export interface PowerUpDrop {
  id: string;
  pos: Vector2;
  vel: Vector2;
  type: PowerUpType;
  size: number;
}

export interface HighScore {
  name: string;
  score: number;
  date: string;
}

export interface Achievement {
  id: string;
  title: string;
  message: string;
}

export interface Target {
  id: string;
  pos: Vector2;
  vel: Vector2;
  size: number;
  health: number;
  maxHealth: number;
  type: 'drone' | 'scout' | 'boss' | 'interceptor' | 'carrier' | 'shield';
  color: string;
  points: number;
  hitTimer: number; // For flashing when hit
  shield?: number;
  movementType: 'linear' | 'sine' | 'zigzag' | 'chase';
  baseX: number;
  spawnTime: number;
}

export interface EnemyProjectile {
  id: string;
  pos: Vector2;
  vel: Vector2;
  size: number;
  damage: number;
  color: string;
}

export interface Particle {
  id: string;
  pos: Vector2;
  vel: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'spark' | 'smoke' | 'debris';
}

export interface HandData {
  active: boolean;
  pos: Vector2;
  isFiring: boolean;
  landmarks: MediaPipeLandmark[];
  gesture: 'none' | 'gun' | 'pinch' | 'palm';
  shieldActive: boolean;
  shieldEnergy: number;
}

export interface GameState {
  score: number;
  health: number;
  level: number;
  isGameOver: boolean;
  isPlaying: boolean;
  targets: Target[];
  particles: Particle[];
  hands: HandData[];
  briefing: string;
  combo: number;
  maxCombo: number;
  screenShake: number;
  enemyProjectiles: EnemyProjectile[];
  activeBuff: PowerUpType | null;
  buffTimer: number;
  cameraError: string | null;
}

export interface MediaPipeLandmark {
  x: number;
  y: number;
  z: number;
}
