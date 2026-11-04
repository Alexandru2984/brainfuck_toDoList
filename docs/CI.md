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

Commitul corecției trebuie publicat înainte de a putea confirma o nouă rulare
verde pe GitHub. Testele locale nu substituie verificarea runnerului găzduit.
