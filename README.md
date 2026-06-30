# Brainfuck Todo App

Production-hardened Flask todo app where the intentionally unusual parts of the stack are implemented in Brainfuck: login verification, text transformation, and task presentation formatting.

The project is a portfolio piece, but it is deployed like a real service: secrets live outside git, sessions are signed with rotated keys, mutating routes use CSRF protection, rendered Brainfuck HTML is sanitized, and the public deployment runs behind Cloudflare, Nginx, Gunicorn, and systemd hardening.

## Features

- Brainfuck-backed login verifier generated at process startup from `BRAINFUCK_PASSWORD`.
- SQLite todo storage with a Brainfuck transformation pass before insert.
- Brainfuck-generated task rendering passed through a strict Python HTML sanitizer.
- Task management: add, mark complete, edit in place (JS-free `<details>` form), delete, and clear all completed; active/done counters and creation timestamps.
- Responsive, mobile-first UI with a light/dark theme that follows the OS preference and persists an explicit choice; SVG favicon and an installable web app manifest.
- Flask application factory, healthcheck endpoint, structured request logging, and app-level security headers.
- CSRF protection for login, add, edit, toggle, delete, clear, and logout.
- App-level brute-force throttle that locks an IP after repeated failed logins, on top of the Nginx rate limit.
- Runtime limits for request size, task length, Brainfuck steps, and Brainfuck output.
- Production examples for env files, systemd, Nginx rate limits, CSP, and Cloudflare origin guard.
- Local quality gate through `ruff`, `unittest`, `Makefile`, and GitHub Actions CI.

## Architecture

- `app.py`: Flask application factory, routes, config, CSRF, sanitizer, SQLite access, and healthcheck.
- `bf_interpreter.py`: bounded Brainfuck interpreter with step and output limits.
- `generate_login_bf.py`: generates Brainfuck login verifier code from an environment-provided password.
- `encrypt.bf`: Brainfuck task transformation before storage.
- `format_task.bf`: Brainfuck presentation formatter for stored tasks.
- `templates/` and `static/`: authenticated UI, login, error page, and shared CSS.
- `deploy/`: production-ready examples for env, systemd, and Nginx.
- `tests/`: security and operational smoke tests.

## Security Model

This app is still intentionally small, but the deployment assumes the internet is hostile.

- `BRAINFUCK_SECRET_KEY` or `SECRET_KEY` is required, kept outside git, and must be stable across Gunicorn workers.
- `BRAINFUCK_PASSWORD` is required and must never be committed. The generated Brainfuck verifier (`login.bf`) encodes the password and is git-ignored; `generate_login_bf.py` prints to stdout by default and never writes it into the repo.
- Cookies are `HttpOnly`, `Secure`, and `SameSite=Lax` by default.
- Sessions are permanent with configurable lifetime through `BRAINFUCK_SESSION_LIFETIME_SECONDS`.
- CSRF tokens are required for all form submissions; all mutations use POST, never GET.
- Failed logins are throttled per real client IP (`CF-Connecting-IP` behind Cloudflare via `ProxyFix`) and lock the IP after `BRAINFUCK_LOGIN_MAX_ATTEMPTS` within `BRAINFUCK_LOGIN_WINDOW_SECONDS`.
- Authenticated responses send `Cache-Control: no-store`; responses also set `Cross-Origin-Opener-Policy: same-origin`. Brainfuck errors are logged, never reflected to the page.
- Tasks are encrypted at rest with authenticated encryption (Fernet/`MultiFernet`, key rotation supported) wrapped around the Brainfuck transform, so the SQLite database holds ciphertext, not readable tasks. Set a dedicated `BRAINFUCK_ENCRYPTION_KEY`.
- User task input is escaped before storage, then Brainfuck-rendered HTML is sanitized by allowlist before template output.
- Nginx examples include request size limits, login/mutation rate limits, CSP, and Cloudflare origin guard.

See `deploy/brainfuck.env.example` for the full list of configuration variables, including the proxy and throttle settings.

## Local Development

Requirements:

- Python 3.13
- `pip`

Setup:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
```

Configure local secrets:

```bash
export BRAINFUCK_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
export BRAINFUCK_PASSWORD="choose-a-private-password"
export BRAINFUCK_COOKIE_SECURE=0
```

Run locally:

```bash
python app.py
```

Run checks:

```bash
make PYTHON=./venv/bin/python check
```

Healthcheck:

```bash
curl http://127.0.0.1:5000/healthz
```

`python app.py` binds to the first free local port starting at `5000`.

## Deployment

Example production files live in `deploy/`:

- `deploy/brainfuck.env.example`: copy to `/etc/brainfuck/brainfuck.env`, fill with real values, and `chmod 600`.
- `deploy/brainfuck.service.example`: Gunicorn service with env file and systemd hardening.
- `deploy/nginx-brainfuck.conf.example`: reverse proxy, HTTPS, rate limits, CSP, body limit, and Cloudflare origin guard.

After code changes on the VPS:

```bash
sudo systemctl restart brainfuck
sudo systemctl status brainfuck --no-pager
```

## Notes

The Brainfuck pieces are deliberately esoteric. The surrounding Python, tests, deployment config, and security controls are intentionally conventional so the project is understandable and operable.
