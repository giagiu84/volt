/* VOLT — input: tastiera, mouse e comandi a pulsanti sul telefono.

   Telefono:  in basso a sinistra ◀ ▶ (e un ▼ per scendere dalle piattaforme),
              in basso a destra SALTA e SPARA.
              Doppio tocco su ◀ o ▶ = scatto in quella direzione.
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

  btn: { left: false, right: false, down: false, up: false, jump: false, fire: false },
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

    bind('btnLeft', 'left');
    bind('btnRight', 'right');
    bind('btnDown', 'down');
    bind('btnUp', 'up');
    bind('btnJump', 'jump');
    bind('btnFire', 'fire');

    /* rete di sicurezza: se un dito sparisce senza rilascio, libero il pulsante */
    const sweep = (e) => {
      const live = new Set();
      for (const t of e.touches) live.add(t.identifier);
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
    let x = 0;
    if (this.btn.left) x -= 1;
    if (this.btn.right) x += 1;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;
    return clamp(x, -1, 1);
  },
  moveY() {
    if (this.btn.up || this.keys['w'] || this.keys['arrowup']) return -1;
    if (this.btn.down || this.keys['s'] || this.keys['arrowdown']) return 1;
    return 0;
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
  wantFire() {
    return this.fire || this.btn.fire || !!this.keys['j'] || !!this.keys['x'] || !!this.keys['control'];
  },
  consume(k) { const v = !!this.pressed[k]; this.pressed[k] = false; return v; },
  endFrame() { this.pressed = Object.create(null); }
};
