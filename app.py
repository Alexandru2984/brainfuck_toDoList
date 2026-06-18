import hmac
import logging
import os
import secrets
import socket
import sqlite3
import time
from contextlib import closing
from datetime import timedelta
from html import escape
from html.parser import HTMLParser
from pathlib import Path

from flask import (
    Flask,
    abort,
    current_app,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

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
        "SECURITY_HEADERS_ENABLED": True,
    }


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

    configure_logging(app)
    init_db(app.config["DB_FILE"], app.config["SQLITE_TIMEOUT_SECONDS"])
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
                "request path=%s method=%s status=%s duration_ms=%.2f",
                request.path,
                request.method,
                response.status_code,
                elapsed_ms,
            )
        if current_app.config.get("SECURITY_HEADERS_ENABLED", True):
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
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
            password = request.form.get("password", "")
            if verify_login_with_bf(password):
                session.clear()
                session.permanent = True
                session["logged_in"] = True
                csrf_token()
                return redirect(url_for("index"))
            current_app.logger.warning("failed_login remote_addr=%s", request.remote_addr)
            error = "Parola incorecta! (Validat de Brainfuck)"
        return render_template("login.html", error=error)

    @app.route("/logout", methods=["POST"])
    def logout():
        validate_csrf()
        session.clear()
        return redirect(url_for("login"))

    @app.route("/")
    def index():
        if not session.get("logged_in"):
            return redirect(url_for("login"))

        with closing(get_db_connection()) as conn:
            todos = conn.execute("SELECT * FROM todos ORDER BY id DESC").fetchall()

        formatted_todos = []
        for todo in todos:
            formatted_task = format_with_bf(todo["task"])
            formatted_todos.append({"id": todo["id"], "html": formatted_task})

        return render_template(
            "index.html",
            todos=formatted_todos,
            max_task_length=current_app.config["MAX_TASK_LENGTH"],
        )

    @app.route("/add", methods=["POST"])
    def add():
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        validate_csrf()

        task = request.form.get("task")
        if task:
            if len(task) > current_app.config["MAX_TASK_LENGTH"]:
                abort(413)
            encrypted_task = encrypt_with_bf(escape(task, quote=True))
            with closing(get_db_connection()) as conn, conn:
                conn.execute("INSERT INTO todos (task) VALUES (?)", (encrypted_task,))
        return redirect(url_for("index"))

    @app.route("/delete/<int:id>", methods=["POST"])
    def delete(id):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        validate_csrf()

        with closing(get_db_connection()) as conn, conn:
            conn.execute("DELETE FROM todos WHERE id = ?", (id,))
        return redirect(url_for("index"))


def csrf_token():
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_SESSION_KEY] = token
    return token


def validate_csrf():
    token = session.get(CSRF_SESSION_KEY)
    submitted_token = request.form.get("csrf_token", "")
    if not token or not hmac.compare_digest(token, submitted_token):
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
        return sanitize_bf_html(
            run_bf(
                bf_code,
                task,
                max_steps=current_app.config["MAX_BF_STEPS"],
                max_output=current_app.config["MAX_BF_OUTPUT"],
            )
        )
    except Exception as exc:
        current_app.logger.exception("Brainfuck formatter failed")
        return f'<li class="task-item">Error executing Brainfuck script: {escape(str(exc))}</li>'


def verify_login_with_bf(password):
    try:
        result = run_bf(
            current_app.config["LOGIN_BF_CODE"],
            password,
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
            max_output=current_app.config["MAX_TASK_LENGTH"] * 8,
        )
    except Exception:
        current_app.logger.exception("Brainfuck encryption failed")
        return task


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
