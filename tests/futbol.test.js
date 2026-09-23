import test from 'node:test';
import assert from 'node:assert/strict';
import { newRoom, applyAction, canStart, isHost } from '../src/futbol/game.js';
import { createGameState, stepPhysics, FIELD, GOAL } from '../src/futbol/physics.js';

test('Fútbol: creación de sala y defaults', () => {
  const room = newRoom('h1', 'Messi');
  assert.equal(room.gameType, 'futbol');
  assert.equal(room.phase, 'lobby');
  assert.equal(room.hostId, 'h1');
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].name, 'Messi');
  assert.equal(room.players[0].team, 'red');
  assert.equal(canStart(room), false);
});

test('Fútbol: unirse y cambiar de equipo', () => {
  let room = newRoom('h1', 'Messi');
  room = applyAction(room, { type: 'join', playerId: 'p2', name: 'Ronaldo' });
  assert.equal(room.players.length, 2);
  // Se asigna automáticamente al equipo con menos jugadores (blue)
  assert.equal(room.players[1].team, 'blue');
  assert.equal(canStart(room), true);

  // Cambiar a rojo
  room = applyAction(room, { type: 'pickTeam', playerId: 'p2', team: 'red' });
  assert.equal(room.players[1].team, 'red');
  assert.equal(canStart(room), false); // No hay nadie en blue
});

test('Fútbol: iniciar partido y registrar goles', () => {
  let room = newRoom('h1', 'Messi');
  room = applyAction(room, { type: 'join', playerId: 'p2', name: 'Ronaldo' });
  room = applyAction(room, { type: 'startGame', playerId: 'h1' });
  assert.equal(room.phase, 'playing');

  // Gol de rojo
  room = applyAction(room, { type: 'goalScored', playerId: 'h1', team: 'red' });
  assert.equal(room.score.red, 1);
  assert.equal(room.score.blue, 0);

  // Fin del partido
  room = applyAction(room, { type: 'endGame', playerId: 'h1' });
  assert.equal(room.phase, 'ended');
  assert.equal(room.winner, 'red');
});

test('Fútbol Física: colisión y movimiento básico', () => {
  const players = [
    { id: 'p1', name: 'Messi', team: 'red' },
    { id: 'p2', name: 'Ronaldo', team: 'blue' },
  ];
  const state = createGameState(players);
  assert.ok(state.ball);
  assert.equal(state.ball.x, FIELD.width / 2);
  assert.equal(state.ball.y, FIELD.height / 2);

  // Dar input a Messi hacia la derecha
  const inputs = {
    p1: { right: true },
  };
  const { nextState } = stepPhysics(state, inputs, 50);
  assert.ok(nextState.players.p1.vx > 0);
  assert.ok(nextState.players.p1.x > state.players.p1.x);
});
