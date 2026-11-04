import { test, expect } from "@playwright/test";
async function run(page) {
  await page.click("#run");
  await expect(page.locator("#run-status")).toHaveText("Execuție încheiată.");
}
test("real Worker runs examples, UTF-8, challenges and step debugging", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/lab");
  await expect(page.locator(".example-button")).toHaveCount(10);
  await run(page);
  await expect(page.locator("#output")).toHaveText("Hello World!");
  await page.click('[data-example="echo"]');
  await page.fill("#stdin", "Salut, 🧠");
  await run(page);
  await expect(page.locator("#output")).toHaveText("Salut, 🧠");
  await page.selectOption("#challenge-select", "echo");
  await page.click("#verify-challenge");
  await expect(page.locator(".test-result.pass")).toHaveCount(4);
  await expect(page.locator("#challenge-progress")).toHaveText(
    "1 / 8 rezolvate",
  );
  await page.click("#reset");
  await page.fill("#code", "+>++.");
  await page.click("#step");
  await expect(page.locator("#metric-steps")).toHaveText("1");
  await expect(page.locator(".memory-cell")).toHaveCount(16);
  expect(errors).toEqual([]);
});
test("a delayed example preserves input typed while its source loads", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/programs/echo.bf", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/lab");
  const requested = page.waitForRequest("**/programs/echo.bf");
  await page.click('[data-example="echo"]');
  await requested;
  await page.fill("#stdin", "Salut, 🧠");
  await expect(page.locator("#run")).toBeDisabled();
  await expect(page.locator("#step")).toBeDisabled();
  await page.locator("#stdin").press("Control+Enter");
  await expect(page.locator("#metric-steps")).toHaveText("0");
  release();
  await expect(page.locator("#run-status")).toContainText("Încărcat:");
  await expect(page.locator("#stdin")).toHaveValue("Salut, 🧠");
  await run(page);
  await expect(page.locator("#output")).toHaveText("Salut, 🧠");
});

test("editing code cancels a pending example before it can overwrite the editor", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let finishRoute;
  const routed = new Promise((resolve) => (finishRoute = resolve));
  await page.route("**/programs/echo.bf", async (route) => {
    await gate;
    await route.continue();
    finishRoute();
  });
  await page.goto("/lab");
  const requested = page.waitForRequest("**/programs/echo.bf");
  await page.click('[data-example="echo"]');
  await requested;
  await expect(page.locator("#run")).toBeDisabled();
  const cancelled = page.waitForEvent("requestfailed", {
    predicate: (request) => request.url().endsWith("/programs/echo.bf"),
  });
  await page.fill("#code", "+++++.");
  await cancelled;
  await expect(page.locator("#run")).toBeEnabled();
  release();
  await routed;
  await run(page);
  await expect(page.locator("#code")).toHaveValue("+++++.");
  await expect(page.locator("#metric-steps")).toHaveText("6");
  await expect(page.locator("#metric-output")).toHaveText("1");
});

test("selecting another example cancels the older request", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/programs/echo.bf", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/lab");
  const requested = page.waitForRequest("**/programs/echo.bf");
  await page.click('[data-example="echo"]');
  await requested;
  const cancelled = page.waitForEvent("requestfailed", {
    predicate: (request) => request.url().endsWith("/programs/echo.bf"),
  });
  await page.click('[data-example="reverse"]');
  await cancelled;
  release();
  await expect(page.locator("#example-title")).toHaveText("Oglinda");
  await run(page);
  await expect(page.locator("#output")).toHaveText("kcufniarb");
  await expect(page.locator('[data-example="reverse"]')).toHaveClass(
    /is-active/,
  );
});

test("an example fetch failure unlocks execution and allows retry", async ({
  page,
}) => {
  await page.route("**/programs/echo.bf", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/lab");
  await page.click('[data-example="echo"]');
  await expect(page.locator("#run-status")).toContainText(
    "Exemplul nu a putut fi încărcat",
  );
  await expect(page.locator("#run")).toBeEnabled();
  await expect(page.locator("#step")).toBeEnabled();
  await page.unroute("**/programs/echo.bf");
  await page.click('[data-example="echo"]');
  await expect(page.locator("#run-status")).toContainText("Încărcat:");
  await run(page);
  await expect(page.locator("#output")).toHaveText("Salut, Brainfuck!");
});

test("breakpoints, pause, syntax errors and endless loops stay bounded", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.fill("#code", "+++.");
  await page.locator(".debug-options summary").click();
  await page.fill("#breakpoint", "0");
  await page.click("#add-breakpoint");
  await page.click("#run");
  await expect(page.locator("#run-status")).toHaveText(
    "Breakpoint la instrucțiunea 0.",
  );
  await expect(page.locator("#metric-steps")).toHaveText("0");
  await run(page);
  await page.click("#reset");
  await page.click("#clear-breakpoints");
  await page.fill("#code", "+[+]");
  await page.selectOption("#speed", "1");
  await page.click("#run");
  await expect(page.locator("#pause")).toBeEnabled();
  await page.click("#pause");
  await expect(page.locator("#run-status")).toContainText("Pauză.");
  const steps = await page.locator("#metric-steps").textContent();
  await page.waitForTimeout(150);
  await expect(page.locator("#metric-steps")).toHaveText(steps);
  await page.click("#reset");
  await page.selectOption("#speed", "10000");
  await page.fill("#code", "+[]");
  await page.click("#run");
  await expect(page.locator("#run-status")).toContainText("2.000.000");
  await page.click("#reset");
  await page.fill("#code", "[");
  await page.click("#run");
  await expect(page.locator("#run-status")).toContainText("fără pereche");
});
test("sharing contains code only and never autoruns or injects HTML", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.fill("#code", "+.");
  await page.fill("#stdin", "private-input");
  await page.click("#share");
  const url = await page.inputValue("#share-url");
  expect(url).toContain("#code=");
  expect(url).not.toContain("private-input");
  await page.goto(url);
  await expect(page.locator("#code")).toHaveValue("+.");
  await expect(page.locator("#stdin")).toHaveValue("");
  await expect(page.locator("#metric-steps")).toHaveText("0");
  const code = '</textarea><img src=x onerror="window.injected=true">';
  const hash = Buffer.from(JSON.stringify({ v: 1, code })).toString(
    "base64url",
  );
  await page.goto("/lab#code=" + hash);
  await expect(page.locator("#code")).toHaveValue(code);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});
test("draft opt-in, import/export and theme preference persist", async ({
  page,
}) => {
  await page.goto("/lab");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    test.info().project.name === "mobile" ? "dark" : "light",
  );
  await page.click("#theme-toggle");
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.locator(".debug-options summary").click();
  await page.check("#save-draft");
  await page.fill("#code", "++++.");
  await page.fill("#stdin", "do-not-save");
  await page.reload();
  await expect(page.locator("#code")).toHaveValue("++++.");
  await expect(page.locator("#stdin")).toHaveValue("");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await page.setInputFiles("#import-code", {
    name: "sample.bf",
    mimeType: "text/plain",
    buffer: Buffer.from("+++++."),
  });
  await expect(page.locator("#code")).toHaveValue("+++++.");
  const downloadPromise = page.waitForEvent("download");
  await page.click("#download-code");
  expect((await downloadPromise).suggestedFilename()).toBe("program.bf");
  await page.locator(".debug-options summary").click();
  await page.click("#clear-draft");
  expect(
    await page.evaluate(() => localStorage.getItem("bf-lab-draft-v1")),
  ).toBeNull();
});
test("mobile controls are visible rather than clipped inside a wide grid", async ({
  page,
}) => {
  await page.goto("/lab");
  await expect(page.locator(".example-button")).toHaveCount(10);
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    for (const selector of ["#run", "#pause", "#step", "#reset", "#speed"]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  }
});
test("private tasks roundtrip Unicode, metadata, editing and completion", async ({
  page,
}) => {
  const title = "Pâine 🧠 " + test.info().project.name;
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/login$/);
  await page.fill("#password", "browser-test-password");
  await page.locator(".auth-form button").click();
  await expect(page).toHaveURL(/\/tasks$/);
  await page.fill("#new-task", title);
  await page.locator(".compose-options summary").click();
  await page.locator('.compose select[name="priority"]').selectOption("2");
  await page.locator('.compose input[name="tags"]').fill("personal, idei");
  await page.locator(".compose .primary-button").click();
  let task = page
    .locator(".task-wrapper")
    .filter({ has: page.locator(".task-title", { hasText: title }) })
    .first();
  await expect(task.locator(".task-title")).toHaveText(title);
  await expect(task.locator(".tag")).toHaveCount(2);
  await task.locator(".edit summary").click();
  await expect(task.locator('.edit input[name="task"]')).toHaveValue(title);
  await task.locator('.edit input[name="task"]').fill(title + " gata");
  await task.locator(".edit .primary-button").click();
  task = page
    .locator(".task-wrapper")
    .filter({ has: page.locator(".task-title", { hasText: title + " gata" }) })
    .first();
  await task.locator(".toggle-btn").click();
  await expect(task).toHaveClass(/is-done/);
  const response = await page.goto("/tasks");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto("/lab");
  await expect(page.locator("body")).not.toContainText(title);
});
test("reversible debugger restores output and timeline while profiling actual BF steps", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.fill("#code", "+++..");
  await run(page);
  await expect(page.locator("#metric-steps")).toHaveText("5");
  await expect(page.locator("#back")).toBeEnabled();
  await page.click("#back");
  await expect(page.locator("#metric-steps")).toHaveText("4");
  await page.click("#back");
  await expect(page.locator("#metric-steps")).toHaveText("3");
  await expect(page.locator("#output")).toContainText("niciun octet");
  await page.locator("#timeline").evaluate((element) => {
    element.value = "5";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#metric-steps")).toHaveText("5");
  await page.locator(".profiler summary").click();
  await expect(page.locator("#profile-summary")).toContainText("5 pași");
  await expect(page.locator("#profile-instructions li")).toHaveCount(5);
  await page.fill("#stdin", "changed");
  await expect(page.locator("#back")).toBeDisabled();
  await expect(page.locator("#metric-steps")).toHaveText("0");
});
