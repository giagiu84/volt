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

## La curva di difficolta'

I primi cinque settori sono la porta d'ingresso e restano come sono: servono a
imparare a muoversi. **Dal sesto in poi il gioco si indurisce**, e lo fa in
quattro modi:

- **Élite.** Una parte dei mostri (dal 5% del sesto settore fino al 40% dal
  tredicesimo) arriva temprata. Stessa specie, un vantaggio in piu':
  - **scattante** (dal 6°) — quasi il doppio della velocita', ma meta' vita;
  - **corazzato** (dall'8°) — porta la piastra sul davanti: di fronte i colpi
    scivolano via, alle spalle entrano doppi. Si vede da che parte e' girato;
  - **disturbatore** (dall'11°) — mezzo secondo di scintille e poi una scarica
    che manda in corto il blaster per un attimo. Non fa danno: toglie l'arma.
- **Numeri e statistiche.** Da li' in poi il conto dei mostri, la loro vita e la
  loro velocita' salgono piu' in fretta, e spitter e bombardieri sparano piu'
  spesso.
- **Vite a scalare.** La prima vita a punti arriva presto come prima, ma ognuna
  costa il 25% in piu' della precedente: prima se ne guadagnavano quasi sessanta
  in una campagna, adesso una decina. Il punteggio corre, le vite no.
- **Comandanti.** Dal secondo in poi l'atterraggio manda onde lungo il terreno,
  e ai gradi alti le raffiche sono piu' fitte.

La rete di sicurezza per chi e' in difficolta' (piu' cuori quando resti a una
vita sola) resta intera nei primi cinque settori e si ritira piano dopo.

## Novità della versione 7

- **VOLT Rush**: eliminazioni, combo, celle energia e trampolini caricano la barra. Al 100% parte automaticamente un sovraccarico di 6,5 secondi con velocità, cadenza, potenza e punteggio raddoppiato.
- **Trampolini VOLT**: nuovi elementi del terreno lanciano il giocatore in alto, ricaricano energia e aprono percorsi più verticali.
- **Bonus di settore**: tempo di completamento e settore senza danni aumentano il premio del portale.
- **Valutazione finale**: grado C/B/A/S e migliore combo nella schermata di fine partita.
- **HUD rinnovato**: avanzamento nel settore, barra VOLT, stato del Rush e gerarchia visiva più leggibile.

## Struttura del gioco

**VOLT non è un nome: è il potere.** Due custodi vegliano sul Nucleo di Lumina, Aren e Lyra. Quello che scegli assorbe l'energia e diventa VOLT; l'altro viene catturato dal Divoratore mentre cerca di proteggerlo. Stessi poteri, stessi danni, stessa difficoltà: Aren spara col blaster, Lyra col guanto energetico. Messaggi e finale cambiano nome e genere da soli.

**Campagna** di 20 settori: si insegue il Divoratore, seguendo i frammenti che l'altro protagonista lascia come traccia. Un Comandante ogni cinque settori (5, 10, 15) e lo scontro finale al ventesimo. Dopo ogni Comandante il gioco salva un punto di ripresa: morendo si può ripartire da lì con i poteri conquistati.

**Entrando in ogni portale si sceglie un potenziamento** fra tre pescati a caso; restano per tutta la partita e si sommano. Dopo un Comandante la scelta comprende un potenziamento leggendario (droncino alleato, vampiro elettrico, scudo d'emergenza, brace, arsenale).

**Oltre la Frattura**: finita la campagna si sblocca la modalità infinita, dove i settori non finiscono e conta solo il punteggio. **Ogni tre settori cambia una legge del mondo**, e il mondo diventa un altro:

| Legge | Cosa cambia |
|---|---|
| BASSA GRAVITÀ | la gravità si dimezza: salti lunghissimi, cadute lente, per tutti |
| BUIO | il mondo si spegne, resta acceso solo quello che emette luce: tu, i mostri, i colpi, il portale |
| PIATTAFORME INSTABILI | le piattaforme sospese reggono solo mentre ti muovi; da fermo svaniscono (restano in trasparenza per capire dove torneranno) |
| GIGANTI | metà dei mostri, ma grossi il doppio, con il doppio della vita e un cuore di danno in più |
| ECO | ogni tuo colpo si sdoppia: la copia parte un attimo dopo e arriva più lenta |
| TEMPESTA | il muro viola avanza anche dove non c'è la fuga: non ci si ferma a combattere |
| PIOGGIA DI FUOCO | cade roba dal cielo, sempre vicino a te |

Le leggi escono mescolate: nello stesso giro non se ne ripete nessuna, e il giro dopo l'ordine cambia. Sono sempre le stesse per tutti, come i settori. La campagna dei primi 20 non ne ha: là il mondo è stabile.

Una legge che renderebbe impossibile la missione del settore (la tempesta dove bisogna restare fermi o tornare indietro a raccogliere) viene scartata e si passa alla successiva.

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
