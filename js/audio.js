/* VOLT — audio interamente sintetizzato con WebAudio (nessun file esterno) */
'use strict';

const Sfx = {
  ctx: null, master: null, musicGain: null,
  enabled: Store.get('volt_audio', true),
  ready: false,
  _musicTimer: 0, _step: 0, _musicOn: false, _intensity: 0,

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      this.ready = true;
    } catch (e) { this.ready = false; }
  },

  resume() {
    if (!this.ready) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  setEnabled(on) {
    this.enabled = on;
    Store.set('volt_audio', on);
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  },

  tone(freq, dur, type, vol, freqEnd, dest) {
    if (!this.ready || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol, filterFreq, sweepTo) {
    if (!this.ready || !this.enabled) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq || 1800, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  /* --- effetti di gioco --- */
  shoot()      { this.tone(880, 0.07, 'square', 0.07, 260); },
  shootBig()   { this.tone(300, 0.14, 'sawtooth', 0.1, 90); this.noise(0.09, 0.06, 2400, 400); },
  laser()      { this.tone(1500, 0.16, 'sawtooth', 0.07, 380); },
  jump()       { this.tone(420, 0.11, 'square', 0.06, 760); },
  dash()       { this.noise(0.16, 0.1, 3200, 500); this.tone(200, 0.14, 'sawtooth', 0.05, 900); },
  hitEnemy()   { this.tone(220, 0.05, 'square', 0.05, 130); },
  kill()       { this.noise(0.22, 0.14, 1600, 180); this.tone(150, 0.2, 'sawtooth', 0.08, 50); },
  hurt()       { this.tone(180, 0.26, 'sawtooth', 0.13, 55); this.noise(0.2, 0.1, 900, 120); },
  pickup()     { this.tone(700, 0.07, 'triangle', 0.09); setTimeout(() => this.tone(1050, 0.1, 'triangle', 0.09), 60); },
  portal()     { this.tone(300, 0.5, 'sine', 0.1, 1400); },
  levelUp()    { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'square', 0.09), i * 85)); },
  boss()       { this.tone(90, 0.9, 'sawtooth', 0.16, 42); this.noise(0.8, 0.1, 500, 80); },
  gameOver()   { [440, 349, 261, 174].forEach((f, i) => setTimeout(() => this.tone(f, 0.34, 'sawtooth', 0.11), i * 170)); },
  bomb()       { this.noise(0.6, 0.22, 2600, 90); this.tone(120, 0.5, 'sawtooth', 0.14, 34); },

  /* --- musica: arpeggio + kick generati a step --- */
  startMusic() { this._musicOn = true; this._step = 0; this._musicTimer = 0; },
  stopMusic()  { this._musicOn = false; },
  setIntensity(v) { this._intensity = clamp(v, 0, 1); },

  update(dt) {
    if (!this._musicOn || !this.ready || !this.enabled) return;
    const bpm = 138 + this._intensity * 26;
    const stepDur = 60 / bpm / 4;
    this._musicTimer -= dt;
    if (this._musicTimer > 0) return;
    this._musicTimer += stepDur;
    const s = this._step++ % 32;
    const root = [55, 55, 49, 62][Math.floor(this._step / 32) % 4];
    const scale = [0, 3, 5, 7, 10, 12, 15];
    if (s % 4 === 0) this.noise(0.11, 0.24, 260, 60);                   // kick
    if (s % 8 === 4) this.noise(0.07, 0.09, 6000, 3000);                // hat/snare
    if (s % 2 === 0) {
      const n = scale[(s / 2 + Math.floor(this._step / 16)) % scale.length];
      const f = root * Math.pow(2, n / 12) * 2;
      this.tone(f, stepDur * 1.7, 'sawtooth', 0.028 + this._intensity * 0.02, null, this.musicGain);
    }
    if (s % 16 === 0) this.tone(root, stepDur * 6, 'triangle', 0.07, null, this.musicGain);  // bass
  }
};
