import { test, expect } from "@playwright/test";
test("academy checks real BF predictions and solutions and persists only progress", async ({
  page,
}) => {
  await page.goto("/academy?lesson=cells");
  await expect(page.locator("#lesson-nav button")).toHaveCount(12);
  await page.fill("#prediction-answer", "3");
  await page.click("#prediction-check");
  await expect(page.locator("#prediction-status")).toContainText("Corect");
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
