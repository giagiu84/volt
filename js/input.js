/* VOLT — input: tastiera, mouse, touch. Robusto a multi-touch e perdita di focus. */
'use strict';

const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),   // consumato una sola volta (edge)
  axisX: 0, axisY: 0,             // joystick virtuale (-1..1)
  fire: false, jump: false, dash: false,
  jumpEdge: false, dashEdge: false,
  mouseX: 0, mouseY: 0, mouseIn: false, usingMouse: false,
  touchMode: false,
  _stickId: null, _stickCx: 0, _stickCy: 0, _stickR: 56,
  _btnTouches: Object.create(null),  // identifier -> nome bottone

  init(canvas) {
    /* --- tastiera --- */
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
    }, { passive: false });

    addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    /* se la finestra perde il focus i tasti restano "incollati": puliamo tutto */
    const releaseAll = () => {
      this.keys = Object.create(null);
      this.fire = this.jump = this.dash = false;
      this.axisX = this.axisY = 0;
      this._stickId = null;
      this._btnTouches = Object.create(null);
      Input.onStickReset && Input.onStickReset();
    };
    addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

    /* --- mouse --- */
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left; this.mouseY = e.clientY - r.top;
      this.mouseIn = true; this.usingMouse = true;
    });
    canvas.addEventListener('mouseleave', () => { this.mouseIn = false; });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) this.fire = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.fire = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    /* --- touch: joystick --- */
    const stick = document.getElementById('stick');
    const nub = document.getElementById('stickNub');
    Input.onStickReset = () => { nub.style.transform = 'translate(0,0)'; };

    const stickStart = (t) => {
      const r = stick.getBoundingClientRect();
      this._stickCx = r.left + r.width / 2;
      this._stickCy = r.top + r.height / 2;
      this._stickR = r.width * 0.42;
      this._stickId = t.identifier;
      this.stickMove(t, nub);
    };

    stick.addEventListener('touchstart', (e) => {
      e.preventDefault(); this.enableTouch();
      if (this._stickId === null) stickStart(e.changedTouches[0]);
    }, { passive: false });

    addEventListener('touchmove', (e) => {
      if (this._stickId === null) return;
      for (const t of e.changedTouches) if (t.identifier === this._stickId) this.stickMove(t, nub);
    }, { passive: false });

    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._stickId) {
          this._stickId = null; this.axisX = 0; this.axisY = 0;
          nub.style.transform = 'translate(0,0)';
        }
        const btn = this._btnTouches[t.identifier];
        if (btn) { this[btn] = false; delete this._btnTouches[t.identifier]; }
      }
    };
    addEventListener('touchend', endTouch);
    addEventListener('touchcancel', endTouch);

    /* --- touch: bottoni (ognuno tiene traccia del proprio dito) --- */
    const bind = (id, prop, edgeProp) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => {
        e.preventDefault(); this.enableTouch();
        for (const t of e.changedTouches) this._btnTouches[t.identifier] = prop;
        if (!this[prop] && edgeProp) this[edgeProp] = true;
        this[prop] = true;
      }, { passive: false });
      /* fallback per browser desktop che simulano il touch con il mouse */
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); this.enableTouch();
        if (!this[prop] && edgeProp) this[edgeProp] = true;
        this[prop] = true;
      });
      el.addEventListener('mouseup', () => { this[prop] = false; });
      el.addEventListener('mouseleave', () => { this[prop] = false; });
    };
    bind('btnFire', 'fire');
    bind('btnJump', 'jump', 'jumpEdge');
    bind('btnDash', 'dash', 'dashEdge');

    /* primo tocco ovunque = modalità touch */
    addEventListener('touchstart', () => this.enableTouch(), { passive: true });
  },

  stickMove(t, nub) {
    let dx = t.clientX - this._stickCx, dy = t.clientY - this._stickCy;
    const d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, this._stickR);
    const nx = (dx / d) * cl, ny = (dy / d) * cl;
    nub.style.transform = 'translate(' + nx.toFixed(1) + 'px,' + ny.toFixed(1) + 'px)';
    const dead = 0.22;
    let ax = (dx / d) * (cl / this._stickR), ay = (dy / d) * (cl / this._stickR);
    this.axisX = Math.abs(ax) < dead ? 0 : ax;
    this.axisY = Math.abs(ay) < dead ? 0 : ay;
  },

  enableTouch() {
    if (this.touchMode) return;
    this.touchMode = true;
    this.usingMouse = false;
    document.getElementById('touch').classList.remove('hidden');
    document.body.classList.add('touch');
    document.getElementById('pauseBtn').style.display = 'block';
  },

  /* input logico letto dal gioco */
  moveX() {
    let x = this.axisX;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;
    return clamp(x, -1, 1);
  },
  moveY() {
    let y = this.axisY;
    if (this.keys['s'] || this.keys['arrowdown']) y += 1;
    if (this.keys['w'] || this.keys['arrowup']) y -= 1;
    return clamp(y, -1, 1);
  },
  wantJump() {
    const e = this.jumpEdge || this.pressed[' '] || this.pressed['w'] || this.pressed['arrowup'];
    this.jumpEdge = false;
    return !!e;
  },
  jumpHeld() {
    return this.jump || !!this.keys[' '] || !!this.keys['w'] || !!this.keys['arrowup'];
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
