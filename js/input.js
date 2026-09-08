/* VOLT — input: tastiera, mouse e comandi a pulsanti sul telefono.

   Telefono:  in basso a sinistra la sfera al plasma (tieni il pollice e spingi:
              destra/sinistra si corre, in basso si scende dalle piattaforme, e
              in volo si va anche su; doppio tocco = scatto),
              in basso a destra SALTA e SPARA.
              La mira è automatica sul mostro più vicino.
   Ogni pulsante ricorda quale dito lo sta premendo: si possono premere
   insieme (correre + saltare + sparare) e se un dito si perde per strada
   il pulsante si rilascia da solo. */
'use strict';

const DTAP_MS = 320;        /* finestra per il doppio tocco = scatto */
const TAP_MAX_MS = 260;     /* oltre questo non è un tocco ma una pressione */

const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),
  fire: false,
  jumpEdge: false, dashEdge: false,
  mouseX: 0, mouseY: 0, mouseIn: false, usingMouse: false,
  lastPointerT: 0, lastKeyT: 0,
  touchMode: false,

  btn: { jump: false, fire: false, volt: false, ship: false },
  voltEdge: false, shipEdge: false,
  axisX: 0, axisY: 0,
  orb: { x: 0, y: 0, r: 66, active: false, id: null, dx: 0, dy: 0, tDown: 0, lastUp: 0, glow: 0 },
  _fingers: Object.create(null),   /* identifier -> nome pulsante */
  _lastTap: { left: 0, right: 0 },
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

    const releaseAll = () => {
      this.keys = Object.create(null);
      this.fire = false;
      for (const k in this.btn) this.btn[k] = false;
      this.axisX = 0; this.axisY = 0;
      this.orb.active = false; this.orb.id = null; this.orb.dx = 0; this.orb.dy = 0;
      this._fingers = Object.create(null);
      this.refreshBtns();
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

    /* --- pulsanti a schermo --- */
    this.els = {};
    const bind = (id, name) => {
      const el = document.getElementById(id);
      if (!el) return;
      this.els[name] = el;

      const down = (t) => {
        const now = performance.now();
        if (t !== null) this._fingers[t] = name;
        if (!this.btn[name]) {
          if (name === 'jump') this.jumpEdge = true;
          if (name === 'volt') this.voltEdge = true;
          if (name === 'ship') this.shipEdge = true;
          if (name === 'left' || name === 'right') {
            if (now - this._lastTap[name] < DTAP_MS) { this.dashEdge = true; this._lastTap[name] = 0; }
            this._downAt = now;
          }
        }
        this.btn[name] = true;
        el.classList.add('pressed');
      };
      const up = (t) => {
        if (t !== null) delete this._fingers[t];
        if ((name === 'left' || name === 'right') && this._downAt &&
            performance.now() - this._downAt < TAP_MAX_MS) {
          this._lastTap[name] = performance.now();
        }
        this.btn[name] = false;
        el.classList.remove('pressed');
      };

      el.addEventListener('touchstart', (e) => {
        e.preventDefault(); this.enableTouch();
        for (const t of e.changedTouches) down(t.identifier);
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) up(t.identifier);
      }, { passive: false });
      el.addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) up(t.identifier); });

      /* mouse: comodo per provare i comandi del telefono anche da PC */
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.enableTouch(); down(null); });
      el.addEventListener('mouseup', () => up(null));
      el.addEventListener('mouseleave', () => { if (this.btn[name]) up(null); });
    };

    bind('btnJump', 'jump');
    bind('btnVolt', 'volt');
    bind('btnShip', 'ship');
    bind('btnFire', 'fire');

    /* --- sfera al plasma: joystick disegnato dal gioco --- */
    const orbHit = (x, y) => {
      const o = this.orb;
      return Math.hypot(x - o.x, y - o.y) < o.r * 1.35;
    };
    const orbMove = (x, y) => {
      const o = this.orb;
      let dx = x - o.x, dy = y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > o.r) { dx *= o.r / d; dy *= o.r / d; }
      o.dx = dx; o.dy = dy;
      const ax = dx / o.r, ay = dy / o.r;
      this.axisX = Math.abs(ax) < 0.16 ? 0 : clamp(ax, -1, 1);
      this.axisY = Math.abs(ay) < 0.16 ? 0 : clamp(ay, -1, 1);
    };
    const orbRelease = () => {
      const o = this.orb;
      if (o.active && performance.now() - o.tDown < 240) o.lastUp = performance.now();
      o.active = false; o.id = null; o.dx = 0; o.dy = 0;
      this.axisX = 0; this.axisY = 0;
    };
    this._orbRelease = orbRelease;

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault(); this.enableTouch();
      for (const t of e.changedTouches) {
        if (this.orb.active || !orbHit(t.clientX, t.clientY)) continue;
        const now = performance.now();
        this.orb.active = true; this.orb.id = t.identifier; this.orb.tDown = now;
        if (now - this.orb.lastUp < 320) { this.dashEdge = true; this.orb.lastUp = 0; }
        orbMove(t.clientX, t.clientY);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (!this.orb.active) return;
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === this.orb.id) orbMove(t.clientX, t.clientY);
    }, { passive: false });

    const orbEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.orb.id) orbRelease();
    };
    canvas.addEventListener('touchend', orbEnd);
    canvas.addEventListener('touchcancel', orbEnd);

    /* rete di sicurezza: se un dito sparisce senza rilascio, libero il pulsante */
    const sweep = (e) => {
      const live = new Set();
      for (const t of e.touches) live.add(t.identifier);
      if (this.orb.active && !live.has(this.orb.id)) this._orbRelease();
      for (const id in this._fingers) {
        if (!live.has(Number(id))) {
          const name = this._fingers[id];
          delete this._fingers[id];
          this.btn[name] = false;
          if (this.els[name]) this.els[name].classList.remove('pressed');
        }
      }
    };
    addEventListener('touchend', sweep);
    addEventListener('touchcancel', sweep);
    addEventListener('touchstart', () => this.enableTouch(), { passive: true });
  },

  /* la sfera vive in basso a sinistra: il gioco ne aggiorna il centro */
  placeOrb(w, h) {
    const r = clamp(Math.min(w, h) * 0.175, 50, 72);
    this.orb.r = r;
    this.orb.x = 16 + r;
    this.orb.y = h - 18 - r;
  },

  refreshBtns() {
    for (const k in this.els) if (this.els[k]) this.els[k].classList.remove('pressed');
  },

  enableTouch() {
    if (this.touchMode) return;
    this.touchMode = true;
    this.usingMouse = false;
    document.body.classList.add('touch');
    document.getElementById('touch').classList.remove('hidden');
    document.getElementById('pauseBtn').style.display = 'flex';
    const hint = document.getElementById('touchHint');
    if (hint) {
      hint.classList.remove('hidden');
      setTimeout(() => hint.classList.add('fade'), 3200);
      setTimeout(() => hint.classList.add('hidden'), 4200);
    }
  },

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
    if (this.keys['w'] || this.keys['arrowup']) return -1;
    if (this.keys['s'] || this.keys['arrowdown']) return 1;
    return this.axisY;
  },
  wantJump() {
    const e = this.jumpEdge || this.pressed[' '] || this.pressed['w'] || this.pressed['arrowup'];
    this.jumpEdge = false;
    return !!e;
  },
  jumpHeld() {
    return this.btn.jump || !!this.keys[' '] || !!this.keys['w'] || !!this.keys['arrowup'];
  },
  wantDash() {
    const e = this.dashEdge || this.pressed['shift'] || this.pressed['k'] || this.pressed['l'];
    this.dashEdge = false;
    return !!e;
  },
  /* il Rush e la navicella si attivano quando lo decide il giocatore */
  wantVolt() {
    const e = this.voltEdge || this.pressed['e'];
    this.voltEdge = false;
    return !!e;
  },
  wantShip() {
    const e = this.shipEdge || this.pressed['q'];
    this.shipEdge = false;
    return !!e;
  },

  wantFire() {
    return this.fire || this.btn.fire || !!this.keys['j'] || !!this.keys['x'] || !!this.keys['control'];
  },
  consume(k) { const v = !!this.pressed[k]; this.pressed[k] = false; return v; },
  endFrame() { this.pressed = Object.create(null); }
};
