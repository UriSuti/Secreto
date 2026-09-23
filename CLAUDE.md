# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma y preferencias del autor

- **Escribí todo en español rioplatense**: la interfaz, los comentarios del código, los mensajes
  de error, los nombres de los tests y las respuestas al usuario. Usá "vos/tenés/podés", no "tú/tienes".
  Los identificadores del código quedan en inglés (`currentTeam`, `spymaster`), los textos visibles en español.
- **Mantené el repo limpio**: si un archivo deja de usarse, borralo en vez de dejarlo al costado.
  Ya se eliminó un prototipo viejo (`codigo-secreto.jsx`) por esto. No dejes archivos de respaldo,
  `.old`, ni código muerto. `dist/` y `.firebase/` son artefactos: no se versionan ni se dejan en el árbol.
- **Siempre subí los cambios a Firebase.** Todo cambio termina desplegado (ver *Desplegar*),
  aunque el pedido no lo diga y sin preguntar. Un cambio que no está publicado no está terminado.
  El orden es: tests → navegador → deploy → borrar las salas de prueba → borrar `dist/` y `.firebase/`.
- **Verificá en un navegador de verdad**, no solo con los tests. Varias cosas del juego (votación,
  chat por equipo, revelado diferido) necesitan varios jugadores simultáneos para probarse.

## Vocabulario del juego

El autor usa estos nombres; la interfaz los refleja:

| En el código | Como lo dice el usuario | Qué hace |
|---|---|---|
| `spymaster` | **espía**, líder, capitán | Ve los colores del tablero y da la pista |
| `operative` | **agente**, miembro | Toca las casillas sin ver los colores |

## Comandos

```bash
npm install
npm run dev          # servidor de desarrollo (Vite)
npm test             # tests de la lógica del juego
npm run build        # genera dist/
npm run preview      # sirve dist/ localmente
```

Un test solo (el patrón matchea contra el nombre del test, en español):

```bash
node --test-name-pattern="la pista N da exactamente N intentos" --test tests/game.test.js
```

### Desplegar

`firebase` no está instalado globalmente, pero las credenciales sí están guardadas en
`~/.config/configstore/firebase-tools.json`. **Siempre buildear antes**, porque `dist/` no existe
en un árbol limpio:

```bash
npm run build && npx firebase-tools@latest deploy --only hosting --non-interactive
```

Proyecto: `secreto-aed7e` · Sitio: https://secreto-aed7e.web.app

Desplegá **solo hosting**. `database.rules.json` casi nunca cambia y mandarlo pisaría las reglas vivas.

Para borrar una sala de prueba de la base:

```bash
curl -X DELETE https://secreto-aed7e-default-rtdb.firebaseio.com/rooms/ABCD.json
```

## De qué se trata el juego

Es un Codenames online. Cada jugador entra desde su propia pantalla a una sala de 4 letras.

- El tablero tiene palabras repartidas entre los equipos, casillas **neutrales** (blancas) y
  **bombas** (negras). Solo los espías ven de quién es cada palabra.
- El espía de turno manda **una sola palabra** y un número: "playa 3" significa "tres palabras
  del tablero se relacionan con playa". La pista no puede ser una palabra del tablero ni tener espacios.
- Los agentes tocan casillas. **El número da exactamente esa cantidad de intentos** (no N+1).
- Gana el equipo que destapa todas sus palabras. Tocar una bomba elimina al equipo: con 2 equipos
  gana el otro, con 3 o 4 la partida sigue sin él.

### Modificadores del lobby (solo el anfitrión)

| Opción | Valores | Efecto |
|---|---|---|
| `teamCount` | 2 / 3 / 4 | Rojo, azul, amarillo, verde. Tablero 5×5, 6×6 o 7×7 |
| `bombs` | 1 a 5 | Casillas negras |
| `keepAfterNeutral` | bool | Si tocar una blanca corta o no los intentos que quedan. Solo «al instante» |
| `keepAfterOpponent` | bool | Ídem, pero con una casilla de otro equipo. Solo «al instante» |
| `clueMinutes` | 0/1/2/3/5/10 | Reloj del espía. 0 = sin límite |
| `guessMinutes` | 0/1/2/3/5/10 | Reloj de los agentes |
| `instantReveal` | bool | Cómo se eligen las casillas: ver *Los dos modos de elegir* |

**Cada equipo siempre aporta la misma cantidad de palabras**: 9 el que abre y 8 los demás.
Lo que crece con más equipos son las neutrales, para llenar el tablero cuadrado.

### Chat

Dos canales, en pestañas:

- **Global**: todos los jugadores, solo con mensajes rápidos (`CHAT_MESSAGES`: Apurate, Dale
  rapido, Mish, Virgo). No se escribe.
- **Equipo**: solo los agentes de un mismo equipo, **con texto libre** (hasta 140 caracteres).
  Es para discutir qué casillas elegir, así que ahí sí se pueden nombrar palabras del tablero.
  El espía no entra: la pestaña le aparece deshabilitada y el reducer rechaza sus mensajes.

Los nombres aparecen del color del equipo. Un mensaje global guarda el índice del mensaje
rápido en `m`; uno de equipo guarda el texto en `x`.

### Los dos modos de elegir (`instantReveal`)

En los dos, tocar una casilla abre una ✕ y un ✓, y el ✓ es un **voto**. Con un solo agente la
mayoría es 1, así que votar equivale a elegir: el mismo código sirve para uno o para varios.

**Al instante** (`true`, el modo clásico):
- La casilla se destapa apenas la vota la mayoría del equipo, y el turno sigue o se corta
  según de quién era (y según `keepAfterNeutral` / `keepAfterOpponent`).
- **El voto es definitivo**: cada agente vota una sola casilla y no la puede sacar. Por eso existe
  la regla 5 («No se puede cambiar una elección después de confirmarla»).
- Si votan todos sin mayoría, los votos se borran y se vota de nuevo (`voteReset`), si no el turno
  se trabaría.

**Al terminar el turno** (`false`):
- Una casilla con mayoría queda **elegida**, pero **no se destapa**. Nada se resuelve solo, ni
  siquiera al llegar al número de la pista.
- Cada agente vota hasta `clue.number` casillas y puede **sacar sus votos** (acción `unvote`)
  volviendo a tocarlas. El equipo nunca tiene más elegidas que intentos.
- **Solo «Terminar turno» destapa** (o el reloj, si se acaba). Ahí se ven todas las elegidas juntas
  y el turno siempre pasa. Si entre ellas hay una bomba, eso pesa más que cualquier otra cosa.
- La regla 5 no se muestra, y `keepAfterNeutral` / `keepAfterOpponent` se deshabilitan en el lobby:
  como todo se ve a la vez, no hay «después de una blanca».
- `pickedCards(room)` calcula las elegidas a partir de los votos; la interfaz y el reducer usan la
  misma función para no ofrecer un ✓ que después se rechace.

## Arquitectura

### La regla de oro: `src/game.js` es lógica pura

Todo el juego es un **reducer sin React ni red**. `applyAction(room, action, { rand, now })`
devuelve la sala nueva, o `null` si la acción no es válida para ese estado. No lee el reloj ni
el random por su cuenta: los recibe, y por eso se puede testear con valores fijos.

Esto importa porque el reducer **corre dentro de la transacción de Firebase**
(`runTransaction` en `storage-firebase.js`): si dos jugadores mandan una jugada al mismo tiempo,
la segunda se reaplica sobre el estado ya actualizado. Consecuencias al tocar el código:

- Nada de `Math.random()`, `Date.now()`, `fetch` ni estado de React dentro de `game.js`.
- Toda validación va en el reducer, no en la interfaz. Lo de la interfaz es para avisar antes;
  lo que realmente protege la partida es el `return null`.
- Las acciones de jugada llevan `round` y `turn`; si no coinciden con los de la sala, se descartan.
  Así una jugada de un turno viejo que llega tarde no hace nada.

### La sala entera es un string JSON

Firebase guarda cada sala como **un solo string** en `rooms/<CÓDIGO>`, no como un objeto.
Es a propósito: Realtime Database borra los arrays vacíos y los `null`, y eso rompía el tablero.
`serializeRoom` / `parseRoom` hacen la conversión.

`database.rules.json` limita cada sala a **30.000 caracteres**. Si una escritura lo pasa,
Firebase la rechaza, y como todo vive en la misma sala **se traba la partida entera**, no solo
ese campo. El peor caso hoy (4 equipos, 20 jugadores, los cuatro chats de equipo llenos de
texto con comillas, bitácora llena) da ~19.500. Hay un test que lo verifica.

Cualquier campo nuevo que crezca tiene que llevar su tope. El chat tiene dos: cantidad por
canal (`MAX_CHAT` para el global, `MAX_TEAM_CHAT` para cada equipo) y un presupuesto en
caracteres (`CHAT_BUDGET`) que tira los mensajes más viejos si el texto libre pesa demasiado.
La bitácora tiene `MAX_LOG`.

`parseRoom` pasa por `normalizeRoom`, que rellena lo que falte. Eso deja que una sala guardada
por una versión anterior siga abriéndose sin romper.

### Los archivos

| Archivo | Qué es |
|---|---|
| `src/game.js` | Reducer, reglas, validaciones, generación del tablero. El corazón |
| `src/words.js` | 980 palabras únicas del pozo |
| `src/App.jsx` | Las tres pantallas (inicio, lobby, partida) y el estado local |
| `src/Options.jsx` `src/Chat.jsx` `src/Rules.jsx` `src/Players.jsx` | Paneles de la interfaz |
| `src/theme.js` | Colores y estilos compartidos. La estética es "expediente de espionaje" |
| `src/storage.js` | Elige el backend según haya o no Firebase configurado |
| `src/storage-firebase.js` | Transacciones y suscripciones contra Realtime Database |
| `src/storage-local.js` | Backend de desarrollo en localStorage, solo entre pestañas |
| `src/session.js` | Quién sos: `sessionStorage` por pestaña, `localStorage` por dispositivo |

La partida tiene tres columnas: jugadores a la izquierda (cada nombre del color de su equipo),
tablero al medio, reglas/chat/bitácora a la derecha. El reparto está en `index.css` con
`grid-template-areas`: en pantallas medianas los jugadores suben a la columna derecha y en
celular va todo apilado con el tablero primero.

`docs/captura.png` es la imagen del README: una partida armada a mano con `game.js`, escrita en
la base y abierta como el espía rojo. Si la interfaz cambia mucho, conviene rehacerla.

Si `firebaseConfig.databaseURL` queda vacío, la app arranca en modo local automáticamente y
avisa con un cartel. Sirve para desarrollar sin tocar la base real.

### Acciones del reducer

`join` `leave` `pickRole` `setOptions` `start` `setPaused` `chat` `clue` `vote` `unvote` `endTurn`
`timeout` `newRound` `toLobby`

Notas sobre algunas:

- **`vote`** / **`unvote`**: ver *Los dos modos de elegir*. `unvote` solo existe al terminar el turno.
- **`endTurn`**: al instante pasa el turno (exige haber destapado una); al terminar el turno
  destapa las elegidas con `resolvePicks` (exige tener al menos una).
- **`timeout`** la manda cualquier cliente cuando ve el reloj en cero. El reducer verifica
  `now >= timer.deadline`, y la transacción deja pasar solo al primero. Al terminar el turno,
  destapa lo que ya estuviera elegido antes de pasar.
- **`setPaused`** congela el reloj guardando lo que quedaba en `timer.left`, y al reanudar lo
  convierte de nuevo en `deadline`.

### Cosas que ya mordieron

- **La pista de los tests no puede existir en el pozo de palabras.** `tests/game.test.js` usa
  `CLUE_WORD = 'zarpadisimo'` justamente por eso: antes usaba `'pista'`, que está entre las 980
  palabras, y los tests fallaban al azar cuando caía en el tablero.
- **El equipo que abre sale al azar.** El helper `playingRoom()` rearma la sala hasta que empiece
  rojo, porque el que abre tiene 9 palabras y el resto 8. Forzar `currentTeam` a mano deja el
  tablero inconsistente con el reparto.
- **El chat de equipo es un filtro de la interfaz, no un secreto criptográfico.** Todo el estado
  de la sala viaja junto, así que alguien mirando la base podría leerlo. Alcanza para jugar entre
  amigos; no lo presentes como más que eso.
- **En «al terminar el turno» las elegidas siguen sin destapar.** Un test o un script que busque
  «la primera casilla roja sin destapar» va a encontrar otra vez la que ya eligió. Pasó.
- **Los atributos `data-pick`, `data-opt`, `data-chat-list` y `data-players`** existen para poder
  manejar la app desde un navegador automatizado. No los saques.

### Importante por cada nueva adicion al proyecto
- El archivo 'updates.txt' lleva un registro de las actualizaciones, por cada cambio que hagas, quiero que lo agregues ahi, si es un cambio pequeño, a la version x.y.z sumale a Z+1. Si es un cambio grande, a la version x.y.z, sumale Y+1 y establece el Z en 0. Si es un cambio gigantesco, como una gran actualizacion, a la version x.y.z sumale a X+1, y establece ambas Y,Z en 0.