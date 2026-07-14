# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris clásico implementado en JavaScript vanilla + HTML5 Canvas. Sin dependencias, sin `package.json`, sin bundler ni transpilador.

## Running the game

No hay build ni tests. Para jugar/probar cambios, simplemente sirve los archivos estáticos:

```bash
open index.html                # macOS, abre directo en el navegador
python3 -m http.server 8000    # o cualquier servidor estático
npx serve .
```

No existen linters, test runners ni scripts npm configurados en este repo.

## Architecture

Tres archivos cooperan, sin módulos ni framework:

- `index.html` — DOM: `<canvas id="board">` (300×600, tablero) y `<canvas id="next-canvas">` (preview de la siguiente pieza), panel con score/lines/level, y overlay de pausa/game-over.
- `style.css` — tema oscuro retro-arcade.
- `game.js` — toda la lógica del juego, en un único scope global (`'use strict'`, sin módulos).

### Modelo de datos

- **Tablero**: matriz `board[ROWS][COLS]` (20×10), cada celda es `0` (vacía) o un índice `1-7` que indica tanto el tipo de pieza como su color (ver `COLORS`/`PIECES`).
- **Piezas**: las 7 estándar (I,O,T,S,Z,J,L) definidas en `PIECES` como matrices cuadradas. `current` y `next` son objetos `{ type, shape, x, y }`.
- **Rotación**: `rotateCW()` transpone + invierte filas (sin matriz de rotación por estado, siempre rota "hacia adelante").
- **Wall kicks**: `tryRotate()` prueba offsets `[0, -1, 1, -2, 2]` tras rotar, antes de descartar el giro.
- **Colisión**: `collide(shape, ox, oy)` es la única fuente de verdad para bordes/solapamiento; todo movimiento (mover, rotar, caer) pasa por ella.

### Game loop

`loop(ts)` corre vía `requestAnimationFrame`, acumula `dt` en `dropAccum` y baja la pieza cuando supera `dropInterval`. `dropInterval` se recalcula en `clearLines()` como `max(100, 1000 - (level-1)*90)`.

Flujo: `init()` → `spawn()` (mueve `next` a `current`, genera nuevo `next`; si colisiona al aparecer, `endGame()`) → loop de render/drop → al bloquear pieza: `lockPiece()` → `merge()` + `clearLines()` + `spawn()`.

### Scoring

`LINE_SCORES = [0, 100, 300, 500, 800]` multiplicado por `level`. Hard drop suma 2 pts/celda, soft drop 1 pt/fila. El nivel sube cada 10 líneas totales.

### Rendering

Todo el dibujo es imperativo sobre Canvas 2D (`draw()`, `drawNext()`, `drawGrid()`, `drawBlock()`) — no hay estado de "dirty rect", se redibuja el frame completo en cada tick. La ghost piece (`ghostY()`) se dibuja con `globalAlpha = 0.2`.

### Estado global e input

El estado del juego vive en variables globales module-level (`board, current, next, score, lines, level, paused, gameOver, ...`), no en una clase ni store. El input se maneja con un único listener `keydown` que despacha por `e.code`.

## Tuning params (en `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval` inicial. Si se cambia `COLS`/`ROWS`/`BLOCK`, hay que ajustar también `width`/`height` del `<canvas id="board">` en `index.html`.
