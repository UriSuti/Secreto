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
    sideMargin: 60,       // zona lateral caminable fuera de la cancha (arriba/abajo)
  },
  cancha5: {
    name: 'Cancha de 5 (Chica)',
    width: 1450,
    height: 920,
    wallThickness: 16,
    goalDepth: 14,
    goalHeight: 220,
    sideMargin: 70,
  },
  cancha9: {
    name: 'Cancha de 9 (Grande)',
    width: 1850,
    height: 1180,
    wallThickness: 18,
    goalDepth: 16,
    goalHeight: 260,
    sideMargin: 80,
  },
  cancha11: {
    name: 'Cancha de 11 (Muy grande)',
    width: 2300,
    height: 1450,
    wallThickness: 20,
    goalDepth: 18,
    goalHeight: 300,
    sideMargin: 90,
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
  kickForce: 420,       // fuerza del kick (compatibilidad)
  minKickForce: 420,    // fuerza mínima tras mantener el kick presionado (5s)
  maxKickForce: 777,    // fuerza máxima al presionar kick instantáneamente
  kickHoldDecayTime: 5.0, // tiempo en segundos para decaer de 777 a 420
  kickSpeedMultiplier: 0.75, // velocidad al mantener el kick activo (25% más lento)
  restitution: 0.35,    // rebote jugador-jugador
};

export const BALL_CONFIG = {
  radius: 11,
  mass: 0.45,
  friction: 0.965,      // desaceleración en el césped (rueda menos tiempo)
  wallRestitution: 0.60,
  playerRestitution: 0.40, // rebote al colisionar con jugador sin patear
  maxSpeed: 1000,       // velocidad máxima de la pelota (para permitir el kick de 777)
};

export const CAR_BALL_CONFIG = {
  radius: 14.5,         // pelota más grande
  mass: 2.4,
  friction: 0.992,      // rueda muy libre — liviana al tacto
  wallRestitution: 0.60,
  playerRestitution: 0.18,
  maxSpeed: 820,
};

// ─── Posiciones iniciales ──────────────────────────────────────────────────
export function createGameState(players, options = {}) {
  if (options.vehicleMode === 'coches') {
    return createCarGameState(players, options);
  }

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
    kickHoldTime: 0,
    hasHitBallThisPress: false,
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
  if (state.options?.vehicleMode === 'coches') {
    return resetCarPositions(state, players);
  }

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
      kickHoldTime: 0,
      hasHitBallThisPress: false,
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
      kickHoldTime: 0,
      hasHitBallThisPress: false,
      stamina: 100,
      staminaCooldown: 0,
    };
  });

  next.ball = { x: cx, y: cy, vx: 0, vy: 0 };
  return next;
}

// ─── Paso de simulación ────────────────────────────────────────────────────
export function stepPhysics(state, inputs, dt) {
  if (state.options?.vehicleMode === 'coches') {
    return stepCarPhysics(state, inputs, dt);
  }

  const s = dt / 1000;
  const next = deepClone(state);
  const field = next.field || MAP_CONFIGS.cancha3;
  const staminaEnabled = next.options?.stamina ?? false;

  // 1. Mover jugadores
  Object.values(next.players).forEach((player) => {
    const input = inputs[player.id] || {};

    // Manejo de estado del Kick y acumulación del tiempo retenido
    if (!input.kick) {
      player.kickHeld = false;
      player.isKicking = false;
      player.kickHoldTime = 0;
      player.hasHitBallThisPress = false;
    } else {
      if (!player.kickHeld) {
        player.kickHeld = true;
        player.isKicking = true;
        player.kickHoldTime = s;
        player.hasHitBallThisPress = false;
      } else {
        if (!player.hasHitBallThisPress) {
          player.isKicking = true;
          player.kickHoldTime = (player.kickHoldTime || 0) + s;
        } else {
          player.isKicking = false;
        }
      }
    }

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

    // Reducción de velocidad si tiene el KICK activo (manteniendo kick sin colisionar)
    if (player.isKicking) {
      const mult = PLAYER_CONFIG.kickSpeedMultiplier ?? 0.75;
      targetMaxSpeed *= mult;
      targetAccel *= mult;
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
    if (player.isKicking) {
      const contacted = tryKick(player, next.ball);
      if (contacted) {
        player.isKicking = false;
        player.hasHitBallThisPress = true;
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
  const sm = field.sideMargin || 0; // zona lateral caminable fuera de la cancha

  // Izquierda y derecha: el jugador queda limitado por las paredes del campo
  if (player.x - r < w) {
    player.x = w + r;
    player.vx = Math.abs(player.vx) * 0.4;
  }
  if (player.x + r > field.width - w) {
    player.x = field.width - w - r;
    player.vx = -Math.abs(player.vx) * 0.4;
  }

  // Arriba y abajo: el jugador puede caminar hasta el borde del sideMargin
  if (player.y - r < -sm) {
    player.y = -sm + r;
    player.vy = Math.abs(player.vy) * 0.4;
  }
  if (player.y + r > field.height + sm) {
    player.y = field.height + sm - r;
    player.vy = -Math.abs(player.vy) * 0.4;
  }
}

function resolveBallWall(ball, field = FIELD) {
  const isVert = Boolean(field.isVertical);
  const r = isVert ? CAR_BALL_CONFIG.radius : BALL_CONFIG.radius;
  const wallRest = isVert ? CAR_BALL_CONFIG.wallRestitution : BALL_CONFIG.wallRestitution;
  const w = field.wallThickness;

  if (isVert) {
    const cx = field.width / 2;
    const goalHalf = (field.goalWidth || field.goalHeight || 180) / 2;
    const goalLeft = cx - goalHalf;
    const goalRight = cx + goalHalf;

    // Paredes laterales sólidas
    if (ball.x - r < w) {
      ball.x = w + r;
      ball.vx = Math.abs(ball.vx) * wallRest;
    }
    if (ball.x + r > field.width - w) {
      ball.x = field.width - w - r;
      ball.vx = -Math.abs(ball.vx) * wallRest;
    }

    // Pared superior (con arco)
    if (ball.y - r < w) {
      if (ball.x > goalLeft && ball.x < goalRight) {
        if (ball.y + r < 0) {}
      } else {
        ball.y = w + r;
        ball.vy = Math.abs(ball.vy) * wallRest;
      }
    }

    // Pared inferior (con arco)
    if (ball.y + r > field.height - w) {
      if (ball.x > goalLeft && ball.x < goalRight) {
        if (ball.y - r > field.height) {}
      } else {
        ball.y = field.height - w - r;
        ball.vy = -Math.abs(ball.vy) * wallRest;
      }
    }

    // Postes superior e inferior
    resolveCircleWithGoalPost(ball, r, goalLeft, w);
    resolveCircleWithGoalPost(ball, r, goalRight, w);
    resolveCircleWithGoalPost(ball, r, goalLeft, field.height - w);
    resolveCircleWithGoalPost(ball, r, goalRight, field.height - w);
    return;
  }

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

  const minF = PLAYER_CONFIG.minKickForce ?? 420;
  const maxF = PLAYER_CONFIG.maxKickForce ?? 777;
  const decayTime = PLAYER_CONFIG.kickHoldDecayTime ?? 5.0;

  const holdProgress = Math.min(1.0, Math.max(0.0, (player.kickHoldTime || 0) / decayTime));
  const force = maxF - holdProgress * (maxF - minF);

  ball.vx += nx * force;
  ball.vy += ny * force;

  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  if (ballSpeed > BALL_CONFIG.maxSpeed) {
    ball.vx = (ball.vx / ballSpeed) * BALL_CONFIG.maxSpeed;
    ball.vy = (ball.vy / ballSpeed) * BALL_CONFIG.maxSpeed;
  }

  return true;
}

function detectGoal(ball, field = FIELD) {
  const w = field.wallThickness;

  if (field.isVertical) {
    const cx = field.width / 2;
    const goalHalf = (field.goalWidth || field.goalHeight || 180) / 2;
    const goalLeft = cx - goalHalf;
    const goalRight = cx + goalHalf;

    // Arco superior (defendido por Azul) -> gol de ROJO
    if (ball.y < w && ball.x > goalLeft && ball.x < goalRight) {
      return 'red';
    }

    // Arco inferior (defendido por Rojo) -> gol de AZUL
    if (ball.y > field.height - w && ball.x > goalLeft && ball.x < goalRight) {
      return 'blue';
    }

    return null;
  }

  const cy = field.height / 2;
  const goalHalf = field.goalHeight / 2;
  const goalTop = cy - goalHalf;
  const goalBottom = cy + goalHalf;

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
  if (obj.boostPickups) {
    next.boostPickups = obj.boostPickups.map((bp) => ({ ...bp }));
  }
  return next;
}

// ─── Física modo Coches ───────────────────────────────────────────────────────

export const CAR_CONFIG = {
  width: 28,          // ancho del auto (eje horizontal en su espacio local)
  height: 18,         // alto del auto (eje vertical en su espacio local)
  mass: 1.2,
  maxSpeed: 280,      // velocidad máxima hacia adelante (px/s)
  maxSpeedWithBoost: 370, // velocidad punta con boost
  maxSpeedReverse: 90,// velocidad máxima en reversa
  accel: 380,         // aceleración hacia adelante (px/s²)
  boostAccel: 2200,   // aceleración adicional al quemar turbo (rápido como cohete)
  boostDrainRate: 16.7, // consumo de turbo por segundo (100 dura aprox 6s)
  flipDuration: 360,  // duración activa del flip (ms)
  flipCooldown: 1200, // tiempo de espera entre flips (ms)
  flipImpulse: 110,   // impulso de velocidad frontal extra al flip (px/s)
  flipDashDistance: 8,  // distancia adicional de desplazamiento al hacer flip (px)
  brakeForce: 520,    // desaceleración al frenar (px/s²)
  friction: 0.80,     // factor de velocidad conservado por 1/60s — frena rápido al soltar
  lateralFriction: 0.62, // cuánto de la velocidad lateral se conserva (derrape)
  turnSpeedBase: 2.8, // velocidad angular base (rad/s)
  turnSpeedLow: 3.6,  // velocidad angular a velocidad baja (rad/s)
  turnMinSpeed: 20,   // a menos de esta velocidad el auto gira más fácil
  restitution: 0.25,  // rebote auto-auto
  ballPushForce: 520, // fuerza base de empuje
  touchCooldownMs: 140, // ms entre toquecitos a la pelota (da efecto de dribbling)
};

// Estado inicial de un auto (cancha vertical: Rojo abajo apuntando hacia arriba -PI/2, Azul arriba apuntando hacia abajo PI/2)
export function makeCarState(p, x, y, initialAngle) {
  const defaultAngle = p.team === 'red' ? -Math.PI / 2 : Math.PI / 2;
  const angle = initialAngle !== undefined ? initialAngle : defaultAngle;
  return {
    id: p.id,
    name: p.name,
    team: p.team,
    x,
    y,
    vx: 0,
    vy: 0,
    angle,
    speed: 0,
    boost: 33,           // inicia con 33 de boost (estilo Rocket League)
    isBoosting: false,
    isFlipping: false,
    flipTime: 0,
    flipCooldown: 0,
    touchCooldown: 0,    // cooldown entre toquecitos a la pelota
  };
}

export function createBoostPickups(field) {
  const w = field.wallThickness || 14;
  const fw = field.width;
  const fh = field.height;
  const cx = fw / 2;
  const cy = fh / 2;

  const pickups = [];
  let idCounter = 1;

  // 6 pads grandes (100 boost, respawn: 8000ms, radius: 18)
  const cornerPadX = w + 48;
  const cornerPadY = w + 70;
  pickups.push({ id: `bp_${idCounter++}`, x: cornerPadX, y: cornerPadY, type: 'large', amount: 100, active: true, respawnTimer: 0, respawnDelay: 8000, radius: 18 });
  pickups.push({ id: `bp_${idCounter++}`, x: fw - cornerPadX, y: cornerPadY, type: 'large', amount: 100, active: true, respawnTimer: 0, respawnDelay: 8000, radius: 18 });
  pickups.push({ id: `bp_${idCounter++}`, x: cornerPadX, y: fh - cornerPadY, type: 'large', amount: 100, active: true, respawnTimer: 0, respawnDelay: 8000, radius: 18 });
  pickups.push({ id: `bp_${idCounter++}`, x: fw - cornerPadX, y: fh - cornerPadY, type: 'large', amount: 100, active: true, respawnTimer: 0, respawnDelay: 8000, radius: 18 });
  const sidePadX = w + 36;
  pickups.push({ id: `bp_${idCounter++}`, x: sidePadX, y: cy, type: 'large', amount: 100, active: true, respawnTimer: 0, respawnDelay: 8000, radius: 18 });
  pickups.push({ id: `bp_${idCounter++}`, x: fw - sidePadX, y: cy, type: 'large', amount: 100, active: true, respawnTimer: 0, respawnDelay: 8000, radius: 18 });

  // 10 pads pequeños (12 boost, respawn: 4000ms, radius: 14)
  pickups.push({ id: `bp_${idCounter++}`, x: cx, y: w + 140, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });
  pickups.push({ id: `bp_${idCounter++}`, x: cx, y: w + 240, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });
  pickups.push({ id: `bp_${idCounter++}`, x: cx, y: fh - w - 140, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });
  pickups.push({ id: `bp_${idCounter++}`, x: cx, y: fh - w - 240, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });
  pickups.push({ id: `bp_${idCounter++}`, x: cx - 85, y: cy, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });
  pickups.push({ id: `bp_${idCounter++}`, x: cx + 85, y: cy, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });
  pickups.push({ id: `bp_${idCounter++}`, x: fw * 0.28, y: fh * 0.36, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });
  pickups.push({ id: `bp_${idCounter++}`, x: fw * 0.72, y: fh * 0.36, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });
  pickups.push({ id: `bp_${idCounter++}`, x: fw * 0.28, y: fh * 0.64, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });
  pickups.push({ id: `bp_${idCounter++}`, x: fw * 0.72, y: fh * 0.64, type: 'small', amount: 12, active: true, respawnTimer: 0, respawnDelay: 4000, radius: 14 });

  return pickups;
}

function spreadPositionsVertical(count, centerX, centerY, side) {
  if (count === 0) return [];
  const spacing = 80;
  const positions = [];
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const xOffset = (i - half) * spacing;
    const yOffset = (i % 2 === 0 ? 0 : (side === 'bottom' ? 35 : -35));
    positions.push({ x: centerX + xOffset, y: centerY + yOffset });
  }
  return positions;
}

// Crea el estado inicial para el modo Coches (cancha rotada 90° de abajo hacia arriba)
export function createCarGameState(players, options = {}) {
  const mapType = options.mapType || 'cancha3';
  const baseField = MAP_CONFIGS[mapType] || MAP_CONFIGS.cancha3;
  // Cancha vertical rotada 90 grados
  const field = {
    ...baseField,
    width: baseField.height,         // Ancho más estrecho (e.g. 680)
    height: baseField.width,         // Largo vertical de abajo hacia arriba (e.g. 1050)
    goalWidth: baseField.goalHeight, // Apertura horizontal del arco en paredes superior/inferior
    goalDepth: baseField.goalDepth,
    isVertical: true,
  };

  const reds = players.filter((p) => p.team === 'red');
  const blues = players.filter((p) => p.team === 'blue');

  const cx = field.width / 2;
  const cy = field.height / 2;

  // Rojo abajo (y = cy + 220), mirando hacia ARRIBA (-Math.PI / 2)
  // Azul arriba (y = cy - 220), mirando hacia ABAJO (Math.PI / 2)
  const redPositions = spreadPositionsVertical(reds.length, cx, cy + 220, 'bottom');
  const bluePositions = spreadPositionsVertical(blues.length, cx, cy - 220, 'top');

  const playerStates = {};
  reds.forEach((p, i) => {
    playerStates[p.id] = makeCarState(p, redPositions[i].x, redPositions[i].y, -Math.PI / 2);
  });
  blues.forEach((p, i) => {
    playerStates[p.id] = makeCarState(p, bluePositions[i].x, bluePositions[i].y, Math.PI / 2);
  });

  return {
    field,
    options: { ...options },
    players: playerStates,
    ball: { x: cx, y: cy, vx: 0, vy: 0 },
    boostPickups: createBoostPickups(field),
    goalCooldown: 0,
  };
}

// Resetea posiciones en modo coches (tras un gol)
export function resetCarPositions(state, players) {
  const field = state.field || {
    ...MAP_CONFIGS.cancha3,
    width: MAP_CONFIGS.cancha3.height,
    height: MAP_CONFIGS.cancha3.width,
    goalWidth: MAP_CONFIGS.cancha3.goalHeight,
    isVertical: true,
  };
  const reds = players.filter((p) => p.team === 'red');
  const blues = players.filter((p) => p.team === 'blue');

  const cx = field.width / 2;
  const cy = field.height / 2;

  const redPositions = spreadPositionsVertical(reds.length, cx, cy + 220, 'bottom');
  const bluePositions = spreadPositionsVertical(blues.length, cx, cy - 220, 'top');

  const next = deepClone(state);

  reds.forEach((p, i) => {
    next.players[p.id] = makeCarState(p, redPositions[i].x, redPositions[i].y, -Math.PI / 2);
  });
  blues.forEach((p, i) => {
    next.players[p.id] = makeCarState(p, bluePositions[i].x, bluePositions[i].y, Math.PI / 2);
  });

  next.ball = { x: cx, y: cy, vx: 0, vy: 0 };
  next.boostPickups = state.boostPickups
    ? state.boostPickups.map((bp) => ({ ...bp }))
    : createBoostPickups(field);
  return next;
}

/**
 * stepCarPhysics — simulación de física para el modo Coches.
 *
 * Inputs esperados: { accelerate, brake, turnLeft, turnRight, boost, kick }
 *
 * Mecánicas clave:
 * - El auto tiene orientación angular y velocidad escalar.
 * - Solo puede acelerar en la dirección que mira.
 * - Derrape con inercia lateral.
 * - Freno y reversa progresiva.
 * - BOOST: consumo continuo (33.3 u/s) desde medidor 0-100, velocidad punta superior (430 px/s).
 * - PICKUPS: pads en la cancha (+12 respawn 4s, +100 respawn 8s).
 * - KICK / FLIP: impulso frontal y rotación aérea con cooldown (~1.2s).
 * - PELOTA PESADA: masa 2.4, toques suaves apenas la mueven; flip conecta con enorme potencia.
 */
export function stepCarPhysics(state, inputs, dt) {
  const s = dt / 1000;
  const next = deepClone(state);
  const field = next.field || MAP_CONFIGS.cancha3;

  const C = CAR_CONFIG;
  const halfW = C.width / 2;
  const halfH = C.height / 2;
  const carR = Math.hypot(halfW, halfH);

  // 0. Actualizar pickups de boost
  if (next.boostPickups) {
    next.boostPickups.forEach((pickup) => {
      if (!pickup.active) {
        pickup.respawnTimer = Math.max(0, pickup.respawnTimer - dt);
        if (pickup.respawnTimer <= 0) {
          pickup.active = true;
          pickup.respawnTimer = 0;
        }
      }
    });
  }

  // 1. Mover autos
  Object.values(next.players).forEach((car) => {
    const inp = inputs[car.id] || {};

    // — Giro (antihorario con turnLeft / W, horario con turnRight / S)
    const absSpeed = Math.abs(car.speed);
    const turnDir = (inp.turnLeft ? -1 : 0) + (inp.turnRight ? 1 : 0);

    if (turnDir !== 0) {
      const speedFactor = Math.max(0, 1 - (absSpeed / C.maxSpeed) * 0.65);
      const turnRate = C.turnSpeedLow * speedFactor + C.turnSpeedBase * (1 - speedFactor);
      const reverseSign = car.speed < -5 ? -1 : 1;
      car.angle += turnDir * turnRate * s * reverseSign;
    }

    // — Boost
    const wantBoost = Boolean(inp.boost && (car.boost || 0) > 0);
    if (wantBoost) {
      car.boost = Math.max(0, (car.boost || 0) - C.boostDrainRate * s);
      car.isBoosting = car.boost > 0;
    } else {
      car.isBoosting = false;
    }

    // — Flip / Kick (espacio)
    if (car.flipCooldown > 0) {
      car.flipCooldown = Math.max(0, car.flipCooldown - dt);
    }
    if (car.isFlipping) {
      car.flipTime = Math.max(0, car.flipTime - dt);
      if (car.flipTime <= 0) {
        car.isFlipping = false;
      }
    }
    // — Cooldown entre toquecitos a la pelota
    if (car.touchCooldown > 0) {
      car.touchCooldown = Math.max(0, car.touchCooldown - dt);
    }

    if (inp.kick && !car.isFlipping && car.flipCooldown <= 0) {
      car.isFlipping = true;
      car.flipTime = C.flipDuration;
      car.flipCooldown = C.flipCooldown;
      // Impulso físico frontal inmediato
      const forwardImpulse = C.flipImpulse;
      car.speed = Math.min(C.maxSpeedWithBoost, Math.max(car.speed + forwardImpulse, forwardImpulse));
      // Mini dash posicional hacia adelante para que el flip se sienta como un salto real
      const dashDist = C.flipDashDistance || 30;
      car.x += Math.cos(car.angle) * dashDist;
      car.y += Math.sin(car.angle) * dashDist;
    }

    // — Aceleración / freno / marcha atrás
    const maxSpd = car.isBoosting ? C.maxSpeedWithBoost : C.maxSpeed;
    const accelRate = car.isBoosting ? (C.accel + C.boostAccel) : C.accel;

    if (car.isBoosting) {
      // El boost empuja fuerte hacia adelante; también funciona si no se presiona accelerate
      car.speed = Math.min(maxSpd, car.speed + accelRate * s);
    } else if (car.speed > C.maxSpeed) {
      // Post-boost: desacelera rápido de vuelta a la velocidad normal
      car.speed = Math.max(C.maxSpeed, car.speed - C.brakeForce * 3.0 * s);
    } else if (inp.accelerate && !inp.brake) {
      car.speed = Math.min(maxSpd, car.speed + accelRate * s);
    } else if (inp.brake) {
      if (car.speed > 0) {
        car.speed -= C.brakeForce * s;
        if (car.speed <= 0) {
          car.speed = 0;
          car.vx = 0;
          car.vy = 0;
        }
      } else {
        car.speed = Math.max(-C.maxSpeedReverse, car.speed - C.accel * 0.6 * s);
      }
    } else {
      // Fricción longitudinal
      const friction = Math.pow(C.friction, s * 60);
      car.speed *= friction;
      if (Math.abs(car.speed) < 2) {
        car.speed = 0;
        car.vx = 0;
        car.vy = 0;
      }
    }

    // — Descomposición del movimiento e inercia / derrape
    const fwdX = Math.cos(car.angle);
    const fwdY = Math.sin(car.angle);

    const targetVx = fwdX * car.speed;
    const targetVy = fwdY * car.speed;

    const latFric = Math.pow(C.lateralFriction, s * 60);
    car.vx = car.vx * latFric + targetVx * (1 - latFric);
    car.vy = car.vy * latFric + targetVy * (1 - latFric);

    car.speed = car.vx * fwdX + car.vy * fwdY;

    car.x += car.vx * s;
    car.y += car.vy * s;

    // — Recolección de pickups de Boost
    if (next.boostPickups && (car.boost || 0) < 100) {
      next.boostPickups.forEach((pickup) => {
        if (pickup.active && (car.boost || 0) < 100) {
          const dist = Math.hypot(car.x - pickup.x, car.y - pickup.y);
          if (dist < carR + pickup.radius) {
            car.boost = Math.min(100, (car.boost || 0) + pickup.amount);
            pickup.active = false;
            pickup.respawnTimer = pickup.respawnDelay;
          }
        }
      });
    }
  });

  // 2. Mover pelota con fricción de pelota pesada
  const ballFric = Math.pow(CAR_BALL_CONFIG.friction, s * 60);
  next.ball.vx *= ballFric;
  next.ball.vy *= ballFric;
  next.ball.x += next.ball.vx * s;
  next.ball.y += next.ball.vy * s;

  // 3. Resolución de colisiones (iterativo para estabilidad)
  const carList = Object.values(next.players);
  const w = field.wallThickness;
  const sm = field.sideMargin || 0;

  const SOLVER_ITERS = 3;
  for (let iter = 0; iter < SOLVER_ITERS; iter++) {
    // Autos con paredes y postes
    carList.forEach((car) => {
      if (field.isVertical) {
        const cx = field.width / 2;
        const goalHalf = (field.goalWidth || field.goalHeight || 180) / 2;
        const goalLeft = cx - goalHalf;
        const goalRight = cx + goalHalf;

        // Borde izquierdo y derecho
        if (car.x - carR < -sm) {
          car.x = -sm + carR;
          if (car.vx < 0) { car.vx *= -0.3; car.speed *= 0.3; }
        }
        if (car.x + carR > field.width + sm) {
          car.x = field.width + sm - carR;
          if (car.vx > 0) { car.vx *= -0.3; car.speed *= 0.3; }
        }
        // Borde superior e inferior
        if (car.y - carR < w) {
          car.y = w + carR;
          if (car.vy < 0) { car.vy *= -0.3; car.speed *= 0.3; }
        }
        if (car.y + carR > field.height - w) {
          car.y = field.height - w - carR;
          if (car.vy > 0) { car.vy *= -0.3; car.speed *= 0.3; }
        }

        // 4 postes (superior e inferior)
        resolveCarWithGoalPost(car, carR, goalLeft, w);
        resolveCarWithGoalPost(car, carR, goalRight, w);
        resolveCarWithGoalPost(car, carR, goalLeft, field.height - w);
        resolveCarWithGoalPost(car, carR, goalRight, field.height - w);
      } else {
        const cy = field.height / 2;
        const goalHalf = field.goalHeight / 2;
        const goalTop = cy - goalHalf;
        const goalBottom = cy + goalHalf;

        if (car.x - carR < w) {
          car.x = w + carR;
          if (car.vx < 0) { car.vx *= -0.3; car.speed *= 0.3; }
        }
        if (car.x + carR > field.width - w) {
          car.x = field.width - w - carR;
          if (car.vx > 0) { car.vx *= -0.3; car.speed *= 0.3; }
        }
        if (car.y - carR < -sm) {
          car.y = -sm + carR;
          if (car.vy < 0) { car.vy *= -0.3; car.speed *= 0.3; }
        }
        if (car.y + carR > field.height + sm) {
          car.y = field.height + sm - carR;
          if (car.vy > 0) { car.vy *= -0.3; car.speed *= 0.3; }
        }

        resolveCarWithGoalPost(car, carR, w, goalTop);
        resolveCarWithGoalPost(car, carR, w, goalBottom);
        resolveCarWithGoalPost(car, carR, field.width - w, goalTop);
        resolveCarWithGoalPost(car, carR, field.width - w, goalBottom);
      }
    });

    // Rebote pelota con paredes y postes
    resolveBallWall(next.ball, field);

    // Autos entre sí (choques)
    for (let i = 0; i < carList.length; i++) {
      for (let j = i + 1; j < carList.length; j++) {
        const a = carList[i];
        const b = carList[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = carR * 1.8;
        if (dist >= minDist || dist === 0) continue;

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
        if (dot >= 0) continue;

        const j2 = -(1 + C.restitution) * dot / 2;
        a.vx -= j2 * nx;
        a.vy -= j2 * ny;
        b.vx += j2 * nx;
        b.vy += j2 * ny;
        a.speed = a.vx * Math.cos(a.angle) + a.vy * Math.sin(a.angle);
        b.speed = b.vx * Math.cos(b.angle) + b.vy * Math.sin(b.angle);
      }
    }

    // Colisión física autos con pelota
    carList.forEach((car) => {
      carBallCollision(car, next.ball, halfW, halfH);
    });
  }

  // 4. Detectar gol
  const goal = detectGoal(next.ball, field);

  return { nextState: next, goal };
}

function resolveCarWithGoalPost(car, carR, postX, postY) {
  const dx = car.x - postX;
  const dy = car.y - postY;
  const dist = Math.hypot(dx, dy);
  const minDist = carR + 5;
  if (dist < minDist && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;
    car.x = postX + nx * minDist;
    car.y = postY + ny * minDist;
    const dot = car.vx * nx + car.vy * ny;
    if (dot < 0) {
      car.vx -= 1.3 * dot * nx;
      car.vy -= 1.3 * dot * ny;
      car.speed *= 0.5;
    }
  }
}

/**
 * Colisión física de un auto con la pelota en modo coches (cuerpo OBB).
 * - Pelota pesada (mass 2.4 vs 0.45): toques suaves y autos lentos apenas la mueven.
 * - Autos veloces producen impacto sólido pero controlado.
 * - KICK / FLIP (Space): vence la masa pesada y proyecta la pelota con impulso masivo estilo Rocket League.
 * - Si se ejecuta flip lejos de la pelota, solo se realiza el salto físico sin afectar a distancia.
 */
function carBallCollision(car, ball, halfW, halfH) {
  const br = CAR_BALL_CONFIG.radius;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);

  // Vector desde el centro del auto hasta el centro de la pelota
  const dx = ball.x - car.x;
  const dy = ball.y - car.y;

  // Transformar al espacio local del auto (+X = adelante / frente, +Y = lateral derecho)
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;

  // Punto más cercano dentro del rectángulo del auto
  const clampedX = Math.max(-halfW, Math.min(halfW, localX));
  const clampedY = Math.max(-halfH, Math.min(halfH, localY));

  const diffX = localX - clampedX;
  const diffY = localY - clampedY;
  const dist = Math.hypot(diffX, diffY);

  if (dist >= br) return; // Sin contacto físico real

  // Normal en el espacio local
  let normLocalX = 0;
  let normLocalY = 0;
  if (dist > 0.0001) {
    normLocalX = diffX / dist;
    normLocalY = diffY / dist;
  } else {
    normLocalX = localX >= 0 ? 1 : -1;
    normLocalY = 0;
  }

  // Normal en coordenadas globales
  const worldNormX = normLocalX * cos - normLocalY * sin;
  const worldNormY = normLocalX * sin + normLocalY * cos;

  // Separar pelota del auto
  const overlap = br - (dist > 0.0001 ? dist : 0);
  ball.x += worldNormX * overlap;
  ball.y += worldNormY * overlap;

  // Determinar si el impacto es frontal (frente del auto transmitiendo empuje)
  const isFrontHit = (clampedX >= halfW - 4 && normLocalX > 0.25) || localX > halfW * 0.75;
  const carSpeed = Math.hypot(car.vx, car.vy);

  const rvx = ball.vx - car.vx;
  const rvy = ball.vy - car.vy;
  const relDot = rvx * worldNormX + rvy * worldNormY;

  if (isFrontHit) {
    if (car.isFlipping) {
      // 🚀 FRONT FLIP (KICK): impulso explosivo — siempre aplica independiente del cooldown
      const flipPower = Math.min(CAR_BALL_CONFIG.maxSpeed, Math.max(500, carSpeed * 1.5 + 460));
      ball.vx = worldNormX * flipPower + car.vx * 0.2;
      ball.vy = worldNormY * flipPower + car.vy * 0.2;
      car.touchCooldown = CAR_CONFIG.touchCooldownMs; // reset cooldown tras el flip
    } else if ((car.touchCooldown || 0) <= 0) {
      // ⚽ Toquecito: solo aplica cuando el cooldown llegó a 0
      // La fuerza depende de la velocidad del auto — más rápido = golpe más fuerte
      const push = Math.max(25, carSpeed * 0.9);
      ball.vx = worldNormX * push + car.vx * 0.25;
      ball.vy = worldNormY * push + car.vy * 0.25;
      // Iniciar cooldown antes del siguiente toque
      car.touchCooldown = CAR_CONFIG.touchCooldownMs;
    }
    // Si el cooldown no llegó a 0: el auto mantiene contacto pero NO empuja la pelota
    // (la separación posicional de arriba ya evita que se solapen)
  } else {
    // Choque lateral o trasero: empuje suave sin cooldown
    if (relDot < 0) {
      const sideImpulse = -(1 + CAR_BALL_CONFIG.playerRestitution) * relDot;
      ball.vx += worldNormX * sideImpulse * 0.5 + car.vx * 0.1;
      ball.vy += worldNormY * sideImpulse * 0.5 + car.vy * 0.1;
    }
  }

  // Limitar velocidad de la pelota
  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  if (ballSpeed > CAR_BALL_CONFIG.maxSpeed) {
    ball.vx = (ball.vx / ballSpeed) * CAR_BALL_CONFIG.maxSpeed;
    ball.vy = (ball.vy / ballSpeed) * CAR_BALL_CONFIG.maxSpeed;
  }
}

