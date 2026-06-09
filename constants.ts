
export const GAME_CONFIG = {
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,
  INITIAL_HEALTH: 100,
  TARGET_SPAWN_RATE: 1500, // ms
  FIRE_RATE: 150, // ms
  TARGET_BASE_SPEED: 1.5,
  PARTICLE_COUNT: 12,
  HAND_SMOOTHING: 0.6,
  MAX_HEALTH: 100,
};

export const COLORS = {
  CYAN: '#22d3ee',
  MAGENTA: '#d946ef',
  YELLOW: '#eab308',
  RED: '#ef4444',
  GREEN: '#22c55e',
  BLUE: '#3b82f6',
  ORANGE: '#f97316',
  PURPLE: '#a855f7',
  SLATE_900: '#0f172a',
};

export const TARGET_TYPES = {
  drone: { size: 50, health: 1, points: 100, color: COLORS.CYAN, movementType: 'linear' },
  scout: { size: 30, health: 1, points: 200, color: COLORS.YELLOW, movementType: 'sine' },
  boss: { size: 100, health: 10, points: 1000, color: COLORS.MAGENTA, movementType: 'linear' },
  interceptor: { size: 25, health: 1, points: 300, color: COLORS.ORANGE, speedMult: 2, movementType: 'zigzag' },
  carrier: { size: 120, health: 15, points: 1500, color: COLORS.PURPLE, speedMult: 0.5, movementType: 'sine' },
  shield: { size: 60, health: 2, points: 400, color: COLORS.BLUE, shield: 3, movementType: 'linear' },
};

