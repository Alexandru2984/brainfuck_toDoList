# Brainfuck Lab

An interactive Brainfuck playground and a private task workspace. The public
laboratory runs real Brainfuck programs locally in a Web Worker. Python provides
HTTP, authenticated storage and sessions; JavaScript provides the editor and the
byte machine. There is no frontend framework or production Node dependency.

- Public laboratory: `/lab` (anonymous `/` redirects here).
- Private workspace: `/tasks` (existing authenticated `/` links still work).
- Operational endpoint: `/healthz`.

## Public laboratory

- Editor with import/export `.bf`, instruction counts, compaction and keyboard
  shortcuts: Ctrl/⌘ Enter to run, F10 to step while the editor has focus.
- Run, pause, reset, single step, slow execution and instruction breakpoints.
- Visual memory tape, current instruction, pointer, steps, execution time and
  output byte count. UTF-8 and hexadecimal output; binary output download.
- Ten runnable `.bf` examples and eight challenges with multiple input cases,
  hints and local progress. Challenge results are educational, not a leaderboard.
- Code-only share links in the URL fragment. Input is excluded and shared code
  never runs automatically. Fragment contents are visible to anyone receiving
  the link; do not put secrets in shared programs.
- Optional local code drafts. Input is never persisted. Progress and theme are
  stored on the device; storage failures do not prevent using the lab.
- Responsive light/dark themes, system preference, keyboard navigation and
  reduced motion. No external fonts, analytics or runtime CDN dependencies.

Machine semantics: 30,000 cells, unsigned 8-bit values, wrapping pointer and
cells, UTF-8 input bytes, EOF writes zero. Echo-style loops consequently stop at
a NUL byte. Programs are limited to 20,000 source characters, 4,096 input bytes,
2,000,000 executed instructions and 65,536 output bytes. A separate UI watchdog
terminates execution after ten seconds. The output preview shows at most 8 KiB;
the download preserves all bytes. Challenge runs use stricter per-case budgets.

## Private workspace

Add, edit with prefilled text, complete, duplicate, delete and clear completed
tasks. Priorities, due dates, overdue/today filters, up to five tags, text search,
four sort orders and accessible up/down controls are included. Lists render at
most 30 Brainfuck cards per page, with a configurable collection cap (2,000 by
default). Reordering by API requires the complete, unique set of existing IDs.
JSON/CSV exports include metadata, with spreadsheet formula protection.

This is **one password-protected shared workspace**, not a multi-user service.
Anyone with the password sees the same tasks. There is no public task sharing.

Task transformation, reverse transformation and HTML presentation run in
Brainfuck. Unicode is represented safely as numeric HTML entities before the
byte transform. The `+1` Brainfuck transform is obfuscation; actual confidentiality
comes from versioned Fernet authenticated encryption. **Task text is encrypted;
IDs, completion, timestamps, order, priorities, due dates and tags are metadata
stored without encryption.** The formatter is generated reproducibly by
`python tools/build_formatter.py` and its output passes a strict HTML sanitizer.

## Security

- The login Brainfuck program compares fixed-length SHA-256 digests with a
  sticky mismatch flag, avoiding the old overflow and NUL-suffix bypasses.
  SHA-256 is used to normalize the verifier input, not to encrypt stored tasks.
- SQLite-backed session tokens are hashed, expire absolutely and are revoked at
  logout. Password changes invalidate the authentication version. CSRF tokens
  rotate at login; mutations require POST and CSRF.
- Login attempt reservation is atomic across workers. Only the configured
  right-most proxy hop controls the client IP; raw CF-Connecting-IP and
  X-Forwarded-Host are ignored. Keep Gunicorn bound to loopback.
- Secure, HttpOnly, SameSite cookies; Trusted Hosts; strict CSP without inline
  scripts/styles; no-store dynamic pages and noindex private routes.
- HTML also sends `no-transform`: Cloudflare leaves the document intact rather
  than injecting Web Analytics or JavaScript Detections into the editor. WAF
  configuration is unchanged. Robots remains separate so the existing
  Cloudflare-managed crawler policy is preserved.
- Storage migration authenticates all encrypted rows before changing any. A
  wrong key or altered token aborts startup without re-encrypting damaged data.
  Legacy plaintext fallback is allowed only in the initial, atomic migration.
- Request/form/task/interpreter/collection limits bound resource consumption.
  Healthchecks fail when the actual task table cannot be read.

Read [the audit](docs/AUDIT.md) for findings and residual risks and
[the roadmap](docs/ROADMAP.md) for the completed scope and future ideas.

## Development

Python 3.13 or 3.14. Node 24 is used only for development checks.

```sh
python3 -m venv venv
. venv/bin/activate
pip install -r requirements-dev.txt
export BRAINFUCK_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export BRAINFUCK_PASSWORD='choose-a-private-password'
export BRAINFUCK_COOKIE_SECURE=0
export BRAINFUCK_TRUST_PROXY=0
python app.py
```

The development server binds a free loopback port starting at 5000. Production
uses Gunicorn. Never enable the Flask debugger in production.

Checks:

```sh
make PYTHON=./venv/bin/python check
./venv/bin/python -m ruff format --check .
npm ci --ignore-scripts
npm test
npm run format:check
npx playwright install chromium
PATH="$PWD/venv/bin:$PATH" npm run test:browser
```

Python tests and browser checks create temporary databases and explicit test
credentials. They do not import the production environment. Browser tests start
their own isolated HTTP server on `127.0.0.1:38173`; they cover desktop and mobile
Chromium. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an existing
local Chromium executable; CI installs the matching Playwright browser.

GitHub Actions checks Python 3.13/3.14, formatting, the byte machine, browser
flows, Python dependency advisories and npm advisories. Actions are pinned to
commit SHAs, credentials are not persisted, and token permissions are read-only.
Dependabot proposes weekly dependency/action updates. No CI deployment secrets
or automatic production deploy are configured.

## Production

The active installation uses `/srv/canary/brainfuck.micutu.com/app`, the sibling
virtualenv, `/srv/canary/brainfuck.micutu.com/state/todos.db`, and
`brainfuck-canary.service`. Secrets are in `/etc/brainfuck/brainfuck.env`, mode
600, outside the repository. Keep a dedicated `BRAINFUCK_ENCRYPTION_KEY` stable
and backed up securely. For rotation, configure `new_key,old_key`; do not remove
the old key until every ciphertext has been explicitly rotated and verified.
Startup migration does not itself rotate existing valid tokens.

Versioned deployment examples are in `deploy/`:

- `brainfuck.env.example`: settings and secret placeholders;
- `brainfuck.service.example`: current systemd sandbox and loopback Gunicorn;
- `nginx-brainfuck.conf.example`: TLS, origin guard, proxy normalization, strict
  headers and rate limits for every mutation;
- `rate-limit.conf.example`: directives for Nginx's `http` context.

The outer sibling `../deploy/` contains migration-era snapshots and is not the
source of truth for the live vhost. Nginx must use this application's
`/robots.txt`, rather than the shared robots file for another domain.

Before deployment, take a consistent SQLite backup using its backup API and
check a copy with the production keys. Test Nginx with `sudo nginx -t`, then
restart only `brainfuck-canary` and reload Nginx. Check `/healthz`, `/lab`,
`/robots.txt`, `/sitemap.xml` and unauthenticated `/tasks` through the public
hostname. See [operations](docs/OPERATIONS.md) for recovery and monitoring.

The manifest supports home-screen shortcuts; offline execution and caching of
private pages are not implemented.
