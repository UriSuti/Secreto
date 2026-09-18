import React from 'react';
import { TEAM_ICON, TEAM_LABEL, operativesOf, spymasterOf } from './game.js';
import { COLORS, TEAM_TEXT, panelStyle } from './theme.js';

function Row({ player, color, role, me, host }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, fontSize: 13, padding: '2px 0' }}>
      <span style={{ color, fontWeight: player.id === me?.id ? 700 : 600, overflowWrap: 'anywhere' }}>
        {player.name}{host ? ' ★' : ''}
      </span>
      <span style={{ fontSize: 11, color: COLORS.dim, whiteSpace: 'nowrap' }}>
        {role}{player.id === me?.id ? ' · vos' : ''}
      </span>
    </div>
  );
}

// Lista de jugadores por equipo, cada nombre del color de su equipo.
export default function Players({ room, me }) {
  const watching = room.players.filter((p) => !p.team);

  return (
    <div data-players style={{ ...panelStyle, padding: 12 }}>
      <div className="cs-mono" style={{ fontSize: 11, color: COLORS.gold, marginBottom: 10 }}>
        jugadores ({room.players.length})
      </div>

      {room.teams.map((team) => {
        const spymaster = spymasterOf(room, team);
        const operatives = operativesOf(room, team);
        const out = room.eliminated.includes(team);
        const playing = room.currentTeam === team && !room.winner && !out;
        return (
          <div key={team} style={{ marginBottom: 12, opacity: out ? 0.45 : 1 }}>
            <div className="cs-mono" style={{ fontSize: 11, color: TEAM_TEXT[team], marginBottom: 3, textDecoration: out ? 'line-through' : 'none' }}>
              {TEAM_ICON[team]} {TEAM_LABEL[team]}
              {playing && <span style={{ color: COLORS.gold }}> · juega</span>}
              {out && <span> · eliminado</span>}
            </div>
            {spymaster && <Row player={spymaster} color={TEAM_TEXT[team]} role="espía" me={me} host={room.hostId === spymaster.id} />}
            {operatives.map((p) => <Row key={p.id} player={p} color={TEAM_TEXT[team]} role="agente" me={me} host={room.hostId === p.id} />)}
            {!spymaster && !operatives.length && <div style={{ fontSize: 12, color: COLORS.dim }}>Sin jugadores</div>}
          </div>
        );
      })}

      {watching.length > 0 && (
        <div>
          <div className="cs-mono" style={{ fontSize: 11, color: COLORS.muted, marginBottom: 3 }}>mirando</div>
          {watching.map((p) => <Row key={p.id} player={p} color={COLORS.muted} role="" me={me} host={room.hostId === p.id} />)}
        </div>
      )}
    </div>
  );
}
