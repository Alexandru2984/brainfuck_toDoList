# Audit de securitate — 4 noiembrie 2026

Audit de cod și configurație locală, cu reproduceri pe date sintetice. Nu este o
garanție de absență a vulnerabilităților și nu include un pentest asupra altor
servicii de pe VPS. Nu au fost afișate parole, chei sau taskuri private.

## Constatări inițiale

| ID | Severitate | Problemă confirmată | Remediere planificată |
|---|---|---|---|
| S01 | Critică | Contorul de erori al loginului revine la zero la 256; un candidat incorect poate produce `1`. NUL poate ascunde un sufix. | Brainfuck compară digesturi de lungime fixă, cu indicator de eroare saturat; limită de input. |
| S02 | Ridicată | `InvalidToken` este tratat ca plaintext; pornirea cu cheia greșită recriptează ciphertextul existent și compromite recuperarea. | Versiune explicită de storage, verificare autentificată înainte de orice scriere, migrare atomică. |
| S03 | Ridicată | Verificatorul vechi cu parola recuperabilă există în istoricul Git. | Verificare locală a rotației; rotație dacă parola curentă coincide. Rescrierea istoricului public necesită coordonare separată. |
| S04 | Medie | Primul X-Forwarded-For și CF-Connecting-IP sunt acceptate direct; există cale de ocolire a throttle-ului dacă originul este accesibil. | Doar IP normalizat de proxy-ul imediat, fără încredere în X-Forwarded-Host. |
| S05 | Medie | Cookie-ul copiat rămâne utilizabil după logout; schimbarea parolei nu revocă sesiunile. | Sesiuni revocabile în SQLite, expirare absolută și versiune de autentificare. |
| S06 | Medie | `compare_digest` cu CSRF non-ASCII produce TypeError/500. | Validare de tip, lungime și ASCII înainte de comparație. |
| S07 | Medie | Erorile transformării BF continuă cu text neprelucrat; Unicode este trunchiat la 8 biți, NUL și byte 255 pot termina transformarea. | UTF-8 învelit în ASCII sigur pentru BF; eșec închis și compatibilitate cu datele vechi. |
| S08 | Medie | Reordonarea acceptă duplicate, ID-uri inexistente și seturi parțiale, cu rezultate incoerente. Lipsește fișierul JS referit. | Validare atomică și comenzi accesibile de reordonare. |
| S09 | Medie | Listarea formatează toate taskurile în BF; lipsesc plafonul colecției și paginarea. | Limite de stocare și pagini limitate. |
| S10 | Medie | Lipsesc Trusted Hosts; antetele aplicației sunt dezactivate în mediul live. | Allowlist de host și antete active în aplicație și Nginx. |
| S11 | Mică | CSP permite stiluri inline; analytics extern în pagina privată. | Formatter BF fără stiluri inline; CSP strict; fără analytics în zona privată. |
| S12 | Mică | CSV nu protejează prefixul LF și whitespace urmat de formule. | Normalizare pentru identificarea formulelor și teste de regresie. |

## Context de producție verificat

- Git este în `app/`; două fișiere aveau modificări locale de reordonare.
  Patch-ul inițial și backupul consistent SQLite sunt păstrate separat, cu mod 600,
  în `/home/micu/brainfuck-review-20261104/`.
- Gunicorn: trei workers, bind exclusiv `127.0.0.1:34623`, serviciul
  `brainfuck-canary.service`. SQLite separat de cod, director 700 / fișier 600.
- systemd are deja sandboxing, limită de memorie, privilegii restrânse și acces
  de scriere numai la directorul de stare. Fișierul de secrete este root:root 600.
- Vhostul activ este `/etc/nginx/sites-available/brainfuck.micutu.com-canary`.
  Configurația din directorul exterior `deploy/` este o copie veche: excepția
  pentru originul OVH nu mai există în vhostul activ.
- Cloudflare real-IP și origin guard acceptă Cloudflare și loopback pentru
  tunnel. Un proces local compromis poate simula proxy-ul: acesta rămâne un
  trust boundary al hostului. Nu au fost schimbate configurațiile altor site-uri.
- Înaintea modificărilor, baza de producție avea zero taskuri. Nu presupunem că
  vor rămâne zero și păstrăm migrarea și backupul pentru date existente.

## Threat model și răspuns (ciso-review)

Principalele amenințări STRIDE sunt spoofing (bypass login), tampering / pierdere
de disponibilitate (migrare cu cheie greșită) și DoS (interpretare BF nelimitată
la nivel de colecție). Compromiterea aplicației expune întreaga listă comună și
cheile accesibile procesului. Nu există izolare între utilizatori: o parolă
deschide un singur workspace privat, nu conturi individuale.

Nu există date suficiente pentru estimări financiare ALE, număr de utilizatori,
contracte/DPA sau obligații de notificare. Nu se inventează valori și nu se
declară conformitate GDPR/SOC2. Furnizori observați: VPS, Cloudflare și GitHub;
nu se adaugă furnizori pentru rularea programelor din laborator.

Semnale: `failed_login`, `login_locked`, `storage_integrity_error`, 5xx și
healthcheck indisponibil. Logurile existente nu constituie alertare: operatorul
trebuie să conecteze healthcheck și regulile de log la propriul canal de alertă.
MTTD real și rotația on-call nu sunt verificate.

Runbook: la suspiciune de acces neautorizat, restricționează vhostul, păstrează
snapshotul DB și logurile, rotește parola și secretul sesiunilor; păstrează cheia
de criptare veche până la o rotație testată cu MultiFernet. La eroare de storage,
oprește scrierile, restaurează configurația cheilor și verifică backupul într-o
copie izolată. Repornește numai serviciul acestui proiect după verificări.
Exercițiul local include cheie greșită fără modificarea ciphertextului și replay
de cookie după logout; nu reprezintă un tabletop organizațional complet.

Verdict inițial: **remedieri înainte de publicarea funcțiilor noi**.

## Surse primare

- [Flask: security și Trusted Hosts](https://flask.palletsprojects.com/en/stable/web-security/)
- [Flask: limitele de încredere ProxyFix](https://flask.palletsprojects.com/en/stable/deploying/proxy_fix/)
- [Cryptography: Fernet, InvalidToken și rotația cheilor](https://cryptography.io/en/latest/fernet/)
- [OWASP: CSV injection](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/07-Injection/21-CSV_Injection/)
