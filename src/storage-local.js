// Backend de desarrollo cuando Firebase no está configurado: salas en localStorage, sincronizadas entre pestañas del mismo navegador.
import { ROOM_TTL_MS, makeCode, parseRoom, serializeRoom } from './codigo-secreto/game.js';

const PREFIX = 'codigo-secreto:sala:';
const listeners = new Map();

function read(code) {
  try {
    return parseRoom(localStorage.getItem(PREFIX + code));
  } catch {
    return null;
  }
}

function notify(code, room) {
  listeners.get(code)?.forEach((cb) => cb(room));
}

function write(code, room) {
  localStorage.setItem(PREFIX + code, serializeRoom(room));
  notify(code, room);
}

window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith(PREFIX)) notify(e.key.slice(PREFIX.length), parseRoom(e.newValue));
});

export const isLocal = true;

export function subscribeRoom(code, onRoom) {
  if (!listeners.has(code)) listeners.set(code, new Set());
  const set = listeners.get(code);
  set.add(onRoom);
  queueMicrotask(() => set.has(onRoom) && onRoom(read(code)));
  return () => set.delete(onRoom);
}

export async function updateRoom(code, updater) {
  const room = read(code);
  const next = room && updater(room);
  if (!next) return { committed: false, room };
  write(code, next);
  return { committed: true, room: next };
}

export async function createRoom(build) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const existing = read(code);
    if (existing && Date.now() - (existing.updatedAt || 0) < ROOM_TTL_MS) continue;
    const room = build();
    write(code, room);
    return { code, room };
  }
  throw new Error('No se encontró un código libre.');
}

export function subscribeConnection(onChange) {
  onChange(true);
  return () => {};
}
