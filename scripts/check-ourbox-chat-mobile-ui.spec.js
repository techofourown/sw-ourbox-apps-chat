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

test("browser contract surface is mounted and request.send resolves after acceptance", async () => {
  test.skip(!url, "OURBOX_CHAT_UI_URL is required");

  fs.mkdirSync(artifactsDir, { recursive: true });

  const browser = await chromium.launch(chromiumLaunchOptions());

  try {
    const context = await browser.newContext({
      viewport: {
        width: 1280,
        height: 900,
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
      () =>
        !!window.OurBoxChat &&
        !!window.OurBoxChatContract &&
        !!window.OurBoxChatView &&
        window.OurBoxChatContract.id === "ourbox-chat.view-layer",
      null,
      { timeout: 120000 }
    );
    await page.waitForFunction(
      () => document.querySelector("#runtime-status")?.textContent.trim() === "Ready",
      null,
      { timeout: 120000 }
    );

    const surface = await page.evaluate(async () => {
      const contract = window.OurBoxChatContract;
      const app = window.OurBoxChat;
      const before = app.getState();
      const createResult = await app.dispatch({
        type: contract.commands.THREAD_CREATE,
      });
      const created = app.getState();
      const dispatchStartedAt = Date.now();
      const sendResult = await app.dispatch({
        type: contract.commands.REQUEST_SEND,
        threadId: created.activeThreadId,
        content: "Reply with exactly READY.",
      });
      const afterSend = app.getState();

      return {
        contractId: contract.id,
        contractVersion: contract.version,
        viewId: window.OurBoxChatView.id,
        createOk: createResult.ok,
        threadCountBefore: before.threads.length,
        threadCountAfter: created.threads.length,
        sendOk: sendResult.ok,
        elapsedMs: Date.now() - dispatchStartedAt,
        inFlightAfterSend: afterSend.request.inFlight,
        requestThreadId: afterSend.request.threadId,
        activeThreadId: created.activeThreadId,
      };
    });

    expect(surface.contractId).toBe("ourbox-chat.view-layer");
    expect(surface.contractVersion).toBe("1.0.0");
    expect(surface.viewId).toBe("default");
    expect(surface.createOk).toBe(true);
    expect(surface.threadCountAfter).toBe(surface.threadCountBefore + 1);
    expect(surface.sendOk).toBe(true);
    expect(surface.elapsedMs).toBeLessThan(2000);
    expect(surface.inFlightAfterSend).toBe(true);
    expect(surface.requestThreadId).toBe(surface.activeThreadId);

    await page.waitForFunction(
      () => !window.OurBoxChat.getState().request.inFlight,
      null,
      { timeout: 120000 }
    );

    const completion = await page.evaluate(() => {
      const state = window.OurBoxChat.getState();
      const thread = state.activeThread;
      const lastMessage = thread.messages[thread.messages.length - 1];

      return {
        runtimeStatus: state.runtime.status,
        lastRole: lastMessage.role,
        lastContent: lastMessage.content,
      };
    });

    expect(completion.runtimeStatus).toBe("ready");
    expect(completion.lastRole).toBe("assistant");
    expect(completion.lastContent).toMatch(/ready/i);

    await context.close();
  } finally {
    await browser.close();
  }
});

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

      await page.waitForFunction(
        () => !!window.OurBoxChat && !!window.OurBoxChatContract && !!window.OurBoxChatView,
        null,
        { timeout: 120000 }
      );

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
      await page.waitForFunction(() =>
        document.querySelector("#ourbox-chat-root")?.classList.contains("drawer-open")
      );

      const beforeNew = Number(await page.locator("#thread-count").textContent());
      await page.locator("#new-thread-button").click();
      await page.waitForFunction(
        (expected) => Number(document.querySelector("#thread-count")?.textContent) === expected,
        beforeNew + 1,
        { timeout: 10000 }
      );
      await page.waitForFunction(
        () => !document.querySelector("#ourbox-chat-root")?.classList.contains("drawer-open")
      );

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
