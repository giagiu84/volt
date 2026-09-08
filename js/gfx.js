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

  draw(ctx, who, ang, h) {
    const si = Math.sin(ang), co = Math.cos(ang);
    const side = Math.abs(si) > 0.7071;          /* si cambia vista a 45° */
    const key = who + '_' + (side ? 'side' : (co > 0 ? 'front' : 'back'));
    const im = this.imgs[key];
    if (!im || !im.naturalWidth) return false;

    /* Larghezza apparente come in una rotazione vera: le due viste hanno
       ingombri diversi, quindi interpolo fra i due e adatto la scala della
       vista mostrata. Senza questo, al cambio vista la figura fa uno scatto. */
    const sFront = this.span(who + '_' + (co > 0 ? 'front' : 'back'));
    const sSide = this.span(who + '_side');
    const shown = side ? sSide : sFront;
    const target = sFront * Math.abs(co) + sSide * Math.abs(si);
    const squeeze = (shown > 0 ? target / shown : 1) * (side ? Math.sign(si) : (co > 0 ? 1 : -1));

    const w = h * (im.naturalWidth / im.naturalHeight);
    ctx.save();
    ctx.scale(squeeze, 1);
    ctx.drawImage(im, -w / 2, -h, w, h);
    ctx.restore();
    return true;
  }
};
