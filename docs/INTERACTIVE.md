# Brainfuck interactiv

Continuarea păstrează toate prompturile, parsarea, comparațiile și calculele în
fișiere `.bf`. Browserul transportă octeții, execută cele opt instrucțiuni și
afișează rezultatul. Fără execuție publică pe VPS și fără dependențe noi.

## Etape

1. **Input incremental în mașina BF.** La `,`, un flux deschis și gol suspendă
   execuția fără pași sau schimbări de memorie. Datele noi o pot continua; EOF
   este explicit și produce zero. Semantica existentă rămâne implicită.
2. **Programe BF pentru terminal.** Ecou UTF-8, conversie zecimală 0–255,
   calculator pe octeți, inspectarea numerică a textului și joc de ghicit.
   Surse reproductibile, validare și cazuri de referință executate în BF.
3. **Terminal public.** Prompturi live, trimitere pe linii sau octeți text,
   pauză/continuare, EOF, oprire, memorie, text/HEX, descărcări și partajarea
   codului fără input sau autorun. Interfață adaptată la mobil și tastatură.
4. **Verificare și livrare.** Regresii VM, programe și Worker real în browser;
   verificări Python, formatare, navigare publică și domeniu după restartul
   serviciului aplicației. CI și SEO primesc integrarea necesară paginii noi.

Fiecare etapă are commit cu identitatea proprietarului, fără coautor sau
atribuire de agent. Publicarea Git a funcțiilor noi rămâne o acțiune separată de
autorizarea precedentă pentru fixul CI.

## Limite și criterii

- 20.000 caractere cod, 30.000 celule, 2 milioane de pași, 4.096 octeți input
  cumulativ și 64 KiB output. Așteptarea inputului nu consumă bugetul de calcul.
- Workerul cedează periodic controlul, iar interfața poate opri imediat rularea.
  Un watchdog oprește un Worker blocat; mesajele și preview-urile sunt limitate.
- Outputul și codul sunt text; nu se interpretează markup sau secvențe terminal
  ca HTML. Nicio persistență a inputului și nicio salvare automată a sursei.
- Cererile de surse întârziate nu suprascriu editările, în acord cu regresiile CI.
- Inputul este UTF-8. Algoritmii de numere procesează cifre ASCII și linii LF;
  limitele și comportamentul EOF/NUL sunt explicate lângă fiecare program.

## Livrat pe 4 noiembrie 2026

Etapele sunt implementate și disponibile la `/terminal`. Colecția are 23 de
programe și filtrează separat categoria Terminal; inputul de probă acceptă mai
multe linii. Navigația publică, metadatele canonice și sitemapul includ pagina.

Programele noi sunt `terminal-echo.bf`, `terminal-decimal.bf`,
`terminal-calculator.bf`, `terminal-bytes.bf` și `terminal-guess.bf`.
Generatorul rulează numai la dezvoltare; nu substituie execuția BF la runtime.
Parserul zecimal acceptă 1–3 cifre ASCII în 0–255 și respinge overflow-ul înainte
de calcul. Jocul are ținta vizibilă 37 și cinci încercări; comparația orientată
spre operandul mic permite cinci răspunsuri 255 în 885.691 de pași. Calculatorul
execută inclusiv 255 × 255 în 1.507.861 de pași, cu rezultat 1 modulo 256.

Verificări locale: 60 teste Python, 103 Node și 56 browser. Cele șase fluxuri de
terminal rulează pe desktop și mobil; verificările comune de layout sunt
separate pentru 320/390/768/1440 px și aleg controale vizibile. Sunt acoperite
încărcarea întârziată a sursei și importului, inputul incremental, EOF, pauza,
oprirea, buclele infinite, exportul binar și share-ul inert. Toate valorile
zecimale 0–255 sunt verificate cu LF și cu zerouri inițiale/EOF. După optimizarea
jocului au trecut din nou cazurile programelor BF, comparațiile pentru fiecare
valoare 0–255 și reproducibilitatea artefactelor. Ruff, Prettier, Bandit,
pip-audit și npm audit au trecut; scanerele nu au raportat vulnerabilități
cunoscute în dependențele verificate.

Livrarea a folosit backup SQLite consistent și un preflight pe clonă cu cheile
de producție, fără afișarea lor. A fost repornit doar `brainfuck-canary`.
Verificările prin Cloudflare, folosind curl și Chromium, au confirmat cele opt
pagini publice, o singură politică CSP, sitemapul, sănătatea bazei și redirectul
anonim al workspace-ului privat. Terminalul real a executat în browser
calculatorul, UTF-8/EOF și cele cinci încercări maxime la 320 px, fără erori de
consolă sau cereri de execuție către server. Evenimentul `pagehide` a eliberat
Workerul și a lăsat disponibilă pornirea unei sesiuni noi.

Commiturile acestei extinderi sunt locale; publicarea și noua rulare GitHub
Actions necesită instrucțiune separată. Ultima verificare CI publicată pentru
fixul anterior este în [CI.md](CI.md).
