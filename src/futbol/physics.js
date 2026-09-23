// Motor de física puro para el juego de fútbol.
// Sin side effects, sin React, sin DOM.
// Toda la simulación vive en objetos planos de JS.

// ─── Dimensiones del mundo (unidades lógicas) ─────────────────────────────
export const FIELD = {
  width: 1050,
  height: 680,
  wallThickness: 14,
};

// Arcos: centrados verticalmente en cada extremo
export const GOAL = {
  width: 12,       // profundidad del arco (eje X)
  height: 180,     // apertura del arco (eje Y)
};

// Postes del arco izquierdo (equipo azul defiende este arco → rojo anota aquí)
export function leftGoalPosts() {
  const cx = FIELD.wallThickness;
  const cy = FIELD.height / 2;
  return {
    top: cy - GOAL.height / 2,
    bottom: cy + GOAL.height / 2,
    x: cx,
  };
}

// Postes del arco derecho (equipo rojo defiende → azul anota)
export function rightGoalPosts() {
  const cx = FIELD.width - FIELD.wallThickness;
  const cy = FIELD.height / 2;
  return {
    top: cy - GOAL.height / 2,
    bottom: cy + GOAL.height / 2,
    x: cx,
  };
}

// ─── Constantes de jugadores y pelota ─────────────────────────────────────
export const PLAYER_CONFIG = {
  radius: 16,
  mass: 1.0,
  maxSpeed: 210,        // reducido a la mitad
  accel: 1800,          // reducido a la mitad
  friction: 0.90,       // factor de velocidad conservado por 1/60s
  kickRange: 35,        // distancia desde el borde del jugador hasta el borde de la pelota
  kickForce: 720,

  kickCooldown: 350,    // ms
  restitution: 0.35,    // rebote jugador-jugador
};

export const BALL_CONFIG = {
  radius: 11,
  mass: 0.45,
  friction: 0.985,      // la pelota frena muy poco (rueda largo)
  wallRestitution: 0.72,
  playerRestitution: 0.78,
};

// ─── Posiciones iniciales ──────────────────────────────────────────────────
// Los jugadores se posicionan en una cuadrícula en su mitad de la cancha.
// Esta función acepta un array de { id, name, team } y devuelve el estado inicial.
export function createGameState(players) {
  const reds = players.filter((p) => p.team === 'red');
  const blues = players.filter((p) => p.team === 'blue');

  const cx = FIELD.width / 2;
  const cy = FIELD.height / 2;

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
    players: playerStates,
    ball: {
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
    },
    goalCooldown: 0,   // ms restantes de pausa post-gol
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
    kickCooldown: 0,   // ms restantes hasta poder patear de nuevo
  };
}

// Distribuye N jugadores en posiciones alrededor de un punto central
function spreadPositions(count, centerX, centerY, side) {
  if (count === 0) return [];
  const spacing = 90;
  const positions = [];
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const yOffset = (i - half) * spacing;
    // Alternar ligeramente en X para que no estén todos en la misma línea
    const xOffset = (i % 2 === 0 ? 0 : (side === 'left' ? -40 : 40));
    positions.push({ x: centerX + xOffset, y: centerY + yOffset });
  }
  return positions;
}

// Resetea posiciones de todos los jugadores y la pelota (tras un gol)
export function resetPositions(state, players) {
  const reds = players.filter((p) => p.team === 'red');
  const blues = players.filter((p) => p.team === 'blue');

  const cx = FIELD.width / 2;
  const cy = FIELD.height / 2;

  const redPositions = spreadPositions(reds.length, cx - 180, cy, 'left');
  const bluePositions = spreadPositions(blues.length, cx + 180, cy, 'right');

  const next = { ...state, players: { ...state.players } };

  reds.forEach((p, i) => {
    next.players[p.id] = {
      ...next.players[p.id],
      x: redPositions[i].x,
      y: redPositions[i].y,
      vx: 0,
      vy: 0,
      kickCooldown: 0,
    };
  });
  blues.forEach((p, i) => {
    next.players[p.id] = {
      ...next.players[p.id],
      x: bluePositions[i].x,
      y: bluePositions[i].y,
      vx: 0,
      vy: 0,
      kickCooldown: 0,
    };
  });

  next.ball = { x: cx, y: cy, vx: 0, vy: 0 };
  return next;
}

// ─── Paso de simulación ────────────────────────────────────────────────────
// inputs: { [playerId]: { up, down, left, right, kick } }
// dt: milisegundos desde el último frame
// Devuelve { nextState, goal: null | 'red' | 'blue' }
export function stepPhysics(state, inputs, dt) {
  const s = dt / 1000; // segundos
  const next = deepClone(state);

  // Actualizar cooldowns
  Object.values(next.players).forEach((p) => {
    if (p.kickCooldown > 0) p.kickCooldown = Math.max(0, p.kickCooldown - dt);
  });

  // 1. Mover jugadores según inputs
  Object.values(next.players).forEach((player) => {
    const input = inputs[player.id] || {};
    let ax = 0;
    let ay = 0;
    if (input.left) ax -= PLAYER_CONFIG.accel;
    if (input.right) ax += PLAYER_CONFIG.accel;
    if (input.up) ay -= PLAYER_CONFIG.accel;
    if (input.down) ay += PLAYER_CONFIG.accel;

    // Normalizar diagonal para que no sea más rápido
    if (ax !== 0 && ay !== 0) {
      ax /= Math.SQRT2;
      ay /= Math.SQRT2;
    }

    player.vx += ax * s;
    player.vy += ay * s;

    // Fricción exponencial independiente de los FPS
    const pFriction = Math.pow(PLAYER_CONFIG.friction, s * 60);
    player.vx *= pFriction;
    player.vy *= pFriction;

    // Limitar velocidad máxima
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER_CONFIG.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER_CONFIG.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER_CONFIG.maxSpeed;
    }

    player.x += player.vx * s;
    player.y += player.vy * s;
  });

  // 2. Mover pelota
  next.ball.vx *= Math.pow(BALL_CONFIG.friction, s * 60); // independiente del fps
  next.ball.vy *= Math.pow(BALL_CONFIG.friction, s * 60);
  next.ball.x += next.ball.vx * s;
  next.ball.y += next.ball.vy * s;

  // 3. Colisiones jugadores con paredes del campo
  Object.values(next.players).forEach((player) => {
    resolvePlayerWall(player);
  });

  // 4. Colisiones pelota con paredes (con manejo especial de arcos)
  resolveBallWall(next.ball);

  // 5. Colisiones jugador-jugador
  const playerList = Object.values(next.players);
  for (let i = 0; i < playerList.length; i++) {
    for (let j = i + 1; j < playerList.length; j++) {
      resolvePlayerPlayer(playerList[i], playerList[j]);
    }
  }

  // 6. Colisiones jugador-pelota
  playerList.forEach((player) => {
    resolvePlayerBall(player, next.ball);
  });

  // 7. Kicks
  playerList.forEach((player) => {
    const input = inputs[player.id] || {};
    if (input.kick && player.kickCooldown === 0) {
      tryKick(player, next.ball);
    }
  });

  // 8. Detectar gol
  const goal = detectGoal(next.ball);

  return { nextState: next, goal };
}

// ─── Resolución de colisiones ──────────────────────────────────────────────

function resolvePlayerWall(player) {
  const r = PLAYER_CONFIG.radius;
  const w = FIELD.wallThickness;

  // Paredes izquierda y derecha (sólidas, sin arco para jugadores)
  if (player.x - r < w) {
    player.x = w + r;
    player.vx = Math.abs(player.vx) * 0.4;
  }
  if (player.x + r > FIELD.width - w) {
    player.x = FIELD.width - w - r;
    player.vx = -Math.abs(player.vx) * 0.4;
  }

  // Paredes arriba y abajo
  if (player.y - r < w) {
    player.y = w + r;
    player.vy = Math.abs(player.vy) * 0.4;
  }
  if (player.y + r > FIELD.height - w) {
    player.y = FIELD.height - w - r;
    player.vy = -Math.abs(player.vy) * 0.4;
  }
}

function resolveBallWall(ball) {
  const r = BALL_CONFIG.radius;
  const w = FIELD.wallThickness;
  const cy = FIELD.height / 2;
  const goalHalf = GOAL.height / 2;
  const goalTop = cy - goalHalf;
  const goalBottom = cy + goalHalf;

  // Pared izquierda: arco o pared sólida
  if (ball.x - r < w) {
    if (ball.y > goalTop && ball.y < goalBottom) {
      // Dentro del área del arco izquierdo → la pelota puede entrar
      // Si salió completamente del campo → gol (detectado en detectGoal)
      if (ball.x + r < 0) {
        // Está completamente afuera, no hacer nada (gol ya detectado)
      }
    } else {
      ball.x = w + r;
      ball.vx = Math.abs(ball.vx) * BALL_CONFIG.wallRestitution;
    }
  }

  // Pared derecha: arco o pared sólida
  if (ball.x + r > FIELD.width - w) {
    if (ball.y > goalTop && ball.y < goalBottom) {
      // Dentro del área del arco derecho → puede entrar
    } else {
      ball.x = FIELD.width - w - r;
      ball.vx = -Math.abs(ball.vx) * BALL_CONFIG.wallRestitution;
    }
  }

  // Pared superior
  if (ball.y - r < w) {
    ball.y = w + r;
    ball.vy = Math.abs(ball.vy) * BALL_CONFIG.wallRestitution;
  }

  // Pared inferior
  if (ball.y + r > FIELD.height - w) {
    ball.y = FIELD.height - w - r;
    ball.vy = -Math.abs(ball.vy) * BALL_CONFIG.wallRestitution;
  }

  // Bordes de los postes (esquinas internas del arco)
  // Arco izquierdo
  resolveCircleWithGoalPost(ball, r, w, goalTop, false);   // poste superior izquierdo
  resolveCircleWithGoalPost(ball, r, w, goalBottom, true); // poste inferior izquierdo
  // Arco derecho
  resolveCircleWithGoalPost(ball, r, FIELD.width - w, goalTop, false);
  resolveCircleWithGoalPost(ball, r, FIELD.width - w, goalBottom, true);
}

// Colisión con un poste (punto fijo) del arco
function resolveCircleWithGoalPost(ball, r, postX, postY, isBottom) {
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

  // Separar
  const overlap = minDist - dist;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  // Impulso
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
  const dist = Math.hypot(dx, dy);
  const minDist = pr + br;

  if (dist >= minDist || dist === 0) return;

  const nx = dx / dist;
  const ny = dy / dist;

  // Separar
  const overlap = minDist - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;

  // Impulso basado en velocidad relativa
  const rvx = ball.vx - player.vx;
  const rvy = ball.vy - player.vy;
  const dot = rvx * nx + rvy * ny;
  if (dot >= 0) return;

  const totalMass = PLAYER_CONFIG.mass + BALL_CONFIG.mass;
  const j = -(1 + BALL_CONFIG.playerRestitution) * dot / totalMass;

  // Solo la pelota recibe el impulso completo (el jugador lo absorbe)
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

  if (dist > kickDist || dist === 0) return;

  const nx = dx / dist;
  const ny = dy / dist;

  // Fuerza del kick en dirección del centro del jugador a la pelota
  ball.vx += nx * PLAYER_CONFIG.kickForce;
  ball.vy += ny * PLAYER_CONFIG.kickForce;

  // Limitar velocidad máxima de la pelota tras el kick
  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  const maxBallSpeed = 1100;
  if (ballSpeed > maxBallSpeed) {
    ball.vx = (ball.vx / ballSpeed) * maxBallSpeed;
    ball.vy = (ball.vy / ballSpeed) * maxBallSpeed;
  }

  player.kickCooldown = PLAYER_CONFIG.kickCooldown;
}

// Devuelve 'red' (anotó rojo, pelota entró en arco izquierdo → gol en arco azul)
// o 'blue' (pelota entró en arco derecho) o null
function detectGoal(ball) {
  const r = BALL_CONFIG.radius;
  const cy = FIELD.height / 2;
  const goalHalf = GOAL.height / 2;
  const goalTop = cy - goalHalf;
  const goalBottom = cy + goalHalf;
  const w = FIELD.wallThickness;

// Arco izquierdo: el equipo rojo defiende acá. Si entra, gol de AZUL.
  if (ball.x < w && ball.y > goalTop && ball.y < goalBottom) {
    return 'blue';
  }

  // Arco derecho: el equipo azul defiende acá. Si entra, gol de ROJO.
  if (ball.x > FIELD.width - w && ball.y > goalTop && ball.y < goalBottom) {
    return 'red';
  }

  return null;
}


// ─── Utilidades ────────────────────────────────────────────────────────────
function deepClone(obj) {
  // Clonado eficiente para el estado de física (objetos planos)
  const next = { ...obj };
  next.players = {};
  Object.entries(obj.players).forEach(([id, p]) => {
    next.players[id] = { ...p };
  });
  next.ball = { ...obj.ball };
  return next;
}
