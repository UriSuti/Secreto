import React from 'react';
import { COLORS, TEAM_BUTTON } from '../theme.js';
import { isHost, canStart, MAX_PER_TEAM } from './game.js';
import {
  LobbyLayout,
  LobbyOptions,
  OptionField,
  Segmented,
  LobbyTeamCard,
  TeamRoster,
  LobbyActionSection,
} from '../lobby/index.js';

export default function FutbolLobby({ room, code, me, onDispatch, onLeave, onCopyInvite, copied }) {
  const host = isHost(room, me?.id);
  const options = room.options;
  const myTeam = me?.team;

  const reds = room.players.filter((p) => p.team === 'red');
  const blues = room.players.filter((p) => p.team === 'blue');
  const ready = canStart(room);

  return (
    <LobbyLayout
      code={code || room?.code}
      gameTitle="sala de espera"
      subtitle={`Compartí el código o el link para que se unan tus amigos.${host ? ' Sos el anfitrión: los modificadores son tuyos.' : ''}`}
      copied={copied}
      onCopyInvite={onCopyInvite}
      onLeave={onLeave}
      leaveText="Salir"
    >
      {/* Equipos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
        {/* Equipo Rojo */}
        <LobbyTeamCard
          team="red"
          title="Equipo Rojo"
          icon="🔴"
          color={COLORS.redLight}
          countBadge={`(${reds.length}/${MAX_PER_TEAM})`}
        >
          <TeamRoster
            players={reds}
            myPlayerId={me?.id}
            hostId={room.hostId}
            isMyTeam={myTeam === 'red'}
            isFull={reds.length >= MAX_PER_TEAM}
            canJoin={Boolean(me)}
            onJoin={() => onDispatch({ type: 'pickTeam', team: 'red' })}
            buttonColors={TEAM_BUTTON.red}
            joinLabel="Unirme al Equipo Rojo"
          />
        </LobbyTeamCard>

        {/* Equipo Azul */}
        <LobbyTeamCard
          team="blue"
          title="Equipo Azul"
          icon="🔵"
          color={COLORS.blueLight}
          countBadge={`(${blues.length}/${MAX_PER_TEAM})`}
        >
          <TeamRoster
            players={blues}
            myPlayerId={me?.id}
            hostId={room.hostId}
            isMyTeam={myTeam === 'blue'}
            isFull={blues.length >= MAX_PER_TEAM}
            canJoin={Boolean(me)}
            onJoin={() => onDispatch({ type: 'pickTeam', team: 'blue' })}
            buttonColors={TEAM_BUTTON.blue}
            joinLabel="Unirme al Equipo Azul"
          />
        </LobbyTeamCard>
      </div>

      {/* Opciones del Partido */}
      <LobbyOptions title="modificadores de la partida" canEdit={host}>
        <OptionField
          title="Modificador de juego"
          hint="Pelotas: clásico con patada directa. Coches: vehículos 2D con inercia, derrape, marcha atrás y colisión física."
        >
          <Segmented
            name="vehicleMode"
            value={options.vehicleMode || 'pelotas'}
            disabled={!host}
            onChange={(val) => onDispatch({ type: 'setOptions', options: { vehicleMode: val } })}
            choices={[
              { value: 'pelotas', label: '⚽ Pelotas' },
              { value: 'coches', label: '🚗 Coches' },
            ]}
          />
        </OptionField>

        {/* Condiciones de partido: minutos y goles para ganar */}
        <OptionField
          title="Condiciones del partido"
          hint="0 significa ilimitado en ambos campos (sin límite de tiempo o sin límite de goles)."
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', color: '#bbb', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                ⏱️ Minutos de partido (0 = ilimitado)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                disabled={!host}
                value={options.matchMinutes ?? 0}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                  onDispatch({ type: 'setOptions', options: { matchMinutes: val } });
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#1e1e1e',
                  border: '1px solid #3a3a3a',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '9px 12px',
                  fontSize: 14,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <span style={{ display: 'block', color: '#777', fontSize: 11, marginTop: 4 }}>
                {(options.matchMinutes ?? 0) === 0 ? 'Tiempo ilimitado' : `${options.matchMinutes} min reglamentarios`}
              </span>
            </div>

            <div>
              <label style={{ display: 'block', color: '#bbb', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                🎯 Goles para ganar (0 = ilimitado)
              </label>
              <input
                type="number"
                min="0"
                max="99"
                disabled={!host}
                value={options.goalsToWin ?? 0}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                  onDispatch({ type: 'setOptions', options: { goalsToWin: val } });
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#1e1e1e',
                  border: '1px solid #3a3a3a',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '9px 12px',
                  fontSize: 14,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <span style={{ display: 'block', color: '#777', fontSize: 11, marginTop: 4 }}>
                {(options.goalsToWin ?? 0) === 0 ? 'Goles ilimitados' : `Gana quien marque ${options.goalsToWin}`}
              </span>
            </div>
          </div>
        </OptionField>

        {/* Opciones según el modo de juego (Coches vs Pelotas) */}
        {options.vehicleMode === 'coches' ? (
          <>
            <OptionField
              title="Tamaño de cancha"
              hint="Dimensiones adaptadas para la cantidad de autos por equipo."
            >
              <Segmented
                name="mapType"
                value={options.mapType || 'cancha3'}
                disabled={!host}
                onChange={(val) => onDispatch({ type: 'setOptions', options: { mapType: val } })}
                choices={[
                  { value: 'cancha3', label: '1v1' },
                  { value: 'cancha5', label: '2v2' },
                  { value: 'cancha9', label: '3v3' },
                  { value: 'cancha11', label: '4v4' },
                ]}
              />
            </OptionField>

            <OptionField
              title="Boost infinito"
              hint="Al activarlo, el nitro nunca se agota (siempre al 100%)."
            >
              <Segmented
                name="infiniteBoost"
                value={Boolean(options.infiniteBoost)}
                disabled={!host}
                onChange={(val) => onDispatch({ type: 'setOptions', options: { infiniteBoost: val } })}
                choices={[
                  { value: false, label: 'No' },
                  { value: true, label: 'Sí' },
                ]}
              />
            </OptionField>
          </>
        ) : (
          <>
            <OptionField
              title="Tamaño de cancha"
              hint="Dimensiones y arcos adaptados para la cantidad de jugadores."
            >
              <Segmented
                name="mapType"
                value={options.mapType || 'cancha3'}
                disabled={!host}
                onChange={(val) => onDispatch({ type: 'setOptions', options: { mapType: val } })}
                choices={[
                  { value: 'cancha3', label: 'Cancha 3 (Pequeña)' },
                  { value: 'cancha5', label: 'Cancha 5 (Chica)' },
                  { value: 'cancha9', label: 'Cancha 9 (Grande)' },
                  { value: 'cancha11', label: 'Cancha 11 (Muy grande)' },
                ]}
              />
            </OptionField>

            <OptionField
              title="Estámina (Shift para correr)"
              hint="Con estámina, correr consume barra de energía y caminar va a velocidad normal."
            >
              <Segmented
                name="stamina"
                value={Boolean(options.stamina)}
                disabled={!host}
                onChange={(val) => onDispatch({ type: 'setOptions', options: { stamina: val } })}
                choices={[
                  { value: false, label: 'Desactivada' },
                  { value: true, label: 'Activada' },
                ]}
              />
            </OptionField>
          </>
        )}
      </LobbyOptions>

      {/* Acciones */}
      <LobbyActionSection
        buttonText={
          host
            ? ready
              ? '⚽ ¡Iniciar Partido!'
              : 'Faltan jugadores en los equipos'
            : 'Esperando que el anfitrión inicie el partido…'
        }
        disabled={!host || !ready}
        onClick={() => onDispatch({ type: 'startGame' })}
        counterText={`🔴 ${reds.length} vs 🔵 ${blues.length}`}
        counterColor={ready ? COLORS.greenLight : COLORS.cream}
        statusHint={
          ready
            ? (host ? '¡Equipos listos! El anfitrión puede dar el pitazo inicial.' : '¡Equipos listos! Esperando al anfitrión.')
            : 'Se necesita al menos 1 jugador en el Equipo Rojo y 1 en el Equipo Azul.'
        }
        problems={!ready && room.players.length >= 1 ? ['Se necesita al menos 1 jugador en cada equipo para iniciar.'] : []}
      />
    </LobbyLayout>
  );
}
