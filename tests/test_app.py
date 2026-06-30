import os
import re
import sqlite3
import tempfile
import unittest
from contextlib import closing

os.environ.setdefault("BRAINFUCK_SECRET_KEY", "test-secret")
os.environ.setdefault("BRAINFUCK_PASSWORD", "test-password")

from app import create_app, encrypt_with_bf, format_with_bf, init_db


class BaseAppTest(unittest.TestCase):
    overrides = {}

    def setUp(self):
        with tempfile.NamedTemporaryFile(delete=False) as db_file:
            self.db_file = db_file.name
        os.unlink(self.db_file)
        config = {"DB_FILE": self.db_file, "TESTING": True, "MAX_TASK_LENGTH": 80}
        config.update(self.overrides)
        self.app = create_app(config)
        self.client = self.app.test_client()

    def tearDown(self):
        if os.path.exists(self.db_file):
            os.unlink(self.db_file)

    def token(self, path):
        html = self.client.get(path).get_data(as_text=True)
        match = re.search(r'name="csrf_token" value="([^"]+)"', html)
        self.assertIsNotNone(match)
        return match.group(1)

    def login(self):
        return self.client.post(
            "/login",
            data={"password": "test-password", "csrf_token": self.token("/login")},
        )

    def add(self, text):
        return self.client.post("/add", data={"task": text, "csrf_token": self.token("/")})

    def page(self):
        return self.client.get("/").get_data(as_text=True)


class FeatureTests(BaseAppTest):
    def test_add_toggle_edit_delete_flow(self):
        self.login()
        self.add("Buy milk")
        page = self.page()
        self.assertIn("<strong>1</strong> total", page)
        self.assertIn("<strong>1</strong> active", page)
        self.assertIn("Buy milk", page)

        self.client.post("/toggle/1", data={"csrf_token": self.token("/")})
        page = self.page()
        self.assertIn("task-wrapper is-done", page)
        self.assertIn("<strong>1</strong> finalizate", page)

        self.client.post("/edit/1", data={"task": "Buy bread", "csrf_token": self.token("/")})
        self.assertIn("Buy bread", self.page())

        self.client.post("/delete/1", data={"csrf_token": self.token("/")})
        self.assertIn("Niciun task", self.page())

    def test_clear_completed_only_removes_done(self):
        self.login()
        self.add("Keep me")
        self.add("Remove me")
        self.client.post("/toggle/2", data={"csrf_token": self.token("/")})
        self.client.post("/clear-completed", data={"csrf_token": self.token("/")})
        page = self.page()
        self.assertIn("<strong>1</strong> total", page)
        self.assertIn("Keep me", page)

    def test_edit_enforces_length_limit(self):
        self.login()
        self.add("Short")
        response = self.client.post(
            "/edit/1",
            data={"task": "x" * 200, "csrf_token": self.token("/")},
        )
        self.assertEqual(response.status_code, 413)

    def test_mutations_require_login(self):
        # No session -> redirected to login instead of mutating.
        self.assertEqual(self.client.post("/toggle/1").status_code, 302)
        self.assertEqual(self.client.post("/clear-completed").status_code, 302)

    def test_formatter_decodes_emoji_label(self):
        with self.app.app_context():
            html = format_with_bf(encrypt_with_bf("Buy milk"))
        self.assertIn("\U0001f9e0", html)  # brain emoji renders, not mojibake


class ThrottleTests(BaseAppTest):
    overrides = {"LOGIN_MAX_ATTEMPTS": 3, "LOGIN_WINDOW_SECONDS": 300}

    def wrong_login(self):
        return self.client.post(
            "/login", data={"password": "nope", "csrf_token": self.token("/login")}
        )

    def test_lockout_after_max_attempts(self):
        for _ in range(3):
            self.assertEqual(self.wrong_login().status_code, 200)
        locked = self.wrong_login()
        self.assertEqual(locked.status_code, 429)
        self.assertIn("Retry-After", locked.headers)

    def test_successful_login_clears_attempts(self):
        self.wrong_login()
        self.wrong_login()
        self.assertEqual(self.login().status_code, 302)


class HeaderTests(BaseAppTest):
    def test_dynamic_pages_are_not_cached(self):
        response = self.client.get("/login")
        self.assertEqual(response.headers.get("Cache-Control"), "no-store")
        self.assertEqual(response.headers.get("Cross-Origin-Opener-Policy"), "same-origin")

    def test_static_assets_are_cacheable(self):
        response = self.client.get("/static/app.css")
        self.addCleanup(response.close)
        self.assertNotEqual(response.headers.get("Cache-Control"), "no-store")


class MigrationTests(unittest.TestCase):
    def test_init_db_adds_missing_columns(self):
        with tempfile.NamedTemporaryFile(delete=False) as db_file:
            path = db_file.name
        os.unlink(path)
        # Simulate an old database that predates the done/created_at columns.
        with closing(sqlite3.connect(path)) as conn, conn:
            conn.execute(
                "CREATE TABLE todos (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT NOT NULL)"
            )
            conn.execute("INSERT INTO todos (task) VALUES ('legacy')")

        init_db(path)

        with closing(sqlite3.connect(path)) as conn:
            columns = {row[1] for row in conn.execute("PRAGMA table_info(todos)")}
        os.unlink(path)
        self.assertIn("done", columns)
        self.assertIn("created_at", columns)


if __name__ == "__main__":
    unittest.main()
