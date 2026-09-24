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

test('Fútbol Física: el kick requiere contacto con la pelota y termina al hacer contacto o soltar espacio', () => {
  const players = [{ id: 'p1', name: 'Messi', team: 'red' }];
  let state = createGameState(players);
  // Posicionar lejos de la pelota
  state.players.p1.x = state.ball.x - 100;
  state.players.p1.y = state.ball.y;

  // 1. Apretar espacio estando lejos -> isKicking = true (busca contacto), pero NO patea la pelota a distancia
  let result = stepPhysics(state, { p1: { kick: true } }, 50);
  state = result.nextState;

  assert.equal(state.players.p1.isKicking, true);
  assert.equal(state.ball.vx, 0); // No pateó a distancia

  // 2. Soltar espacio antes de tocar la pelota -> isKicking se vuelve false inmediatamente
  result = stepPhysics(state, { p1: { kick: false } }, 50);
  state = result.nextState;
  assert.equal(state.players.p1.isKicking, false);

  // 3. Acercar al jugador a la pelota (contacto sprite a sprite, dist <= 29) y apretar espacio
  state.players.p1.x = state.ball.x - 25; // tocando la pelota (16 + 11 = 27 min dist)
  result = stepPhysics(state, { p1: { kick: true } }, 50);
  state = result.nextState;

  // Debe haber pateado la pelota
  assert.ok(Math.abs(state.ball.vx) > 0);
  // Y el efecto de kick debe haber terminado inmediatamente al hacer contacto
  assert.equal(state.players.p1.isKicking, false);
});

test('Fútbol Física: 2 jugadores comprimiendo la pelota la desplazan correctamente', () => {
  const players = [
    { id: 'p1', name: 'Rojo', team: 'red' },
    { id: 'p2', name: 'Azul', team: 'blue' },
  ];
  let state = createGameState(players);
  const cx = FIELD.width / 2;
  const cy = FIELD.height / 2;

  // Posicionar p1 a la izquierda y p2 a la derecha aprisionando a la pelota
  state.players.p1.x = cx - 25;
  state.players.p1.y = cy;
  state.players.p2.x = cx + 25;
  state.players.p2.y = cy;
  state.ball.x = cx;
  state.ball.y = cy;

  // Ambos empujan hacia adentro
  const inputs = {
    p1: { right: true },
    p2: { left: true },
  };

  const { nextState } = stepPhysics(state, inputs, 50);

  // La distancia entre la pelota y los centros de ambos jugadores debe respetar las dimensiones físicas
  const distP1 = Math.hypot(nextState.ball.x - nextState.players.p1.x, nextState.ball.y - nextState.players.p1.y);
  const distP2 = Math.hypot(nextState.ball.x - nextState.players.p2.x, nextState.ball.y - nextState.players.p2.y);

  assert.ok(distP1 >= 25, `Distancia p1 pelota (${distP1}) debe ser adecuada`);
  assert.ok(distP2 >= 25, `Distancia p2 pelota (${distP2}) debe ser adecuada`);
});

test('Fútbol Física: mapas seleccionables', () => {
  const players = [{ id: 'p1', name: 'Messi', team: 'red' }];
  const stateCancha11 = createGameState(players, { mapType: 'cancha11' });
  assert.equal(stateCancha11.field.width, 2300);
  assert.equal(stateCancha11.field.height, 1450);
});

test('Fútbol Física: sistema de estámina', () => {
  const players = [{ id: 'p1', name: 'Messi', team: 'red' }];
  let state = createGameState(players, { stamina: true });
  assert.equal(state.players.p1.stamina, 100);

  // Moverse sin shift -> velocidad al 50% (caminar), no consume estámina
  let res = stepPhysics(state, { p1: { right: true, shift: false } }, 1000);
  assert.equal(res.nextState.players.p1.stamina, 100);
  const walkVx = res.nextState.players.p1.vx;

  // Moverse con shift -> velocidad normal (correr), consume estámina
  res = stepPhysics(state, { p1: { right: true, shift: true } }, 1000);
  assert.ok(res.nextState.players.p1.stamina < 100);
  const sprintVx = res.nextState.players.p1.vx;
  assert.ok(sprintVx > walkVx, 'Velocidad al correr debe ser mayor que al caminar');
});
