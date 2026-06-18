import os
import re
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing

os.environ.setdefault("BRAINFUCK_SECRET_KEY", "test-secret")
os.environ.setdefault("BRAINFUCK_PASSWORD", "test-password")
os.environ.setdefault("BRAINFUCK_MAX_TASK_LENGTH", "12")

from app import create_app, encrypt_with_bf, format_with_bf
from bf_interpreter import run_bf


class SecurityTests(unittest.TestCase):
    def setUp(self):
        with tempfile.NamedTemporaryFile(delete=False) as db_file:
            self.db_file = db_file.name
        os.unlink(self.db_file)
        self.app = create_app(
            {
                "DB_FILE": self.db_file,
                "TESTING": True,
                "MAX_TASK_LENGTH": 12,
                "SECURITY_HEADERS_ENABLED": True,
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        if os.path.exists(self.db_file):
            os.unlink(self.db_file)

    def csrf_token_from(self, html):
        match = re.search(r'name="csrf_token" value="([^"]+)"', html)
        self.assertIsNotNone(match)
        return match.group(1)

    def login(self):
        login_html = self.client.get("/login").get_data(as_text=True)
        token = self.csrf_token_from(login_html)
        return self.client.post(
            "/login",
            data={"password": "test-password", "csrf_token": token},
        )

    def test_healthcheck_and_security_headers(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"database": "ok", "status": "ok"})
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("frame-ancestors 'none'", response.headers["Content-Security-Policy"])

    def test_login_requires_csrf_and_sets_secure_cookie(self):
        self.assertEqual(
            self.client.post("/login", data={"password": "test-password"}).status_code,
            400,
        )

        response = self.login()
        self.assertEqual(response.status_code, 302)
        cookie = response.headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertIn("Expires=", cookie)

    def test_mutations_require_csrf_and_delete_is_not_get(self):
        self.login()
        index_html = self.client.get("/").get_data(as_text=True)
        token = self.csrf_token_from(index_html)

        self.assertEqual(self.client.post("/add", data={"task": "short"}).status_code, 400)
        self.assertEqual(
            self.client.post("/add", data={"task": "short", "csrf_token": token}).status_code,
            302,
        )
        self.assertEqual(self.client.get("/delete/1").status_code, 405)

    def test_task_length_limit(self):
        self.login()
        index_html = self.client.get("/").get_data(as_text=True)
        self.assertIn('maxlength="12"', index_html)
        token = self.csrf_token_from(index_html)
        response = self.client.post(
            "/add",
            data={"task": "this is too long", "csrf_token": token},
        )
        self.assertEqual(response.status_code, 413)
        self.assertIn("Input prea mare", response.get_data(as_text=True))

    def test_invalid_csrf_returns_error_page(self):
        response = self.client.post("/login", data={"password": "test-password"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Cerere invalida", response.get_data(as_text=True))

    def test_brainfuck_output_is_sanitized(self):
        payload = "<script>alert(1)</script><img src=x onerror=alert(1)>"
        with self.app.app_context():
            rendered = format_with_bf(encrypt_with_bf(payload)).lower()
        self.assertNotIn("<script", rendered)
        self.assertNotIn("<img", rendered)
        self.assertIn("&lt;script&gt;", rendered)
        self.assertIn("&lt;img", rendered)

    def test_brainfuck_step_limit(self):
        with self.assertRaises(TimeoutError):
            run_bf("+[]", "", max_steps=10)

    def test_import_initializes_database_for_gunicorn(self):
        with tempfile.NamedTemporaryFile(delete=False) as import_db_file:
            import_db_path = import_db_file.name
        os.unlink(import_db_path)
        env = os.environ.copy()
        env["BRAINFUCK_DB_FILE"] = import_db_path
        env["BRAINFUCK_SECRET_KEY"] = "test-secret"
        env["BRAINFUCK_PASSWORD"] = "test-password"

        subprocess.run(
            [sys.executable, "-c", "import app"],
            check=True,
            env=env,
            cwd=os.getcwd(),
        )
        with closing(sqlite3.connect(import_db_path)) as conn:
            row = conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'todos'"
            ).fetchone()
        os.unlink(import_db_path)
        self.assertEqual(row[0], "todos")


if __name__ == "__main__":
    unittest.main()
