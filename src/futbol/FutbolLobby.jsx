import React from 'react';
import { COLORS, panelStyle, ghostButton } from '../theme.js';
import Credits from '../menu/Credits.jsx';
import { isHost, canStart, teamCount, MAX_PER_TEAM } from './game.js';

const TEAM_COLOR = { red: '#e05050', blue: '#4a90d9' };
const TEAM_LABEL = { red: '🔴 EQUIPO ROJO', blue: '🔵 EQUIPO AZUL' };

export default function FutbolLobby({ room, me, onDispatch, onLeave, onCopyInvite, copied }) {
  const host = isHost(room, me?.id);
  const options = room.options;
  const myTeam = me?.team;

  const reds = room.players.filter((p) => p.team === 'red');
  const blues = room.players.filter((p) => p.team === 'blue');

  const ready = canStart(room);

  return (
    <div className="cs-root" style={{ background: COLORS.bg, padding: '32px 16px', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 580, width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <button type="button" className="cs-btn" onClick={onLeave} style={{ ...ghostButton, marginBottom: 16 }}>
            ← Volver a Tareas Veganas
          </button>
          <div className="cs-mono" style={{ fontSize: 13, color: COLORS.gold, marginBottom: 6, letterSpacing: 1 }}>
            FÚTBOL · SALA #{room.code}
          </div>
          <h1 className="cs-mono" style={{ fontSize: 36, margin: 0, color: COLORS.cream, lineHeight: 1.2 }}>
            ⚽ Sala de Espera
          </h1>
          <p style={{ color: COLORS.muted, marginTop: 8, fontSize: 14 }}>
            Uníte a un equipo y esperá que el anfitrión inicie el partido.
          </p>
        </div>

        {/* Configuración */}
        <div style={{ ...panelStyle, padding: 16, marginBottom: 20 }}>
          <div className="cs-mono" style={{ fontSize: 12, color: COLORS.gold, marginBottom: 12, letterSpacing: 0.5 }}>
            ⚙️ CONFIGURACIÓN
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label className="cs-mono" style={{ fontSize: 12, color: COLORS.muted, whiteSpace: 'nowrap' }}>
              DURACIÓN
            </label>
            <select
              className="cs-input"
              disabled={!host}
              value={options.matchMinutes}
              onChange={(e) => onDispatch({ type: 'setOptions', options: { matchMinutes: Number(e.target.value) } })}
              style={{
                padding: '8px 10px',
                borderRadius: 4,
                border: `1px solid ${COLORS.panelBorder}`,
                background: COLORS.panelSoft,
                color: COLORS.cream,
                fontSize: 14,
              }}
            >
              <option value={2}>2 minutos</option>
              <option value={3}>3 minutos</option>
              <option value={5}>5 minutos</option>
              <option value={10}>10 minutos</option>
            </select>
            {!host && <span style={{ fontSize: 12, color: COLORS.dim }}>Solo el anfitrión puede cambiar opciones.</span>}
          </div>
        </div>

        {/* Equipos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Equipo Rojo */}
          <TeamPanel
            team="red"
            players={reds}
            myTeam={myTeam}
            meId={me?.id}
            onJoin={() => onDispatch({ type: 'pickTeam', team: 'red' })}
          />
          {/* Equipo Azul */}
          <TeamPanel
            team="blue"
            players={blues}
            myTeam={myTeam}
            meId={me?.id}
            onJoin={() => onDispatch({ type: 'pickTeam', team: 'blue' })}
          />
        </div>

        {/* Acciones */}
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
              disabled={!ready}
              onClick={() => onDispatch({ type: 'startGame' })}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 4,
                background: ready ? COLORS.gold : COLORS.panelSoft,
                color: ready ? COLORS.ink : COLORS.dim,
                fontWeight: 700,
                fontSize: 16,
                cursor: ready ? 'pointer' : 'not-allowed',
                border: `1px solid ${ready ? COLORS.gold : COLORS.panelBorder}`,
              }}
            >
              {ready ? '⚽ ¡Iniciar Partido!' : 'Necesitás al menos 1 jugador en cada equipo'}
            </button>
          )}
          {!host && (
            <div style={{ textAlign: 'center', color: COLORS.muted, fontSize: 13, padding: 8 }}>
              Esperando que el anfitrión inicie el partido...
            </div>
          )}
        </div>

        <Credits />
      </div>
    </div>
  );
}

function TeamPanel({ team, players, myTeam, meId, onJoin }) {
  const color = TEAM_COLOR[team];
  const label = TEAM_LABEL[team];
  const isMine = myTeam === team;
  const full = players.length >= MAX_PER_TEAM;

  return (
    <div style={{
      ...panelStyle,
      padding: 16,
      borderTop: `3px solid ${color}`,
    }}>
      <div className="cs-mono" style={{ color, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
        {label}
        <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400, marginLeft: 8 }}>
          ({players.length}/{MAX_PER_TEAM})
        </span>
      </div>

      {/* Lista de jugadores */}
      <div style={{ minHeight: 60, marginBottom: 10 }}>
        {players.length === 0 ? (
          <div style={{ color: COLORS.dim, fontSize: 12, fontStyle: 'italic' }}>Sin jugadores</div>
        ) : (
          players.map((p) => (
            <div
              key={p.id}
              style={{
                background: COLORS.panelSoft,
                padding: '6px 10px',
                borderRadius: 4,
                fontSize: 13,
                color: COLORS.cream,
                marginBottom: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{p.name}</span>
              {p.id === meId && (
                <span style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700 }}>(VOS)</span>
              )}
            </div>
          ))
        )}
      </div>

      {!isMine && !full && (
        <button
          type="button"
          className="cs-btn"
          onClick={onJoin}
          style={{
            ...ghostButton,
            width: '100%',
            color,
            borderColor: color,
            fontSize: 13,
          }}
        >
          Unirme a este equipo
        </button>
      )}
      {isMine && (
        <div style={{ fontSize: 12, color: COLORS.gold, textAlign: 'center', padding: '4px 0' }}>
          ✓ Estás en este equipo
        </div>
      )}
      {full && !isMine && (
        <div style={{ fontSize: 12, color: COLORS.muted, textAlign: 'center', padding: '4px 0' }}>
          Equipo lleno
        </div>
      )}
    </div>
  );
}
