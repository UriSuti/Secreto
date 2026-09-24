// Motor de física puro para el juego de fútbol.
// Sin side effects, sin React, sin DOM.
// Toda la simulación vive en objetos planos de JS.

// ─── Mapas y dimensiones ──────────────────────────────────────────────────
export const MAP_CONFIGS = {
  cancha3: {
    name: 'Cancha de 3 (Pequeña)',
    width: 1050,
    height: 680,
    wallThickness: 14,
    goalDepth: 12,
    goalHeight: 180,
  },
  cancha5: {
    name: 'Cancha de 5 (Chica)',
    width: 1450,
    height: 920,
    wallThickness: 16,
    goalDepth: 14,
    goalHeight: 220,
  },
  cancha9: {
    name: 'Cancha de 9 (Grande)',
    width: 1850,
    height: 1180,
    wallThickness: 18,
    goalDepth: 16,
    goalHeight: 260,
  },
  cancha11: {
    name: 'Cancha de 11 (Muy grande)',
    width: 2300,
    height: 1450,
    wallThickness: 20,
    goalDepth: 18,
    goalHeight: 300,
  },
};

export const FIELD = MAP_CONFIGS.cancha3;
export const GOAL = { width: FIELD.goalDepth, height: FIELD.goalHeight };

// ─── Constantes de estámina ─────────────────────────────────────────────────
export const STAMINA_CONFIG = {
  max: 100,
  drainRate: 25,        // consume 25% por segundo al correr (4 seg de sprint continuo)
  rechargeRate: 33.3,    // recarga a 100% en 3 segundos tras el cooldown
  rechargeDelay: 2000,   // 2 segundos (2000ms) de espera tras soltar shift/dejar de correr
};

// ─── Constantes de jugadores y pelota ─────────────────────────────────────
export const PLAYER_CONFIG = {
  radius: 16,
  mass: 1.0,
  maxSpeed: 165,        // velocidad máxima en modo normal o corriendo con estámina
  accel: 1350,          // aceleración
  friction: 0.90,       // factor de velocidad conservado por 1/60s
  kickRange: 2,         // contacto únicamente cuando el sprite toca la pelota
  kickForce: 420,       // fuerza del kick a la pelota
  restitution: 0.35,    // rebote jugador-jugador
};

export const BALL_CONFIG = {
  radius: 11,
  mass: 0.45,
  friction: 0.965,      // desaceleración en el césped (rueda menos tiempo)
  wallRestitution: 0.60,
  playerRestitution: 0.40, // rebote al colisionar con jugador sin patear
  maxSpeed: 600,        // velocidad máxima de la pelota
};

// ─── Posiciones iniciales ──────────────────────────────────────────────────
export function createGameState(players, options = {}) {
  const mapType = options.mapType || 'cancha3';
  const field = MAP_CONFIGS[mapType] || MAP_CONFIGS.cancha3;

  const reds = players.filter((p) => p.team === 'red');
  const blues = players.filter((p) => p.team === 'blue');

  const cx = field.width / 2;
  const cy = field.height / 2;

  const redPositions = spreadPositions(reds.length, cx - 180, cy, 'left');
  const bluePositions = spreadPositions(blues.length, cx + 180, cy, 'right');

  const playerStates = {};

  reds.forEach((p, i) => {
    playerStates[p.id] = makePlayerState(p, redPositions[i].x, redPositions[i].y);
  });
  blues.forEach((p, i) => {
    playerStates[p.id] = makePlayerState(p, bluePositions[i].x, bluePositions[i].y);
  });

  return {
    field,
    options: { stamina: false, ...options },
    players: playerStates,
    ball: {
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
    },
    goalCooldown: 0,
  };
}

function makePlayerState(p, x, y) {
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    x,
    y,
    vx: 0,
    vy: 0,
    isKicking: false,
    kickHeld: false,
    stamina: 100,
    staminaCooldown: 0,
  };
}

function spreadPositions(count, centerX, centerY, side) {
  if (count === 0) return [];
  const spacing = 90;
  const positions = [];
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const yOffset = (i - half) * spacing;
    const xOffset = (i % 2 === 0 ? 0 : (side === 'left' ? -40 : 40));
    positions.push({ x: centerX + xOffset, y: centerY + yOffset });
  }
  return positions;
}

export function resetPositions(state, players) {
  const field = state.field || MAP_CONFIGS.cancha3;
  const reds = players.filter((p) => p.team === 'red');
  const blues = players.filter((p) => p.team === 'blue');

  const cx = field.width / 2;
  const cy = field.height / 2;

  const redPositions = spreadPositions(reds.length, cx - 180, cy, 'left');
  const bluePositions = spreadPositions(blues.length, cx + 180, cy, 'right');

  const next = deepClone(state);

  reds.forEach((p, i) => {
    next.players[p.id] = {
      ...next.players[p.id],
      x: redPositions[i].x,
      y: redPositions[i].y,
      vx: 0,
      vy: 0,
      isKicking: false,
      kickHeld: false,
      stamina: 100,
      staminaCooldown: 0,
    };
  });
  blues.forEach((p, i) => {
    next.players[p.id] = {
      ...next.players[p.id],
      x: bluePositions[i].x,
      y: bluePositions[i].y,
      vx: 0,
      vy: 0,
      isKicking: false,
      kickHeld: false,
      stamina: 100,
      staminaCooldown: 0,
    };
  });

  next.ball = { x: cx, y: cy, vx: 0, vy: 0 };
  return next;
}

// ─── Paso de simulación ────────────────────────────────────────────────────
export function stepPhysics(state, inputs, dt) {
  const s = dt / 1000;
  const next = deepClone(state);
  const field = next.field || MAP_CONFIGS.cancha3;
  const staminaEnabled = next.options?.stamina ?? false;

  // 1. Mover jugadores
  Object.values(next.players).forEach((player) => {
    const input = inputs[player.id] || {};
    let ax = 0;
    let ay = 0;
    if (input.left) ax -= 1;
    if (input.right) ax += 1;
    if (input.up) ay -= 1;
    if (input.down) ay += 1;

    const isMoving = (ax !== 0 || ay !== 0);

    if (ax !== 0 && ay !== 0) {
      ax /= Math.SQRT2;
      ay /= Math.SQRT2;
    }

    let targetMaxSpeed = PLAYER_CONFIG.maxSpeed;
    let targetAccel = PLAYER_CONFIG.accel;

    if (staminaEnabled) {
      const isSprinting = input.shift && isMoving && ((player.stamina ?? 100) > 0);

      if (isSprinting) {
        // Correr: misma velocidad que en modo normal
        targetMaxSpeed = PLAYER_CONFIG.maxSpeed;
        targetAccel = PLAYER_CONFIG.accel;

        // Consumir estámina
        player.stamina = Math.max(0, (player.stamina ?? 100) - STAMINA_CONFIG.drainRate * s);
        player.staminaCooldown = STAMINA_CONFIG.rechargeDelay;
      } else {
        // Caminar: la mitad de la velocidad
        targetMaxSpeed = PLAYER_CONFIG.maxSpeed * 0.5;
        targetAccel = PLAYER_CONFIG.accel * 0.5;

        // Recargar estámina tras 2 segundos de cooldown
        if ((player.staminaCooldown ?? 0) > 0) {
          player.staminaCooldown = Math.max(0, player.staminaCooldown - dt);
        } else if ((player.stamina ?? 100) < STAMINA_CONFIG.max) {
          player.stamina = Math.min(STAMINA_CONFIG.max, (player.stamina ?? 0) + STAMINA_CONFIG.rechargeRate * s);
        }
      }
    }

    ax *= targetAccel;
    ay *= targetAccel;

    player.vx += ax * s;
    player.vy += ay * s;

    const pFriction = Math.pow(PLAYER_CONFIG.friction, s * 60);
    player.vx *= pFriction;
    player.vy *= pFriction;

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > targetMaxSpeed) {
      player.vx = (player.vx / speed) * targetMaxSpeed;
      player.vy = (player.vy / speed) * targetMaxSpeed;
    }

    player.x += player.vx * s;
    player.y += player.vy * s;
  });

  // 2. Mover pelota
  next.ball.vx *= Math.pow(BALL_CONFIG.friction, s * 60);
  next.ball.vy *= Math.pow(BALL_CONFIG.friction, s * 60);
  next.ball.x += next.ball.vx * s;
  next.ball.y += next.ball.vy * s;

  // 3. Resolución de colisiones
  const playerList = Object.values(next.players);
  const SOLVER_ITERATIONS = 4;

  for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
    playerList.forEach((player) => {
      resolvePlayerWall(player, field);
    });

    resolveBallWall(next.ball, field);

    for (let i = 0; i < playerList.length; i++) {
      for (let j = i + 1; j < playerList.length; j++) {
        resolvePlayerPlayer(playerList[i], playerList[j]);
      }
    }

    playerList.forEach((player) => {
      resolvePlayerBall(player, next.ball);
    });
  }

  // 4. Kicks
  playerList.forEach((player) => {
    const input = inputs[player.id] || {};

    if (!input.kick) {
      player.kickHeld = false;
      player.isKicking = false;
    } else {
      if (!player.kickHeld && !player.isKicking) {
        player.isKicking = true;
        player.kickHeld = true;
      }
    }

    if (player.isKicking) {
      const contacted = tryKick(player, next.ball);
      if (contacted) {
        player.isKicking = false;
      }
    }
  });

  // 5. Detectar gol
  const goal = detectGoal(next.ball, field);

  return { nextState: next, goal };
}

// ─── Resolución de colisiones ──────────────────────────────────────────────

function resolvePlayerWall(player, field = FIELD) {
  const r = PLAYER_CONFIG.radius;
  const w = field.wallThickness;

  if (player.x - r < w) {
    player.x = w + r;
    player.vx = Math.abs(player.vx) * 0.4;
  }
  if (player.x + r > field.width - w) {
    player.x = field.width - w - r;
    player.vx = -Math.abs(player.vx) * 0.4;
  }

  if (player.y - r < w) {
    player.y = w + r;
    player.vy = Math.abs(player.vy) * 0.4;
  }
  if (player.y + r > field.height - w) {
    player.y = field.height - w - r;
    player.vy = -Math.abs(player.vy) * 0.4;
  }
}

function resolveBallWall(ball, field = FIELD) {
  const r = BALL_CONFIG.radius;
  const w = field.wallThickness;
  const cy = field.height / 2;
  const goalHalf = field.goalHeight / 2;
  const goalTop = cy - goalHalf;
  const goalBottom = cy + goalHalf;

  if (ball.x - r < w) {
    if (ball.y > goalTop && ball.y < goalBottom) {
      if (ball.x + r < 0) {}
    } else {
      ball.x = w + r;
      ball.vx = Math.abs(ball.vx) * BALL_CONFIG.wallRestitution;
    }
  }

  if (ball.x + r > field.width - w) {
    if (ball.y > goalTop && ball.y < goalBottom) {
    } else {
      ball.x = field.width - w - r;
      ball.vx = -Math.abs(ball.vx) * BALL_CONFIG.wallRestitution;
    }
  }

  if (ball.y - r < w) {
    ball.y = w + r;
    ball.vy = Math.abs(ball.vy) * BALL_CONFIG.wallRestitution;
  }

  if (ball.y + r > field.height - w) {
    ball.y = field.height - w - r;
    ball.vy = -Math.abs(ball.vy) * BALL_CONFIG.wallRestitution;
  }

  resolveCircleWithGoalPost(ball, r, w, goalTop);
  resolveCircleWithGoalPost(ball, r, w, goalBottom);
  resolveCircleWithGoalPost(ball, r, field.width - w, goalTop);
  resolveCircleWithGoalPost(ball, r, field.width - w, goalBottom);
}

function resolveCircleWithGoalPost(ball, r, postX, postY) {
  const dx = ball.x - postX;
  const dy = ball.y - postY;
  const dist = Math.hypot(dx, dy);
  if (dist < r && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;
    ball.x = postX + nx * r;
    ball.y = postY + ny * r;
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx * BALL_CONFIG.wallRestitution;
      ball.vy -= 2 * dot * ny * BALL_CONFIG.wallRestitution;
    }
  }
}

function resolvePlayerPlayer(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = PLAYER_CONFIG.radius * 2;

  if (dist >= minDist || dist === 0) return;

  const nx = dx / dist;
  const ny = dy / dist;

  const overlap = minDist - dist;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const dot = rvx * nx + rvy * ny;
  if (dot >= 0) return;

  const totalMass = PLAYER_CONFIG.mass * 2;
  const j = -(1 + PLAYER_CONFIG.restitution) * dot / totalMass;
  a.vx -= j * PLAYER_CONFIG.mass * nx;
  a.vy -= j * PLAYER_CONFIG.mass * ny;
  b.vx += j * PLAYER_CONFIG.mass * nx;
  b.vy += j * PLAYER_CONFIG.mass * ny;
}

function resolvePlayerBall(player, ball) {
  const pr = PLAYER_CONFIG.radius;
  const br = BALL_CONFIG.radius;
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  let dist = Math.hypot(dx, dy);
  const minDist = pr + br;

  if (dist >= minDist) return;

  let nx = 0;
  let ny = 0;
  if (dist > 0.0001) {
    nx = dx / dist;
    ny = dy / dist;
  } else {
    nx = 0;
    ny = -1;
    dist = 0.0001;
  }

  if (Math.abs(ny) < 0.1) {
    ny = dy >= 0 ? 0.2 : -0.2;
    const len = Math.hypot(nx, ny);
    nx /= len;
    ny /= len;
  }

  const overlap = minDist - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;

  const rvx = ball.vx - player.vx;
  const rvy = ball.vy - player.vy;
  const dot = rvx * nx + rvy * ny;
  if (dot >= 0) return;

  const totalMass = PLAYER_CONFIG.mass + BALL_CONFIG.mass;
  const j = -(1 + BALL_CONFIG.playerRestitution) * dot / totalMass;

  ball.vx += j * PLAYER_CONFIG.mass * nx;
  ball.vy += j * PLAYER_CONFIG.mass * ny;
}

function tryKick(player, ball) {
  const pr = PLAYER_CONFIG.radius;
  const br = BALL_CONFIG.radius;
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  const kickDist = pr + br + PLAYER_CONFIG.kickRange;

  if (dist > kickDist || dist === 0) return false;

  const nx = dx / dist;
  const ny = dy / dist;

  ball.vx += nx * PLAYER_CONFIG.kickForce;
  ball.vy += ny * PLAYER_CONFIG.kickForce;

  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  if (ballSpeed > BALL_CONFIG.maxSpeed) {
    ball.vx = (ball.vx / ballSpeed) * BALL_CONFIG.maxSpeed;
    ball.vy = (ball.vy / ballSpeed) * BALL_CONFIG.maxSpeed;
  }

  return true;
}

function detectGoal(ball, field = FIELD) {
  const cy = field.height / 2;
  const goalHalf = field.goalHeight / 2;
  const goalTop = cy - goalHalf;
  const goalBottom = cy + goalHalf;
  const w = field.wallThickness;

  if (ball.x < w && ball.y > goalTop && ball.y < goalBottom) {
    return 'blue';
  }

  if (ball.x > field.width - w && ball.y > goalTop && ball.y < goalBottom) {
    return 'red';
  }

  return null;
}

function deepClone(obj) {
  const next = { ...obj };
  next.players = {};
  Object.entries(obj.players).forEach(([id, p]) => {
    next.players[id] = { ...p };
  });
  next.ball = { ...obj.ball };
  if (obj.field) next.field = { ...obj.field };
  if (obj.options) next.options = { ...obj.options };
  return next;
}
