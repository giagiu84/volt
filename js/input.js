/* VOLT — input: tastiera, mouse e touch a gesti (nessun tasto a schermo).

   Pollice DESTRO, un dito solo che fa tutto:
     · trascini            → corri (joystick che nasce dove appoggi)
     · tocco               → salto
     · due tocchi          → doppio salto
     · tocco tenuto        → salto più alto (slancio)
     · scorrimento rapido  → scatto
     · spinta in basso     → scendi dalla piattaforma
   Un secondo dito appoggiato a destra mentre corri = salto, così non devi
   staccare il pollice per saltare.

   Pollice SINISTRO: tieni premuto per sparare, trascina per mirare. */
'use strict';

const STICK_R = 66;          /* raggio del joystick invisibile, in px schermo */
const DEAD = 0.18;
const DROP_ON = 0.62;
const TAP_MOVE = 15;         /* oltre questo spostamento non è più un tocco, è una corsa */
const HOLD_MS = 70;          /* dito fermo per più di così: parte il salto e si tiene */
/* scatto: serve un colpo secco vero (oltre 850 px/s), altrimenti il normale
   trascinare il pollice per correre farebbe partire scatti a raffica */
const FLICK_PX = 95, FLICK_MS = 110;

const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),
  axisX: 0, axisY: 0,
  fire: false,
  jumpEdge: false, dashEdge: false,
  mouseX: 0, mouseY: 0, mouseIn: false, usingMouse: false,
  lastPointerT: 0, lastKeyT: 0,
  touchMode: false,

  stick: null,        /* dito del movimento/salto */
  shoot: null,        /* dito del fuoco */
  extraJump: null,    /* secondo dito a destra: salto mentre si corre */
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
      this.stick = null; this.shoot = null; this.extraJump = null;
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
    document.addEventListener('mouseleave', () => { this.mouseIn = false; this.fire = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    /* --- touch --- */
    const zoneIsStick = (x) => x >= innerWidth * 0.5;

    /* se un dito sparisce senza touchend (succede) i riferimenti restano appesi
       e i comandi si bloccano: a ogni evento ricontrollo chi è ancora sullo schermo */
    const syncTouches = (e) => {
      const live = new Set();
      for (const t of e.touches) live.add(t.identifier);
      if (this.stick && !live.has(this.stick.id)) { this.stick = null; this.axisX = 0; this.axisY = 0; }
      if (this.shoot && !live.has(this.shoot.id)) { this.shoot = null; this.fire = false; this.hasAim = false; }
      if (this.extraJump !== null && !live.has(this.extraJump)) this.extraJump = null;
    };

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.enableTouch();
      syncTouches(e);
      const now = performance.now();
      for (const t of e.changedTouches) {
        /* un dito già in uso non deve essere riassegnato */
        if ((this.stick && this.stick.id === t.identifier) ||
            (this.shoot && this.shoot.id === t.identifier) ||
            this.extraJump === t.identifier) continue;
        if (zoneIsStick(t.clientX)) {
          if (!this.stick) {
            this.stick = {
              id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY,
              tDown: now, moved: false, jumped: false,
              fx: t.clientX, ft: now                    /* riferimento per lo scorrimento rapido */
            };
          } else if (this.extraJump === null) {
            /* sto già correndo: questo secondo dito è un salto immediato */
            this.extraJump = t.identifier;
            this.jumpEdge = true;
          }
        } else {
          if (this.shoot) continue;
          this.shoot = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, moved: false };
          this.fire = true;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      syncTouches(e);
      const now = performance.now();
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          const S = this.stick;
          S.x = t.clientX; S.y = t.clientY;
          if (!S.moved && Math.hypot(S.x - S.ox, S.y - S.oy) > TAP_MOVE) S.moved = true;
          /* scorrimento rapido in orizzontale = scatto */
          if (now - S.ft > FLICK_MS) { S.fx = S.x; S.ft = now; }
          else if (Math.abs(S.x - S.fx) > FLICK_PX) {
            this.dashEdge = true;
            S.fx = S.x; S.ft = now;
          }
          this.updateStick();
        } else if (this.shoot && t.identifier === this.shoot.id) {
          this.shoot.x = t.clientX; this.shoot.y = t.clientY;
          const dx = t.clientX - this.shoot.ox, dy = t.clientY - this.shoot.oy;
          if (Math.hypot(dx, dy) > 20) {
            this.shoot.moved = true;
            const l = Math.hypot(dx, dy) || 1;
            this.aimDX = dx / l; this.aimDY = dy / l; this.hasAim = true;
          }
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          const S = this.stick;
          /* tocco lampo staccato prima che scattasse il salto tenuto: salta comunque */
          if (!S.moved && !S.jumped) this.jumpEdge = true;
          this.stick = null;
          this.axisX = 0; this.axisY = 0;
        } else if (this.shoot && t.identifier === this.shoot.id) {
          this.shoot = null; this.fire = false; this.hasAim = false;
        } else if (this.extraJump === t.identifier) {
          this.extraJump = null;
        }
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  },

  /* il dito appoggiato e fermo fa partire il salto e lo tiene: più resta giù,
     più il salto è alto. Chiamato una volta per frame dal gioco. */
  poll() {
    const S = this.stick;
    if (!S || S.moved || S.jumped) return;
    if (performance.now() - S.tDown >= HOLD_MS) { S.jumped = true; this.jumpEdge = true; }
  },

  updateStick() {
    const S = this.stick;
    if (!S) { this.axisX = this.axisY = 0; return; }
    let dx = S.x - S.ox, dy = S.y - S.oy;
    const d = Math.hypot(dx, dy) || 1;
    /* se il dito va oltre il raggio, l'origine lo insegue: niente joystick "perso" */
    if (d > STICK_R) {
      S.ox += dx * (1 - STICK_R / d);
      S.oy += dy * (1 - STICK_R / d);
      dx = S.x - S.ox; dy = S.y - S.oy;
    }
    const ax = dx / STICK_R, ay = dy / STICK_R;
    this.axisX = Math.abs(ax) < DEAD ? 0 : clamp(ax, -1, 1);
    this.axisY = Math.abs(ay) < DEAD ? 0 : clamp(ay, -1, 1);
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
    this.poll();
    const e = this.jumpEdge || this.pressed[' '] || this.pressed['w'] || this.pressed['arrowup'];
    this.jumpEdge = false;
    return !!e;
  },
  /* dito ancora appoggiato = slancio: il salto continua a salire */
  jumpHeld() {
    if (this.extraJump !== null) return true;
    /* una volta staccato da terra, finché il dito resta giù il salto sale:
       vale anche se nel frattempo lo stai trascinando per correre */
    if (this.stick && this.stick.jumped) return true;
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
