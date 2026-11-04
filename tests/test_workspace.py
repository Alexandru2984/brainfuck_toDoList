import sqlite3
from contextlib import closing
from datetime import date, timedelta

from tests.test_app import BaseAppTest


class WorkspaceTests(BaseAppTest):
    def create(self, text, **fields):
        return self.client.post(
            "/add", data={"task": text, "csrf_token": self.token("/"), **fields}
        )

    def test_metadata_filters_and_edit_prefill(self):
        self.login()
        self.create("Fix the compiler", priority="2", due_date="2026-01-01", tags="work, Brainfuck")
        page = self.page()
        self.assertIn('value="Fix the compiler"', page)
        self.assertIn("#brainfuck", page)
        records = self.client.get("/export").json
        self.assertEqual(records[0]["priority"], 2)
        self.assertEqual(records[0]["due_date"], "2026-01-01")
        self.assertIn("Fix the compiler", self.client.get("/?tag=brainfuck").get_data(as_text=True))
        self.assertNotIn(
            'class="task-wrapper', self.client.get("/?tag=other").get_data(as_text=True)
        )

    def test_due_filters_and_priority_sort(self):
        self.login()
        self.create("Old task", due_date=(date.today() - timedelta(days=1)).isoformat())
        self.create("Today task", priority="2", due_date=date.today().isoformat())
        self.create("Whenever", priority="0")
        overdue = self.client.get("/?filter=overdue").get_data(as_text=True)
        self.assertIn("Old task", overdue)
        self.assertNotIn("Today task", overdue)
        today = self.client.get("/?filter=today").get_data(as_text=True)
        self.assertIn("Today task", today)
        self.assertNotIn("Old task", today)
        page = self.client.get("/?sort=priority").get_data(as_text=True)
        self.assertLess(page.index('data-id="2"'), page.index('data-id="1"'))
        self.assertLess(page.index('data-id="1"'), page.index('data-id="3"'))

    def test_invalid_metadata_rolls_back_insert(self):
        self.login()
        for fields in [
            {"priority": "9"},
            {"due_date": "2026-02-30"},
            {"tags": "<script>"},
            {"tags": "a,b,c,d,e,f"},
            {"tags": "a" * 25},
        ]:
            self.assertEqual(self.create("invalid", **fields).status_code, 400)
        self.assertEqual(self.client.get("/export").json, [])

    def test_duplicate_and_accessible_movement(self):
        self.login()
        self.create("Original", priority="2", tags="code")
        self.create("Second")
        response = self.client.post(
            "/move/1", data={"direction": "up", "csrf_token": self.token("/")}
        )
        self.assertEqual(response.status_code, 302)
        with closing(sqlite3.connect(self.db_file)) as conn:
            self.assertEqual(
                [r[0] for r in conn.execute("SELECT id FROM todos ORDER BY position")], [1, 2]
            )
        self.client.post("/duplicate/1", data={"csrf_token": self.token("/")})
        records = self.client.get("/export").json
        self.assertEqual(records[-1]["task"], "Original")
        self.assertEqual(records[-1]["tags"], "code")
        self.assertEqual(records[-1]["priority"], 2)

    def test_pagination_bounds_rendered_brainfuck_cards(self):
        self.login()
        self.app.config["PAGE_SIZE"] = 2
        for i in range(5):
            self.create(f"Task {i}")
        page = self.page()
        self.assertEqual(page.count('<article class="task-wrapper'), 2)
        last = self.client.get("/?page=9999").get_data(as_text=True)
        self.assertEqual(last.count('<article class="task-wrapper'), 1)
        self.assertIn("3 / 3", last)

    def test_new_routes_require_auth_csrf_and_existing_task(self):
        for route in ["/duplicate/1", "/move/1"]:
            self.assertEqual(self.client.post(route).status_code, 302)
        self.login()
        for route in ["/duplicate/1", "/move/1"]:
            self.assertEqual(self.client.post(route).status_code, 400)
        self.assertEqual(
            self.client.post("/duplicate/99", data={"csrf_token": self.token("/")}).status_code, 404
        )

    def test_formatter_has_no_inline_styles(self):
        self.login()
        self.create("Clean presentation")
        self.assertNotIn("style=", self.page())
        self.assertNotIn("unsafe-inline", self.client.get("/").headers["Content-Security-Policy"])
