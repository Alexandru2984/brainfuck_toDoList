# Repository guidance

Brainfuck Lab is Flask + SQLite around a public browser Brainfuck machine and a
single private task workspace. Production: Cloudflare → Nginx → loopback
Gunicorn → `brainfuck-canary.service`. The Git root is `app/`.

## Checks

- `make PYTHON=./venv/bin/python check` and `python -m ruff format --check .`.
- `npm ci --ignore-scripts`, `npm test`, `npm run format:check`.
- `npm run test:browser` starts an isolated server/database on loopback 38173;
  ensure Python dependencies are on PATH. Never point browser tests at live data.
- Production Python is the absolute sibling path
  `/srv/canary/brainfuck.micutu.com/venv/bin/python`; the repo-local virtualenv in
  examples is for independent development.

## Structure

- `app.py`: routes, factory, SQLite migrations, revocable sessions, atomic
  throttle, CSRF, versioned Fernet storage, HTML sanitizer, headers, healthcheck.
- `bf_interpreter.py`: bounded byte-accurate server BF machine. Input/output
  strings represent Latin-1 bytes. Encode Unicode before calling it.
- `generate_login_bf.py`: sticky Brainfuck comparison of SHA-256 hex digests.
  Generated verifiers remain sensitive and must never be committed.
- `encrypt.bf`: +1 byte transform (obfuscation). The reverse transform also runs
  in BF. Unicode task text passes through escaped numeric entities.
- `format_task.bf`: BF HTML presentation, reproducibly generated with
  `python tools/build_formatter.py`. Allowlisted classes, no inline styles.
- `static/bf-vm.mjs`, `bf-worker.mjs`: bounded public browser execution; never
  expose a server route that executes arbitrary Brainfuck submissions.
- `static/programs/*.bf`: runnable examples; `catalog.mjs`: descriptions,
  challenges and expected outputs. Keep examples and cases verified together.
- `tests/`: Python regressions, Node byte-machine tests, Playwright user flows.

## Conventions and boundaries

Ruff line length 100 and double quotes; Prettier formats browser JS/CSS. Frontend
scripts and styles must be external; CSP excludes unsafe-inline/eval. Render
untrusted browser text with textContent/value, never innerHTML. Shared programs
are fragments, exclude input, and never autorun. Draft persistence is opt-in.

Task mutations are POST-only, `login_required` and CSRF protected. Never silently
continue after a BF transform or authenticated decryption failure. Initial legacy
storage migration is atomic; versioned rows must always authenticate. Metadata
(tags, due dates, status, order) is not encrypted; do not claim otherwise.

Preserve changes already in the working tree. Commit stages using the existing
owner identity, without agent attribution or Co-authored-by. Do not push or
rewrite public history without a separate instruction. Historical `login.bf`
contains an obsolete secret; do not print it. The current live password was
compared against historical verifiers in memory, without exposing values.
