/* VOLT — input: tastiera, mouse e touch a gesti (nessun tasto a schermo).
   Sul telefono: pollice sinistro = joystick che nasce dove appoggi il dito
   (avanti/dietro, su = salta, giù = scendi, doppio tocco = scatto),
   pollice destro = tieni premuto per sparare, trascina per mirare. */
'use strict';

const STICK_R = 66;        /* raggio del joystick invisibile, in px schermo */
const DEAD = 0.18;
const JUMP_ON = -0.55, JUMP_OFF = -0.28;
const DROP_ON = 0.62;

const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),
  axisX: 0, axisY: 0,
  fire: false,
  jumpEdge: false, dashEdge: false,
  mouseX: 0, mouseY: 0, mouseIn: false, usingMouse: false,
  lastPointerT: 0, lastKeyT: 0,
  touchMode: false,

  /* dita attive */
  left: null,          /* {id, ox, oy, x, y, tDown, armed} */
  right: null,         /* {id, ox, oy, x, y, moved} */
  lastLeftUp: 0,
  hasAim: false, aimDX: 1, aimDY: 0,

  init(canvas) {
    this.canvas = canvas;

    /* --- tastiera --- */
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      this.lastKeyT = performance.now();
    }, { passive: false });
    addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    /* se la finestra perde il focus i tasti restano "incollati": puliamo tutto */
    const releaseAll = () => {
      this.keys = Object.create(null);
      this.fire = false;
      this.axisX = this.axisY = 0;
      this.left = null; this.right = null;
      this.hasAim = false;
    };
    addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

    /* --- mouse --- */
    const trackMouse = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
      this.mouseIn = true; this.usingMouse = true;
      this.lastPointerT = performance.now();
    };
    canvas.addEventListener('mousemove', trackMouse);
    canvas.addEventListener('mouseleave', () => { this.mouseIn = false; });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { trackMouse(e); this.fire = true; } });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.fire = false; });
    /* puntatore fuori dalla finestra: niente colpo bloccato e niente mira appesa in alto */
    document.addEventListener('mouseleave', () => { this.mouseIn = false; this.fire = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    /* --- touch: due zone, nessun bottone --- */
    const zoneIsLeft = (x) => x < innerWidth * 0.5;

    /* se un dito sparisce senza touchend (succede) i riferimenti restano appesi
       e i comandi si bloccano: a ogni evento ricontrollo chi è ancora sullo schermo */
    const syncTouches = (e) => {
      const live = new Set();
      for (const t of e.touches) live.add(t.identifier);
      if (this.left && !live.has(this.left.id)) { this.left = null; this.axisX = 0; this.axisY = 0; }
      if (this.right && !live.has(this.right.id)) { this.right = null; this.fire = false; this.hasAim = false; }
    };

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.enableTouch();
      syncTouches(e);
      const now = performance.now();
      for (const t of e.changedTouches) {
        if (zoneIsLeft(t.clientX)) {
          if (this.left) continue;
          this.left = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, tDown: now, armed: true };
          /* doppio tocco ravvicinato = scatto */
          if (now - this.lastLeftUp < 280) this.dashEdge = true;
        } else {
          if (this.right) continue;
          this.right = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, moved: false };
          this.fire = true;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      syncTouches(e);
      for (const t of e.changedTouches) {
        if (this.left && t.identifier === this.left.id) {
          this.left.x = t.clientX; this.left.y = t.clientY;
          this.updateStick();
        } else if (this.right && t.identifier === this.right.id) {
          this.right.x = t.clientX; this.right.y = t.clientY;
          const dx = t.clientX - this.right.ox, dy = t.clientY - this.right.oy;
          if (Math.hypot(dx, dy) > 20) {
            this.right.moved = true;
            const l = Math.hypot(dx, dy) || 1;
            this.aimDX = dx / l; this.aimDY = dy / l; this.hasAim = true;
          }
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (this.left && t.identifier === this.left.id) {
          /* tocco breve e fermo: lo ricordo, un secondo tocco rapido è lo scatto */
          const held = performance.now() - this.left.tDown;
          if (held < 220) this.lastLeftUp = performance.now();
          this.left = null;
          this.axisX = 0; this.axisY = 0;
        } else if (this.right && t.identifier === this.right.id) {
          this.right = null; this.fire = false; this.hasAim = false;
        }
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  },

  updateStick() {
    const L = this.left;
    if (!L) { this.axisX = this.axisY = 0; return; }
    let dx = L.x - L.ox, dy = L.y - L.oy;
    const d = Math.hypot(dx, dy) || 1;
    /* se il dito va oltre il raggio, l'origine lo insegue: niente joystick "perso" */
    if (d > STICK_R) {
      L.ox += dx * (1 - STICK_R / d);
      L.oy += dy * (1 - STICK_R / d);
      dx = L.x - L.ox; dy = L.y - L.oy;
    }
    const ax = dx / STICK_R, ay = dy / STICK_R;
    this.axisX = Math.abs(ax) < DEAD ? 0 : clamp(ax, -1, 1);
    this.axisY = Math.abs(ay) < DEAD ? 0 : clamp(ay, -1, 1);

    /* spinta verso l'alto = salto (si ri-arma quando il pollice torna giù,
       così una seconda spinta in aria fa il doppio salto) */
    if (this.axisY < JUMP_ON) {
      if (L.armed) { L.armed = false; this.jumpEdge = true; }
    } else if (this.axisY > JUMP_OFF) {
      L.armed = true;
    }
  },

  enableTouch() {
    if (this.touchMode) return;
    this.touchMode = true;
    this.usingMouse = false;
    document.body.classList.add('touch');
    document.getElementById('pauseBtn').style.display = 'flex';
    const hint = document.getElementById('touchHint');
    if (hint) {
      hint.classList.remove('hidden');
      setTimeout(() => hint.classList.add('fade'), 3600);
      setTimeout(() => hint.classList.add('hidden'), 4600);
    }
  },

  /* con quale comando sta giocando adesso? decide come si mira */
  aimWithMouse() {
    return this.usingMouse && this.mouseIn && this.lastPointerT >= this.lastKeyT;
  },

  /* input logico letto dal gioco */
  moveX() {
    let x = this.axisX;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;
    return clamp(x, -1, 1);
  },
  moveY() {
    let y = this.axisY > DROP_ON ? 1 : 0;      /* solo "giù" pieno vale come discesa */
    if (this.keys['s'] || this.keys['arrowdown']) y = 1;
    if (this.keys['w'] || this.keys['arrowup']) y = -1;
    return y;
  },
  wantJump() {
    const e = this.jumpEdge || this.pressed[' '] || this.pressed['w'] || this.pressed['arrowup'];
    this.jumpEdge = false;
    return !!e;
  },
  jumpHeld() {
    if (this.left && this.axisY < JUMP_OFF) return true;
    return !!this.keys[' '] || !!this.keys['w'] || !!this.keys['arrowup'];
  },
  wantDash() {
    const e = this.dashEdge || this.pressed['shift'] || this.pressed['k'] || this.pressed['l'];
    this.dashEdge = false;
    return !!e;
  },
  wantFire() {
    return this.fire || !!this.keys['j'] || !!this.keys['x'] || !!this.keys['control'];
  },
  consume(k) { const v = !!this.pressed[k]; this.pressed[k] = false; return v; },
  endFrame() { this.pressed = Object.create(null); }
};
