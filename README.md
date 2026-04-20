# Brainfuck Todo Formatter

This is a simple web-based Todo List application. It uses a Python/Flask backend and SQLite for storage. 
The unique feature of this application is that the presentation logic (formatting the todo items into HTML list items) is handled by a Brainfuck script (`format_task.bf`).

## Architecture

- **Backend:** Python with Flask (`app.py`).
- **Database:** SQLite (single table `todos`).
- **Presentation Logic:** Brainfuck (`format_task.bf`) interpreted by a custom Python Brainfuck interpreter (`bf_interpreter.py`).
- **Frontend:** HTML template (`templates/index.html`).

## Requirements

- Python 3.7+
- Flask (`pip install Flask`)

## Setup & Running

1. **Create a virtual environment (optional but recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Linux/macOS
   # venv\Scripts\activate   # On Windows
   ```

2. **Install dependencies:**
   ```bash
   pip install Flask
   ```

3. **Run the application:**
   ```bash
   python app.py
   ```
   The application will dynamically find an available port starting from 5000 to ensure it does not conflict with existing processes (adhering to the "no process termination" mandate).

4. **Access the application:**
   Open your browser and navigate to the address shown in the terminal (e.g., `http://127.0.0.1:5000/`).
