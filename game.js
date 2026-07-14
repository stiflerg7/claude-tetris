'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---- Skins: bloques cuadrados planos con highlight superior (estilo actual) ----
function drawBlockRetro(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKINS.retro.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// ---- Skin Neon: fondo oscuro + borde y núcleo con glow (shadowBlur) ----
function drawBlockNeon(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKINS.neon.colors[colorIndex];
  const px = x * size + 1, py = y * size + 1, w = size - 2, h = size - 2;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = '#05050a';
  context.fillRect(px, py, w, h);
  context.shadowBlur = size * 0.5;
  context.shadowColor = color;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 1.5, py + 1.5, w - 3, h - 3);
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.globalAlpha = (alpha ?? 1) * 0.55;
  context.fillRect(px + 5, py + 5, Math.max(0, w - 10), Math.max(0, h - 10));
  context.restore();
}

// ---- Skin Pastel: colores suaves + esquinas redondeadas ----
function drawBlockPastel(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKINS.pastel.colors[colorIndex];
  const px = x * size + 1, py = y * size + 1, w = size - 2, h = size - 2;
  const r = Math.min(6, size * 0.22);
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(px, py, w, h, r);
    context.fill();
  } else {
    // fallback sin roundRect: rectángulo simple
    context.fillRect(px, py, w, h);
  }
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fillRect(px + r, py + 1, Math.max(0, w - 2 * r), Math.max(0, h * 0.3));
  context.restore();
}

// ---- Skin Pixel art: color base + patrón de puntos tipo textura ----
function drawBlockPixel(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKINS.pixel.colors[colorIndex];
  const px = x * size + 1, py = y * size + 1, w = size - 2, h = size - 2;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, w, h);
  const step = Math.max(4, Math.floor(size / 4));
  context.fillStyle = 'rgba(0,0,0,0.22)';
  for (let yy = py; yy < py + h; yy += step) {
    for (let xx = px; xx < px + w; xx += step) {
      context.fillRect(xx, yy, step / 2, step / 2);
    }
  }
  context.strokeStyle = 'rgba(0,0,0,0.35)';
  context.lineWidth = 1;
  context.strokeRect(px + 0.5, py + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  context.restore();
}

// Registro de skins: cada uno define su paleta de colores y su función de dibujo.
const SKINS = {
  retro: {
    label: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d'],
    draw: drawBlockRetro,
  },
  neon: {
    label: 'Neon',
    colors: [null, '#00e5ff', '#faff00', '#e000ff', '#00ff85', '#ff1744', '#3d5afe', '#ff9100'],
    draw: drawBlockNeon,
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a9d8e6', '#fde3a7', '#dcbbe3', '#b9e0c4', '#f4b9b9', '#bcc6e8', '#f5d3ab'],
    draw: drawBlockPastel,
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d'],
    draw: drawBlockPixel,
  },
};

const SKIN_KEY = 'tetris-skin';
let currentSkin = 'retro';

// Despachador: delega el dibujo de un bloque al skin activo.
function drawBlock(context, x, y, colorIndex, size, alpha) {
  SKINS[currentSkin].draw(context, x, y, colorIndex, size, alpha);
}

// Aplica un skin, lo persiste y fuerza un redibujo inmediato (sin recargar).
function applySkin(skinName) {
  if (!SKINS[skinName]) skinName = 'retro';
  currentSkin = skinName;
  localStorage.setItem(SKIN_KEY, skinName);
  const select = document.getElementById('skin-select');
  if (select && select.value !== skinName) select.value = skinName;
  if (current) draw();
}

// Carga el skin guardado (o retro por defecto) al iniciar.
function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(saved && SKINS[saved] ? saved : 'retro');
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

const skinSelect = document.getElementById('skin-select');
if (skinSelect) {
  skinSelect.addEventListener('change', e => applySkin(e.target.value));
}

initSkin();
init();
