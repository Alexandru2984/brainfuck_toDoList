import { test, expect } from "@playwright/test";
test("BF self-interpreter executes inside BF and reports real budget exhaustion", async ({
  page,
}) => {
  await page.goto("/self");
  await expect(page.locator("#self-source")).not.toBeEmpty();
  await page.click("#self-run");
  await expect(page.locator("#self-status")).toContainText(
    "coincid cu referința",
  );
  await expect(page.locator("#self-output")).toHaveText("A");
  await expect(page.locator("#self-hex")).toHaveText("41");
  await expect(page.locator("#self-memory span")).toHaveCount(16);
  await page.fill("#self-code", "+[]");
  await page.click("#self-run");
  await expect(page.locator("#self-status")).toContainText("incompletă");
  await expect(page.locator("#self-inner-steps")).toHaveText("—");
  await page.fill("#self-code", "+".repeat(32));
  await page.click("#self-run");
  await expect(page.locator("#self-status")).toContainText(
    "31 de instrucțiuni",
  );
});
