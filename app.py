import hmac
import os
import secrets
import socket
from contextlib import closing
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from flask import Flask, abort, render_template, request, redirect, url_for, session
import sqlite3
from bf_interpreter import run_bf
from generate_login_bf import generate_login_bf

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent
DB_FILE = os.environ.get('BRAINFUCK_DB_FILE', str(BASE_DIR / 'todos.db'))


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
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


app.secret_key = required_env('BRAINFUCK_SECRET_KEY', 'SECRET_KEY')
LOGIN_BF_CODE = generate_login_bf(required_env('BRAINFUCK_PASSWORD'))
CSRF_SESSION_KEY = '_csrf_token'
MAX_TASK_LENGTH = int_env('BRAINFUCK_MAX_TASK_LENGTH', 500)
MAX_BF_STEPS = int_env('BRAINFUCK_MAX_BF_STEPS', 1_000_000)
MAX_BF_OUTPUT = int_env('BRAINFUCK_MAX_BF_OUTPUT', 50_000)
app.config.update(
    MAX_CONTENT_LENGTH=int_env('BRAINFUCK_MAX_CONTENT_LENGTH', 16 * 1024),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=os.environ.get('BRAINFUCK_COOKIE_SECURE', '1') != '0',
    SESSION_COOKIE_SAMESITE=os.environ.get('BRAINFUCK_COOKIE_SAMESITE', 'Lax'),
)


def csrf_token():
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_SESSION_KEY] = token
    return token


def validate_csrf():
    token = session.get(CSRF_SESSION_KEY)
    submitted_token = request.form.get('csrf_token', '')
    if not token or not hmac.compare_digest(token, submitted_token):
        abort(400)


app.jinja_env.globals['csrf_token'] = csrf_token


class BFHTMLSanitizer(HTMLParser):
    ALLOWED_TAGS = {'li', 'div', 'strong', 'em', 'span'}
    ALLOWED_CLASSES = {'task-item'}
    ALLOWED_STYLES = {
        'padding: 15px; border-bottom: 1px solid #eee; font-family: monospace; background: #fff; border-radius: 4px; margin-bottom: 8px;',
        'display: flex; justify-content: space-between; align-items: center;',
        'color: #007bff; font-size: 1.1em;',
        'font-size: 1.3em; color: #111; margin-top: 10px;',
        'color: #d63384; margin-top: 8px; font-size: 0.9em;',
        'color: #28a745; margin-top: 4px; font-size: 0.9em;',
        'letter-spacing: 2px;',
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
            if name == 'class' and value in self.ALLOWED_CLASSES:
                safe_attrs.append((name, value))
            elif name == 'style' and value in self.ALLOWED_STYLES:
                safe_attrs.append((name, value))

        rendered_attrs = ''.join(
            f' {name}="{escape(value, quote=True)}"' for name, value in safe_attrs
        )
        self.parts.append(f'<{tag}{rendered_attrs}>')

    def handle_endtag(self, tag):
        if tag in self.ALLOWED_TAGS:
            self.parts.append(f'</{tag}>')
        else:
            self.parts.append(escape(f'</{tag}>'))

    def handle_data(self, data):
        self.parts.append(escape(data))

    def handle_entityref(self, name):
        self.parts.append(f'&{name};')

    def handle_charref(self, name):
        self.parts.append(f'&#{name};')

    def get_html(self):
        return ''.join(self.parts)


def sanitize_bf_html(html):
    sanitizer = BFHTMLSanitizer()
    sanitizer.feed(html)
    sanitizer.close()
    return sanitizer.get_html()

def init_db():
    with closing(sqlite3.connect(DB_FILE)) as conn:
        with conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS todos
                            (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT)''')


init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def format_with_bf(task):
    try:
        with open(BASE_DIR / 'format_task.bf', 'r') as f:
            bf_code = f.read()
        return sanitize_bf_html(run_bf(
            bf_code,
            task,
            max_steps=MAX_BF_STEPS,
            max_output=MAX_BF_OUTPUT,
        ))
    except Exception as e:
        return f'<li class="task-item">Error executing Brainfuck script: {escape(str(e))}</li>'

def verify_login_with_bf(password):
    try:
        result = run_bf(LOGIN_BF_CODE, password, max_steps=MAX_BF_STEPS, max_output=16)
        return result == '1'
    except Exception as e:
        print("Login BF error:", e)
        return False

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        validate_csrf()
        password = request.form.get('password', '')
        # AICI INTERVINE BRAINFUCK!
        if verify_login_with_bf(password):
            session.clear()
            session['logged_in'] = True
            csrf_token()
            return redirect(url_for('index'))
        else:
            error = "Parola incorecta! (Validat de Brainfuck 🧠)"
    return render_template('login.html', error=error)

@app.route('/logout', methods=['POST'])
def logout():
    validate_csrf()
    session.clear()
    return redirect(url_for('login'))

@app.route('/')
def index():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    with closing(get_db_connection()) as conn:
        todos = conn.execute('SELECT * FROM todos').fetchall()
    
    formatted_todos = []
    for todo in todos:
        # Trecem fiecare task prin Brainfuck pentru a fi impachetat in tag-urile HTML
        formatted_task = format_with_bf(todo['task'])
        formatted_todos.append({'id': todo['id'], 'html': formatted_task})
        
    return render_template('index.html', todos=formatted_todos, max_task_length=MAX_TASK_LENGTH)

def encrypt_with_bf(task):
    try:
        with open(BASE_DIR / 'encrypt.bf', 'r') as f:
            bf_code = f.read()
        return run_bf(bf_code, task, max_steps=MAX_BF_STEPS, max_output=MAX_TASK_LENGTH * 8)
    except Exception as e:
        print("Encrypt BF error:", e)
        return task

@app.route('/add', methods=['POST'])
def add():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    validate_csrf()
        
    task = request.form.get('task')
    if task:
        if len(task) > MAX_TASK_LENGTH:
            abort(413)
        encrypted_task = encrypt_with_bf(escape(task, quote=True))
        with closing(get_db_connection()) as conn:
            with conn:
                conn.execute('INSERT INTO todos (task) VALUES (?)', (encrypted_task,))
    return redirect(url_for('index'))

@app.route('/delete/<int:id>', methods=['POST'])
def delete(id):
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    validate_csrf()
        
    with closing(get_db_connection()) as conn:
        with conn:
            conn.execute('DELETE FROM todos WHERE id = ?', (id,))
    return redirect(url_for('index'))

def get_free_port(start_port=5000):
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
            port += 1

if __name__ == '__main__':
    # Gasim dinamic un port liber conform regulii "Nu omori niciun proces"
    port = get_free_port()
    print(f"[*] Binding server to dynamically found available port: {port}")
    app.run(debug=bool_env('BRAINFUCK_DEBUG'), port=port)
