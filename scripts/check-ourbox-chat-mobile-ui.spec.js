const fs = require("fs");
const path = require("path");
const { test, expect, chromium } = require("playwright/test");

const url = process.env.OURBOX_CHAT_UI_URL;
const artifactsDir = process.env.OURBOX_CHAT_UI_ARTIFACTS_DIR || "dist";
const LONG_TIMEOUT = 240000;
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
      timeout: LONG_TIMEOUT,
    });
    await page.evaluate(() => localStorage.clear());
    await page.reload({
      waitUntil: "networkidle",
      timeout: LONG_TIMEOUT,
    });

    await page.waitForFunction(
      () =>
        !!window.OurBoxChat &&
        !!window.OurBoxChatContract &&
        !!window.OurBoxChatView &&
        window.OurBoxChatContract.id === "ourbox-chat.view-layer",
      null,
      { timeout: LONG_TIMEOUT }
    );
    await page.waitForFunction(
      () => window.OurBoxChat.getState().runtime.status === "ready",
      null,
      { timeout: LONG_TIMEOUT }
    );

    const surface = await page.evaluate(async () => {
      const contract = window.OurBoxChatContract;
      const app = window.OurBoxChat;
      const before = app.getState();
      const createResult = await app.dispatch({
        type: contract.commands.THREAD_CREATE,
      });
      const created = app.getState();
      const generationResult = await app.dispatch({
        type: contract.commands.THREAD_GENERATION_SETTINGS_SET,
        threadId: created.activeThreadId,
        settings: {
          maxTokens: 64,
          temperature: 0.5,
          topP: 0.6,
          topK: 12,
          presencePenalty: 1.2,
        },
      });
      const afterGenerationSettings = app.getState();
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
        generationOk: generationResult.ok,
        threadCountBefore: before.threads.length,
        threadCountAfter: created.threads.length,
        sendOk: sendResult.ok,
        elapsedMs: Date.now() - dispatchStartedAt,
        inFlightAfterSend: afterSend.request.inFlight,
        requestThreadId: afterSend.request.threadId,
        activeThreadId: created.activeThreadId,
        maxTokens: afterGenerationSettings.activeThread.generationSettings.maxTokens,
        temperature: afterGenerationSettings.activeThread.generationSettings.temperature,
        topP: afterGenerationSettings.activeThread.generationSettings.topP,
        topK: afterGenerationSettings.activeThread.generationSettings.topK,
        presencePenalty: afterGenerationSettings.activeThread.generationSettings.presencePenalty,
        contextWindow: afterGenerationSettings.runtime.contextWindow,
      };
    });

    expect(surface.contractId).toBe("ourbox-chat.view-layer");
    expect(surface.contractVersion).toBe("1.2.0");
    expect(surface.viewId).toBe("mobile-native");
    expect(surface.createOk).toBe(true);
    expect(surface.generationOk).toBe(true);
    expect(surface.threadCountAfter).toBe(surface.threadCountBefore + 1);
    expect(surface.sendOk).toBe(true);
    expect(surface.elapsedMs).toBeLessThan(2000);
    expect(surface.inFlightAfterSend).toBe(true);
    expect(surface.requestThreadId).toBe(surface.activeThreadId);
    expect(surface.maxTokens).toBe(64);
    expect(surface.temperature).toBe(0.5);
    expect(surface.topP).toBe(0.6);
    expect(surface.topK).toBe(12);
    expect(surface.presencePenalty).toBe(1.2);
    expect(surface.contextWindow).toBeGreaterThan(0);

    await page.waitForFunction(
      () => !window.OurBoxChat.getState().request.inFlight,
      null,
      { timeout: LONG_TIMEOUT }
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
    expect(completion.lastContent).not.toMatch(/<think>|<\/think>/i);

    const regenerate = await page.evaluate(async () => {
      const contract = window.OurBoxChatContract;
      const app = window.OurBoxChat;
      const startedAt = Date.now();
      const result = await app.dispatch({
        type: contract.commands.THREAD_LATEST_ASSISTANT_MESSAGE_REGENERATE,
        threadId: app.getState().activeThreadId,
      });
      const afterDispatch = app.getState();

      return {
        ok: result.ok,
        elapsedMs: Date.now() - startedAt,
        inFlight: afterDispatch.request.inFlight,
        threadId: afterDispatch.request.threadId,
        activeThreadId: afterDispatch.activeThreadId,
      };
    });

    expect(regenerate.ok).toBe(true);
    expect(regenerate.elapsedMs).toBeLessThan(2000);
    expect(regenerate.inFlight).toBe(true);
    expect(regenerate.threadId).toBe(regenerate.activeThreadId);

    await page.waitForFunction(
      () => !window.OurBoxChat.getState().request.inFlight,
      null,
      { timeout: LONG_TIMEOUT }
    );

    const afterRegenerate = await page.evaluate(() => {
      const thread = window.OurBoxChat.getState().activeThread;
      return {
        messageCount: thread.messages.length,
        lastRole: thread.messages[thread.messages.length - 1].role,
        lastContent: thread.messages[thread.messages.length - 1].content,
      };
    });

    expect(afterRegenerate.messageCount).toBe(2);
    expect(afterRegenerate.lastRole).toBe("assistant");
    expect(afterRegenerate.lastContent).toMatch(/ready/i);

    const edit = await page.evaluate(async () => {
      const contract = window.OurBoxChatContract;
      const app = window.OurBoxChat;
      const startedAt = Date.now();
      const result = await app.dispatch({
        type: contract.commands.THREAD_LATEST_USER_MESSAGE_EDIT,
        threadId: app.getState().activeThreadId,
        content: "Reply with exactly CHANGED.",
      });
      const afterDispatch = app.getState();

      return {
        ok: result.ok,
        elapsedMs: Date.now() - startedAt,
        inFlight: afterDispatch.request.inFlight,
        threadId: afterDispatch.request.threadId,
        activeThreadId: afterDispatch.activeThreadId,
      };
    });

    expect(edit.ok).toBe(true);
    expect(edit.elapsedMs).toBeLessThan(2000);
    expect(edit.inFlight).toBe(true);
    expect(edit.threadId).toBe(edit.activeThreadId);

    await page.waitForFunction(
      () => !window.OurBoxChat.getState().request.inFlight,
      null,
      { timeout: LONG_TIMEOUT }
    );

    const afterEdit = await page.evaluate(() => {
      const thread = window.OurBoxChat.getState().activeThread;
      return {
        messageCount: thread.messages.length,
        userContent: thread.messages[thread.messages.length - 2].content,
        assistantRole: thread.messages[thread.messages.length - 1].role,
        assistantContent: thread.messages[thread.messages.length - 1].content,
      };
    });

    expect(afterEdit.messageCount).toBe(2);
    expect(afterEdit.userContent).toBe("Reply with exactly CHANGED.");
    expect(afterEdit.assistantRole).toBe("assistant");
    expect(afterEdit.assistantContent).toMatch(/changed/i);

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
        timeout: LONG_TIMEOUT,
      });
      await page.evaluate(() => localStorage.clear());
      await page.reload({
        waitUntil: "networkidle",
        timeout: LONG_TIMEOUT,
      });

      await page.waitForFunction(
        () => !!window.OurBoxChat && !!window.OurBoxChatContract && !!window.OurBoxChatView,
        null,
        { timeout: LONG_TIMEOUT }
      );
      await page.waitForFunction(
        () => window.OurBoxChat.getState().runtime.status === "ready",
        null,
        { timeout: LONG_TIMEOUT }
      );

      await expect(page.locator("h1")).toHaveText("OurBox Chat");
      await expect(page.locator("#open-drawer-button")).toBeVisible();
      await expect(page.locator("#thread-title")).toContainText("Chat");
      await expect(page.locator(".hero-card")).toHaveCount(0);
      await expect(page.locator(".composer-utility-row")).toHaveCount(0);

      const transcriptBox = await page.locator("#transcript").boundingBox();
      expect(transcriptBox).not.toBeNull();
      expect(transcriptBox.height).toBeGreaterThan(viewport.height * 0.5);

      await page.locator("#open-drawer-button").click();
      await page.waitForFunction(() =>
        document.querySelector("#ourbox-chat-root")?.classList.contains("drawer-open")
      );
      await expect(page.locator("#sheet-runtime-status")).toHaveText("Ready");
      await expect(page.locator("#sheet-model-name")).not.toHaveText(/^\s*$/);

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

      await page.locator("#open-thread-menu-button").click();
      await page.waitForFunction(() =>
        document.querySelector("#ourbox-chat-root")?.classList.contains("menu-open")
      );
      await page.locator("#rename-thread-button").click();
      await page.locator("#rename-input").fill("Groceries");
      await page.locator('#rename-form button[type="submit"]').click();
      await expect(page.locator("#thread-title")).toHaveText("Groceries");

      await page.locator("#open-thread-menu-button").click();
      await page.waitForFunction(() =>
        document.querySelector("#ourbox-chat-root")?.classList.contains("menu-open")
      );
      await page.locator("#system-prompt-button").click();
      await page.waitForFunction(() =>
        document.querySelector("#ourbox-chat-root")?.classList.contains("system-open")
      );
      await page
        .locator("#system-prompt-input")
        .fill("Reply with exactly READY and nothing else.");
      await page.locator("#close-system-sheet-button").click();
      await page.waitForFunction(
        () => !document.querySelector("#ourbox-chat-root")?.classList.contains("system-open")
      );

      await page.locator("#open-thread-menu-button").click();
      await page.waitForFunction(() =>
        document.querySelector("#ourbox-chat-root")?.classList.contains("menu-open")
      );
      await page.locator("#advanced-settings-button").click();
      await page.waitForFunction(() =>
        document.querySelector("#ourbox-chat-root")?.classList.contains("advanced-open")
      );
      await expect(page.locator("#advanced-context-window-value")).not.toHaveText("Unavailable");
      await page.locator("#advanced-max-tokens-input").fill("64");
      await page.locator("#advanced-max-tokens-input").dispatchEvent("change");
      await page.locator("#advanced-temperature-input").fill("0.5");
      await page.locator("#advanced-temperature-input").dispatchEvent("change");
      await page.locator("#advanced-top-p-input").fill("0.6");
      await page.locator("#advanced-top-p-input").dispatchEvent("change");
      await page.locator("#advanced-top-k-input").fill("12");
      await page.locator("#advanced-top-k-input").dispatchEvent("change");
      await page.locator("#advanced-presence-penalty-input").fill("1.2");
      await page.locator("#advanced-presence-penalty-input").dispatchEvent("change");

      await page.waitForFunction(() => {
        const state = window.OurBoxChat.getState();
        return (
          state.activeThread.generationSettings.maxTokens === 64 &&
          state.activeThread.generationSettings.temperature === 0.5 &&
          state.activeThread.generationSettings.topP === 0.6 &&
          state.activeThread.generationSettings.topK === 12 &&
          state.activeThread.generationSettings.presencePenalty === 1.2 &&
          typeof state.runtime.contextWindow === "number" &&
          state.runtime.contextWindow > 0
        );
      });

      await page.locator("#close-advanced-sheet-button").click();
      await page.waitForFunction(
        () => !document.querySelector("#ourbox-chat-root")?.classList.contains("advanced-open")
      );

      await page.locator("#composer-input").fill("Reply with exactly READY.");
      await page.locator("#send-button").click();

      await page.waitForFunction(
        () => !document.querySelector(".message-card.role-pending"),
        null,
        { timeout: LONG_TIMEOUT }
      );
      await expect(page.locator(".message-card.role-assistant .message-body").last()).toHaveText(
        /ready/i,
        { timeout: LONG_TIMEOUT }
      );
      await expect(
        page.locator(".message-card.role-assistant .message-body").last()
      ).not.toContainText("<think>");

      await page.evaluate(() => {
        window.__copiedText = null;
        if (!navigator.clipboard) {
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {},
          });
        }
        navigator.clipboard.writeText = async function (value) {
          window.__copiedText = value;
        };
      });

      await page.locator(".message-row.role-user").last().dispatchEvent("contextmenu");
      await page.waitForFunction(() => document.querySelector("#message-action-dialog")?.open);
      await expect(page.locator("#message-action-title")).toHaveText("Edit Latest Prompt");
      await expect(page.locator("#message-action-button")).toHaveText("Edit Message");
      await expect(page.locator("#message-copy-button")).toHaveText("Copy");
      await page.locator("#message-copy-button").click();
      await page.waitForFunction(
        () => window.__copiedText === "Reply with exactly READY."
      );
      await page.waitForFunction(() => !document.querySelector("#message-action-dialog")?.open);

      await page.locator(".message-row.role-user").last().dispatchEvent("contextmenu");
      await page.waitForFunction(() => document.querySelector("#message-action-dialog")?.open);
      await page.locator("#message-action-button").click();
      await page.waitForFunction(() => document.querySelector("#edit-message-dialog")?.open);
      await page.locator("#edit-message-input").fill("Reply with exactly CHANGED.");
      await page.locator('#edit-message-form button[type="submit"]').click();

      await page.waitForFunction(
        () => !document.querySelector(".message-card.role-pending"),
        null,
        { timeout: LONG_TIMEOUT }
      );
      await expect(page.locator(".message-card.role-user .message-body").last()).toHaveText(
        "Reply with exactly CHANGED."
      );
      await expect(page.locator(".message-card.role-assistant .message-body").last()).toHaveText(
        /changed/i,
        { timeout: LONG_TIMEOUT }
      );

      await page.locator(".message-row.role-assistant").last().dispatchEvent("contextmenu");
      await page.waitForFunction(() => document.querySelector("#message-action-dialog")?.open);
      await expect(page.locator("#message-action-title")).toHaveText("Regenerate Response");
      await expect(page.locator("#message-action-button")).toHaveText("Regenerate");
      await expect(page.locator("#message-copy-button")).toHaveText("Copy");
      await page.locator("#message-action-button").click();

      await page.waitForFunction(
        () => !document.querySelector(".message-card.role-pending"),
        null,
        { timeout: LONG_TIMEOUT }
      );
      await expect(page.locator(".message-card.role-assistant .message-body").last()).toHaveText(
        /changed/i,
        { timeout: LONG_TIMEOUT }
      );

      const beforeFork = Number(await page.locator("#thread-count").textContent());
      await page.locator("#open-thread-menu-button").click();
      await page.waitForFunction(() =>
        document.querySelector("#ourbox-chat-root")?.classList.contains("menu-open")
      );
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
      timeout: LONG_TIMEOUT,
    });
    await page.evaluate(() => localStorage.clear());
    await page.reload({
      waitUntil: "networkidle",
      timeout: LONG_TIMEOUT,
    });

    await page.waitForFunction(
      () => window.OurBoxChat.getState().runtime.status === "ready",
      null,
      { timeout: LONG_TIMEOUT }
    );

    const shellBox = await page.locator(".phone-shell").boundingBox();
    expect(shellBox).not.toBeNull();
    expect(shellBox.width).toBeLessThanOrEqual(480);

    await expect(page.locator(".hero-card")).toHaveCount(0);

    const transcriptBefore = await page.locator("#transcript").boundingBox();
    expect(transcriptBefore).not.toBeNull();
    expect(transcriptBefore.height).toBeGreaterThanOrEqual(280);

    await page.locator("#open-thread-menu-button").click();
    await page.waitForFunction(() =>
      document.querySelector("#ourbox-chat-root")?.classList.contains("menu-open")
    );
    await expect(page.locator("#thread-menu-sheet")).toBeVisible();
    await page.locator("#close-thread-menu-button").click();
    await page.waitForFunction(
      () => !document.querySelector("#ourbox-chat-root")?.classList.contains("menu-open")
    );

    await context.close();
  } finally {
    await browser.close();
  }
});
