# Brainfuck Lab — extindere în opt direcții

## Contractul produsului

Fiecare algoritm, exercițiu, desen și demonstrație are sursa `.bf` disponibilă.
JavaScript interpretează și vizualizează; nu înlocuiește logica exemplelor.
Nu există execuție publică pe VPS, conturi noi sau clasament global neverificat.
Păstrăm autentificarea, CSP, no-store/no-transform și toate limitele existente.

## Ordinea de implementare și criteriile de acceptare

1. **Debugger reversibil.** Undo pentru instrucțiuni, input, output și bucle;
   istoric circular limitat, cronologie navigabilă, celule modificate și explicația
   ultimului pas. Resetarea/editarea invalidează istoricul. Teste inclusiv EOF,
   overflow, pointer wrap și revenirea după terminare.
2. **Profilare.** Frecvență pe instrucțiune, bucle costisitoare, celule accesate,
   număr de celule distincte și distribuție pe operații. Undo corectează și
   contoarele. Comparația a două programe măsoară aceleași inputuri.
3. **Lecții ghidate.** Parcurs progresiv cu exemple BF, exerciții editabile,
   indicii, verificare pe cazuri și predicții despre memorie. Progres local;
   inputul personal nu se persistă.
4. **Provocarea zilei / code golf.** Identitate deterministă după ziua UTC,
   cazuri de verificare, scor separat pentru lungime, pași și memorie; recorduri
   locale validate prin rulare. Soluția se partajează fără input, fără autorun.
5. **Bibliotecă de algoritmi.** Exemple suplimentare pentru Fibonacci, ROT13,
   împărțire, sortare, calculator și joc text, cu domeniu de input, memorie,
   explicații, sursă și teste independente. Exemplele existente rămân disponibile.
6. **Grafică BF.** Octeții emiși de programe BF devin pixeli și cadre. Dimensiuni
   și număr de cadre limitate, redare explicită, pauză și export PNG; se respectă
   reduced motion. Nu se interpretează HTML, SVG sau URL-uri din output.
7. **Optimizator explicabil.** Reguli BF → BF conservatoare, cu jurnalul
   transformărilor și verificare pe inputuri. Comparăm output, bandă finală,
   pointer și consum de input; timeout înseamnă rezultat neconcludent.
8. **Brainfuck în Brainfuck.** Interpretor real în `.bf`, cu parser, dispatch și
   potrivirea buclelor executate în BF. Demonstrație cu program interior și
   memorie limitate, protocol documentat și teste față de mașina de referință.

Etapele independente au commituri separate, cu identitatea Git a proprietarului,
fără semnătură de agent sau coautorat. Nu se face push. La final: verificări
Python/Node/browser, layout 320–1440 px, actualizare SEO/CI și deploy țintit.

## Resurse și securitate

Istoricul stochează diferențe, nu o copie de 30.000 de celule la fiecare pas.
Profilarea folosește contoare limitate la dimensiunea codului/benzii. Cazurile de
test și comparațiile rulează în Worker cu buget per caz și watchdog separat.
Canvas primește numai valori numerice. Share folosește fragment URL; nu include
inputuri sau pornește automat execuția. Înregistrările locale nu sunt identitate,
autentificare sau dovezi pentru un clasament public.

Threat model: DoS local prin programe nefinite, injecție în vizualizări și
persistarea involuntară a inputurilor. Limite, terminarea Workerului,
textContent/value și stocarea explicită a codului sunt controalele principale.
Nu se adaugă furnizori sau acces la datele private. Runbook-ul existent din
OPERATIONS.md rămâne aplicabil; nu se inventează estimări financiare sau SLA-uri.

## Stare

Implementarea începe de la commitul `bfba1c4`. Rezultatele și limitele efective
vor fi completate după testarea fiecărei etape.
