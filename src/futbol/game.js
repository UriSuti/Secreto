// Lógica de sala del juego de Fútbol (HaxBall-like)
// Solo maneja el estado de sala (fase, jugadores, puntaje).
// La física del partido corre en el cliente (FutbolGame.jsx + physics.js).

export const DEFAULT_OPTIONS = {
  matchMinutes: 3, // duración del partido: 2, 3, 5, 10
};

export const MAX_PER_TEAM = 10;

export function cleanName(name) {
  return (name || '').trim().slice(0, 16);
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function newRoom(hostId, hostName) {
  const now = Date.now();
  return {
    gameType: 'futbol',
    phase: 'lobby',
    hostId,
    options: { ...DEFAULT_OPTIONS },
    players: [
      { id: hostId, name: cleanName(hostName), team: 'red' },
    ],
    score: { red: 0, blue: 0 },
    winner: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function findPlayer(room, playerId) {
  return room?.players?.find((p) => p.id === playerId) || null;
}

export function isHost(room, playerId) {
  return room?.hostId === playerId;
}

export function teamCount(room, team) {
  return room.players.filter((p) => p.team === team).length;
}

export function canStart(room) {
  return teamCount(room, 'red') >= 1 && teamCount(room, 'blue') >= 1;
}

export function applyAction(room, action) {
  if (!room) return room;
  const next = JSON.parse(JSON.stringify(room));
  next.updatedAt = Date.now();

  switch (action.type) {
    case 'join': {
      if (next.phase !== 'lobby') return room;
      const clean = cleanName(action.name);
      if (!clean) return room;
      let player = next.players.find((p) => p.id === action.playerId);
      if (!player) {
        // Sin equipo: lo pone en el equipo con menos gente (o rojo por defecto)
        const redCount = teamCount(next, 'red');
        const blueCount = teamCount(next, 'blue');
        const defaultTeam = blueCount < redCount ? 'blue' : 'red';
        if (teamCount(next, defaultTeam) >= MAX_PER_TEAM) return room;
        player = { id: action.playerId, name: clean, team: defaultTeam };
        next.players.push(player);
      } else {
        player.name = clean;
      }
      return next;
    }

    case 'leave': {
      next.players = next.players.filter((p) => p.id !== action.playerId);
      if (next.hostId === action.playerId && next.players.length > 0) {
        next.hostId = next.players[0].id;
      }
      return next;
    }

    case 'pickTeam': {
      if (next.phase !== 'lobby') return room;
      const player = next.players.find((p) => p.id === action.playerId);
      if (!player) return room;
      const { team } = action;
      if (!['red', 'blue'].includes(team)) return room;
      if (player.team === team) return room;
      if (teamCount(next, team) >= MAX_PER_TEAM) return room;
      player.team = team;
      return next;
    }

    case 'setOptions': {
      if (next.hostId !== action.playerId || next.phase !== 'lobby') return room;
      next.options = { ...next.options, ...action.options };
      return next;
    }

    case 'startGame': {
      if (next.hostId !== action.playerId || next.phase !== 'lobby') return room;
      if (!canStart(next)) return room;
      next.phase = 'playing';
      next.score = { red: 0, blue: 0 };
      next.winner = null;
      return next;
    }

    case 'goalScored': {
      // Lo manda el host cuando la pelota entra en un arco
      if (next.phase !== 'playing') return room;
      const { team } = action; // equipo que anotó
      if (!['red', 'blue'].includes(team)) return room;
      next.score[team] = (next.score[team] || 0) + 1;
      return next;
    }

    case 'endGame': {
      if (next.phase !== 'playing') return room;
      const red = next.score.red;
      const blue = next.score.blue;
      if (red > blue) next.winner = 'red';
      else if (blue > red) next.winner = 'blue';
      else next.winner = 'tie';
      next.phase = 'ended';
      return next;
    }

    case 'toLobby': {
      next.phase = 'lobby';
      next.score = { red: 0, blue: 0 };
      next.winner = null;
      return next;
    }

    default:
      return room;
  }
}
