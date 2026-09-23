import React, { useEffect, useRef, useState, useCallback } from 'react';
import { backend } from '../storage.js';
import { COLORS, panelStyle, ghostButton } from '../theme.js';
import { FIELD, GOAL, PLAYER_CONFIG, BALL_CONFIG, createGameState, stepPhysics, resetPositions } from './physics.js';

const TEAM_COLOR = {
  red: '#e05050',
  blue: '#4a90d9',
};
const TEAM_NAME = { red: 'ROJO', blue: 'AZUL' };

// ─── Constantes de render ──────────────────────────────────────────────────
const GRASS_COLOR = '#3a7d44';
const GRASS_STRIPE = '#3f8a4b';
const LINE_COLOR = 'rgba(255,255,255,0.75)';
const LINE_WIDTH = 2;

export default function FutbolGame({ room, code, me, onGoal, onTimeEnd, onBackToLobby, onLeave }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const inputsRef = useRef({});
  const lastSentInputRef = useRef('');
  const lastSyncTimeRef = useRef(0);
  const lastTimeRef = useRef(null);
  const rafRef = useRef(null);
  const goalCooldownRef = useRef(0);  // ms de pausa activa post gol
  const countdownRef = useRef(2000);   // cuenta regresiva inicial (2 segundos)
  const timeLeftRef = useRef(room.options.matchMinutes * 60 * 1000);
  const scoreRef = useRef({ red: room.score.red, blue: room.score.blue });
  const camRef = useRef({ x: FIELD.width / 2, y: FIELD.height / 2 });

  const isHost = room.hostId === me?.id;
  const players = room.players;

  // Sincronizar score de sala al estado local
  useEffect(() => {
    scoreRef.current = { red: room.score.red, blue: room.score.blue };
  }, [room.score.red, room.score.blue]);

  // Sincronización en tiempo real
  useEffect(() => {
    if (!code) return;
    return backend.subscribeFutbolSync(code, (data) => {
      if (data.inputs) {
        inputsRef.current = { ...inputsRef.current, ...data.inputs };
      }
      if (!isHost && data.state && stateRef.current) {
        const hState = data.state;
        const cli = stateRef.current;
        // Soft lerp para corregir desincronización
        const dx = hState.ball.x - cli.ball.x;
        const dy = hState.ball.y - cli.ball.y;
        if (Math.hypot(dx, dy) > 80) {
          stateRef.current = hState; // Snap brusco si se desincronizó demasiado
        } else {
          cli.ball.x += dx * 0.25;
          cli.ball.y += dy * 0.25;
          cli.ball.vx = hState.ball.vx;
          cli.ball.vy = hState.ball.vy;
          Object.keys(hState.players).forEach(pid => {
            const pHost = hState.players[pid];
            const pCli = cli.players[pid];
            if (pCli && pHost) {
              pCli.x += (pHost.x - pCli.x) * 0.25;
              pCli.y += (pHost.y - pCli.y) * 0.25;
              pCli.vx = pHost.vx;
              pCli.vy = pHost.vy;
            }
          });
        }
      }
    });
  }, [code, isHost]);

  // Estado de render para el HUD
  const [hudTime, setHudTime] = useState(room.options.matchMinutes * 60 * 1000);
  const [hudScore, setHudScore] = useState({ red: room.score.red, blue: room.score.blue });
  const [goalMsg, setGoalMsg] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  // Tamaño del canvas
  const [canvasSize, setCanvasSize] = useState({ w: FIELD.width, h: FIELD.height });

  useEffect(() => {
    function computeSize() {
      const maxW = Math.min(window.innerWidth - 8, 1200);
      const maxH = Math.min(window.innerHeight - 90, 750);
      setCanvasSize({ w: Math.max(600, maxW), h: Math.max(400, maxH) });
    }
    computeSize();
    window.addEventListener('resize', computeSize);
    return () => window.removeEventListener('resize', computeSize);
  }, []);

  // ─── Controles de teclado ─────────────────────────────────────────────
  useEffect(() => {
    const myPlayer = me ? players.find((p) => p.id === me.id) : players[0];
    const targetId = myPlayer?.id || players[0]?.id;

    function syncMyInput(inp) {
      if (!me || !code) return;
      const current = JSON.stringify(inp);
      if (lastSentInputRef.current !== current) {
        lastSentInputRef.current = current;
        backend.setFutbolInput(code, me.id, inp).catch(() => {});
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMenu((prev) => !prev);
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
      }

      if (targetId) {
        if (!inputsRef.current[targetId]) inputsRef.current[targetId] = {};
        const inp = inputsRef.current[targetId];
        let changed = false;
        if ((e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && !inp.up) { inp.up = true; changed = true; }
        if ((e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') && !inp.down) { inp.down = true; changed = true; }
        if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && !inp.left) { inp.left = true; changed = true; }
        if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && !inp.right) { inp.right = true; changed = true; }
        if ((e.key === ' ' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') && !inp.kick) { inp.kick = true; changed = true; }
        if (changed) syncMyInput(inp);
      }
    }

    function onKeyUp(e) {
      if (targetId) {
        if (!inputsRef.current[targetId]) inputsRef.current[targetId] = {};
        const inp = inputsRef.current[targetId];
        let changed = false;
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') { inp.up = false; changed = true; }
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') { inp.down = false; changed = true; }
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { inp.left = false; changed = true; }
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { inp.right = false; changed = true; }
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') { inp.kick = false; changed = true; }
        if (changed) syncMyInput(inp);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [players, me, code]);

  // ─── Game loop ────────────────────────────────────────────────────────
  useEffect(() => {
    stateRef.current = createGameState(players);
    timeLeftRef.current = room.options.matchMinutes * 60 * 1000;
    goalCooldownRef.current = 0;
    countdownRef.current = 2000; // 2 segundos iniciales
    lastTimeRef.current = null;
    camRef.current = { x: FIELD.width / 2, y: FIELD.height / 2 };

    const canvas = canvasRef.current;

    function loop(timestamp) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const rawDt = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      const dt = Math.min(rawDt, 50);

      const ctx = canvas.getContext('2d');

      // 1. Cuenta regresiva previa al inicio o reinicio
      if (countdownRef.current > 0) {
        countdownRef.current -= dt;
        updateCamera(stateRef.current, dt);
        renderScene(ctx, stateRef.current, countdownText(countdownRef.current));
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // 2. Pausa post-gol
      if (goalCooldownRef.current > 0) {
        goalCooldownRef.current -= dt;
        if (goalCooldownRef.current <= 0) {
          goalCooldownRef.current = 0;
          stateRef.current = resetPositions(stateRef.current, players);
          setGoalMsg(null);
          countdownRef.current = 1500; // Pequeña cuenta regresiva tras el gol
        }
        updateCamera(stateRef.current, dt);
        renderScene(ctx, stateRef.current, goalMsg || '¡GOL!');
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // 3. Actualizar tiempo del partido
      if (timeLeftRef.current > 0) {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - dt);
        setHudTime(timeLeftRef.current);
      }

      // 4. Paso de física
      const { nextState, goal } = stepPhysics(stateRef.current, inputsRef.current, dt);
      stateRef.current = nextState;

      // 4.5. Host transmite el estado (20 veces por segundo aprox)
      if (isHost && code && (timestamp - lastSyncTimeRef.current > 50)) {
        lastSyncTimeRef.current = timestamp;
        backend.setFutbolState(code, stateRef.current).catch(() => {});
      }

      // 5. Detectar gol
      if (goal) {
        scoreRef.current = {
          ...scoreRef.current,
          [goal]: (scoreRef.current[goal] || 0) + 1,
        };
        setHudScore({ ...scoreRef.current });
        setGoalMsg(`¡GOL DE ${TEAM_NAME[goal]}!`);
        goalCooldownRef.current = 2000;
        onGoal(goal);
      }

      // 6. Detectar fin de tiempo
      if (timeLeftRef.current <= 0) {
        updateCamera(stateRef.current, dt);
        renderScene(ctx, stateRef.current, '¡FIN DEL PARTIDO!');
        onTimeEnd();
        return;
      }

      updateCamera(stateRef.current, dt);
      renderScene(ctx, stateRef.current, null);
      rafRef.current = requestAnimationFrame(loop);
    }

    function updateCamera(state, dt) {
      // Enfocar en el jugador actual (`me`), o el primer jugador rojo, o la pelota
      const target = (me && state.players[me.id]) || Object.values(state.players)[0] || state.ball;
      if (!target) return;

      // Movimiento suave con lerp (más alto = más rápido, 0.08 es muy fluido)
      const factor = 1 - Math.pow(0.01, dt / 1000);
      camRef.current.x += (target.x - camRef.current.x) * factor;
      camRef.current.y += (target.y - camRef.current.y) * factor;
    }

    function renderScene(ctx, state, overlayMessage) {
      ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

      // Calcular zoom de la cámara para que el seguimiento suave sea inmersivo
      const baseZoom = Math.max(0.8, Math.min(canvasSize.w / 900, canvasSize.h / 580));
      const zoom = baseZoom * 1.15; // Ligero zoom para que la cámara siga al jugador naturalmente

      // Clamp de la cámara para que no se salga excesivamente del campo
      const viewW = canvasSize.w / zoom;
      const viewH = canvasSize.h / zoom;
      const pad = 60;
      const minX = Math.min(viewW / 2, FIELD.width / 2);
      const maxX = Math.max(viewW / 2, FIELD.width - viewW / 2);
      const minY = Math.min(viewH / 2, FIELD.height / 2);
      const maxY = Math.max(viewH / 2, FIELD.height - viewH / 2);

      const cx = Math.max(minX - pad, Math.min(maxX + pad, camRef.current.x));
      const cy = Math.max(minY - pad, Math.min(maxY + pad, camRef.current.y));

      ctx.save();
      ctx.translate(canvasSize.w / 2, canvasSize.h / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);

      // Dibujar mundo
      drawField(ctx);
      drawGoals(ctx);
      Object.values(state.players).forEach((p) => {
        const inp = inputsRef.current[p.id];
        drawPlayer(ctx, p, inp?.kick);
      });
      drawBall(ctx, state.ball);

      ctx.restore();

      // Overlay de mensaje (Cuenta regresiva o GOL)
      if (overlayMessage) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, canvasSize.h / 2 - 50, canvasSize.w, 100);

        ctx.font = 'bold 42px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f0d36b';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 10;
        ctx.fillText(overlayMessage, canvasSize.w / 2, canvasSize.h / 2);
        ctx.restore();
      }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [players, room.options.matchMinutes, canvasSize.w, canvasSize.h, me, code, isHost]);

  return (
    <div style={{ background: '#121212', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
      {/* HUD: ROJO  0 - 0  AZUL y tiempo visible */}
      <div style={{
        width: canvasSize.w,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#181818',
        borderBottom: '2px solid #2e2e2e',
        fontFamily: 'monospace',
      }}>
        {/* Lado Rojo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: TEAM_COLOR.red, boxShadow: `0 0 8px ${TEAM_COLOR.red}` }} />
          <span style={{ color: TEAM_COLOR.red, fontWeight: 700, fontSize: 20 }}>ROJO</span>
        </div>

        {/* Marcador central y Reloj */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 32, letterSpacing: 4, lineHeight: 1 }}>
            {hudScore.red} - {hudScore.blue}
          </div>
          <div style={{ color: '#d4af37', fontSize: 16, fontWeight: 700, marginTop: 4 }}>
            {formatTime(hudTime)}
          </div>
        </div>

        {/* Lado Azul y Botón Menú */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: TEAM_COLOR.blue, fontWeight: 700, fontSize: 20 }}>AZUL</span>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: TEAM_COLOR.blue, boxShadow: `0 0 8px ${TEAM_COLOR.blue}` }} />
          </div>
          <button
            type="button"
            className="cs-btn"
            onClick={() => setShowMenu((prev) => !prev)}
            style={{
              ...ghostButton,
              padding: '5px 10px',
              fontSize: 12,
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            ⚙️ Menú (ESC)
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        style={{ display: 'block', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.6)', marginTop: 4 }}
      />

      {/* Indicador de controles */}
      <div style={{ color: '#888', fontSize: 13, fontFamily: 'monospace', marginTop: 10 }}>
        Controles: <b>WASD</b> para moverte &nbsp;·&nbsp; <b>Espacio</b> para patear &nbsp;·&nbsp; <b>ESC</b> menú
      </div>

      {/* Menú de opciones (ESC) - No pausa el partido */}
      {showMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(2px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMenu(false);
          }}
        >
          <div
            style={{
              ...panelStyle,
              padding: '28px 24px',
              maxWidth: 360,
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
              border: `1px solid ${COLORS.gold}`,
            }}
          >
            <div className="cs-mono" style={{ fontSize: 12, color: COLORS.gold, marginBottom: 6, letterSpacing: 1 }}>
              OPCIONES (ESC)
            </div>
            <h2 className="cs-mono" style={{ fontSize: 24, margin: '0 0 20px', color: COLORS.cream }}>
              ⚽ Menú de Partida
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="cs-btn"
                onClick={() => setShowMenu(false)}
                style={{
                  padding: '12px 18px',
                  borderRadius: 4,
                  background: COLORS.gold,
                  color: COLORS.ink,
                  fontWeight: 700,
                  fontSize: 15,
                  border: `1px solid ${COLORS.gold}`,
                  cursor: 'pointer',
                }}
              >
                Volver al juego
              </button>

              <button
                type="button"
                className="cs-btn"
                onClick={() => {
                  setShowMenu(false);
                  if (onBackToLobby) onBackToLobby();
                }}
                style={{
                  ...ghostButton,
                  padding: '12px 18px',
                  fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                Volver a la sala
              </button>

              <button
                type="button"
                className="cs-btn"
                onClick={() => {
                  setShowMenu(false);
                  if (onLeave) onLeave();
                }}
                style={{
                  ...ghostButton,
                  padding: '12px 18px',
                  fontSize: 15,
                  color: COLORS.error,
                  borderColor: COLORS.error,
                  cursor: 'pointer',
                }}
              >
                Salir
              </button>
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: COLORS.muted }}>
              El partido sigue en curso de fondo
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function countdownText(ms) {
  const sec = Math.ceil(ms / 1000);
  if (sec <= 0) return '¡A JUGAR!';
  return String(sec);
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Funciones de dibujo ───────────────────────────────────────────────────
function drawField(ctx) {
  const w = FIELD.width;
  const h = FIELD.height;

  // Fondo de césped con rayas
  ctx.fillStyle = GRASS_COLOR;
  ctx.fillRect(0, 0, w, h);

  // Rayas de césped (decorativas)
  const stripeW = 70;
  ctx.fillStyle = GRASS_STRIPE;
  for (let x = 0; x < w; x += stripeW * 2) {
    ctx.fillRect(x, 0, stripeW, h);
  }

  const wt = FIELD.wallThickness;

  // Paredes exteriores
  ctx.fillStyle = '#224a2b';
  ctx.fillRect(0, 0, w, wt);               // arriba
  ctx.fillRect(0, h - wt, w, wt);           // abajo
  ctx.fillRect(0, wt, wt, h - wt * 2);      // izquierda
  ctx.fillRect(w - wt, wt, wt, h - wt * 2); // derecha

  // Líneas del campo
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = LINE_WIDTH;

  // Borde interior del campo
  ctx.strokeRect(wt, wt, w - wt * 2, h - wt * 2);

  // Línea del medio
  const cx = w / 2;
  const cy = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, wt);
  ctx.lineTo(cx, h - wt);
  ctx.stroke();

  // Círculo central
  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, Math.PI * 2);
  ctx.stroke();

  // Punto central
  ctx.fillStyle = LINE_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  // Áreas de gol
  const areaW = 120;
  const areaH = GOAL.height + 80;
  // Área izquierda
  ctx.strokeRect(wt, cy - areaH / 2, areaW, areaH);
  // Área derecha
  ctx.strokeRect(w - wt - areaW, cy - areaH / 2, areaW, areaH);
}

function drawGoals(ctx) {
  const w = FIELD.width;
  const cy = FIELD.height / 2;
  const wt = FIELD.wallThickness;
  const goalHalf = GOAL.height / 2;
  const goalDepth = 28;

  // Arco izquierdo (el equipo ROJO defiende este arco)
  ctx.fillStyle = 'rgba(224, 80, 80, 0.18)';
  ctx.fillRect(0, cy - goalHalf, wt + goalDepth, GOAL.height);
  ctx.strokeStyle = TEAM_COLOR.red;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(wt, cy - goalHalf);
  ctx.lineTo(wt - goalDepth, cy - goalHalf);
  ctx.lineTo(wt - goalDepth, cy + goalHalf);
  ctx.lineTo(wt, cy + goalHalf);
  ctx.stroke();

  // Postes del arco izquierdo
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(wt, cy - goalHalf, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(wt, cy + goalHalf, 5, 0, Math.PI * 2);
  ctx.fill();

  // Arco derecho (el equipo AZUL defiende este arco)
  ctx.fillStyle = 'rgba(74, 144, 217, 0.18)';
  ctx.fillRect(w - wt - goalDepth, cy - goalHalf, wt + goalDepth, GOAL.height);
  ctx.strokeStyle = TEAM_COLOR.blue;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w - wt, cy - goalHalf);
  ctx.lineTo(w - wt + goalDepth, cy - goalHalf);
  ctx.lineTo(w - wt + goalDepth, cy + goalHalf);
  ctx.lineTo(w - wt, cy + goalHalf);
  ctx.stroke();

  // Postes del arco derecho
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w - wt, cy - goalHalf, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w - wt, cy + goalHalf, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, player, isKicking) {
  const color = TEAM_COLOR[player.team] || '#888';
  const r = PLAYER_CONFIG.radius;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(player.x + 2, player.y + 4, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Efecto kick (anillo blanco alrededor del jugador cuando patea)
  if (isKicking || (player.kickCooldown > 300)) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cuerpo del jugador
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Borde
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inicial del nombre
  const initial = (player.name || '?')[0].toUpperCase();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${r}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, player.x, player.y);
}

function drawBall(ctx, ball) {
  const r = BALL_CONFIG.radius;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(ball.x + 2, ball.y + 3, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pelota blanca
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Hexágono negro decorativo (estilo pelota de fútbol)
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, r * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Borde
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  ctx.stroke();
}
