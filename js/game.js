/* VOLT — loop di gioco, camera, regia, HUD */
'use strict';

const MINW = 580, MINH = 400, MAXSCALE = 2.8;
const LIFE_EVERY = 8000;      /* punti fra la prima vita e la seconda */
/* Ogni vita costa piu' della precedente. Senza questo, dal decimo settore in
   poi il punteggio corre cosi in fretta da regalare una vita ogni pochi
   secondi: si finiva la campagna senza mai rischiare davvero. */
const LIFE_GROW = 1.25;
const FIRST_LIFE_AT = 2500;   /* la prima arriva presto: serve nei settori d'apertura */
const ATTO1_FINE = 20;        /* il primo atto finisce col Divoratore */
const CAMPAIGN_END = 65;      /* la fine vera del gioco: la Caldera */
/* Fin dove arriva quello che e' costruito davvero. Si alza mano a mano che
   l'atto II viene programmato: oltre questo settore il gioco si ferma e lo
   dice, invece di far finta. */
const SETTORI_PRONTI = 34;
/* Dal 31 al 35 Ampere e' dei Custodi: gliel'hanno strappata a ECHO-0 e se la
   portano dietro, e va riempita di Corrente Verde. Al 35 gliela porta via
   ECHO-1, e da li' in poi la corrente si tiene addosso. */
const AMPERE_DA = 31, AMPERE_A = 35;
/* I poteri che ECHO-0 sa copiare: sono quelli che si vedono addosso a lui e
   sui suoi colpi. Rubarne uno che non si nota non servirebbe a niente. */
const RUBABILI = ['bounce', 'power', 'rapidfire', 'boom', 'jump3'];
/* I filmati che aprono un settore. Si aggiungono man mano che arrivano: se il
   file non c'e' ancora, il lettore tira dritto e il settore comincia lo stesso. */
/* I filmati si vedono PRIMA che il settore cominci. Quindi un filmato che
   racconta la fine di uno scontro va messo sul settore DOPO: `ampere_torna`
   e' quello che succede all'uscita dal 30, e si vede entrando nel 31. */
/* Un settore puo' averne anche piu' d'uno: certe scene sono divise in due e
   vanno viste di fila, senza stacco. In quel caso si scrive una lista. */
const FILMATI_SETTORE = {
  24: 'primo_incontro',
  31: 'ampere_torna',
  /* il tradimento e il passaggio sono una scena sola spezzata in due: si
     vedono di fila, senza stacco */
  36: ['il_tradimento', 'il_passaggio']
};
/* I filmati consegnati senza traccia audio. Su questi la musica del gioco NON
   si ferma: senza, sarebbero secondi di silenzio totale e sembrerebbe che il
   gioco si sia piantato. Adesso non ce n'e' piu' nessuno — `ampere_torna` e'
   stato riconsegnato con l'audio — ma la rete resta tesa: se un giorno ne
   arriva un altro muto, basta scriverne il nome qui. */
const FILMATI_MUTI = new Set();
const CHECKPOINTS = [5, 10, 15];
/* La semina del secondo atto: dal settore 15 la luce di Lumina comincia ad
   andarsene, e lo si vede prima che qualcuno lo dica. */
const SEMINA_DA = 15, SEMINA_A = 20;
const BLACK_TIME = 0.95;      /* quanto dura un calo di tensione */

/* la voce di Lyra fra un settore e l'altro: ricorda perché si corre */
const LYRA_LINES = [
  'Segnale di @ rilevato.',
  'La traccia attraversa il prossimo portale.',
  'Un frammento: è passato di qui.',
  'La frattura si allarga. Vai avanti.',
  'Un Comandante presidia il settore.',
  'Lumina è ancora spenta. Continua.'
];

/* I potenziamenti: si scelgono uno per settore e restano per tutta la partita.
   `max` limita quante volte si possono ripetere. */
const PERKS = [
  { id: 'bounce',  name: 'RIMBALZO',    ic: '⤡', col: '#7c8cff', max: 1,
    ds: 'I tuoi colpi rimbalzano una volta sulle pareti' },
  { id: 'jump3',   name: 'TRIPLO SALTO', ic: '⇧', col: '#22c8f5', max: 1,
    ds: 'Un salto in più a mezz\'aria' },
  { id: 'boom',    name: 'DASH ESPLOSIVO', ic: '✹', col: '#ff8a3d', max: 1,
    ds: 'Lo scatto danneggia i mostri che attraversi' },
  { id: 'freeze',  name: 'COLPI GELIDI', ic: '❄', col: '#5ed6ff', max: 2,
    ds: 'I colpi rallentano i mostri colpiti' },
  { id: 'shieldgen', name: 'SCUDO VIVO', ic: '◉', col: '#48d7ff', max: 2,
    ds: 'Uno scudo si rigenera ogni 18 secondi' },
  { id: 'rushlong', name: 'RUSH LUNGO', ic: '⚡', col: '#ffc247', max: 3,
    ds: 'Rush più lungo e carica più in fretta' },
  { id: 'hull',    name: 'NAVE CORAZZATA', ic: '▲', col: '#8ff0ff', max: 2,
    ds: 'La navicella regge più colpi e dura di più' },
  { id: 'power',   name: 'COLPI PESANTI', ic: '✦', col: '#ff5d8f', max: 3,
    ds: 'Più danno a ogni colpo' },
  { id: 'rapidfire', name: 'RAFFICA', ic: '»', col: '#5ee08a', max: 3,
    ds: 'Spari più veloce e scaldi di meno' },
  { id: 'heart',   name: 'CUORE IN PIÙ', ic: '♥', col: '#ff2f6e', max: 3,
    ds: 'Una vita massima in più, e ti cura' },
  { id: 'magnet',  name: 'CALAMITA', ic: '◎', col: '#c98ff7', max: 1,
    ds: 'Gli oggetti volano verso di te' },
  { id: 'luck',    name: 'FORTUNA', ic: '★', col: '#ffd166', max: 2,
    ds: 'I mostri lasciano molti più oggetti' }
];

/* leggendari: si scelgono solo dopo aver abbattuto un Comandante */
const LEGENDS = [
  { id: 'drone',   name: 'DRONCINO', ic: '◆', col: '#a06bff', max: 2, leg: true,
    ds: 'Un alleato ti segue e spara da solo' },
  { id: 'vampire', name: 'VAMPIRO ELETTRICO', ic: '⚡', col: '#ff5d8f', max: 1, leg: true,
    ds: 'Ogni uccisione ridà molta più carica VOLT' },
  { id: 'emergency', name: 'SCUDO D\'EMERGENZA', ic: '◈', col: '#48d7ff', max: 1, leg: true,
    ds: 'Inizi ogni settore con uno scudo' },
  { id: 'afterburn', name: 'BRACE', ic: '✷', col: '#ff8a3d', max: 1, leg: true,
    ds: 'Finito il Rush resti carico a metà' },
  { id: 'arsenal', name: 'ARSENALE', ic: '⁂', col: '#ffc247', max: 1, leg: true,
    ds: 'Ogni settore inizia con un\'arma speciale' }
];

const Game = {
  canvas: null, ctx: null,
  cssW: 0, cssH: 0, dpr: 1, scale: 1, viewW: 0, viewH: 0,
  state: 'menu',
  lv: null, player: null,
  enemies: [], bullets: [], pickups: [], explosions: [], ships: [], cores: [], gens: [],
  mission: null, missionT: 0, wave: 0, waveCool: 0, spawnCool: 0, missionDone: false,
  perks: {}, pendingLevel: 0, shieldGenT: 0, drone: null,
  mode: 'campaign', progress: Store.get('volt_progress', { cleared: false, cp: null }),
  law: null, lawDef: null, platsOff: false, platT: 0, meteorT: 0, stormOn: false,
  ampere: null, cariche: [], cella: null, vign: [], cacciaT: 0, cacciaMax: 0,
  furto: null, blackT: 0, blackNext: 0,
  canSwap: false, swapCd: 0,
  rubato: null, echiVia: false,
  hero: Store.get('volt_hero', 'aren'),
  stormX: -9999,
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
    HeroArt.load();
    HeroSpin.load();
    Input.init(this.canvas);
    this.resize();
    addEventListener('resize', () => this.resize());
    /* se si cambia scheda o si perde il focus a metà partita, si mette in pausa da solo */
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.setPause(true); });
    addEventListener('blur', () => this.setPause(true));
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));

    /* Scorciatoie per provare: ?settore=N parte da quel settore con una
       dotazione plausibile, ?vinci=1 porta dritti alla fine del primo atto,
       ?filmato=nome fa vedere un filmato senza doverci arrivare giocando —
       serve a rivedere una scena appena montata, anche di un settore che
       ancora non esiste. Non toccano il salvataggio e non si vedono se non le
       si scrive. */
    try {
      const q = new URLSearchParams(location.search);
      const n = parseInt(q.get('settore') || '', 10);
      if (n >= 1 && n <= SETTORI_PRONTI) this.prova = { settore: n };
      if (q.get('vinci') === '1') this.prova = { settore: ATTO1_FINE, vinci: true };
      const film = q.get('filmato');
      if (film) this.provaFilm = film.split(',').filter(Boolean);
    } catch (e) { /* niente parametri: si gioca normale */ }

    /* L'introduzione la si vede una volta sola, la prima. Prima di lei c'e'
       una schermata col titolo: serve al racconto, ma serve anche al browser —
       senza un tocco del giocatore l'audio resta muto, e un filmato muto qui
       sarebbe uno spreco. */
    document.getElementById('introBtn').onclick = () => this.guardaIntro();
    document.getElementById('introRiBtn').onclick = () => this.guardaIntro();
    /* ?intro=1 la rimette come la vede chi apre il gioco per la prima volta:
       serve per provarla e per farla vedere a qualcuno */
    let primaVolta = !Store.get('volt_intro', 0);
    try { if (new URLSearchParams(location.search).get('intro') === '1') primaVolta = true; } catch (e) {}
    /* la sala di proiezione ha la precedenza su tutto: si e' venuti per vedere
       un filmato, non per giocare. Il pulsante del titolo lo fa partire —
       serve un tocco, se no il browser non lascia partire l'audio. */
    if (this.provaFilm) {
      primaVolta = false;
      document.getElementById('titolo').classList.remove('hidden');
      document.getElementById('menu').classList.add('hidden');
      const b = document.getElementById('introBtn');
      b.querySelector('span').textContent = 'GUARDA IL FILMATO';
      b.onclick = () => this.guardaFilmati(this.provaFilm);
    }
    if (primaVolta && !this.prova) {
      document.getElementById('titolo').classList.remove('hidden');
      document.getElementById('menu').classList.add('hidden');
      /* intanto se lo scarica, cosi al tocco parte subito */
      fetch('assets/video/introduzione.mp4?v=' + (window.VOLT_VERSION || 0)).catch(() => {});
    }

    document.getElementById('bestScore').textContent = this.best;
    const mute = document.getElementById('muteBtn');
    mute.textContent = 'AUDIO: ' + (Sfx.enabled ? 'ON' : 'OFF');
    mute.onclick = (e) => {
      e.stopPropagation();
      Sfx.init(); Sfx.resume();
      Sfx.setEnabled(!Sfx.enabled);
      mute.textContent = 'AUDIO: ' + (Sfx.enabled ? 'ON' : 'OFF');
    };

    /* La prima volta, fra la scelta e la partita, si spiega come si gioca:
       nel menu quello spazio non c'e', e in orizzontale meno che mai. */
    document.getElementById('playBtn').onclick = () => this.primaIComandi(() => this.start(true, 'campaign', false));
    document.getElementById('comandiBtn').onclick = () => this.mostraComandi(null);
    document.getElementById('viaBtn').onclick = () => {
      document.getElementById('comandi').classList.add('hidden');
      try { Store.set('volt_comandi', 1); } catch (e) {}
      const poi = this._dopoComandi; this._dopoComandi = null;
      if (poi) poi(); else document.getElementById('menu').classList.remove('hidden');
    };
    document.getElementById('resumeRunBtn').onclick = () => this.start(true, 'campaign', true);
    document.getElementById('endlessBtn').onclick = () => {
      if (!this.progress.cleared) { this.banner('PRIMA RITROVA LYRA'); return; }
      this.start(true, 'endless', false);
    };
    document.getElementById('winContinueBtn').onclick = () => this.continuaAttoII();
    document.getElementById('winEndlessBtn').onclick = () => this.start(true, 'endless', false);
    document.getElementById('winMenuBtn').onclick = () => this.toMenu();
    document.getElementById('ovResumeBtn').onclick = () => this.start(true, 'campaign', true);
    for (const b of document.querySelectorAll('.hero-btn')) {
      b.onclick = () => {
        this.hero = b.dataset.hero;
        Store.set('volt_hero', this.hero);
        this.refreshMenu();
        Sfx.init(); Sfx.resume(); Sfx.pickup();
      };
    }
    this.refreshMenu();
    document.getElementById('retryBtn').onclick = () => this.start(true);
    document.getElementById('resumeBtn').onclick = () => this.setPause(false);
    document.getElementById('pauseBtn').onclick = () => this.setPause(this.state === 'play');
    document.getElementById('quitBtn').onclick = () => this.toMenu();
    document.getElementById('menuBtn').onclick = () => this.toMenu();
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (this.state === 'choice' && (k === '1' || k === '2' || k === '3')) {
        this.takePerk(Number(k) - 1);
        return;
      }
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

  /* Schermo intero e telefono coricato. Va chiesto DENTRO il tocco del
     giocatore, altrimenti il browser dice di no: per questo sta in una
     funzione a parte, chiamata da ogni pulsante che apre qualcosa a schermo
     pieno — il GIOCA e il TOCCA PER COMINCIARE dell'introduzione. */
  schermoIntero() {
    if (!(Input.touchMode || matchMedia('(pointer:coarse)').matches)) return;
    try {
      const el = document.documentElement;
      const rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (rq && !document.fullscreenElement) { const r = rq.call(el); if (r && r.catch) r.catch(() => {}); }
      if (screen.orientation && screen.orientation.lock) {
        const r2 = screen.orientation.lock('landscape');
        if (r2 && r2.catch) r2.catch(() => {});
      }
    } catch (e) { /* niente schermo intero: pazienza */ }
  },

  start(fromClick, mode, fromCheckpoint) {
    if (fromClick) this.schermoIntero();
    Sfx.init(); Sfx.resume(); Sfx.startMusic();
    this.mode = mode || this.mode || 'campaign';
    this.level = 1; this.score = 0; this.kills = 0; this.eliteSeen = {};
    /* Ampere esiste solo oltre la Frattura: la Corrente Verde e' sparsa di la' */
    this.ampere = null; this.cariche.length = 0;
    /* oltre la Frattura i due custodi sono insieme e ci si passa da uno all'altra */
    this.swapCd = 0;
    this.heroStart = this.hero;
    this.combo = 0; this.comboT = 0; this.maxCombo = 0;
    this.volt = 0; this.rushT = 0; this.hitStop = 0;
    this.hasShip = false;
    this.perks = {}; this.shieldGenT = 0; this.drone = null;
    this._winCinema = false;
    this.nextLifeAt = FIRST_LIFE_AT; this.lifeStep = LIFE_EVERY;
    if (this.player) this.player.riding = false;
    this.onShipChange();
    this.loadLevel(1, true);

    /* prova: si salta dove serve, con una dotazione da fine campagna */
    if (this.prova && this.mode === 'campaign' && !fromCheckpoint) {
      const scelti = ['power', 'rapidfire', 'hull', 'bounce', 'jump3', 'heart',
                      'magnet', 'luck', 'boom', 'shieldgen'];
      for (const k of scelti) this.perks[k] = 2;
      this.level = this.prova.settore;
      this.loadLevel(this.level, true);
      this.player.maxHp = 6; this.player.hp = 6;
      this.score = 42000;
      this.canSwap = this.mode === 'endless' || this.level >= FRATTURA_DA;
      if (this.prova.vinci) {
        /* la fine del primo atto, subito: filmato, vittoria, CONTINUA */
        setTimeout(() => { if (this.state === 'play') this.winCampaign(); }, 300);
      }
    }

    /* ripresa dopo un comandante: si torna con i poteri conquistati */
    const cp = this.progress.cp;
    if (fromCheckpoint && cp && this.mode === 'campaign') {
      this.perks = Object.assign({}, cp.perks || {});
      this.level = cp.level;
      this.loadLevel(this.level, true);
      this.player.maxHp = cp.maxHp || 4;
      this.player.hp = this.player.maxHp;
      this.score = cp.score || 0;
      if (this.hasPerk('drone')) this.drone = new Drone(this.player.cx, this.player.cy - 30);
    }
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('over').classList.add('hidden');
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('win').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.state = 'play';

    /* la notte in cui Lumina si spense: solo all'inizio di una campagna nuova */
    if (this.mode === 'campaign' && !fromCheckpoint && !this.prova) {
      const rapito = HEROES[this.hero].other.toLowerCase();
      this.state = 'cinema';
      document.getElementById('hud').classList.add('hidden');
      this.playCinema('rapimento_' + rapito, () => {
        document.getElementById('hud').classList.remove('hidden');
        this.state = 'play';
        this.banner(MISSIONS[this.mission.type].name);
      });
    }
  },

  /* ---- filmati ----
     Si riproducono se il file c'è; se manca, o se il browser non ne vuole
     sapere, si prosegue subito: il gioco non deve mai restare fermo ad
     aspettare un video. */
  /* Una lista di filmati, uno dopo l'altro, e alla fine di tutti si prosegue.
     Serve per le scene spezzate in due, che vanno viste senza stacco. */
  playCinemaSerie(nomi, poi) {
    const lista = Array.isArray(nomi) ? nomi.slice() : [nomi];
    const avanti = () => {
      if (!lista.length) { poi(); return; }
      this.playCinema(lista.shift(), avanti);
    };
    avanti();
  },

  playCinema(nome, poi) {
    const box = document.getElementById('cinema');
    const vid = document.getElementById('cinemaVideo');
    const skip = document.getElementById('cinemaSkip');
    if (!box || !vid) { poi(); return; }
    const muto = FILMATI_MUTI.has(nome);

    let chiuso = false;
    const chiudi = () => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(guardia); clearTimeout(limite);
      try { vid.pause(); } catch (e) {}
      vid.removeAttribute('src'); vid.load();
      box.classList.add('hidden');
      skip.onclick = null;
      Sfx.resume(); if (!muto) Sfx.startMusic();
      poi();
    };

    /* se il video non sta davvero andando, si tira dritto: un filmato che
       manca non deve far aspettare nessuno */
    const guardia = setTimeout(() => {
      if (!vid.duration || vid.paused || vid.readyState < 2) chiudi();
    }, 1200);
    /* e in nessun caso si resta fermi: nessun filmato dura piu' di venti secondi */
    const limite = setTimeout(chiudi, 20000);

    vid.onended = chiudi;
    vid.onerror = chiudi;
    vid.onstalled = () => { if (vid.readyState < 2) chiudi(); };
    vid.currentTime = 0;
    skip.onclick = chiudi;
    box.classList.remove('hidden');
    document.getElementById('banner').classList.add('hidden');
    this.bannerT = 0;
    if (!muto) Sfx.stopMusic();
    /* anche i filmati vogliono il numero di versione: senza, un telefono che
       ha in cache quello vecchio continua a mostrarlo */
    vid.src = 'assets/video/' + nome + '.mp4?v=' + (window.VOLT_VERSION || 0);
    const p = vid.play();
    if (p && p.catch) p.catch(() => {
      /* se l'audio è bloccato, riprovo muto: meglio muto che niente */
      vid.muted = true;
      const p2 = vid.play();
      if (p2 && p2.catch) p2.catch(chiudi);
    });
  },

  /* La legenda dei comandi: si vede una volta sola prima della prima partita,
     e poi quando la si chiede dal menu. */
  mostraComandi(poi) {
    this._dopoComandi = poi;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('comandi').classList.remove('hidden');
  },
  primaIComandi(poi) {
    this.schermoIntero();
    if (Store.get('volt_comandi', 0) || this.prova) { poi(); return; }
    this.mostraComandi(poi);
  },

  /* L'introduzione: la centrale di Lumina, i due di turno, e il cielo che si
     spacca. Finisce esattamente dove comincia il rapimento. */
  /* Fa vedere uno o piu' filmati di fila e poi torna al menu. E' la sala di
     proiezione: si arriva con ?filmato=nome, o ?filmato=uno,due per una coppia. */
  guardaFilmati(nomi) {
    this.schermoIntero();
    Sfx.init(); Sfx.resume();
    document.getElementById('titolo').classList.add('hidden');
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    this.state = 'cinema';
    this.playCinemaSerie(nomi, () => { this.provaFilm = null; this.toMenu(); });
  },

  guardaIntro() {
    this.schermoIntero();
    Sfx.init(); Sfx.resume();
    document.getElementById('titolo').classList.add('hidden');
    document.getElementById('menu').classList.add('hidden');
    this.state = 'cinema';
    this.playCinema('introduzione', () => {
      try { Store.set('volt_intro', 1); } catch (e) { /* storage bloccato: pazienza */ }
      this.toMenu();
    });
  },

  /* ECHO-0 comincia lo scontro: ti guarda, e ti porta via qualcosa. */
  echoEntra(e) {
    this.rubato = this.rubaPotere();
    e.state = 0; e.stateT = 1.9; e.awake = true;
    this._echo = e;
    Sfx.boss();
    /* La battuta arriva DOPO l'avviso della missione, se no se lo mangia: le
       tre cose in fila sono il nome, la regola dello scontro, e poi lui che
       parla. */
    setTimeout(() => {
      if (this.state !== 'play' || !this.player) return;
      this.banner(this.rubato ? 'HO OSSERVATO OGNI TUA SCELTA'
                              : 'NON HAI NIENTE CHE MI SERVA', 'voce', this._echo);
    }, 3200);
    if (this.rubato) setTimeout(() => {
      if (this.state !== 'play' || !this.player) return;
      Floaters.add(this.player.cx, this.player.y - 26, '−' + this.nomeRubato(), this.coloreRubato(), 17);
      Sfx.tone(180, 0.3, 'sawtooth', 0.06, 900);
    }, 1900);
  },

  /* Ci e' arrivato. Non ti toglie vite: ti toglie la corrente che hai
     raccolto, ed e' peggio — quella l'hai guadagnata tu, un pezzo alla volta. */
  echoRubaCorrente(e, amp) {
    const preso = Math.min(amp.charge, 22);
    amp.charge = Math.max(0, amp.charge - preso);
    amp.alarm = 1;
    /* la lanterna viene sbalzata via, e ci mette un attimo a tornare */
    amp.x += (amp.x - e.cx) * 0.8;
    amp.y -= 26;
    Rings.add(amp.x, amp.y, '#ff8a3d', 150, 0.5, 7);
    Particles.burst(amp.x, amp.y, 22, '#5effa8', 260, 5, 40);
    Floaters.add(amp.x, amp.y - 26, preso > 0 ? '−' + Math.round(preso) + ' CORRENTE' : 'È VUOTA',
                 '#ff8a3d', 15);
    this.shake(16, 0.3);
    Sfx.tone(150, 0.3, 'sawtooth', 0.06, 900);
  },

  /* Sotto un quarto di vita smette di combattere: non lo hai ucciso, lo hai
     stancato. E si porta via l'unica cosa che gli importa.
     Al terzo appuntamento pero' la fuga non gli riesce: e' li' che gli si
     strappa Ampere di mano, ed e' la fine della caccia. */
  echoInFuga(e) {
    /* nei settori della caccia non c'e' un ultimo scontro: se ne va e basta,
       e lo ritrovi nel settore dopo */
    if (e.caccia) {
      this.banner('TORNERÒ', 'voce', e);
      Rings.add(e.cx + 60, e.cy, '#b06bff', 200, 0.8, 8);
      Sfx.tone(140, 0.5, 'sawtooth', 0.07, 1200);
      return;
    }
    const ultimo = e.tier >= 3;
    this.banner(ultimo ? 'STAVOLTA NO' : 'CI VEDIAMO PIÙ AVANTI', 'voce', e);
    Rings.add(e.cx + 60, e.cy, ultimo ? '#5effa8' : '#b06bff', 200, 0.8, 8);
    Sfx.tone(ultimo ? 220 : 140, 0.5, 'sawtooth', 0.07, 1200);
  },

  echoVia(e) {
    e.dead = true;
    this.echiVia = true;
    this.addScore(e.score);
    if (e.caccia) {
      /* non aveva rubato poteri: era venuto per la lanterna */
      Particles.burst(e.cx, e.cy, 46, '#b06bff', 340, 6, 0);
      Rings.add(e.cx, e.cy, '#ffffff', 150, 0.5, 7);
      Sfx.kill();
      return;
    }
    Particles.burst(e.cx, e.cy, 46, '#b06bff', 340, 6, 0);
    Rings.add(e.cx, e.cy, '#ffffff', 150, 0.5, 7);
    const ultimo = e.tier >= 3;
    if (this.rubato) {
      const nome = this.nomeRubato(), col = this.coloreRubato();
      this.rubato = null;
      if (this.player) Floaters.add(this.player.cx, this.player.y - 26, '+' + nome, col, 17);
      /* al terzo scontro non te lo restituisce: glielo riprendi */
      this.banner((ultimo ? 'TI SEI RIPRESO ' : 'TI HA RESTITUITO ') + nome);
    }
    /* E con lui torna la lanterna. Nella campagna Ampere non e' ancora un
       oggetto che si porta in mano, ma il momento va detto: e' il perno di
       tutto l'atto II, e un attimo dopo lo racconta il filmato. */
    if (ultimo) {
      Rings.add(e.cx, e.cy, '#5effa8', 260, 0.9, 9);
      Particles.burst(e.cx, e.cy, 40, '#5effa8', 300, 6, -40);
      this.flashT = 0.5;
      if (this.player) setTimeout(() => {
        if (this.state !== 'play' || !this.player) return;
        Floaters.add(this.player.cx, this.player.y - 46, 'AMPERE È TORNATA', '#5effa8', 17);
      }, 700);
    }
    Sfx.kill();
  },

  /* Il ponte fra i due atti: si e' vinto, ma la luce se ne sta andando.
     Il filmato lo dice senza parole; se manca, si tira dritto. */
  continuaAttoII() {
    document.getElementById('win').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    this.state = 'cinema';
    this.playCinema('la_luce_se_ne_va', () => {
      this._winCinema = false;
      this.level = FRATTURA_DA;
      this.loadLevel(FRATTURA_DA);
      document.getElementById('hud').classList.remove('hidden');
      this.state = 'play';
      this.refreshActionButtons();
      this.banner('OLTRE LA FRATTURA');
    });
  },

  /* Il confine di quello che e' costruito. Meglio dirlo che far finta: si
     chiude il tratto, si sblocca il Circuito Aperto e si torna quando ci sara'
     il resto. */
  fineAnteprima() {
    this.state = 'win';
    Sfx.stopMusic();
    this.progress.cleared = true;
    this.progress.cp = null;
    this.saveProgress();
    document.getElementById('winTitle').textContent = 'FINE DI QUESTO TRATTO';
    /* Il testo racconta dove si e' fermato il racconto, non solo dove si e'
       fermato il gioco: quando SETTORI_PRONTI si sposta, questa frase si
       riscrive insieme a lui. */
    document.getElementById('winText').textContent =
      'Hai attraversato la Frattura fino al settore ' + SETTORI_PRONTI +
      ', con Ampere in mano e ECHO-0 alle calcagna. Manca lo scontro del 35, ' +
      'quello in cui arriva qualcosa di più grande di lui. Lo stiamo costruendo.';
    document.getElementById('winScore').textContent = this.score;
    document.getElementById('winKills').textContent = this.kills;
    document.getElementById('winRank').textContent =
      this.score >= 90000 ? 'S' : this.score >= 60000 ? 'A' : this.score >= 35000 ? 'B' : 'C';
    document.getElementById('winContinueBtn').classList.add('hidden');
    document.querySelector('#win .unlock').classList.add('hidden');
    document.getElementById('win').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
    Sfx.levelUp();
  },

  /* il menu racconta a che punto sei */
  refreshMenu() {
    /* il claim e la scelta raccontano chi stai cercando */
    const H = HEROES[this.hero] || HEROES.aren;
    for (const b of document.querySelectorAll('.hero-btn'))
      b.classList.toggle('on', b.dataset.hero === this.hero);
    const claim = document.getElementById('claim');
    if (claim) claim.textContent = 'Diventi VOLT. ' + H.otherLabel +
      ' è oltre la frattura: segui i frammenti e riaccendi Lumina.';
    const cp = this.progress.cp;
    const rb = document.getElementById('resumeRunBtn');
    rb.classList.toggle('hidden', !cp);
    if (cp) document.getElementById('cpLevel').textContent = cp.level;
    document.getElementById('playSub').textContent = this.prova
      ? (this.prova.vinci ? 'PROVA · FINE DEL PRIMO ATTO' : 'PROVA · SETTORE ' + this.prova.settore)
      : 'CAMPAGNA · ATTO I: ' + ATTO1_FINE + ' SETTORI';
    const eb = document.getElementById('endlessBtn');
    eb.classList.toggle('locked', !this.progress.cleared);
    eb.textContent = this.progress.cleared
      ? 'CIRCUITO APERTO — ogni 3 settori cambia una legge'
      : 'Circuito Aperto — si sblocca finendo la campagna';
  },

  saveProgress() {
    /* durante una prova il salvataggio vero non si tocca */
    if (this.prova) return;
    Store.set('volt_progress', this.progress);
  },

  toMenu() {
    this.state = 'menu';
    document.getElementById('comandi').classList.add('hidden');
    this._dopoComandi = null;
    this.rubato = null;
    /* al menu torna il custode scelto dal giocatore, non quello con cui è finita */
    if (this.canSwap && this.heroStart) this.hero = this.heroStart;
    this.canSwap = false; this.swapCd = 0;
    document.body.classList.remove('canswap');
    const ab = document.getElementById('ampHud');
    if (ab) ab.classList.add('hidden');
    GRAV = GRAV0; this.law = null; this.lawDef = null; this.platsOff = false;
    document.getElementById('choice').classList.add('hidden');
    document.getElementById('win').classList.add('hidden');
    document.getElementById('cinema').classList.add('hidden');
    this.refreshMenu();
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
    this.cores.length = 0; this.gens.length = 0; this.cariche.length = 0;
    if (this.player && this.player.riding) this.player.leaveShip(false);
    Particles.clear(); Floaters.clear(); Rings.clear();

    const p = (keepPlayer || !this.player) ? new Player(lv.startX, lv.startY) : this.player;
    if (!keepPlayer && this.player) { p.x = lv.startX; p.y = lv.startY; p.vx = 0; p.vy = 0; p.invuln = 1.2; }
    this.player = p;

    for (const s of lv.spawns) this.enemies.push(new Enemy(s.type, s.x, s.y, n, s.tier, s.elite));
    for (const q of lv.pickups) this.pickups.push(new Pickup(q.x, q.y, Pickup.randomKind()));

    /* la lanterna e le cariche sparse nel settore */
    const conAmpere = this.mode === 'endless' ||
      (this.mode === 'campaign' && n >= AMPERE_DA && n <= AMPERE_A);
    if (conAmpere) {
      if (!this.ampere) this.ampere = new Ampere(lv.startX, lv.startY - 40);
      else { this.ampere.x = lv.startX; this.ampere.y = lv.startY - 40; this.ampere.arc = null; this.ampere.arcT = 0; }
      /* Sparse a fasce, non a caso: una per ogni tratto del settore. A caso
         finivano ammucchiate in fondo, e il primo pezzo di strada era vuoto —
         proprio quello in cui ECHO-0 arriva. Se dentro non c'e' niente, non ha
         niente da rubare e la scena non vale nulla. */
      const quante = 4 + Math.floor(n / 7);
      const rng = makeRng(0x9a5f + n * 2654435761);
      const dentro = 12, fondo = lv.w - 10;
      for (let i = 0; i < quante; i++) {
        const da = dentro + Math.round((fondo - dentro) * (i / quante));
        const a = dentro + Math.round((fondo - dentro) * ((i + 1) / quante));
        /* dentro la fascia cerca un punto che abbia terra sotto */
        let tx = -1;
        for (let k = 0; k < 14 && tx < 0; k++) {
          const q = rndInt(rng, da, Math.max(da + 1, a));
          if (lv.groundY[q] > 0) tx = q;
        }
        if (tx < 0) continue;
        const c = new Carica(tx * TILE, (lv.groundY[tx] - 2 - Math.floor(rng() * 4)) * TILE);
        c.vx = 0; c.vy = 0;
        this.cariche.push(c);
      }
    } else this.ampere = null;
    for (const sh of (lv.ships || [])) this.ships.push(new Ship(sh.x, sh.y));

    /* missione del settore */
    /* la legge di questo settore: nella campagna non c'e', oltre la Frattura
       cambia ogni tre */
    this.law = lawFor(n, this.mode, lv.boss ? 'boss' : (lv.mission || {}).type);
    this.lawDef = this.law ? LAWS[this.law] : null;
    GRAV = GRAV0 * ((this.lawDef && this.lawDef.grav) || 1);
    this.platsOff = false; this.platT = 0.45; this.meteorT = 2.2;

    /* i due custodi combattono insieme dal ventunesimo settore: e' conseguenza
       del ricongiungimento, non di Ampere */
    this.canSwap = this.mode === 'endless' || (this.mode === 'campaign' && n >= FRATTURA_DA);
    this.swapCd = 0;

    this.mission = lv.mission || { type: 'hunt' };
    this.missionDone = false;
    this.missionT = this.mission.time || 0;
    this.wave = 0; this.waveCool = 1.2; this.spawnCool = 3;
    this.stormX = -9999;
    for (const q of (this.mission.spots || [])) {
      if (this.mission.type === 'cores') this.cores.push(new Core(q.x, q.y));
      else this.gens.push(new Generator(q.x, q.y - 20, n));
    }

    /* legge GIGANTI: la meta' dei mostri, ma il doppio abbondante di stazza */
    if (this.law === 'giants') {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.type === 'boss') continue;
        if (i % 2) { this.enemies.splice(i, 1); continue; }
        e.w = Math.round(e.w * 1.75); e.h = Math.round(e.h * 1.75);
        e.y -= e.h * 0.45;
        e.maxHp = Math.round(e.maxHp * 2.3); e.hp = e.maxHp;
        e.score = Math.round(e.score * 2.4);
        e.touch = e.def.touch + 1;
        e.baseSpeed *= 0.82; e.speed = e.baseSpeed;
      }
    }

    /* La caccia al contrario: ECHO-0 non c'e' all'inizio del settore, arriva
       mentre stai giocando. Aspettare che entri e' meta' della tensione. */
    this.cacciaT = lv.caccia ? 8 + Math.random() * 4 : 0;
    this.cacciaMax = lv.caccia ? 26 : 0;

    /* ECHO-0: appena il settore comincia, il furto e' gia' deciso */
    this.rubato = null; this.echiVia = false;
    const echo = this.enemies.find(e => e.type === 'echo');
    if (echo) this.echoEntra(echo);

    this.enemiesLeft = this.enemies.length;
    this.portalOn = false; this.portalT = 0;
    if (this.mission.type === 'escape') {
      /* qui non si combatte: il portale è già aperto e si scappa */
      this.portalOn = true;
      this.missionDone = true;
      this.stormX = lv.startX - 340;
    }
    /* legge TEMPESTA: il muro c'e' comunque, ma piu' lento — qui si combatte
       davvero, non si scappa soltanto */
    this.stormOn = this.mission.type === 'escape' || this.law === 'storm';
    if (this.law === 'storm' && this.mission.type !== 'escape') this.stormX = lv.startX - 620;
    /* Il Comandante della Laguna porta due cose che non sono sue: la lanterna
       di Lumina sulla schiena, e la cella con dentro il custode rapito. E'
       l'unica volta, prima del ventesimo settore, in cui si vede la persona
       che si sta cercando. */
    if (this.mode === 'campaign' && n === SEMINA_DA)
      for (const e of this.enemies) if (e.type === 'boss') { e.lanterna = true; e.cella = true; }

    /* i cali di tensione: dal 16 in poi, sempre piu' fitti */
    this.furto = null; this.cella = null; this.vign.length = 0; this.blackT = 0;
    this.blackNext = (this.mode === 'campaign' && n > SEMINA_DA && n <= SEMINA_A)
      ? 3 + Math.random() * 4 : 0;

    this.sectorTime = 0; this.sectorNoHit = true;
    this.transition = 0;
    this.camX = clamp(p.cx - this.viewW / 2, 0, Math.max(0, lv.pxW - this.viewW));
    this.camY = this.clampCamY(p.cy - this.viewH / 2);
    /* premi che agiscono all'inizio di ogni settore */
    if (this.hasPerk('emergency') && p && p.shield < 1) p.shield = 1;
    if (this.hasPerk('arsenal') && p) {
      p.weapon = ['spread', 'rapid', 'laser'][Math.floor(Math.random() * 3)];
      p.weaponT = 20; p.heat = 0; p.overheat = 0;
    }
    if (this.drone && p) { this.drone.x = p.cx; this.drone.y = p.cy - 30; }

    /* la prima volta che ne compare uno, il gioco lo presenta per nome */
    if (!this.eliteSeen) this.eliteSeen = {};
    for (const e of this.enemies) {
      if (!e.elite || this.eliteSeen[e.elite]) continue;
      this.eliteSeen[e.elite] = 1;
      const E = ELITES[e.elite];
      setTimeout(() => {
        if (this.state === 'play' && this.level === n) this.banner('ÉLITE · ' + E.label);
      }, 2900);
      break;
    }

    const md = MISSIONS[this.mission.type] || MISSIONS.hunt;
    const finale = this.mode === 'campaign' && n === ATTO1_FINE;
    /* Un nome proprio si scrive col lettering grosso, una missione con la
       targa: «IL DIVORATORE» e «ECHO-0» sono nomi, «CACCIA» e «ASSALTO» no. */
    const eNome = lv.boss || this.mission.type === 'echo';
    this.banner(lv.boss ? this.bossName() : missionName(this.mission.type),
                eNome ? 'nome' : 'targa');
    if (!lv.boss && n > 1 && n % 2 === 0) setTimeout(() => {
      if (this.state === 'play' && this.level === n && this.player)
        Floaters.add(this.player.cx, this.player.y - 40,
          LYRA_LINES[(n / 2) % LYRA_LINES.length].replace('@', HEROES[this.hero].other), '#ffb3f0', 13);
    }, 2600);
    if (this.lawDef) setTimeout(() => {
      if (this.state === 'play' && this.level === n) {
        this.banner('LEGGE · ' + this.lawDef.name);
        if (this.player) Floaters.add(this.player.cx, this.player.y - 46, this.lawDef.hint, this.lawDef.col, 14);
      }
    }, 1500);
    else if (!lv.boss) setTimeout(() => {
      if (this.state === 'play' && this.level === n && !this.portalOn) this.banner(md.hint);
    }, 1500);
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
    this.refreshActionButtons();
    const flying = !!(this.player && this.player.riding);
    document.body.classList.toggle('flying', flying);
    const j = document.getElementById('btnJump');
    if (j) j.textContent = flying ? 'BOOST' : 'SALTA';
  },

  /* `tipo` dice che forma prende, come in una vignetta:
     'voce'  — la nuvoletta: qualcuno sta parlando davvero
     'nome'  — il lettering grosso: entra in scena qualcuno
     'targa' — il riquadro giallo: e' il gioco che racconta (predefinito) */
  banner(text, tipo, chiParla) {
    /* mentre una vignetta e' aperta, i banner aspettano: quello che c'e' da
       sapere resta scritto nel cruscotto, e la scena non si sporca */
    if (this.vign && this.vign.length) return;
    const el = document.getElementById('banner');
    document.getElementById('bannerText').textContent = text;
    el.classList.remove('hidden', 'voce', 'nome', 'targa', 'sx', 'dx');
    el.classList.add(tipo || 'targa');
    /* da che parte sta chi parla: la codina va di la' */
    if (chiParla && this.player)
      el.classList.add(chiParla.cx >= this.player.cx ? 'dx' : 'sx');
    /* riavvia l'animazione CSS */
    const span = document.getElementById('bannerText');
    span.style.animation = 'none'; void span.offsetWidth; span.style.animation = '';
    this.bannerT = tipo === 'voce' ? 2.2 : 1.6;
  },

  /* Uno squarcio di fumetto: una vignetta che si apre sopra la scena e
     ingrandisce quello che sta succedendo, come il riquadro di dettaglio in una
     pagina disegnata. Dura poco e non copre mai il terreno: sta in alto.
       tipo  - che cosa mostra
       lato  - -1 a sinistra, +1 a destra (cosi due vignette stanno in fila)
       grido - la battuta nella nuvoletta, se ce n'e' una */
  apriRiquadro(tipo, lato, grido) {
    this.vign.push({ tipo, lato, grido, t: 0, dur: 2.6 });
    /* quando si apre una vignetta il gioco tace: banner e vignette stanno alla
       stessa altezza, e due cose insieme non se ne legge nessuna */
    document.getElementById('banner').classList.add('hidden');
    this.bannerT = 0;
    Sfx.tone(660, 0.08, 'square', 0.04, 260);
  },

  shake(amt, t) {
    this.shakeAmt = Math.max(this.shakeAmt, amt);
    this.shakeT = Math.max(this.shakeT, t);
  },

  addScore(v) {
    this.score += Math.round(v);
    if (this.score >= this.nextLifeAt) {
      this.nextLifeAt += this.lifeStep;
      this.lifeStep = Math.round(this.lifeStep * LIFE_GROW);
      this.grantLife();
    }
    if (this.score > this.best) { this.best = this.score; Store.set('volt_best', this.best); }
  },

  addVolt(v) {
    if (this.rushT > 0 || this.state !== 'play') return;
    const before = this.volt;
    this.volt = clamp(this.volt + v, 0, 100);
    /* a pieno carico il Rush resta in canna: lo fa scattare il giocatore */
    if (this.hasPerk('rushlong')) this.volt = clamp(before + v * (1 + this.perkLevel('rushlong') * 0.2), 0, 100);
    if (before < 100 && this.volt >= 100) {
      this.banner('VOLT CARICO!');
      Sfx.portal();
      const p = this.player;
      if (p) Floaters.add(p.cx, p.y - 16, Input.touchMode ? 'PREMI VOLT' : 'PREMI E', '#66ffe0', 15);
      this.refreshActionButtons();
    }
  },

  /* mostra i tasti contestuali solo quando servono davvero */
  refreshActionButtons() {
    document.body.classList.toggle('voltready', this.volt >= 100 && this.rushT <= 0 && this.state === 'play');
    document.body.classList.toggle('hasship', !!this.hasShip && !(this.player && this.player.riding));
    document.body.classList.toggle('canswap', this.canSwap && this.state === 'play');
    const sb = document.getElementById('btnSwap');
    if (sb) {
      sb.classList.toggle('cool', this.swapCd > 0);
      sb.textContent = this.hero === 'aren' ? 'LYRA' : 'AREN';
    }
  },

  /* Il cambio fra i custodi. Il corpo e' lo stesso — posizione, cuori, armi,
     potenziamenti restano — cambia chi lo abita: velocita', peso del colpo,
     cadenza, scatto e salto sono quelli del custode che entra. Chi esce non
     sparisce: torna corrente, ed e' per questo che il passaggio si vede. */
  swapHero() {
    const p = this.player;
    if (!this.canSwap || !p || p.dead || this.state !== 'play') return;
    if (this.swapCd > 0) {
      Floaters.add(p.cx, p.y - 12, 'CAMBIO FRA ' + Math.ceil(this.swapCd) + 's', '#c9b6ff', 13);
      return;
    }
    const nuovo = this.hero === 'aren' ? 'lyra' : 'aren';
    const H = HEROES[nuovo];
    this.hero = nuovo;
    this.swapCd = SWAP_CD;
    /* niente invulnerabilita': il cambio serve a combattere meglio, non a
       schivare. Del resto lampeggiare qui coprirebbe proprio il passaggio. */
    p.swapFx = 0.45; p.flash = 0.2;
    p.heat = Math.max(0, p.heat - 22);     /* l'arma che entra e' fredda */
    p.overheat = 0;

    Particles.burst(p.cx, p.cy, 30, H.trail, 300, 5, -60);
    Particles.burst(p.cx, p.cy, 16, '#ffffff', 200, 3.5, 0);
    Rings.add(p.cx, p.cy, H.trim, 110, 0.42, 6);
    Floaters.add(p.cx, p.y - 18, H.name, H.trail, 19);
    this.shake(7, 0.18);
    Sfx.tone(420, 0.12, 'triangle', 0.05, 1100);
    Sfx.tone(880, 0.16, 'sine', 0.04, 1500);
    this.refreshActionButtons();
  },

  startRush() {
    const p = this.player;
    if (!p || p.dead || this.rushT > 0 || this.volt < 100) return;
    this.volt = 100; this.rushT = 6.5 + this.perkLevel('rushlong') * 1.8;
    this.refreshActionButtons();
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

  spawnEnemy(type, x, y, elite) {
    if (this.enemies.length > 44) return;
    const e = new Enemy(type, x, y, this.level, 1, elite);
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
    else this.addVolt(((e.type === 'boss' ? 36 : 11) + Math.min(8, this.combo)) * (this.hasPerk('vampire') ? 2.2 : 1));
    this.hitStop = (e.type === 'boss' || e.type === 'echo') ? 0.08 : 0.025;
    Floaters.add(e.cx, e.cy - 10, '+' + pts, this.combo > 2 ? '#7dff8d' : '#ffe98a', this.combo > 4 ? 19 : 15);

    /* all'ultima vita il gioco allunga la mano: più oggetti, più cuori */
    const lowHp = this.player && this.player.hp <= 1;
    /* la mano tesa all'ultima vita resta intera nei primi cinque settori, poi
       si ritira piano: piu' avanti si va, meno il gioco ti salva da solo */
    const pieta = this.level <= 5 ? 1 : Math.max(0.55, 1 - (this.level - 5) * 0.035);
    let dropChance = e.type === 'boss' ? 1 : (lowHp ? 0.30 * pieta : 0.17);
    dropChance += this.perkLevel('luck') * 0.22;
    /* oltre la Frattura i mostri sono fatti anche di Corrente Verde: cadendo
       ne lasciano un po', ed e' quella che ricarica Ampere */
    if (this.ampere && Math.random() < (e.type === 'boss' ? 1 : 0.24)) {
      const quante = e.type === 'boss' ? 6 : 1;
      for (let i = 0; i < quante; i++) this.cariche.push(new Carica(e.cx, e.cy - 6));
    }

    if (Math.random() < dropChance) {
      let kind = Pickup.randomKind();
      if (lowHp && Math.random() < 0.5 * pieta) kind = 'heart';
      this.pickups.push(new Pickup(e.cx - 10, e.cy - 10, kind));
      if (e.type === 'boss') {
        this.pickups.push(new Pickup(e.cx + 30, e.cy - 10, 'maxheart'));
        this.pickups.push(new Pickup(e.cx - 50, e.cy - 10, 'shield'));
      }
    }
    if (e.type === 'boss') {
      /* la luce verde non cade a terra: se la porta via qualcosa */
      if (e.lanterna) {
        this.furto = { t: 0, x: e.cx, y: e.cy - 10 };
        Sfx.tone(520, 0.2, 'triangle', 0.05, 900);
      }
      /* e nemmeno la cella: cade, e per un attimo e' li' a portata di mano */
      if (e.cella) this.cella = { t: 0, x: e.cx + 40, y: e.cy - 20, vy: 0, presa: false };
      this.shake(30, 0.7); this.flashT = 0.4;
      if (CHECKPOINTS.indexOf(this.level) >= 0) this.saveCheckpoint();
    }
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

    if (this.state === 'cinema') { /* il gioco aspetta la fine del filmato */ }
    else if (this.state === 'play') this.update(dt);
    else if (this.state === 'menu') { this.updateMenu(dt); this.drawHeroPicks(dt); }
    else { Particles.update(dt * 0.35); Rings.update(dt * 0.35); }

    Sfx.update(dt);
    /* Durante un filmato il mondo non si disegna: la tela resta nera sotto al
       video. Cosi il filmato non ha niente dietro che traspare, e il telefono
       non manda avanti il gioco a sessanta fotogrammi mentre guardi un video. */
    if (this.state === 'cinema') {
      if (!this._telaNera) {
        this._telaNera = true;
        const c = this.ctx;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.fillStyle = '#07040f';
        c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    } else {
      this._telaNera = false;
      this.render(dt);
    }
    this.updateHud();
    Input.endFrame();

    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) document.getElementById('banner').classList.add('hidden');
    }
  },

  /* Presentazione dei custodi: girano davvero, un fotogramma ogni pochi gradi
     preso dal foglio di rotazione. Attorno: alone, pedana, riflesso a terra,
     un bagliore che scorre e le scintille per chi è scelto. */
  drawHeroPicks(dt) {
    this.heroSpin = (this.heroSpin || 0) + dt;
    if (this._pick === undefined) this._pick = {};
    for (const id of ['aren', 'lyra']) {
      const cv = document.getElementById(id === 'aren' ? 'canvAren' : 'canvLyra');
      if (!cv) continue;
      const g = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      g.clearRect(0, 0, W, H);
      const sel = this.hero === id;
      const t = this.heroSpin + (id === 'lyra' ? 1.7 : 0);
      const col = id === 'aren' ? '#22c8f5' : '#ff5d8f';
      const baseY = H * 0.82;

      /* quanto è "acceso": sale e scende con dolcezza quando cambi scelta */
      const k = this._pick[id] === undefined ? (sel ? 1 : 0) : this._pick[id];
      this._pick[id] = k + ((sel ? 1 : 0) - k) * Math.min(1, dt * 6);
      const on = this._pick[id];

      /* alone dietro la figura */
      g.save();
      g.translate(W / 2, H * 0.5);
      const halo = g.createRadialGradient(0, 0, 6, 0, 0, W * 0.62);
      halo.addColorStop(0, Gfx.alpha(col, 0.10 + on * 0.26));
      halo.addColorStop(1, Gfx.alpha(col, 0));
      g.fillStyle = halo;
      g.beginPath(); g.ellipse(0, 0, W * 0.62, H * 0.52, 0, 0, TAU); g.fill();
      g.restore();

      /* pedana: ellisse luminosa con un anello che pulsa */
      g.save();
      g.translate(W / 2, baseY);
      const pg = g.createRadialGradient(0, 0, 3, 0, 0, 64);
      pg.addColorStop(0, Gfx.alpha(col, 0.30 + on * 0.45));
      pg.addColorStop(1, Gfx.alpha(col, 0));
      g.fillStyle = pg;
      g.beginPath(); g.ellipse(0, 0, 64, 20, 0, 0, TAU); g.fill();
      const puls = (t * 0.55) % 1;
      g.strokeStyle = Gfx.alpha('#ffffff', (1 - puls) * (0.15 + on * 0.5));
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, 0, 24 + puls * 34, (24 + puls * 34) * 0.31, 0, 0, TAU); g.stroke();
      g.restore();

      const breathe = 1 + Math.sin(t * 1.7) * 0.014;
      const h = H * (0.78 + on * 0.06);
      const dip = Math.sin(t * 1.7) * 1.6;

      /* riflesso sul pavimento */
      g.save();
      g.translate(W / 2, baseY + 2);
      g.scale(1, -0.34);
      g.globalAlpha = 0.14 + on * 0.12;
      const angR = t * (sel ? 1.25 : 0.6) + (id === 'lyra' ? 2.4 : 0);
      if (!(HeroSpin.ready(id) ? HeroSpin.draw(g, id, angR, h) : HeroArt.drawFront(g, id, h))) {
        g.scale(1.9, 1.9); g.translate(0, -22);
        drawHeroPose(g, HEROES[id], 0, t, 1);
      }
      g.restore();

      /* la figura: se c'è il giro completo gira davvero, altrimenti resta ferma */
      const gira = HeroSpin.ready(id);
      const ang = t * (sel ? 1.25 : 0.6) + (id === 'lyra' ? 2.4 : 0);
      g.save();
      g.translate(W / 2, baseY + 3 + dip);
      g.scale(1, breathe);
      g.globalAlpha = 0.55 + on * 0.45;
      let disegnata = gira ? HeroSpin.draw(g, id, ang, h) : HeroArt.drawFront(g, id, h);
      if (!disegnata) {
        g.scale(1.95, 1.95); g.translate(0, -22);
        drawHeroPose(g, HEROES[id], 0, t, 1);
      }
      g.restore();

      /* riflesso di luce che scorre sulla figura, ogni tanto */
      if (disegnata && on > 0.05) {
        const sweep = (t * 0.42) % 3;          /* passa una volta ogni tre secondi */
        if (sweep < 1) {
          g.save();
          g.globalCompositeOperation = 'source-atop';
          g.translate(W / 2, baseY + 3 + dip);
          g.scale(1, breathe);
          if (gira) HeroSpin.draw(g, id, ang, h); else HeroArt.drawFront(g, id, h);
          const y = -h + sweep * h * 1.2;
          const lg = g.createLinearGradient(0, y - h * 0.18, 0, y + h * 0.18);
          lg.addColorStop(0, 'rgba(255,255,255,0)');
          lg.addColorStop(0.5, 'rgba(255,255,255,' + (0.34 * on) + ')');
          lg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = lg;
          g.fillRect(-W, y - h * 0.2, W * 2, h * 0.4);
          g.restore();
        }
      }

      /* scintille che salgono attorno a chi è scelto */
      if (on > 0.15) {
        g.save();
        g.fillStyle = col;
        for (let i = 0; i < 8; i++) {
          const ph = (t * 0.5 + i / 8) % 1;
          const a = i * 2.4 + t * 0.4;
          g.globalAlpha = (1 - ph) * 0.7 * on;
          const rr = 30 + Math.sin(a) * 16;
          g.beginPath();
          g.arc(W / 2 + Math.cos(a) * rr, baseY - ph * H * 0.62 + Math.sin(a) * 4,
                2.4 - ph * 1.4, 0, TAU);
          g.fill();
        }
        g.restore();
      }
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
      if (this.transition <= 0) {
        if (this.mode === 'campaign') {
          if (this.level === ATTO1_FINE) { this.winCampaign(); return; }
          if (this.level >= SETTORI_PRONTI) {
            /* Se il settore successivo ha un filmato, quel filmato racconta
               come e' finito QUESTO settore: si vede lo stesso, e solo dopo si
               chiude il tratto. Altrimenti la caccia si fermerebbe un attimo
               prima del momento per cui l'hai fatta. */
            const film = FILMATI_SETTORE[this.level + 1];
            if (film) {
              document.getElementById('hud').classList.add('hidden');
              this.state = 'cinema';
              this.playCinemaSerie(film, () => this.fineAnteprima());
            } else this.fineAnteprima();
            return;
          }
        }
        this.pendingLevel = this.level + 1;
        this.openChoice();
      }
      Particles.update(dt);
      return;
    }

    if (this.swapCd > 0) {
      this.swapCd = Math.max(0, this.swapCd - dt);
      if (this.swapCd === 0) this.refreshActionButtons();
    }
    if (Input.wantSwap()) this.swapHero();
    if (Input.wantVolt() && this.volt >= 100 && this.rushT <= 0) this.startRush();
    if (Input.wantShip() && this.hasShip && !p.riding && !p.dead) {
      this.hasShip = false;
      p.boardShip({ x: p.cx - 23, y: p.cy - 14 });
    }

    p.update(dt, lv, this.enemies, this.bullets, this.camX, this.camY);
    this.sectorTime += dt;
    if (this.rushT > 0) {
      this.rushT = Math.max(0, this.rushT - dt);
      const full = 6.5 + this.perkLevel('rushlong') * 1.8;
      this.volt = this.rushT > 0 ? clamp((this.rushT / full) * 100, 0, 100) : 0;
      if (this.rushT === 0) {
        Floaters.add(p.cx, p.y - 10, 'RUSH TERMINATO', '#b9d9ff', 13);
        if (this.hasPerk('afterburn')) { this.volt = 50; this.refreshActionButtons(); }
      }
    }

    /* muro di tempesta: avanza sempre, non si combatte, si corre */
    if (this.stormOn && !p.dead) {
      const fuga = this.mission && this.mission.type === 'escape';
      this.stormX += (fuga ? 112 + Math.min(90, this.level * 4) : 52 + Math.min(34, this.level)) * dt;
      if (p.cx < this.stormX + 54 && p.hurt(1)) {
        this.stormX = p.cx - 240;              /* respinta, per non restare dentro */
        p.vx = Math.max(p.vx, 340);
        Game.shake(14, 0.3);
      }
      /* i mostri inghiottiti spariscono: non si spara dentro la tempesta */
      for (const e of this.enemies) {
        if (!e.dead && e.cx < this.stormX - 10) {
          Particles.burst(e.cx, e.cy, 14, '#d36bff', 220, 4, 120);
          e.dead = true;
        }
      }
      if (Math.random() < 0.6) {
        const sy = this.camY + Math.random() * this.viewH;
        Particles.spawn(this.stormX + Math.random() * 60, sy, 120 + Math.random() * 90,
          (Math.random() - 0.5) * 60, 0.5, 5, '#e79bff', -30, 1);
      }
    }

    /* legge PIOGGIA DI FUOCO: cade roba dal cielo, sempre vicino a te */
    if (this.law === 'meteors' && !p.dead) {
      this.meteorT -= dt;
      if (this.meteorT <= 0) {
        this.meteorT = 0.85 + Math.random() * 0.7;
        const mx = clamp(p.cx + (Math.random() - 0.5) * this.viewW * 0.85, 40, lv.pxW - 40);
        this.bullets.push(new Bullet(mx, this.camY - 40, (Math.random() - 0.5) * 50, 240,
          { foe: true, col: '#ff8a3d', r: 8, life: 9, grav: 700, bomb: true }));
      }
    }

    /* legge PIATTAFORME INSTABILI: reggono finche' ti muovi, poi svaniscono */
    if (this.law === 'blink') {
      if (Math.abs(p.vx) > 45 && !p.dead) this.platT = 0.45;
      else this.platT = Math.max(0, this.platT - dt);
      this.platsOff = this.platT <= 0;
    } else this.platsOff = false;

    /* Lumina si sta spegnendo: un lampo di buio, e torna. Non toglie vite e
       non blocca i comandi — spaventa, e basta. Piu' ci si avvicina al
       ventesimo settore, piu' capita spesso. */
    if (this.blackT > 0) this.blackT = Math.max(0, this.blackT - dt);
    if (this.blackNext > 0) {
      this.blackNext -= dt;
      if (this.blackNext <= 0) {
        this.blackT = BLACK_TIME;
        const passo = Math.max(4.5, 15 - (this.level - SEMINA_DA) * 1.7);
        this.blackNext = passo * (0.55 + Math.random() * 0.45);
        Sfx.tone(90, 0.3, 'sine', 0.05, 40);
        Sfx.noise(0.12, 0.05, 400, 120);
      }
    }

    /* L'arrivo di ECHO-0 nei settori della caccia. Entra dal bordo, in alto,
       dalla parte da cui stai andando: te lo trovi davanti. */
    if (this.cacciaT > 0 && !p.dead) {
      this.cacciaT -= dt;
      this.cacciaMax -= dt;
      /* Non arriva a tempo: arriva quando **c'e' qualcosa da prendere**. Il
         tempo minimo serve a non farlo comparire addosso alla partenza, quello
         massimo a non farlo aspettare all'infinito se non raccogli niente. */
      const vale = this.ampere && this.ampere.charge >= 34;
      if (this.cacciaT <= 0 && !vale && this.cacciaMax > 0) this.cacciaT = 0.5;
      else if (this.cacciaT <= 0) {
        this.cacciaT = 0;
        const ex = clamp(p.cx + this.viewW * 0.75, 60, lv.pxW - 80);
        const e = new Enemy('echo', ex, Math.max(60, p.cy - 150), this.level, 2);
        e.caccia = true;
        e.state = 0; e.stateT = 1.8; e.awake = true;
        this.enemies.push(e);
        this._echo = e;
        Rings.add(e.cx, e.cy, '#b06bff', 220, 0.7, 8);
        Sfx.boss();
        this.banner('ECHO-0', 'nome');
        setTimeout(() => {
          if (this.state !== 'play' || e.dead) return;
          this.banner('QUELLA LUCE NON È VOSTRA', 'voce', e);
        }, 2400);
      }
    }

    /* le vignette aperte */
    for (let i = this.vign.length - 1; i >= 0; i--) {
      this.vign[i].t += dt;
      if (this.vign[i].t > this.vign[i].dur) this.vign.splice(i, 1);
    }

    /* il furto della lanterna, dopo il Comandante della Laguna */
    if (this.furto) {
      const prima = this.furto.t;
      this.furto.t += dt;
      /* la vignetta si apre nell'istante in cui la sagoma se la prende */
      if (prima <= 1.55 && this.furto.t > 1.55) this.apriRiquadro('lanterna', -1);
      if (this.furto.t > 3.4) this.furto = null;
    }
    /* La cella che se la portano via, ma DOPO la lanterna: i due furti vanno
       in fila, non insieme. Prima la luce verde che sale e la sagoma che
       attraversa lo schermo, poi i viticci che vengono a prendersi la cella.
       Sovrapposti non si capirebbe ne' l'uno ne' l'altro. */
    if (this.cella) {
      const c = this.cella;
      c.t += dt;
      /* cade e si appoggia a terra */
      if (c.t < 2.6 && !c.presa) {
        c.vy += GRAV * 0.55 * dt;
        c.y += c.vy * dt;
        const suolo = lv.groundY[clamp(Math.floor(c.x / TILE), 0, lv.w - 1)];
        const sy = (suolo > 0 ? suolo : lv.h - 9) * TILE - 26;
        if (c.y > sy) { c.y = sy; c.vy = -c.vy * 0.28; }
      }
      /* i viticci arrivano e la prendono: qui il tempo si ferma un istante */
      if (c.t > 2.6 && !c.presa) {
        c.presa = true;
        /* e qui si apre la seconda: il rapito che chiama per nome chi lo sta
           cercando. Le due vignette restano in fila un momento, come due
           riquadri della stessa pagina. */
        this.apriRiquadro('rapito', 1,
          'AIUTO ' + (HEROES[this.hero] || HEROES.aren).name + '!');
        this.hitStop = 0.35;
        this.shake(24, 0.5);
        Sfx.tone(90, 0.6, 'sawtooth', 0.08, 1600);
        Particles.burst(c.x, c.y, 26, '#b06bff', 260, 6, 0);
      }
      /* E la trascinano nel buio. Piano: se sparisce in mezzo secondo non la
         vede nessuno, e questo e' l'unico momento dei primi venti settori in
         cui si vede chi si sta cercando. */
      if (c.presa) {
        const k = (c.t - 2.6) / 2.1;
        c.x += 145 * dt * Math.min(1, k * 3);
        c.y -= 42 * dt;
      }
      if (c.t > 5.2) this.cella = null;
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
        if (p.dashT > 0) {
          const boom = this.hasPerk('boom');
          e.hurt(boom ? 6 : 2, p.cx, this.hasPerk('freeze'));
          if (boom) {
            Rings.add(e.cx, e.cy, '#ffb37a', 80, 0.3, 6);
            Particles.burst(e.cx, e.cy, 18, '#ff8a3d', 280, 4.5, 160);
            this.shake(9, 0.2);
          }
        }
        else if (p.hurt(e.touch === undefined ? e.def.touch : e.touch)) {
          const away = sign(p.cx - e.cx) || 1;
          p.vx = away * 300; p.vy = -320;
          /* respingo anche il mostro e lo stordisco: senza questo, finita
             l'invulnerabilità ti ricolpisce subito perché ti è rimasto addosso */
          e.vx = -away * 430; e.vy = -240; e.stun = 0.5;
          Particles.burst((p.cx + e.cx) / 2, (p.cy + e.cy) / 2, 10, '#ffffff', 200, 3.5, 120);
        }
      }
    }

    /* ECHO-0 quando da' la caccia non conta come mostro: non si puo' uccidere
       e non e' l'obiettivo del settore. Se contasse, una CACCIA non si potrebbe
       chiudere finche' lui non se ne va da solo. */
    this.enemiesLeft = this.enemies.filter(e => !e.caccia).length;
    this.updateMission(dt);

    /* proiettili */
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, lv);
      if (!b.dead) {
        if (b.foe) {
          if (!p.dead && this.hitPlayer(b, p)) {
            b.dead = true;
            if (b.bomb) b.explode();
            else { p.hurt(b.dmg); Particles.spark(b.x, b.y, -b.vx, -b.vy, b.col); }
          }
        } else {
          for (const g of this.gens) {
            if (g.dead || !this.hitCircle(b, g)) continue;
            g.hurt(b.dmg, b.x);
            if (b.pierce > 0) b.pierce--; else b.dead = true;
            break;
          }
          for (const e of this.enemies) {
            if (e.dead || !this.hitCircle(b, e)) continue;
            e.hurt(b.dmg, b.x, b.freeze);
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
      if (!p.dead && !p.riding && !this.hasShip && this.overlap(p, sh)) {
        this.ships.splice(i, 1);
        this.hasShip = true;
        this.refreshActionButtons();
        this.banner('NAVICELLA PRONTA');
        Floaters.add(p.cx, p.y - 16, Input.touchMode ? 'PREMI NAVE' : 'PREMI Q', '#8ff0ff', 15);
        Particles.burst(sh.cx, sh.cy, 30, '#8ff0ff', 280, 4.5, 0);
        Rings.add(sh.cx, sh.cy, '#ffffff', 100, 0.4, 5);
        Sfx.pickup();
      }
    }

    /* pickup */
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const q = this.pickups[i];
      q.update(dt, lv);
      if (!q.dead && !p.dead && this.overlap(p, q)) { p.give(q.kind); q.dead = true; }
      if (q.dead || q.y > lv.pxH + 100) this.pickups.splice(i, 1);
    }

    /* la lanterna e la sua corrente */
    if (this.ampere && !p.dead) {
      this.ampere.update(dt, p, this.enemies);
      for (let i = this.cariche.length - 1; i >= 0; i--) {
        const c = this.cariche[i];
        c.update(dt, this.ampere);
        if (c.dead || c.y > lv.pxH + 200) this.cariche.splice(i, 1);
      }
    }

    /* droncino alleato */
    if (this.drone && !p.dead) this.drone.update(dt, p, this.enemies, this.bullets);

    /* scudo che si rigenera da solo */
    if (this.hasPerk('shieldgen') && !p.dead) {
      this.shieldGenT -= dt;
      if (this.shieldGenT <= 0) {
        this.shieldGenT = 18;
        const cap = 1 + this.perkLevel('shieldgen');
        if (p.shield < cap) {
          p.shield++;
          Floaters.add(p.cx, p.y - 10, '+SCUDO', '#48d7ff', 15);
          Rings.add(p.cx, p.cy, '#9be9ff', 70, 0.35, 5);
          Sfx.pickup();
        }
      }
    }
    /* calamita: gli oggetti vengono a te */
    if (this.hasPerk('magnet') && !p.dead) {
      for (const q of this.pickups) {
        const dx = p.cx - q.x, dy = p.cy - q.y, d = Math.hypot(dx, dy);
        if (d < 190 && d > 1) { q.x += (dx / d) * 260 * dt; q.y += (dy / d) * 260 * dt; }
      }
    }

    Particles.update(dt);
    Rings.update(dt);
    Floaters.update(dt);
    this.flashT = Math.max(0, this.flashT - dt);

    /* Le apparizioni di ECHO-0 nei settori dell'inseguimento. Non fanno male e
       non si possono colpire: compaiono lontane, ti guardano, e appena ti
       avvicini si sfilano dentro un varco. Il settore smette di essere vuoto. */
    /* La comparsa non si regola sulla distanza ma sul tempo: entra in campo,
       resta il tempo di accorgersene, e se ne va. Sulla distanza non
       funzionerebbe — la vista e' larga poco piu' di trecento pixel, e chi
       corre se lo perderebbe in mezzo secondo. */
    const vistaOmbra = this.viewW * 0.55;
    for (const om of (lv.ombre || [])) {
      if (om.fatta) continue;
      if (om.via > 0) {
        /* si sfila dentro un varco */
        om.via -= dt;
        om.k = Math.max(0, om.via / 0.55);
        if (om.via <= 0) { om.fatta = true; om.k = 0; }
        continue;
      }
      if (om.vita > 0) {
        om.k = Math.min(1, om.k + dt * 2.4);
        om.vita -= dt;
        if (om.vita <= 0) {
          om.via = 0.55;
          Rings.add(om.x, om.y, '#b06bff', 130, 0.5, 6);
          Particles.burst(om.x, om.y, 18, '#b06bff', 200, 5, 0);
          Sfx.tone(150, 0.35, 'sawtooth', 0.035, 900);
        }
        continue;
      }
      /* non e' ancora comparso: aspetta che tu gli arrivi sotto */
      if (Math.abs(p.cx - om.x) < vistaOmbra) om.vita = 2.6;
    }

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
    this.refreshActionButtons();

    Sfx.setIntensity(clamp(0.2 + this.level / 16 + (this.combo > 3 ? 0.2 : 0), 0, 1));

    /* morte */
    if (p.dead) {
      this.deathT = (this.deathT || 0) + dt;
      if (this.deathT > 1.1) { this.deathT = 0; this.gameOver(); }
    }
  },

  /* ---- potenziamenti ---- */
  /* Mentre ECHO-0 e' in campo, il potere che ti ha copiato non ce l'hai piu':
     non e' una scritta, e' proprio sparito dalle tue mani. */
  perkLevel(id) { return id === this.rubato ? 0 : (this.perks[id] || 0); },
  hasPerk(id) { return this.perkLevel(id) > 0; },

  /* Sceglie cosa portarti via: solo fra quelli che hai davvero. */
  rubaPotere() {
    const suoi = RUBABILI.filter(k => (this.perks[k] || 0) > 0);
    return suoi.length ? suoi[Math.floor(Math.random() * suoi.length)] : null;
  },
  coloreRubato() {
    if (!this.rubato) return '#ff3b5c';
    const pk = PERKS.find(q => q.id === this.rubato);
    return pk ? pk.col : '#ff3b5c';
  },
  nomeRubato() {
    const pk = PERKS.find(q => q.id === this.rubato);
    return pk ? pk.name : '';
  },

  openChoice() {
    /* dopo un Comandante il premio è di un altro livello */
    const afterBoss = !!(this.lv && this.lv.boss);
    const src = afterBoss ? LEGENDS.concat(PERKS) : PERKS;
    const pool = src.filter(p => this.perkLevel(p.id) < p.max);
    if (afterBoss) {
      document.querySelector('#choice .ptitle').textContent = 'PREMIO DEL COMANDANTE';
      document.querySelector('.choice-sub').textContent = 'Hai abbattuto un Comandante. Prendi il tuo premio.';
    } else {
      document.querySelector('#choice .ptitle').textContent = 'POTENZIAMENTO';
      document.querySelector('.choice-sub').textContent = 'Lyra ti lascia tre frammenti. Prendine uno.';
    }
    const pick3 = [];
    while (pick3.length < 3 && pool.length) {
      pick3.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    if (!pick3.length) { this.startNextLevel(); return; }

    /* dopo un boss almeno una carta è leggendaria */
    if (afterBoss && !pick3.some(c => c.leg)) {
      const legs = LEGENDS.filter(p => this.perkLevel(p.id) < p.max);
      if (legs.length) pick3[0] = legs[Math.floor(Math.random() * legs.length)];
    }
    this.choices = pick3;
    const box = document.getElementById('choiceCards');
    box.innerHTML = '';
    pick3.forEach((pk, i) => {
      const lvl = this.perkLevel(pk.id);
      const b = document.createElement('button');
      b.className = 'card';
      b.className = 'card' + (pk.leg ? ' legend' : '');
      b.innerHTML = '<div class="ic" style="background:' + pk.col + '">' + pk.ic + '</div>' +
        '<div class="nm">' + pk.name + '</div>' +
        '<div class="ds">' + pk.ds + '</div>' +
        (lvl ? '<div class="lv">GIÀ PRESO ×' + lvl + '</div>' : '');
      b.onclick = () => this.takePerk(i);
      box.appendChild(b);
    });
    document.getElementById('choice').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
    this.state = 'choice';
    Sfx.stopMusic();
  },

  takePerk(i) {
    if (this.state !== 'choice') return;
    const pk = this.choices && this.choices[i];
    if (!pk) return;
    this.perks[pk.id] = this.perkLevel(pk.id) + 1;
    const p = this.player;
    if (pk.id === 'heart' && p) { p.maxHp = Math.min(9, p.maxHp + 1); p.hp = p.maxHp; }
    if (pk.id === 'drone' && p && !this.drone) this.drone = new Drone(p.cx, p.cy - 30);
    document.getElementById('choice').classList.add('hidden');
    Sfx.levelUp();
    this.startNextLevel();
    this.banner(pk.name);
  },

  /* battuto un comandante: si salva il punto di ripresa */
  saveCheckpoint() {
    if (this.mode !== 'campaign' || !this.player) return;
    this.progress.cp = {
      level: this.level + 1,
      perks: Object.assign({}, this.perks),
      maxHp: this.player.maxHp,
      score: this.score
    };
    this.saveProgress();
    Floaters.add(this.player.cx, this.player.cy - 30, 'PUNTO DI RIPRESA', '#7cf7c4', 15);
  },

  winCampaign() {
    /* prima il ricongiungimento, poi i conti. Il segnalatore resta alzato
       finché non si torna al menu, altrimenti il filmato ripartirebbe in
       continuazione. */
    if (!this._winCinema) {
      this._winCinema = true;
      const liberato = HEROES[this.hero].other.toLowerCase();
      this.state = 'cinema';
      document.getElementById('hud').classList.add('hidden');
      this.playCinema('liberazione_' + liberato, () => this.winCampaign());
      return;
    }
    this.state = 'win';
    Sfx.stopMusic();
    this.progress.cleared = true;
    /* da qui in poi si puo' riprendere dal ventunesimo, con quello che si e'
       conquistato: ECHO-0 si e' nutrito proprio di questi poteri */
    this.progress.cp = {
      level: FRATTURA_DA,
      perks: Object.assign({}, this.perks),
      maxHp: this.player ? this.player.maxHp : 3,
      score: this.score
    };
    this.saveProgress();
    document.getElementById('winContinueBtn').classList.remove('hidden');
    document.querySelector('#win .unlock').classList.remove('hidden');
    const rank = this.score >= 60000 ? 'S' : this.score >= 40000 ? 'A' : this.score >= 25000 ? 'B' : 'C';
    const H = HEROES[this.hero] || HEROES.aren;
    document.getElementById('winTitle').textContent = H.otherFree;
    /* Non si dice che la Frattura si chiude: non si chiude. Questa vittoria
       salva la persona amata, non il mondo — e il mondo, dietro di loro, si sta
       spegnendo proprio adesso. */
    document.getElementById('winText').textContent =
      'Il Divoratore è caduto. ' + H.otherLabel + ' è di nuovo al tuo fianco. ' +
      'Ma dietro di voi Lumina si sta spegnendo.';
    document.getElementById('winScore').textContent = this.score;
    document.getElementById('winKills').textContent = this.kills;
    document.getElementById('winRank').textContent = rank;
    document.getElementById('win').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => Sfx.tone(f, 0.4, 'triangle', 0.1), i * 220));
  },

  startNextLevel() {
    document.getElementById('choice').classList.add('hidden');
    this.level = this.pendingLevel || (this.level + 1);
    this.pendingLevel = 0;

    /* il settore comincia davvero solo dopo il filmato, se ce n'e' uno: cosi
       l'insegna e l'entrata di ECHO-0 arrivano quando stai gia' giocando */
    const via = () => {
      document.getElementById('hud').classList.remove('hidden');
      this.state = 'play';
      Sfx.resume(); Sfx.startMusic();
      this.loadLevel(this.level, false);
    };
    const film = this.mode === 'campaign' ? FILMATI_SETTORE[this.level] : null;
    if (film) {
      document.getElementById('hud').classList.add('hidden');
      this.state = 'cinema';
      this.playCinemaSerie(film, via);
    } else via();
  },

  /* ---- missioni ---- */
  updateMission(dt) {
    const m = this.mission, p = this.player;
    if (!m) return;

    /* nuclei e generatori vivono qui */
    for (let i = this.cores.length - 1; i >= 0; i--) {
      const c = this.cores[i];
      c.update(dt);
      if (!p.dead && this.overlap(p, c)) {
        this.cores.splice(i, 1);
        this.addScore(300); this.addVolt(20);
        Floaters.add(c.cx, c.cy - 12, 'FRAMMENTO!', '#66ffe0', 17);
        Particles.burst(c.cx, c.cy, 34, '#66ffe0', 300, 5, 0);
        Rings.add(c.cx, c.cy, '#ffffff', 90, 0.4, 6);
        Sfx.pickup();
      }
    }
    for (let i = this.gens.length - 1; i >= 0; i--) {
      const g = this.gens[i];
      g.update(dt);
      if (g.dead) this.gens.splice(i, 1);
    }

    if (this.missionDone) return;
    let done = false;

    /* rete di sicurezza: nessun settore puo' diventare una prigione.
       Se dopo tre minuti l'obiettivo non e' compiuto, il portale si apre lo stesso. */
    if (this.sectorTime > 180) {
      this.missionDone = true;
      this.banner('VIA LIBERA');
      this.openPortal();
      return;
    }

    switch (m.type) {
      case 'echo':
        /* si apre quando se n'e' andato: non c'e' modo di ucciderlo */
        if (this.echiVia) done = true;
        break;
      case 'survive':
        this.missionT = Math.max(0, this.missionT - dt);
        /* mostri che arrivano di continuo: il settore non si "svuota" */
        this.spawnCool -= dt;
        if (this.spawnCool <= 0 && this.enemies.length < 14) {
          this.spawnCool = Math.max(1.1, 3.2 - this.level * 0.08);
          this.spawnAroundPlayer(1 + (Math.random() < 0.4 ? 1 : 0));
        }
        if (this.missionT <= 0) done = true;
        break;

      case 'cores':
        done = this.cores.length === 0;
        break;

      case 'targets':
        done = this.gens.length === 0;
        break;

      case 'assault':
        this.waveCool -= dt;
        if (this.enemies.length === 0 && this.waveCool <= 0) {
          if (this.wave >= (m.waves || 3)) done = true;
          else {
            this.wave++;
            this.waveCool = 0.8;
            this.spawnAroundPlayer(m.perWave || 4);
            this.banner('ONDATA ' + this.wave);
            Sfx.boss();
          }
        }
        break;

      default:   /* caccia e boss */
        done = this.enemies.length === 0;
    }

    if (done) {
      this.missionDone = true;
      if (m.type !== 'hunt' && m.type !== 'boss') {
        this.addScore(600);
        Floaters.add(p.cx, p.cy - 26, 'OBIETTIVO +600', '#4dffd5', 16);
      }
      this.openPortal();
    }
  },

  /* mostri che entrano in scena dai lati, appena fuori dalla vista */
  spawnAroundPlayer(count) {
    const lv = this.lv, p = this.player;
    const types = ['crawler', 'flyer', 'spitter', 'charger', 'bomber']
      .slice(0, Math.max(2, Math.min(5, 1 + Math.floor(this.level / 3))));
    for (let i = 0; i < count; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      let tx = Math.floor((p.cx + side * (this.viewW * 0.55 + Math.random() * 90)) / TILE);
      tx = clamp(tx, 3, lv.w - 4);
      const gy = lv.groundY[tx];
      const type = types[Math.floor(Math.random() * types.length)];
      const y = (gy > 0 ? gy - 3 : Math.floor(lv.h * 0.5)) * TILE;
      this.spawnEnemy(type, tx * TILE, y, eliteRoll(Math.random, this.level, type));
    }
  },

  overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },
  /* colpo contro il giocatore: da accovacciato i proiettili alti devono passare
     davvero sopra la testa, altrimenti abbassarsi non servirebbe a nulla */
  hitPlayer(b, p) {
    const top = p.crouch ? p.y + b.r * 1.4 : p.y - b.r;
    return b.x > p.x - b.r && b.x < p.x + p.w + b.r &&
           b.y > top && b.y < p.y + p.h + b.r;
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
    const cp = this.progress.cp, canResume = !!cp && this.mode === 'campaign';
    const rb = document.getElementById('ovResumeBtn');
    rb.classList.toggle('hidden', !canResume);
    if (canResume) document.getElementById('ovCp').textContent = cp.level;
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
    /* la carica della lanterna */
    const amp = this.ampere ? Math.round(this.ampere.charge) : -1;
    if (c.amp !== amp) {
      c.amp = amp;
      const box = document.getElementById('ampHud');
      if (box) {
        box.classList.toggle('hidden', amp < 0);
        if (amp >= 0) {
          document.getElementById('ampFill').style.width = amp + '%';
          document.getElementById('ampState').textContent =
            amp >= 100 ? 'AMPERE CARICA' : 'AMPERE ' + amp + '%';
        }
      }
    }

    /* chi sta combattendo, e quanto manca al cambio */
    const chi = this.canSwap ? (HEROES[this.hero] || HEROES.aren).name + (this.swapCd > 0 ? ' ' + Math.ceil(this.swapCd) : '') : '';
    if (c.chi !== chi) {
      c.chi = chi;
      const el = document.getElementById('heroTag');
      if (el) { el.textContent = chi; el.classList.toggle('hidden', !chi); }
    }

    const heat = Math.round(p.overheat > 0 ? 100 : p.heat);
    if (c.heat !== heat) { c.heat = heat; document.getElementById('heatbar').style.width = heat + '%'; }
    if (c.score !== this.score) { c.score = this.score; document.getElementById('score').textContent = this.score; }

    const md = MISSIONS[(this.mission || {}).type] || MISSIONS.hunt;
    const tot = (this.mode === 'campaign' && this.level <= ATTO1_FINE) ? '/' + ATTO1_FINE : '';
    const lvName = this.lv.boss
      ? (this.mode === 'campaign' && this.level === ATTO1_FINE ? 'IL DIVORATORE' : this.bossName() + ' ' + this.level + tot)
      : 'SETTORE ' + this.level + tot + ' · ' + (this.lawDef ? this.lawDef.name : missionName((this.mission || {}).type));
    if (c.lvName !== lvName) { c.lvName = lvName; document.getElementById('levelName').textContent = lvName; }

    let tg;
    if (this.portalOn) tg = '➜ PORTALE';
    else {
      const m = this.mission || { type: 'hunt' };
      if (m.type === 'escape') tg = 'SCAPPA!';
      else if (m.type === 'survive') tg = 'RESISTI ' + Math.ceil(this.missionT) + 's';
      else if (m.type === 'cores') tg = 'FRAMMENTI ' + (m.need - this.cores.length) + '/' + m.need;
      else if (m.type === 'targets') tg = 'GENERATORI ' + (m.need - this.gens.length) + '/' + m.need;
      else if (m.type === 'assault') tg = 'ONDATA ' + Math.max(1, this.wave) + '/' + (m.waves || 3);
      /* corto per forza: andando a capo tre volte finiva sopra la barra della
         vita di ECHO-0. Che te l'abbia rubato lo dicono gia' il banner e la
         scritta che sale dal giocatore — qui basta ricordare cosa manca. */
      else if (m.type === 'echo') tg = this.rubato ? '− ' + this.nomeRubato() : 'ECHO-0';
      else tg = 'MOSTRI ' + this.enemiesLeft;
    }
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
    const voltText = rush ? 'VOLT RUSH ' + this.rushT.toFixed(1) + 's'
      : (this.volt >= 100 ? (Input.touchMode ? 'VOLT PRONTO — PREMI VOLT' : 'VOLT PRONTO — PREMI E')
                          : 'CARICA VOLT ' + volt + '%');
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
    if (lv.ombre && lv.ombre.length) this.drawOmbre(ctx, camX, camY, lv);
    this.drawTiles(ctx, camX, camY, lv);
    if (this.state !== 'menu') {
      this.drawPortal(ctx, camX, camY, lv);
      if (this.stormOn) this.drawStorm(ctx, camX);
      for (const g of this.gens) g.draw(ctx, camX, camY);
      for (const c of this.cores) c.draw(ctx, camX, camY);
      for (const sh of this.ships) sh.draw(ctx, camX, camY);
      for (const q of this.pickups) q.draw(ctx, camX, camY);
      for (const c of this.cariche) c.draw(ctx, camX, camY);
      for (const e of this.enemies) e.draw(ctx, camX, camY);
      for (const b of this.bullets) b.draw(ctx, camX, camY);
      this.drawExplosions(ctx, camX, camY);
      if (this.drone) this.drone.draw(ctx, camX, camY);
      if (this.ampere) this.ampere.draw(ctx, camX, camY);
      if (this.player) this.player.draw(ctx, camX, camY);
    }
    Particles.draw(ctx, camX, camY);
    Rings.draw(ctx, camX, camY);
    Floaters.draw(ctx, camX, camY);
    if (this.law === 'dark' && this.state !== 'menu') this.drawDark(ctx, camX, camY);
    if (this.state !== 'menu') {
      this.drawBossBar(ctx);
      this.drawOffscreenHints(ctx, camX, camY, lv);
    }
    if (this.furto) this.drawFurto(ctx, camX, camY);
    if (this.cella) this.drawCella(ctx, camX, camY);
    if (this.vign.length) this.drawRiquadri(ctx);
    if (this.blackT > 0) this.drawBlackout(ctx);
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

    /* Se il mondo ha un fondale dipinto, si usa quello: e' la stessa immagine
       delle tavole di riferimento, quindi il settore ha l'aria dei render
       invece delle colline disegnate a mano. Scorre piu' lento del terreno e
       si specchia a ogni ripetizione, cosi la giuntura non si vede. */
    const sf = Sfondi.get(th.sfondo);
    if (sf) {
      const h = H * 1.25, w = sf.naturalWidth * (h / sf.naturalHeight);
      const yk = clamp(camY / Math.max(1, lv.pxH - H), 0, 1);
      const y = -(h - H) * yk;
      const passo = w * 2;
      let off = -(camX * 0.16) % passo;
      if (off > 0) off -= passo;
      for (let x = off; x < W; x += w) {
        const k = Math.round((x - off) / w);
        ctx.save();
        if (k % 2) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(sf, 0, 0, w, h); }
        else ctx.drawImage(sf, x, y, w, h);
        ctx.restore();
      }
      /* un velo: senza, i personaggi disegnati si perdono dentro il dipinto */
      ctx.fillStyle = th.velo || 'rgba(24,10,52,0.30)';
      ctx.fillRect(0, 0, W, H);
      /* il pulviscolo resta: da' profondita' all'aria */
      ctx.save();
      ctx.fillStyle = '#ffffff';
      for (const m of lv.motes) {
        const mx = (m.x * W * 1.6 - camX * 0.35 + Math.sin(this.portalT * 0.4 + m.ph) * 20) % (W + 60);
        const px2 = mx < -30 ? mx + W + 60 : mx;
        const py2 = (m.y * H + Math.sin(this.portalT * m.sp * 0.08 + m.ph) * 16);
        ctx.globalAlpha = 0.20 + Math.sin(this.portalT * 1.4 + m.ph) * 0.1;
        ctx.beginPath(); ctx.arc(px2, py2, m.r, 0, TAU); ctx.fill();
      }
      ctx.restore();
      return;
    }

    const g = ctx.createLinearGradient(0, 0, 0, Math.max(2, horizon));
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* sole morbido — dentro la Frattura non c'e' nessun sole */
    if (!th.frattura) {
      const sunX = W * 0.78, sunY = Math.max(60, horizon * 0.2);
      Gfx.light(ctx, sunX, sunY, 150, th.accent, 0.5);
      ctx.save();
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, TAU); ctx.fill();
      ctx.restore();
    }

    /* nuvole — o, nella Frattura, i massi che galleggiano lontano */
    ctx.save();
    ctx.fillStyle = th.frattura ? '#25123f' : '#ffffff';
    for (const c of lv.clouds) {
      let cx = (c.x * W * 2.4 - camX * 0.06 - this.portalT * c.spd) % (W + 320);
      const x = cx < -160 ? cx + W + 320 : cx;
      const y = horizon * c.y + 20, s = c.s;
      ctx.globalAlpha = th.frattura ? 0.8 : 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 62 * s, th.frattura ? 34 * s : 24 * s, th.frattura ? 0.12 : 0, 0, TAU);
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

  /* La sagoma di ECHO-0 in lontananza. E' disegnata PRIMA del terreno, quindi
     gli passa dietro: e' quello che la fa leggere come lontana. Niente occhi
     accesi e niente colori: solo la forma, i nastri e le schegge. Chi ha
     combattuto al settore 24 la riconosce al primo sguardo. */
  drawOmbre(ctx, camX, camY, lv) {
    const t = this.portalT;
    for (const om of lv.ombre) {
      if (om.fatta || om.k <= 0.01) continue;
      const x = om.x - camX, y = om.y - camY;
      if (x < -140 || x > this.viewW + 140) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.9, 0.9);
      ctx.globalAlpha = om.k * 0.85;
      /* un alone scuro dietro: senza, la sagoma nera sparisce dentro il viola
         del fondale dipinto */
      const alone = ctx.createRadialGradient(0, 0, 8, 0, 0, 72);
      alone.addColorStop(0, 'rgba(16,6,38,0.75)');
      alone.addColorStop(1, 'rgba(16,6,38,0)');
      ctx.fillStyle = alone;
      ctx.beginPath(); ctx.arc(0, 0, 72, 0, TAU); ctx.fill();

      /* i nastri, che si muovono da soli */
      ctx.strokeStyle = '#6b3aa8'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (const lato of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const f = i / 8;
          const nx = lato * (14 + f * 44);
          const ny = -8 + Math.sin(t * 2.4 + f * 4 + lato) * 15 * f + f * 10;
          if (i === 0) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny);
        }
        ctx.stroke();
      }

      /* le schegge in orbita */
      ctx.fillStyle = '#1b0f36';
      for (let i = 0; i < 7; i++) {
        const a = t * (0.6 + i * 0.1) + i * 0.9;
        const r = 32 + Math.sin(t * 1.4 + i) * 7;
        const g2 = 3.5 + (i % 3) * 2;
        ctx.save();
        ctx.translate(Math.cos(a) * r, Math.sin(a) * r * 0.75);
        ctx.rotate(a * 1.7);
        ctx.beginPath();
        ctx.moveTo(0, -g2); ctx.lineTo(g2 * 0.6, 0); ctx.lineTo(0, g2); ctx.lineTo(-g2 * 0.6, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      /* Il corpo: la stessa sagoma dello scontro, piena e senza dettagli. Il
         contorno e' chiaro, non scuro — su un fondale viola un corpo nero col
         bordo nero sparisce, ed e' la stessa regola che vale per lui. */
      ctx.fillStyle = '#1b0f36';
      ctx.strokeStyle = '#a678ff'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
      /* le braccia, appena accennate: si vede che sono diverse fra loro */
      roundRect(ctx, -32, -8, 16, 16, 6); ctx.fill(); ctx.stroke();
      roundRect(ctx, 16, -6, 17, 12, 5); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(17, -6); ctx.lineTo(13, 24);
      ctx.lineTo(0, 30); ctx.lineTo(-13, 24); ctx.lineTo(-17, -6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      /* la testa */
      ctx.beginPath();
      ctx.moveTo(0, -40); ctx.lineTo(11, -30); ctx.lineTo(8, -22);
      ctx.lineTo(-8, -22); ctx.lineTo(-11, -30);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      /* E i due occhi, gli unici punti accesi. Il verso e' quello di sempre:
         rosso alla nostra sinistra, ciano alla nostra destra. */
      ctx.globalAlpha = om.k;
      Gfx.light(ctx, -5, -30, 11, '#ff3b5c', 0.7);
      Gfx.light(ctx, 5, -30, 11, '#38e8ff', 0.7);
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath(); ctx.ellipse(-5, -30, 2.6, 3.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#38e8ff';
      ctx.beginPath(); ctx.ellipse(5, -30, 2.6, 3.4, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
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
          /* quando la legge le spegne restano un contorno: si vede dove
             tornerebbero, ma non ci si appoggia */
          if (this.platsOff) ctx.globalAlpha = 0.22;
          const left = lv.tileAt(x - 1, y) !== T_PLAT, right = lv.tileAt(x + 1, y) !== T_PLAT;
          const ext = (left ? 2 : 0) + (right ? 2 : 0);
          ctx.fillStyle = 'rgba(20,14,45,.20)';
          roundRect(ctx, px - (left ? 2 : 0), py + 4, TILE + ext, 12, 6); ctx.fill();
          ctx.fillStyle = th.plat;
          roundRect(ctx, px - (left ? 2 : 0), py, TILE + ext, 13, 6.5); ctx.fill();
          Gfx.gloss(ctx, px + 3, py + 2, TILE - 6, 4, 0.4);
          ctx.globalAlpha = 1;
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

  /* Ogni Comandante prende il nome dall'area che presidia: e' quello che il
     gioco mostra gia', visto che il paesaggio cambia ogni cinque settori. */
  /* Il nome sopra la barra. Chi c'e' davvero conta piu' del numero del settore:
     nei settori della caccia la missione e' un'altra, ma quello che ti sta
     addosso e' lui. */
  bossName(chi) {
    if (chi && chi.type === 'echo') return 'ECHO-0';
    if (this.mission && this.mission.type === 'echo') return 'ECHO-0';
    if (this.mode === 'campaign') {
      if (this.level === ATTO1_FINE) return 'IL DIVORATORE';
      const nomi = { 5: 'COMANDANTE DELLA PRATERIA', 10: 'COMANDANTE DEL DESERTO',
                     15: 'COMANDANTE DELLA LAGUNA' };
      if (nomi[this.level]) return nomi[this.level];
    }
    return 'COMANDANTE';
  },

  drawBossBar(ctx) {
    const boss = this.enemies.find(e => (e.type === 'boss' || e.type === 'echo') && !e.dead && e.awake);
    if (!boss) return;
    const w = Math.min(this.viewW * 0.66, 400), x = (this.viewW - w) / 2, y = 100;
    const frac = clamp(boss.hp / boss.maxHp, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(24,18,50,.5)';
    roundRect(ctx, x - 5, y - 5, w + 10, 20, 10); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    if (boss.type === 'echo') { g.addColorStop(0, '#8a4fd8'); g.addColorStop(1, '#38e8ff'); }
    else { g.addColorStop(0, '#ff8a5c'); g.addColorStop(1, '#ff4d7d'); }
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w * frac, 10, 5); ctx.fill();
    if (w * frac > 10) Gfx.gloss(ctx, x + 3, y + 1.5, w * frac - 6, 3, 0.45);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = '800 11px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(this.bossName(boss), this.viewW / 2, y - 10);
    ctx.restore();
  },

  drawOffscreenHints(ctx, camX, camY, lv) {
    const marks = [];
    for (const sh of this.ships) marks.push({ x: sh.cx, y: sh.cy, col: '#8ff0ff' });
    for (const c of this.cores) marks.push({ x: c.cx, y: c.cy, col: '#66ffe0' });
    for (const g of this.gens) marks.push({ x: g.cx, y: g.cy, col: '#ffc247' });
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

  /* il muro di tempesta che insegue: bordo elettrico e buio dietro */
  /* legge BUIO: il mondo si spegne e resta acceso solo quello che emette
     luce — tu, i mostri, i colpi, il portale. Si disegna su una tela a parte
     e poi si appoggia sopra: cosi il buio non cancella la scena, la copre. */
  drawDark(ctx, camX, camY) {
    const W = Math.ceil(this.viewW), H = Math.ceil(this.viewH);
    let c = this._darkC;
    if (!c) c = this._darkC = document.createElement('canvas');
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const d = c.getContext('2d');
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.globalAlpha = 1;
    d.clearRect(0, 0, W, H);
    d.fillStyle = 'rgba(7,4,22,0.94)';
    d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const tex = Gfx.glowTex('#ffffff');
    const buco = (x, y, r, a) => {
      if (x < -r || x > W + r || y < -r || y > H + r) return;
      d.globalAlpha = a;
      d.drawImage(tex, x - r, y - r, r * 2, r * 2);
    };
    const p = this.player;
    if (p) buco(p.cx - camX, p.cy - camY, p.riding ? 210 : 165, 1);
    for (const e of this.enemies) buco(e.cx - camX, e.cy - camY, e.w * 1.9, 0.8);
    for (const b of this.bullets) buco(b.x - camX, b.y - camY, 34, 0.85);
    for (const q of this.pickups) buco(q.x + 10 - camX, q.y + 10 - camY, 46, 0.7);
    for (const g of this.gens) buco(g.x - camX, g.y - camY, 70, 0.7);
    for (const co of this.cores) buco(co.x - camX, co.y - camY, 70, 0.75);
    if (this.ampere) buco(this.ampere.x - camX, this.ampere.y - camY, this.ampere.luce, 0.95);
    for (const c of this.cariche) buco(c.x - camX, c.y - camY, 40, 0.7);
    if (this.portalOn) buco(this.lv.portalX - camX, this.lv.portalY - camY, 120, 0.9);
    d.globalAlpha = 1;
    ctx.drawImage(c, 0, 0, this.viewW, this.viewH);
  },

  /* Le vignette. Si disegnano sullo schermo, non nel mondo: stanno in alto,
     sotto il cruscotto e sopra la testa del giocatore, e non coprono mai il
     terreno su cui si combatte. Se il disegno non c'e' ancora, la vignetta si
     disegna in codice: il gioco funziona lo stesso, e quando il file arriva
     prende il suo posto senza toccare niente. */
  drawRiquadri(ctx) {
    const W = this.viewW;
    const larg = Math.min(132, W * 0.40), alt = larg * 0.86;
    for (const v of this.vign) {
      /* entra di scatto, resta, e se ne va scivolando in su */
      const ap = clamp(v.t / 0.16, 0, 1);
      const via = clamp((v.t - (v.dur - 0.3)) / 0.3, 0, 1);
      const sc = (0.6 + ap * 0.4) * (1 - via * 0.25);
      const cx = W / 2 + v.lato * (larg * 0.56);
      const cy = 196 - via * 30;

      ctx.save();
      ctx.globalAlpha = (1 - via);
      ctx.translate(cx, cy);
      ctx.rotate(v.lato * 0.035);
      ctx.scale(sc, sc);

      /* la cornice: bordo spesso scuro, come un riquadro disegnato */
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#0e0a22';
      roundRect(ctx, -larg / 2, -alt / 2, larg, alt, 7); ctx.fill();
      ctx.restore();

      /* il contenuto, ritagliato dentro la cornice */
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, -larg / 2 + 4, -alt / 2 + 4, larg - 8, alt - 8, 4);
      ctx.clip();
      const img = Fumetti.get(v.tipo === 'rapito'
        ? 'grido_' + (this.hero === 'aren' ? 'lyra' : 'aren')
        : 'furto_lanterna');
      if (img) {
        /* il disegno vero, riempiendo il riquadro senza deformarlo */
        const r = Math.max((larg - 8) / img.naturalWidth, (alt - 8) / img.naturalHeight);
        ctx.drawImage(img, -img.naturalWidth * r / 2, -img.naturalHeight * r / 2,
                      img.naturalWidth * r, img.naturalHeight * r);
      } else {
        this.riquadroDisegnato(ctx, v, larg, alt);
      }
      ctx.restore();

      /* la cornice chiara sopra al taglio */
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#f4efff';
      roundRect(ctx, -larg / 2 + 2, -alt / 2 + 2, larg - 4, alt - 4, 6); ctx.stroke();

      /* la nuvoletta del rapito: bianca col testo scuro - chi parla e' un
         Custode, non una creatura, e si deve vedere dal colore */
      if (v.grido && v.t > 0.18) {
        const g = clamp((v.t - 0.18) / 0.14, 0, 1);
        ctx.save();
        ctx.translate(0, -alt / 2 - 10);
        ctx.scale(g, g);
        ctx.font = '800 15px Nunito, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(v.grido).width + 20;
        ctx.lineWidth = 3; ctx.strokeStyle = '#20183f'; ctx.fillStyle = '#ffffff';
        roundRect(ctx, -w / 2, -13, w, 25, 11); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-6, 10); ctx.lineTo(2, 22); ctx.lineTo(6, 10);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#241a4d';
        ctx.fillText(v.grido, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }
  },

  /* Il ripiego, finche' i disegni non ci sono: la stessa scena ridisegnata in
     codice, ingrandita. Non e' bella come un fumetto vero, ma si capisce. */
  riquadroDisegnato(ctx, v, larg, alt) {
    const t = v.t;
    /* fondo a raggiera: e' un dettaglio, e si vede che e' un dettaglio */
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, larg * 0.8);
    g.addColorStop(0, v.tipo === 'rapito' ? '#4a2c86' : '#123a2c');
    g.addColorStop(1, '#0e0a22');
    ctx.fillStyle = g;
    ctx.fillRect(-larg, -alt, larg * 2, alt * 2);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = v.tipo === 'rapito' ? '#b06bff' : '#5effa8';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + t * 0.4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
      ctx.lineTo(Math.cos(a) * larg, Math.sin(a) * larg); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(0, 4);
    if (v.tipo === 'rapito') {
      ctx.scale(3.1, 3.1);
      /* trema: sta chiamando */
      ctx.translate(Math.sin(t * 26) * 0.7, 0);
      drawRapito(ctx, rapito(), t);
    } else {
      /* la lanterna, e la mano scura che la prende */
      ctx.scale(3.4, 3.4);
      Gfx.light(ctx, 0, 0, 30, '#5effa8', 0.9);
      ctx.lineWidth = 2.2; ctx.strokeStyle = OUTLINE;
      ctx.beginPath(); ctx.arc(0, -13, 5, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#3b4a7a';
      roundRect(ctx, -8, -11, 16, 5, 2.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(120,255,190,.35)';
      roundRect(ctx, -7, -7, 14, 15, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#eafff2';
      ctx.beginPath(); ctx.arc(0, 1, 3.2 + Math.sin(t * 8) * 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3b4a7a';
      roundRect(ctx, -8, 7, 16, 4, 2); ctx.fill(); ctx.stroke();
      /* le dita nere che si chiudono da destra */
      const chiude = clamp((t - 0.2) / 0.6, 0, 1);
      ctx.fillStyle = '#150c2e';
      for (let i = 0; i < 3; i++) {
        const yy = -7 + i * 7;
        ctx.save();
        ctx.translate(17 - chiude * 9, yy);
        ctx.rotate(-chiude * 0.5 + i * 0.16);
        roundRect(ctx, 0, -2.4, 13, 4.8, 2.4); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  },

  /* La cella con dentro il custode rapito. Cade dal Comandante, resta un
     attimo a terra — abbastanza per vedere chi c'e' dentro — e poi i viticci
     viola del Divoratore la afferrano e se la portano via.
     Nessuna scritta: vale la stessa regola della lanterna. Chi guarda lo vede,
     e al ventesimo settore capisce a chi l'ha portata. */
  drawCella(ctx, camX, camY) {
    const c = this.cella, t = c.t;
    const x = c.x - camX, y = c.y - camY;
    const k = c.presa ? (t - 2.6) / 2.1 : 0;

    /* i viticci: arrivano da destra, dal buio */
    if (t > 2.05) {
      const avanti = clamp((t - 2.05) / 0.55, 0, 1);
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 16;
        ctx.strokeStyle = i === 1 ? '#7a3fd6' : '#4a2c86';
        ctx.lineWidth = 9 - i * 1.5;
        ctx.globalAlpha = clamp(0.9 - k * 1.1, 0, 1);
        ctx.beginPath();
        const dax = this.viewW + 90;
        ctx.moveTo(dax, y + off);
        const passi = 8;
        for (let j = 1; j <= passi; j++) {
          const f = j / passi;
          const px = lerp(dax, x + 14, f * avanti);
          const py = y + off * (1 - f) + Math.sin(t * 4 + f * 5 + i) * 9 * (1 - f);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = clamp(1 - (k - 0.7) / 0.3, 0, 1);
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 2.4) * 0.12 + k * 0.5);
    /* piu' se ne va, piu' e' piccola: sta sparendo nel buio */
    const sc = 1 - k * 0.45;
    ctx.scale(sc, sc);
    drawCellaRapito(ctx, t, c.presa ? 3.4 : 1.6);
    ctx.restore();
  },

  /* Il furto della lanterna. Nessuna scritta, nessuna spiegazione: la luce
     verde sale dal Comandante caduto, una sagoma la attraversa e non c'e' piu'.
     Chi lo vede se lo ricorda; chi non lo vede lo capira' al settore 21. */
  drawFurto(ctx, camX, camY) {
    const f = this.furto, t = f.t;
    const x = f.x - camX;
    /* 0 - 1.4s: la luce sale piano */
    const salita = Math.min(1, t / 1.4);
    const y = f.y - camY - salita * 120;
    if (t < 1.9) {
      const a = t < 0.3 ? t / 0.3 : 1;
      Gfx.light(ctx, x, y, 78 + Math.sin(t * 6) * 10, '#5effa8', 0.95 * a);
      Rings.list.length < 20 && t < 0.06 && Rings.add(f.x, f.y, '#5effa8', 120, 0.5, 5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y);
      ctx.scale(1.7, 1.7);
      ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE;
      ctx.fillStyle = '#3b4a7a';
      roundRect(ctx, -8, -12, 16, 5, 2.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(120,255,190,.35)';
      roundRect(ctx, -7, -8, 14, 15, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#eafff2';
      ctx.beginPath(); ctx.arc(0, 0, 3.4 + Math.sin(t * 9) * 0.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
    /* 1.5 - 2.1s: qualcosa attraversa lo schermo e se la porta via */
    if (t > 1.5 && t < 2.2) {
      const k = (t - 1.5) / 0.7;
      const sx = -140 + k * (this.viewW + 300);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.ellipse(sx, y + 6, 54, 22, -0.15, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(sx - 70, y + 6, 60, 12, -0.1, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (k > 0.45 && !f.presa) {
        f.presa = true;
        Particles.burst(x, y, 14, '#5effa8', 200, 4, 0);
        Sfx.noise(0.22, 0.09, 900, 90);
      }
    }
  },

  /* Il calo di tensione: due sbattute di buio e poi il mondo che torna piano.
     Non e' una legge della Frattura, e' Lumina che sta finendo la corrente. */
  drawBlackout(ctx) {
    const k = 1 - this.blackT / BLACK_TIME;
    let a;
    if (k < 0.07) a = 0.9;
    else if (k < 0.13) a = 0.12;
    else if (k < 0.23) a = 0.95;
    else a = 0.95 * Math.max(0, 1 - (k - 0.23) / 0.6);
    if (a <= 0.01) return;
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,20,' + a.toFixed(3) + ')';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.restore();
  },

  drawStorm(ctx, camX) {
    const x = this.stormX - camX;
    if (x < -260 || x > this.viewW + 60) return;
    const t = this.portalT;
    ctx.save();
    /* tutto ciò che sta dietro è perduto */
    const back = ctx.createLinearGradient(x - 240, 0, x + 60, 0);
    back.addColorStop(0, 'rgba(38,8,70,.95)');
    back.addColorStop(0.7, 'rgba(120,30,160,.75)');
    back.addColorStop(1, 'rgba(210,90,230,0)');
    ctx.fillStyle = back;
    ctx.fillRect(x - 260, 0, 320, this.viewH);

    /* fronte elettrico */
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(232,150,255,.85)';
    ctx.lineWidth = 3;
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      for (let y = -10; y < this.viewH + 10; y += 26) {
        const j = Math.sin(y * 0.05 + t * (7 + b * 3) + b) * (10 + b * 6);
        if (y < 0) ctx.moveTo(x + j, y); else ctx.lineTo(x + j, y);
      }
      ctx.globalAlpha = 0.5 - b * 0.12;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
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
