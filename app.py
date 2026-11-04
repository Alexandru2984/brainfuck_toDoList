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
from datetime import date, datetime, timedelta
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
    ALLOWED_CLASSES = {"task-item", "task-title", "bf-label"}

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.ALLOWED_TAGS:
            self.parts.append(escape(self.get_starttag_text()))
            return

        safe_attrs = []
        for name, value in attrs:
            if name == "class" and value in self.ALLOWED_CLASSES:
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
            cache_policy = (
                "no-store, no-transform" if response.mimetype == "text/html" else "no-store"
            )
            response.headers.setdefault("Cache-Control", cache_policy)
        if request.endpoint not in {"static", "lab", "robots", "sitemap"}:
            response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
        if current_app.config.get("SECURITY_HEADERS_ENABLED", True):
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("X-Frame-Options", "DENY")
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
                "default-src 'self'; script-src 'self'; "
                "style-src 'self'; worker-src 'self'; img-src 'self' data: blob:; "
                "font-src 'self' data:; connect-src 'self'; "
                "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
            )
        return response


def register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(_error):
        return render_template(
            "error.html",
            title="Pagina nu există",
            message="Adresa nu mai este disponibilă. Revino în laborator sau în workspace.",
        ), 404

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
            return redirect(url_for("lab" if request.path == "/" else "login"))
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
    priority, due_date, tags = task_metadata()
    target = (
        todo_id if todo_id is not None else conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    )
    conn.execute(
        "UPDATE todos SET priority = ?, due_date = ?, tags = ? WHERE id = ?",
        (priority, due_date, tags, target),
    )
    return True


def task_metadata():
    raw_priority = request.form.get("priority", "1")
    if raw_priority not in {"0", "1", "2"}:
        abort(400)
    due = request.form.get("due_date", "").strip()
    if due:
        try:
            if len(due) != 10 or date.fromisoformat(due).isoformat() != due:
                abort(400)
        except ValueError:
            abort(400)
    raw_tags = request.form.get("tags", "")
    if len(raw_tags) > 124:
        abort(400)
    tags = list(dict.fromkeys(t.strip().casefold() for t in raw_tags.split(",") if t.strip()))
    if len(tags) > 5 or any(
        len(t) > 24 or not all(c.isalnum() or c in "-_ " for c in t) for t in tags
    ):
        abort(400)
    return int(raw_priority), due or None, ",".join(tags)


def register_routes(app):
    @app.route("/robots.txt")
    def robots():
        return Response(
            "User-agent: *\nAllow: /lab\nAllow: /static/\n"
            "Disallow: /tasks\nDisallow: /login\nDisallow: /export\n"
            "\nSitemap: https://brainfuck.micutu.com/sitemap.xml\n",
            mimetype="text/plain",
        )

    @app.route("/sitemap.xml")
    def sitemap():
        return Response(
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            "<url><loc>https://brainfuck.micutu.com/lab</loc></url></urlset>",
            mimetype="application/xml",
        )

    @app.route("/lab")
    def lab():
        instructions = [
            (">", "Înainte", "Mută pointerul cu o celulă la dreapta."),
            ("<", "Înapoi", "Mută pointerul cu o celulă la stânga."),
            ("+", "Adună", "Crește valoarea celulei curente cu 1."),
            ("-", "Scade", "Scade valoarea celulei curente cu 1."),
            (".", "Afișează", "Trimite valoarea celulei curente în output, ca octet."),
            (",", "Citește", "Citește un octet din input în celula curentă. La EOF scrie 0."),
            ("[", "Intră în buclă", "Dacă celula este 0, sare după paranteza pereche ]."),
            ("]", "Repetă", "Dacă celula nu este 0, revine la începutul buclei."),
        ]
        return render_template(
            "lab.html",
            default_source=(BASE_DIR / "static/programs/hello.bf").read_text(),
            instructions=instructions,
        )

    @app.route("/healthz")
    def healthz():
        try:
            with closing(get_db_connection()) as conn:
                conn.execute("SELECT 1 FROM todos LIMIT 1").fetchone()
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
    @app.route("/tasks")
    @login_required
    def index():
        query = request.args.get("q", "").strip()
        if len(query) > 120:
            abort(400)
        status = request.args.get("filter", "all")
        if status not in {"all", "active", "done", "overdue", "today"}:
            status = "all"
        sort = request.args.get("sort", "manual")
        order = {
            "manual": "SELECT * FROM todos ORDER BY done ASC, position ASC, id DESC",
            "priority": "SELECT * FROM todos ORDER BY done ASC, priority DESC, position ASC, id DESC",
            "due": "SELECT * FROM todos ORDER BY done ASC, due_date IS NULL, due_date ASC, priority DESC, id DESC",
            "newest": "SELECT * FROM todos ORDER BY done ASC, id DESC",
        }
        if sort not in order:
            sort = "manual"
        tag = request.args.get("tag", "").strip().casefold()
        if len(tag) > 24:
            abort(400)
        today = date.today().isoformat()
        with closing(get_db_connection()) as conn:
            todos = conn.execute(order[sort]).fetchall()
        total_count = len(todos)
        active_count = sum(not t["done"] for t in todos)
        overdue_count = sum(
            not t["done"] and bool(t["due_date"]) and t["due_date"] < today for t in todos
        )
        all_tags = sorted({t.strip() for row in todos for t in row["tags"].split(",") if t.strip()})
        filtered = []
        for todo in todos:
            if (
                (status == "active" and todo["done"])
                or (status == "done" and not todo["done"])
                or (
                    status == "overdue"
                    and (todo["done"] or not todo["due_date"] or todo["due_date"] >= today)
                )
                or (status == "today" and (todo["done"] or todo["due_date"] != today))
            ):
                continue
            if tag and tag not in [t.casefold() for t in todo["tags"].split(",")]:
                continue
            if (
                query
                and query.casefold()
                not in bf_payload_to_text(decrypt_storage(todo["task"])).casefold()
            ):
                continue
            filtered.append(todo)
        page = request.args.get("page", 1, type=int)
        pages = max(1, math.ceil(len(filtered) / current_app.config["PAGE_SIZE"]))
        page = min(max(page, 1), pages)
        offset = (page - 1) * current_app.config["PAGE_SIZE"]
        formatted_todos = []
        for todo in filtered[offset : offset + current_app.config["PAGE_SIZE"]]:
            payload = decrypt_storage(todo["task"])
            formatted_todos.append(
                {
                    **dict(todo),
                    "html": format_with_bf(payload),
                    "text": bf_payload_to_text(payload),
                    "created_at": format_timestamp(todo["created_at"]),
                    "overdue": bool(
                        todo["due_date"] and todo["due_date"] < today and not todo["done"]
                    ),
                    "tag_list": [t for t in todo["tags"].split(",") if t],
                }
            )
        return render_template(
            "index.html",
            todos=formatted_todos,
            total_count=total_count,
            active_count=active_count,
            done_count=total_count - active_count,
            overdue_count=overdue_count,
            shown_count=len(filtered),
            query=query,
            status=status,
            sort=sort,
            tag=tag,
            all_tags=all_tags,
            page=page,
            pages=pages,
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
            if not conn.execute("UPDATE todos SET done = 1 - done WHERE id = ?", (id,)).rowcount:
                abort(404)
        return redirect(url_for("index"))

    @app.route("/delete/<int:id>", methods=["POST"])
    @login_required
    def delete(id):
        validate_csrf()
        with closing(get_db_connection()) as conn, conn:
            if not conn.execute("DELETE FROM todos WHERE id = ?", (id,)).rowcount:
                abort(404)
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

    @app.route("/move/<int:id>", methods=["POST"])
    @login_required
    def move(id):
        validate_csrf()
        direction = request.form.get("direction")
        if direction not in {"up", "down"}:
            abort(400)
        with closing(get_db_connection()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            rows = list(
                conn.execute("SELECT id FROM todos ORDER BY done ASC, position ASC, id DESC")
            )
            ids = [r["id"] for r in rows]
            if id not in ids:
                abort(404)
            i = ids.index(id)
            j = i + (-1 if direction == "up" else 1)
            if 0 <= j < len(ids):
                ids[i], ids[j] = ids[j], ids[i]
                conn.executemany("UPDATE todos SET position = ? WHERE id = ?", enumerate(ids))
        return redirect(url_for("index"))

    @app.route("/duplicate/<int:id>", methods=["POST"])
    @login_required
    def duplicate(id):
        validate_csrf()
        with closing(get_db_connection()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM todos WHERE id = ?", (id,)).fetchone()
            if row is None:
                abort(404)
            if (
                conn.execute("SELECT COUNT(*) FROM todos").fetchone()[0]
                >= current_app.config["MAX_TASKS"]
            ):
                abort(413)
            # Authenticate and re-encrypt rather than duplicating damaged bytes.
            task = encrypt_storage(decrypt_storage(row["task"]))
            conn.execute(
                "INSERT INTO todos (task, done, created_at, position, priority, due_date, tags) "
                "VALUES (?, 0, ?, ?, ?, ?, ?)",
                (
                    task,
                    time.time(),
                    next_top_position(conn),
                    row["priority"],
                    row["due_date"],
                    row["tags"],
                ),
            )
        flash("Task duplicat.", "success")
        return redirect(url_for("index"))

    @app.route("/export")
    @login_required
    def export():
        fmt = request.args.get("format", "json").lower()
        if fmt not in {"json", "csv"}:
            abort(400)
        with closing(get_db_connection()) as conn:
            rows = conn.execute(
                "SELECT id, task, done, created_at, priority, due_date, tags FROM todos ORDER BY id"
            ).fetchall()
        records = [
            {
                "id": row["id"],
                "task": bf_payload_to_text(decrypt_storage(row["task"])),
                "done": bool(row["done"]),
                "created_at": iso_timestamp(row["created_at"]),
                "priority": row["priority"],
                "due_date": row["due_date"],
                "tags": row["tags"],
            }
            for row in rows
        ]

        if fmt == "csv":
            buffer = io.StringIO()
            writer = csv.DictWriter(
                buffer,
                fieldnames=["id", "task", "done", "created_at", "priority", "due_date", "tags"],
            )
            writer.writeheader()
            for record in records:
                writer.writerow(
                    {
                        key: csv_safe(value) if isinstance(value, str) else value
                        for key, value in record.items()
                    }
                )
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
        for column, definition in {
            "priority": "INTEGER NOT NULL DEFAULT 1",
            "due_date": "TEXT",
            "tags": "TEXT NOT NULL DEFAULT ''",
        }.items():
            if column not in todo_columns:
                conn.execute(f"ALTER TABLE todos ADD COLUMN {column} {definition}")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_todos_order ON todos (done, position, id)")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS login_attempts
                   (id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip TEXT NOT NULL,
                    created_at REAL NOT NULL)"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip)")


def get_db_connection():
    conn = sqlite3.connect(
        Path(current_app.config["DB_FILE"]).resolve().as_uri() + "?mode=rw",
        uri=True,
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
