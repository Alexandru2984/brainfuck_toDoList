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

## Rezultatul remedierilor și verificării live

S01, S02 și S04–S12 au remedieri în cod/configurație și verificări de regresie.
Pentru S03, parola live a fost comparată în memorie cu cele două versiuni
recuperabile ale verificatorului istoric: nu este reutilizată. Istoricul vechi
rămâne în repository; nu a fost rescris sau împins pe GitHub. Fișierele pregătite
pentru commit nu conțin valorile secrete live.

Auditul dependențelor a identificat un advisory pentru `cryptography==49.0.0`:
[CVE-2026-69247 / GHSA-g6cj-pr64-35w5](https://github.com/pyca/cryptography/security/advisories/GHSA-g6cj-pr64-35w5).
Acesta privește decriptarea PKCS#7, care nu este expusă de această aplicație;
versiunea a fost totuși actualizată la 50.0.0. Rescanarea Python și npm nu a găsit
vulnerabilități cunoscute în dependențele verificate. Nu reprezintă o garanție
privind vulnerabilități viitoare. Bandit nu mai raportează constatări; sortările
SQL folosesc interogări complete dintr-un set fix, fără concatenarea cererii.

Verificări executate:

- 56 teste Python pe runtime 3.14, inclusiv bypass/NUL/overflow, key rotation,
  ciphertext alterat/cheie greșită fără rescriere, CSRF Unicode, replay de cookie,
  autentificare expirată, spoofing de IP, buget concurent de login și limite.
- 22 teste Node pentru mașina de octeți, exemple și soluțiile de referință;
  12 teste Playwright pe desktop și mobil. Layout verificat între 320 și 1440 px,
  inclusiv poziția efectivă a controalelor, nu doar absența scrollului orizontal.
- Copie SQLite verificată cu cheile reale și noul cod: integrity_check ok.
  Backup consistent imediat înainte de deploy; zero taskuri la acel moment.
- `nginx -t` valid; restart numai pentru `brainfuck-canary`, reload Nginx.
  `cryptography` actualizat și în virtualenvul live; pip check fără conflicte.
- Domeniul public: healthz 200, lab 200, tasks anonime → login, robots propriu și
  sitemap corect, worker JavaScript și imagine socială disponibile.
- Browser live prin Cloudflare: programul Hello World rulează, controale mobile
  vizibile, fără erori JS/CSP în consolă. Login și logout reale funcționează;
  cookie-ul copiat înainte de logout este respins după logout. Nicio scriere de
  taskuri în aceste verificări.

La testarea live s-au observat injectările automate Cloudflare, blocate inițial
de CSP. HTML transmite acum `no-store, no-transform`, fără relaxarea CSP;
[Cloudflare documentează această directivă](https://developers.cloudflare.com/web-analytics/faq/).
Astfel nu se injectează analytics sau JavaScript Detections în editor. Regulile
WAF nu au fost modificate; robots rămâne separat pentru politica managed
existentă. Antetele duplicate app/Nginx au fost normalizate la o singură politică.

## Limite și lucru rămas în afara livrării

- Un singur workspace/parolă, fără conturi individuale, MFA sau roluri.
- Textul taskurilor este criptat; metadatele și etichetele nu sunt criptate.
- Snapshoturi locale și runbook există; backupul off-host automat și livrarea
  alertelor către operator nu sunt configurate. MTTD nu este măsurat.
- Istoricul vechi trebuie tratat în continuare ca public și sensibil; eliminarea
  lui ar necesita o operațiune coordonată pe clone/forkuri.
- CI este configurat pentru Python 3.13/3.14, dar în această sesiune s-a executat
  local 3.14. Workflow-ul remote va rula după push; nu s-a făcut push.
- Verificarea browserului acoperă Chromium; Safari/Firefox nu au fost testate.

Verdict final: **livrare funcțională verificată**, cu limitele operaționale de mai
sus declarate. Nu se pretinde certificare sau audit independent complet al VPS-ului.

## Extinderea laboratorului

Suprafața nouă este formată din pagini educaționale GET-only și fișiere statice.
Teste dedicate blochează accesul accidental al paginilor publice la query-uri de
taskuri și verifică absența cookie-urilor/noindex pe conținutul public.
Nicio rută nouă nu execută cod trimis pe server.

Istoricul reversibil este circular și limitat la 20.000 de diferențe. Profilarea
folosește tablouri de dimensiune fixă. Inputurile de comparație, cazurile de test,
cadrele și VM-ul interior au bugete independente; watchdog-urile termină Workerul.
Dimensiunile Canvas se validează înainte de alocare. Vizualizările folosesc
textContent/value și valori numerice, fără interpretare de markup sau eval.
Linkurile partajate nu pornesc programe și nu includ inputul. Progresul lecțiilor
și scorurile zilnice persistă numai identificatori/numere, nu cod ori inputuri.

Verificări pentru această extindere: 60 Python, 83 Node, 28 browser. Linkuri cu
payload HTML au fost verificate ca inerte; cazurile cu bucle nefinite se opresc
la limite și nu sunt raportate ca rezultate valide. Bandit, pip-audit și npm
nu au constatări cunoscute pentru versiunile verificate.

Limitele operaționale anterioare (workspace comun, backup off-host/alertare,
istoric Git sensibil vechi și testare browser numai Chromium) rămân explicite.
Nu se declară un audit independent complet sau certificare.
