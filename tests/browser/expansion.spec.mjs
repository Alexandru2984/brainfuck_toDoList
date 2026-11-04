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
