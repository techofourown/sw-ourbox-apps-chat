(function () {
  const STORAGE_KEY = "woodbox-chat-state-v1";
  const DEFAULT_SYSTEM_PROMPT =
    "You are Woodbox Chat, a local assistant running fully on this device. " +
    "Be direct, practical, and concise. Admit uncertainty when needed.";
  const PENDING_MESSAGE_ID = "pending-assistant-message";

  const elements = {
    threadList: document.getElementById("thread-list"),
    threadCount: document.getElementById("thread-count"),
    threadTitle: document.getElementById("thread-title"),
    threadMeta: document.getElementById("thread-meta"),
    transcript: document.getElementById("transcript"),
    composerForm: document.getElementById("composer-form"),
    composerInput: document.getElementById("composer-input"),
    systemPromptInput: document.getElementById("system-prompt-input"),
    newThreadButton: document.getElementById("new-thread-button"),
    renameThreadButton: document.getElementById("rename-thread-button"),
    forkThreadButton: document.getElementById("fork-thread-button"),
    deleteThreadButton: document.getElementById("delete-thread-button"),
    clearComposerButton: document.getElementById("clear-composer-button"),
    cancelRequestButton: document.getElementById("cancel-request-button"),
    sendButton: document.getElementById("send-button"),
    runtimeStatus: document.getElementById("runtime-status"),
    modelName: document.getElementById("model-name"),
    statusCopy: document.getElementById("status-copy"),
    renameDialog: document.getElementById("rename-dialog"),
    renameForm: document.getElementById("rename-form"),
    renameInput: document.getElementById("rename-input"),
    renameCancelButton: document.getElementById("rename-cancel-button"),
    threadItemTemplate: document.getElementById("thread-item-template"),
    messageTemplate: document.getElementById("message-template"),
  };

  const state = {
    threads: [],
    activeThreadId: null,
    requestController: null,
    requestThreadId: null,
    modelName: "Loading",
    runtimeReady: false,
    runtimeMessage: "Connecting to the bundled local model server.",
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createThread(seed) {
    const createdAt = nowIso();
    const title =
      seed && seed.title
        ? seed.title
        : `Thread ${new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date())}`;

    return {
      id: makeId("thread"),
      title,
      createdAt,
      updatedAt: createdAt,
      systemPrompt:
        seed && typeof seed.systemPrompt === "string"
          ? seed.systemPrompt
          : DEFAULT_SYSTEM_PROMPT,
      draft: seed && typeof seed.draft === "string" ? seed.draft : "",
      messages:
        seed && Array.isArray(seed.messages)
          ? seed.messages.map(function (message) {
              return {
                id: makeId("message"),
                role: message.role,
                content: message.content,
                createdAt: message.createdAt || createdAt,
              };
            })
          : [],
    };
  }

  function defaultState() {
    const thread = createThread();
    return {
      threads: [thread],
      activeThreadId: thread.id,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultState();
      }

      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.threads) || !parsed.threads.length) {
        return defaultState();
      }

      return {
        threads: parsed.threads
          .filter(function (thread) {
            return thread && Array.isArray(thread.messages);
          })
          .map(function (thread) {
            return {
              id: thread.id || makeId("thread"),
              title: thread.title || "Untitled Thread",
              createdAt: thread.createdAt || nowIso(),
              updatedAt: thread.updatedAt || nowIso(),
              systemPrompt:
                typeof thread.systemPrompt === "string" && thread.systemPrompt.trim()
                  ? thread.systemPrompt
                  : DEFAULT_SYSTEM_PROMPT,
              draft: typeof thread.draft === "string" ? thread.draft : "",
              messages: thread.messages.map(function (message) {
                return {
                  id: message.id || makeId("message"),
                  role: message.role === "assistant" ? "assistant" : "user",
                  content: typeof message.content === "string" ? message.content : "",
                  createdAt: message.createdAt || nowIso(),
                };
              }),
            };
          }),
        activeThreadId: parsed.activeThreadId || parsed.threads[0].id,
      };
    } catch (error) {
      console.error("failed to load saved Woodbox Chat state", error);
      return defaultState();
    }
  }

  function persistState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        threads: state.threads,
        activeThreadId: state.activeThreadId,
      })
    );
  }

  function getActiveThread() {
    const thread = state.threads.find(function (candidate) {
      return candidate.id === state.activeThreadId;
    });
    return thread || state.threads[0];
  }

  function sortThreads() {
    state.threads.sort(function (left, right) {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }

  function touchThread(thread) {
    thread.updatedAt = nowIso();
  }

  function setComposerBusy(isBusy) {
    elements.sendButton.disabled = isBusy;
    elements.cancelRequestButton.disabled = !isBusy;
    elements.composerInput.disabled = isBusy;
    elements.newThreadButton.disabled = isBusy;
    elements.renameThreadButton.disabled = isBusy;
    elements.forkThreadButton.disabled = isBusy;
    elements.deleteThreadButton.disabled = isBusy;
    elements.clearComposerButton.disabled = isBusy;
  }

  function updateRuntimeStatus(kind, message) {
    state.runtimeReady = kind === "ready";
    state.runtimeMessage = message;
    elements.runtimeStatus.textContent =
      kind === "ready" ? "Ready" : kind === "error" ? "Offline" : "Checking";
    elements.runtimeStatus.className =
      "status-pill " +
      (kind === "ready" ? "status-ready" : kind === "error" ? "status-error" : "");
    elements.statusCopy.textContent = message;
  }

  function describeThread(thread) {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const last = thread.messages[thread.messages.length - 1];
    const summary = last ? last.content : "No messages yet";
    return {
      meta:
        thread.messages.length +
        " msg" +
        (thread.messages.length === 1 ? "" : "s") +
        " • updated " +
        formatter.format(new Date(thread.updatedAt)),
      snippet: summary.length > 82 ? summary.slice(0, 79) + "..." : summary,
    };
  }

  function renderThreads() {
    sortThreads();
    const activeThread = getActiveThread();

    elements.threadCount.textContent = String(state.threads.length);
    elements.threadList.replaceChildren();

    state.threads.forEach(function (thread) {
      const fragment = elements.threadItemTemplate.content.cloneNode(true);
      const button = fragment.querySelector(".thread-item");
      const title = fragment.querySelector(".thread-item-title");
      const meta = fragment.querySelector(".thread-item-meta");
      const snippet = fragment.querySelector(".thread-item-snippet");
      const description = describeThread(thread);

      title.textContent = thread.title;
      meta.textContent = description.meta;
      snippet.textContent = description.snippet;

      if (thread.id === activeThread.id) {
        button.classList.add("is-active");
      }

      button.disabled = state.requestController !== null;

      button.addEventListener("click", function () {
        state.activeThreadId = thread.id;
        render();
      });

      elements.threadList.appendChild(fragment);
    });
  }

  function renderMessages(thread) {
    elements.transcript.replaceChildren();

    const pending = state.requestController !== null;
    const messages = thread.messages.slice();
    if (pending && state.requestThreadId === thread.id) {
      messages.push({
        id: PENDING_MESSAGE_ID,
        role: "assistant",
        content: "Generating a local reply...",
        createdAt: nowIso(),
        pending: true,
      });
    }

    if (!messages.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.innerHTML =
        "<div><strong>This thread is empty.</strong><br>Ask a question to begin a local conversation.</div>";
      elements.transcript.appendChild(emptyState);
      return;
    }

    messages.forEach(function (message) {
      const fragment = elements.messageTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".message-card");
      const role = fragment.querySelector(".message-role");
      const time = fragment.querySelector(".message-time");
      const body = fragment.querySelector(".message-body");

      card.classList.add("role-" + (message.pending ? "pending" : message.role));
      role.textContent = message.role === "assistant" ? "Assistant" : "You";
      time.textContent = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(message.createdAt));
      body.textContent = message.content;

      elements.transcript.appendChild(fragment);
    });

    elements.transcript.scrollTop = elements.transcript.scrollHeight;
  }

  function renderWorkspace() {
    const thread = getActiveThread();
    const threadInfo = describeThread(thread);

    elements.threadTitle.textContent = thread.title;
    elements.threadMeta.textContent = threadInfo.meta;
    elements.systemPromptInput.value = thread.systemPrompt;
    elements.composerInput.value = thread.draft;
    elements.modelName.textContent = state.modelName;

    renderMessages(thread);
  }

  function render() {
    renderThreads();
    renderWorkspace();
    setComposerBusy(state.requestController !== null);
  }

  function renameActiveThread(nextTitle) {
    const thread = getActiveThread();
    const cleaned = nextTitle.trim();
    thread.title = cleaned || "Untitled Thread";
    touchThread(thread);
    persistState();
    render();
  }

  function forkActiveThread() {
    const thread = getActiveThread();
    const forked = createThread({
      title: thread.title + " Fork",
      systemPrompt: thread.systemPrompt,
      draft: thread.draft,
      messages: thread.messages,
    });
    state.threads.unshift(forked);
    state.activeThreadId = forked.id;
    persistState();
    render();
  }

  function deleteActiveThread() {
    if (state.threads.length === 1) {
      state.threads = [createThread()];
      state.activeThreadId = state.threads[0].id;
      persistState();
      render();
      return;
    }

    state.threads = state.threads.filter(function (thread) {
      return thread.id !== state.activeThreadId;
    });
    state.activeThreadId = state.threads[0].id;
    persistState();
    render();
  }

  function updateThreadDraft(value) {
    const thread = getActiveThread();
    thread.draft = value;
    persistState();
  }

  function updateSystemPrompt(value) {
    const thread = getActiveThread();
    thread.systemPrompt = value.trim() ? value : DEFAULT_SYSTEM_PROMPT;
    touchThread(thread);
    persistState();
    renderThreads();
  }

  function maybeRetitleThread(thread, messageContent) {
    if (thread.messages.length > 1) {
      return;
    }

    if (!thread.title.startsWith("Thread ")) {
      return;
    }

    const compact = messageContent.replace(/\s+/g, " ").trim();
    thread.title = compact.length > 40 ? compact.slice(0, 37) + "..." : compact;
  }

  async function probeRuntime() {
    try {
      const healthResponse = await fetch("/health", { cache: "no-store" });
      if (!healthResponse.ok) {
        throw new Error("health endpoint returned " + healthResponse.status);
      }

      const modelsResponse = await fetch("/v1/models", { cache: "no-store" });
      if (!modelsResponse.ok) {
        throw new Error("model listing returned " + modelsResponse.status);
      }

      const models = await modelsResponse.json();
      const model =
        models &&
        Array.isArray(models.data) &&
        models.data.length &&
        models.data[0] &&
        models.data[0].id;

      state.modelName = model || "Bundled local model";
      updateRuntimeStatus("ready", "Bundled model server is online and ready.");
      renderWorkspace();
    } catch (error) {
      console.error("runtime probe failed", error);
      state.modelName = "Unavailable";
      updateRuntimeStatus(
        "error",
        "The local model server is not responding yet. Refresh after the model finishes loading."
      );
      renderWorkspace();
    }
  }

  async function sendMessage() {
    const thread = getActiveThread();
    const userText = thread.draft.trim();
    if (!userText || state.requestController) {
      return;
    }

    const userMessage = {
      id: makeId("message"),
      role: "user",
      content: userText,
      createdAt: nowIso(),
    };

    thread.messages.push(userMessage);
    thread.draft = "";
    maybeRetitleThread(thread, userText);
    touchThread(thread);
    persistState();
    render();

    const controller = new AbortController();
    state.requestController = controller;
    state.requestThreadId = thread.id;
    render();

    try {
      const payload = {
        messages: [
          {
            role: "system",
            content: thread.systemPrompt || DEFAULT_SYSTEM_PROMPT,
          },
        ].concat(
          thread.messages.map(function (message) {
            return {
              role: message.role,
              content: message.content,
            };
          })
        ),
        max_tokens: 256,
        temperature: 0.7,
      };

      const response = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("generation failed with status " + response.status);
      }

      const data = await response.json();
      const choice = data && data.choices && data.choices[0];
      const content =
        choice &&
        choice.message &&
        typeof choice.message.content === "string" &&
        choice.message.content.trim();

      if (!content) {
        throw new Error("generation returned an empty reply");
      }

      thread.messages.push({
        id: makeId("message"),
        role: "assistant",
        content: content,
        createdAt: nowIso(),
      });
      touchThread(thread);
      persistState();
    } catch (error) {
      if (error.name !== "AbortError") {
        thread.messages.push({
          id: makeId("message"),
          role: "assistant",
          content:
            "The local model could not complete this request. " +
            "Check that the model is ready and try again.\n\n" +
            "Details: " +
            error.message,
          createdAt: nowIso(),
        });
        touchThread(thread);
        persistState();
      }
    } finally {
      state.requestController = null;
      state.requestThreadId = null;
      render();
    }
  }

  function attachEvents() {
    elements.newThreadButton.addEventListener("click", function () {
      const thread = createThread();
      state.threads.unshift(thread);
      state.activeThreadId = thread.id;
      persistState();
      render();
      elements.composerInput.focus();
    });

    elements.renameThreadButton.addEventListener("click", function () {
      const thread = getActiveThread();
      elements.renameInput.value = thread.title;
      if (typeof elements.renameDialog.showModal === "function") {
        elements.renameDialog.showModal();
        elements.renameInput.focus();
        elements.renameInput.select();
      } else {
        const nextTitle = window.prompt("Rename thread", thread.title);
        if (nextTitle !== null) {
          renameActiveThread(nextTitle);
        }
      }
    });

    elements.renameForm.addEventListener("submit", function (event) {
      event.preventDefault();
      renameActiveThread(elements.renameInput.value);
      elements.renameDialog.close();
    });

    elements.renameCancelButton.addEventListener("click", function () {
      elements.renameDialog.close();
    });

    elements.forkThreadButton.addEventListener("click", function () {
      forkActiveThread();
    });

    elements.deleteThreadButton.addEventListener("click", function () {
      const confirmed = window.confirm(
        "Delete this thread? The saved messages in this browser will be removed."
      );
      if (confirmed) {
        deleteActiveThread();
      }
    });

    elements.clearComposerButton.addEventListener("click", function () {
      elements.composerInput.value = "";
      updateThreadDraft("");
      elements.composerInput.focus();
    });

    elements.composerInput.addEventListener("input", function (event) {
      updateThreadDraft(event.target.value);
    });

    elements.composerInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    elements.systemPromptInput.addEventListener("input", function (event) {
      updateSystemPrompt(event.target.value);
    });

    elements.cancelRequestButton.addEventListener("click", function () {
      if (state.requestController) {
        state.requestController.abort();
      }
    });

    elements.composerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      sendMessage();
    });
  }

  function initialize() {
    const restored = loadState();
    state.threads = restored.threads;
    state.activeThreadId = restored.activeThreadId;
    if (!getActiveThread()) {
      state.threads = defaultState().threads;
      state.activeThreadId = state.threads[0].id;
    }

    attachEvents();
    render();
    probeRuntime();
  }

  initialize();
})();
