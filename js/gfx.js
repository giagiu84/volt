/* VOLT — helper grafici: forme morbide, ombre, luci.
   Tutto ciò che è costoso (gradienti radiali) viene disegnato una volta
   su canvas fuori schermo e poi ricopiato: niente shadowBlur nel loop. */
'use strict';

const Gfx = {
  _glow: new Map(),
  _shadow: null,
  quality: 1,

  init() {
    /* ombra morbida riutilizzabile */
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 32, 0, 64, 32, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.26)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(64, 32, 64, 32, 0, 0, TAU); g.fill();
    this._shadow = c;
  },

  /* texture di luce colorata, generata una volta per colore */
  glowTex(col) {
    let c = this._glow.get(col);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, col);
    grad.addColorStop(0.25, this.alpha(col, 0.55));
    grad.addColorStop(1, this.alpha(col, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this._glow.set(col, c);
    return c;
  },

  /* '#rrggbb' -> 'rgba(r,g,b,a)' */
  alpha(col, a) {
    if (col[0] !== '#') return col;
    const n = parseInt(col.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  },
  mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    const bl = Math.round(lerp(pa & 255, pb & 255, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  },

  light(ctx, x, y, r, col, a) {
    const t = this.glowTex(col);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a === undefined ? 0.85 : a;
    ctx.drawImage(t, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  },

  shadow(ctx, x, y, w, a) {
    ctx.save();
    ctx.globalAlpha = a === undefined ? 0.5 : a;
    ctx.drawImage(this._shadow, x - w / 2, y - w / 4, w, w / 2);
    ctx.restore();
  },

  /* capsula (corpo, arti, piattaforme) */
  capsule(ctx, x, y, w, h, col, line, lw) {
    roundRect(ctx, x, y, w, h, Math.min(w, h) / 2);
    ctx.fillStyle = col; ctx.fill();
    if (line) { ctx.lineWidth = lw || 3; ctx.strokeStyle = line; ctx.stroke(); }
  },

  /* corpo morbido con leggera deformazione organica */
  blob(ctx, w, h, wobble, t) {
    const rx = w / 2, ry = h / 2, N = 12;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const k = 1 + Math.sin(a * 3 + t * 3) * wobble;
      const px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },

  /* occhio cartoon con pupilla che guarda verso (dx,dy) */
  eye(ctx, x, y, r, dx, dy, dark) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    const l = Math.hypot(dx, dy) || 1;
    const px = x + (dx / l) * r * 0.34, py = y + (dy / l) * r * 0.34;
    ctx.beginPath(); ctx.arc(px, py, r * 0.52, 0, TAU);
    ctx.fillStyle = dark || '#1a1230'; ctx.fill();
    ctx.beginPath(); ctx.arc(px - r * 0.18, py - r * 0.2, r * 0.18, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
  },

  /* onda d'urto: anello che si allarga */
  ring(ctx, x, y, r, col, w, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.restore();
  },

  /* riflesso lucido in alto: dà il look "gommoso" */
  gloss(ctx, x, y, w, h, a) {
    ctx.save();
    ctx.globalAlpha = a === undefined ? 0.35 : a;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.restore();
  }
};

/* ---------- onde d'urto condivise ---------- */
const Rings = {
  list: [],
  add(x, y, col, max, life, w) {
    if (this.list.length > 24) this.list.shift();
    this.list.push({ x, y, col, max: max || 60, life: life || 0.34, t: life || 0.34, w: w || 4 });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      r.t -= dt;
      if (r.t <= 0) this.list.splice(i, 1);
    }
  },
  draw(ctx, camX, camY) {
    for (const r of this.list) {
      const k = 1 - r.t / r.life;
      Gfx.ring(ctx, r.x - camX, r.y - camY, r.max * (0.15 + k * 0.85), r.col, r.w * (1 - k * 0.7), (1 - k) * 0.75);
    }
  },
  clear() { this.list.length = 0; }
};

/* ---------- illustrazioni dei custodi ----------
   Se in assets/heroes/ ci sono i disegni (aren_front, aren_side, aren_back e
   gli stessi per lyra, in webp o png) la scelta li usa; altrimenti resta il
   personaggio disegnato dal codice. Nessun errore se mancano: si prova e basta. */
/* ---------- giro completo dei custodi ----------
   Una striscia di fotogrammi (uno ogni pochi gradi) ricavata dal foglio di
   rotazione: qui non si inventa nulla, si mostra il fotogramma giusto. */
const HERO_FRAME_W = 150, HERO_FRAME_H = 210;

const HeroSpin = {
  data: {}, tried: false,
  load() {
    if (this.tried) return;
    this.tried = true;
    for (const who of ['aren', 'lyra']) {
      const im = new Image();
      const rec = { img: im, frames: 0 };
      im.onload = () => { rec.frames = Math.round(im.naturalWidth / HERO_FRAME_W); };
      im.onerror = () => { rec.frames = 0; };
      im.src = 'assets/heroes/' + who + '_spin.webp';
      this.data[who] = rec;
    }
  },
  ready(who) {
    const r = this.data[who];
    return !!(r && r.frames > 1 && r.img.naturalWidth);
  },
  /* Disegna l'angolo richiesto. Fra un fotogramma e il successivo il secondo
     entra in dissolvenza: cosi la rotazione resta liscia anche da ferma, senza
     dover girare in fretta per nascondere gli scatti. */
  draw(ctx, who, ang, h) {
    const r = this.data[who];
    if (!this.ready(who)) return false;
    const n = r.frames;
    let a = ang % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    const pos = a / (Math.PI * 2) * n;
    const i0 = Math.floor(pos) % n, i1 = (i0 + 1) % n;
    const f = pos - Math.floor(pos);
    const w = h * (HERO_FRAME_W / HERO_FRAME_H);
    ctx.drawImage(r.img, i0 * HERO_FRAME_W, 0, HERO_FRAME_W, HERO_FRAME_H, -w / 2, -h, w, h);
    if (f > 0.02) {
      const alfa = ctx.globalAlpha;
      ctx.globalAlpha = alfa * f;
      ctx.drawImage(r.img, i1 * HERO_FRAME_W, 0, HERO_FRAME_W, HERO_FRAME_H, -w / 2, -h, w, h);
      ctx.globalAlpha = alfa;
    }
    return true;
  }
};

const HeroArt = {
  imgs: {}, tried: false,
  poses: ['front', 'side', 'back'],

  load() {
    if (this.tried) return;
    this.tried = true;
    for (const who of ['aren', 'lyra']) {
      for (const pose of this.poses) {
        const key = who + '_' + pose;
        const im = new Image();
        /* prima il webp (pesa un quinto), e se manca si ripiega sul png */
        im.onerror = () => {
          if (!im._png) { im._png = true; im.src = 'assets/heroes/' + key + '.png'; }
          else im._failed = true;
        };
        im.src = 'assets/heroes/' + key + '.webp';
        this.imgs[key] = im;
      }
    }
  },

  /* pronto solo se ci sono tutte e tre le viste: mezze illustrazioni
     darebbero una rotazione che salta */
  ready(who) {
    for (const pose of this.poses) {
      const im = this.imgs[who + '_' + pose];
      if (!im || im._failed || !im.complete || !im.naturalWidth) return false;
    }
    return true;
  },

  /* disegna il custode all'angolo richiesto, alto `h` pixel e centrato sui piedi */
  /* larghezza reale della figura dentro il PNG (i margini trasparenti non
     contano): serve per far combaciare le viste quando si danno il cambio */
  span(key) {
    const im = this.imgs[key];
    if (!im || !im.naturalWidth) return 0;
    if (im._span) return im._span;
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    let min = c.width, max = 0;
    try {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      for (let y = 0; y < c.height; y += 2) {
        const row = y * c.width;
        for (let x = 0; x < c.width; x++) {
          if (d[(row + x) * 4 + 3] > 20) { if (x < min) min = x; if (x > max) max = x; }
        }
      }
    } catch (e) { return (im._span = im.naturalWidth); }
    im._span = Math.max(1, max - min) / im.naturalWidth;   /* frazione della larghezza */
    return im._span;
  },

  /* una posa sola, di fronte, appoggiata sui piedi */
  drawFront(ctx, who, h) {
    const im = this.imgs[who + '_front'];
    if (!im || !im.naturalWidth || im._failed) return false;
    const w = h * (im.naturalWidth / im.naturalHeight);
    ctx.drawImage(im, -w / 2, -h, w, h);
    return true;
  },

  /* Rotazione con tre viste: il trucco è non sostituire mai una vista di
     colpo. Fra una posa e l'altra le due si sovrappongono in dissolvenza
     mentre entrambe si comprimono, così l'occhio non coglie il cambio. */
  draw(ctx, who, ang, h) {
    const QUARTO = Math.PI / 2;
    let a = ang % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    const k = Math.floor(a / QUARTO) % 4;          /* 0 fronte, 1 destra, 2 dietro, 3 sinistra */
    const t = (a - Math.floor(a / QUARTO) * QUARTO) / QUARTO;

    /* le quattro posizioni della giostra */
    const POSA = ['front', 'side', 'back', 'side'];
    const VERSO = [1, 1, 1, -1];
    const kA = k, kB = (k + 1) % 4;

    /* pesi: somma dei quadrati costante, così la figura non "pulsa" */
    const wA = Math.cos(t * QUARTO), wB = Math.sin(t * QUARTO);

    const disegna = (idx, peso, alfa) => {
      const im = this.imgs[who + '_' + POSA[idx]];
      if (!im || !im.naturalWidth || alfa <= 0.004) return;
      const mio = this.span(who + '_' + POSA[idx]);
      /* larghezza apparente comune alle due viste: nessuno scatto al cambio */
      const target = this.span(who + '_' + POSA[kA]) * wA + this.span(who + '_' + POSA[kB]) * wB;
      const scala = (mio > 0 ? target / mio : 1) * peso * VERSO[idx];
      const w = h * (im.naturalWidth / im.naturalHeight);
      ctx.save();
      ctx.globalAlpha = alfa;
      ctx.scale(scala, 1);
      ctx.drawImage(im, -w / 2, -h, w, h);
      ctx.restore();
    };

    /* la vista che sta uscendo sotto, quella che entra sopra */
    const aA = Math.pow(wA, 1.7), aB = Math.pow(wB, 1.7);
    const somma = aA + aB || 1;
    disegna(kA, wA, aA / somma);
    disegna(kB, wB, aB / somma);
    return true;
  },

  /* una posa sola, di fronte */
  drawFront(ctx, who, h) {
    const im = this.imgs[who + '_front'];
    if (!im || !im.naturalWidth || im._failed) return false;
    const w = h * (im.naturalWidth / im.naturalHeight);
    ctx.drawImage(im, -w / 2, -h, w, h);
    return true;
  }
};
