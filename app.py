import os
import socket
from flask import Flask, render_template, request, redirect, url_for
import sqlite3
from bf_interpreter import run_bf

app = Flask(__name__)
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

@app.route('/')
def index():
    conn = get_db_connection()
    todos = conn.execute('SELECT * FROM todos').fetchall()
    conn.close()
    
    formatted_todos = []
    for todo in todos:
        # Trecem fiecare task prin Brainfuck pentru a fi impachetat in tag-urile HTML
        formatted_task = format_with_bf(todo['task'])
        formatted_todos.append({'id': todo['id'], 'html': formatted_task})
        
    return render_template('index.html', todos=formatted_todos)

@app.route('/add', methods=['POST'])
def add():
    task = request.form.get('task')
    if task:
        conn = get_db_connection()
        conn.execute('INSERT INTO todos (task) VALUES (?)', (task,))
        conn.commit()
        conn.close()
    return redirect(url_for('index'))

@app.route('/delete/<int:id>')
def delete(id):
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
