const fs = require("fs");
const path = require("path");
const { test, expect, chromium } = require("playwright/test");

const url = process.env.OURBOX_CHAT_UI_URL;
const artifactsDir = process.env.OURBOX_CHAT_UI_ARTIFACTS_DIR || "dist";
const commonChromiumPaths = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/opt/homebrew/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/snap/bin/chromium",
];

function chromiumLaunchOptions() {
  const executablePath =
    process.env.CHROMIUM_BIN ||
    commonChromiumPaths.find(function (candidate) {
      return fs.existsSync(candidate);
    });

  return executablePath
    ? {
        headless: true,
        executablePath: executablePath,
      }
    : {
        headless: true,
      };
}

const viewports = [
  { name: "phone-390x844", width: 390, height: 844 },
  { name: "phone-428x926", width: 428, height: 926 },
];

for (const viewport of viewports) {
  test("mobile UI smoke: " + viewport.name, async () => {
    test.skip(!url, "OURBOX_CHAT_UI_URL is required");

    fs.mkdirSync(artifactsDir, { recursive: true });

    const browser = await chromium.launch(chromiumLaunchOptions());

    try {
      const context = await browser.newContext({
        viewport: {
          width: viewport.width,
          height: viewport.height,
        },
      });
      const page = await context.newPage();

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 120000,
      });
      await page.evaluate(() => localStorage.clear());
      await page.reload({
        waitUntil: "networkidle",
        timeout: 120000,
      });

      await expect(page.locator("h1")).toHaveText("OurBox Chat");
      await expect(page.locator("#open-drawer-button")).toBeVisible();
      await expect(page.locator("#thread-title")).toContainText("Chat");
      await page.waitForFunction(
        () => document.querySelector("#runtime-status")?.textContent.trim() === "Ready",
        null,
        { timeout: 120000 }
      );

      const systemPanelOpen = await page.locator("#system-panel").evaluate((node) => node.open);
      expect(systemPanelOpen).toBe(false);

      const transcriptBox = await page.locator("#transcript").boundingBox();
      expect(transcriptBox).not.toBeNull();
      expect(transcriptBox.height).toBeGreaterThanOrEqual(170);

      await page.locator("#open-drawer-button").click();
      await page.waitForFunction(() => document.body.classList.contains("drawer-open"));

      const beforeNew = Number(await page.locator("#thread-count").textContent());
      await page.locator("#new-thread-button").click();
      await page.waitForFunction(
        (expected) => Number(document.querySelector("#thread-count")?.textContent) === expected,
        beforeNew + 1,
        { timeout: 10000 }
      );
      await page.waitForFunction(() => !document.body.classList.contains("drawer-open"));

      await page.locator("#rename-thread-button").click();
      await page.locator("#rename-input").fill("Groceries");
      await page.locator('#rename-form button[type="submit"]').click();
      await expect(page.locator("#thread-title")).toHaveText("Groceries");

      await page.locator("#system-panel summary").click();
      await page.waitForFunction(() => document.querySelector("#system-panel").open);
      await page
        .locator("#system-prompt-input")
        .fill("Reply with exactly READY and nothing else.");

      await page.locator("#composer-input").fill("Reply with exactly READY.");
      await page.locator("#send-button").click();

      await page.waitForFunction(
        () => !document.querySelector(".message-card.role-pending"),
        null,
        { timeout: 120000 }
      );
      await expect(page.locator(".message-card.role-assistant .message-body").last()).toHaveText(
        /ready/i,
        { timeout: 120000 }
      );

      const beforeFork = Number(await page.locator("#thread-count").textContent());
      await page.locator("#fork-thread-button").click();
      await page.waitForFunction(
        (expected) => Number(document.querySelector("#thread-count")?.textContent) === expected,
        beforeFork + 1,
        { timeout: 10000 }
      );
      await expect(page.locator("#thread-title")).toContainText("Fork");

      await page.screenshot({
        path: path.join(artifactsDir, "ourbox-chat-mobile-" + viewport.name + ".png"),
        fullPage: true,
      });

      await context.close();
    } finally {
      await browser.close();
    }
  });
}

test("desktop short viewport scrolls the workspace outside the transcript", async () => {
  test.skip(!url, "OURBOX_CHAT_UI_URL is required");

  fs.mkdirSync(artifactsDir, { recursive: true });

  const browser = await chromium.launch(chromiumLaunchOptions());

  try {
    const context = await browser.newContext({
      viewport: {
        width: 1280,
        height: 520,
      },
    });
    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.evaluate(() => localStorage.clear());
    await page.reload({
      waitUntil: "networkidle",
      timeout: 120000,
    });

    await page.waitForFunction(
      () => document.querySelector("#runtime-status")?.textContent.trim() === "Ready",
      null,
      { timeout: 120000 }
    );

    const before = await page.locator(".workspace").evaluate((node) => ({
      top: node.scrollTop,
      height: node.scrollHeight,
      client: node.clientHeight,
    }));
    const transcriptBefore = await page.locator("#transcript").evaluate((node) => ({
      client: node.clientHeight,
      height: node.scrollHeight,
    }));

    await page.locator(".workspace-topbar").hover();
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(300);

    const after = await page.locator(".workspace").evaluate((node) => ({
      top: node.scrollTop,
      height: node.scrollHeight,
      client: node.clientHeight,
    }));

    expect(before.height).toBeGreaterThan(before.client);
    expect(transcriptBefore.client).toBeGreaterThanOrEqual(210);
    expect(after.top).toBeGreaterThan(before.top);

    await context.close();
  } finally {
    await browser.close();
  }
});
