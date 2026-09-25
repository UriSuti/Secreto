import React, { useEffect, useRef, useState, useCallback } from 'react';
import { backend } from '../storage.js';
import { COLORS, panelStyle, ghostButton } from '../theme.js';
import { FIELD, GOAL, PLAYER_CONFIG, CAR_CONFIG, BALL_CONFIG, CAR_BALL_CONFIG, createGameState, stepPhysics, resetPositions } from './physics.js';

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
  const isCarMode = room.options?.vehicleMode === 'coches';
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const inputsRef = useRef({});
  const lastSentInputRef = useRef('');
  const lastSyncTimeRef = useRef(0);
  const lastTimeRef = useRef(null);
  const rafRef = useRef(null);
  const goalCooldownRef = useRef(0);  // ms de pausa activa post gol
  const countdownRef = useRef(2000);   // cuenta regresiva inicial (2 segundos)
  const matchMinutes = Number(room.options?.matchMinutes ?? 0);
  const isTimeUnlimited = matchMinutes <= 0;
  const initialTimeMs = isTimeUnlimited ? 0 : matchMinutes * 60 * 1000;
  const timeLeftRef = useRef(initialTimeMs);
  const elapsedTimeRef = useRef(0);
  const scoreRef = useRef({ red: room.score.red, blue: room.score.blue });
  const camRef = useRef({ x: FIELD.width / 2, y: FIELD.height / 2 });
  const zoomScaleRef = useRef(1.0);
  const zoomKeysRef = useRef({ zoomIn: false, zoomOut: false });
  const [rotateCamera, setRotateCamera] = useState(isCarMode);
  const rotateCameraRef = useRef(isCarMode);

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
          if (hState.boostPickups) {
            cli.boostPickups = hState.boostPickups;
          }
          Object.keys(hState.players).forEach(pid => {
            const pHost = hState.players[pid];
            const pCli = cli.players[pid];
            if (pCli && pHost) {
              pCli.x += (pHost.x - pCli.x) * 0.25;
              pCli.y += (pHost.y - pCli.y) * 0.25;
              pCli.vx = pHost.vx;
              pCli.vy = pHost.vy;
              if (pHost.angle !== undefined) {
                pCli.angle = pHost.angle;
                pCli.steerAngle = pHost.steerAngle;
                pCli.speed = pHost.speed;
                pCli.boost = pHost.boost;
                pCli.isBoosting = pHost.isBoosting;
                pCli.isFlipping = pHost.isFlipping;
                pCli.flipTime = pHost.flipTime;
                pCli.flipCooldown = pHost.flipCooldown;
              }
            }
          });
        }
      }
    });
  }, [code, isHost]);

  // Estado de render para el HUD
  const [hudTime, setHudTime] = useState(initialTimeMs);
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

        if (isCarMode) {
          // W o ArrowUp: avanzar adelante (hacia donde apunta el auto)
          if ((e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && !inp.accelerate) { inp.accelerate = true; changed = true; }
          // S o ArrowDown: retroceder / frenar (dirección contraria a donde vas con W)
          if ((e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') && !inp.brake) { inp.brake = true; changed = true; }
          // A o ArrowLeft: girar izquierda (antihorario)
          if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && !inp.turnLeft) { inp.turnLeft = true; changed = true; }
          // D o ArrowRight: girar derecha (horario)
          if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && !inp.turnRight) { inp.turnRight = true; changed = true; }
          // Shift: BOOST continuo
          if (e.key === 'Shift' && !inp.boost) { inp.boost = true; changed = true; }
          // Space / Enter / X: KICK / FLIP aéreo
          if ((e.key === ' ' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') && !inp.kick) { inp.kick = true; changed = true; }
        } else {
          if ((e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && !inp.up) { inp.up = true; changed = true; }
          if ((e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') && !inp.down) { inp.down = true; changed = true; }
          if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && !inp.left) { inp.left = true; changed = true; }
          if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && !inp.right) { inp.right = true; changed = true; }
          if ((e.key === ' ' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') && !inp.kick) { inp.kick = true; changed = true; }
          if (e.key === 'Shift' && !inp.shift) { inp.shift = true; changed = true; }
        }

        if (e.key === 'q' || e.key === 'Q') { zoomKeysRef.current.zoomOut = true; }
        if (e.key === 'e' || e.key === 'E') { zoomKeysRef.current.zoomIn = true; }
        if (isCarMode && (e.key === 'c' || e.key === 'C')) {
          setRotateCamera((prev) => {
            const next = !prev;
            rotateCameraRef.current = next;
            return next;
          });
        }
        if (changed) syncMyInput(inp);
      }
    }

    function onKeyUp(e) {
      if (e.key === 'q' || e.key === 'Q') { zoomKeysRef.current.zoomOut = false; }
      if (e.key === 'e' || e.key === 'E') { zoomKeysRef.current.zoomIn = false; }
      if (targetId) {
        if (!inputsRef.current[targetId]) inputsRef.current[targetId] = {};
        const inp = inputsRef.current[targetId];
        let changed = false;

        if (isCarMode) {
          if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') { inp.accelerate = false; changed = true; }
          if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') { inp.brake = false; changed = true; }
          if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { inp.turnLeft = false; changed = true; }
          if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { inp.turnRight = false; changed = true; }
          if (e.key === 'Shift') { inp.boost = false; changed = true; }
          if (e.key === ' ' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') { inp.kick = false; changed = true; }
        } else {
          if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') { inp.up = false; changed = true; }
          if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') { inp.down = false; changed = true; }
          if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { inp.left = false; changed = true; }
          if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { inp.right = false; changed = true; }
          if (e.key === ' ' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') { inp.kick = false; changed = true; }
          if (e.key === 'Shift') { inp.shift = false; changed = true; }
        }

        if (changed) syncMyInput(inp);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [players, me, code, isCarMode]);

  // ─── Game loop ────────────────────────────────────────────────────────
  useEffect(() => {
    stateRef.current = createGameState(players, room.options);
    timeLeftRef.current = initialTimeMs;
    elapsedTimeRef.current = 0;
    goalCooldownRef.current = 0;
    countdownRef.current = 2000; // 2 segundos iniciales
    lastTimeRef.current = null;
    camRef.current = { x: FIELD.width / 2, y: FIELD.height / 2 };

    const canvas = canvasRef.current;

    function onWheel(e) {
      e.preventDefault();
      if (e.deltaY > 0) {
        // Ruedita abajo -> alejar (Zoom Out)
        zoomScaleRef.current = Math.max(0.4, zoomScaleRef.current - 0.08);
      } else if (e.deltaY < 0) {
        // Ruedita arriba -> acercar (Zoom In)
        zoomScaleRef.current = Math.min(2.5, zoomScaleRef.current + 0.08);
      }
    }

    if (canvas) {
      canvas.addEventListener('wheel', onWheel, { passive: false });
    }

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
      if (!isTimeUnlimited) {
        if (timeLeftRef.current > 0) {
          timeLeftRef.current = Math.max(0, timeLeftRef.current - dt);
          setHudTime(timeLeftRef.current);
        }
      } else {
        elapsedTimeRef.current += dt;
        setHudTime(elapsedTimeRef.current);
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
        const currentGoalCount = scoreRef.current[goal];
        setHudScore({ ...scoreRef.current });
        setGoalMsg(`¡GOL DE ${TEAM_NAME[goal]}!`);
        goalCooldownRef.current = 2000;
        onGoal(goal);

        // Si se configuraron goles para ganar y se alcanzó la meta
        const goalsToWin = Number(room.options?.goalsToWin || 0);
        if (goalsToWin > 0 && currentGoalCount >= goalsToWin) {
          setTimeout(() => {
            onTimeEnd();
          }, 1800);
        }
      }

      // 6. Detectar fin de tiempo (solo si no es tiempo ilimitado)
      if (!isTimeUnlimited && timeLeftRef.current <= 0) {
        updateCamera(stateRef.current, dt);
        renderScene(ctx, stateRef.current, '¡FIN DEL PARTIDO!');
        onTimeEnd();
        return;
      }

      // Actualizar zoom suave por teclado (Q/E)
      if (zoomKeysRef.current.zoomOut) {
        zoomScaleRef.current = Math.max(0.4, zoomScaleRef.current - 0.02 * (dt / 16));
      }
      if (zoomKeysRef.current.zoomIn) {
        zoomScaleRef.current = Math.min(2.5, zoomScaleRef.current + 0.02 * (dt / 16));
      }

      updateCamera(stateRef.current, dt);
      renderScene(ctx, stateRef.current, null);
      rafRef.current = requestAnimationFrame(loop);
    }

    function updateCamera(state, dt) {
      // Enfocar en el jugador actual (`me`), o el primer jugador rojo, o la pelota
      const target = (me && state.players[me.id]) || Object.values(state.players)[0] || state.ball;
      if (!target) return;

      const isRotatingCam = isCarMode && rotateCameraRef.current;
      if (isRotatingCam) {
        // En modo cámara rotativa nos fijamos directamente al auto para máxima estabilidad sin temblores
        camRef.current.x = target.x;
        camRef.current.y = target.y;
      } else {
        // Movimiento suave con lerp (más alto = más rápido, 0.08 es muy fluido)
        const factor = 1 - Math.pow(0.01, dt / 1000);
        camRef.current.x += (target.x - camRef.current.x) * factor;
        camRef.current.y += (target.y - camRef.current.y) * factor;
      }
    }

    function renderScene(ctx, state, overlayMessage) {
      ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

      const field = state.field || FIELD;
      const isRotatingCam = isCarMode && rotateCameraRef.current;
      const myCar = (me && state.players[me.id]) || Object.values(state.players)[0];

      // Calcular zoom de la cámara teniendo en cuenta la orientación y modo de cámara
      const baseZoom = isRotatingCam
        ? Math.max(0.72, Math.min(canvasSize.w / 720, canvasSize.h / 720))
        : (field.isVertical
            ? Math.max(0.65, Math.min(canvasSize.w / 750, canvasSize.h / 1050))
            : Math.max(0.8, Math.min(canvasSize.w / 900, canvasSize.h / 580)));
      const zoom = baseZoom * 1.15 * zoomScaleRef.current;

      let cx, cy;
      if (isRotatingCam && myCar) {
        cx = camRef.current.x;
        cy = camRef.current.y;
      } else {
        // Clamp de la cámara para que no se salga excesivamente del campo
        const sm = field.sideMargin || 0;
        const viewW = canvasSize.w / zoom;
        const viewH = canvasSize.h / zoom;
        const pad = 60;
        const totalW = field.width + (field.isVertical ? sm * 2 : 0);
        const totalH = field.height + (!field.isVertical ? sm * 2 : 0);
        const minX = Math.min(viewW / 2, totalW / 2) - (field.isVertical ? sm : 0);
        const maxX = Math.max(viewW / 2, totalW - viewW / 2) - (field.isVertical ? sm : 0);
        const minY = Math.min(viewH / 2, totalH / 2) - (!field.isVertical ? sm : 0);
        const maxY = Math.max(viewH / 2, totalH - viewH / 2) - (!field.isVertical ? sm : 0);

        cx = Math.max(minX - pad, Math.min(maxX + pad, camRef.current.x));
        cy = Math.max(minY - pad, Math.min(maxY + pad, camRef.current.y));
      }

      ctx.save();
      // En cámara rotativa ubicamos el auto ligeramente debajo del centro (h * 0.58) para mayor visión frontal
      const screenCenterX = canvasSize.w / 2;
      const screenCenterY = isRotatingCam ? canvasSize.h * 0.58 : canvasSize.h / 2;
      ctx.translate(screenCenterX, screenCenterY);
      ctx.scale(zoom, zoom);

      if (isRotatingCam && myCar) {
        // Rotar la escena: el auto SIEMPRE se ve yendo hacia adelante (arriba en la pantalla)
        const carAngle = myCar.angle ?? -Math.PI / 2;
        ctx.rotate(-Math.PI / 2 - carAngle);
      }

      ctx.translate(-cx, -cy);

      // Dibujar mundo
      drawField(ctx, field);
      if (isCarMode && state.boostPickups) {
        drawBoostPickups(ctx, state.boostPickups);
      }
      drawGoals(ctx, field);
      drawBall(ctx, state.ball, isCarMode);
      Object.values(state.players).forEach((p) => {
        if (isCarMode) {
          drawCar(ctx, p);
        } else {
          drawPlayer(ctx, p, state.options?.stamina);
        }
      });

      ctx.restore();

      // Indicador de pelota fuera de pantalla (flecha + mini pelota si el balón no se ve)
      drawOffscreenBallIndicator(
        ctx,
        state.ball,
        myCar,
        canvasSize,
        zoom,
        screenCenterX,
        screenCenterY,
        cx,
        cy,
        isRotatingCam
      );

      // HUD de Coches (Rocket League Boost Meter & Flip Status)
      if (isCarMode && myCar) {
        drawCarHUD(ctx, myCar, canvasSize);
      }

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
      if (canvas) canvas.removeEventListener('wheel', onWheel);
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

        {/* Lado Azul y Botones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 6 }}>
            <span style={{ color: TEAM_COLOR.blue, fontWeight: 700, fontSize: 20 }}>AZUL</span>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: TEAM_COLOR.blue, boxShadow: `0 0 8px ${TEAM_COLOR.blue}` }} />
          </div>
          {isCarMode && (
            <button
              type="button"
              className="cs-btn"
              onClick={() => setRotateCamera((prev) => {
                const next = !prev;
                rotateCameraRef.current = next;
                return next;
              })}
              title="Presiona 'C' para alternar la cámara en cualquier momento"
              style={{
                ...ghostButton,
                padding: '5px 10px',
                fontSize: 12,
                fontFamily: 'monospace',
                cursor: 'pointer',
                borderColor: rotateCamera ? '#ffd700' : '#444',
                color: rotateCamera ? '#ffd700' : '#888',
              }}
            >
              🎥 {rotateCamera ? 'Cám. Auto (C)' : 'Cám. Fija (C)'}
            </button>
          )}
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
        {isCarMode ? (
          <>
            Controles: <b>W</b> acelerar &nbsp;·&nbsp;
            <b>A / D</b> direccionar ruedas (flecha) &nbsp;·&nbsp;
            <b>S</b> reversa / frenar &nbsp;·&nbsp;
            <b>Shift</b> BOOST &nbsp;·&nbsp;
            <b>Espacio</b> KICK / FLIP &nbsp;·&nbsp;
            <b>C</b> cambiar cámara (auto/fija) &nbsp;·&nbsp;
            <b>Ruedita / Q / E</b> zoom &nbsp;·&nbsp;
            <b>ESC</b> menú
          </>
        ) : (
          <>
            Controles: <b>WASD</b> moverte &nbsp;·&nbsp;
            {room.options.stamina && <><b>Shift</b> correr &nbsp;·&nbsp;</>}
            <b>Espacio</b> patear &nbsp;·&nbsp;
            <b>Ruedita / Q / E</b> zoom &nbsp;·&nbsp;
            <b>ESC</b> menú
          </>
        )}
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
// ─── Funciones de dibujo ───────────────────────────────────────────────────
function drawField(ctx, field = FIELD) {
  const w = field.width;
  const h = field.height;
  const sm = field.sideMargin || 0;

  if (field.isVertical) {
    // Zona lateral exterior (izquierda / derecha)
    if (sm > 0) {
      ctx.fillStyle = '#1a3a1f';
      ctx.fillRect(-sm, 0, sm, h);
      ctx.fillRect(w, 0, sm, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(-sm, 0, w + sm * 2, h);
      ctx.setLineDash([]);
    }

    // Fondo de césped
    ctx.fillStyle = GRASS_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Rayas horizontales de césped
    const stripeH = 70;
    ctx.fillStyle = GRASS_STRIPE;
    for (let y = 0; y < h; y += stripeH * 2) {
      ctx.fillRect(0, y, w, stripeH);
    }

    const wt = field.wallThickness;

    // Paredes exteriores (solo del campo)
    ctx.fillStyle = '#224a2b';
    ctx.fillRect(0, 0, w, wt);               // arriba
    ctx.fillRect(0, h - wt, w, wt);           // abajo
    ctx.fillRect(0, wt, wt, h - wt * 2);      // izquierda
    ctx.fillRect(w - wt, wt, wt, h - wt * 2); // derecha

    // Líneas del campo
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.strokeRect(wt, wt, w - wt * 2, h - wt * 2);

    // Línea del medio (horizontal)
    const cx = w / 2;
    const cy = h / 2;
    ctx.beginPath();
    ctx.moveTo(wt, cy);
    ctx.lineTo(w - wt, cy);
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

    // Áreas de penal (arriba y abajo)
    const areaW = (field.goalWidth || 180) + 80;
    const areaH = 120;
    // Área superior (defiende Azul)
    ctx.strokeRect(cx - areaW / 2, wt, areaW, areaH);
    // Área inferior (defiende Rojo)
    ctx.strokeRect(cx - areaW / 2, h - wt - areaH, areaW, areaH);
    return;
  }

  // Fondo extendido horizontal (zona lateral caminable)
  if (sm > 0) {
    ctx.fillStyle = '#1a3a1f';
    ctx.fillRect(0, -sm, w, sm);
    ctx.fillRect(0, h, w, sm);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(0, -sm, w, h + sm * 2);
    ctx.setLineDash([]);
  }

  // Fondo de césped con rayas verticales
  ctx.fillStyle = GRASS_COLOR;
  ctx.fillRect(0, 0, w, h);

  const stripeW = 70;
  ctx.fillStyle = GRASS_STRIPE;
  for (let x = 0; x < w; x += stripeW * 2) {
    ctx.fillRect(x, 0, stripeW, h);
  }

  const wt = field.wallThickness;

  // Paredes exteriores
  ctx.fillStyle = '#224a2b';
  ctx.fillRect(0, 0, w, wt);               // arriba
  ctx.fillRect(0, h - wt, w, wt);           // abajo
  ctx.fillRect(0, wt, wt, h - wt * 2);      // izquierda
  ctx.fillRect(w - wt, wt, wt, h - wt * 2); // derecha

  // Líneas del campo
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = LINE_WIDTH;
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
  const areaH = field.goalHeight + 80;
  ctx.strokeRect(wt, cy - areaH / 2, areaW, areaH);
  ctx.strokeRect(w - wt - areaW, cy - areaH / 2, areaW, areaH);
}

function drawGoals(ctx, field = FIELD) {
  const w = field.width;
  const h = field.height;
  const wt = field.wallThickness;
  const cx = w / 2;
  const cy = h / 2;

  if (field.isVertical) {
    const goalW = field.goalWidth || 180;
    const goalHalf = goalW / 2;
    const goalDepth = field.goalDepth || 28;

    // Arco superior (el equipo AZUL defiende este arco)
    ctx.fillStyle = 'rgba(74, 144, 217, 0.18)';
    ctx.fillRect(cx - goalHalf, 0, goalW, wt + goalDepth);
    ctx.strokeStyle = TEAM_COLOR.blue;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - goalHalf, wt);
    ctx.lineTo(cx - goalHalf, wt - goalDepth);
    ctx.lineTo(cx + goalHalf, wt - goalDepth);
    ctx.lineTo(cx + goalHalf, wt);
    ctx.stroke();

    // Postes del arco superior
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - goalHalf, wt, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + goalHalf, wt, 5, 0, Math.PI * 2);
    ctx.fill();

    // Arco inferior (el equipo ROJO defiende este arco)
    ctx.fillStyle = 'rgba(224, 80, 80, 0.18)';
    ctx.fillRect(cx - goalHalf, h - wt - goalDepth, goalW, wt + goalDepth);
    ctx.strokeStyle = TEAM_COLOR.red;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - goalHalf, h - wt);
    ctx.lineTo(cx - goalHalf, h - wt + goalDepth);
    ctx.lineTo(cx + goalHalf, h - wt + goalDepth);
    ctx.lineTo(cx + goalHalf, h - wt);
    ctx.stroke();

    // Postes del arco inferior
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - goalHalf, h - wt, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + goalHalf, h - wt, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const goalHalf = field.goalHeight / 2;
  const goalDepth = field.goalDepth || 28;

  // Arco izquierdo (el equipo ROJO defiende este arco)
  ctx.fillStyle = 'rgba(224, 80, 80, 0.18)';
  ctx.fillRect(0, cy - goalHalf, wt + goalDepth, field.goalHeight);
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
  ctx.fillRect(w - wt - goalDepth, cy - goalHalf, wt + goalDepth, field.goalHeight);
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

function drawPlayer(ctx, player, showStaminaBar = false) {
  const color = TEAM_COLOR[player.team] || '#888';
  const r = PLAYER_CONFIG.radius;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(player.x + 2, player.y + 4, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Efecto kick (anillo blanco alrededor del jugador cuando el kick está activo)
  if (player.isKicking) {
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

  // Barra de estámina
  if (showStaminaBar) {
    const st = player.stamina ?? 100;
    const barW = 28;
    const barH = 4;
    const bx = player.x - barW / 2;
    const by = player.y + r + 6;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

    ctx.fillStyle = st > 50 ? '#4cd964' : st > 20 ? '#ffcc00' : '#ff3b30';
    ctx.fillRect(bx, by, (barW * Math.max(0, Math.min(100, st))) / 100, barH);
  }
}

function drawBall(ctx, ball, isCarMode = false) {
  const r = isCarMode ? (CAR_BALL_CONFIG?.radius || 14.5) : BALL_CONFIG.radius;

  // Sombra más profunda para pelota pesada
  ctx.fillStyle = isCarMode ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(ball.x + 2, ball.y + 3, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isCarMode) {
    // Pelota pesada modo Coches: textura técnica / balón estilizado de fútbol
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Pentágono central
    ctx.fillStyle = '#23252a';
    ctx.beginPath();
    const hexR = r * 0.42;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const hx = ball.x + Math.cos(a) * hexR;
      const hy = ball.y + Math.sin(a) * hexR;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();

    // Costuras exteriores
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const hx = ball.x + Math.cos(a) * hexR;
      const hy = ball.y + Math.sin(a) * hexR;
      const ox = ball.x + Math.cos(a) * r;
      const oy = ball.y + Math.sin(a) * r;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(ox, oy);
      ctx.stroke();
    }

    // Borde exterior metálico
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Pelota normal limpia
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBoostPickups(ctx, pickups) {
  const now = Date.now();
  pickups.forEach((p) => {
    if (p.type === 'large') {
      // ─── Pad Grande (+100) ─────────────────────────────────
      ctx.fillStyle = p.active ? 'rgba(35, 25, 12, 0.75)' : 'rgba(20, 20, 20, 0.4)';
      ctx.strokeStyle = p.active ? '#f59e0b' : '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (p.active) {
        // Halo exterior pulsante
        const pulse = Math.sin(now * 0.006 + p.x * 0.1) * 3;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 3 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Orbe central brillante
        const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.radius * 0.65);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#fbbf24');
        grad.addColorStop(1, '#d97706');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Texto '100'
        ctx.fillStyle = '#1a1005';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('100', p.x, p.y);
      } else {
        // Inactivo: arco de cuenta regresiva de respawn
        const pct = 1 - Math.max(0, p.respawnTimer / p.respawnDelay);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.6, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // ─── Pad Pequeño (+12) ─────────────────────────────────
      ctx.fillStyle = p.active ? 'rgba(12, 28, 42, 0.7)' : 'rgba(20, 20, 20, 0.4)';
      ctx.strokeStyle = p.active ? '#38bdf8' : '#333';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (p.active) {
        // Rombo central luminoso
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x + 6, p.y);
        ctx.lineTo(p.x, p.y + 6);
        ctx.lineTo(p.x - 6, p.y);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const pct = 1 - Math.max(0, p.respawnTimer / p.respawnDelay);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.6, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
        ctx.stroke();
      }
    }
  });
}

function drawExhaustFlame(ctx, x, y, len, w) {
  // Llama exterior naranja/fuego
  ctx.fillStyle = '#ff6200';
  ctx.beginPath();
  ctx.moveTo(x, y - w / 2);
  ctx.lineTo(x - len, y);
  ctx.lineTo(x, y + w / 2);
  ctx.closePath();
  ctx.fill();

  // Núcleo amarillo brillante
  ctx.fillStyle = '#ffea00';
  ctx.beginPath();
  ctx.moveTo(x, y - w / 3);
  ctx.lineTo(x - len * 0.65, y);
  ctx.lineTo(x, y + w / 3);
  ctx.closePath();
  ctx.fill();

  // Centro blanco incandescente
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - w / 5);
  ctx.lineTo(x - len * 0.35, y);
  ctx.lineTo(x, y + w / 5);
  ctx.closePath();
  ctx.fill();
}

function drawCar(ctx, car) {
  const w = CAR_CONFIG.width || 28;
  const h = CAR_CONFIG.height || 18;
  const halfW = w / 2;
  const halfH = h / 2;
  const color = TEAM_COLOR[car.team] || '#888';
  const roofColor = car.team === 'red' ? '#b83232' : '#2f6fa8';
  const angle = car.angle || 0;

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(angle);

  // 0. Efecto de Front Flip (Rocket League 3D Pitch Illusion)
  if (car.isFlipping) {
    // Estelas de rotación aérea en los laterales
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, halfW + 6, -0.65, 0.65);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, halfW + 6, Math.PI - 0.65, Math.PI + 0.65);
    ctx.stroke();

    // Compresión longitudinal para dar efecto de vuelta aérea vertical
    const flipFrac = (car.flipTime || 0) / (CAR_CONFIG.flipDuration || 360);
    const pitchScale = Math.cos((1 - flipFrac) * Math.PI * 2);
    ctx.scale(1, Math.max(0.25, Math.abs(pitchScale)));
  }

  // 0.5. Llamas de Boost en los dos escapes traseros
  if (car.isBoosting) {
    const flameLen = 15 + Math.random() * 9;
    const flameW = 4.5;
    drawExhaustFlame(ctx, -halfW - 2, -halfH + 4, flameLen, flameW);
    drawExhaustFlame(ctx, -halfW - 2, halfH - 4, flameLen, flameW);
  }

  // 1. Sombra bajo el auto
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(-halfW + 1, -halfH + 2, w, h, 4);
  } else {
    ctx.rect(-halfW + 1, -halfH + 2, w, h);
  }
  ctx.fill();

  // 2. Ruedas (4 neumáticos oscuros)
  ctx.fillStyle = '#1e1e1e';
  const wheelW = 7;
  const wheelH = 3.5;
  const steer = car.steerAngle || 0;

  // Ruedas traseras (fijas)
  ctx.fillRect(-halfW + 2, -halfH - 2, wheelW, wheelH);
  ctx.fillRect(-halfW + 2, halfH - 1.5, wheelW, wheelH);

  // Ruedas delanteras (rotadas con steerAngle de dirección)
  const frontX = halfW - wheelW / 2 - 1;
  const frontTopY = -halfH - 2 + wheelH / 2;
  const frontBotY = halfH - 1.5 + wheelH / 2;

  ctx.save();
  ctx.translate(frontX, frontTopY);
  ctx.rotate(steer);
  ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
  ctx.restore();

  ctx.save();
  ctx.translate(frontX, frontBotY);
  ctx.rotate(steer);
  ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
  ctx.restore();

  // 3. Carrocería principal (color del equipo)
  ctx.fillStyle = color;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(-halfW, -halfH, w, h, [3, 6, 6, 3]);
  } else {
    ctx.rect(-halfW, -halfH, w, h);
  }
  ctx.fill();

  // Borde nítido
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 4. Luces delanteras (faros amarillos brillantes en el frente +X)
  ctx.fillStyle = '#fff9a6';
  ctx.fillRect(halfW - 2, -halfH + 2, 2.5, 3);
  ctx.fillRect(halfW - 2, halfH - 5, 2.5, 3);

  // 5. Luces traseras (rojas en la parte trasera -X)
  ctx.fillStyle = '#ff2a2a';
  ctx.fillRect(-halfW, -halfH + 2, 2, 3);
  ctx.fillRect(-halfW, halfH - 5, 2, 3);

  // 6. Alerón trasero
  ctx.fillStyle = '#181818';
  ctx.fillRect(-halfW - 2, -halfH + 1, 2.5, h - 2);

  // 7. Parabrisas delantero
  ctx.fillStyle = '#1a2634';
  ctx.beginPath();
  ctx.moveTo(1, -halfH + 3);
  ctx.lineTo(halfW - 5, -halfH + 4);
  ctx.lineTo(halfW - 5, halfH - 4);
  ctx.lineTo(1, halfH - 3);
  ctx.closePath();
  ctx.fill();

  // Reflejo en parabrisas
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(3, -halfH + 4);
  ctx.lineTo(halfW - 7, halfH - 5);
  ctx.stroke();

  // 8. Ventana trasera
  ctx.fillStyle = '#141d27';
  ctx.fillRect(-halfW + 3, -halfH + 3.5, 3.5, h - 7);

  // 9. Techo (cabina central)
  ctx.fillStyle = roofColor;
  ctx.fillRect(-halfW + 7, -halfH + 3, w - 15, h - 6);

  // 10. Letra inicial del jugador en el techo
  const initial = (car.name || '?')[0].toUpperCase();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, 0, 0);

  // 11. Pequeña barra de Boost sobre el auto
  const bVal = car.boost ?? 33;
  const barW = 24;
  const barH = 3;
  const bx = -barW / 2;
  const by = -halfH - 8;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
  ctx.fillStyle = bVal > 50 ? '#f59e0b' : bVal > 20 ? '#fbbf24' : '#ef4444';
  ctx.fillRect(bx, by, (barW * Math.max(0, Math.min(100, bVal))) / 100, barH);

  // 12. Flecha indicadora de dirección de las ruedas (estilo Rocket League)
  // Muestra hacia dónde apuntan las ruedas y hacia dónde irá el auto al presionar W
  const arrowDist = halfW + 3;
  const arrowLength = 17;
  const isTurned = Math.abs(steer) > 0.04;
  const arrowColor = isTurned ? '#ffea00' : 'rgba(255, 255, 255, 0.75)';

  ctx.save();
  ctx.translate(arrowDist, 0);
  ctx.rotate(steer);

  // Sombra negra para máxima visibilidad sobre el césped
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 4;

  // Tallo de la flecha
  ctx.strokeStyle = arrowColor;
  ctx.lineWidth = isTurned ? 2.5 : 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(arrowLength - 5, 0);
  ctx.stroke();

  // Cabeza de flecha puntiaguda
  ctx.fillStyle = arrowColor;
  ctx.beginPath();
  ctx.moveTo(arrowLength, 0);
  ctx.lineTo(arrowLength - 6.5, -4);
  ctx.lineTo(arrowLength - 5, 0);
  ctx.lineTo(arrowLength - 6.5, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  ctx.restore();
}

function drawCarHUD(ctx, car, canvasSize) {
  const boostVal = Math.round(car.boost ?? 0);
  const isCooldown = (car.flipCooldown ?? 0) > 0;
  const cdSec = ((car.flipCooldown ?? 0) / 1000).toFixed(1);

  const cx = canvasSize.w - 78;
  const cy = canvasSize.h - 76;
  const r = 46;

  ctx.save();

  // Fondo circular oscuro translúcido
  ctx.fillStyle = 'rgba(14, 16, 22, 0.82)';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pista de fondo del medidor de boost (arco 270 grados)
  const startAngle = 0.75 * Math.PI;
  const totalSweep = 1.5 * Math.PI;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, startAngle + totalSweep);
  ctx.stroke();

  // Arco activo de boost con color según carga
  if (boostVal > 0) {
    const sweep = totalSweep * Math.min(1, boostVal / 100);
    ctx.strokeStyle = boostVal > 50 ? '#f59e0b' : boostVal > 20 ? '#fbbf24' : '#ef4444';
    ctx.shadowColor = boostVal > 50 ? '#f59e0b' : '#ef4444';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Valor numérico de Boost en el centro
  ctx.font = '900 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 6;
  ctx.fillText(`${boostVal}`, cx, cy - 6);

  // Etiqueta BOOST
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = boostVal > 0 ? '#f59e0b' : '#888';
  ctx.fillText('BOOST (Shift)', cx, cy + 18);

  // Badge / Pastilla de FLIP a la izquierda del medidor
  const pillW = 120;
  const pillH = 24;
  const pillX = cx - r - pillW - 12;
  const pillY = cy - pillH / 2;

  ctx.fillStyle = 'rgba(14, 16, 22, 0.85)';
  ctx.strokeStyle = isCooldown ? 'rgba(239, 68, 68, 0.65)' : 'rgba(34, 197, 94, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(pillX, pillY, pillW, pillH, 6);
  } else {
    ctx.rect(pillX, pillY, pillW, pillH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isCooldown ? '#f87171' : '#4ade80';
  ctx.fillText(isCooldown ? `FLIP: ${cdSec}s` : 'FLIP: LISTO (Espacio)', pillX + pillW / 2, pillY + pillH / 2);

  ctx.restore();
}

/**
 * Dibuja un indicador perimetral estilo Rocket League cuando la pelota sale de la pantalla visible.
 * Incluye flecha apuntando a la pelota, mini-balón y distancia en metros.
 */
function drawOffscreenBallIndicator(ctx, ball, myCar, canvasSize, zoom, screenCenterX, screenCenterY, cx, cy, isRotatingCam) {
  if (!ball) return;

  const bx = ball.x - cx;
  const by = ball.y - cy;

  let ballScreenX, ballScreenY;
  if (isRotatingCam && myCar) {
    const carAngle = myCar.angle ?? -Math.PI / 2;
    const rot = -Math.PI / 2 - carAngle;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const rx = bx * cosR - by * sinR;
    const ry = bx * sinR + by * cosR;
    ballScreenX = screenCenterX + rx * zoom;
    ballScreenY = screenCenterY + ry * zoom;
  } else {
    ballScreenX = screenCenterX + bx * zoom;
    ballScreenY = screenCenterY + by * zoom;
  }

  // Comprobar si la pelota está fuera del área visible de la pantalla
  const margin = 26;
  const isOffscreen = (
    ballScreenX < margin ||
    ballScreenX > canvasSize.w - margin ||
    ballScreenY < margin ||
    ballScreenY > canvasSize.h - margin
  );

  if (!isOffscreen) return; // Si la pelota ya se ve en pantalla, no dibujamos el indicador

  // Vector desde el centro de la pantalla hacia la pelota
  const dx = ballScreenX - screenCenterX;
  const dy = ballScreenY - screenCenterY;
  if (dx === 0 && dy === 0) return;

  // Intersección ray-box con los bordes de la pantalla
  const edgeMargin = 42;
  const minX = edgeMargin;
  const maxX = canvasSize.w - edgeMargin;
  const minY = edgeMargin;
  const maxY = canvasSize.h - edgeMargin;

  let t = Infinity;
  if (dx > 0) t = Math.min(t, (maxX - screenCenterX) / dx);
  else if (dx < 0) t = Math.min(t, (minX - screenCenterX) / dx);

  if (dy > 0) t = Math.min(t, (maxY - screenCenterY) / dy);
  else if (dy < 0) t = Math.min(t, (minY - screenCenterY) / dy);

  const indX = Math.max(minX, Math.min(maxX, screenCenterX + dx * t));
  const indY = Math.max(minY, Math.min(maxY, screenCenterY + dy * t));
  const angle = Math.atan2(dy, dx);

  // Distancia del auto a la pelota
  const distWorld = myCar ? Math.hypot(ball.x - myCar.x, ball.y - myCar.y) : Math.hypot(dx, dy) / zoom;
  const distMeters = Math.round(distWorld / 14);

  ctx.save();
  ctx.translate(indX, indY);

  // Sombra negra para destacar sobre cualquier textura del mapa
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 8;

  // 1. Flecha exterior apuntando directamente hacia la pelota
  const pulse = 1 + Math.sin(Date.now() / 200) * 0.08;
  ctx.save();
  ctx.rotate(angle);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(10, -9);
  ctx.lineTo(13, 0);
  ctx.lineTo(10, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 2. Círculo / Badge de la pelota
  const badgeR = 15;
  ctx.beginPath();
  ctx.arc(0, 0, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  // 3. Patrón de pelota de fútbol en el badge
  ctx.fillStyle = '#1e1e1e';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const px = Math.cos(a) * 4.5;
    const py = Math.sin(a) * 4.5;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#1e1e1e';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5);
    ctx.lineTo(Math.cos(a) * badgeR, Math.sin(a) * badgeR);
    ctx.stroke();
  }

  // 4. Etiqueta de distancia en metros debajo del badge
  ctx.shadowColor = 'rgba(0, 0, 0, 1)';
  ctx.shadowBlur = 4;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fef08a';
  ctx.fillText(`${distMeters}m`, 0, badgeR + 3);

  ctx.restore();
}


