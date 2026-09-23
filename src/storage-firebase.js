import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, runTransaction } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig.js';
import { ROOM_TTL_MS, makeCode, parseRoom, serializeRoom } from './codigo-secreto/game.js';

let db = null;

function database() {
  if (!db) db = getDatabase(initializeApp(firebaseConfig));
  return db;
}

// Cada sala se guarda como un string JSON: así Firebase no convierte arrays vacíos ni nulls en campos faltantes.
const roomRef = (code) => ref(database(), `rooms/${code}`);

export const isLocal = false;

export function subscribeRoom(code, onRoom, onError) {
  return onValue(roomRef(code), (snap) => onRoom(parseRoom(snap.val())), onError);
}

export async function updateRoom(code, updater) {
  const result = await runTransaction(roomRef(code), (current) => {
    // Sin caché local, Firebase pasa null aunque la sala exista; devolver null hace que reintente con el valor del servidor.
    if (current === null) return null;
    const room = parseRoom(current);
    const next = room && updater(room);
    return next ? serializeRoom(next) : undefined;
  });
  return { committed: result.committed, room: parseRoom(result.snapshot.val()) };
}

export async function createRoom(build) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    let room = null;
    const result = await runTransaction(roomRef(code), (current) => {
      const existing = parseRoom(current);
      if (existing && Date.now() - (existing.updatedAt || 0) < ROOM_TTL_MS) return undefined;
      room = build();
      return serializeRoom(room);
    });
    if (result.committed) return { code, room };
  }
  throw new Error('No se encontró un código libre.');
}

// Solo avisa de desconexión después de haber estado conectado, para no mostrar el aviso al cargar.
export function subscribeConnection(onChange) {
  let wasConnected = false;
  return onValue(ref(database(), '.info/connected'), (snap) => {
    const connected = snap.val() === true;
    if (connected) wasConnected = true;
    onChange(connected || !wasConnected);
  });
}
