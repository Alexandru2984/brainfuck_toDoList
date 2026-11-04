# Brainfuck Lab — plan de produs

Extinderea educațională este în [EXPANSION.md](EXPANSION.md), iar continuarea cu
terminal și programe conversaționale BF este în [INTERACTIVE.md](INTERACTIVE.md).

Principiu: programele, exemplele, provocările și transformările sunt Brainfuck.
Python asigură HTTP, criptografie și persistență; JavaScript asigură editorul și
mașina virtuală din browser. Nu adăugăm un framework pentru o interfață care nu
are nevoie de el și nu prezentăm obfuscarea BF drept criptografie.

## Etapele acestei livrări

1. **Audit și protecția datelor.** Inventar, backup consistent, threat model și
   plan verificabil. Commit separat de codul existent.
2. **Securitate.** Login BF corect, sesiuni revocabile, throttle atomic,
   criptare fail-closed, Unicode, validare strictă, limite și teste de regresie.
3. **Workspace privat.** Priorități, termene, etichete, filtrare, sortare,
   paginare, editare cu textul curent, duplicare și reordonare accesibilă;
   transformarea și prezentarea textului rămân în Brainfuck.
4. **Laborator public.** Editor, execuție locală în Worker, run/pause/step/reset,
   breakpoints, bandă de memorie, output UTF-8/hex, statistici, exemple BF reale,
   provocări verificate pe cazuri multiple, referința celor opt instrucțiuni,
   import/export `.bf`, partajare prin fragment URL și draft local opțional.
   Nu se execută cod public pe VPS și nu se salvează input privat în share URL.
5. **Finisare.** Mobile/desktop și tastatură, teme, reduced motion, SEO numai pe
   paginile publice, CI cu permisiuni minime, teste Python/VM/browser,
   dependency audit, restart țintit și verificare prin domeniu.

Fiecare etapă funcțională are commit cu identitatea Git existentă a proprietarului,
fără semnătură de agent și fără Co-authored-by. Modificările inițiale sunt
integrate în etapa relevantă. Se verifică local înainte de restart și nu se face
push sau rescriere de istoric în această livrare.

## Următoarele iterații

- Lecții ghidate, cu explicații despre bucle și reprezentarea octeților;
  traducere completă RO/EN.
- Puzzle zilnic determinist, colecții de programe și linkuri către soluții;
  partajarea publică persistentă ar necesita moderare și bugete anti-abuz.
- Optimizator BF explicabil și comparație pas cu pas între programe echivalente.
- Vizualizare de transfer între celule și mod de prezentare pentru profesori.
- Conturi individuale / passkeys și workspace-uri izolate, numai după definirea
  modelului de conturi, recuperării și politicii de date.
- Backup automat criptat, exercițiu de restaurare programat și alertare la
  erori; necesită alegerea destinației de backup și canalului operatorului.

Acestea sunt propuneri viitoare, nu funcții declarate ca implementate.

## Livrarea din 4 noiembrie 2026

Etapele 1–5 sunt implementate, comise și publicate. Verificări locale: 56 Python,
22 VM, 12 browser; verificări live: laborator, worker, mobile, autentificare și
revocare după logout. SEO/CI sunt în repository; rularea GitHub Actions necesită
push, care nu a fost făcut. Propunerile din „Următoarele iterații” rămân backlog.

## Extinderea educațională

Cele opt direcții din EXPANSION.md sunt implementate: debugger reversibil,
profilare, 12 lecții, puzzle zilnic/code golf, colecție de 18 programe, grafică BF,
optimizator/comparator și interpretor BF scris în BF. Exemplele anterioare rămân
funcționale. Rămân în backlog conturile individuale, traducerea completă EN,
backupul off-host și alertarea către operator.
