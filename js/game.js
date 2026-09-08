/* VOLT — loop di gioco, camera, regia, HUD */
'use strict';

const MINW = 580, MINH = 400, MAXSCALE = 2.8;
const LIFE_EVERY = 8000;      /* punti necessari per una vita in più */

const Game = {
  canvas: null, ctx: null,
  cssW: 0, cssH: 0, dpr: 1, scale: 1, viewW: 0, viewH: 0,
  state: 'menu',
  lv: null, player: null,
  enemies: [], bullets: [], pickups: [], explosions: [], ships: [],
  camX: 0, camY: 0, shakeAmt: 0, shakeT: 0,
  level: 1, score: 0, best: Store.get('volt_best', 0), kills: 0,
  combo: 0, comboT: 0, maxCombo: 0,
  volt: 0, rushT: 0, hitStop: 0,
  sectorTime: 0, sectorNoHit: true,
  enemiesLeft: 0, portalOn: false, portalT: 0,
  bannerT: 0, transition: 0, flashT: 0,
  hudCache: {},
  lastT: 0, acc: 0,

  /* ---------------- avvio ---------------- */
  init() {
    /* il menu deve mostrare i comandi giusti prima ancora di toccare lo schermo */
    if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window)
      document.body.classList.add('is-touch');
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    Gfx.init();
    Input.init(this.canvas);
    this.resize();
    addEventListener('resize', () => this.resize());
    /* se si cambia scheda o si perde il focus a metà partita, si mette in pausa da solo */
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.setPause(true); });
    addEventListener('blur', () => this.setPause(true));
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));

    document.getElementById('bestScore').textContent = this.best;
    const mute = document.getElementById('muteBtn');
    mute.textContent = 'AUDIO: ' + (Sfx.enabled ? 'ON' : 'OFF');
    mute.onclick = (e) => {
      e.stopPropagation();
      Sfx.init(); Sfx.resume();
      Sfx.setEnabled(!Sfx.enabled);
      mute.textContent = 'AUDIO: ' + (Sfx.enabled ? 'ON' : 'OFF');
    };

    document.getElementById('playBtn').onclick = () => this.start(true);
    document.getElementById('retryBtn').onclick = () => this.start(true);
    document.getElementById('resumeBtn').onclick = () => this.setPause(false);
    document.getElementById('pauseBtn').onclick = () => this.setPause(this.state === 'play');
    document.getElementById('quitBtn').onclick = () => this.toMenu();
    document.getElementById('menuBtn').onclick = () => this.toMenu();
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k !== 'escape' && k !== 'p') return;
      if (this.state === 'pause') this.setPause(false);
      else if (this.state === 'play') this.setPause(true);
    });

    /* fondale del menu: un settore che scorre da solo */
    this.lv = generateLevel(1);
    this.camX = 0; this.camY = this.lv.pxH - this.viewH;

    this.lastT = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  },

  resize() {
    /* in alcuni contesti (iframe appena creato, tab in background) il layout misura 0:
       senza questa guardia scale diventa 0 e i gradienti ricevono valori non finiti */
    const w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 320);
    const h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 480);
    this.cssW = w; this.cssH = h;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    /* in verticale serve meno larghezza minima, altrimenti resterebbero bande vuote
       sopra e sotto il settore */
    this.portrait = h > w * 1.2;
    const portrait = this.portrait;
    const minW = portrait ? 340 : MINW;
    const minH = portrait ? 660 : MINH;
    this.scale = clamp(Math.min(w / minW, h / minH), 0.25, MAXSCALE);
    this.viewW = w / this.scale;
    this.viewH = h / this.scale;
    Input.placeOrb(w, h);
  },

  start(fromClick) {
    /* su telefono a schermo intero si gioca molto meglio: va chiesto dentro il gesto */
    if (fromClick && (Input.touchMode || matchMedia('(pointer:coarse)').matches)) {
      try {
        const el = document.documentElement;
        const rq = el.requestFullscreen || el.webkitRequestFullscreen;
        if (rq && !document.fullscreenElement) { const r = rq.call(el); if (r && r.catch) r.catch(() => {}); }
        if (screen.orientation && screen.orientation.lock) {
          const r2 = screen.orientation.lock('landscape');
          if (r2 && r2.catch) r2.catch(() => {});
        }
      } catch (e) { /* niente schermo intero: pazienza */ }
    }
    Sfx.init(); Sfx.resume(); Sfx.startMusic();
    this.level = 1; this.score = 0; this.kills = 0;
    this.combo = 0; this.comboT = 0; this.maxCombo = 0;
    this.volt = 0; this.rushT = 0; this.hitStop = 0;
    this.nextLifeAt = LIFE_EVERY;
    if (this.player) this.player.riding = false;
    this.onShipChange();
    this.loadLevel(1, true);
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('over').classList.add('hidden');
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.state = 'play';
  },

  toMenu() {
    this.state = 'menu';
    Sfx.stopMusic();
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('over').classList.add('hidden');
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('bestScore').textContent = this.best;
  },

  setPause(on) {
    if (on && this.state !== 'play') return;
    if (!on && this.state !== 'pause') return;
    this.state = on ? 'pause' : 'play';
    document.getElementById('pause').classList.toggle('hidden', !on);
    if (on) Sfx.stopMusic(); else { Sfx.resume(); Sfx.startMusic(); }
  },

  loadLevel(n, keepPlayer) {
    this.lv = generateLevel(n);
    const lv = this.lv;
    this.enemies.length = 0; this.bullets.length = 0;
    this.pickups.length = 0; this.explosions.length = 0; this.ships.length = 0;
    if (this.player && this.player.riding) this.player.leaveShip(false);
    Particles.clear(); Floaters.clear(); Rings.clear();

    const p = (keepPlayer || !this.player) ? new Player(lv.startX, lv.startY) : this.player;
    if (!keepPlayer && this.player) { p.x = lv.startX; p.y = lv.startY; p.vx = 0; p.vy = 0; p.invuln = 1.2; }
    this.player = p;

    for (const s of lv.spawns) this.enemies.push(new Enemy(s.type, s.x, s.y, n, s.tier));
    for (const q of lv.pickups) this.pickups.push(new Pickup(q.x, q.y, Pickup.randomKind()));
    for (const sh of (lv.ships || [])) this.ships.push(new Ship(sh.x, sh.y));

    this.enemiesLeft = this.enemies.length;
    this.portalOn = false; this.portalT = 0;
    this.sectorTime = 0; this.sectorNoHit = true;
    this.camX = clamp(p.cx - this.viewW / 2, 0, Math.max(0, lv.pxW - this.viewW));
    this.camY = this.clampCamY(p.cy - this.viewH / 2);
    this.banner(lv.boss ? 'BOSS — ' + lv.theme.name : 'SETTORE ' + n);
    if (n === 1) setTimeout(() => { if (this.state === 'play' && this.level === 1) this.banner('RIPULISCI E CORRI AL PORTALE'); }, 1700);
    if (lv.boss) Sfx.boss(); else Sfx.levelUp();
    Sfx.setIntensity(Math.min(1, n / 14));
  },

  clampCamY(y) {
    const lv = this.lv;
    /* se il settore è più basso della vista, appoggio il fondo del mondo in basso
       e sopra resta il cielo: mai un bordo di mondo visibile */
    if (this.viewH >= lv.pxH) return lv.pxH - this.viewH;
    return clamp(y, 0, lv.pxH - this.viewH);
  },

  /* i comandi cambiano forma quando si vola: croce a quattro direzioni
     e il tasto del salto diventa la spinta */
  onShipChange() {
    const flying = !!(this.player && this.player.riding);
    document.body.classList.toggle('flying', flying);
    const j = document.getElementById('btnJump');
    if (j) j.textContent = flying ? 'BOOST' : 'SALTA';
  },

  banner(text) {
    const el = document.getElementById('banner');
    document.getElementById('bannerText').textContent = text;
    el.classList.remove('hidden');
    /* riavvia l'animazione CSS */
    const span = document.getElementById('bannerText');
    span.style.animation = 'none'; void span.offsetWidth; span.style.animation = '';
    this.bannerT = 1.6;
  },

  shake(amt, t) {
    this.shakeAmt = Math.max(this.shakeAmt, amt);
    this.shakeT = Math.max(this.shakeT, t);
  },

  addScore(v) {
    this.score += Math.round(v);
    if (this.score >= this.nextLifeAt) { this.nextLifeAt += LIFE_EVERY; this.grantLife(); }
    if (this.score > this.best) { this.best = this.score; Store.set('volt_best', this.best); }
  },

  addVolt(v) {
    if (this.rushT > 0 || this.state !== 'play') return;
    this.volt = clamp(this.volt + v, 0, 100);
    if (this.volt >= 100) this.startRush();
  },

  startRush() {
    const p = this.player;
    if (!p || p.dead) return;
    this.volt = 100; this.rushT = 6.5;
    p.heat = 0; p.overheat = 0;
    this.banner('VOLT RUSH!');
    this.flashT = 0.22; this.shake(12, 0.3);
    Particles.burst(p.cx, p.cy, 42, '#75ffe0', 340, 5, 0);
    Rings.add(p.cx, p.cy, '#ffffff', 130, 0.5, 7);
    Sfx.levelUp();
  },

  /* premio arcade: a punti si conquista una vita, e se sei già pieno
     il cuore in più resta tuo per il resto della partita */
  grantLife() {
    const p = this.player;
    if (!p || p.dead || this.state !== 'play') return;
    if (p.hp < p.maxHp) p.hp++;
    else if (p.maxHp < 6) { p.maxHp++; p.hp++; }
    else { this.score += 1000; Floaters.add(p.cx, p.y - 14, '+1000', '#ffd166', 18); return; }
    this.banner('VITA EXTRA!');
    Floaters.add(p.cx, p.y - 14, '+1 VITA', '#ff8fb4', 18);
    Particles.burst(p.cx, p.cy, 34, '#ff5d8f', 260, 5, -40);
    Rings.add(p.cx, p.cy, '#ffd166', 110, 0.5, 6);
    Sfx.levelUp();
  },

  spawnEnemy(type, x, y) {
    if (this.enemies.length > 44) return;
    const e = new Enemy(type, x, y, this.level, 1);
    e.awake = true;
    this.enemies.push(e);
    Particles.burst(x, y, 16, '#b06bff', 220, 4, 0);
  },

  onEnemyKilled(e) {
    this.kills++;
    this.combo++; this.comboT = 2.6;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = 1 + Math.min(this.combo - 1, 9) * 0.25;
    const pts = Math.round(e.score * mult * (this.rushT > 0 ? 2 : 1));
    this.addScore(pts);
    if (this.rushT > 0) this.rushT = Math.min(8, this.rushT + 0.24);
    else this.addVolt((e.type === 'boss' ? 36 : 11) + Math.min(8, this.combo));
    this.hitStop = e.type === 'boss' ? 0.08 : 0.025;
    Floaters.add(e.cx, e.cy - 10, '+' + pts, this.combo > 2 ? '#7dff8d' : '#ffe98a', this.combo > 4 ? 19 : 15);

    /* all'ultima vita il gioco allunga la mano: più oggetti, più cuori */
    const lowHp = this.player && this.player.hp <= 1;
    const dropChance = e.type === 'boss' ? 1 : (lowHp ? 0.30 : 0.17);
    if (Math.random() < dropChance) {
      let kind = Pickup.randomKind();
      if (lowHp && Math.random() < 0.5) kind = 'heart';
      this.pickups.push(new Pickup(e.cx - 10, e.cy - 10, kind));
      if (e.type === 'boss') {
        this.pickups.push(new Pickup(e.cx + 30, e.cy - 10, 'maxheart'));
        this.pickups.push(new Pickup(e.cx - 50, e.cy - 10, 'shield'));
      }
    }
    if (e.type === 'boss') { this.shake(30, 0.7); this.flashT = 0.4; }
  },

  openPortal() {
    this.portalOn = true;
    Sfx.portal();
    this.banner('PORTALE APERTO!');
    const lv = this.lv;
    Particles.burst(lv.portalX + 16, lv.portalY + 16, 50, '#4dffd5', 320, 5, -60);
  },

  /* ---------------- loop ---------------- */
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05);          /* niente salti dopo un tab in background */

    if (this.state === 'play') this.update(dt);
    else if (this.state === 'menu') this.updateMenu(dt);
    else { Particles.update(dt * 0.35); Rings.update(dt * 0.35); }

    Sfx.update(dt);
    this.render(dt);
    this.updateHud();
    Input.endFrame();

    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) document.getElementById('banner').classList.add('hidden');
    }
  },

  updateMenu(dt) {
    Rings.update(dt);
    this.camX += 42 * dt;
    if (this.camX > this.lv.pxW - this.viewW) this.camX = 0;
    this.camY = this.clampCamY(this.lv.pxH - this.viewH - 40);
    Particles.update(dt);
  },

  update(dt) {
    const lv = this.lv, p = this.player;

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      Particles.update(dt * 0.2); Rings.update(dt * 0.2);
      return;
    }

    if (this.transition > 0) {
      this.transition -= dt;
      if (this.transition <= 0) { this.level++; this.loadLevel(this.level, false); }
      Particles.update(dt);
      return;
    }

    p.update(dt, lv, this.enemies, this.bullets, this.camX, this.camY);
    this.sectorTime += dt;
    if (this.rushT > 0) {
      this.rushT = Math.max(0, this.rushT - dt);
      this.volt = this.rushT > 0 ? clamp((this.rushT / 6.5) * 100, 0, 100) : 0;
      if (this.rushT === 0) Floaters.add(p.cx, p.y - 10, 'RUSH TERMINATO', '#b9d9ff', 13);
    }

    /* combo */
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    /* nemici */
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, lv, p, this.bullets);
      if (e.dead) { this.enemies.splice(i, 1); continue; }
      /* danno da contatto */
      if (!p.dead && this.overlap(p, e)) {
        if (p.dashT > 0) { e.hurt(2, p.cx); }
        else if (p.hurt(e.def.touch)) {
          p.vx = sign(p.cx - e.cx) * 300; p.vy = -320;
        }
      }
    }

    this.enemiesLeft = this.enemies.length;
    if (this.enemiesLeft === 0 && !this.portalOn) this.openPortal();

    /* proiettili */
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, lv);
      if (!b.dead) {
        if (b.foe) {
          if (!p.dead && this.hitCircle(b, p)) {
            b.dead = true;
            if (b.bomb) b.explode();
            else { p.hurt(b.dmg); Particles.spark(b.x, b.y, -b.vx, -b.vy, b.col); }
          }
        } else {
          for (const e of this.enemies) {
            if (e.dead || !this.hitCircle(b, e)) continue;
            e.hurt(b.dmg, b.x);
            if (b.pierce > 0) b.pierce--; else { b.dead = true; }
            break;
          }
        }
      }
      if (b.dead || b.x < -200 || b.x > lv.pxW + 200 || b.y > lv.pxH + 200) this.bullets.splice(i, 1);
    }

    /* esplosioni */
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      ex.r = lerp(ex.max, 0, Math.max(0, ex.life / 0.28));
      ex.r = ex.max * (1 - ex.life / 0.28);
      if (!ex.hit) {
        ex.hit = true;
        if (ex.foe) { if (!p.dead && dist2(p.cx, p.cy, ex.x, ex.y) < (ex.max + 10) * (ex.max + 10)) p.hurt(ex.dmg); }
        for (const e of this.enemies) if (dist2(e.cx, e.cy, ex.x, ex.y) < (ex.max + 10) * (ex.max + 10)) e.hurt(3, ex.x);
      }
      if (ex.life <= 0) this.explosions.splice(i, 1);
    }

    /* navicelle parcheggiate: si sale passandoci sopra */
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const sh = this.ships[i];
      sh.update(dt);
      if (!p.dead && !p.riding && this.overlap(p, sh)) {
        p.boardShip(sh);
        this.ships.splice(i, 1);
      }
    }

    /* pickup */
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const q = this.pickups[i];
      q.update(dt, lv);
      if (!q.dead && !p.dead && this.overlap(p, q)) { p.give(q.kind); q.dead = true; }
      if (q.dead || q.y > lv.pxH + 100) this.pickups.splice(i, 1);
    }

    Particles.update(dt);
    Rings.update(dt);
    Floaters.update(dt);
    this.flashT = Math.max(0, this.flashT - dt);

    /* portale */
    this.portalT += dt;
    if (this.portalOn && !p.dead) {
      const px = lv.portalX + 16, py = lv.portalY + 24;
      if (Math.random() < 0.6) Particles.spawn(px + (Math.random() - .5) * 26, py + 24, 0, -90 - Math.random() * 90, 0.5, 4, '#4dffd5', -30, 0);
      /* il portale chiude il settore: dalla sua soglia in poi non si scappa,
         e la zona è alta quanto il varco, così ci si entra anche camminando */
      if (p.cx > px - 46 && p.cy > py - 80 && p.cy < py + 96) {
        this.transition = 0.55;
        const base = 500 + this.level * 100;
        const speedBonus = Math.max(0, Math.round((75 - this.sectorTime) * 12));
        const perfectBonus = this.sectorNoHit ? 750 : 0;
        const clearBonus = base + speedBonus + perfectBonus;
        this.addScore(clearBonus);
        const clearText = this.sectorNoHit ? 'SETTORE PERFETTO +' + clearBonus : 'SETTORE PULITO +' + clearBonus;
        Floaters.add(p.cx, p.cy - 20, clearText, '#4dffd5', 16);
        Sfx.portal(); Sfx.levelUp();
        Particles.burst(p.cx, p.cy, 60, '#4dffd5', 340, 5, -40);
      }
    }

    /* camera con anticipo nella direzione della corsa */
    const lookX = clamp(p.vx * 0.32, -140, 140);
    const targetX = p.cx + lookX - this.viewW / 2;
    /* in verticale il giocatore va tenuto più in alto: sotto ci sono i comandi */
    const targetY = p.cy - this.viewH * (this.portrait ? 0.44 : 0.56);
    this.camX = lerp(this.camX, clamp(targetX, 0, Math.max(0, lv.pxW - this.viewW)), Math.min(1, dt * 7));
    this.camY = lerp(this.camY, this.clampCamY(targetY), Math.min(1, dt * 6));

    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }

    Sfx.setIntensity(clamp(0.2 + this.level / 16 + (this.combo > 3 ? 0.2 : 0), 0, 1));

    /* morte */
    if (p.dead) {
      this.deathT = (this.deathT || 0) + dt;
      if (this.deathT > 1.1) { this.deathT = 0; this.gameOver(); }
    }
  },

  overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },
  hitCircle(b, e) {
    return b.x > e.x - b.r && b.x < e.x + e.w + b.r && b.y > e.y - b.r && b.y < e.y + e.h + b.r;
  },

  gameOver() {
    this.state = 'over';
    Sfx.stopMusic();
    document.getElementById('ovScore').textContent = this.score;
    document.getElementById('ovLevel').textContent = this.level;
    document.getElementById('ovKills').textContent = this.kills;
    document.getElementById('ovBest').textContent = this.best;
    const rank = this.score >= 30000 ? 'S' : this.score >= 18000 ? 'A' : this.score >= 9000 ? 'B' : 'C';
    document.getElementById('ovRank').textContent = 'GRADO ' + rank + ' · COMBO ' + this.maxCombo;
    document.getElementById('over').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
  },

  /* ---------------- HUD ---------------- */
  updateHud() {
    if (this.state !== 'play' && this.state !== 'pause') return;
    const p = this.player; if (!p) return;
    const c = this.hudCache;

    const hpKey = p.hp + '/' + p.shield + '/' + p.maxHp;
    if (c.hp !== hpKey) {
      c.hp = hpKey;
      let html = '';
      for (let i = 0; i < p.maxHp; i++) html += '<div class="heart' + (i < p.hp ? '' : ' empty') + '"></div>';
      for (let i = 0; i < p.shield; i++) html += '<div class="heart shield"></div>';
      document.getElementById('hearts').innerHTML = html;
    }
    const heat = Math.round(p.overheat > 0 ? 100 : p.heat);
    if (c.heat !== heat) { c.heat = heat; document.getElementById('heatbar').style.width = heat + '%'; }
    if (c.score !== this.score) { c.score = this.score; document.getElementById('score').textContent = this.score; }

    const lvName = (this.lv.boss ? 'BOSS ' : 'SETTORE ') + this.level;
    if (c.lvName !== lvName) { c.lvName = lvName; document.getElementById('levelName').textContent = lvName; }

    const tg = this.portalOn ? '➜ PORTALE' : 'MOSTRI ' + this.enemiesLeft;
    if (c.tg !== tg) { c.tg = tg; document.getElementById('targets').textContent = tg; }

    const cb = this.combo > 1 ? 'COMBO x' + this.combo : '';
    if (c.cb !== cb) { c.cb = cb; document.getElementById('combo').textContent = cb; }

    const wp = p.riding
      ? 'NAVICELLA ' + Math.ceil(p.shipT) + 's'
      : p.weapon.toUpperCase() + (p.weaponT > 0 ? ' ' + Math.ceil(p.weaponT) + 's' : '');
    if (c.wp !== wp) { c.wp = wp; document.getElementById('weapon').textContent = wp; }

    const volt = Math.round(this.volt);
    if (c.volt !== volt) { c.volt = volt; document.getElementById('voltbar').style.width = volt + '%'; }
    const rush = this.rushT > 0;
    const voltText = rush ? 'VOLT RUSH ' + this.rushT.toFixed(1) + 's' : 'CARICA VOLT ' + volt + '%';
    if (c.voltText !== voltText) { c.voltText = voltText; document.getElementById('voltState').textContent = voltText; }
    document.querySelector('.power-hud').classList.toggle('rush', rush);

    const progress = Math.round(clamp((p.cx - this.lv.startX) / Math.max(1, this.lv.portalX - this.lv.startX), 0, 1) * 100);
    if (c.progress !== progress) { c.progress = progress; document.getElementById('sectorbar').style.width = progress + '%'; }
  },

  /* ---------------- render ---------------- */
  render(dt) {
    const ctx = this.ctx, lv = this.lv;
    let camX = this.camX, camY = this.camY;
    if (this.shakeT > 0) {
      const a = this.shakeAmt * (this.shakeT / 0.35);
      camX += (Math.random() - 0.5) * a; camY += (Math.random() - 0.5) * a;
    }

    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    this.drawBackground(ctx, camX, camY, lv);
    this.drawTiles(ctx, camX, camY, lv);
    if (this.state !== 'menu') {
      this.drawPortal(ctx, camX, camY, lv);
      for (const sh of this.ships) sh.draw(ctx, camX, camY);
      for (const q of this.pickups) q.draw(ctx, camX, camY);
      for (const e of this.enemies) e.draw(ctx, camX, camY);
      for (const b of this.bullets) b.draw(ctx, camX, camY);
      this.drawExplosions(ctx, camX, camY);
      if (this.player) this.player.draw(ctx, camX, camY);
    }
    Particles.draw(ctx, camX, camY);
    Rings.draw(ctx, camX, camY);
    Floaters.draw(ctx, camX, camY);
    if (this.state !== 'menu') {
      this.drawBossBar(ctx);
      this.drawOffscreenHints(ctx, camX, camY, lv);
    }
    this.drawVignette(ctx);
    this.drawOrb(ctx, dt);

    if (this.flashT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (this.flashT * 1.4) + ')';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    if (this.transition > 0) {
      ctx.fillStyle = 'rgba(12,10,32,' + clamp(1 - this.transition / 0.55, 0, 1) + ')';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
  },

  drawBackground(ctx, camX, camY, lv) {
    const th = lv.theme, W = this.viewW, H = this.viewH;
    const ground = lv.pxH - camY;              /* linea del suolo sullo schermo */
    const horizon = Math.min(H, ground);

    const g = ctx.createLinearGradient(0, 0, 0, Math.max(2, horizon));
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* sole morbido */
    const sunX = W * 0.78, sunY = Math.max(60, horizon * 0.2);
    Gfx.light(ctx, sunX, sunY, 150, th.accent, 0.5);
    ctx.save();
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, TAU); ctx.fill();
    ctx.restore();

    /* nuvole */
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (const c of lv.clouds) {
      let cx = (c.x * W * 2.4 - camX * 0.06 - this.portalT * c.spd) % (W + 320);
      const x = cx < -160 ? cx + W + 320 : cx;
      const y = horizon * c.y + 20, s = c.s;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 62 * s, 24 * s, 0, 0, TAU);
      ctx.ellipse(x - 42 * s, y + 7 * s, 34 * s, 16 * s, 0, 0, TAU);
      ctx.ellipse(x + 44 * s, y + 9 * s, 30 * s, 14 * s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    /* colline: tre piani, le lontane più chiare (prospettiva atmosferica) */
    for (let layer = 0; layer < 3; layer++) {
      const par = 0.10 + layer * 0.16;
      const base = horizon - (2 - layer) * 26;
      ctx.fillStyle = Gfx.mix(th.hills[layer], th.fog, 0.5 - layer * 0.16);
      ctx.beginPath();
      let any = false;
      for (const hl of lv.hills) {
        if (hl.layer !== layer) continue;
        const x = hl.x - camX * par;
        if (x + hl.w < -80 || x - hl.w > W + 80) continue;
        ctx.moveTo(x - hl.w / 2, base);
        ctx.ellipse(x, base, hl.w / 2, hl.h, 0, Math.PI, TAU);
        any = true;
      }
      if (any) { ctx.rect(0, base - 1, W, Math.max(0, H - base + 2)); ctx.fill(); }
    }

    /* foschia sull'orizzonte */
    /* pulviscolo luminoso: dà profondità e vita all aria */
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (const m of lv.motes) {
      const mx = (m.x * W * 1.6 - camX * 0.35 + Math.sin(this.portalT * 0.4 + m.ph) * 20) % (W + 60);
      const px2 = mx < -30 ? mx + W + 60 : mx;
      const py2 = (m.y * horizon + Math.sin(this.portalT * m.sp * 0.08 + m.ph) * 16);
      ctx.globalAlpha = 0.22 + Math.sin(this.portalT * 1.4 + m.ph) * 0.12;
      ctx.beginPath(); ctx.arc(px2, py2, m.r, 0, TAU); ctx.fill();
    }
    ctx.restore();

    const fg = ctx.createLinearGradient(0, horizon - 150, 0, horizon);
    fg.addColorStop(0, Gfx.alpha(th.fog, 0));
    fg.addColorStop(1, Gfx.alpha(th.fog, 0.5));
    ctx.fillStyle = fg;
    ctx.fillRect(0, horizon - 150, W, 150);
  },

  drawTiles(ctx, camX, camY, lv) {
    const th = lv.theme;
    const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const x1 = Math.min(lv.w - 1, Math.ceil((camX + this.viewW) / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const y1 = Math.min(lv.h - 1, Math.ceil((camY + this.viewH) / TILE));

    /* corpo del terreno: un gradiente unico per tutta la vista */
    const bodyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(2, this.viewH));
    bodyGrad.addColorStop(0, th.body);
    bodyGrad.addColorStop(0.45, Gfx.mix(th.body, th.body2, 0.55));
    bodyGrad.addColorStop(1, th.body2);

    /* 1) blocchi pieni, raggruppati in righe contigue */
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    for (let y = y0; y <= y1; y++) {
      let run = -1;
      for (let x = x0; x <= x1 + 1; x++) {
        const solid = x <= x1 && lv.tiles[y * lv.w + x] === T_SOLID;
        if (solid && run < 0) run = x;
        else if (!solid && run >= 0) {
          ctx.rect(run * TILE - camX, y * TILE - camY, (x - run) * TILE, TILE + 0.5);
          run = -1;
        }
      }
    }
    ctx.fill();

    /* 2) crosta illuminata sulla superficie esposta */
    for (let y = y0; y <= y1; y++) {
      let run = -1;
      for (let x = x0; x <= x1 + 1; x++) {
        const exposed = x <= x1 && lv.tiles[y * lv.w + x] === T_SOLID && lv.tileAt(x, y - 1) !== T_SOLID;
        if (exposed && run < 0) run = x;
        else if (!exposed && run >= 0) {
          const px = run * TILE - camX, py = y * TILE - camY, w = (x - run) * TILE;
          ctx.fillStyle = th.crust;
          roundRect(ctx, px - 1, py - 5, w + 2, 20, 9); ctx.fill();
          ctx.fillStyle = th.crust2;
          roundRect(ctx, px + 3, py - 3, w - 6, 7, 3.5); ctx.fill();
          /* ciuffi sul bordo, deterministici per tile */
          for (let k = 0; k < (x - run); k++) {
            const hx = (run + k) * TILE - camX;
            const hs = (((run + k + 7) * 2654435761) >>> 0) % 6;
            if (hs > 2) continue;
            const bx = hx + 6 + hs * 7;
            ctx.beginPath();
            ctx.moveTo(bx, py - 3);
            ctx.quadraticCurveTo(bx + 2, py - 14, bx + 8, py - 5);
            ctx.quadraticCurveTo(bx + 5, py - 2, bx, py - 3);
            ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = 'rgba(0,0,0,.16)';
          ctx.fillRect(px, py + 15, w, 10);
          ctx.fillStyle = 'rgba(0,0,0,.07)';
          ctx.fillRect(px, py + 25, w, 14);
          run = -1;
        }
      }
    }

    /* 3) dettagli sul corpo e fianchi in ombra */
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (lv.tiles[y * lv.w + x] !== T_SOLID) continue;
        const hsh = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        if (hsh % 5 === 0) {
          const px = x * TILE - camX + (hsh % 17), py = y * TILE - camY + (hsh % 13) + 6;
          roundRect(ctx, px, py, 9 + (hsh % 7), 6, 3); ctx.fill();
        }
      }
    }
    ctx.fillStyle = 'rgba(20,14,45,.20)';
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (lv.tiles[y * lv.w + x] !== T_SOLID) continue;
        const px = x * TILE - camX, py = y * TILE - camY;
        if (lv.tileAt(x - 1, y) !== T_SOLID) ctx.fillRect(px, py, 4, TILE);
        if (lv.tileAt(x + 1, y) !== T_SOLID) ctx.fillRect(px + TILE - 4, py, 4, TILE);
      }
    }

    /* 4) piattaforme, spine e trampolini */
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = lv.tiles[y * lv.w + x];
        if (t !== T_PLAT && t !== T_SPIKE && t !== T_PAD) continue;
        const px = x * TILE - camX, py = y * TILE - camY;
        if (t === T_PLAT) {
          const left = lv.tileAt(x - 1, y) !== T_PLAT, right = lv.tileAt(x + 1, y) !== T_PLAT;
          const ext = (left ? 2 : 0) + (right ? 2 : 0);
          ctx.fillStyle = 'rgba(20,14,45,.20)';
          roundRect(ctx, px - (left ? 2 : 0), py + 4, TILE + ext, 12, 6); ctx.fill();
          ctx.fillStyle = th.plat;
          roundRect(ctx, px - (left ? 2 : 0), py, TILE + ext, 13, 6.5); ctx.fill();
          Gfx.gloss(ctx, px + 3, py + 2, TILE - 6, 4, 0.4);
        } else if (t === T_SPIKE) {
          ctx.fillStyle = th.spike;
          for (let i = 0; i < 3; i++) {
            const sx = px + 3 + i * 10;
            ctx.beginPath();
            ctx.moveTo(sx, py + TILE);
            ctx.quadraticCurveTo(sx + 2, py + TILE - 18, sx + 5, py + TILE - 20);
            ctx.quadraticCurveTo(sx + 8, py + TILE - 18, sx + 10, py + TILE);
            ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          for (let i = 0; i < 3; i++) {
            const sx = px + 4.5 + i * 10;
            ctx.beginPath(); ctx.moveTo(sx, py + TILE - 4);
            ctx.lineTo(sx + 2.5, py + TILE - 17); ctx.lineTo(sx + 3.5, py + TILE - 4);
            ctx.closePath(); ctx.fill();
          }
        } else {
          const pulse = 0.65 + Math.sin(this.portalT * 7 + x) * 0.18;
          Gfx.light(ctx, px + TILE / 2, py + TILE / 2, 38, '#66ffe0', pulse);
          ctx.fillStyle = '#273064'; roundRect(ctx, px + 1, py + 15, TILE - 2, 12, 5); ctx.fill();
          ctx.fillStyle = '#66ffe0'; roundRect(ctx, px - 2, py + 8, TILE + 4, 11, 6); ctx.fill();
          ctx.fillStyle = '#ffffff'; roundRect(ctx, px + 5, py + 9, TILE - 10, 4, 2); ctx.fill();
        }
      }
    }
  },

  drawPortal(ctx, camX, camY, lv) {
    const x = lv.portalX + 16 - camX, y = lv.portalY + 24 - camY;
    const t = this.portalT, on = this.portalOn;
    const col = on ? '#7cf7c4' : '#9aa0c0';

    Gfx.shadow(ctx, x, y + 44, on ? 96 : 66, on ? 0.4 : 0.25);
    if (on) Gfx.light(ctx, x, y, 96 + Math.sin(t * 3) * 8, col, 0.5);

    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 9; ctx.strokeStyle = on ? '#ffffff' : '#c9cee6';
    ctx.globalAlpha = on ? 0.95 : 0.6;
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 44, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 44, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = on ? 0.9 : 0.35;
    const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, 40);
    gg.addColorStop(0, '#ffffff');
    gg.addColorStop(0.5, Gfx.alpha(col, 0.85));
    gg.addColorStop(1, Gfx.alpha(col, 0.05));
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 40, 0, 0, TAU); ctx.fill();
    if (on) {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 8 + i * 8, 14 + i * 12, t * (0.9 + i * 0.3), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (!on) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '800 12px Nunito, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText('CHIUSO', x, y + 68);
      ctx.restore();
    }
  },

  drawExplosions(ctx, camX, camY) {
    ctx.save();
    for (const ex of this.explosions) {
      const a = clamp(ex.life / 0.28, 0, 1);
      ctx.globalAlpha = a * 0.9;
      const r = Math.max(1, ex.r);
      const g = ctx.createRadialGradient(ex.x - camX, ex.y - camY, 0, ex.x - camX, ex.y - camY, r);
      g.addColorStop(0, '#fff9e8'); g.addColorStop(0.45, '#ffc46b');
      g.addColorStop(0.8, 'rgba(255,110,90,.6)'); g.addColorStop(1, 'rgba(255,90,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex.x - camX, ex.y - camY, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },

  drawBossBar(ctx) {
    const boss = this.enemies.find(e => e.type === 'boss' && !e.dead && e.awake);
    if (!boss) return;
    const w = Math.min(this.viewW * 0.66, 400), x = (this.viewW - w) / 2, y = 92;
    const frac = clamp(boss.hp / boss.maxHp, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(24,18,50,.5)';
    roundRect(ctx, x - 5, y - 5, w + 10, 20, 10); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff8a5c'); g.addColorStop(1, '#ff4d7d');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w * frac, 10, 5); ctx.fill();
    if (w * frac > 10) Gfx.gloss(ctx, x + 3, y + 1.5, w * frac - 6, 3, 0.45);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = '800 11px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('IL DIVORATORE', this.viewW / 2, y - 10);
    ctx.restore();
  },

  drawOffscreenHints(ctx, camX, camY, lv) {
    const marks = [];
    for (const sh of this.ships) marks.push({ x: sh.cx, y: sh.cy, col: '#8ff0ff' });
    if (this.portalOn) marks.push({ x: lv.portalX + 16, y: lv.portalY + 24, col: '#7cf7c4' });
    else for (const e of this.enemies) if (!e.dead) marks.push({ x: e.cx, y: e.cy, col: e.def.col });

    let shown = 0;
    for (const m of marks) {
      if (shown > 3) break;
      const sx = m.x - camX, sy = m.y - camY;
      if (sx > 12 && sx < this.viewW - 12 && sy > 12 && sy < this.viewH - 12) continue;
      const cx = clamp(sx, 26, this.viewW - 26), cy = clamp(sy, 48, this.viewH - 40);
      const a = Math.atan2(sy - this.viewH / 2, sx - this.viewW / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(28,20,54,.5)';
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
      ctx.rotate(a);
      ctx.fillStyle = m.col;
      ctx.beginPath();
      ctx.moveTo(9, 0); ctx.lineTo(-4, -6.5); ctx.lineTo(-1.5, 0); ctx.lineTo(-4, 6.5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      shown++;
    }
  },

  /* ---- sfera al plasma: il joystick del telefono ----
     Le scariche partono dal nucleo e inseguono il pollice, come nelle sfere
     di vetro vere. Disegnata in coordinate schermo, sopra a tutto. */
  drawOrb(ctx, dt) {
    if (!Input.touchMode) return;
    const o = Input.orb;
    if (!o.r) return;
    const k = 1 / this.scale;                 /* da pixel schermo a unità di disegno */
    const cx = o.x * k, cy = o.y * k, R = o.r * k;
    const t = this.portalT;
    o.glow = lerp(o.glow, o.active ? 1 : 0.35, Math.min(1, (dt || 0.016) * 8));

    ctx.save();

    /* vetro */
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    g.addColorStop(0, 'rgba(120,200,255,' + (0.16 + o.glow * 0.14) + ')');
    g.addColorStop(0.55, 'rgba(30,60,150,' + (0.20 + o.glow * 0.14) + ')');
    g.addColorStop(1, 'rgba(10,20,60,' + (0.26 + o.glow * 0.16) + ')');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

    /* scariche: partono dal nucleo e inseguono il pollice, serpeggiando */
    const tx = o.active ? cx + o.dx * k : cx + Math.cos(t * 0.7) * R * 0.5;
    const ty = o.active ? cy + o.dy * k : cy + Math.sin(t * 0.9) * R * 0.5;
    const toX = tx - cx, toY = ty - cy;
    const baseAng = Math.atan2(toY, toX);
    const reach = clamp(Math.hypot(toX, toY) * 0.9 + R * 0.35, R * 0.55, R * 0.98);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const bolts = 5;
    for (let b = 0; b < bolts; b++) {
      const spread = o.active ? 0.42 : 1.35;
      const ang = baseAng + (b - (bolts - 1) / 2) * spread;
      const dirX = Math.cos(ang), dirY = Math.sin(ang);
      const perpX = -dirY, perpY = dirX;
      const len = reach * (0.82 + ((b * 37) % 10) / 40);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const steps = 9;
      for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        /* l'ampiezza è nulla al nucleo e alla punta: il filamento resta attaccato a entrambi */
        const amp = R * 0.17 * Math.sin(f * Math.PI);
        const n = Math.sin(t * 13 + b * 4.1 + f * 9) * 0.7 + Math.sin(t * 21 + b * 2.3 + f * 17) * 0.3;
        ctx.lineTo(cx + dirX * len * f + perpX * amp * n,
                   cy + dirY * len * f + perpY * amp * n);
      }
      ctx.strokeStyle = 'rgba(90,200,255,' + (0.18 + o.glow * 0.42) + ')';
      ctx.lineWidth = 4.2 * k; ctx.stroke();
      ctx.strokeStyle = 'rgba(170,235,255,' + (0.2 + o.glow * 0.5) + ')';
      ctx.lineWidth = 2.1 * k; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.16 + o.glow * 0.5) + ')';
      ctx.lineWidth = 0.9 * k; ctx.stroke();
    }

    /* nucleo */
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.4);
    core.addColorStop(0, 'rgba(255,255,255,' + (0.75 + o.glow * 0.25) + ')');
    core.addColorStop(0.4, 'rgba(110,220,255,.65)');
    core.addColorStop(1, 'rgba(60,160,255,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.42 + Math.sin(t * 6) * R * 0.02, 0, TAU); ctx.fill();

    /* punto luminoso sotto il pollice */
    if (o.active) {
      const pg = ctx.createRadialGradient(tx, ty, 0, tx, ty, R * 0.32);
      pg.addColorStop(0, 'rgba(255,255,255,.9)');
      pg.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(tx, ty, R * 0.32, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    /* bordo di vetro e riflesso */
    ctx.strokeStyle = 'rgba(190,235,255,' + (0.5 + o.glow * 0.35) + ')';
    ctx.lineWidth = 2.5 * k;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.34, cy - R * 0.44, R * 0.26, R * 0.13, -0.7, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  drawVignette(ctx) {
    const W = this.viewW, H = this.viewH;
    if (!this._vig || this._vigW !== W || this._vigH !== H) {
      this._vigW = W; this._vigH = H;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
      g.addColorStop(0, 'rgba(24,16,48,0)');
      g.addColorStop(1, 'rgba(24,16,48,0.28)');
      this._vig = g;
    }
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, W, H);
  }
};

addEventListener('load', () => Game.init());
/* il primo input sblocca l'audio (policy dei browser) */
addEventListener('pointerdown', () => { Sfx.init(); Sfx.resume(); }, { once: true });
addEventListener('keydown', () => { Sfx.init(); Sfx.resume(); }, { once: true });
