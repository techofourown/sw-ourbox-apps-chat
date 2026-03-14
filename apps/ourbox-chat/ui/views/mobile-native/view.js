(function () {
  const PENDING_MESSAGE_ID = "pending-assistant-message";
  const PANELS = Object.freeze({
    NONE: null,
    THREADS: "threads",
    MENU: "menu",
    SYSTEM: "system",
  });
  const QUICK_PROMPTS = Object.freeze([
    "Give me three practical things you can help with locally.",
    "Help me plan my day with a short checklist.",
    "Rewrite this into a clearer message.",
  ]);

  function renderTemplate(maxThreadTitleLength) {
    return (
      '<div class="phone-shell app-shell" data-view="mobile-native">' +
        '<div class="ambient ambient-one"></div>' +
        '<div class="ambient ambient-two"></div>' +
        '<header class="topbar workspace-topbar">' +
          '<button class="icon-button soft-button" id="open-drawer-button" type="button" aria-label="Open saved chats">' +
            '<span class="icon-stack"><span></span><span></span><span></span></span>' +
          '</button>' +
          '<div class="topbar-copy">' +
            '<p class="topbar-kicker">Private on-device AI</p>' +
            '<h1>OurBox Chat</h1>' +
            '<p class="topbar-title" id="thread-title">Chat</p>' +
          '</div>' +
          '<button class="icon-button soft-button" id="open-thread-menu-button" type="button" aria-label="Open conversation actions">' +
            '<span class="icon-dots"><span></span><span></span><span></span></span>' +
          '</button>' +
        '</header>' +

        '<section class="hero-card">' +
          '<div class="hero-main">' +
            '<div class="status-pill" id="runtime-status">Checking</div>' +
            '<p class="status-copy" id="status-copy">Connecting to the bundled local model server.</p>' +
          '</div>' +
          '<div class="hero-meta">' +
            '<div class="meta-block">' +
              '<span class="meta-label">Model</span>' +
              '<span class="meta-value" id="model-name">Loading</span>' +
            '</div>' +
            '<div class="meta-block">' +
              '<span class="meta-label">Storage</span>' +
              '<span class="meta-value">Only in this browser</span>' +
            '</div>' +
          '</div>' +
          '<p class="thread-meta" id="thread-meta">Saved locally in this browser.</p>' +
        '</section>' +

        '<main class="workspace conversation-stage">' +
          '<section class="transcript-shell transcript-panel">' +
            '<div class="transcript" id="transcript" aria-live="polite"></div>' +
          '</section>' +
        '</main>' +

        '<footer class="composer-dock">' +
          '<div class="composer-utility-row">' +
            '<button class="utility-chip" id="open-system-button" type="button">Behavior</button>' +
            '<button class="utility-chip" id="clear-composer-button" type="button">Clear Draft</button>' +
            '<span class="utility-status" id="runtime-summary">Checking local runtime</span>' +
          '</div>' +
          '<form class="composer" id="composer-form">' +
            '<label class="sr-only" for="composer-input">Message</label>' +
            '<textarea id="composer-input" class="composer-input" rows="1" placeholder="Message your local assistant"></textarea>' +
            '<div class="composer-actions">' +
              '<button class="ghost-button compact-button" id="cancel-request-button" type="button" disabled>Stop</button>' +
              '<button class="send-button" id="send-button" type="submit" aria-label="Send message">' +
                '<span class="send-arrow">&rarr;</span>' +
              '</button>' +
            '</div>' +
          '</form>' +
        '</footer>' +

        '<button class="sheet-backdrop hidden" id="sheet-backdrop" type="button" aria-label="Close overlay"></button>' +

        '<section class="sheet sheet-threads" id="thread-drawer" aria-label="Saved chats">' +
          '<div class="sheet-grabber"></div>' +
          '<div class="sheet-header">' +
            '<div>' +
              '<p class="sheet-kicker">Saved on this device</p>' +
              '<h2>Chats <span class="thread-count" id="thread-count">0</span></h2>' +
            '</div>' +
            '<button class="soft-button text-button" id="close-drawer-button" type="button">Done</button>' +
          '</div>' +
          '<section class="sheet-runtime-card">' +
            '<div>' +
              '<span class="meta-label">Runtime</span>' +
              '<div class="sheet-runtime-row"><span class="status-pill mini-pill" id="sheet-runtime-status">Checking</span></div>' +
            '</div>' +
            '<div>' +
              '<span class="meta-label">Model</span>' +
              '<p class="sheet-model-name" id="sheet-model-name">Loading</p>' +
            '</div>' +
          '</section>' +
          '<button class="primary-button block-button" id="new-thread-button" type="button">New Chat</button>' +
          '<div class="thread-list" id="thread-list"></div>' +
        '</section>' +

        '<section class="sheet sheet-menu" id="thread-menu-sheet" aria-label="Conversation actions">' +
          '<div class="sheet-grabber"></div>' +
          '<div class="sheet-header">' +
            '<div>' +
              '<p class="sheet-kicker">Conversation</p>' +
              '<h2>Actions</h2>' +
            '</div>' +
            '<button class="soft-button text-button" id="close-thread-menu-button" type="button">Done</button>' +
          '</div>' +
          '<div class="action-list">' +
            '<button class="action-row" id="rename-thread-button" type="button">' +
              '<span class="action-title">Rename</span>' +
              '<span class="action-copy">Give this chat a better title</span>' +
            '</button>' +
            '<button class="action-row" id="system-prompt-button" type="button">' +
              '<span class="action-title">Behavior</span>' +
              '<span class="action-copy">Tune the system prompt for this chat</span>' +
            '</button>' +
            '<button class="action-row" id="fork-thread-button" type="button">' +
              '<span class="action-title">Fork</span>' +
              '<span class="action-copy">Start a new branch from this conversation</span>' +
            '</button>' +
            '<button class="action-row danger-row" id="delete-thread-button" type="button">' +
              '<span class="action-title">Delete</span>' +
              '<span class="action-copy">Remove this conversation from the browser</span>' +
            '</button>' +
          '</div>' +
        '</section>' +

        '<section class="sheet sheet-system" id="system-sheet" aria-label="System prompt">' +
          '<div class="sheet-grabber"></div>' +
          '<div class="sheet-header">' +
            '<div>' +
              '<p class="sheet-kicker">Behavior</p>' +
              '<h2>System Prompt</h2>' +
            '</div>' +
            '<button class="soft-button text-button" id="close-system-sheet-button" type="button">Done</button>' +
          '</div>' +
          '<section class="system-panel" id="system-panel">' +
            '<p class="system-copy">This only affects the active chat. Leave it blank to restore the built-in default.</p>' +
            '<label class="field-label" for="system-prompt-input">System instructions</label>' +
            '<textarea id="system-prompt-input" class="system-input" rows="7" placeholder="Describe how this chat should behave."></textarea>' +
            '<div class="system-actions">' +
              '<button class="ghost-button compact-button" id="reset-system-prompt-button" type="button">Reset</button>' +
            '</div>' +
          '</section>' +
        '</section>' +
      '</div>' +

      '<dialog class="rename-dialog" id="rename-dialog">' +
        '<form class="rename-card" id="rename-form" method="dialog">' +
          '<p class="sheet-kicker">Conversation</p>' +
          '<h2>Rename Chat</h2>' +
          '<label class="field-label" for="rename-input">Chat name</label>' +
          '<input id="rename-input" class="rename-input" maxlength="' + maxThreadTitleLength + '" type="text">' +
          '<div class="rename-actions">' +
            '<button class="ghost-button compact-button" id="rename-cancel-button" type="button">Cancel</button>' +
            '<button class="primary-button compact-button" type="submit">Save</button>' +
          '</div>' +
        '</form>' +
      '</dialog>'
    );
  }

  function collectElements(root) {
    return {
      openDrawerButton: root.querySelector("#open-drawer-button"),
      openThreadMenuButton: root.querySelector("#open-thread-menu-button"),
      closeDrawerButton: root.querySelector("#close-drawer-button"),
      closeThreadMenuButton: root.querySelector("#close-thread-menu-button"),
      closeSystemSheetButton: root.querySelector("#close-system-sheet-button"),
      sheetBackdrop: root.querySelector("#sheet-backdrop"),
      threadDrawer: root.querySelector("#thread-drawer"),
      threadMenuSheet: root.querySelector("#thread-menu-sheet"),
      systemSheet: root.querySelector("#system-sheet"),
      threadList: root.querySelector("#thread-list"),
      threadCount: root.querySelector("#thread-count"),
      threadTitle: root.querySelector("#thread-title"),
      threadMeta: root.querySelector("#thread-meta"),
      runtimeStatus: root.querySelector("#runtime-status"),
      sheetRuntimeStatus: root.querySelector("#sheet-runtime-status"),
      statusCopy: root.querySelector("#status-copy"),
      runtimeSummary: root.querySelector("#runtime-summary"),
      modelName: root.querySelector("#model-name"),
      sheetModelName: root.querySelector("#sheet-model-name"),
      transcript: root.querySelector("#transcript"),
      composerForm: root.querySelector("#composer-form"),
      composerInput: root.querySelector("#composer-input"),
      clearComposerButton: root.querySelector("#clear-composer-button"),
      openSystemButton: root.querySelector("#open-system-button"),
      systemPromptButton: root.querySelector("#system-prompt-button"),
      systemPromptInput: root.querySelector("#system-prompt-input"),
      resetSystemPromptButton: root.querySelector("#reset-system-prompt-button"),
      sendButton: root.querySelector("#send-button"),
      cancelRequestButton: root.querySelector("#cancel-request-button"),
      newThreadButton: root.querySelector("#new-thread-button"),
      renameThreadButton: root.querySelector("#rename-thread-button"),
      forkThreadButton: root.querySelector("#fork-thread-button"),
      deleteThreadButton: root.querySelector("#delete-thread-button"),
      renameDialog: root.querySelector("#rename-dialog"),
      renameForm: root.querySelector("#rename-form"),
      renameInput: root.querySelector("#rename-input"),
      renameCancelButton: root.querySelector("#rename-cancel-button"),
    };
  }

  function openPanel(ui, root, elements, panelName) {
    ui.openPanel = panelName;
    syncPanels(ui, root, elements);
  }

  function closePanels(ui, root, elements) {
    ui.openPanel = PANELS.NONE;
    syncPanels(ui, root, elements);
  }

  function syncPanels(ui, root, elements) {
    const threadsOpen = ui.openPanel === PANELS.THREADS;
    const menuOpen = ui.openPanel === PANELS.MENU;
    const systemOpen = ui.openPanel === PANELS.SYSTEM;
    const anyOpen = threadsOpen || menuOpen || systemOpen;

    root.classList.toggle("drawer-open", threadsOpen);
    root.classList.toggle("menu-open", menuOpen);
    root.classList.toggle("system-open", systemOpen);
    root.classList.toggle("sheet-open", anyOpen);
    elements.sheetBackdrop.classList.toggle("hidden", !anyOpen);

    elements.openDrawerButton.setAttribute("aria-expanded", threadsOpen ? "true" : "false");
    elements.openThreadMenuButton.setAttribute("aria-expanded", menuOpen ? "true" : "false");
  }

  function describeThread(thread) {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const lastMessage = thread.messages[thread.messages.length - 1];
    const summary = lastMessage ? lastMessage.content : "No messages yet";

    return {
      meta:
        thread.messages.length +
        " msg" +
        (thread.messages.length === 1 ? "" : "s") +
        " • updated " +
        formatter.format(new Date(thread.updatedAt)),
      snippet: summary.length > 90 ? summary.slice(0, 87) + "..." : summary,
    };
  }

  function syncTextareaValue(element, value) {
    if (element.value !== value) {
      element.value = value;
    }
  }

  function autoResizeTextarea(element, maxHeight) {
    if (!element) {
      return;
    }

    element.style.height = "0px";
    const nextHeight = Math.min(element.scrollHeight, maxHeight || 280);
    element.style.height = Math.max(nextHeight, 44) + "px";
  }

  function renderRuntime(state, elements) {
    const ready = state.runtime.status === "ready";
    const offline = state.runtime.status === "error";
    const checking = state.runtime.status === "checking";

    function applyRuntimeChip(chip) {
      chip.textContent = ready ? "Ready" : offline ? "Offline" : "Checking";
      chip.className =
        "status-pill" +
        (chip.id === "sheet-runtime-status" ? " mini-pill" : "") +
        (ready ? " status-ready" : offline ? " status-error" : checking ? " status-checking" : "");
    }

    applyRuntimeChip(elements.runtimeStatus);
    applyRuntimeChip(elements.sheetRuntimeStatus);

    elements.statusCopy.textContent = state.runtime.message;
    elements.runtimeSummary.textContent = ready
      ? "Ready for local replies"
      : offline
        ? "Runtime unavailable"
        : "Checking local runtime";
    elements.modelName.textContent = state.runtime.modelName;
    elements.sheetModelName.textContent = state.runtime.modelName;
  }

  function renderThreadList(state, ui, root, elements) {
    elements.threadCount.textContent = String(state.threads.length);
    elements.threadList.replaceChildren();

    state.threads.forEach(function (thread) {
      const description = describeThread(thread);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thread-card" + (thread.id === state.activeThreadId ? " is-active" : "");
      button.setAttribute("data-thread-id", thread.id);
      button.innerHTML =
        '<span class="thread-card-title"></span>' +
        '<span class="thread-card-meta"></span>' +
        '<span class="thread-card-snippet"></span>';
      button.querySelector(".thread-card-title").textContent = thread.title;
      button.querySelector(".thread-card-meta").textContent = description.meta;
      button.querySelector(".thread-card-snippet").textContent = description.snippet;
      elements.threadList.appendChild(button);
    });
  }

  function buildMessageCard(message) {
    const row = document.createElement("div");
    row.className = "message-row role-" + (message.pending ? "pending" : message.role);

    const card = document.createElement("article");
    card.className = "message-card role-" + (message.pending ? "pending" : message.role);

    const header = document.createElement("div");
    header.className = "message-header";

    const role = document.createElement("span");
    role.className = "message-role";
    role.textContent = message.role === "assistant" ? "OurBox Chat" : "You";

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(message.createdAt));

    const body = document.createElement("div");
    body.className = "message-body";
    if (message.pending) {
      const typing = document.createElement("div");
      typing.className = "typing-indicator";
      for (let index = 0; index < 3; index += 1) {
        const dot = document.createElement("span");
        dot.className = "typing-dot";
        typing.appendChild(dot);
      }
      const copy = document.createElement("span");
      copy.className = "typing-copy";
      copy.textContent = "Thinking locally";
      body.appendChild(typing);
      body.appendChild(copy);
    } else {
      body.textContent = message.content;
    }

    header.appendChild(role);
    header.appendChild(time);
    card.appendChild(header);
    card.appendChild(body);
    row.appendChild(card);

    return row;
  }

  function renderEmptyState(app, contract, state) {
    const empty = document.createElement("section");
    empty.className = "conversation-empty";
    empty.innerHTML =
      '<div class="empty-mark"></div>' +
      '<h2>Everything stays on this box</h2>' +
      '<p>Start with a quick prompt or type your own message below.</p>' +
      '<div class="quick-prompt-list"></div>';

    const promptList = empty.querySelector(".quick-prompt-list");
    QUICK_PROMPTS.forEach(function (prompt) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-prompt-chip";
      button.textContent = prompt;
      button.addEventListener("click", function () {
        void app.dispatch({
          type: contract.commands.REQUEST_SEND,
          threadId: state.activeThreadId,
          content: prompt,
        });
      });
      promptList.appendChild(button);
    });

    return empty;
  }

  function renderMessages(state, ui, elements, app, contract) {
    const thread = state.activeThread;
    const messages = thread.messages.slice();
    const transcript = elements.transcript;
    const scrollKey =
      state.activeThreadId +
      "|" +
      messages.length +
      "|" +
      (messages.length ? messages[messages.length - 1].id : "empty") +
      "|" +
      (state.request.inFlight ? state.request.threadId || "request" : "idle");

    if (state.request.inFlight && state.request.threadId === thread.id) {
      messages.push({
        id: PENDING_MESSAGE_ID,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      });
    }

    transcript.replaceChildren();

    if (!messages.length) {
      transcript.appendChild(renderEmptyState(app, contract, state));
    } else {
      messages.forEach(function (message) {
        transcript.appendChild(buildMessageCard(message));
      });
    }

    if (ui.lastTranscriptKey !== scrollKey) {
      ui.lastTranscriptKey = scrollKey;
      requestAnimationFrame(function () {
        transcript.scrollTop = transcript.scrollHeight;
      });
    }
  }

  function setControlState(state, elements) {
    const busy = state.request.inFlight;
    elements.sendButton.disabled = busy;
    elements.cancelRequestButton.disabled = !busy;
    elements.newThreadButton.disabled = busy;
    elements.forkThreadButton.disabled = busy;
    elements.deleteThreadButton.disabled = busy;
  }

  function renderWorkspace(state, elements) {
    const thread = state.activeThread;
    const description = describeThread(thread);

    elements.threadTitle.textContent = thread.title;
    elements.threadMeta.textContent = thread.messages.length
      ? description.meta
      : "Saved locally in this browser. Replies come from the bundled model running on this box.";

    syncTextareaValue(elements.composerInput, thread.draft);
    syncTextareaValue(elements.systemPromptInput, thread.systemPrompt);
    autoResizeTextarea(elements.composerInput, 160);
    autoResizeTextarea(elements.systemPromptInput, 280);
  }

  function openRenameDialog(ui, elements, app, contract) {
    const thread = ui.latestState.activeThread;
    elements.renameInput.maxLength = contract.limits.maxThreadTitleLength;
    elements.renameInput.value = thread.title;

    if (elements.renameDialog && typeof elements.renameDialog.showModal === "function") {
      elements.renameDialog.showModal();
      elements.renameInput.focus();
      elements.renameInput.select();
      return;
    }

    const nextTitle = window.prompt("Rename chat", thread.title);
    if (nextTitle !== null) {
      void app.dispatch({
        type: contract.commands.THREAD_RENAME,
        threadId: thread.id,
        title: nextTitle,
      });
    }
  }

  function mountView(args) {
    const root = args.root;
    const app = args.app;
    const contract = args.contract;
    const cleanupTasks = [];
    const ui = {
      latestState: app.getState(),
      openPanel: PANELS.NONE,
      lastTranscriptKey: null,
      unsubscribe: null,
    };

    function addListener(target, type, handler) {
      target.addEventListener(type, handler);
      cleanupTasks.push(function () {
        target.removeEventListener(type, handler);
      });
    }

    function render(state) {
      ui.latestState = state;
      renderRuntime(state, elements);
      renderThreadList(state, ui, root, elements);
      renderWorkspace(state, elements);
      renderMessages(state, ui, elements, app, contract);
      setControlState(state, elements);
      syncPanels(ui, root, elements);
    }

    function focusComposer() {
      elements.composerInput.focus();
      const length = elements.composerInput.value.length;
      elements.composerInput.setSelectionRange(length, length);
      autoResizeTextarea(elements.composerInput, 160);
    }

    function sendMessage(optionalContent) {
      const state = ui.latestState;
      return app.dispatch({
        type: contract.commands.REQUEST_SEND,
        threadId: state.activeThreadId,
        content: typeof optionalContent === "string" ? optionalContent : undefined,
      }).then(function (result) {
        if (!result.ok && result.code === contract.errors.EMPTY_DRAFT) {
          focusComposer();
        }
        return result;
      });
    }

    root.classList.add("ourbox-chat-mobile-native-root");
    root.innerHTML = renderTemplate(contract.limits.maxThreadTitleLength);

    const elements = collectElements(root);

    addListener(elements.openDrawerButton, "click", function () {
      openPanel(ui, root, elements, PANELS.THREADS);
    });

    addListener(elements.closeDrawerButton, "click", function () {
      closePanels(ui, root, elements);
    });

    addListener(elements.openThreadMenuButton, "click", function () {
      openPanel(ui, root, elements, PANELS.MENU);
    });

    addListener(elements.closeThreadMenuButton, "click", function () {
      closePanels(ui, root, elements);
    });

    addListener(elements.openSystemButton, "click", function () {
      openPanel(ui, root, elements, PANELS.SYSTEM);
      requestAnimationFrame(function () {
        elements.systemPromptInput.focus();
      });
    });

    addListener(elements.systemPromptButton, "click", function () {
      openPanel(ui, root, elements, PANELS.SYSTEM);
      requestAnimationFrame(function () {
        elements.systemPromptInput.focus();
      });
    });

    addListener(elements.closeSystemSheetButton, "click", function () {
      closePanels(ui, root, elements);
    });

    addListener(elements.sheetBackdrop, "click", function () {
      closePanels(ui, root, elements);
    });

    addListener(window, "keydown", function (event) {
      if (event.key === "Escape" && ui.openPanel !== PANELS.NONE) {
        closePanels(ui, root, elements);
      }
    });

    addListener(elements.newThreadButton, "click", function () {
      void app.dispatch({
        type: contract.commands.THREAD_CREATE,
      }).then(function (result) {
        if (result.ok) {
          closePanels(ui, root, elements);
          focusComposer();
        }
      });
    });

    addListener(elements.threadList, "click", function (event) {
      const button = event.target.closest("[data-thread-id]");
      if (!button) {
        return;
      }

      const threadId = button.getAttribute("data-thread-id");
      if (!threadId) {
        return;
      }

      void app.dispatch({
        type: contract.commands.THREAD_SELECT,
        threadId: threadId,
      }).then(function () {
        closePanels(ui, root, elements);
      });
    });

    addListener(elements.renameThreadButton, "click", function () {
      closePanels(ui, root, elements);
      openRenameDialog(ui, elements, app, contract);
    });

    addListener(elements.renameForm, "submit", function (event) {
      event.preventDefault();
      void app.dispatch({
        type: contract.commands.THREAD_RENAME,
        threadId: ui.latestState.activeThreadId,
        title: elements.renameInput.value,
      }).then(function (result) {
        if (result.ok && elements.renameDialog && typeof elements.renameDialog.close === "function") {
          elements.renameDialog.close();
        }
      });
    });

    addListener(elements.renameCancelButton, "click", function () {
      if (elements.renameDialog && typeof elements.renameDialog.close === "function") {
        elements.renameDialog.close();
      }
    });

    addListener(elements.forkThreadButton, "click", function () {
      void app.dispatch({
        type: contract.commands.THREAD_FORK,
        threadId: ui.latestState.activeThreadId,
      }).then(function (result) {
        if (result.ok) {
          closePanels(ui, root, elements);
          focusComposer();
        }
      });
    });

    addListener(elements.deleteThreadButton, "click", function () {
      const confirmed = window.confirm(
        "Delete this chat? The saved messages in this browser will be removed."
      );
      if (!confirmed) {
        return;
      }

      void app.dispatch({
        type: contract.commands.THREAD_DELETE,
        threadId: ui.latestState.activeThreadId,
      }).then(function (result) {
        if (result.ok) {
          closePanels(ui, root, elements);
        }
      });
    });

    addListener(elements.clearComposerButton, "click", function () {
      void app.dispatch({
        type: contract.commands.THREAD_DRAFT_SET,
        threadId: ui.latestState.activeThreadId,
        draft: "",
      }).then(function () {
        focusComposer();
      });
    });

    addListener(elements.composerInput, "input", function (event) {
      autoResizeTextarea(elements.composerInput, 160);
      void app.dispatch({
        type: contract.commands.THREAD_DRAFT_SET,
        threadId: ui.latestState.activeThreadId,
        draft: event.target.value,
      });
    });

    addListener(elements.composerInput, "keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    });

    addListener(elements.systemPromptInput, "input", function (event) {
      autoResizeTextarea(elements.systemPromptInput, 280);
      void app.dispatch({
        type: contract.commands.THREAD_SYSTEM_PROMPT_SET,
        threadId: ui.latestState.activeThreadId,
        systemPrompt: event.target.value,
      });
    });

    addListener(elements.resetSystemPromptButton, "click", function () {
      void app.dispatch({
        type: contract.commands.THREAD_SYSTEM_PROMPT_SET,
        threadId: ui.latestState.activeThreadId,
        systemPrompt: "",
      });
    });

    addListener(elements.cancelRequestButton, "click", function () {
      void app.dispatch({
        type: contract.commands.REQUEST_CANCEL,
      });
    });

    addListener(elements.composerForm, "submit", function (event) {
      event.preventDefault();
      void sendMessage();
    });

    ui.unsubscribe = app.subscribe(function (event) {
      render(event.state);
    });

    render(app.getState());

    return {
      unmount: function unmount() {
        cleanupTasks.forEach(function (cleanup) {
          cleanup();
        });

        if (ui.unsubscribe) {
          ui.unsubscribe();
        }

        if (elements.renameDialog && elements.renameDialog.open && typeof elements.renameDialog.close === "function") {
          elements.renameDialog.close();
        }

        root.classList.remove(
          "ourbox-chat-mobile-native-root",
          "drawer-open",
          "menu-open",
          "system-open",
          "sheet-open"
        );
        root.replaceChildren();
      },
    };
  }

  window.OurBoxChatView = {
    id: "mobile-native",
    contractVersion: "1.0.0",
    mount: mountView,
  };
})();
