import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function ready(page, program = "terminal-echo") {
  await page.goto("/terminal?program=" + program);
  await expect(page.locator("#terminal-status")).toHaveText(
    "Program BF încărcat. Apasă Pornește.",
  );
  await expect(page.locator("#terminal-steps")).toHaveText("0");
}
async function answer(page, text) {
  await expect(page.locator("#terminal-state")).toHaveText("Așteaptă input");
  await page.fill("#terminal-input", text);
  await page.click("#terminal-send");
}

test("BF calculator and guessing game converse through a real Worker without execution requests", async ({
  page,
}) => {
  const mutations = [],
    errors = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") mutations.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "terminal-calculator");
  expect((await page.inputValue("#terminal-code")).length).toBeGreaterThan(
    10000,
  );
  await page.click("#terminal-start");
  await expect(page.locator("#terminal-output")).toHaveText("A (0..255): ");
  await answer(page, "255");
  await expect(page.locator("#terminal-output")).toContainText(
    "Operator (+ - *):",
  );
  await answer(page, "+");
  await expect(page.locator("#terminal-output")).toContainText("B (0..255):");
  await answer(page, "1");
  await expect(page.locator("#terminal-state")).toHaveText("Încheiat");
  await expect(page.locator("#terminal-output")).toContainText(
    "Rezultat mod 256: 0",
  );
  await expect(page.locator("#terminal-sent li")).toHaveCount(3);
  await expect(page.locator("#terminal-memory span")).toHaveCount(16);
  await page.click("#terminal-share");
  const url = await page.inputValue("#terminal-share-url");
  expect(url).toMatch(/\/terminal\?program=terminal-calculator$/);
  expect(url).not.toContain("255");
  await page.goto(url);
  await expect(page.locator("#terminal-steps")).toHaveText("0");
  await expect(page.locator("#terminal-start")).toBeEnabled();
  await page.selectOption("#terminal-example", "terminal-guess");
  await expect(page.locator("#terminal-status")).toHaveText(
    "Program BF încărcat. Apasă Pornește.",
  );
  await page.click("#terminal-start");
  await answer(page, "37x");
  await expect(page.locator("#terminal-output")).toContainText(
    "Input invalid.",
  );
  await answer(page, "37");
  await expect(page.locator("#terminal-state")).toHaveText("Încheiat");
  await expect(page.locator("#terminal-output")).toContainText("CORECT");
  expect(mutations).toEqual([]);
  expect(errors).toEqual([]);
});

test("incremental UTF-8, EOF, HEX and binary export preserve the exact BF output", async ({
  page,
}) => {
  await ready(page);
  await page.click("#terminal-start");
  await answer(page, "Salut, ");
  await expect(page.locator("#terminal-output")).toContainText("Salut,");
  await expect(page.locator("#terminal-state")).toHaveText("Așteaptă input");
  await page.fill("#terminal-input", "🧠<img src=x onerror=alert(1)>");
  await page.locator("#terminal-input").press("Control+Enter");
  await expect(page.locator("#terminal-output")).toContainText(
    "🧠<img src=x onerror=alert(1)>",
  );
  expect(await page.locator("#terminal-output img").count()).toBe(0);
  await expect(page.locator("#terminal-state")).toHaveText("Așteaptă input");
  await page.click("#terminal-eof");
  await expect(page.locator("#terminal-state")).toHaveText("Încheiat");
  await expect(page.locator("#terminal-eof")).toBeDisabled();
  await page.selectOption("#terminal-view", "hex");
  await expect(page.locator("#terminal-output")).toContainText("f0 9f a7 a0");
  const downloading = page.waitForEvent("download");
  await page.click("#terminal-output-download");
  const file = await downloading;
  expect(file.suggestedFilename()).toBe("output.bin");
  expect((await readFile(await file.path())).toString("utf8")).toBe(
    "Ecou UTF-8. EOF pentru stop.\nSalut, 🧠<img src=x onerror=alert(1)>\nGata.\n",
  );
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.includes("terminal")),
    ),
  ).toEqual([]);
});

test("pause, resume, immediate stop and the step limit keep endless BF bounded", async ({
  page,
}) => {
  await ready(page);
  await page.fill("#terminal-code", "+[]");
  await page.click("#terminal-start");
  await page.click("#terminal-pause");
  await expect(page.locator("#terminal-state")).toHaveText("Pauză");
  const steps = await page.locator("#terminal-steps").textContent();
  await page.waitForTimeout(100);
  await expect(page.locator("#terminal-steps")).toHaveText(steps);
  await page.click("#terminal-resume");
  await page.click("#terminal-stop");
  await expect(page.locator("#terminal-state")).toHaveText("Oprit");
  await page.click("#terminal-start");
  await expect(page.locator("#terminal-status")).toContainText("2.000.000");
  await expect(page.locator("#terminal-state")).toHaveText("Oprit cu eroare");
  await expect(page.locator("#terminal-start")).toBeEnabled();
});

test("editing while a source request is delayed cancels it and keeps the custom code", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/programs/terminal-echo.bf", async (route) => {
    await gate;
    await route.continue();
  });
  const requested = page.waitForRequest("**/programs/terminal-echo.bf");
  await page.goto("/terminal");
  await requested;
  await expect(page.locator("#terminal-start")).toBeDisabled();
  const cancelled = page.waitForEvent("requestfailed", {
    predicate: (request) => request.url().endsWith("terminal-echo.bf"),
  });
  await page.fill("#terminal-code", "+++++.");
  await cancelled;
  release();
  await page.click("#terminal-start");
  await expect(page.locator("#terminal-state")).toHaveText("Încheiat");
  await expect(page.locator("#terminal-code")).toHaveValue("+++++.");
  await expect(page.locator("#terminal-steps")).toHaveText("6");
});

test("a delayed file import blocks start and cannot overwrite subsequent code edits", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const read = File.prototype.text;
    File.prototype.text = function () {
      if (this.name !== "slow.bf") return read.call(this);
      return new Promise((resolve) => {
        window.finishBFImport = async () => resolve(await read.call(this));
      });
    };
  });
  await ready(page);
  await page.setInputFiles("#terminal-import", {
    name: "slow.bf",
    mimeType: "text/plain",
    buffer: Buffer.from("+++++."),
  });
  await expect(page.locator("#terminal-start")).toBeDisabled();
  await page.fill("#terminal-code", "+.");
  await expect(page.locator("#terminal-start")).toBeEnabled();
  await page.evaluate(() => window.finishBFImport());
  await page.click("#terminal-start");
  await expect(page.locator("#terminal-state")).toHaveText("Încheiat");
  await expect(page.locator("#terminal-code")).toHaveValue("+.");
  await expect(page.locator("#terminal-steps")).toHaveText("2");
});

test("custom import and sharing stay inert and terminal controls fit mobile screens", async ({
  page,
}) => {
  await ready(page);
  await page.setInputFiles("#terminal-import", {
    name: "hello.bf",
    mimeType: "text/plain",
    buffer: Buffer.from(",."),
  });
  await expect(page.locator("#terminal-code")).toHaveValue(",.");
  await page.click("#terminal-share");
  const url = await page.inputValue("#terminal-share-url");
  expect(url).toContain("#code=");
  await page.goto(url);
  await expect(page.locator("#terminal-code")).toHaveValue(",.");
  await expect(page.locator("#terminal-steps")).toHaveText("0");
  const payload = '</textarea><img src=x onerror="window.injected=true">';
  const hash = Buffer.from(JSON.stringify({ v: 1, code: payload })).toString(
    "base64url",
  );
  await page.goto("/terminal#code=" + hash);
  await expect(page.locator("#terminal-code")).toHaveValue(payload);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    for (const selector of [
      "#terminal-start",
      "#terminal-eof",
      "#terminal-send",
      "#terminal-code",
      "#terminal-output",
    ]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
  }
  await page.goto("/library?program=terminal-calculator");
  await expect(page.locator("#library-input")).toHaveValue("255\n+\n1\n");
  await page.click("#library-terminal");
  await expect(page).toHaveURL(/\/terminal\?program=terminal-calculator$/);
  await expect(page.locator("#terminal-steps")).toHaveText("0");
});
