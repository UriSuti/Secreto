import React, { useEffect, useState } from 'react';
import { backend } from '../storage.js';
import { clearSession, loadName, loadSession, saveSession } from '../session.js';
import { COLORS, panelStyle, inputStyle, ghostButton, labelStyle } from '../theme.js';
import Credits from '../menu/Credits.jsx';
import { applyAction, cleanName, findPlayer, makeId, newRoom } from './game.js';
import FutbolLobby from './FutbolLobby.jsx';
import FutbolGame from './FutbolGame.jsx';

function codeFromUrl() {
  const code = new URLSearchParams(window.location.search).get('sala') || '';
  return code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

function setUrlCode(code) {
  const url = new URL(window.location.href);
  if (code) {
    url.searchParams.set('sala', code);
    url.searchParams.set('juego', 'futbol');
  } else {
    url.searchParams.delete('sala');
  }
  window.history.replaceState(null, '', url);
}

function inviteLink(code) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('sala', code);
  url.searchParams.set('juego', 'futbol');
  return url.toString();
}

export default function FutbolApp({ onBackToMenu }) {
  const [name, setName] = useState(loadName);
  const [joinCode, setJoinCode] = useState(codeFromUrl);
  const [session, setSession] = useState(() => loadSession(codeFromUrl()));
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Estado de fin de partida local (el canvas lo notifica)
  const [gameEnded, setGameEnded] = useState(false);

  const code = session?.code;

  useEffect(() => {
    if (!code) return undefined;
    setRoom(null);
    return backend.subscribeRoom(
      code,
      (data) => {
        if (data) { setRoom(data); return; }
        clearSession();
        setUrlCode('');
        setSession(null);
        setError('Esa sala ya no existe.');
      },
      () => setError('No se pudo conectar con la sala.'),
    );
  }, [code]);

  const me = findPlayer(room, session?.playerId);

  function enterRoom(next) {
    saveSession(next);
    setUrlCode(next.code);
    setError('');
    setSession(next);
  }

  async function dispatch(action) {
    if (!session) return null;
    const { code: roomCode, playerId } = session;
    try {
      return await backend.updateRoom(roomCode, (current) => applyAction(current, { ...action, playerId }));
    } catch {
      setError('No se pudo actualizar la partida.');
      return null;
    }
  }

  async function handleCreate() {
    const clean = cleanName(name);
    if (!clean) { setError('Escribí tu nombre primero.'); return; }
    setBusy(true);
    setError('');
    try {
      const playerId = makeId();
      const { code: newCode } = await backend.createRoom(() => newRoom(playerId, clean));
      enterRoom({ code: newCode, playerId, name: clean });
    } catch {
      setError('No se pudo crear la sala.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    const clean = cleanName(name);
    if (!clean) { setError('Escribí tu nombre primero.'); return; }
    const target = joinCode.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(target)) { setError('El código de sala tiene 4 letras.'); return; }
    setBusy(true);
    setError('');
    try {
      const playerId = makeId();
      const result = await backend.updateRoom(target, (current) => applyAction(current, { type: 'join', playerId, name: clean }));
      if (!result.room) { setError('No encontramos esa sala.'); return; }
      enterRoom({ code: target, playerId, name: clean });
    } catch {
      setError('No se pudo conectar con la sala.');
    } finally {
      setBusy(false);
    }
  }

  function handleLeave() {
    const leaving = session;
    clearSession();
    setUrlCode('');
    setSession(null);
    setRoom(null);
    setJoinCode('');
    setError('');
    setGameEnded(false);
    if (leaving) {
      backend.updateRoom(leaving.code, (current) => applyAction(current, { type: 'leave', playerId: leaving.playerId })).catch(() => {});
    }
  }

  async function copyInvite() {
    if (!session?.code) return;
    const link = inviteLink(session.code);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copiá este link:', link);
    }
  }

  // Cuando el canvas notifica un gol, sincronizamos con Firebase
  async function handleGoal(team) {
    await dispatch({ type: 'goalScored', team });
  }

  // Cuando se acaba el tiempo, terminamos el partido
  async function handleTimeEnd() {
    setGameEnded(true);
    await dispatch({ type: 'endGame' });
  }

  // ─── Pantalla de inicio (sin sesión) ──────────────────────────────────
  if (!session) {
    return (
      <div className="cs-root" style={{ background: COLORS.bg, padding: '48px 16px 32px', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: 440, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <button type="button" className="cs-btn" onClick={onBackToMenu} style={{ ...ghostButton, marginBottom: 16 }}>
              ← Volver a Tareas Veganas
            </button>
            <div className="cs-mono" style={{ fontSize: 13, color: COLORS.gold, marginBottom: 8, letterSpacing: 1 }}>
              FÚTBOL 2D · VISTA CENITAL
            </div>
            <h1 className="cs-mono" style={{ fontSize: 38, margin: 0, color: COLORS.cream, lineHeight: 1.2 }}>
              ⚽ Fútbol
            </h1>
            <p style={{ color: COLORS.muted, marginTop: 10, fontSize: 15, lineHeight: 1.45 }}>
              Juego de fútbol 2D con física real. Dos equipos, una pelota, un arco. Controlado con teclado.
            </p>
            <div style={{ marginTop: 8, fontSize: 12, color: COLORS.dim, fontFamily: 'monospace' }}>
              WASD + Espacio (Rojo) · Flechas + Enter (Azul)
            </div>
          </div>

          <div style={{ ...panelStyle, padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="futbol-name" className="cs-mono" style={{ ...labelStyle, fontSize: 12, marginBottom: 8 }}>
                1. TU NOMBRE
              </label>
              <input
                id="futbol-name"
                className="cs-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Escribí tu nombre..."
                maxLength={16}
                autoComplete="nickname"
                style={{ ...inputStyle }}
              />
            </div>

            <div className="cs-mono" style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
              2. ELEGÍ CÓMO JUGAR
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Crear sala */}
              <div style={{ background: COLORS.panelSoft, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6, padding: 14 }}>
                <div style={{ fontWeight: 700, color: COLORS.cream, fontSize: 15, marginBottom: 6 }}>
                  🌐 Crear sala online
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: COLORS.muted }}>
                  Creá una sala y compartí el código con tus amigos.
                </p>
                <button
                  type="button"
                  className="cs-btn"
                  disabled={busy}
                  onClick={handleCreate}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 4, background: COLORS.gold, color: COLORS.ink, fontWeight: 700, fontSize: 14 }}
                >
                  Crear sala de Fútbol
                </button>
              </div>

              {/* Unirse a sala */}
              <div style={{ background: COLORS.panelSoft, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6, padding: 14 }}>
                <div style={{ fontWeight: 700, color: COLORS.cream, fontSize: 15, marginBottom: 6 }}>
                  🔑 Unirse a una sala
                </div>
                <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="cs-input"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                    placeholder="ABCD"
                    maxLength={4}
                    autoCapitalize="characters"
                    autoComplete="off"
                    style={{ ...inputStyle, flex: 1, minWidth: 0, letterSpacing: 3, textAlign: 'center', fontWeight: 700 }}
                  />
                  <button
                    type="submit"
                    className="cs-btn"
                    disabled={busy || !joinCode}
                    style={{ padding: '10px 18px', borderRadius: 4, background: COLORS.blue, color: COLORS.blueText, fontWeight: 700 }}
                  >
                    Unirme
                  </button>
                </form>
              </div>
            </div>

            {error && <div role="alert" style={{ color: COLORS.error, fontSize: 13, marginTop: 16, textAlign: 'center' }}>{error}</div>}
          </div>
          <Credits />
        </div>
      </div>
    );
  }

  // ─── Cargando sala ─────────────────────────────────────────────────────
  if (!room) {
    return (
      <div className="cs-root" style={{ background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="cs-mono" style={{ color: COLORS.gold, marginBottom: 16 }}>Cargando sala de Fútbol...</div>
          <button type="button" className="cs-btn" onClick={handleLeave} style={ghostButton}>Cancelar</button>
        </div>
      </div>
    );
  }

  // ─── Lobby ─────────────────────────────────────────────────────────────
  if (room.phase === 'lobby') {
    return (
      <FutbolLobby
        room={room}
        me={me}
        onDispatch={dispatch}
        onLeave={handleLeave}
        onCopyInvite={copyInvite}
        copied={copied}
      />
    );
  }

  // ─── Partido terminado ─────────────────────────────────────────────────
  if (room.phase === 'ended' || gameEnded) {
    const score = room.score;
    const winner = room.winner;
    const winnerLabel = winner === 'red' ? '🔴 ROJO' : winner === 'blue' ? '🔵 AZUL' : null;
    const winnerColor = winner === 'red' ? '#e05050' : winner === 'blue' ? '#4a90d9' : COLORS.gold;

    return (
      <div className="cs-root" style={{ background: COLORS.bg, padding: '48px 16px', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚽</div>

          {winner === 'tie' ? (
            <>
              <div className="cs-mono" style={{ fontSize: 13, color: COLORS.gold, marginBottom: 8, letterSpacing: 1 }}>FIN DEL PARTIDO</div>
              <h1 className="cs-mono" style={{ fontSize: 36, color: COLORS.cream, margin: '0 0 8px' }}>¡Empate!</h1>
            </>
          ) : (
            <>
              <div className="cs-mono" style={{ fontSize: 13, color: COLORS.gold, marginBottom: 8, letterSpacing: 1 }}>FIN DEL PARTIDO</div>
              <h1 className="cs-mono" style={{ fontSize: 36, color: winnerColor, margin: '0 0 8px' }}>
                ¡Gana {winnerLabel}!
              </h1>
            </>
          )}

          {/* Marcador final */}
          <div style={{
            ...panelStyle,
            padding: '20px 32px',
            margin: '20px 0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 24,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#e05050', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>ROJO</div>
              <div style={{ color: COLORS.cream, fontWeight: 900, fontSize: 48, lineHeight: 1 }}>{score.red}</div>
            </div>
            <div style={{ color: COLORS.dim, fontSize: 24 }}>—</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#4a90d9', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>AZUL</div>
              <div style={{ color: COLORS.cream, fontWeight: 900, fontSize: 48, lineHeight: 1 }}>{score.blue}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {me && (
              <button
                type="button"
                className="cs-btn"
                onClick={() => {
                  setGameEnded(false);
                  dispatch({ type: 'toLobby' });
                }}
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 4,
                  background: COLORS.gold,
                  color: COLORS.ink,
                  fontWeight: 700,
                  fontSize: 16,
                  border: `1px solid ${COLORS.gold}`,
                }}
              >
                Volver al lobby
              </button>
            )}
            <button type="button" className="cs-btn" onClick={handleLeave} style={{ ...ghostButton, width: '100%', padding: 12 }}>
              Salir del partido
            </button>
          </div>
          <Credits />
        </div>
      </div>
    );
  }

  // ─── Partido en curso ──────────────────────────────────────────────────
  if (room.phase === 'playing') {
    return (
      <FutbolGame
        room={room}
        code={session.code}
        me={me}
        onGoal={handleGoal}
        onTimeEnd={handleTimeEnd}
        onBackToLobby={() => dispatch({ type: 'toLobby' })}

        onLeave={handleLeave}
      />
    );
  }

  return null;
}
