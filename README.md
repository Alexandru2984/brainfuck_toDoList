# Brainfuck Todo App 🧠

Welcome to the **Brainfuck Todo App**, a simple web-based Todo List application where core backend logic, encryption, and presentation rendering are handled entirely by **Brainfuck scripts**. 

This is a fun, experimental portfolio project demonstrating the integration of an esoteric programming language (Brainfuck) into a modern web stack (Python/Flask, SQLite, Nginx, Systemd).

## 🚀 Features

This application pushes Brainfuck to its limits by delegating critical application layers to it:

1. **Authentication via Brainfuck (`login.bf`)**: 
   - The login system does not verify the password in Python. 
   - Instead, the input is passed to a Brainfuck script that has the correct password encoded in its memory pointer logic. 
   - It outputs `1` if correct, and `0` if incorrect.
2. **Database Encryption (`encrypt.bf`)**: 
   - Before saving a new task to the SQLite database, the text is encrypted using a Brainfuck cipher (a memory shift).
   - Only encrypted data rests in `todos.db`.
3. **HTML Presentation & Decryption (`format_task.bf`)**:
   - The UI rendering is not done by Jinja templates.
   - A massive Brainfuck script (formatted as a giant ASCII Art Brain) decrypts the task from the database on-the-fly.
   - It then dynamically generates the HTML `<li>` tags, inline CSS styling, a reversed version of the text, and a visual length indicator.

## 🏗️ Architecture

- **Backend Wrapper:** Python with Flask (`app.py`).
- **Database:** SQLite (single table `todos`).
- **Brainfuck Engine:** A custom, highly-optimized Python Brainfuck Interpreter (`bf_interpreter.py`) built from scratch to avoid external dependencies.
- **Production Server:** Gunicorn managed by Systemd (`brainfuck.service`).
- **Reverse Proxy & SSL:** Nginx with Let's Encrypt (Certbot) on a VPS.

## ⚠️ Security Disclaimer (For Educational Purposes Only)

This application is deployed as a **personal proof-of-concept**. It is intentionally small, but the public deployment should still be treated as production: secrets live outside git, mutating requests use CSRF protection, and rendered Brainfuck HTML is sanitized.

1. **Password Management:** The login password must be supplied through the `BRAINFUCK_PASSWORD` environment variable. It is compiled into Brainfuck at process startup and must not be committed.
2. **Session Secret:** The Flask signing key must be supplied through `BRAINFUCK_SECRET_KEY` or `SECRET_KEY`. It must be stable across Gunicorn workers and must not be committed.
3. **HTML Rendering:** Brainfuck still generates the task HTML, but the Python wrapper escapes task input and applies a strict allowlist sanitizer to the generated HTML before it reaches the template.
4. **Request Safety:** Login, add, delete, and logout flows require CSRF tokens. Delete and logout use POST, not GET.
5. **Runtime Limits:** Request size, task length, Brainfuck execution steps, and Brainfuck output length are bounded by environment-configurable limits.

## 💻 Setup & Running (Local Development)

### Requirements
- Python 3.7+
- Flask and Gunicorn (`pip install -r requirements.txt`)

### Instructions

1. **Create a virtual environment (recommended):**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure local secrets:**
   ```bash
   export BRAINFUCK_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
   export BRAINFUCK_PASSWORD="choose-a-private-password"
   ```

4. **Run the application:**
   ```bash
   python app.py
   ```
   *Note: The application dynamically binds to the first available port starting from `5000` to strictly adhere to a "No Process Termination" mandate.*

5. **Access the application:**
   Open your browser and navigate to the address shown in your terminal.
   Configure `BRAINFUCK_PASSWORD` and `BRAINFUCK_SECRET_KEY` before starting the app.

## ✅ Tests

Run the security smoke tests with:

```bash
python -m unittest
```

## 🔐 Deployment Notes

Example production files live in `deploy/`:

- `deploy/brainfuck.env.example`: copy to `/etc/brainfuck/brainfuck.env`, fill with real secrets, and `chmod 600`.
- `deploy/brainfuck.service.example`: systemd service with an env file and hardening options.
- `deploy/nginx-brainfuck.conf.example`: reverse proxy, rate limits, CSP, HTTPS redirect, and small body limit.
