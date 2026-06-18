import os
import re
import tempfile
import unittest

os.environ.setdefault("BRAINFUCK_SECRET_KEY", "test-secret")
os.environ.setdefault("BRAINFUCK_PASSWORD", "test-password")
db_file = tempfile.NamedTemporaryFile(delete=False)
db_file.close()
os.environ["BRAINFUCK_DB_FILE"] = db_file.name
os.environ.setdefault("BRAINFUCK_MAX_TASK_LENGTH", "12")

from app import app, encrypt_with_bf, format_with_bf, init_db
from bf_interpreter import run_bf


class SecurityTests(unittest.TestCase):
    def setUp(self):
        if os.path.exists(db_file.name):
            os.unlink(db_file.name)
        app.config["TESTING"] = True
        init_db()
        self.client = app.test_client()

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

    def test_brainfuck_output_is_sanitized(self):
        payload = '<script>alert(1)</script><img src=x onerror=alert(1)>'
        rendered = format_with_bf(encrypt_with_bf(payload)).lower()
        self.assertNotIn("<script", rendered)
        self.assertNotIn("<img", rendered)
        self.assertIn("&lt;script&gt;", rendered)
        self.assertIn("&lt;img", rendered)

    def test_brainfuck_step_limit(self):
        with self.assertRaises(TimeoutError):
            run_bf("+[]", "", max_steps=10)


if __name__ == "__main__":
    unittest.main()
