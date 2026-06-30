# CLAUDE.md

Guidance for working in this repository.

## What this is

A Flask todo app where the esoteric parts are implemented in Brainfuck: login
verification, a task transformation pass, and task presentation formatting. The
surrounding Python, tests, and deployment config are intentionally conventional.
It runs in production behind Cloudflare → Nginx → Gunicorn → systemd.

## Commands

Use the project virtualenv at `./venv`.

- Install dev deps: `make PYTHON=./venv/bin/python install-dev`
- Lint: `./venv/bin/python -m ruff check .`
- Format: `./venv/bin/python -m ruff format .`
- Test: `PYTHONWARNINGS=error ./venv/bin/python -m unittest`
- All checks: `make PYTHON=./venv/bin/python check`
- Run locally: set `BRAINFUCK_SECRET_KEY`, `BRAINFUCK_PASSWORD`, and
  `BRAINFUCK_COOKIE_SECURE=0`, then `./venv/bin/python app.py` (binds the first
  free port from 5000).

Tests set their own default `BRAINFUCK_*` env vars, so run unittest without those
vars exported (an exported password mismatching the test password breaks login).

## Architecture

- `app.py`: application factory, routes, config, CSRF, login throttle, HTML
  sanitizer, SQLite access, security headers, healthcheck.
- `bf_interpreter.py`: bounded Brainfuck interpreter (step and output limits).
  Output is byte-accurate (one code point per byte); do not change this — the
  encrypt/format round-trip depends on it. Decode to UTF-8 only at display time.
- `generate_login_bf.py`: builds the login verifier from a password.
- `encrypt.bf`: a per-byte +1 transform applied before storage (obfuscation, not
  encryption). `format_task.bf`: renders a stored task to whitelisted HTML.
- `templates/`, `static/`: UI, CSS theme tokens, and `theme.js` toggle.
- `deploy/`: production env/systemd/Nginx examples.

## Conventions

- Ruff config in `pyproject.toml` (line length 100, double quotes).
- Add a route via the `login_required` decorator and `validate_csrf()`; mutations
  are POST-only and redirect to `index`.
- The HTML sanitizer allows a fixed set of tags/classes/inline styles emitted by
  `format_task.bf`. If you change the formatter's markup, update `ALLOWED_*`.
- Front-end scripts must be external files (CSP `script-src 'self'`); no inline
  `<script>`.

## Security-sensitive

- Never commit `login.bf` (it encodes the password); it is git-ignored and not
  used at runtime. The app generates the verifier in memory at startup.
- The published git history previously contained the password via `login.bf`.
  Rotate `BRAINFUCK_PASSWORD` and purge history (or keep the repo private).
- Do not weaken cookie flags, CSRF, the sanitizer, or the interpreter limits.
