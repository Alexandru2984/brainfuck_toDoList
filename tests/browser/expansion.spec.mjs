import { test, expect } from "@playwright/test";
test("academy checks real BF predictions and solutions and persists only progress", async ({
  page,
}) => {
  await page.goto("/academy?lesson=cells");
  await expect(page.locator("#lesson-nav button")).toHaveCount(12);
  await page.fill("#prediction-answer", "3");
  await page.click("#prediction-check");
  await expect(page.locator("#prediction-status")).toContainText("Corect");
  await page.fill("#lesson-code", ".");
  await page.click("#lesson-check");
  await expect(page.locator("#lesson-results")).toContainText("Obținut:");
  await expect(page.locator("#lesson-results")).toContainText("HEX 00");
  await page.fill("#lesson-code", "+".repeat(65) + ".");
  await page.click("#lesson-check");
  await expect(page.locator("#lesson-status")).toContainText(
    "Exercițiu rezolvat",
  );
  await expect(page.locator("#lesson-progress")).toContainText("1 / 12");
  await page.reload();
  await expect(page.locator("#lesson-progress")).toContainText("1 / 12");
  await page.click("#lesson-next");
  await expect(page.locator("#lesson-title")).toContainText("Pointerul");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("bf-academy-v1")),
    ),
  ).toEqual(["cells"]);
});
test("daily challenges validate BF and keep separate local scores without source persistence", async ({
  page,
}) => {
  const { dailyPuzzle } = await import("../../static/daily.mjs");
  const { readFile } = await import("node:fs/promises");
  const date = "2026-11-01",
    puzzle = dailyPuzzle(date),
    code =
      puzzle.reference ??
      (await readFile(
        new URL("../../static/programs/" + puzzle.file, import.meta.url),
        "utf8",
      ));
  await page.goto("/challenges?date=" + date);
  await expect(page.locator("#daily-title")).toHaveText(puzzle.title);
  await page.fill("#daily-code", code);
  await page.click("#daily-check");
  await expect(page.locator("#daily-status")).toContainText(
    "Toate cazurile au trecut",
  );
  await expect(page.locator("#record-length")).not.toHaveText("—");
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("bf-daily-records-v1")),
  );
  expect(Object.keys(records[date]).sort()).toEqual([
    "cells",
    "length",
    "steps",
  ]);
  await page.click("#daily-share");
  const url = await page.inputValue("#daily-share-url");
  await page.goto(url);
  await expect(page.locator("#daily-code")).toHaveValue(code);
  await expect(page.locator("#daily-results")).toBeEmpty();
});
test("algorithm library executes actual BF and opens large sources in the debugger", async ({
  page,
}) => {
  await page.goto("/library?program=division");
  await expect(page.locator("#library-cards article")).toHaveCount(23);
  await expect(page.locator("#library-title")).toHaveText("Împărțire cu rest");
  await page.fill("#library-input", "92");
  await page.click("#library-run");
  await expect(page.locator("#library-output")).toHaveText("4 1");
  await page.click("#library-test");
  await expect(page.locator("#library-results .pass")).toHaveCount(4);
  await page.goto("/library?program=rot13");
  await expect(page.locator("#library-source")).toContainText("[");
  await page.click("#library-lab");
  await expect(page).toHaveURL(/program=rot13/);
  await expect(page.locator("#example-title")).toHaveText("ROT13");
  expect((await page.locator("#code").inputValue()).length).toBeGreaterThan(
    6000,
  );
});
for (const width of [320, 390, 768, 1440]) {
  test(`educational pages keep visible controls within ${width}px`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/academy",
      "/challenges",
      "/library",
      "/graphics",
      "/optimize",
      "/self",
      "/terminal",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${path} overflow at ${width}`,
      ).toBeLessThanOrEqual(width + 1);
      const primary = page.locator("main .primary-button:visible").first();
      await expect(primary).toBeVisible();
      const box = await primary.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(errors).toEqual([]);
  });
}
test("shared programs remain inert and cannot inject markup in any educational editor", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const payload = '</textarea><img src=x onerror="window.injected=true">';
  const hash = Buffer.from(JSON.stringify({ v: 1, code: payload })).toString(
    "base64url",
  );
  for (const [path, editor] of [
    ["/self", "#self-code"],
    ["/graphics", "#graphics-code"],
    ["/challenges", "#daily-code"],
    ["/terminal", "#terminal-code"],
  ]) {
    await page.goto(path + "#code=" + hash);
    await expect(page.locator(editor)).toHaveValue(payload);
    expect(await page.evaluate(() => window.injected)).toBeUndefined();
  }
  expect(errors).toEqual([]);
});
