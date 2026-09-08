# VOLT — Run & Gun

Gioco arcade a piattaforme per browser: corri, salti e spari attraverso **settori generati a caso, infiniti**, pieni di mostri. Ogni 5 settori c'è un boss. Gira su PC (tastiera + mouse) e su telefono, dove si comanda a gesti con i due pollici: nessun tasto a schermo.

Niente librerie, niente build, niente server: sono file statici puri.

## Come si gioca

Sul telefono: sfera al plasma in basso a sinistra (tieni il pollice premuto e spingi nella direzione), SALTA e SPARA in basso a destra.

| | PC | Telefono |
|---|---|---|
| Muoversi | `A` `D` o frecce | sfera al plasma: pollice premuto e spingi |
| Saltare (doppio) | `SPAZIO` o `W` | pulsante SALTA; premuto due volte = doppio salto; tenuto premuto = salto più alto |
| Sparare | click sinistro o `J` | pulsante SPARA |
| Mirare | mouse | automatica, sul mostro più vicino |
| Scatto | `SHIFT` o `K` | doppio tocco sulla sfera |
| Abbassarsi (schiva i colpi) / scendere da una piattaforma | `S` / giù | spingi la sfera in basso |
| Pausa | `ESC` o `P` | tasto in alto a destra |

Con la tastiera si spara dritto davanti a sé; con il mouse si mira dove punta il cursore. Il gioco capisce da solo quale dei due stai usando.

**Vite.** Si parte con tre cuori. Ogni **8.000 punti** si conquista una vita; se sei già al massimo, il premio alza il massimo stesso (fino a sei cuori). Il boss lascia un cuore dorato che alza il massimo, e quando resti a una sola vita i mostri lasciano cadere più cuori.

**Missioni.** Dal terzo settore ognuno pesca una missione diversa: caccia (elimina tutti), sopravvivenza (resisti mentre arrivano ondate), sovraccarico (raccogli tre nuclei), bersagli (distruggi i generatori), assalto (respingi tre ondate), fuga (il portale e' gia' aperto ma un muro di tempesta avanza da sinistra e divora tutto). Il portale si apre quando l'obiettivo è compiuto.

**VOLT Rush a comando.** La barra si carica combattendo; quando è piena il Rush non parte da solo: lo attivi tu con `E` (o col tasto VOLT che compare sul telefono), scegliendo il momento.

**Navicella.** Un settore su tre, dal terzo in poi, ne ha una parcheggiata a mezz'aria: raccogliendola resta in attesa finche' non la chiami con `Q` (o col tasto NAVE), anche settori dopo. Una volta chiamata si vola per 15 secondi. In volo la sfera comanda anche la salita e la discesa, SALTA diventa BOOST e i cannoni sparano doppio. Lo scafo regge tre colpi: quando finisce, o quando finisce il carburante, torni a terra senza perdere vite.

Regola del settore: **uccidi tutti i mostri**, il portale si apre, entraci per passare al successivo. Cadere nel vuoto costa una vita ma non la partita: si rientra sull'ultimo appoggio sicuro. Sparare scalda l'arma: se la barra arriva a fondo, il blaster si blocca per un secondo.

## Novità della versione 7

- **VOLT Rush**: eliminazioni, combo, celle energia e trampolini caricano la barra. Al 100% parte automaticamente un sovraccarico di 6,5 secondi con velocità, cadenza, potenza e punteggio raddoppiato.
- **Trampolini VOLT**: nuovi elementi del terreno lanciano il giocatore in alto, ricaricano energia e aprono percorsi più verticali.
- **Bonus di settore**: tempo di completamento e settore senza danni aumentano il premio del portale.
- **Valutazione finale**: grado C/B/A/S e migliore combo nella schermata di fine partita.
- **HUD rinnovato**: avanzamento nel settore, barra VOLT, stato del Rush e gerarchia visiva più leggibile.

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

### Quando modifichi il gioco

Alza di uno il numero in `version.json` **e** il `?v=` nei tag di `index.html`: la pagina si accorge da sola di essere vecchia e si ricarica, altrimenti telefoni e browser continuano a servire i file di prima per una decina di minuti.

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

- `js/entities.js` — `GRAV`, velocità di corsa (`MAXV`), forza del salto (`this.vy = doubleJump ? ... : ...`), cadenza di fuoco delle armi.
- `js/game.js` — `LIFE_EVERY`: ogni quanti punti arriva una vita in più.
- `js/level.js` — `count` (quanti mostri per settore), larghezza dei settori, probabilità di burroni e spine.
- `js/game.js` — `MINW` / `MINH`: quanto mondo si vede a schermo (numeri più piccoli = più zoom).

## Cose già gestite

Doppio tocco e più dita insieme, dito che esce dallo schermo, cambio scheda o telefonata a metà partita (pausa automatica), rotazione dello schermo, ridimensionamento della finestra, `localStorage` bloccato (niente record salvato ma il gioco parte lo stesso), audio bloccato dal browser finché non si tocca lo schermo.
