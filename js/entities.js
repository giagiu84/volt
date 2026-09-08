/* VOLT — entità: giocatore, mostri, proiettili, pickup */
'use strict';

const GRAV = 2050;
const MAXFALL = 1150;

/* ---------- collisione AABB contro la tilemap ---------- */
function collideX(e, lv) {
  const x1 = e.x, x2 = e.x + e.w, y1 = e.y + 1, y2 = e.y + e.h - 1;
  const tx0 = Math.floor(x1 / TILE), tx1 = Math.floor(x2 / TILE);
  const ty0 = Math.floor(y1 / TILE), ty1 = Math.floor(y2 / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (lv.tileAt(tx, ty) !== T_SOLID) continue;
      if (e.vx > 0) { e.x = tx * TILE - e.w - 0.01; e.vx = 0; e.hitWall = 1; }
      else if (e.vx < 0) { e.x = (tx + 1) * TILE + 0.01; e.vx = 0; e.hitWall = -1; }
      return;
    }
  }
}

function collideY(e, lv, dropThrough) {
  const x1 = e.x + 2, x2 = e.x + e.w - 2, y1 = e.y, y2 = e.y + e.h;
  const tx0 = Math.floor(x1 / TILE), tx1 = Math.floor(x2 / TILE);
  const ty0 = Math.floor(y1 / TILE), ty1 = Math.floor(y2 / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = lv.tileAt(tx, ty);
      if (t === T_SOLID) {
        if (e.vy > 0) { e.y = ty * TILE - e.h; e.vy = 0; e.onGround = true; }
        else if (e.vy < 0) { e.y = (ty + 1) * TILE; e.vy = 0; }
        return;
      }
      if ((t === T_PLAT || t === T_PAD) && e.vy > 0 && !dropThrough) {
        const top = ty * TILE;
        if (e.prevBottom <= top + 2 && y2 >= top) {
          e.y = top - e.h; e.vy = 0; e.onGround = true; e.onPad = t === T_PAD; return;
        }
      }
    }
  }
}

function moveEntity(e, lv, dt, dropThrough) {
  e.prevBottom = e.y + e.h;
  e.hitWall = 0;
  e.onPad = false;
  e.x += e.vx * dt; collideX(e, lv);
  e.onGround = false;
  e.vy = Math.min(e.vy, MAXFALL);
  e.y += e.vy * dt; collideY(e, lv, dropThrough);
}

function touchesSpike(e, lv) {
  const tx0 = Math.floor((e.x + 4) / TILE), tx1 = Math.floor((e.x + e.w - 4) / TILE);
  const ty0 = Math.floor((e.y + 4) / TILE), ty1 = Math.floor((e.y + e.h - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++)
      if (lv.tileAt(tx, ty) === T_SPIKE) return true;
  return false;
}

/* ---------- proiettili ---------- */
class Bullet {
  constructor(x, y, vx, vy, opt) {
    opt = opt || {};
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.r = opt.r || 4;
    this.dmg = opt.dmg || 1;
    this.foe = !!opt.foe;
    this.life = opt.life || 1.6;
    this.col = opt.col || (this.foe ? '#ff5f7a' : '#38e8ff');
    this.pierce = opt.pierce || 0;
    this.grav = opt.grav || 0;
    this.bomb = !!opt.bomb;
    this.bounces = opt.bounces || 0;
    this.freeze = !!opt.freeze;
    this.dead = false;
    this.trail = 0;
  }
  update(dt, lv) {
    this.life -= dt;
    this.vy += this.grav * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (lv.solidAt(this.x, this.y)) {
      if (this.bounces > 0) {
        /* rimbalzo: capisco da che lato ho toccato e inverto quell'asse */
        this.bounces--;
        this.x -= this.vx * dt; this.y -= this.vy * dt;
        if (lv.solidAt(this.x + this.vx * dt, this.y)) this.vx = -this.vx;
        else this.vy = -this.vy;
        Particles.spark(this.x, this.y, this.vx, this.vy, this.col);
        Rings.add(this.x, this.y, this.col, 18, 0.18, 2.5);
        Sfx.tone(700, 0.05, 'square', 0.04, 300);
      } else {
        this.dead = true;
        Particles.spark(this.x, this.y, -this.vx, -this.vy, this.col);
        Rings.add(this.x, this.y, this.col, 22, 0.2, 3);
        if (this.bomb) this.explode();
      }
    }
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 0.022;
      Particles.spawn(this.x, this.y, 0, 0, 0.2, this.r * 1.3, this.col, 0, 0);
    }
  }
  explode() {
    Particles.burst(this.x, this.y, 24, '#ffc46b', 320, 6, 340);
    Particles.burst(this.x, this.y, 12, '#ff7a5c', 220, 5, 200);
    Rings.add(this.x, this.y, '#ffd9a0', 86, 0.36, 7);
    Sfx.bomb();
    Game.shake(11, 0.3);
    Game.explosions.push({ x: this.x, y: this.y, r: 0, max: 74, life: 0.28, foe: this.foe, dmg: 2, hit: false });
  }
  draw(ctx, cx, cy) {
    const x = this.x - cx, y = this.y - cy;
    Gfx.light(ctx, x, y, this.r * 4.5, this.col, 0.5);
    ctx.save();
    if (this.pierce > 0) {
      ctx.translate(x, y); ctx.rotate(Math.atan2(this.vy, this.vx));
      ctx.fillStyle = this.col;
      roundRect(ctx, -16, -this.r * 0.6, 32, this.r * 1.2, this.r * 0.6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      roundRect(ctx, -10, -this.r * 0.25, 22, this.r * 0.5, this.r * 0.25); ctx.fill();
    } else {
      ctx.fillStyle = this.col;
      ctx.beginPath(); ctx.arc(x, y, this.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath(); ctx.arc(x - this.r * 0.22, y - this.r * 0.24, this.r * 0.46, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

/* ---------- pickup ---------- */
const PICK_TYPES = [
  { k: 'heart',  col: '#ff5d8f', label: 'VITA',   w: 3 },
  { k: 'shield', col: '#48d7ff', label: 'SCUDO',  w: 3 },
  { k: 'spread', col: '#ffc247', label: 'TRIPLO', w: 4 },
  { k: 'rapid',  col: '#5ee08a', label: 'RAPIDO', w: 4 },
  { k: 'laser',  col: '#c98ff7', label: 'LASER',  w: 3 },
  { k: 'coin',   col: '#ffd166', label: '+250',   w: 6 },
  { k: 'volt',   col: '#66ffe0', label: 'ENERGIA', w: 5 },
  /* peso 0: non esce a caso, lo lascia solo il boss */
  { k: 'maxheart', col: '#ff2f6e', label: 'CUORE IN PIÙ', w: 0 }
];

class Pickup {
  constructor(x, y, kind) {
    this.x = x; this.y = y; this.w = 20; this.h = 20;
    this.vx = 0; this.vy = -60;
    this.t = Math.random() * 6;
    this.dead = false;
    this.def = PICK_TYPES.find(p => p.k === kind) || PICK_TYPES[0];
    this.kind = this.def.k;
    this.life = 22;
  }
  static randomKind(rng) {
    const r = rng ? rng() : Math.random();
    let total = 0; for (const p of PICK_TYPES) total += p.w;
    let acc = r * total;
    for (const p of PICK_TYPES) { acc -= p.w; if (acc <= 0) return p.k; }
    return 'coin';
  }
  update(dt, lv) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.vy += GRAV * 0.45 * dt;
    moveEntity(this, lv, dt, false);
    if (this.onGround) this.vx *= 0.8;
  }
  drawIcon(ctx, k, col) {
    ctx.fillStyle = '#ffffff';
    if (k === 'maxheart') {
      /* cuore con la corona: è il cuore che alza il massimo */
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-8, -6); ctx.lineTo(-5, -11); ctx.lineTo(0, -7);
      ctx.lineTo(5, -11); ctx.lineTo(8, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-9, 0, -6, -6, 0, -1.5);
      ctx.bezierCurveTo(6, -6, 9, 0, 0, 8);
      ctx.fill();
    } else if (k === 'heart') {
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.bezierCurveTo(-9, -1, -6, -8, 0, -3.5);
      ctx.bezierCurveTo(6, -8, 9, -1, 0, 6);
      ctx.fill();
    } else if (k === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(7, -4); ctx.lineTo(7, 2);
      ctx.quadraticCurveTo(7, 6, 0, 8);
      ctx.quadraticCurveTo(-7, 6, -7, 2); ctx.lineTo(-7, -4);
      ctx.closePath(); ctx.fill();
    } else if (k === 'coin' || k === 'volt') {
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fill();
      ctx.fillStyle = col; ctx.font = '800 9px Nunito, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(k === 'volt' ? 'V' : '$', 0, 0.5);
    } else {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2, r = i % 2 ? 3.4 : 8.5;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  draw(ctx, cx, cy) {
    const bob = Math.sin(this.t * 3.4) * 4;
    const x = this.x - cx + this.w / 2, y = this.y - cy + this.h / 2 + bob;
    const blink = this.life < 4 && Math.floor(this.life * 8) % 2 === 0;
    Gfx.shadow(ctx, x, this.y - cy + this.h + 4, 34, 0.3);
    Gfx.light(ctx, x, y, 34, this.def.col, blink ? 0.2 : 0.55);
    ctx.save();
    ctx.globalAlpha = blink ? 0.4 : 1;
    ctx.translate(x, y);
    ctx.rotate(Math.sin(this.t * 1.6) * 0.16);
    ctx.fillStyle = this.def.col;
    roundRect(ctx, -12, -12, 24, 24, 9); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    Gfx.gloss(ctx, -8, -9, 16, 5, 0.5);
    this.drawIcon(ctx, this.kind, this.def.col);
    ctx.restore();
  }
}

/* ---------- i due protagonisti ----------
   Stesse capacità, aspetto e racconto diversi: chi non giochi è quello
   che il Divoratore ha trascinato oltre la frattura. */
/* VOLT non è un nome: è il potere del Nucleo. Chi lo assorbe diventa VOLT,
   l'altro viene catturato dal Divoratore mentre cerca di proteggerlo.
   Stessi poteri, stessi danni, stessa difficoltà: cambia solo come si spara. */
const HEROES = {
  aren: { name: 'AREN', other: 'LYRA', otherLabel: 'Lyra', otherFree: 'LYRA È LIBERA',
          body: '#f2f7ff', trim: '#22c8f5', trail: '#ff5d8f', legs: '#3a4a86',
          ponytail: false, glove: false,
          /* Due stili, stessa possibilità di arrivare in fondo: Aren picchia
             duro e incassa, Lyra corre e martella. Il tempo per abbattere un
             mostro resta quasi identico, cambia il modo. */
          speed: 0.94, dmg: 1, rate: 1.42, hp: 5, dash: 1.10, jump: 0.97, invuln: 1.3,
          tratto: 'colpi pesanti · più resistente' },
  /* colori della tavola ufficiale: tuta rosa e bianca, capelli viola con la
     ciocca gialla. Lyra non usa il blaster ma il guanto energetico. */
  lyra: { name: 'LYRA', other: 'AREN', otherLabel: 'Aren', otherFree: 'AREN È LIBERO',
          body: '#fff0f6', trim: '#ff5d8f', trail: '#7a3fd6', hair2: '#ffd166',
          legs: '#4a2f7a', ponytail: true, glove: true,
          speed: 1.12, dmg: 0, rate: 0.78, hp: 4, dash: 0.75, jump: 1.04, invuln: 1,
          tratto: 'veloce · raffica rapida' }
};
function hero() { return HEROES[Game.hero] || HEROES.volt; }

/* ---------- giocatore ---------- */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 20; this.h = 30;
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.prevBottom = y + 30;
    this.facing = 1;
    const H0 = HEROES[Game.hero] || HEROES.aren;
    this.hp = this.maxHp = H0.hp; this.shield = 0;
    this.coyote = 0; this.buffer = 0; this.jumpsLeft = 2;
    this.dashT = 0; this.dashCd = 0;
    this.invuln = 0; this.flash = 0;
    this.fireCd = 0; this.heat = 0; this.overheat = 0;
    this.weapon = 'blaster'; this.weaponT = 0;
    this.aimX = 1; this.aimY = 0;
    this.anim = 0; this.dead = false;
    this.muzzle = 0; this.land = 0;
    this.scarf = [];
    for (let i = 0; i < 5; i++) this.scarf.push({ x: x, y: y });
    this.safeX = x; this.safeY = y; this.safeT = 0;
    /* navicella */
    this.riding = false; this.shipHp = 0; this.shipT = 0; this.shipFlash = 0;
    this.crouch = false;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  hurt(dmg) {
    if (this.invuln > 0 || this.dashT > 0 || this.dead) return false;
    /* a bordo paga la navicella: si perde il mezzo, non una vita */
    if (this.riding) {
      this.shipHp--; this.invuln = 0.75; this.shipFlash = 0.28;
      Sfx.hurt(); Game.shake(11, 0.26);
      Particles.burst(this.cx, this.cy, 20, '#ffc46b', 260, 4, 120);
      Floaters.add(this.cx, this.y - 8, 'SCAFO ' + Math.max(0, this.shipHp), '#ffc46b', 15);
      if (this.shipHp <= 0) this.leaveShip(true);
      return true;
    }
    Game.sectorNoHit = false;
    if (Game.rushT <= 0) Game.volt = Math.max(0, Game.volt - 18);
    if (this.shield > 0) {
      this.shield--; this.invuln = 1.0; this.flash = 0.3;
      Sfx.hurt(); Game.shake(8, 0.22);
      Floaters.add(this.cx, this.y - 6, 'SCUDO!', '#48d7ff', 16);
      Particles.burst(this.cx, this.cy, 22, '#48d7ff', 260, 4, 120);
      Rings.add(this.cx, this.cy, '#9be9ff', 70, 0.3, 5);
      return true;
    }
    this.hp -= dmg;
    this.invuln = 1.7 * (hero().invuln || 1); this.flash = 0.35;
    Game.combo = 0; Game.comboT = 0;
    Sfx.hurt(); Game.shake(14, 0.32);
    Particles.burst(this.cx, this.cy, 24, '#ff5d8f', 300, 4.5, 200);
    Rings.add(this.cx, this.cy, '#ff8fb4', 66, 0.3, 5);
    Floaters.add(this.cx, this.y - 6, '-' + dmg, '#ff8fb4', 18);
    if (this.hp <= 0) { this.hp = 0; this.die(); }
    return true;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    Particles.burst(this.cx, this.cy, 60, '#ff5d8f', 460, 6, 320);
    Particles.burst(this.cx, this.cy, 34, '#ffd166', 340, 5, 260);
    Rings.add(this.cx, this.cy, '#ffffff', 150, 0.5, 8);
    Game.shake(26, 0.6);
    Sfx.gameOver();
  }

  aim(lv, enemies, camX, camY) {
    if (Input.touchMode) {
      /* trascinando il pollice destro si mira a mano */
      if (Input.hasAim) { this.aimX = Input.aimDX; this.aimY = Input.aimDY; return; }
      /* altrimenti punta da sola il mostro più vicino */
      let best = null, bd = 520 * 520;
      for (const e of enemies) {
        if (e.dead) continue;
        let d = dist2(this.cx, this.cy, e.cx, e.cy);
        /* chi vola sopra di te conta come piu vicino: altrimenti la mira
           resta incollata ai mostri a terra mentre ti bombardano */
        if ((e.type === 'bomber' || e.type === 'flyer') && Math.abs(e.cx - this.cx) < 150) d *= 0.45;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const dx = best.cx - this.cx, dy = best.cy - this.cy - 4, l = Math.hypot(dx, dy) || 1;
        this.aimX = dx / l; this.aimY = dy / l;
      } else {
        const mx = Input.moveX();
        this.aimX = mx !== 0 ? sign(mx) : this.facing;
        this.aimY = 0;
      }
      return;
    }
    if (Input.aimWithMouse()) {
      const wx = Input.mouseX / Game.scale + camX, wy = Input.mouseY / Game.scale + camY;
      const dx = wx - this.cx, dy = wy - this.cy, l = Math.hypot(dx, dy) || 1;
      this.aimX = dx / l; this.aimY = dy / l;
    } else {
      /* con la tastiera si spara dritto davanti a sé: il tasto di salto
         non deve far puntare l'arma verso il cielo */
      const mx = Input.moveX();
      this.aimX = mx !== 0 ? sign(mx) : this.facing;
      this.aimY = 0;
    }
  }

  update(dt, lv, enemies, bullets, camX, camY) {
    if (this.dead) return;
    if (this.riding) { this.updateFlight(dt, lv, enemies, bullets, camX, camY); return; }
    this.anim += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.land = Math.max(0, this.land - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    if (this.weaponT > 0) {
      this.weaponT -= dt;
      if (this.weaponT <= 0) { this.weapon = 'blaster'; Floaters.add(this.cx, this.y - 10, 'BLASTER', '#cbd5ff', 14); }
    }
    if (this.overheat > 0) { this.overheat -= dt; this.heat = Math.max(0, this.heat - dt * 55); }
    else this.heat = Math.max(0, this.heat - dt * 34);

    this.aim(lv, enemies, camX, camY);

    /* abbassarsi: a terra, spingendo in basso. Il corpo si accorcia davvero,
       così i colpi ad altezza del petto passano sopra la testa. */
    this.setCrouch(this.onGround && this.dashT <= 0 && Input.moveY() > 0.55, lv);

    const mx = Input.moveX();
    const ACC = this.onGround ? 4200 : 2600;
    const rush = Game.rushT > 0;
    const MAXV = (300 + (this.weapon === 'rapid' ? 24 : 0)) * (rush ? 1.2 : 1) * (this.crouch ? 0.42 : 1) * hero().speed;

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vy = 0;
      Particles.spawn(this.cx, this.cy, -this.vx * 0.1, 0, 0.24, 10, '#8ff0ff', 0, 1);
      if (this.dashT <= 0) this.vx *= 0.42;
    } else {
      if (mx !== 0) {
        this.vx = approach(this.vx, mx * MAXV, ACC * dt);
        this.facing = sign(mx);
      } else {
        this.vx = approach(this.vx, 0, (this.onGround ? 3400 : 1500) * dt);
      }
      this.vy += GRAV * dt;
      /* salto a due altezze: tocco breve = saltino, tenuto = salto pieno.
         Il taglio è morbido, così anche il tocco veloce stacca da terra sul serio. */
      if (this.vy < 0 && !Input.jumpHeld()) this.vy += GRAV * 0.5 * dt;
    }

    if (Input.wantJump()) this.buffer = 0.13;
    this.buffer = Math.max(0, this.buffer - dt);
    if (this.onGround) { this.coyote = 0.11; this.jumpsLeft = Game.hasPerk('jump3') ? 3 : 2; }
    else this.coyote = Math.max(0, this.coyote - dt);

    if (this.buffer > 0) {
      if (this.coyote > 0 || this.jumpsLeft > 0) {
        this.setCrouch(false, lv);          /* si salta sempre in piedi */
        const doubleJump = !(this.coyote > 0);
        this.vy = (doubleJump ? -720 : -790) * hero().jump;
        this.buffer = 0; this.coyote = 0;
        this.jumpsLeft = doubleJump ? Math.max(0, this.jumpsLeft - 1)
                                    : (Game.hasPerk('jump3') ? 2 : 1);
        this.dashT = 0;
        Sfx.jump();
        Particles.burst(this.cx, this.y + this.h, doubleJump ? 12 : 8, '#ffffff', 170, 3.5, 240);
        if (doubleJump) Rings.add(this.cx, this.y + this.h, '#a8e8ff', 46, 0.28, 4);
      }
    }

    if (Input.wantDash() && this.dashCd <= 0 && this.dashT <= 0) {
      const dx = mx !== 0 ? mx : (Math.abs(this.aimX) > 0.3 ? sign(this.aimX) : this.facing);
      this.dashT = rush ? 0.21 : 0.17; this.dashCd = (rush ? 0.38 : 0.62) * hero().dash;
      this.vx = dx * (rush ? 930 : 820); this.facing = dx;
      this.invuln = Math.max(this.invuln, 0.22);
      Sfx.dash();
      Particles.burst(this.cx, this.cy, 14, '#8ff0ff', 260, 4, 0);
    }

    if (Input.wantFire() && this.fireCd <= 0 && this.overheat <= 0) this.shoot(bullets);

    const dropThrough = Input.moveY() > 0.6;
    const wasAir = !this.onGround;
    moveEntity(this, lv, dt, dropThrough);
    if (this.onPad) {
      this.vy = -1040; this.onGround = false; this.jumpsLeft = 1;
      this.land = 0; this.dashT = 0;
      Game.addVolt(7);
      Particles.burst(this.cx, this.y + this.h, 22, '#66ffe0', 300, 4.5, 180);
      Rings.add(this.cx, this.y + this.h, '#ffffff', 74, 0.34, 5);
      Sfx.jump();
    }
    if (wasAir && this.onGround) {
      this.land = 0.18;
      Particles.burst(this.cx, this.y + this.h, 6, '#ffffff', 120, 3, 300);
    }

    if (this.hitWall && this.dashT > 0) this.dashT = 0;

    if (this.y < 0) { this.y = 0; if (this.vy < 0) this.vy = 0; }   /* tetto invisibile */
    const minX = TILE * 0.5, maxX = lv.pxW - TILE * 0.5 - this.w;
    if (this.x < minX) { this.x = minX; if (this.vx < 0) this.vx = 0; }
    if (this.x > maxX) { this.x = maxX; if (this.vx > 0) this.vx = 0; }
    if (touchesSpike(this, lv)) { if (this.hurt(1)) this.vy = -420; }
    if (this.y > lv.pxH + 80) this.fall(lv);

    this.safeT -= dt;
    if (this.onGround && this.safeT <= 0 && !touchesSpike(this, lv)) {
      this.safeT = 0.25; this.safeX = this.x; this.safeY = this.y - 4;
    }

    /* sciarpa: catena di punti che insegue la nuca */
    const hx = this.cx - this.facing * 6, hy = this.y + 9;
    this.scarf[0].x = hx; this.scarf[0].y = hy;
    for (let i = 1; i < this.scarf.length; i++) {
      const p = this.scarf[i], q = this.scarf[i - 1];
      p.x = lerp(p.x, q.x - this.facing * 5 - this.vx * 0.012, Math.min(1, dt * 22));
      p.y = lerp(p.y, q.y + 2.4 - this.vy * 0.006, Math.min(1, dt * 20));
    }

    if (this.onGround && Math.abs(this.vx) > 120 && Math.random() < 0.25)
      Particles.smoke(this.cx, this.y + this.h, '#ffffff');
  }

  /* precipitare fuori dal settore toglie una vita e riporta all'ultimo appoggio */
  fall(lv) {
    this.invuln = 0;
    this.shield = 0;
    this.hurt(1);
    if (this.dead) return;
    const tx = clamp(Math.round(this.safeX / TILE), 3, lv.w - 4);
    let found = -1;
    for (let k = 0; k < 40 && tx - k > 2; k++) {
      const a = lv.groundY[tx - k - 1], b = lv.groundY[tx - k], c = lv.groundY[tx - k + 1];
      if (a > 0 && b > 0 && c > 0) { found = tx - k; break; }
    }
    if (found > 0) { this.x = found * TILE + (TILE - this.w) / 2; this.y = lv.groundY[found] * TILE - this.h - 2; }
    else { this.x = this.safeX; this.y = this.safeY; }
    this.vx = 0; this.vy = 0; this.dashT = 0;
    this.invuln = Math.max(this.invuln, 1.4);
    for (const s of this.scarf) { s.x = this.cx; s.y = this.y + 9; }
    Floaters.add(this.cx, this.y - 10, 'RIENTRO', '#48d7ff', 16);
    Particles.burst(this.cx, this.cy, 26, '#48d7ff', 280, 4.5, 0);
    Rings.add(this.cx, this.cy, '#9be9ff', 80, 0.4, 5);
  }

  shoot(bullets) {
    const W = this.weapon;
    const bx = this.cx + this.aimX * 18, by = this.cy + this.aimY * 18 - 2;
    const spd = W === 'laser' ? 1500 : 900;
    const rush = Game.rushT > 0;
    const heatBefore = this.heat;
    const H = hero();
    const bonus = Game.perkLevel('power') + H.dmg;
    const extra = {
      bounces: Game.hasPerk('bounce') ? 1 : 0,
      freeze: Game.hasPerk('freeze')
    };
    const mk = (ang, opt) => {
      const o = Object.assign({ dmg: rush ? 2 : 1, r: rush ? 5.5 : 4.5, col: rush ? '#75ffe0' : '#38e8ff', life: 1.4 },
                              opt || {}, extra);
      o.dmg += bonus;
      if (extra.freeze) o.col = '#7fe8ff';
      bullets.push(new Bullet(bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, o));
    };
    const base = Math.atan2(this.aimY, this.aimX);

    if (W === 'spread') {
      for (let i = -1; i <= 1; i++) mk(base + i * 0.19, { col: '#ffc247' });
      this.fireCd = 0.20; this.heat += 17; Sfx.shootBig();
    } else if (W === 'rapid') {
      mk(base + (Math.random() - 0.5) * 0.07, { col: '#5ee08a', r: 4 });
      this.fireCd = 0.075; this.heat += 6.5; Sfx.shoot();
    } else if (W === 'laser') {
      mk(base, { col: rush ? '#ffffff' : '#c98ff7', dmg: rush ? 3 : 2, pierce: 4, r: rush ? 6 : 5, life: 1.1 });
      this.fireCd = 0.26; this.heat += 20; Sfx.laser();
    } else {
      mk(base, { col: '#38e8ff' });
      this.fireCd = 0.155; this.heat += 10; Sfx.shoot();
    }
    if (rush) {
      this.fireCd *= 0.68;
      this.heat = heatBefore + (this.heat - heatBefore) * 0.42;
    }
    /* raffica: si spara più in fretta e si scalda di meno */
    this.fireCd *= H.rate;          /* ogni custode ha la sua cadenza */
    const rf = Game.perkLevel('rapidfire');
    if (rf) { this.fireCd *= (1 - 0.13 * rf); this.heat -= (this.heat - heatBefore) * 0.25 * rf; }
    this.muzzle = 0.07;
    this.vx -= this.aimX * 26;
    Particles.spark(bx, by, this.aimX * 200, this.aimY * 200, '#ffffff');
    if (this.heat >= 100) { this.heat = 100; this.overheat = 1.15; Floaters.add(this.cx, this.y - 8, 'SURRISCALDATO', '#ff9f68', 14); }
  }

  /* accovacciato l'ingombro passa da 30 a 18 px: ci si rialza solo se c'è spazio */
  setCrouch(on, lv) {
    if (on === this.crouch || this.riding) return;
    if (on) {
      this.y += 12; this.h = 18; this.crouch = true;
      if (Math.random() < 0.4) Particles.smoke(this.cx, this.y + this.h, '#ffffff');
    } else {
      const ny = this.y - 12;
      const x1 = Math.floor((this.x + 2) / TILE), x2 = Math.floor((this.x + this.w - 2) / TILE);
      const y1 = Math.floor(ny / TILE), y2 = Math.floor((ny + 30 - 1) / TILE);
      for (let ty = y1; ty <= y2; ty++)
        for (let tx = x1; tx <= x2; tx++)
          if (lv.tileAt(tx, ty) === T_SOLID) return;    /* soffitto: resta giù */
      this.y = ny; this.h = 30; this.crouch = false;
    }
  }

  /* ---- navicella ---- */
  boardShip(ship) {
    if (this.crouch) { this.y -= 12; this.h = 30; this.crouch = false; }
    this.riding = true;
    const hull = Game.perkLevel('hull');
    this.shipHp = SHIP_HP + hull; this.shipMax = SHIP_HP + hull;
    this.shipT = SHIP_TIME + hull * 5; this.shipFlash = 0;
    this.w = 46; this.h = 28;
    this.x = ship.x; this.y = ship.y;
    this.vx = 0; this.vy = 0; this.dashT = 0;
    this.invuln = Math.max(this.invuln, 0.8);
    Game.banner('NAVICELLA!');
    Game.shake(10, 0.25); Game.flashT = 0.18;
    Particles.burst(this.cx, this.cy, 40, '#8ff0ff', 320, 5, 0);
    Rings.add(this.cx, this.cy, '#ffffff', 120, 0.45, 6);
    Sfx.levelUp();
    Game.onShipChange();
  }

  leaveShip(exploded) {
    if (!this.riding) return;
    const cx = this.cx, cy = this.cy;
    this.riding = false;
    this.w = 20; this.h = 30;
    this.x = cx - this.w / 2; this.y = cy - this.h / 2;
    this.vx *= 0.3; this.vy = -280;
    this.invuln = Math.max(this.invuln, exploded ? 1.5 : 0.9);
    this.shipT = 0; this.shipHp = 0;
    for (const sc of this.scarf) { sc.x = this.cx; sc.y = this.y + 9; }
    if (exploded) {
      Particles.burst(cx, cy, 60, '#ffc46b', 420, 6, 260);
      Particles.burst(cx, cy, 26, '#ff7a5c', 300, 5, 200);
      Rings.add(cx, cy, '#ffd9a0', 150, 0.5, 8);
      Game.shake(22, 0.45); Game.flashT = 0.25;
      Sfx.bomb();
      Floaters.add(cx, cy - 20, 'NAVICELLA DISTRUTTA', '#ffc46b', 15);
    } else {
      Particles.burst(cx, cy, 30, '#8ff0ff', 260, 4.5, 120);
      Floaters.add(cx, cy - 20, 'CARBURANTE FINITO', '#b9d9ff', 14);
      Sfx.portal();
    }
    Game.onShipChange();
  }

  updateFlight(dt, lv, enemies, bullets, camX, camY) {
    this.anim += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.shipFlash = Math.max(0, this.shipFlash - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.dashT = Math.max(0, this.dashT - dt);

    this.shipT -= dt;
    if (this.shipT <= 0) { this.leaveShip(false); return; }

    this.aim(lv, enemies, camX, camY);

    const mx = Input.moveX(), my = Input.moveY();
    if (mx !== 0) this.facing = sign(mx);

    if (this.dashT > 0) {
      this.vy = approach(this.vy, 0, 2400 * dt);
    } else {
      this.vx = approach(this.vx, mx * 350, 2200 * dt);
      this.vy = approach(this.vy, my * 300, 2200 * dt);
      /* il tasto del salto diventa una spinta in avanti */
      if (Input.wantJump() && this.dashCd <= 0) {
        this.dashT = 0.22; this.dashCd = 0.8;
        this.vx = this.facing * 780;
        this.invuln = Math.max(this.invuln, 0.3);
        Sfx.dash();
        Particles.burst(this.cx, this.cy, 16, '#8ff0ff', 280, 4.5, 0);
      }
    }

    /* vola: niente gravita, attraversa le piattaforme, si ferma sui muri */
    this.prevBottom = this.y + this.h;
    this.hitWall = 0;
    this.x += this.vx * dt; collideX(this, lv);
    this.onGround = false;
    this.y += this.vy * dt; collideY(this, lv, true);
    if (this.onGround) this.vy = Math.min(this.vy, 0);

    const minX = TILE * 0.5, maxX = lv.pxW - TILE * 0.5 - this.w;
    if (this.x < minX) { this.x = minX; this.vx = 0; }
    if (this.x > maxX) { this.x = maxX; this.vx = 0; }
    if (this.y < 4) { this.y = 4; this.vy = Math.max(0, this.vy); }
    if (this.y > lv.pxH - this.h - 8) { this.y = lv.pxH - this.h - 8; this.vy = Math.min(0, this.vy); }

    if (Input.wantFire() && this.fireCd <= 0) this.shootShip(bullets);

    /* scia del reattore */
    if (Math.random() < 0.8) {
      Particles.spawn(this.cx - this.facing * 24, this.cy + 4,
        -this.facing * (60 + Math.random() * 60), (Math.random() - 0.5) * 30,
        0.3, 5, this.shipT < 4 ? '#ff9f68' : '#8ff0ff', -20, 1);
    }
  }

  shootShip(bullets) {
    const rush = Game.rushT > 0;
    const a = Math.atan2(this.aimY, this.aimX);
    const spd = 1000;
    for (const off of [-7, 7]) {
      bullets.push(new Bullet(this.cx + this.aimX * 22 - this.aimY * off,
        this.cy + this.aimY * 22 + this.aimX * off,
        Math.cos(a) * spd, Math.sin(a) * spd,
        { dmg: rush ? 2 : 1, r: rush ? 5 : 4, col: rush ? '#75ffe0' : '#8ff0ff', life: 1.2 }));
    }
    this.fireCd = rush ? 0.085 : 0.13;
    this.muzzle = 0.06;
    Sfx.shoot();
  }

  give(kind) {
    switch (kind) {
      case 'maxheart':
        this.maxHp = Math.min(6, this.maxHp + 1);
        this.hp = this.maxHp;
        Floaters.add(this.cx, this.y - 8, 'CUORE IN PIÙ!', '#ffd166', 18);
        Game.banner('CUORE IN PIÙ');
        Sfx.levelUp();
        break;
      case 'heart':
        if (this.hp < this.maxHp) { this.hp++; Floaters.add(this.cx, this.y - 8, '+VITA', '#ff8fb4', 16); }
        else { Game.addScore(150); Floaters.add(this.cx, this.y - 8, '+150', '#ffd166', 16); }
        break;
      case 'shield':
        this.shield = Math.min(2, this.shield + 1);
        Floaters.add(this.cx, this.y - 8, '+SCUDO', '#48d7ff', 16); break;
      case 'coin':
        Game.addScore(250); Floaters.add(this.cx, this.y - 8, '+250', '#ffd166', 16); break;
      case 'volt':
        Game.addVolt(24); Floaters.add(this.cx, this.y - 8, '+24 VOLT', '#66ffe0', 16); break;
      default:
        this.weapon = kind; this.weaponT = 15;
        this.heat = 0; this.overheat = 0;
        Floaters.add(this.cx, this.y - 8, kind.toUpperCase(), '#ffc247', 17);
    }
    Rings.add(this.cx, this.cy, '#ffffff', 60, 0.3, 4);
    Sfx.pickup();
  }

  drawFlight(ctx, cx, cy) {
    const x = this.cx - cx, y = this.cy - cy;
    const low = this.shipT < 4;
    Gfx.shadow(ctx, x, this.y - cy + this.h + 30, 52, 0.2);
    Gfx.light(ctx, x, y, 60, low ? '#ff9f68' : '#8ff0ff', 0.45);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(clamp(this.vy / 1400, -0.22, 0.22) * (this.facing >= 0 ? 1 : -1));
    drawShipBody(ctx, this.anim, this.facing, Math.abs(this.vx) / 350 + 0.3,
                 this.shipFlash > 0 || (low && Math.floor(this.shipT * 6) % 2 === 0), true);
    ctx.restore();
    if (this.muzzle > 0) {
      const mx = x + this.aimX * 30, my = y + this.aimY * 30;
      Gfx.light(ctx, mx, my, 30, '#fff6c9', 0.85);
    }
    /* scafo residuo sopra la navicella */
    ctx.save();
    for (let i = 0; i < (this.shipMax || SHIP_HP); i++) {
      ctx.fillStyle = i < this.shipHp ? '#8ff0ff' : 'rgba(255,255,255,.22)';
      roundRect(ctx, x - 17 + i * 12, y - 26, 9, 5, 2.5); ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx, cx, cy) {
    if (this.dead) return;
    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) return;
    if (this.riding) { this.drawFlight(ctx, cx, cy); return; }

    const x = this.x - cx + this.w / 2;
    const y = this.y - cy + this.h / 2;
    const feet = this.y - cy + this.h;
    const run = this.onGround && Math.abs(this.vx) > 40;
    const air = !this.onGround;

    Gfx.shadow(ctx, x, feet + 3, 38, this.onGround ? 0.42 : 0.2);
    if (this.dashT > 0) Gfx.light(ctx, x, y, 54, '#8ff0ff', 0.5);
    if (Game.rushT > 0) {
      Gfx.light(ctx, x, y, 74 + Math.sin(this.anim * 12) * 8, '#75ffe0', 0.65);
      ctx.save();
      ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 29 + Math.sin(this.anim * 15) * 3, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    /* sciarpa dietro al corpo */
    ctx.save();
    const H = hero();
    ctx.strokeStyle = H.trail; ctx.lineWidth = H.ponytail ? 8 : 7; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < this.scarf.length; i++) {
      const s = this.scarf[i];
      const px = s.x - cx, py = s.y - cy + Math.sin(this.anim * 9 + i) * 1.6;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    /* squash & stretch */
    let sx = 1, sy = 1;
    if (this.land > 0) { const k = this.land / 0.18; sx = 1 + k * 0.28; sy = 1 - k * 0.24; }
    else if (air) { const k = clamp(this.vy / 700, -1, 1); sx = 1 - Math.abs(k) * 0.1; sy = 1 + Math.abs(k) * 0.14; }
    if (this.dashT > 0) { sx = 1.28; sy = 0.8; }
    if (this.crouch) { sx = 1.24; sy = 0.6; }

    ctx.save();
    ctx.translate(x, y + (1 - sy) * 12);
    ctx.scale(sx, sy);

    const legPhase = run ? Math.sin(this.anim * 17) : 0;
    const bodyCol = this.flash > 0 ? '#ffffff' : H.body;
    const trim = this.shield > 0 ? '#48d7ff' : H.trim;

    /* gambe */
    const legY = air ? 6 : 8;
    Gfx.capsule(ctx, -8, legY, 7, air ? 10 : 11 + legPhase * 3, H.legs, OUTLINE, 3);
    Gfx.capsule(ctx, 1, legY, 7, air ? 10 : 11 - legPhase * 3, H.legs, OUTLINE, 3);

    /* corpo */
    Gfx.capsule(ctx, -11, -13, 22, 24, bodyCol, OUTLINE, 3);
    ctx.save();
    roundRect(ctx, -11, -13, 22, 24, 9); ctx.clip();
    ctx.fillStyle = trim;
    roundRect(ctx, -11, -1, 22, 12, 5); ctx.fill();
    ctx.restore();
    Gfx.gloss(ctx, -7, -10, 9, 4, 0.75);

    /* casco + visiera che guarda dove si mira */
    ctx.save();
    ctx.translate(0, -16);
    if (H.ponytail) {
      /* ciuffo che sbuca dal visore */
      ctx.fillStyle = H.trail;
      ctx.beginPath();
      ctx.moveTo(-2, -9); ctx.quadraticCurveTo(-15, -17, -13, -3);
      ctx.quadraticCurveTo(-8, -8, -2, -6); ctx.closePath();
      ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
      /* la ciocca gialla della tavola */
      ctx.fillStyle = H.hair2 || '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-3, -9); ctx.quadraticCurveTo(-9, -14, -8, -7);
      ctx.quadraticCurveTo(-6, -8, -3, -7); ctx.closePath(); ctx.fill();
    }
    Gfx.capsule(ctx, -10, -9, 20, 18, trim, OUTLINE, 3);
    ctx.fillStyle = '#1b2340';
    const vx = clamp(this.aimX, -1, 1) * 2.4;
    roundRect(ctx, -7 + vx, -5, 14, 8, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    roundRect(ctx, -4.5 + vx, -3.6, 5, 2.6, 1.3); ctx.fill();
    ctx.restore();

    /* braccio + blaster verso la mira */
    ctx.save();
    ctx.rotate(Math.atan2(this.aimY, this.aimX));
    if (H.glove) {
      /* guanto energetico: il colpo parte dal palmo */
      Gfx.capsule(ctx, 2, -4.5, 13, 9, '#ffe3f1', OUTLINE, 3);
      Gfx.capsule(ctx, 12, -6.5, 11, 13, H.trim, OUTLINE, 3);
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(this.anim * 8) * 0.2;
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(19, 0, 6.5, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(19, 0, 3, 0, TAU); ctx.fill();
    } else {
      Gfx.capsule(ctx, 2, -4.5, 15, 9, '#e7edff', OUTLINE, 3);
      Gfx.capsule(ctx, 11, -6, 16, 12, '#ffc247', OUTLINE, 3);
      ctx.fillStyle = '#ff8a3d';
      roundRect(ctx, 20, -3.5, 8, 7, 3); ctx.fill();
    }
    ctx.restore();
    ctx.restore();

    /* lampo dello sparo */
    if (this.muzzle > 0) {
      const mx2 = x + this.aimX * 30, my2 = y + this.aimY * 30;
      Gfx.light(ctx, mx2, my2, 34, '#fff6c9', 0.9);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(mx2, my2, 6.5, 0, TAU); ctx.fill();
      ctx.restore();
    }

    /* bolla scudo */
    if (this.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.anim * 5) * 0.12;
      ctx.strokeStyle = '#8fe9ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y - 2, 27, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#8fe9ff'; ctx.fill();
      ctx.restore();
    }
  }
}

/* ---------- mostri ---------- */
const ENEMY_DEF = {
  crawler: { w: 26, h: 26, hp: 2,  speed: 120, score: 100, col: '#ff5d8f', dark: '#c72f68', touch: 1 },
  flyer:   { w: 24, h: 22, hp: 2,  speed: 155, score: 120, col: '#ffc247', dark: '#d18c17', touch: 1 },
  spitter: { w: 28, h: 30, hp: 4,  speed: 55,  score: 160, col: '#a06bff', dark: '#6d3fc4', touch: 1 },
  charger: { w: 32, h: 28, hp: 6,  speed: 80,  score: 220, col: '#ff8a3d', dark: '#c85a15', touch: 2 },
  bomber:  { w: 30, h: 24, hp: 2,  speed: 110, score: 220, col: '#5ee08a', dark: '#2c9d5a', touch: 1 },
  boss:    { w: 76, h: 76, hp: 60, speed: 105, score: 2500, col: '#ff4d7d', dark: '#b41f52', touch: 2 }
};

/* ---------- gli élite ----------
   Dal sesto settore in poi una parte dei mostri arriva temprata: stessa
   specie, un vantaggio in piu' e un modo diverso di affrontarla. Servono a
   far salire la tensione senza toccare i primi cinque settori, che restano
   la porta d'ingresso per chi prova il gioco la prima volta. */
const ELITES = {
  sprint: { label: 'SCATTANTE',   col: '#ff2f2f', from: 6,  hp: 0.6,  speed: 1.85, score: 2 },
  armor:  { label: 'CORAZZATO',   col: '#c8d8ee', from: 8,  hp: 1,    speed: 0.85, score: 2.2 },
  jammer: { label: 'DISTURBATORE', col: '#63f4ff', from: 11, hp: 1.15, speed: 1,    score: 2.4 }
};

/* Chi diventa élite lo decide il numero del settore: cosi il settore 12 e'
   lo stesso per tutti. rnd e' la funzione casuale del settore (o Math.random
   per le ondate che nascono durante la partita). */
function eliteRoll(rnd, n, type) {
  if (type === 'boss' || n < ELITES.sprint.from) return null;
  if (rnd() > Math.min(0.40, (n - 5) * 0.055)) return null;
  const pool = ['sprint', 'sprint'];
  /* la corazza si porta sulla schiena: solo chi cammina e ha una direzione */
  if (n >= ELITES.armor.from && (type === 'crawler' || type === 'spitter' || type === 'charger'))
    pool.push('armor', 'armor');
  if (n >= ELITES.jammer.from) pool.push('jammer');
  return pool[Math.floor(rnd() * pool.length)];
}

class Enemy {
  constructor(type, x, y, level, tier, elite) {
    const d = ENEMY_DEF[type];
    this.type = type; this.def = d;
    this.x = x; this.y = y; this.w = d.w; this.h = d.h;
    this.vx = 0; this.vy = 0; this.onGround = false; this.prevBottom = y + d.h;
    this.elite = type === 'boss' ? null : (elite || null);
    const E = this.elite ? ELITES[this.elite] : null;
    /* dopo il quinto settore la curva si impenna: fino a li' resta com'era */
    const oltre = Math.max(0, level - 5);
    const scale = 1 + (level - 1) * 0.065 + oltre * 0.045;
    this.maxHp = Math.max(1, Math.round(
      d.hp * (type === 'boss' ? (1 + (tier - 1) * 0.85) : scale) * (E ? E.hp : 1)));
    this.hp = this.maxHp;
    this.speed = d.speed * (1 + Math.min(0.75, (level - 1) * 0.035 + oltre * 0.015)) * (E ? E.speed : 1);
    this.score = Math.round(d.score * (E ? E.score : 1));
    this.pulse = 2 + Math.random();
    this.dir = -1; this.t = Math.random() * 4;
    this.flash = 0; this.dead = false; this.stun = 0;
    this.cool = 0.8 + Math.random(); this.state = 0; this.stateT = 0;
    this.tier = tier || 1;
    this.phase = 0;
    this.awake = false; this.hunting = false; this.jumped = false;
    this.baseSpeed = this.speed; this.slow = 0;
    if (type === 'boss') { this.w = 76; this.h = 76; }
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  hurt(dmg, fromX, freeze) {
    if (this.dead) return;
    /* il corazzato porta la piastra sul davanti: di fronte i colpi scivolano,
       alle spalle entrano il doppio. Non e' invulnerabile, e' scomodo. */
    if (this.elite === 'armor' && fromX !== undefined) {
      if (sign(fromX - this.cx) === this.dir) {
        dmg *= 0.35;
        Sfx.tone(900, 0.05, 'square', 0.025, 640);
        Particles.burst(this.cx + this.dir * this.w * 0.4, this.cy, 4, '#e8f2ff', 150, 2.5, 40);
        if (this.t - (this._clang || -9) > 1.2) {
          this._clang = this.t;
          Floaters.add(this.cx, this.cy - 26, 'ALLE SPALLE!', '#cfe0ff', 12);
        }
      } else dmg *= 2;
    }
    this.hp -= dmg;
    this.flash = 0.09;
    if (freeze) {
      this.slow = 1.6 + Game.perkLevel('freeze') * 0.6;
      Particles.burst(this.cx, this.cy, 6, '#9fe8ff', 130, 3, 60);
    }
    Particles.spark(this.cx, this.cy, sign(this.cx - fromX) * 100, -60, this.def.col);
    if (this.hp <= 0) { this.die(); return; }
    Sfx.hitEnemy();
    if (this.type !== 'boss') { this.vx += sign(this.cx - fromX) * 90; this.stun = 0.07; }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    const big = this.type === 'boss';
    Particles.burst(this.cx, this.cy, big ? 80 : 24, this.def.col, big ? 460 : 280, big ? 7 : 4.5, 260);
    Particles.burst(this.cx, this.cy, 10, '#ffffff', 200, 3, 200);
    Rings.add(this.cx, this.cy, this.def.col, big ? 200 : 62, big ? 0.6 : 0.3, big ? 9 : 5);
    Sfx.kill();
    Game.onEnemyKilled(this);
  }

  update(dt, lv, player, bullets) {
    if (this.dead) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.slow = Math.max(0, this.slow - dt);
    this.speed = this.baseSpeed * (this.slow > 0 ? 0.42 : 1);
    this.cool -= dt;
    const dx = player.cx - this.cx, dy = player.cy - this.cy;
    const distX = Math.abs(dx), distY = Math.abs(dy);
    /* quando restano pochi mostri diventano tutti aggressivi: niente settori
       bloccati da un ritardatario fermo dall'altra parte della mappa */
    this.hunting = Game.enemiesLeft <= 2;
    if (!this.awake && (distX < 760 || this.hunting)) this.awake = true;
    if (!this.awake) return;
    if (this.elite) this.updateElite(dt, player);
    if (this.stun > 0) { this.vy += GRAV * dt; moveEntity(this, lv, dt, false); return; }

    switch (this.type) {
      case 'crawler': this.updateWalker(dt, lv, dx, distX, 1); break;
      case 'charger': this.updateCharger(dt, lv, player, dx, distX, distY); break;
      case 'spitter': this.updateSpitter(dt, lv, player, bullets, dx, distX); break;
      case 'flyer':   this.updateFlyer(dt, lv, player, dx, dy); break;
      case 'bomber':  this.updateBomber(dt, lv, player, bullets, dx, dy); break;
      case 'boss':    this.updateBoss(dt, lv, player, bullets, dx, dy); break;
    }
  }

  /* quel che fanno in piu' gli élite */
  updateElite(dt, player) {
    if (this.elite === 'sprint') {
      if (Math.abs(this.vx) > 60 && Math.random() < 0.6)
        Particles.spawn(this.cx, this.cy + 4, -this.vx * 0.12, -20, 0.26, 4.5, ELITES.sprint.col, 0, 1);
      return;
    }
    if (this.elite !== 'jammer') return;
    /* il disturbatore non fa male: manda in corto il blaster. Va tolto di
       mezzo per primo, oppure gli si sta lontano. */
    if (Math.abs(player.cx - this.cx) > 380) return;
    this.pulse -= dt;
    /* mezzo secondo di scintille prima della scarica: si fa in tempo a
       scappare o a farlo fuori, ma bisogna accorgersene */
    if (this.pulse > 0) {
      if (this.pulse < 0.5 && Math.random() < 0.5)
        Particles.spawn(this.cx + (Math.random() - 0.5) * 26, this.cy + (Math.random() - 0.5) * 26,
          0, -40, 0.3, 3.5, ELITES.jammer.col, 0, 1);
      return;
    }
    this.pulse = 3.4;
    Rings.add(this.cx, this.cy, ELITES.jammer.col, 200, 0.45, 6);
    Sfx.tone(190, 0.22, 'sawtooth', 0.045, 900);
    if (!player.dead && player.shield <= 0 && dist2(player.cx, player.cy, this.cx, this.cy) < 200 * 200) {
      player.heat = 100; player.overheat = Math.max(player.overheat, 0.85);
      Floaters.add(player.cx, player.y - 14, 'ARMA IN CORTO', ELITES.jammer.col, 14);
    }
  }

  updateWalker(dt, lv, dx, distX, chaseMul) {
    /* nei settori d'apertura i mostri sono meno arrembanti: serve tempo
       per imparare a muoversi prima di essere braccati */
    const early = Game.level <= 3 ? 1 : 0;
    if (distX < (early ? 250 : 420) || this.hunting) this.dir = sign(dx) || this.dir;
    this.vx = this.dir * this.speed * chaseMul * (this.hunting ? 1.25 : 1) * (early ? 0.78 : 1);
    this.vy += GRAV * dt;
    moveEntity(this, lv, dt, false);
    /* muro davanti: se sta inseguendo prova a saltarlo, altrimenti torna indietro */
    if (this.hitWall) {
      if (this.onGround && sign(dx) === this.dir && distX < 620) { this.vy = -700; }
      else this.dir *= -1;
    }
    if (this.onGround) {
      const aheadX = this.cx + this.dir * (this.w * 0.6 + 4);
      if (!lv.solidAt(aheadX, this.y + this.h + 6) &&
          lv.tileAt(Math.floor(aheadX / TILE), Math.floor((this.y + this.h + 6) / TILE)) !== T_PLAT) {
        if (distX > 60) this.dir *= -1;
      }
    }
    if (this.y > lv.pxH + 100) this.dead = true;
  }

  updateCharger(dt, lv, player, dx, distX, distY) {
    if (this.state === 0) {
      this.updateWalker(dt, lv, dx, distX, 0.55);
      if (distX < 300 && distY < 90 && sign(dx) === this.dir) { this.state = 1; this.stateT = 0.55; }
    } else if (this.state === 1) {
      this.vx = approach(this.vx, 0, 2000 * dt);
      this.vy += GRAV * dt;
      moveEntity(this, lv, dt, false);
      this.stateT -= dt;
      if (Math.random() < 0.4) Particles.spawn(this.cx, this.cy, (Math.random() - .5) * 60, -40, 0.3, 4, '#ffb37a', 0, 0);
      if (this.stateT <= 0) { this.state = 2; this.stateT = 1.1; Sfx.tone(160, 0.2, 'sawtooth', 0.07, 420); }
    } else {
      this.vx = this.dir * this.speed * 4.2;
      this.vy += GRAV * dt;
      moveEntity(this, lv, dt, false);
      Particles.spawn(this.cx, this.cy, 0, 0, 0.22, 8, '#ffb37a', 0, 1);
      this.stateT -= dt;
      if (this.hitWall) { this.dir *= -1; this.state = 0; }
      if (this.stateT <= 0) { this.state = 0; this.cool = 1.2; }
    }
  }

  updateSpitter(dt, lv, player, bullets, dx, distX) {
    this.updateWalker(dt, lv, dx, distX, 0.6);
    if (this.cool <= 0 && distX < 520) {
      this.cool = 1.6 - Math.min(0.55, Math.max(0, Game.level - 5) * 0.05);
      const a = Math.atan2(player.cy - this.cy, player.cx - this.cx);
      const spd = 330;
      bullets.push(new Bullet(this.cx, this.cy, Math.cos(a) * spd, Math.sin(a) * spd,
        { foe: true, col: '#c07bff', r: 6, life: 3 }));
      Sfx.tone(320, 0.12, 'square', 0.05, 140);
    }
  }

  updateFlyer(dt, lv, player, dx, dy) {
    const l = Math.hypot(dx, dy) || 1;
    const tx = dx / l, ty = dy / l;
    this.vx = approach(this.vx, tx * this.speed, 700 * dt);
    this.vy = approach(this.vy, ty * this.speed * 0.85 + Math.sin(this.t * 3.4) * 90, 700 * dt);
    this.x += this.vx * dt; collideX(this, lv);
    this.y += this.vy * dt;
    if (this.y < 8) { this.y = 8; this.vy = Math.abs(this.vy) * 0.4; }
    if (lv.solidAt(this.cx, this.y) || lv.solidAt(this.cx, this.y + this.h)) { this.y -= this.vy * dt; this.vy *= -0.5; }
  }

  updateBomber(dt, lv, player, bullets, dx, dy) {
    const targetY = player.cy - 138;   /* piu bassi: si possono colpire davvero */
    this.vx = approach(this.vx, sign(dx) * this.speed, 500 * dt);
    this.vy = approach(this.vy, clamp((targetY - this.cy) * 2.2, -190, 190), 620 * dt);
    this.x += this.vx * dt; collideX(this, lv);
    this.y += this.vy * dt;
    if (lv.solidAt(this.cx, this.y)) { this.y -= this.vy * dt; this.vy = 60; }
    if (this.cool <= 0 && Math.abs(dx) < 90 && dy > 0) {
      this.cool = 3.1 - Math.min(0.9, Math.max(0, Game.level - 5) * 0.07);
      bullets.push(new Bullet(this.cx, this.y + this.h + 6, this.vx * 0.4, 60,
        { foe: true, col: '#7ef0a8', r: 7, life: 4, grav: 900, bomb: true }));
    }
  }

  updateBoss(dt, lv, player, bullets, dx, dy) {
    const hpFrac = this.hp / this.maxHp;
    this.phase = hpFrac > 0.66 ? 0 : (hpFrac > 0.33 ? 1 : 2);
    this.vy += GRAV * dt;
    this.stateT -= dt;

    if (this.state === 0) {
      this.vx = approach(this.vx, sign(dx) * this.speed * (1 + this.phase * 0.35), 900 * dt);
      if (this.stateT <= 0) { this.state = Math.random() < 0.5 ? 1 : 2; this.stateT = 0.1; }
    } else if (this.state === 1) {
      if (this.onGround && !this.jumped) {
        this.vy = -880; this.vx = clamp(dx * 1.15, -420, 420);
        this.jumped = true; this.stateT = 1.8;
        Sfx.tone(120, 0.25, 'sawtooth', 0.1, 300);
      } else if (this.jumped && this.onGround) {
        this.jumped = false; this.state = 0; this.stateT = 1.1;
        Game.shake(16, 0.3);
        Particles.burst(this.cx, this.y + this.h, 26, this.def.col, 300, 5, 400);
        Rings.add(this.cx, this.y + this.h, '#ffffff', 150, 0.4, 7);
        Sfx.noise(0.3, 0.2, 700, 90);
        /* dal secondo Comandante l'atterraggio manda onde lungo il terreno:
           non basta piu' stargli lontano, bisogna saltarle */
        if (this.tier >= 2) for (const sv of [-1, 1])
          bullets.push(new Bullet(this.cx + sv * 34, this.y + this.h - 12, sv * 330, 0,
            { foe: true, col: '#ffd166', r: 9, life: 2.2 }));
      } else if (this.stateT <= 0) { this.jumped = false; this.state = 0; this.stateT = 1.1; }
    } else if (this.state === 2) {
      this.vx = approach(this.vx, 0, 1400 * dt);
      if (this.cool <= 0) {
        this.cool = Math.max(0.12, 0.34 - this.phase * 0.07 - (this.tier - 1) * 0.02);
        const base = Math.atan2(player.cy - this.cy, player.cx - this.cx);
        const n = 3 + this.phase * 2 + (this.tier >= 3 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.24 + (Math.random() - 0.5) * 0.05;
          bullets.push(new Bullet(this.cx, this.cy, Math.cos(a) * 380, Math.sin(a) * 380,
            { foe: true, col: '#ff7aa2', r: 7, life: 3.2 }));
        }
        Sfx.tone(220, 0.14, 'square', 0.06, 90);
      }
      if (this.stateT <= 0) { this.state = 0; this.stateT = 1.3 - this.phase * 0.25; }
    }

    moveEntity(this, lv, dt, false);
    if (this.hitWall) this.vx = 0;

    if (this.phase >= 1 && this.cool <= 0 && Math.random() < 0.012) {
      Game.spawnEnemy('flyer', this.cx, this.cy - 40);
      Sfx.tone(500, 0.2, 'triangle', 0.06, 900);
    }
  }

  /* ---------------- disegno ---------------- */
  draw(ctx, cx, cy) {
    if (this.dead) return;
    const x = this.cx - cx, y = this.cy - cy;
    const feet = this.y - cy + this.h;
    const col = this.flash > 0 ? '#ffffff' : this.def.col;
    const dark = this.flash > 0 ? '#dddddd' : this.def.dark;
    const px = Game.player ? Game.player.cx - this.cx : 1;
    const py = Game.player ? Game.player.cy - this.cy : 0;

    Gfx.shadow(ctx, x, feet + 2, this.w * 1.5, this.onGround ? 0.4 : 0.2);
    if (this.slow > 0) Gfx.light(ctx, x, y, this.w * 1.1, '#7fe8ff', 0.4);
    if (this.elite) Gfx.light(ctx, x, y, this.w * 1.3, ELITES[this.elite].col, 0.28 + Math.sin(this.t * 5) * 0.1);

    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;

    if (this.type === 'flyer') {
      const flap = Math.sin(this.t * 16);
      ctx.fillStyle = dark;
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(flap * 0.5);
        ctx.beginPath(); ctx.ellipse(-15, -2, 12, 6, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, this.w * 0.52, 0, TAU); ctx.fill(); ctx.stroke();
      Gfx.gloss(ctx, -7, -9, 8, 3.6, 0.6);
      Gfx.eye(ctx, 0, -1, 7, px, py);

    } else if (this.type === 'bomber') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -2, this.w * 0.5, this.h * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark;
      roundRect(ctx, -8, this.h * 0.4, 16, 9, 4); ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.translate(0, -this.h * 0.62); ctx.rotate(this.t * 22);
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, -15, -2, 30, 4, 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      Gfx.eye(ctx, -5, -3, 5.5, px, py);
      Gfx.eye(ctx, 6, -3, 5.5, px, py);

    } else if (this.type === 'boss') {
      const pulse = 1 + Math.sin(this.t * 4) * 0.035;
      ctx.save(); ctx.scale(pulse, 2 - pulse);
      ctx.fillStyle = dark;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 20, -28); ctx.quadraticCurveTo(s * 40, -52, s * 15, -46);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = col;
      roundRect(ctx, -38, -38, 76, 76, 26); ctx.fill(); ctx.stroke();
      Gfx.gloss(ctx, -26, -30, 26, 8, 0.4);
      const eyes = 1 + this.phase;
      for (let i = 0; i < eyes; i++) {
        const ex = eyes === 1 ? 0 : -16 + i * (32 / (eyes - 1));
        Gfx.eye(ctx, ex, -8, 10, px, py);
      }
      ctx.fillStyle = '#3a1030';
      roundRect(ctx, -20, 12, 40, 14, 7); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(-18 + i * 9, 12);
        ctx.lineTo(-13.5 + i * 9, 20); ctx.lineTo(-9 + i * 9, 12);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();

    } else {
      /* crawler / spitter / charger: blob con occhi e zampette */
      const sq = this.onGround ? 1 + Math.sin(this.t * 11) * 0.05 : 1;
      const legP = Math.sin(this.t * 14) * 3;
      Gfx.capsule(ctx, -this.w * 0.42, this.h * 0.28, 7, 10 + legP, dark, OUTLINE, 2.5);
      Gfx.capsule(ctx, this.w * 0.42 - 7, this.h * 0.28, 7, 10 - legP, dark, OUTLINE, 2.5);
      ctx.save();
      ctx.scale(1 / sq, sq);
      ctx.fillStyle = col;
      Gfx.blob(ctx, this.w * 1.05, this.h * 1.02, 0.045, this.t);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      Gfx.gloss(ctx, -this.w * 0.3, -this.h * 0.36, this.w * 0.36, 4.5, 0.55);

      if (this.type === 'charger') {
        ctx.fillStyle = dark;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 11, -9); ctx.quadraticCurveTo(s * 21, -22, s * 6, -18);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
      Gfx.eye(ctx, -6, -3, 6, px, py);
      Gfx.eye(ctx, 7, -3, 6, px, py);
      if (this.type === 'spitter') {
        ctx.fillStyle = '#3a1a50';
        roundRect(ctx, -6, 7, 12, 7, 3.5); ctx.fill();
      }
      if (this.type === 'charger' && this.state === 1) {
        ctx.globalAlpha = 0.35 + Math.sin(this.t * 34) * 0.3;
        ctx.fillStyle = '#ffffff';
        Gfx.blob(ctx, this.w * 1.1, this.h * 1.05, 0.05, this.t); ctx.fill();
        ctx.globalAlpha = 1;
      }
      /* la piastra del corazzato: sta davanti agli occhi, cosi si vede da che
         parte e' girato e si capisce da dove va colpito */
      if (this.elite === 'armor') {
        ctx.save();
        ctx.scale(this.dir < 0 ? -1 : 1, 1);
        ctx.fillStyle = ELITES.armor.col;
        roundRect(ctx, this.w * 0.26, -this.h * 0.44, 11, this.h * 0.88, 5); ctx.fill(); ctx.stroke();
        Gfx.gloss(ctx, this.w * 0.29, -this.h * 0.34, 4, this.h * 0.36, 0.55);
        ctx.fillStyle = '#8fa4c4';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.arc(this.w * 0.26 + 5.5, i * this.h * 0.26, 1.6, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
    ctx.restore();

    /* galloni degli élite */
    if (this.elite) {
      const E = ELITES[this.elite];
      const gy2 = this.y - cy - (this.hp < this.maxHp ? 20 : 12);
      ctx.save();
      ctx.strokeStyle = E.col; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 6, gy2 - i * 4.5);
        ctx.lineTo(x, gy2 - 3.4 - i * 4.5);
        ctx.lineTo(x + 6, gy2 - i * 4.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* barra vita sopra la testa */
    if (this.type !== 'boss' && this.hp < this.maxHp) {
      const bw = this.w + 8, bx = x - bw / 2, by = this.y - cy - 12;
      ctx.save();
      ctx.fillStyle = 'rgba(26,18,52,.45)';
      roundRect(ctx, bx - 1, by - 1, bw + 2, 7, 3.5); ctx.fill();
      ctx.fillStyle = this.def.col;
      roundRect(ctx, bx, by, bw * (this.hp / this.maxHp), 5, 2.5); ctx.fill();
      ctx.restore();
    }
  }
}

/* ---------- navicella ---------- */
const SHIP_TIME = 15, SHIP_HP = 3;

/* scafo condiviso: lo usano sia la navicella posata sia quella pilotata */
function drawShipBody(ctx, t, facing, thrust, flash, pilot) {
  ctx.save();
  ctx.scale(facing >= 0 ? 1 : -1, 1);
  ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;

  if (thrust > 0) {
    const f = 12 + Math.sin(t * 30) * 5 + thrust * 12;
    ctx.fillStyle = '#ffc46b';
    ctx.beginPath();
    ctx.moveTo(-20, -5); ctx.quadraticCurveTo(-20 - f, 0, -20, 5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3cd';
    ctx.beginPath();
    ctx.moveTo(-20, -2.5); ctx.quadraticCurveTo(-20 - f * 0.55, 0, -20, 2.5);
    ctx.closePath(); ctx.fill();
  }

  ctx.fillStyle = flash ? '#ffffff' : '#3f7ad6';
  ctx.beginPath();
  ctx.moveTo(-6, -2); ctx.lineTo(-18, -16); ctx.lineTo(-2, -8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, 2); ctx.lineTo(-18, 15); ctx.lineTo(-2, 8);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.fillStyle = flash ? '#ffffff' : '#e9f1ff';
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.quadraticCurveTo(16, -13, -6, -12);
  ctx.quadraticCurveTo(-22, -11, -22, 0);
  ctx.quadraticCurveTo(-22, 11, -6, 12);
  ctx.quadraticCurveTo(16, 13, 24, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.quadraticCurveTo(16, -13, -6, -12);
  ctx.quadraticCurveTo(-22, -11, -22, 0);
  ctx.quadraticCurveTo(-22, 11, -6, 12);
  ctx.quadraticCurveTo(16, 13, 24, 0);
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = flash ? '#dddddd' : '#22c8f5';
  ctx.fillRect(-24, 2, 52, 14);
  ctx.restore();

  ctx.fillStyle = 'rgba(120,220,255,.85)';
  ctx.beginPath(); ctx.ellipse(4, -6, 12, 8, 0, Math.PI, TAU); ctx.fill(); ctx.stroke();
  if (pilot) {
    ctx.fillStyle = '#22c8f5';
    ctx.beginPath(); ctx.arc(3, -7, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b2340';
    roundRect(ctx, 3, -9, 6, 3.5, 1.8); ctx.fill();
  }
  Gfx.gloss(ctx, -6, -9, 12, 3.5, 0.7);

  ctx.fillStyle = '#ffc247';
  roundRect(ctx, 14, -9, 12, 5, 2.5); ctx.fill(); ctx.stroke();
  roundRect(ctx, 14, 4, 12, 5, 2.5); ctx.fill(); ctx.stroke();
  ctx.restore();
}

class Ship {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 46; this.h = 28;
    this.t = Math.random() * 5; this.dead = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) { this.t += dt; }
  draw(ctx, camX, camY) {
    const bob = Math.sin(this.t * 2.2) * 6;
    const x = this.cx - camX, y = this.cy - camY + bob;
    Gfx.shadow(ctx, x, this.y - camY + this.h + 26, 54, 0.22);
    Gfx.light(ctx, x, y, 66 + Math.sin(this.t * 3) * 6, '#8ff0ff', 0.45);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(this.t * 1.6) * 0.06);
    drawShipBody(ctx, this.t, 1, 0.2, false, false);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.7 + Math.sin(this.t * 4) * 0.3;
    ctx.textAlign = 'center';
    ctx.font = '800 11px Nunito, system-ui, sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(26,18,52,.6)'; ctx.lineJoin = 'round';
    ctx.strokeText('SALI!', x, y - 26);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SALI!', x, y - 26);
    ctx.restore();
  }
}

/* ---------- nucleo VOLT: da raccogliere nella missione SOVRACCARICO ---------- */
class Core {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 26; this.h = 26;
    this.t = Math.random() * 5; this.dead = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) { this.t += dt; }
  draw(ctx, camX, camY) {
    const bob = Math.sin(this.t * 2.6) * 5;
    const x = this.cx - camX, y = this.cy - camY + bob;
    Gfx.light(ctx, x, y, 52 + Math.sin(this.t * 5) * 6, '#66ffe0', 0.6);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.t * 1.1);
    ctx.fillStyle = '#66ffe0';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, r = i % 2 ? 8 : 14;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 5 + Math.sin(this.t * 7) * 1.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

/* ---------- generatore: bersaglio della missione BERSAGLI ---------- */
class Generator {
  constructor(x, y, level) {
    this.x = x; this.y = y; this.w = 34; this.h = 44;
    this.maxHp = 10 + level * 2; this.hp = this.maxHp;
    this.t = Math.random() * 4; this.flash = 0; this.dead = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(dt) { this.t += dt; this.flash = Math.max(0, this.flash - dt); }
  hurt(dmg, fromX) {
    if (this.dead) return;
    this.hp -= dmg; this.flash = 0.09;
    Particles.spark(this.cx, this.cy, sign(this.cx - fromX) * 90, -60, '#ffc247');
    Sfx.hitEnemy();
    if (this.hp <= 0) this.die();
  }
  die() {
    if (this.dead) return;
    this.dead = true;
    Particles.burst(this.cx, this.cy, 50, '#ffc247', 380, 6, 260);
    Particles.burst(this.cx, this.cy, 20, '#ffffff', 240, 4, 200);
    Rings.add(this.cx, this.cy, '#ffd9a0', 130, 0.45, 7);
    Game.shake(16, 0.35);
    Sfx.bomb();
    Game.addScore(400);
    Floaters.add(this.cx, this.cy - 12, '+400', '#ffd166', 17);
  }
  draw(ctx, camX, camY) {
    if (this.dead) return;
    const x = this.cx - camX, y = this.y - camY;
    const col = this.flash > 0 ? '#ffffff' : '#ffc247';
    Gfx.shadow(ctx, x, y + this.h + 2, 46, 0.35);
    Gfx.light(ctx, x, y + 14, 46, '#ffc247', 0.35 + Math.sin(this.t * 4) * 0.12);
    ctx.save();
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
    /* basamento */
    ctx.fillStyle = '#3a4a86';
    roundRect(ctx, x - 19, y + this.h - 12, 38, 12, 5); ctx.fill(); ctx.stroke();
    /* colonna */
    ctx.fillStyle = '#e9f1ff';
    roundRect(ctx, x - 13, y + 6, 26, this.h - 16, 8); ctx.fill(); ctx.stroke();
    /* cuore energetico */
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y + 16, 9 + Math.sin(this.t * 6) * 1.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(x - 2.5, y + 13.5, 3.4, 0, TAU); ctx.fill();
    ctx.restore();
    /* barra vita */
    const bw = 40, bx = x - bw / 2, by = y - 10;
    ctx.save();
    ctx.fillStyle = 'rgba(26,18,52,.45)';
    roundRect(ctx, bx - 1, by - 1, bw + 2, 7, 3.5); ctx.fill();
    ctx.fillStyle = '#ffc247';
    roundRect(ctx, bx, by, bw * (this.hp / this.maxHp), 5, 2.5); ctx.fill();
    ctx.restore();
  }
}

/* ---------- droncino alleato (potenziamento leggendario) ---------- */
class Drone {
  constructor(x, y) {
    this.x = x; this.y = y; this.t = Math.random() * 4; this.cool = 0.4;
  }
  update(dt, player, enemies, bullets) {
    this.t += dt;
    /* sta dietro le spalle, ondeggiando */
    const tx = player.cx - player.facing * 34;
    const ty = player.cy - 34 + Math.sin(this.t * 2.4) * 6;
    this.x = lerp(this.x, tx, Math.min(1, dt * 5));
    this.y = lerp(this.y, ty, Math.min(1, dt * 5));

    this.cool -= dt;
    if (this.cool > 0) return;
    let best = null, bd = 470 * 470;
    for (const e of enemies) {
      if (e.dead || !e.awake) continue;
      const d = dist2(this.x, this.y, e.cx, e.cy);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    this.cool = 0.62 - Math.min(0.2, Game.perkLevel('drone') * 0.1);
    const a = Math.atan2(best.cy - this.y, best.cx - this.x);
    bullets.push(new Bullet(this.x, this.y, Math.cos(a) * 820, Math.sin(a) * 820,
      { dmg: 1 + Game.perkLevel('power'), r: 3.6, col: '#c98ff7', life: 1.1,
        freeze: Game.hasPerk('freeze') }));
    Sfx.tone(900, 0.05, 'square', 0.03, 500);
  }
  draw(ctx, camX, camY) {
    const x = this.x - camX, y = this.y - camY;
    Gfx.light(ctx, x, y, 30, '#c98ff7', 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(this.t * 3) * 0.2);
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = '#e6d4ff';
    roundRect(ctx, -9, -7, 18, 14, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c98ff7';
    roundRect(ctx, -11, -1, 22, 5, 2.5); ctx.fill();
    Gfx.eye(ctx, 0, -1, 4.5, Game.player ? Game.player.facing : 1, 0);
    ctx.restore();
  }
}

/* ---------- ritratto rotante per la scelta del personaggio ----------
   Alla maniera dei vecchi arcade: il custode gira sul piedistallo e lo si
   vede di fronte, di profilo e di schiena. */
function drawHeroPose(ctx, H, ang, t, scale) {
  const sx = Math.sin(ang);            /* quanto siamo di profilo: -1..1 */
  const front = Math.cos(ang) > 0;     /* davanti o dietro */
  const side = Math.abs(sx) > 0.7071;  /* si cambia vista a 45° */
  const bob = Math.sin(t * 2.2) * 2;

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(0, bob);
  ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';

  /* sciarpa o coda, dietro al corpo */
  const trailBack = side ? 1 : (front ? 0 : 1);
  if (trailBack) {
    ctx.save();
    ctx.strokeStyle = H.trail; ctx.lineWidth = H.ponytail ? 8 : 7; ctx.lineCap = 'round';
    ctx.beginPath();
    const dir = side ? -Math.sign(sx) : 0;
    ctx.moveTo(dir * 4, -14);
    ctx.quadraticCurveTo(dir * 16 + Math.sin(t * 3) * 3, -6, dir * 20 + Math.sin(t * 4) * 4, 4);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.scale(side ? Math.abs(sx) : Math.abs(Math.cos(ang)), 1);

  /* gambe */
  Gfx.capsule(ctx, -9, 8, 8, 13, H.legs, OUTLINE, 3);
  Gfx.capsule(ctx, 1, 8, 8, 13, H.legs, OUTLINE, 3);

  /* corpo */
  Gfx.capsule(ctx, -12, -14, 24, 26, H.body, OUTLINE, 3);
  ctx.save();
  roundRect(ctx, -12, -14, 24, 26, 10); ctx.clip();
  ctx.fillStyle = H.trim;
  roundRect(ctx, -12, -1, 24, 14, 6); ctx.fill();
  ctx.restore();
  Gfx.gloss(ctx, -8, -11, 10, 4, 0.7);

  /* braccia */
  if (!side) {
    Gfx.capsule(ctx, -18, -9, 7, 16, H.body, OUTLINE, 2.5);
    Gfx.capsule(ctx, 11, -9, 7, 16, H.body, OUTLINE, 2.5);
  }

  /* testa */
  ctx.save();
  ctx.translate(0, -18);
  if (H.ponytail) {
    ctx.fillStyle = H.trail;
    ctx.beginPath(); ctx.arc(0, -2, 12, Math.PI, TAU); ctx.fill(); ctx.stroke();
    if (front) {
      ctx.fillStyle = H.hair2 || '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-3, -11); ctx.quadraticCurveTo(-10, -6, -7, 0);
      ctx.quadraticCurveTo(-5, -6, -1, -9); ctx.closePath(); ctx.fill();
    }
  }
  Gfx.capsule(ctx, -11, -10, 22, 20, H.trim, OUTLINE, 3);
  if (front) {
    ctx.fillStyle = '#1b2340';
    roundRect(ctx, -8, -5, 16, 9, 4.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    roundRect(ctx, -5.5, -3.5, 5, 3, 1.5); ctx.fill();
  } else if (side) {
    ctx.fillStyle = '#1b2340';
    roundRect(ctx, Math.sign(sx) >= 0 ? -1 : -7, -5, 8, 8, 4); ctx.fill();
  } else {
    /* di schiena: solo il casco, con la presa d'aria */
    ctx.fillStyle = 'rgba(20,14,45,.25)';
    roundRect(ctx, -6, -4, 12, 6, 3); ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  /* arma: si vede solo se non è di schiena */
  if (front || side) {
    ctx.save();
    const armX = side ? Math.sign(sx) * 14 : 15;
    ctx.translate(armX, -2);
    ctx.scale(side ? Math.sign(sx) : 1, 1);
    if (H.glove) {
      Gfx.capsule(ctx, -4, -6, 12, 13, H.trim, OUTLINE, 2.5);
      ctx.globalAlpha = 0.6 + Math.sin(t * 7) * 0.25;
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(3, 0, 6, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(3, 0, 2.6, 0, TAU); ctx.fill();
    } else {
      Gfx.capsule(ctx, -6, -6, 16, 12, '#ffc247', OUTLINE, 2.5);
      ctx.fillStyle = '#ff8a3d';
      roundRect(ctx, 6, -3.5, 8, 7, 3); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
