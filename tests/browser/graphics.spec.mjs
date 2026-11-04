import { test, expect } from "@playwright/test";
test("BF graphics renders exact pixels, exports PNG and respects reduced motion", async ({
  page,
}) => {
  await page.goto("/graphics");
  await expect(page.locator("#graphics-code")).not.toHaveValue("");
  await page.click("#graphics-run");
  await expect(page.locator("#graphics-status")).toContainText("256 pixeli");
  const pixels = await page.locator("#graphics-canvas").evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    data: [...canvas.getContext("2d").getImageData(0, 0, 2, 1).data],
  }));
  expect(pixels).toEqual({
    width: 16,
    height: 16,
    data: [0, 0, 0, 255, 16, 16, 16, 255],
  });
  const download = page.waitForEvent("download");
  await page.click("#graphics-png");
  expect((await download).suggestedFilename()).toBe("brainfuck-frame-1.png");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.selectOption("#graphics-example", "pulse");
  await expect(page.locator("#graphics-description")).toContainText(
    "Opt cadre",
  );
  await page.click("#graphics-run");
  await expect(page.locator("#graphics-status")).toContainText("8 cadre");
  await expect(page.locator("#graphics-play")).toBeDisabled();
  await page.click("#graphics-next");
  await expect(page.locator("#graphics-frame-label")).toContainText(
    "Cadrul 2 / 8",
  );
  await page.fill("#graphics-width", "100000");
  await page.click("#graphics-run");
  await expect(page.locator("#graphics-status")).toContainText(
    "Dimensiuni permise",
  );
  await page.route("**/pixels-gradient.bf", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.goto("/graphics");
  await page.fill("#graphics-code", "+.");
  await page.waitForTimeout(650);
  await expect(page.locator("#graphics-code")).toHaveValue("+.");
});
