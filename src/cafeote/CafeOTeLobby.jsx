import React from 'react';
import { COLORS, panelStyle, labelStyle, inputStyle, ghostButton } from '../theme.js';
import Credits from '../Credits.jsx';
import { isHost } from './game.js';

export default function CafeOTeLobby({ room, me, onDispatch, onLeave, onCopyInvite, copied }) {
  const host = isHost(room, me?.id);
  const options = room.options;

  const getSlotPlayer = (team, role) => {
    return room.players.find((p) => p.team === team && p.role === role);
  };

  const handleOptionChange = (key, value) => {
    if (!host) return;
    onDispatch({ type: 'setOptions', options: { [key]: value } });
  };

  const allAssigned = room.players.length === 4 && room.players.every((p) => p.team && p.role);

  return (
    <div className="cs-root" style={{ background: COLORS.bg, padding: '32px 16px', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 540, width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <button type="button" className="cs-btn" onClick={onLeave} style={{ ...ghostButton, marginBottom: 16 }}>
            ← Volver a Tareas Veganas
          </button>
          <div className="cs-mono" style={{ fontSize: 13, color: COLORS.gold, marginBottom: 6, letterSpacing: 1 }}>
            CAFÉ O TÉ · SALA #{room.code}
          </div>
          <h1 className="cs-mono" style={{ fontSize: 36, margin: 0, color: COLORS.cream, lineHeight: 1.2 }}>
            Sala de Espera (2v2)
          </h1>
          <p style={{ color: COLORS.muted, marginTop: 8, fontSize: 14 }}>
            Se necesitan 4 jugadores: 2 Pensadores y 2 Adivinadores.
          </p>
        </div>

        {/* Opciones de la Sala */}
        <div style={{ ...panelStyle, padding: 20, marginBottom: 20 }}>
          <div className="cs-mono" style={{ fontSize: 12, color: COLORS.gold, marginBottom: 14, letterSpacing: 0.5 }}>
            ⚙️ CONFIGURACIÓN DE LA SALA
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
            {/* Tiempo palabra */}
            <div>
              <label className="cs-mono" style={{ ...labelStyle, fontSize: 11, marginBottom: 4 }}>
                TIEMPO DE PENSAR PALABRA
              </label>
              <select
                className="cs-input"
                disabled={!host}
                value={options.wordTime}
                onChange={(e) => handleOptionChange('wordTime', Number(e.target.value))}
                style={{ ...inputStyle, padding: '8px 10px', fontSize: 14 }}
              >
                <option value={15}>15 segundos</option>
                <option value={30}>30 segundos</option>
                <option value={60}>60 segundos</option>
              </select>
            </div>

            {/* Modo de Juego */}
            <div>
              <label className="cs-mono" style={{ ...labelStyle, fontSize: 11, marginBottom: 4 }}>
                MODO DE JUEGO
              </label>
              <select
                className="cs-input"
                disabled={!host}
                value={options.mode}
                onChange={(e) => handleOptionChange('mode', e.target.value)}
                style={{ ...inputStyle, padding: '8px 10px', fontSize: 14 }}
              >
                <option value="tiempo">Por Tiempo (Más rápido)</option>
                <option value="contador">Por Contador (Menos intentos)</option>
              </select>
            </div>

            {/* Tipo de Adivinanza */}
            <div>
              <label className="cs-mono" style={{ ...labelStyle, fontSize: 11, marginBottom: 4 }}>
                TIPO DE ADIVINANZA
              </label>
              <select
                className="cs-input"
                disabled={!host}
                value={options.wordType || 'concepto'}
                onChange={(e) => handleOptionChange('wordType', e.target.value)}
                style={{ ...inputStyle, padding: '8px 10px', fontSize: 14 }}
              >
                <option value="concepto">Concepto (Cualquier frase o cosa)</option>
                <option value="palabra">Palabra (Una sola palabra)</option>
              </select>
            </div>
          </div>

          {/* Checkbox ver rival */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: host ? 'pointer' : 'default', fontSize: 13, color: COLORS.cream }}>
            <input
              type="checkbox"
              disabled={!host}
              checked={options.showRivalCounter}
              onChange={(e) => handleOptionChange('showRivalCounter', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: COLORS.gold }}
            />
            <span>Ver contador e intentos del equipo rival en pantalla</span>
          </label>
        </div>

        {/* Equipos y Roles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Equipo Rojo */}
          <div style={{ ...panelStyle, padding: 16, borderTop: `3px solid ${COLORS.redLight}` }}>
            <div className="cs-mono" style={{ color: COLORS.redLight, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              🔴 EQUIPO ROJO
            </div>

            {/* Pensador */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>👑 Pensador</div>
              {getSlotPlayer('red', 'pensador') ? (
                <div style={{ background: COLORS.panelSoft, padding: '8px 12px', borderRadius: 4, color: COLORS.cream, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{getSlotPlayer('red', 'pensador').name}</span>
                  {getSlotPlayer('red', 'pensador').id === me?.id && (
                    <span style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700 }}>(VOS)</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="cs-btn"
                  onClick={() => onDispatch({ type: 'pickRole', team: 'red', role: 'pensador' })}
                  style={{ ...ghostButton, width: '100%', color: COLORS.gold }}
                >
                  Unirme como Pensador
                </button>
              )}
            </div>

            {/* Adivinador */}
            <div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>🕵️ Adivinador</div>
              {getSlotPlayer('red', 'adivinador') ? (
                <div style={{ background: COLORS.panelSoft, padding: '8px 12px', borderRadius: 4, color: COLORS.cream, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{getSlotPlayer('red', 'adivinador').name}</span>
                  {getSlotPlayer('red', 'adivinador').id === me?.id && (
                    <span style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700 }}>(VOS)</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="cs-btn"
                  onClick={() => onDispatch({ type: 'pickRole', team: 'red', role: 'adivinador' })}
                  style={{ ...ghostButton, width: '100%', color: COLORS.gold }}
                >
                  Unirme como Adivinador
                </button>
              )}
            </div>
          </div>

          {/* Equipo Azul */}
          <div style={{ ...panelStyle, padding: 16, borderTop: `3px solid ${COLORS.blueLight}` }}>
            <div className="cs-mono" style={{ color: COLORS.blueLight, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              🔵 EQUIPO AZUL
            </div>

            {/* Pensador */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>👑 Pensador</div>
              {getSlotPlayer('blue', 'pensador') ? (
                <div style={{ background: COLORS.panelSoft, padding: '8px 12px', borderRadius: 4, color: COLORS.cream, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{getSlotPlayer('blue', 'pensador').name}</span>
                  {getSlotPlayer('blue', 'pensador').id === me?.id && (
                    <span style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700 }}>(VOS)</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="cs-btn"
                  onClick={() => onDispatch({ type: 'pickRole', team: 'blue', role: 'pensador' })}
                  style={{ ...ghostButton, width: '100%', color: COLORS.gold }}
                >
                  Unirme como Pensador
                </button>
              )}
            </div>

            {/* Adivinador */}
            <div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>🕵️ Adivinador</div>
              {getSlotPlayer('blue', 'adivinador') ? (
                <div style={{ background: COLORS.panelSoft, padding: '8px 12px', borderRadius: 4, color: COLORS.cream, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{getSlotPlayer('blue', 'adivinador').name}</span>
                  {getSlotPlayer('blue', 'adivinador').id === me?.id && (
                    <span style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700 }}>(VOS)</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="cs-btn"
                  onClick={() => onDispatch({ type: 'pickRole', team: 'blue', role: 'adivinador' })}
                  style={{ ...ghostButton, width: '100%', color: COLORS.gold }}
                >
                  Unirme como Adivinador
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Acciones del Lobby */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="cs-btn"
            onClick={onCopyInvite}
            style={{ ...ghostButton, padding: '10px 16px', fontSize: 14, textAlign: 'center' }}
          >
            {copied ? '¡Enlace copiado!' : '📋 Copiar link de invitación para amigos'}
          </button>

          {host && (
            <button
              type="button"
              className="cs-btn"
              disabled={!allAssigned}
              onClick={() => onDispatch({ type: 'startSecretPhase' })}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 4,
                background: allAssigned ? COLORS.gold : COLORS.panelSoft,
                color: allAssigned ? COLORS.ink : COLORS.dim,
                fontWeight: 700,
                fontSize: 16,
                cursor: allAssigned ? 'pointer' : 'not-allowed',
                border: `1px solid ${allAssigned ? COLORS.gold : COLORS.panelBorder}`,
              }}
            >
              {allAssigned ? '¡Iniciar Partida!' : 'Esperando que se completen los 4 lugares...'}
            </button>
          )}
          {!host && (
            <div style={{ textAlign: 'center', color: COLORS.muted, fontSize: 13, padding: 8 }}>
              Esperando que el creador inicie la partida...
            </div>
          )}
        </div>

        <Credits />
      </div>
    </div>
  );
}
