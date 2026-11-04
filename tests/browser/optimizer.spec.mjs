import { test, expect } from "@playwright/test";
test("optimizer compares complete BF state and treats limits as inconclusive", async ({
  page,
}) => {
  await page.goto("/optimize");
  await page.click("#opt-transform");
  await expect(page.locator("#opt-summary")).toContainText("eliminate");
  await page.click("#opt-compare");
  await expect(page.locator("#opt-status")).toContainText(
    "Aceeași stare finală",
  );
  await expect(page.locator("#opt-results tr")).toHaveCount(3);
  await page.fill("#opt-left", ",.");
  await page.fill("#opt-right", ",>.");
  await page.fill("#opt-inputs", '["A"]');
  await page.click("#opt-compare");
  await expect(page.locator("#opt-status")).toContainText("rezultate diferite");
  await page.fill("#opt-left", "+[]");
  await page.fill("#opt-right", "");
  await page.click("#opt-compare");
  await expect(page.locator("#opt-status")).toContainText("neconcludentă");
});
