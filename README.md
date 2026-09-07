# VOLT — Run & Gun

Gioco arcade a piattaforme per browser: corri, salti e spari attraverso **settori generati a caso, infiniti**, pieni di mostri. Ogni 5 settori c'è un boss. Gira su PC (tastiera + mouse) e su telefono (joystick + tasti a schermo, mira automatica).

Niente librerie, niente build, niente server: sono file statici puri.

## Come si gioca

| | PC | Telefono |
|---|---|---|
| Muoversi | `A` `D` o frecce | joystick a sinistra |
| Saltare (doppio) | `SPAZIO` o `W` | tasto SALTA |
| Sparare | click sinistro o `J` | tasto SPARA |
| Mirare | mouse | automatica (o spingi il joystick) |
| Scatto | `SHIFT` o `K` | tasto DASH |
| Scendere da una piattaforma | `S` / giù | joystick verso il basso |
| Pausa | `ESC` o `P` | tasto in alto a destra |

Regola del settore: **uccidi tutti i mostri**, il portale si apre, entraci per passare al successivo. Cadere nel vuoto costa una vita ma non la partita: si rientra sull'ultimo appoggio sicuro. Sparare scalda l'arma: se la barra arriva a fondo, il blaster si blocca per un secondo.

## Pubblicarlo su un sito

La cartella è già pronta: contiene solo file statici.

- **Sottocartella di un sito esistente** (Aruba, hosting classico via FTP): copia l'intera cartella, per esempio in `/volt/`. Si apre su `https://tuosito.it/volt/`.
- **Netlify**: trascina la cartella su app.netlify.com/drop, oppure collega il repo — nessun comando di build, publish directory = cartella del progetto.
- **GitHub Pages**: metti i file nella root del repo (o in `/docs`) e attiva Pages.

Unico requisito: i file devono stare insieme, con questa struttura.

```
index.html
css/style.css
js/util.js  gfx.js  audio.js  input.js  level.js  entities.js  game.js
```

L'unica risorsa esterna sono i font Google (Fredoka e Nunito): se il sito deve funzionare offline o senza chiamate esterne, togli il `<link>` dei font in `index.html` — il gioco continua a funzionare con i font di sistema.

## Provarlo in locale

Basta aprire `index.html` col browser. Se preferisci un server:

```bash
python -m http.server 5178 --directory .
```

## Com'è fatto

| File | Cosa contiene |
|---|---|
| `js/util.js` | matematica, generatore casuale con seme, particelle, testi fluttuanti, salvataggio record |
| `js/gfx.js` | ombre morbide, luci, capsule, occhi, onde d'urto (tutto precalcolato per non rallentare) |
| `js/audio.js` | suoni e musica sintetizzati con WebAudio: nessun file audio da scaricare |
| `js/input.js` | tastiera, mouse, touch multi-dito, recupero dopo perdita di focus |
| `js/level.js` | generatore dei settori (terreno, burroni, piattaforme, spine, mostri, sfondo) e le 5 palette |
| `js/entities.js` | giocatore, 5 tipi di mostro + boss, proiettili, oggetti, collisioni |
| `js/game.js` | ciclo di gioco, camera, regia, HUD, disegno del mondo |

Un settore è determinato dal suo numero: il settore 7 è sempre lo stesso terreno, per tutti. I mostri e gli oggetti invece si comportano in modo diverso ogni partita.

### Numeri che vale la pena toccare

- `js/entities.js` — `GRAV`, velocità di corsa (`MAXV`), forza del salto, cadenza di fuoco delle armi.
- `js/level.js` — `count` (quanti mostri per settore), larghezza dei settori, probabilità di burroni e spine.
- `js/game.js` — `MINW` / `MINH`: quanto mondo si vede a schermo (numeri più piccoli = più zoom).

## Cose già gestite

Doppio tocco e più dita insieme, dito che esce dallo schermo, cambio scheda o telefonata a metà partita (pausa automatica), rotazione dello schermo, ridimensionamento della finestra, `localStorage` bloccato (niente record salvato ma il gioco parte lo stesso), audio bloccato dal browser finché non si tocca lo schermo.
