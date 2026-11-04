import subprocess
import sys
from unittest.mock import patch

from tests.test_app import BaseAppTest


class ExpansionTests(BaseAppTest):
    pages = ["academy", "challenges", "library", "graphics", "optimize", "self", "terminal"]

    def test_new_public_pages_have_canonical_metadata_and_no_private_queries(self):
        with patch("app.get_db_connection", side_effect=AssertionError("public task query")):
            for name in self.pages:
                with self.subTest(page=name):
                    response = self.client.get("/" + name)
                    self.assertEqual(response.status_code, 200)
                    self.assertNotIn("Set-Cookie", response.headers)
                    self.assertNotIn("X-Robots-Tag", response.headers)
                    self.assertEqual(response.headers["Cache-Control"], "no-store, no-transform")
                    self.assertIn(
                        'rel="canonical" href="https://brainfuck.micutu.com/' + name + '"',
                        response.get_data(as_text=True),
                    )

    def test_public_program_pages_are_get_only(self):
        for name in self.pages:
            self.assertEqual(self.client.post("/" + name, data={"code": "+[]"}).status_code, 405)

    def test_sitemap_contains_all_educational_pages_and_no_private_workspace(self):
        text = self.client.get("/sitemap.xml").get_data(as_text=True)
        for name in ["lab", *self.pages]:
            self.assertIn("https://brainfuck.micutu.com/" + name, text)
        self.assertNotIn("/tasks", text)
        self.assertNotIn("/export", text)

    def test_brainfuck_assets_are_reproducible_from_build_tools(self):
        subprocess.run(
            [
                sys.executable,
                "-c",
                """
import sys
from pathlib import Path
sys.path.insert(0, 'tools')
from build_algorithms import BUILDERS
from build_terminal import BUILDERS as TERMINAL_BUILDERS
from build_self_interpreter import build
from build_formatter import build as formatter
for name, builder in (BUILDERS | TERMINAL_BUILDERS).items():
    assert Path('static/programs/'+name+'.bf').read_text() == builder(), name
assert Path('static/programs/self-interpreter.bf').read_text() == build()
assert Path('format_task.bf').read_text() == formatter()
""",
            ],
            check=True,
        )
