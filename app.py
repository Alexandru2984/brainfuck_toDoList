import os
import socket
from flask import Flask, render_template, request, redirect, url_for, session
import sqlite3
from bf_interpreter import run_bf

app = Flask(__name__)
app.secret_key = os.urandom(24) # Necesara pentru session cookies
DB_FILE = 'todos.db'

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS todos
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT)''')
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def format_with_bf(task):
    try:
        with open('format_task.bf', 'r') as f:
            bf_code = f.read()
        return run_bf(bf_code, task)
    except Exception as e:
        return f"<li style='color:red;'>Error executing Brainfuck script: {e}</li>"

def verify_login_with_bf(password):
    try:
        with open('login.bf', 'r') as f:
            bf_code = f.read()
        result = run_bf(bf_code, password)
        return result == '1'
    except Exception as e:
        print("Login BF error:", e)
        return False

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        password = request.form.get('password', '')
        # AICI INTERVINE BRAINFUCK!
        if verify_login_with_bf(password):
            session['logged_in'] = True
            return redirect(url_for('index'))
        else:
            error = "Parola incorecta! (Validat de Brainfuck 🧠)"
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/')
def index():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    conn = get_db_connection()
    todos = conn.execute('SELECT * FROM todos').fetchall()
    conn.close()
    
    formatted_todos = []
    for todo in todos:
        # Trecem fiecare task prin Brainfuck pentru a fi impachetat in tag-urile HTML
        formatted_task = format_with_bf(todo['task'])
        formatted_todos.append({'id': todo['id'], 'html': formatted_task})
        
    return render_template('index.html', todos=formatted_todos)

def encrypt_with_bf(task):
    try:
        with open('encrypt.bf', 'r') as f:
            bf_code = f.read()
        return run_bf(bf_code, task)
    except Exception as e:
        print("Encrypt BF error:", e)
        return task

@app.route('/add', methods=['POST'])
def add():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
        
    task = request.form.get('task')
    if task:
        encrypted_task = encrypt_with_bf(task)
        conn = get_db_connection()
        conn.execute('INSERT INTO todos (task) VALUES (?)', (encrypted_task,))
        conn.commit()
        conn.close()
    return redirect(url_for('index'))

@app.route('/delete/<int:id>')
def delete(id):
    if not session.get('logged_in'):
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    conn.execute('DELETE FROM todos WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return redirect(url_for('index'))

def get_free_port(start_port=5000):
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
            port += 1

if __name__ == '__main__':
    # Creem baza de date
    init_db()
    
    # Gasim dinamic un port liber conform regulii "Nu omori niciun proces"
    port = get_free_port()
    print(f"[*] Binding server to dynamically found available port: {port}")
    app.run(debug=True, port=port)
