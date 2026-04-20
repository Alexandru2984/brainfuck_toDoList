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

This application is deployed as a **personal proof-of-concept**. It is intentionally left online to showcase the integration, but it contains several architectural "flaws" typical of such experiments. **Do not use this for sensitive data.**

1. **Weak Password:** The login password is hardcoded as `brainfuck` inside the `login.bf` script logic. Anyone who reads this or guesses it can access the app.
2. **Hardcoded Secret Key:** To allow Gunicorn's multiple workers to share session cookies seamlessly, the Flask `secret_key` is hardcoded in `app.py`. In a real production app, this would allow session hijacking if the source code were public.
3. **Stored XSS (Cross-Site Scripting):** Because the Brainfuck engine is responsible for rendering raw HTML, the Flask template uses the `| safe` filter. This means any HTML or JavaScript injected into a task (e.g., `<script>alert(1)</script>`) will be executed in the browser of anyone viewing the list. 

*This is a feature, not a bug, for this specific experimental sandbox.*

## 💻 Setup & Running (Local Development)

### Requirements
- Python 3.7+
- Flask (`pip install Flask`)

### Instructions

1. **Create a virtual environment (recommended):**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install Flask
   ```

3. **Run the application:**
   ```bash
   python app.py
   ```
   *Note: The application dynamically binds to the first available port starting from `5000` to strictly adhere to a "No Process Termination" mandate.*

4. **Access the application:**
   Open your browser and navigate to the address shown in your terminal.
   **Login Password:** `brainfuck`
