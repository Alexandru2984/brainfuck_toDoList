# CI: incident din 4 noiembrie 2026

Rularea `41857760055` pe `main` a eșuat exclusiv în jobul `browser`, la
`npx playwright install --with-deps chromium`, înainte de testele Playwright.
Joburile Python 3.13/3.14, lint/format, testele Node și auditurile au trecut.

Runnerul `ubuntu-latest` a devenit Ubuntu 26.04. Versiunea fixată Playwright
1.60.0 refuză instalarea Chromium/dependențelor pe acest sistem:
`Playwright does not support chromium on ubuntu26.04-x64`.

Remediere: jobul browser fixează explicit `ubuntu-24.04`. Versiunile aplicației,
testele și verificările de securitate rămân active. Nu este necesară o schimbare
în producție sau migrarea dependențelor pentru această corecție.

PR-urile Dependabot #1–4 și #6–8 au aceeași eroare de runner. PR #5, care propune
Playwright 1.64.1, are CI verde inclusiv pentru browser pe Ubuntu 26.04; este o
alternativă verificată, nu o actualizare aplicată automat prin această corecție.

- [Rularea eșuată pe main](https://github.com/Alexandru2984/brainfuck_toDoList/actions/runs/41857760055)
- [Rularea verde pentru Playwright 1.64.1](https://github.com/Alexandru2984/brainfuck_toDoList/actions/runs/41857935018)
- [Migrarea oficială ubuntu-latest](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/)

## A doua eroare: încărcarea asincronă a exemplelor

După publicarea `e869dd1`, rularea `41859243794` a instalat browserul și a
executat testele: 26 au trecut, două au eșuat, pe desktop și mobil. Testul UTF-8
aștepta `Salut, 🧠`, dar primea valoarea implicită `Salut, Brainfuck!`.
Joburile Python 3.13/3.14 și auditurile au trecut în continuare.

Cauza este în aplicație: `loadExample()` aplica inputul implicit abia după
descărcarea sursei. Un răspuns întârziat suprascria astfel inputul utilizatorului.
Rezultatul depindea de sincronizare; o rulare verde cu alt browser nu exclude
această eroare.

Corecția aplică inputul implicit imediat la selectare și păstrează editările
ulterioare. Execuția rămâne blocată până la primirea sursei, inclusiv pentru
scurtăturile de tastatură. Editarea codului, resetarea și selectarea altui exemplu
anulează cererea veche; răspunsurile anulate nu pot modifica editorul sau statusul.
Un eșec de rețea deblochează controalele și permite reîncercarea.

Patru regresii Playwright, fiecare pe desktop și mobil, acoperă inputul editat
în timpul descărcării, editarea codului, selecțiile succesive și eroarea HTTP.
Răspunsurile sunt controlate prin interceptarea cererilor, fără temporizări fixe
sau reîncercări care să ascundă problema. Regresia pentru input a reprodus eroarea
înainte de corecție. Verificarea locală folosește Chromium 148 / Playwright v1223,
aceeași versiune instalată de CI pentru Playwright 1.60.0. Pe gazda locală Ubuntu
26.04, instalarea și rularea folosesc `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`,
fără modificarea pachetelor de sistem.

- [Rularea cu cele două erori de input](https://github.com/Alexandru2984/brainfuck_toDoList/actions/runs/41859243794)

Confirmarea finală se face urmărind toate joburile pe GitHub după publicarea
corecției; verificarea locală nu substituie runnerul găzduit.
