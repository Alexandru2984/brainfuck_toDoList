import hashlib
import os
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from unittest.mock import patch

from cryptography.fernet import Fernet, InvalidToken

from app import (
    create_app,
    csv_safe,
    decrypt_storage,
    encrypt_storage,
    reserve_login_attempt,
    verify_login_with_bf,
)
from bf_interpreter import run_bf
from generate_login_bf import generate_login_bf
from tests.test_app import BaseAppTest


class AuthRegressionTests(BaseAppTest):
    def test_concurrent_workers_share_atomic_login_budget(self):
        self.app.config["LOGIN_MAX_ATTEMPTS"] = 3

        def reserve(_):
            with self.app.app_context():
                return reserve_login_attempt("192.0.2.10")

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(reserve, range(8)))
        self.assertEqual(results.count(0), 3)
        self.assertTrue(all(value > 0 for value in results if value != 0))

    def test_password_overflow_and_nul_suffix_are_rejected(self):
        candidates = [
            "test-password\0trailing",
            "test-password" + "a" * 256,
            "Xest-password" + "a" * 255,
            "x" * 256,
            "",
            "ș🧠",
            "x" * 1025,
        ]
        with self.app.app_context():
            self.assertTrue(verify_login_with_bf("test-password"))
            for value in candidates:
                with self.subTest(value_length=len(value)):
                    self.assertFalse(verify_login_with_bf(value))

    def test_brainfuck_comparator_handles_utf8_passwords(self):
        password = "parolă-🧠"
        code = generate_login_bf(password)
        self.assertEqual(run_bf(code, hashlib.sha256(password.encode()).hexdigest()), "1")
        self.assertEqual(run_bf(code, "0" * 64), "0")

    def test_copied_cookie_is_revoked_after_logout(self):
        self.login()
        stolen = self.client.get_cookie("session").value
        self.client.post("/logout", data={"csrf_token": self.token("/")})
        attacker = self.app.test_client()
        attacker.set_cookie("session", stolen)
        self.assertEqual(attacker.get("/").status_code, 302)

    def test_auth_version_change_and_expiry_revoke_sessions(self):
        self.login()
        self.app.config["AUTH_VERSION"] = "rotated-password"
        self.assertEqual(self.client.get("/").status_code, 302)
        self.login()
        with closing(sqlite3.connect(self.db_file)) as conn, conn:
            conn.execute("UPDATE auth_sessions SET expires_at = 0")
        self.assertEqual(self.client.get("/").status_code, 302)

    def test_unicode_csrf_is_a_client_error(self):
        self.client.get("/login")
        result = self.client.post("/login", data={"csrf_token": "ș🧠", "password": "wrong"})
        self.assertEqual(result.status_code, 400)

    def test_host_header_and_forwarded_host_are_not_trusted(self):
        self.assertEqual(
            self.client.get("/login", headers={"Host": "evil.example"}).status_code, 400
        )
        self.app.config["TRUST_PROXY"] = True
        response = self.client.get("/login", headers={"X-Forwarded-Host": "evil.example"})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("evil.example", response.get_data(as_text=True))

    def test_spoofed_ip_headers_do_not_bypass_throttle(self):
        self.app.config["LOGIN_MAX_ATTEMPTS"] = 2
        for i in range(2):
            self.client.post(
                "/login",
                data={"password": "wrong", "csrf_token": self.token("/login")},
                headers={
                    "CF-Connecting-IP": f"198.51.100.{i}",
                    "X-Forwarded-For": f"198.51.100.{i}",
                },
            )
        response = self.client.post(
            "/login", data={"password": "test-password", "csrf_token": self.token("/login")}
        )
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response.headers)

    def test_proxy_uses_rightmost_hop_only(self):
        app = create_app(
            {"DB_FILE": self.db_file, "TESTING": True, "TRUST_PROXY": True, "LOGIN_MAX_ATTEMPTS": 1}
        )
        client = app.test_client()
        for i in range(2):
            html = client.get("/login").get_data(as_text=True)
            import re

            token = re.search(r'name="csrf_token" value="([^"]+)"', html).group(1)
            response = client.post(
                "/login",
                data={"password": "wrong", "csrf_token": token},
                headers={
                    "X-Forwarded-For": f"198.51.100.{i}, 192.0.2.1",
                    "CF-Connecting-IP": f"198.51.100.{i}",
                },
            )
        self.assertEqual(response.status_code, 429)


class StorageRegressionTests(BaseAppTest):
    def test_missing_database_fails_health_without_recreating_it(self):
        os.unlink(self.db_file)
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 503)
        self.assertFalse(os.path.exists(self.db_file))

    def test_key_rotation_retains_old_tokens_and_uses_new_primary_key(self):
        self.login()
        self.add("Old key task")
        with closing(sqlite3.connect(self.db_file)) as conn:
            stored = conn.execute("SELECT task FROM todos WHERE id = 1").fetchone()[0]
        with self.app.app_context():
            payload = decrypt_storage(stored)
        # The original test key is derived from the session secret; use an
        # explicit old key on a fresh database for the rotation rehearsal.
        old_key, new_key = Fernet.generate_key().decode(), Fernet.generate_key().decode()
        old_token = "bf1:" + Fernet(old_key).encrypt(payload.encode("latin-1")).decode()
        with closing(sqlite3.connect(self.db_file)) as conn, conn:
            conn.execute("UPDATE todos SET task = ? WHERE id = 1", (old_token,))
        rotated = create_app(
            {"DB_FILE": self.db_file, "TESTING": True, "ENCRYPTION_KEY": new_key + "," + old_key}
        )
        with rotated.app_context():
            self.assertEqual(decrypt_storage(old_token), payload)
            new_token = encrypt_storage(payload)
        self.assertEqual(Fernet(new_key).decrypt(new_token[4:].encode()).decode("latin-1"), payload)
        with closing(sqlite3.connect(self.db_file)) as conn:
            self.assertEqual(
                conn.execute("SELECT task FROM todos WHERE id = 1").fetchone()[0], old_token
            )
        # A token from another key must still be rejected, never re-encrypted.
        with rotated.app_context(), self.assertRaises(InvalidToken):
            decrypt_storage(stored)

    def test_unicode_roundtrip_search_and_export(self):
        self.login()
        value = "Cumpără pâine 🧠 日本語 ÿ <script> & =1"
        self.add(value)
        data = self.client.get("/export").json
        self.assertEqual(data[0]["task"], value)
        self.assertIn("task-wrapper", self.client.get("/?q=pâine").get_data(as_text=True))
        self.assertNotIn("<script>", self.page())

    def test_nul_input_is_rejected_without_partial_write(self):
        self.login()
        self.assertEqual(self.add("before\0after").status_code, 400)
        self.assertEqual(self.client.get("/export").json, [])

    def test_transform_failure_does_not_store_plaintext(self):
        self.login()
        token = self.token("/")
        with (
            patch("app.encrypt_with_bf", side_effect=TimeoutError),
            self.assertRaises(TimeoutError),
        ):
            self.client.post("/add", data={"task": "secret", "csrf_token": token})
        self.assertEqual(self.client.get("/export").json, [])

    def test_altered_ciphertext_is_not_reencrypted_at_startup(self):
        self.login()
        self.add("Keep authentic")
        with closing(sqlite3.connect(self.db_file)) as conn, conn:
            conn.execute("UPDATE todos SET task = 'bf1:corrupted'")
        with self.assertRaises(InvalidToken):
            create_app({"DB_FILE": self.db_file, "TESTING": True})
        with closing(sqlite3.connect(self.db_file)) as conn:
            self.assertEqual(conn.execute("SELECT task FROM todos").fetchone()[0], "bf1:corrupted")

    def test_reorder_is_atomic_and_rejects_invalid_sets(self):
        self.login()
        self.add("one")
        self.add("two")
        for value in ["1,1", "1", "1,9", "-1,2", "1,2,x", "1," + "9" * 50, ""]:
            response = self.client.post(
                "/reorder", data={"order": value, "csrf_token": self.token("/")}
            )
            self.assertEqual(response.status_code, 400)
        self.assertEqual(
            self.client.post(
                "/reorder", data={"order": "1,2", "csrf_token": self.token("/")}
            ).status_code,
            204,
        )
        with closing(sqlite3.connect(self.db_file)) as conn:
            self.assertEqual(
                [r[0] for r in conn.execute("SELECT id FROM todos ORDER BY position")], [1, 2]
            )

    def test_collection_limit(self):
        self.login()
        self.app.config["MAX_TASKS"] = 1
        self.add("one")
        self.assertEqual(self.add("two").status_code, 413)

    def test_csv_formula_prefixes(self):
        for value in ["=1", "+cmd", "-1", "@SUM(1)", "\n=1", "  =1", "\tcmd"]:
            self.assertTrue(csv_safe(value).startswith("'"))
        self.assertEqual(csv_safe("plain text"), "plain text")

    def test_interpreter_rejects_invalid_programs_and_limits(self):
        for code in ["[", "]"]:
            with self.assertRaises(ValueError):
                run_bf(code, "")
        with self.assertRaises(ValueError):
            run_bf("...", "", max_output=2)
        with self.assertRaises(ValueError):
            run_bf(",.", "🧠")
