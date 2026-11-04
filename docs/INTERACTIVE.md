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
