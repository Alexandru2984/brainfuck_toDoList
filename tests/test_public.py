from tests.test_app import BaseAppTest


class PublicLabTests(BaseAppTest):
    def test_seo_canonical_robots_and_sitemap_are_public_only(self):
        lab = self.client.get("/lab").get_data(as_text=True)
        self.assertIn('rel="canonical" href="https://brainfuck.micutu.com/lab"', lab)
        self.assertIn('property="og:image"', lab)
        robots = self.client.get("/robots.txt")
        self.assertEqual(robots.status_code, 200)
        self.assertEqual(robots.headers["Cache-Control"], "no-store")
        self.assertIn(
            "Sitemap: https://brainfuck.micutu.com/sitemap.xml", robots.get_data(as_text=True)
        )
        sitemap = self.client.get("/sitemap.xml")
        self.assertEqual(sitemap.mimetype, "application/xml")
        text = sitemap.get_data(as_text=True)
        self.assertIn("https://brainfuck.micutu.com/lab", text)
        self.assertNotIn("/tasks", text)
        self.assertNotIn("/login", text)

    def test_public_lab_is_available_without_authentication(self):
        response = self.client.get("/lab")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Opt instrucțiuni.", response.get_data(as_text=True))
        self.assertNotIn("Set-Cookie", response.headers)
        self.assertNotIn("X-Robots-Tag", response.headers)
        self.assertIn("worker-src 'self'", response.headers["Content-Security-Policy"])

    def test_anonymous_home_opens_lab_and_tasks_require_login(self):
        self.assertTrue(self.client.get("/").headers["Location"].endswith("/lab"))
        self.assertTrue(self.client.get("/tasks").headers["Location"].endswith("/login"))
        self.assertEqual(self.client.get("/export").status_code, 302)

    def test_tasks_stay_out_of_public_html(self):
        self.login()
        self.add("Private unique text")
        self.assertNotIn("Private unique text", self.client.get("/lab").get_data(as_text=True))
        self.assertEqual(self.client.get("/tasks").headers["X-Robots-Tag"], "noindex, nofollow")

    def test_brainfuck_sources_are_served_as_text(self):
        response = self.client.get("/static/programs/echo.bf")
        self.addCleanup(response.close)
        self.assertEqual(response.status_code, 200)
        self.assertIn(",[.,]", response.get_data(as_text=True))
        self.assertNotEqual(response.mimetype, "text/html")
