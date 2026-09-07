/* VOLT — generazione procedurale dei settori (livelli infiniti) */
'use strict';

const TILE = 32;
const T_EMPTY = 0, T_SOLID = 1, T_PLAT = 2, T_SPIKE = 3;

const OUTLINE = '#20183f';

const THEMES = [
  { name: 'PRATERIA CROMO',
    sky: ['#8fe9ff', '#4f63d8'], hills: ['#7d8ae6', '#5f66cf', '#4243a6'],
    body: '#3fae72', body2: '#1f6b4c', crust: '#5fd68a', crust2: '#a6f7bd',
    plat: '#ffc247', spike: '#ff6b6b', accent: '#ffe08a', fog: '#a8e6ff' },
  { name: 'DESERTO SOLARE',
    sky: ['#ffd792', '#ff7d5c'], hills: ['#f2916d', '#d96f58', '#a54d47'],
    body: '#d98f52', body2: '#8c4f28', crust: '#f8c581', crust2: '#ffe6b4',
    plat: '#6fe4f5', spike: '#6a45b8', accent: '#fff3cd', fog: '#ffd9a4' },
  { name: 'LAGUNA PROFONDA',
    sky: ['#8ff4e6', '#1f7fdb'], hills: ['#46aecd', '#2f83b2', '#1e5c89'],
    body: '#1f9a94', body2: '#0a565f', crust: '#5ce0c4', crust2: '#bafbe9',
    plat: '#ffd166', spike: '#ff6b9d', accent: '#b6fff2', fog: '#a6f2ff' },
  { name: 'GIARDINO VIOLA',
    sky: ['#fbb0ec', '#7a4bd8'], hills: ['#ac6fe4', '#8d52cc', '#61319f'],
    body: '#8f55cd', body2: '#4b2482', crust: '#cb8ff7', crust2: '#f0ccff',
    plat: '#a0ff8f', spike: '#ffd166', accent: '#ffdcff', fog: '#ecc0ff' },
  { name: 'GHIACCIAIO',
    sky: ['#ecf9ff', '#5fb0e6'], hills: ['#a5d4f0', '#7fb8df', '#5e93c2'],
    body: '#8bc4e6', body2: '#3d6f99', crust: '#e6f7ff', crust2: '#ffffff',
    plat: '#ffa06e', spike: '#ff6b9d', accent: '#ffffff', fog: '#e4f5ff' }
];

/* Il mondo è più alto di quanto serva al terreno: il margine sotto permette
   alla camera di tenere il giocatore alto sullo schermo, sopra i comandi touch. */
const LEVEL_H = 32;

function generateLevel(n) {
  const rng = makeRng(0x9e37 + n * 2654435761);
  const boss = (n % 5 === 0);
  const theme = THEMES[Math.floor((n - 1) / 5) % THEMES.length];
  const w = boss ? 58 : Math.min(64 + n * 5, 190);
  const h = LEVEL_H;
  const tiles = new Uint8Array(w * h);
  const at = (x, y) => (y * w + x);
  const set = (x, y, v) => { if (x >= 0 && x < w && y >= 0 && y < h) tiles[at(x, y)] = v; };

  const spawns = [];
  const pickups = [];
  const groundY = new Int16Array(w).fill(-1);   // -1 = burrone

  /* --- terreno a segmenti --- */
  let x = 0;
  let gy = h - 9;                                // altezza del suolo corrente
  const minY = 8, maxY = h - 6;
  const difficulty = Math.min(1, (n - 1) / 22);

  const fillColumn = (cx, top) => {
    for (let y = top; y < h; y++) set(cx, y, T_SOLID);
    groundY[cx] = top;
  };

  /* zona di partenza sempre piatta e sicura */
  for (; x < 9; x++) fillColumn(x, gy);

  while (x < w - 10) {
    const roll = rng();
    if (!boss && roll < 0.20 + difficulty * 0.12) {
      /* burrone da saltare (con eventuali spine sul fondo) */
      const gap = rndInt(rng, 2, 3 + Math.round(difficulty));   /* max 4 tile: sempre saltabile */
      for (let i = 0; i < gap && x < w - 10; i++, x++) {
        groundY[x] = -1;
        if (rng() < 0.5) set(x, h - 1, T_SPIKE);
      }
      /* isola di atterraggio */
      const seg = rndInt(rng, 4, 8);
      gy = clamp(gy + rndInt(rng, -2, 2), minY + 4, maxY);
      for (let i = 0; i < seg && x < w - 10; i++, x++) fillColumn(x, gy);
    } else if (!boss && roll < 0.42) {
      /* gradino / muretto */
      const step = rndInt(rng, -3, 3);
      gy = clamp(gy + step, minY + 3, maxY);
      const seg = rndInt(rng, 5, 11);
      for (let i = 0; i < seg && x < w - 10; i++, x++) fillColumn(x, gy);
    } else {
      /* pianura, con possibili spine in superficie */
      const seg = rndInt(rng, 7, 16);
      for (let i = 0; i < seg && x < w - 10; i++, x++) {
        fillColumn(x, gy);
        if (!boss && i > 1 && i < seg - 2 && rng() < 0.05 + difficulty * 0.05) set(x, gy - 1, T_SPIKE);
      }
    }
  }
  /* zona finale piatta col portale */
  gy = clamp(gy, minY + 3, maxY);
  for (; x < w; x++) fillColumn(x, gy);

  /* --- piattaforme sospese --- */
  const platCount = boss ? 5 : Math.floor(w / 9);
  for (let i = 0; i < platCount; i++) {
    const px = rndInt(rng, 10, w - 12);
    const base = groundY[px] > 0 ? groundY[px] : h - 6;
    const py = clamp(base - rndInt(rng, 3, 7), minY, h - 4);
    const len = rndInt(rng, 3, 7);
    let ok = true;
    for (let k = 0; k < len; k++) if (tiles[at(px + k, py)] !== T_EMPTY) { ok = false; break; }
    if (!ok) continue;
    for (let k = 0; k < len && px + k < w; k++) set(px + k, py, T_PLAT);
    if (rng() < 0.55) pickups.push({ x: (px + len / 2) * TILE, y: (py - 1.2) * TILE });
  }

  /* Niente muri di tile ai lati: sarebbero colonne che salgono nel cielo.
     Il giocatore viene tenuto dentro dal clamp orizzontale, i mostri dai bordi del terreno. */
  /* niente soffitto: sopra c'e il cielo. Il giocatore viene fermato in alto dal clamp. */

  /* --- nemici --- */
  const types = ['crawler'];
  if (n >= 2) types.push('flyer');
  if (n >= 3) types.push('spitter');
  if (n >= 6) types.push('charger');
  if (n >= 8) types.push('bomber');

  if (boss) {
    spawns.push({ type: 'boss', x: (w - 16) * TILE, y: (groundY[w - 16] - 6) * TILE, tier: Math.ceil(n / 5) });
    const guards = 2 + Math.floor(n / 5);
    for (let i = 0; i < guards; i++) {
      const sx = rndInt(rng, 16, w - 20);
      const sy = groundY[sx] > 0 ? groundY[sx] - 2 : h - 8;
      spawns.push({ type: pick(rng, types), x: sx * TILE, y: sy * TILE });
    }
  } else {
    const count = Math.min(6 + Math.floor(n * 1.6), 26);
    let attempts = 0;
    while (spawns.length < count && attempts < count * 30) {
      attempts++;
      const sx = rndInt(rng, 14, w - 8);
      if (groundY[sx] < 0) continue;
      const type = pick(rng, types);
      const sy = (type === 'flyer' || type === 'bomber')
        ? clamp(groundY[sx] - rndInt(rng, 4, 9), minY, h - 4)
        : groundY[sx] - 2;
      if (tiles[at(sx, sy)] !== T_EMPTY) continue;
      spawns.push({ type, x: sx * TILE, y: sy * TILE });
    }
  }

  /* --- extra pickup a terra --- */
  for (let i = 0; i < 2 + Math.floor(n / 4); i++) {
    const px = rndInt(rng, 12, w - 10);
    if (groundY[px] < 0) continue;
    pickups.push({ x: px * TILE, y: (groundY[px] - 1.4) * TILE });
  }

  /* --- sfondo: colline morbide su tre piani + nuvole --- */
  const hills = [];
  for (let layer = 0; layer < 3; layer++) {
    const n = 10 + layer * 4;
    for (let i = 0; i < n; i++) {
      hills.push({
        x: (i / n) * w * TILE + rndRange(rng, -90, 90),
        w: rndRange(rng, 240, 640) * (1 - layer * 0.14),
        h: rndRange(rng, 70, 190) * (0.75 + layer * 0.3),
        layer
      });
    }
  }
  hills.sort((a, b) => a.layer - b.layer);
  const motes = [];
  for (let i = 0; i < 26; i++)
    motes.push({ x: rng(), y: rng(), r: rndRange(rng, 1.5, 3.6), sp: rndRange(rng, 6, 22), ph: rng() * 6.3 });
  const clouds = [];
  for (let i = 0; i < 12; i++)
    clouds.push({ x: rng(), y: rndRange(rng, 0.04, 0.42), s: rndRange(rng, 0.55, 1.5), spd: rndRange(rng, 3, 11) });

  return {
    n, boss, theme, w, h, tiles, spawns, pickups, hills, clouds, motes,
    pxW: w * TILE, pxH: h * TILE,
    startX: 5 * TILE, startY: (groundY[5] - 2) * TILE,
    portalX: (w - 3) * TILE, portalY: (groundY[w - 3] - 2) * TILE,
    groundY,
    tileAt(tx, ty) {
      if (tx < 0 || tx >= this.w || ty < 0) return T_SOLID;
      if (ty >= this.h) return T_EMPTY;
      return this.tiles[ty * this.w + tx];
    },
    solidAt(px, py) {
      const t = this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE));
      return t === T_SOLID;
    }
  };
}
