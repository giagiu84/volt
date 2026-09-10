/* VOLT — generazione procedurale dei settori (livelli infiniti) */
'use strict';

const TILE = 32;
const T_EMPTY = 0, T_SOLID = 1, T_PLAT = 2, T_SPIKE = 3, T_PAD = 4;

const OUTLINE = '#20183f';

/* Ogni mondo ha il suo fondale dipinto (`sfondo`) e il suo velo (`velo`): il
   velo e' quel poco di foschia che si stende sopra al dipinto perche' i
   personaggi disegnati in codice non ci si perdano dentro. Sui mondi chiari
   e' una foschia chiara — allontana il fondale invece di sporcarlo. I colori
   del terreno sono presi dai dipinti stessi e alzati di un gradino: si deve
   camminare su qualcosa che appartiene al quadro ma stacca da lui.
   `sky` e `hills` restano: se il file del fondale non arriva, il gioco
   ridisegna il cielo di sempre e non se ne accorge nessuno. */
const THEMES = [
  { name: 'PRATERIA CROMO', sfondo: 'prateria', velo: 'rgba(206,238,255,0.26)',
    sky: ['#8fe9ff', '#4f63d8'], hills: ['#7d8ae6', '#5f66cf', '#4243a6'],
    body: '#3d6a4d', body2: '#22412f', crust: '#7cb356', crust2: '#a8cf72',
    plat: '#ffc247', spike: '#ff6b6b', accent: '#ffe08a', fog: '#a8e6ff' },
  { name: 'DESERTO SOLARE', sfondo: 'deserto', velo: 'rgba(255,220,176,0.24)',
    sky: ['#ffd792', '#ff7d5c'], hills: ['#f2916d', '#d96f58', '#a54d47'],
    body: '#cf7238', body2: '#8a3d20', crust: '#f9a557', crust2: '#ffd39a',
    plat: '#6fe4f5', spike: '#6a45b8', accent: '#fff3cd', fog: '#ffd9a4' },
  { name: 'LAGUNA PROFONDA', sfondo: 'laguna', velo: 'rgba(198,244,255,0.26)',
    sky: ['#8ff4e6', '#1f7fdb'], hills: ['#46aecd', '#2f83b2', '#1e5c89'],
    body: '#2478a8', body2: '#0e4a70', crust: '#4fc6e8', crust2: '#b0eefb',
    plat: '#ffd166', spike: '#ff6b9d', accent: '#b6fff2', fog: '#a6f2ff' },
  { name: 'GIARDINO VIOLA', sfondo: 'giardino', velo: 'rgba(226,196,255,0.22)',
    sky: ['#fbb0ec', '#7a4bd8'], hills: ['#ac6fe4', '#8d52cc', '#61319f'],
    body: '#5c3390', body2: '#341a56', crust: '#b06ae0', crust2: '#e2a8ff',
    plat: '#a0ff8f', spike: '#ffd166', accent: '#ffdcff', fog: '#ecc0ff' },
  { name: 'GHIACCIAIO', sfondo: 'ghiacciaio', velo: 'rgba(232,246,255,0.28)',
    sky: ['#ecf9ff', '#5fb0e6'], hills: ['#a5d4f0', '#7fb8df', '#5e93c2'],
    body: '#8dbde8', body2: '#4a7cae', crust: '#dceeff', crust2: '#ffffff',
    plat: '#ffa06e', spike: '#ff6b9d', accent: '#ffffff', fog: '#e4f5ff' }
];

/* ---------- dentro la Frattura ----------
   Dal settore 21 al 35 non si e' ancora in Eclissia: si e' DENTRO la ferita.
   Non e' un mondo nuovo, e' il proprio fatto a pezzi — isole di Lumina
   strappate e sospese nel viola, con il vuoto sotto invece della terra. */
const FRATTURA_DA = 21, FRATTURA_A = 35;
/* Gli appuntamenti con ECHO-0. Nei primi tre si ferma, combatte, e appena
   rischia di perdere scappa; al terzo gli si strappa Ampere di mano.
   Il quarto e' diverso da tutti: al 35 non scappa. Cade. */
const ECHO_SETTORI = [24, 27, 30, 35];
const ECHO_FINALE = 35;
/* Dal 31 al 35 il gioco si rovescia: la lanterna e' tua e lui viene a
   riprendersela. In questi quattro settori ECHO-0 non ti aspetta alla fine —
   arriva mentre stai giocando, e non punta a te: punta ad AMPERE. */
const ECHO_CACCIA = [31, 32, 33, 34];

/* E i settori in mezzo, quelli dell'inseguimento: non combatte, si fa vedere.
   Una sagoma lontana su un'isola, che ti guarda e sparisce appena ti avvicini.
   Serve a togliere il vuoto fra uno scontro e l'altro: non stai attraversando
   settori a caso, stai seguendo qualcuno. */
const ECHO_OMBRE = [25, 26, 28, 29];

const THEME_FRATTURA = {
  name: 'LA FRATTURA', frattura: true, sfondo: 'frattura',
  velo: 'rgba(24,10,52,0.30)',
  sky: ['#5b2c9e', '#0d0620'],
  hills: ['#40276f', '#2c1a53', '#1a0f38'],
  /* Colori presi dal dipinto di riferimento e alzati di un gradino: il terreno
     su cui si cammina deve staccare dal fondale, ma appartenergli. */
  body: '#4a3a5c', body2: '#2c2038', crust: '#6f9153', crust2: '#9fc47a',
  plat: '#ffc247', spike: '#ff6b6b', accent: '#d9a6ff', fog: '#6a3fae'
};

/* ---------- ECLISSIA ----------
   Dal 36 al 55 non si e' piu' dentro la ferita: si e' dall'altra parte. Non e'
   un posto inventato — e' un mondo vero, con la sua terra e il suo cielo, solo
   **illuminato al contrario**: il sole c'e' ma e' un anello nero, la luce
   arriva radente e non scalda niente. I colori sono presi dal dipinto: indaco,
   prugna, e la roccia che ha perso il colore. */
const ECLISSIA_DA = 36, ECLISSIA_A = 55;

const THEME_ECLISSIA = {
  name: 'ECLISSIA', eclissia: true, sfondo: 'eclissia',
  velo: 'rgba(26,16,58,0.26)',
  sky: ['#3a2a6e', '#0a0818'],
  hills: ['#2e2452', '#221a3e', '#150f2a'],
  /* la roccia di Eclissia e' viola smorto, e sopra non cresce erba: cresce
     una vegetazione secca color prugna */
  body: '#3a3357', body2: '#221d38', crust: '#6b5a8e', crust2: '#9b83b8',
  plat: '#ffc247', spike: '#ff6b6b', accent: '#c0a6ff', fog: '#4a3a7a'
};

/* Il mondo è più alto di quanto serva al terreno: il margine sotto permette
   alla camera di tenere il giocatore alto sullo schermo, sopra i comandi touch. */
const LEVEL_H = 32;

/* Le missioni: ogni settore ne pesca una. I primi due sono sempre CACCIA,
   così si impara il gioco prima delle sorprese. */
const MISSIONS = {
  hunt:    { name: 'CACCIA',       hint: 'Elimina tutti i mostri' },
  survive: { name: 'SOPRAVVIVENZA', hint: 'Resisti fino alla fine' },
  cores:   { name: 'TRACCE DI LYRA', hint: 'Raccogli i frammenti che ha lasciato' },
  targets: { name: 'BERSAGLI',     hint: 'Distruggi i generatori' },
  assault: { name: 'ASSALTO',      hint: 'Respingi le ondate' },
  escape:  { name: 'FUGA',         hint: 'Corri al portale, la tempesta avanza' },
  boss:    { name: 'BOSS',         hint: 'Abbatti il boss' },
  echo:    { name: 'ECHO-0',       hint: 'Non lo puoi uccidere: puoi solo stancarlo' }
};

/* ---------- le leggi della Frattura ----------
   Nel Circuito Aperto il mondo non e' piu' stabile: ogni tre settori una regola
   cambia. Non sono contenuti nuovi da disegnare, sono le stesse cose viste
   sotto un'altra luce, ed e' quello che tiene in piedi una modalita' infinita
   senza farla diventare la stessa partita all'infinito. */
const LAWS = {
  lowgrav: { name: 'BASSA GRAVITÀ', hint: 'Salti lunghi, cadute lente', col: '#8fe9ff', grav: 0.5 },
  dark:    { name: 'BUIO',          hint: 'Vedi solo quello che si accende',  col: '#b06bff' },
  blink:   { name: 'PIATTAFORME INSTABILI', hint: 'Esistono solo mentre ti muovi', col: '#ffd166' },
  giants:  { name: 'GIGANTI',       hint: 'Pochi mostri, enormi',        col: '#ff8a3d' },
  echo:    { name: 'ECO',           hint: 'Ogni tuo colpo si sdoppia',   col: '#66ffe0' },
  storm:   { name: 'TEMPESTA',      hint: 'Il muro avanza: non fermarti', col: '#e79bff' },
  meteors: { name: 'PIOGGIA DI FUOCO', hint: 'Guarda anche in alto',     col: '#ff6b6b' }
};
const LAW_ORDER = ['lowgrav', 'dark', 'blink', 'giants', 'echo', 'storm', 'meteors'];

/* Il ciclo dura tre settori. I primi tre non hanno legge: servono a riprendere
   il ritmo. Poi le sette leggi escono tutte, mescolate: nello stesso giro non
   se ne ripete nessuna, e il giro dopo l'ordine cambia. Uguale per tutti. */
/* Non tutte le leggi vanno d'accordo con tutte le missioni: il muro di
   tempesta in un settore dove bisogna restare fermi o tornare indietro a
   raccogliere non e' difficile, e' impossibile. In quel caso si passa alla
   legge successiva del giro. */
const LAW_BAN = { storm: ['survive', 'assault', 'cores', 'targets', 'boss'] };

function lawFor(n, mode, missionType) {
  /* In Eclissia le leggi non sono un effetto speciale: sono il clima del posto.
     Ogni tre settori il mondo cambia regola, e il conto riparte dal 36 — i
     primi tre servono a prendere le misure, come nel Circuito Aperto. */
  const eclissia = mode === 'campaign' && n >= ECLISSIA_DA && n <= ECLISSIA_A;
  if (mode !== 'endless' && !eclissia) return null;   /* i primi 35 restano com'e' */
  const base = eclissia ? ECLISSIA_DA : 1;
  const cycle = Math.floor((n - base) / 3);
  if (cycle === 0) return null;
  const idx = cycle - 1;
  const giro = Math.floor(idx / LAW_ORDER.length);
  const rng = makeRng(0x517f + giro * 2654435761);
  const bag = LAW_ORDER.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
  }
  for (let k = 0; k < bag.length; k++) {
    const l = bag[(idx + k) % bag.length];
    const ban = LAW_BAN[l];
    if (!ban || ban.indexOf(missionType) < 0) return l;
  }
  return null;
}

/* Il nome della missione dei frammenti dipende da chi e' stato rapito: chi
   gioca Lyra insegue le tracce di Aren, non le proprie. */
function missionName(type) {
  const m = MISSIONS[type] || MISSIONS.hunt;
  if (type === 'cores' && typeof HEROES !== 'undefined')
    return 'TRACCE DI ' + ((HEROES[Game.hero] || HEROES.aren).other);
  return m.name;
}

function generateLevel(n) {
  const rng = makeRng(0x9e37 + n * 2654435761);
  const dentroLaFrattura = n >= FRATTURA_DA && n <= FRATTURA_A;
  const dentroEclissia = n >= ECLISSIA_DA && n <= ECLISSIA_A;
  /* Nei primi venti settori il ritmo e' il Comandante ogni cinque. Dentro la
     Frattura quel ritmo si spegne e ne subentra un altro, che e' quello di
     ECHO-0: appuntamento al 24, al 27 e al 30, inseguimento in mezzo. Due
     ritmi insieme non funzionano — un Comandante al 25, subito dopo lo
     scontro del 24, spezzerebbe la caccia invece di darle respiro. */
  const boss = (n % 5 === 0) && !dentroLaFrattura && !dentroEclissia;
  const scontroEcho = ECHO_SETTORI.indexOf(n) >= 0;
  const inseguimento = ECHO_OMBRE.indexOf(n) >= 0;
  const caccia = ECHO_CACCIA.indexOf(n) >= 0;
  const theme = dentroLaFrattura ? THEME_FRATTURA
              : dentroEclissia ? THEME_ECLISSIA
              : THEMES[Math.floor((n - 1) / 5) % THEMES.length];
  /* l'arena di ECHO-0 e' corta: lui si sposta in fretta, non serve spazio */
  const w = boss ? 58 : (scontroEcho ? 76 : Math.min(64 + n * 5, 190));
  const h = LEVEL_H;
  const tiles = new Uint8Array(w * h);
  const at = (x, y) => (y * w + x);
  const set = (x, y, v) => { if (x >= 0 && x < w && y >= 0 && y < h) tiles[at(x, y)] = v; };

  const spawns = [];
  const pickups = [];
  const groundY = new Int16Array(w).fill(-1);   // -1 = burrone

  /* --- terreno a segmenti --- */
  let x = 0;
  let gy = h - 9;                                // altezza del suolo corrente
  const minY = 8, maxY = h - 6;
  const difficulty = Math.min(1, (n - 1) / 22);

  const fillColumn = (cx, top) => {
    for (let y = top; y < h; y++) set(cx, y, T_SOLID);
    groundY[cx] = top;
  };
  /* nella Frattura il terreno non arriva in fondo: e' un frammento, e sotto
     c'e' il vuoto. Lo spessore si assottiglia ai bordi, cosi l'isola sembra
     strappata e non tagliata. */
  const fillFrammento = (cx, top, spessore) => {
    for (let y = top; y < Math.min(h, top + spessore); y++) set(cx, y, T_SOLID);
    groundY[cx] = top;
  };

  if (dentroLaFrattura) {
    gy = 16;
    for (; x < 9; x++) fillFrammento(x, gy, x < 2 ? 3 : 5);
    while (x < w - 12) {
      const seg = rndInt(rng, 6, 14);
      const sp = rndInt(rng, 4, 7);
      for (let i = 0; i < seg && x < w - 12; i++, x++) {
        const bordo = (i < 1 || i > seg - 2);
        fillFrammento(x, gy, bordo ? Math.max(2, sp - 3) : sp);
      }
      /* il vuoto fra un frammento e l'altro: mai piu' di cinque tile, cioe'
         sempre un salto solo — con il doppio salto resta comodo */
      const vuoto = rndInt(rng, 3, 5);
      for (let i = 0; i < vuoto && x < w - 12; i++, x++) groundY[x] = -1;
      gy = clamp(gy + rndInt(rng, -3, 3), 10, 21);
    }
    gy = clamp(gy, 10, 21);
    for (; x < w; x++) fillFrammento(x, gy, 6);
  } else {

  /* zona di partenza sempre piatta e sicura */
  for (; x < 9; x++) fillColumn(x, gy);

  while (x < w - 10) {
    const roll = rng();
    if (!boss && roll < 0.20 + difficulty * 0.12) {
      /* burrone da saltare (con eventuali spine sul fondo) */
      const gap = rndInt(rng, 2, 3 + Math.round(difficulty));   /* max 4 tile: sempre saltabile */
      for (let i = 0; i < gap && x < w - 10; i++, x++) {
        groundY[x] = -1;
        if (rng() < 0.5) set(x, h - 1, T_SPIKE);
      }
      /* isola di atterraggio */
      const seg = rndInt(rng, 4, 8);
      gy = clamp(gy + rndInt(rng, -2, 2), minY + 4, maxY);
      for (let i = 0; i < seg && x < w - 10; i++, x++) fillColumn(x, gy);
    } else if (!boss && roll < 0.42) {
      /* gradino / muretto */
      const step = rndInt(rng, -3, 3);
      gy = clamp(gy + step, minY + 3, maxY);
      const seg = rndInt(rng, 5, 11);
      for (let i = 0; i < seg && x < w - 10; i++, x++) fillColumn(x, gy);
    } else {
      /* pianura, con possibili spine in superficie */
      const seg = rndInt(rng, 7, 16);
      for (let i = 0; i < seg && x < w - 10; i++, x++) {
        fillColumn(x, gy);
        if (!boss && i > 1 && i < seg - 2 && rng() < 0.05 + difficulty * 0.05) set(x, gy - 1, T_SPIKE);
      }
    }
  }
  /* zona finale piatta col portale */
  gy = clamp(gy, minY + 3, maxY);
  for (; x < w; x++) fillColumn(x, gy);
  }

  /* trampolini VOLT: scorciatoie verticali che spezzano la sola corsa orizzontale */
  if (!boss && !dentroLaFrattura) {
    const padCount = 1 + Math.floor(Math.min(2, n / 6));
    let made = 0, tries = 0;
    while (made < padCount && tries++ < 40) {
      const px = rndInt(rng, 13, w - 13);
      const top = groundY[px];
      if (top < 3 || groundY[px - 1] !== top || groundY[px + 1] !== top) continue;
      if (tiles[at(px, top - 1)] !== T_EMPTY) continue;
      set(px, top - 1, T_PAD); made++;
    }
  }

  /* --- missione del settore --- */
  let mission;
  if (scontroEcho) mission = { type: 'echo' };
  else if (boss) mission = { type: 'boss' };
  else if (n <= 2) mission = { type: 'hunt' };
  else {
    const pool = ['hunt', 'survive', 'cores', 'targets', 'assault'];
    /* La fuga arriva quando si sa gia' correre — ma non nei settori della
       caccia: li' ECHO-0 arriva mentre giochi, e in una fuga o lo semini
       correndo o se lo mangia il muro di tempesta. Due inseguitori insieme
       non fanno il doppio della tensione, se la tolgono a vicenda. */
    if (n >= 4 && !caccia) pool.push('escape');
    /* la caccia resta la piu' frequente: e' l'identita' del gioco */
    const type = pick(rng, ['hunt'].concat(pool));
    mission = { type };
    if (type === 'survive') mission.time = 30 + Math.min(12, n) + Math.min(8, Math.max(0, n - 5));
    if (type === 'cores') mission.need = 3;
    if (type === 'targets') mission.need = 3;
    if (type === 'assault') { mission.waves = 3; mission.perWave = 3 + Math.floor(n / 4); }
  }

  /* posti dove appoggiare nuclei e generatori: terreno pieno e cielo libero */
  const spots = [];
  if (mission.type === 'cores' || mission.type === 'targets') {
    const wanted = mission.need;
    for (let t = 0; t < 400 && spots.length < wanted; t++) {
      const sx = rndInt(rng, 14, w - 8);
      const top = groundY[sx];
      if (top < 4 || tiles[at(sx, top - 1)] !== T_EMPTY) continue;
      if (spots.some(q => Math.abs(q.tx - sx) < 12)) continue;
      /* i nuclei in alto restano dentro un salto pieno: mai irraggiungibili */
      const high = mission.type === 'cores' && rng() < 0.4;
      spots.push({ tx: sx, x: sx * TILE + 6, y: (top - (high ? 4 : 1)) * TILE - 4 });
    }
  }
  mission.spots = spots;

  /* --- navicella: un settore su tre, dal terzo in poi --- */
  const ships = [];
  if (!boss && n >= 3 && n % 3 === 0) {
    for (let tryN = 0; tryN < 30 && ships.length === 0; tryN++) {
      const sx = rndInt(rng, Math.floor(w * 0.25), Math.floor(w * 0.7));
      const top = groundY[sx];
      if (top < 6) continue;
      const sy = clamp(top - rndInt(rng, 4, 6), minY, h - 6);
      if (tiles[at(sx, sy)] !== T_EMPTY || tiles[at(sx + 1, sy)] !== T_EMPTY) continue;
      ships.push({ x: sx * TILE, y: sy * TILE });
    }
  }

  /* --- piattaforme sospese --- */
  const platCount = boss ? 5 : Math.floor(w / (dentroLaFrattura || dentroEclissia ? 6 : 9));
  for (let i = 0; i < platCount; i++) {
    const px = rndInt(rng, 10, w - 12);
    const base = groundY[px] > 0 ? groundY[px] : h - 6;
    const py = clamp(base - rndInt(rng, 3, 7), minY, h - 4);
    const len = rndInt(rng, 3, 7);
    let ok = true;
    for (let k = 0; k < len; k++) if (tiles[at(px + k, py)] !== T_EMPTY) { ok = false; break; }
    if (!ok) continue;
    for (let k = 0; k < len && px + k < w; k++) set(px + k, py, T_PLAT);
    if (rng() < 0.55) pickups.push({ x: (px + len / 2) * TILE, y: (py - 1.2) * TILE });
  }

  /* Niente muri di tile ai lati: sarebbero colonne che salgono nel cielo.
     Il giocatore viene tenuto dentro dal clamp orizzontale, i mostri dai bordi del terreno. */
  /* niente soffitto: sopra c'e il cielo. Il giocatore viene fermato in alto dal clamp. */

  /* --- nemici --- */
  const types = ['crawler'];
  if (n >= 2) types.push('flyer');
  if (n >= 3) types.push('spitter');
  if (n >= 6) types.push('charger');
  if (n >= 8) types.push('bomber');

  /* Le apparizioni dell'inseguimento. Tre, ben distanziate. Vanno messe
     IN ALTO, non lontane: col telefono in piedi la vista e' larga poco piu' di
     dieci caselle, e una sagoma "in fondo alla valle" non ci starebbe mai
     dentro. In alto invece lo spazio c'e' — e guardare in su per vederlo e'
     esattamente l'effetto giusto. */
  const ombre = [];
  if (inseguimento) {
    for (const f of [0.30, 0.56, 0.82]) {
      const ox = Math.round(w * f);
      const gy3 = groundY[ox] > 0 ? groundY[ox] : 15;
      /* cinque-sei caselle sopra il suolo: piu' in alto finirebbe dietro al
         cruscotto, piu' in basso sembrerebbe un mostro qualunque */
      ombre.push({ x: ox * TILE, y: (Math.max(3, gy3 - 7 - Math.floor(rng() * 2))) * TILE,
                   k: 0, vita: 0, via: 0, fatta: false });
    }
  }

  if (scontroEcho) {
    /* lui sta in fondo, e la sua scorta e' poca: e' uno scontro, non un assedio */
    const ex = w - 18;
    spawns.push({ type: 'echo', x: ex * TILE, y: (Math.max(6, (groundY[ex] > 0 ? groundY[ex] : 16) - 7)) * TILE,
                  tier: ECHO_SETTORI.indexOf(n) + 1, finale: n === ECHO_FINALE });
    for (let i = 0; i < 4; i++) {
      const sx = rndInt(rng, 16, w - 24);
      const gy2 = groundY[sx];
      if (gy2 < 0) continue;
      spawns.push({ type: pick(rng, ['crawler', 'flyer', 'spitter']), x: sx * TILE, y: (gy2 - 2) * TILE });
    }
  } else if (boss) {
    spawns.push({ type: 'boss', x: (w - 16) * TILE, y: (groundY[w - 16] - 6) * TILE, tier: Math.ceil(n / 5) });
    const guards = (n >= 20 ? 4 : 2) + Math.floor(n / 5);   /* il Divoratore arriva con la scorta */
    for (let i = 0; i < guards; i++) {
      const sx = rndInt(rng, 16, w - 20);
      const sy = groundY[sx] > 0 ? groundY[sx] - 2 : h - 8;
      const gt = pick(rng, types);
      spawns.push({ type: gt, x: sx * TILE, y: sy * TILE, elite: eliteRoll(rng, n, gt) });
    }
  } else {
    /* dopo il quinto settore ne arrivano sempre di piu': fino a li' invariato */
    let count = Math.min(4 + Math.floor(n * 1.4 + Math.max(0, n - 5) * 0.6), 30);
    if (mission.type === 'cores' || mission.type === 'targets') count = Math.round(count * 0.6);
    if (mission.type === 'survive' || mission.type === 'assault') count = Math.round(count * 0.45);
    if (mission.type === 'escape') count = Math.round(count * 0.5);
    let attempts = 0;
    while (spawns.length < count && attempts < count * 30) {
      attempts++;
      const sx = rndInt(rng, 14, w - 8);
      if (groundY[sx] < 0) continue;
      const type = pick(rng, types);
      const sy = (type === 'flyer' || type === 'bomber')
        ? clamp(groundY[sx] - rndInt(rng, 4, 9), minY, h - 4)
        : groundY[sx] - 2;
      if (tiles[at(sx, sy)] !== T_EMPTY) continue;
      spawns.push({ type, x: sx * TILE, y: sy * TILE, elite: eliteRoll(rng, n, type) });
    }
  }

  /* --- extra pickup a terra --- */
  for (let i = 0; i < 2 + Math.floor(n / 4); i++) {
    const px = rndInt(rng, 12, w - 10);
    if (groundY[px] < 0) continue;
    pickups.push({ x: px * TILE, y: (groundY[px] - 1.4) * TILE });
  }

  /* --- sfondo: colline morbide su tre piani + nuvole --- */
  const hills = [];
  for (let layer = 0; layer < 3; layer++) {
    const n = 10 + layer * 4;
    for (let i = 0; i < n; i++) {
      hills.push({
        x: (i / n) * w * TILE + rndRange(rng, -90, 90),
        w: rndRange(rng, 240, 640) * (1 - layer * 0.14),
        h: rndRange(rng, 70, 190) * (0.75 + layer * 0.3),
        layer
      });
    }
  }
  hills.sort((a, b) => a.layer - b.layer);
  const motes = [];
  for (let i = 0; i < 26; i++)
    motes.push({ x: rng(), y: rng(), r: rndRange(rng, 1.5, 3.6), sp: rndRange(rng, 6, 22), ph: rng() * 6.3 });
  const clouds = [];
  for (let i = 0; i < 12; i++)
    clouds.push({ x: rng(), y: rndRange(rng, 0.04, 0.42), s: rndRange(rng, 0.55, 1.5), spd: rndRange(rng, 3, 11) });

  return {
    ombre,
    n, boss, theme, w, h, tiles, spawns, pickups, hills, clouds, motes, ships, mission,
    caccia,
    pxW: w * TILE, pxH: h * TILE,
    startX: 5 * TILE, startY: (groundY[5] - 2) * TILE,
    portalX: (w - 3) * TILE, portalY: (groundY[w - 3] - 2) * TILE,
    groundY,
    tileAt(tx, ty) {
      if (tx < 0 || tx >= this.w || ty < 0) return T_SOLID;
      if (ty >= this.h) return T_EMPTY;
      return this.tiles[ty * this.w + tx];
    },
    solidAt(px, py) {
      const t = this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE));
      return t === T_SOLID;
    }
  };
}
