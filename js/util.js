/* VOLT — utilità condivise */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sign = (v) => v < 0 ? -1 : (v > 0 ? 1 : 0);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const approach = (v, target, step) => v < target ? Math.min(v + step, target) : Math.max(v - step, target);

/* RNG deterministico per settore (mulberry32) */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rndRange = (rng, a, b) => a + rng() * (b - a);
const rndInt = (rng, a, b) => Math.floor(a + rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/* Storage difensivo: in incognito o con i cookie bloccati può lanciare */
const Store = {
  get(k, def) {
    try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); }
    catch (e) { return def; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignora */ } }
};

/* ---------- Particelle (pool fisso, zero allocazioni nel loop) ---------- */
const MAX_PARTS = 900;
const Particles = {
  x: new Float32Array(MAX_PARTS), y: new Float32Array(MAX_PARTS),
  vx: new Float32Array(MAX_PARTS), vy: new Float32Array(MAX_PARTS),
  life: new Float32Array(MAX_PARTS), max: new Float32Array(MAX_PARTS),
  size: new Float32Array(MAX_PARTS), grav: new Float32Array(MAX_PARTS),
  col: new Array(MAX_PARTS).fill('#fff'), kind: new Uint8Array(MAX_PARTS),
  head: 0,

  spawn(x, y, vx, vy, life, size, col, grav, kind) {
    const i = this.head;
    this.head = (this.head + 1) % MAX_PARTS;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.col[i] = col; this.grav[i] = grav === undefined ? 900 : grav;
    this.kind[i] = kind || 0;
  },

  burst(x, y, n, col, speed, size, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (0.35 + Math.random() * 0.75);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s,
        0.28 + Math.random() * 0.42, size * (0.6 + Math.random() * 0.8), col, grav, 0);
    }
  },

  spark(x, y, dx, dy, col) {
    for (let i = 0; i < 5; i++) {
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.8, s = 90 + Math.random() * 210;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.14 + Math.random() * 0.18, 2.4, col, 260, 0);
    }
  },

  smoke(x, y, col) {
    this.spawn(x + (Math.random() - 0.5) * 8, y, (Math.random() - 0.5) * 26, -20 - Math.random() * 34,
      0.4 + Math.random() * 0.35, 4 + Math.random() * 4, col, -40, 1);
  },

  update(dt) {
    for (let i = 0; i < MAX_PARTS; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.vy[i] += this.grav[i] * dt;
      this.vx[i] *= 0.985;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
  },

  draw(ctx, camX, camY) {
    ctx.save();
    for (let i = 0; i < MAX_PARTS; i++) {
      const l = this.life[i];
      if (l <= 0) continue;
      const t = l / this.max[i];
      const soft = this.kind[i] === 1;
      const s = Math.max(0.6, this.size[i] * (soft ? (1.8 - t * 0.8) : t * 1.1));
      ctx.globalAlpha = soft ? t * 0.32 : Math.min(1, t * 1.5);
      ctx.fillStyle = this.col[i];
      ctx.beginPath();
      ctx.arc(this.x[i] - camX, this.y[i] - camY, s * 0.62, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  clear() { this.life.fill(0); }
};

/* ---------- Testi fluttuanti (danno, bonus) ---------- */
const Floaters = {
  list: [],
  add(x, y, text, col, size) {
    if (this.list.length > 40) this.list.shift();
    this.list.push({ x, y, text, col, size: size || 14, life: 0.75, vy: -52 });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life -= dt; f.y += f.vy * dt; f.vy *= 0.94;
      if (f.life <= 0) this.list.splice(i, 1);
    }
  },
  draw(ctx, camX, camY) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of this.list) {
      ctx.globalAlpha = clamp(f.life * 2, 0, 1);
      ctx.font = '800 ' + f.size + 'px Nunito, system-ui, sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(26,18,52,.75)';
      ctx.lineJoin = 'round';
      ctx.strokeText(f.text, f.x - camX, f.y - camY);
      ctx.fillStyle = f.col;
      ctx.fillText(f.text, f.x - camX, f.y - camY);
    }
    ctx.restore();
  },
  clear() { this.list.length = 0; }
};

/* ---------- Disegno ---------- */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) * 0.5, Math.abs(h) * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function glowRect(ctx, x, y, w, h, col, blur, r) {
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = blur;
  ctx.fillStyle = col;
  roundRect(ctx, x, y, w, h, r || 3);
  ctx.fill();
  ctx.restore();
}
