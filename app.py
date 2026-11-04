import base64
import csv
import hashlib
import hmac
import io
import ipaddress
import json
import logging
import math
import os
import secrets
import socket
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timedelta
from functools import wraps
from html import escape, unescape
from html.parser import HTMLParser
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from flask import (
    Flask,
    Response,
    abort,
    current_app,
    flash,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.exceptions import SecurityError
from werkzeug.middleware.proxy_fix import ProxyFix

from bf_interpreter import run_bf
from generate_login_bf import generate_login_bf

BASE_DIR = Path(__file__).resolve().parent
CSRF_SESSION_KEY = "_csrf_token"


def required_env(*names):
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    joined_names = " or ".join(names)
    raise RuntimeError(f"Missing required environment variable: {joined_names}")


def int_env(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        parsed_value = int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if parsed_value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    return parsed_value


def bool_env(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def build_config():
    password = required_env("BRAINFUCK_PASSWORD")
    return {
        "SECRET_KEY": required_env("BRAINFUCK_SECRET_KEY", "SECRET_KEY"),
        "DB_FILE": os.environ.get("BRAINFUCK_DB_FILE", str(BASE_DIR / "todos.db")),
        "LOGIN_BF_CODE": generate_login_bf(password),
        "AUTH_VERSION": hmac.new(
            required_env("BRAINFUCK_SECRET_KEY", "SECRET_KEY").encode(),
            password.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest(),
        "TRUSTED_HOSTS": os.environ.get(
            "BRAINFUCK_TRUSTED_HOSTS", "brainfuck.micutu.com,localhost,127.0.0.1"
        ).split(","),
        "MAX_FORM_PARTS": 30,
        "MAX_FORM_MEMORY_SIZE": 16 * 1024,
        "MAX_TASKS": int_env("BRAINFUCK_MAX_TASKS", 2000),
        "PAGE_SIZE": 30,
        "MAX_TASK_LENGTH": int_env("BRAINFUCK_MAX_TASK_LENGTH", 500),
        "MAX_BF_STEPS": int_env("BRAINFUCK_MAX_BF_STEPS", 1_000_000),
        "MAX_BF_OUTPUT": int_env("BRAINFUCK_MAX_BF_OUTPUT", 50_000),
        "MAX_CONTENT_LENGTH": int_env("BRAINFUCK_MAX_CONTENT_LENGTH", 16 * 1024),
        "SQLITE_TIMEOUT_SECONDS": int_env("BRAINFUCK_SQLITE_TIMEOUT_SECONDS", 5),
        "PERMANENT_SESSION_LIFETIME": timedelta(
            seconds=int_env("BRAINFUCK_SESSION_LIFETIME_SECONDS", 12 * 60 * 60)
        ),
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SECURE": os.environ.get("BRAINFUCK_COOKIE_SECURE", "1") != "0",
        "SESSION_COOKIE_SAMESITE": os.environ.get("BRAINFUCK_COOKIE_SAMESITE", "Lax"),
        "SECURITY_HEADERS_ENABLED": os.environ.get("BRAINFUCK_SECURITY_HEADERS_ENABLED", "1")
        != "0",
        "TRUST_PROXY": bool_env("BRAINFUCK_TRUST_PROXY", False),
        "PROXY_HOPS": int_env("BRAINFUCK_PROXY_HOPS", 1),
        "TRUSTED_IP_HEADER": os.environ.get("BRAINFUCK_TRUSTED_IP_HEADER", "CF-Connecting-IP"),
        "LOGIN_MAX_ATTEMPTS": int_env("BRAINFUCK_LOGIN_MAX_ATTEMPTS", 8),
        "LOGIN_WINDOW_SECONDS": int_env("BRAINFUCK_LOGIN_WINDOW_SECONDS", 300),
        # Comma-separated Fernet keys; first encrypts, all can decrypt (rotation).
        "ENCRYPTION_KEY": os.environ.get("BRAINFUCK_ENCRYPTION_KEY", ""),
    }


def build_fernet(encryption_key, secret_key):
    """Build a MultiFernet for at-rest task encryption.

    Uses the configured ``BRAINFUCK_ENCRYPTION_KEY`` (one or more comma-separated
    Fernet keys to support rotation). When unset, a stable key is derived from
    the secret key so the app encrypts out of the box; a dedicated key is
    strongly recommended in production.
    """
    keys = [part.strip() for part in (encryption_key or "").split(",") if part.strip()]
    if not keys:
        derived = base64.urlsafe_b64encode(
            hashlib.sha256(("bf-fernet-v1:" + secret_key).encode()).digest()
        )
        keys = [derived.decode("ascii")]
    return MultiFernet([Fernet(key) for key in keys])


class BFHTMLSanitizer(HTMLParser):
    ALLOWED_TAGS = {"li", "div", "strong", "em", "span"}
    ALLOWED_CLASSES = {"task-item"}
    ALLOWED_STYLES = {
        "padding: 15px; border-bottom: 1px solid #eee; font-family: monospace; background: #fff; border-radius: 4px; margin-bottom: 8px;",
        "display: flex; justify-content: space-between; align-items: center;",
        "color: #007bff; font-size: 1.1em;",
        "font-size: 1.3em; color: #111; margin-top: 10px;",
        "color: #d63384; margin-top: 8px; font-size: 0.9em;",
        "color: #28a745; margin-top: 4px; font-size: 0.9em;",
        "letter-spacing: 2px;",
    }

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.ALLOWED_TAGS:
            self.parts.append(escape(self.get_starttag_text()))
            return

        safe_attrs = []
        for name, value in attrs:
            if (
                name == "class"
                and value in self.ALLOWED_CLASSES
                or name == "style"
                and value in self.ALLOWED_STYLES
            ):
                safe_attrs.append((name, value))

        rendered_attrs = "".join(
            f' {name}="{escape(value, quote=True)}"' for name, value in safe_attrs
        )
        self.parts.append(f"<{tag}{rendered_attrs}>")

    def handle_endtag(self, tag):
        if tag in self.ALLOWED_TAGS:
            self.parts.append(f"</{tag}>")
        else:
            self.parts.append(escape(f"</{tag}>"))

    def handle_data(self, data):
        self.parts.append(escape(data))

    def handle_entityref(self, name):
        self.parts.append(f"&{name};")

    def handle_charref(self, name):
        self.parts.append(f"&#{name};")

    def get_html(self):
        return "".join(self.parts)


def create_app(config_overrides=None):
    app = Flask(__name__)
    app.config.update(build_config())
    if config_overrides:
        app.config.update(config_overrides)
    app.secret_key = app.config["SECRET_KEY"]
    app.config["FERNET"] = build_fernet(
        app.config.get("ENCRYPTION_KEY", ""), app.config["SECRET_KEY"]
    )

    if app.config.get("TRUST_PROXY", True):
        hops = app.config.get("PROXY_HOPS", 1)
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=hops, x_proto=hops, x_host=0)

    configure_logging(app)
    init_db(app.config["DB_FILE"], app.config["SQLITE_TIMEOUT_SECONDS"])
    migrate_storage_encryption(app)
    register_hooks(app)
    register_error_handlers(app)
    register_routes(app)
    app.jinja_env.globals["csrf_token"] = csrf_token
    return app


def configure_logging(app):
    logging.basicConfig(
        level=os.environ.get("BRAINFUCK_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    app.logger.setLevel(os.environ.get("BRAINFUCK_LOG_LEVEL", "INFO"))


def register_hooks(app):
    @app.before_request
    def start_request_timer():
        g.request_started_at = time.perf_counter()

    @app.after_request
    def add_security_headers(response):
        elapsed_ms = (time.perf_counter() - g.get("request_started_at", time.perf_counter())) * 1000
        if not current_app.config.get("TESTING"):
            current_app.logger.info(
                "request endpoint=%s method=%s status=%s duration_ms=%.2f",
                request.endpoint,
                request.method,
                response.status_code,
                elapsed_ms,
            )
        if request.endpoint not in {"static", "healthz"}:
            # Authenticated todo content must never be cached by the browser,
            # Cloudflare, or any shared proxy in front of the app.
            response.headers.setdefault("Cache-Control", "no-store")
        if current_app.config.get("SECURITY_HEADERS_ENABLED", True):
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
            response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
            if request.is_secure:
                response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
            response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
            response.headers.setdefault(
                "Permissions-Policy",
                "geolocation=(), microphone=(), camera=()",
            )
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'self'; script-src 'self' https://analytics.micutu.com; "
                "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
                "font-src 'self' data:; connect-src 'self' https://analytics.micutu.com; "
                "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
            )
        return response


def register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(_error):
        if isinstance(_error, SecurityError):
            return Response("Invalid host", status=400, mimetype="text/plain")
        return (
            render_template(
                "error.html",
                title="Cerere invalida",
                message="Formularul a expirat sau cererea nu a putut fi validata.",
            ),
            400,
        )

    @app.errorhandler(413)
    def payload_too_large(_error):
        return (
            render_template(
                "error.html",
                title="Input prea mare",
                message="Task-ul trimis depaseste limita acceptata pentru aplicatie.",
            ),
            413,
        )

    @app.errorhandler(429)
    def too_many_requests(_error):
        return (
            render_template(
                "error.html",
                title="Prea multe incercari",
                message="Ai facut prea multe cereri intr-un interval scurt. Reincearca mai tarziu.",
            ),
            429,
        )

    @app.errorhandler(500)
    def internal_error(error):
        current_app.logger.exception("unhandled application error", exc_info=error)
        return (
            render_template(
                "error.html",
                title="Eroare interna",
                message="Aplicatia a intampinat o problema temporara.",
            ),
            500,
        )


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        token = session.get("auth_session", "")
        if not session.get("logged_in") or not isinstance(token, str):
            return redirect(url_for("login"))
        with closing(get_db_connection()) as conn:
            valid = conn.execute(
                "SELECT 1 FROM auth_sessions WHERE token_hash = ? AND auth_version = ? "
                "AND expires_at > ?",
                (
                    hashlib.sha256(token.encode()).hexdigest(),
                    current_app.config["AUTH_VERSION"],
                    time.time(),
                ),
            ).fetchone()
        if not valid:
            session.clear()
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


def encrypt_storage(payload):
    """Versioned, authenticated ciphertext. Never silently replace invalid bytes."""
    return "bf1:" + current_app.config["FERNET"].encrypt(payload.encode("latin-1")).decode("ascii")


def decrypt_storage(stored):
    if not isinstance(stored, str) or not stored.startswith("bf1:"):
        raise InvalidToken
    return current_app.config["FERNET"].decrypt(stored[4:].encode("ascii")).decode("latin-1")


def bf_payload_to_text(payload):
    """The reverse byte transform also runs in Brainfuck."""
    return unescape(
        run_bf(
            ",[-.,]",
            payload,
            max_steps=current_app.config["MAX_BF_STEPS"],
            max_output=current_app.config["MAX_TASK_LENGTH"] * 16,
        )
    )


def migrate_storage_encryption(app):
    """Validate the entire database before atomically upgrading legacy storage.

    Once versioned, every row MUST authenticate. A wrong key or altered token
    aborts startup without re-encrypting any existing ciphertext.
    """
    with app.app_context(), closing(get_db_connection()) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        version = conn.execute(
            "SELECT value FROM app_meta WHERE key = 'storage_version'"
        ).fetchone()
        updates = []
        for row in conn.execute("SELECT id, task FROM todos"):
            stored = row["task"]
            try:
                if stored.startswith("bf1:"):
                    decrypt_storage(stored)
                    continue
                if version:
                    raise InvalidToken
                if stored.startswith("gAAAA"):
                    payload = app.config["FERNET"].decrypt(stored.encode("ascii")).decode("latin-1")
                else:
                    # Only the initial unversioned migration accepts legacy BF bytes.
                    payload = stored
                updates.append((encrypt_storage(payload), row["id"]))
            except (InvalidToken, UnicodeError):
                app.logger.error("storage_integrity_error task_id=%s", row["id"])
                raise InvalidToken from None
        conn.executemany("UPDATE todos SET task = ? WHERE id = ?", updates)
        conn.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('storage_version', '1')")


def next_top_position(conn):
    """Position value that sorts a new task above all existing ones."""
    row = conn.execute("SELECT MIN(position) FROM todos").fetchone()
    return (row[0] if row[0] is not None else 0) - 1


def store_task(conn, task, todo_id=None):
    """Validate length, escape, Brainfuck-transform, encrypt, then insert or update."""
    task = task.strip()
    if not task:
        return False
    if len(task) > current_app.config["MAX_TASK_LENGTH"]:
        abort(413)
    if any(ord(char) < 32 and char not in "\n\t" for char in task):
        abort(400)
    # Numeric HTML entities preserve Unicode through the BF byte machine and
    # avoid the 0/255 sentinel ambiguity. Sanitization still happens on output.
    ascii_task = escape(task, quote=True).encode("ascii", "xmlcharrefreplace").decode("ascii")
    stored_task = encrypt_storage(encrypt_with_bf(ascii_task))
    if todo_id is None:
        conn.execute("BEGIN IMMEDIATE")
        if (
            conn.execute("SELECT COUNT(*) FROM todos").fetchone()[0]
            >= current_app.config["MAX_TASKS"]
        ):
            abort(413)
        conn.execute(
            "INSERT INTO todos (task, done, created_at, position) VALUES (?, 0, ?, ?)",
            (stored_task, time.time(), next_top_position(conn)),
        )
    else:
        if not conn.execute(
            "UPDATE todos SET task = ? WHERE id = ?", (stored_task, todo_id)
        ).rowcount:
            abort(404)
    return True


def register_routes(app):
    @app.route("/healthz")
    def healthz():
        try:
            with closing(get_db_connection()) as conn:
                conn.execute("SELECT 1").fetchone()
        except sqlite3.Error:
            current_app.logger.exception("healthcheck database query failed")
            return jsonify({"status": "error", "database": "unavailable"}), 503
        return jsonify({"status": "ok", "database": "ok"})

    @app.route("/login", methods=["GET", "POST"])
    def login():
        error = None
        if request.method == "POST":
            validate_csrf()
            ip = client_ip()
            locked_for = reserve_login_attempt(ip)
            if locked_for:
                current_app.logger.warning("login_locked ip=%s retry_after=%s", ip, locked_for)
                return (
                    render_template(
                        "error.html",
                        title="Prea multe incercari",
                        message=(
                            "Prea multe incercari de autentificare. "
                            f"Reincearca in aproximativ {locked_for} secunde."
                        ),
                    ),
                    429,
                    {"Retry-After": str(locked_for)},
                )
            password = request.form.get("password", "")
            if verify_login_with_bf(password):
                clear_login_attempts(ip)
                session.clear()
                session.permanent = True
                session["logged_in"] = True
                token = secrets.token_urlsafe(32)
                session["auth_session"] = token
                with closing(get_db_connection()) as conn, conn:
                    conn.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (time.time(),))
                    conn.execute(
                        "INSERT INTO auth_sessions (token_hash, auth_version, expires_at) VALUES (?, ?, ?)",
                        (
                            hashlib.sha256(token.encode()).hexdigest(),
                            current_app.config["AUTH_VERSION"],
                            time.time() + current_app.permanent_session_lifetime.total_seconds(),
                        ),
                    )
                csrf_token()
                return redirect(url_for("index"))
            current_app.logger.warning("failed_login ip=%s", ip)
            error = "Parola incorecta! (Validat de Brainfuck)"
        return render_template("login.html", error=error)

    @app.route("/logout", methods=["POST"])
    def logout():
        validate_csrf()
        token = session.get("auth_session", "")
        if isinstance(token, str):
            with closing(get_db_connection()) as conn, conn:
                conn.execute(
                    "DELETE FROM auth_sessions WHERE token_hash = ?",
                    (hashlib.sha256(token.encode()).hexdigest(),),
                )
        session.clear()
        return redirect(url_for("login"))

    @app.route("/")
    @login_required
    def index():
        query = request.args.get("q", "").strip()
        status = request.args.get("filter", "all")
        if status not in {"all", "active", "done"}:
            status = "all"

        with closing(get_db_connection()) as conn:
            todos = conn.execute(
                "SELECT id, task, done, created_at FROM todos "
                "ORDER BY done ASC, position ASC, id DESC"
            ).fetchall()

        total_count = len(todos)
        active_count = sum(1 for todo in todos if not todo["done"])
        needle = query.lower()

        formatted_todos = []
        for todo in todos:
            done = bool(todo["done"])
            if status == "active" and done:
                continue
            if status == "done" and not done:
                continue
            payload = decrypt_storage(todo["task"])
            if needle and needle not in bf_payload_to_text(payload).lower():
                continue
            formatted_todos.append(
                {
                    "id": todo["id"],
                    "html": format_with_bf(payload),
                    "done": done,
                    "created_at": format_timestamp(todo["created_at"]),
                }
            )

        return render_template(
            "index.html",
            todos=formatted_todos,
            total_count=total_count,
            active_count=active_count,
            done_count=total_count - active_count,
            shown_count=len(formatted_todos),
            query=query,
            status=status,
            max_task_length=current_app.config["MAX_TASK_LENGTH"],
        )

    @app.route("/add", methods=["POST"])
    @login_required
    def add():
        validate_csrf()
        with closing(get_db_connection()) as conn, conn:
            if store_task(conn, request.form.get("task", "")):
                flash("Task adaugat.", "success")
        return redirect(url_for("index"))

    @app.route("/edit/<int:id>", methods=["POST"])
    @login_required
    def edit(id):
        validate_csrf()
        with closing(get_db_connection()) as conn, conn:
            if store_task(conn, request.form.get("task", ""), todo_id=id):
                flash("Task actualizat.", "success")
        return redirect(url_for("index"))

    @app.route("/toggle/<int:id>", methods=["POST"])
    @login_required
    def toggle(id):
        validate_csrf()
        with closing(get_db_connection()) as conn, conn:
            conn.execute("UPDATE todos SET done = 1 - done WHERE id = ?", (id,))
        return redirect(url_for("index"))

    @app.route("/delete/<int:id>", methods=["POST"])
    @login_required
    def delete(id):
        validate_csrf()
        with closing(get_db_connection()) as conn, conn:
            conn.execute("DELETE FROM todos WHERE id = ?", (id,))
        flash("Task sters.", "success")
        return redirect(url_for("index"))

    @app.route("/clear-completed", methods=["POST"])
    @login_required
    def clear_completed():
        validate_csrf()
        with closing(get_db_connection()) as conn, conn:
            removed = conn.execute("DELETE FROM todos WHERE done = 1").rowcount
        if removed:
            flash(f"{removed} task-uri finalizate sterse.", "success")
        return redirect(url_for("index"))

    @app.route("/reorder", methods=["POST"])
    @login_required
    def reorder():
        validate_csrf()
        raw = request.form.get("order", "")
        parts = raw.split(",")
        if (
            not parts
            or len(parts) > current_app.config["MAX_TASKS"]
            or any(not p.isascii() or not p.isdecimal() or len(p) > 18 for p in parts)
        ):
            abort(400)
        ids = [int(part) for part in parts]
        if len(ids) != len(set(ids)):
            abort(400)
        with closing(get_db_connection()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            existing = {r[0] for r in conn.execute("SELECT id FROM todos")}
            if set(ids) != existing:
                abort(400)
            conn.executemany(
                "UPDATE todos SET position = ? WHERE id = ?",
                [(position, todo_id) for position, todo_id in enumerate(ids)],
            )
        return ("", 204)

    @app.route("/export")
    @login_required
    def export():
        fmt = request.args.get("format", "json").lower()
        if fmt not in {"json", "csv"}:
            abort(400)
        with closing(get_db_connection()) as conn:
            rows = conn.execute(
                "SELECT id, task, done, created_at FROM todos ORDER BY id"
            ).fetchall()
        records = [
            {
                "id": row["id"],
                "task": bf_payload_to_text(decrypt_storage(row["task"])),
                "done": bool(row["done"]),
                "created_at": iso_timestamp(row["created_at"]),
            }
            for row in rows
        ]

        if fmt == "csv":
            buffer = io.StringIO()
            writer = csv.DictWriter(buffer, fieldnames=["id", "task", "done", "created_at"])
            writer.writeheader()
            for record in records:
                writer.writerow({**record, "task": csv_safe(record["task"])})
            return Response(
                buffer.getvalue(),
                mimetype="text/csv",
                headers={"Content-Disposition": "attachment; filename=todos.csv"},
            )

        body = json.dumps(records, ensure_ascii=False, indent=2)
        return Response(
            body,
            mimetype="application/json",
            headers={"Content-Disposition": "attachment; filename=todos.json"},
        )


def format_timestamp(value):
    if not value:
        return ""
    try:
        return datetime.fromtimestamp(value).strftime("%d %b %Y, %H:%M")
    except (ValueError, OverflowError, OSError):
        return ""


def iso_timestamp(value):
    if not value:
        return ""
    try:
        return datetime.fromtimestamp(value).isoformat(timespec="seconds")
    except (ValueError, OverflowError, OSError):
        return ""


def csv_safe(text):
    """Neutralize spreadsheet formula injection in exported CSV cells."""
    if text and (text[0] in "\t\r\n" or text.lstrip(" \t\r\n").startswith(("=", "+", "-", "@"))):
        return "'" + text
    return text


def client_ip():
    """Only ProxyFix's configured right-most proxy hop may set the client IP."""
    try:
        return str(ipaddress.ip_address(request.remote_addr))
    except ValueError:
        return "unknown"


def reserve_login_attempt(ip):
    """Reserve a slot in one transaction across all Gunicorn workers."""
    window = current_app.config["LOGIN_WINDOW_SECONDS"]
    now = time.time()
    with closing(get_db_connection()) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("DELETE FROM login_attempts WHERE created_at < ?", (now - window,))
        count, oldest = conn.execute(
            "SELECT COUNT(*), MIN(created_at) FROM login_attempts WHERE ip = ?", (ip,)
        ).fetchone()
        if count >= current_app.config["LOGIN_MAX_ATTEMPTS"]:
            return max(math.ceil(oldest + window - now), 1)
        conn.execute("INSERT INTO login_attempts (ip, created_at) VALUES (?, ?)", (ip, now))
    return 0


def clear_login_attempts(ip):
    with closing(get_db_connection()) as conn, conn:
        conn.execute("DELETE FROM login_attempts WHERE ip = ?", (ip,))


def csrf_token():
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_SESSION_KEY] = token
    return token


def validate_csrf():
    token = session.get(CSRF_SESSION_KEY)
    submitted_token = request.form.get("csrf_token", "")
    if (
        not isinstance(token, str)
        or not isinstance(submitted_token, str)
        or not token
        or len(submitted_token) > 128
        or not submitted_token.isascii()
        or not hmac.compare_digest(token, submitted_token)
    ):
        abort(400)


def sanitize_bf_html(html):
    sanitizer = BFHTMLSanitizer()
    sanitizer.feed(html)
    sanitizer.close()
    return sanitizer.get_html()


def init_db(db_file, timeout=5):
    with closing(sqlite3.connect(db_file, timeout=timeout)) as conn, conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS todos
                   (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT NOT NULL)"""
        )
        # Serialize schema migration across workers starting simultaneously.
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS auth_sessions "
            "(token_hash TEXT PRIMARY KEY, auth_version TEXT NOT NULL, expires_at REAL NOT NULL)"
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_auth_expiry ON auth_sessions (expires_at)")
        # Lightweight migrations for existing databases.
        todo_columns = {row[1] for row in conn.execute("PRAGMA table_info(todos)")}
        if "done" not in todo_columns:
            conn.execute("ALTER TABLE todos ADD COLUMN done INTEGER NOT NULL DEFAULT 0")
        if "created_at" not in todo_columns:
            conn.execute("ALTER TABLE todos ADD COLUMN created_at REAL")
        if "position" not in todo_columns:
            conn.execute("ALTER TABLE todos ADD COLUMN position REAL")
            # Preserve the previous newest-first order for existing rows.
            conn.execute("UPDATE todos SET position = -id WHERE position IS NULL")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS login_attempts
                   (id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip TEXT NOT NULL,
                    created_at REAL NOT NULL)"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip)")


def get_db_connection():
    conn = sqlite3.connect(
        current_app.config["DB_FILE"],
        timeout=current_app.config["SQLITE_TIMEOUT_SECONDS"],
    )
    conn.execute(f"PRAGMA busy_timeout={current_app.config['SQLITE_TIMEOUT_SECONDS'] * 1000}")
    conn.row_factory = sqlite3.Row
    return conn


def format_with_bf(task):
    try:
        with open(BASE_DIR / "format_task.bf") as f:
            bf_code = f.read()
        raw = run_bf(
            bf_code,
            task,
            max_steps=current_app.config["MAX_BF_STEPS"],
            max_output=current_app.config["MAX_BF_OUTPUT"],
        )
        # The formatter emits raw UTF-8 bytes (e.g. its emoji label) one code
        # point per byte. Re-decode the byte stream as UTF-8 for display only;
        # storage and the encrypt round-trip stay byte-accurate and untouched.
        decoded = raw.encode("latin-1", "replace").decode("utf-8", "replace")
        return sanitize_bf_html(decoded)
    except Exception:
        current_app.logger.exception("Brainfuck formatter failed")
        return '<li class="task-item">Task indisponibil momentan.</li>'


def verify_login_with_bf(password):
    try:
        if not isinstance(password, str) or len(password.encode("utf-8")) > 1024:
            return False
        result = run_bf(
            current_app.config["LOGIN_BF_CODE"],
            hashlib.sha256(password.encode("utf-8")).hexdigest(),
            max_steps=current_app.config["MAX_BF_STEPS"],
            max_output=16,
        )
        return result == "1"
    except Exception:
        current_app.logger.exception("Brainfuck login verifier failed")
        return False


def encrypt_with_bf(task):
    try:
        with open(BASE_DIR / "encrypt.bf") as f:
            bf_code = f.read()
        return run_bf(
            bf_code,
            task,
            max_steps=current_app.config["MAX_BF_STEPS"],
            max_output=current_app.config["MAX_TASK_LENGTH"] * 16,
        )
    except Exception:
        current_app.logger.exception("Brainfuck transform failed")
        raise


def get_free_port(start_port=5000):
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
            port += 1


app = create_app()


if __name__ == "__main__":
    port = get_free_port()
    print(f"[*] Binding server to dynamically found available port: {port}")
    app.run(debug=bool_env("BRAINFUCK_DEBUG"), port=port)
