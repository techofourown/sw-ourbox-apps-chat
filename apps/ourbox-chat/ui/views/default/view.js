(function () {
  const MOBILE_BREAKPOINT = 980;
  const PENDING_MESSAGE_ID = "pending-assistant-message";

  function isDesktopLayout() {
    return window.matchMedia("(min-width: " + MOBILE_BREAKPOINT + "px)").matches;
  }

  function renderTemplate(maxThreadTitleLength) {
    return (
      '<div class="app-shell" data-view="default">' +
        '<button class="drawer-backdrop hidden" id="drawer-backdrop" type="button" aria-label="Close saved chats"></button>' +
        '<aside class="sidebar" id="thread-drawer" aria-label="Saved chats">' +
          '<div class="sidebar-header">' +
            '<div class="brand-lockup">' +
              '<p class="eyebrow">Offline Local AI</p>' +
              '<h1>OurBox Chat</h1>' +
              '<p class="brand-copy">Private, on-device chat with saved conversations, forkable branches, and per-chat system instructions.</p>' +
            "</div>" +
            '<button class="ghost-button sidebar-close-button" id="close-drawer-button" type="button" aria-label="Close saved chats">Close</button>' +
          "</div>" +
          '<section class="status-card">' +
            '<div class="status-row">' +
              '<span class="status-label">Runtime</span>' +
              '<span class="status-pill" id="runtime-status">Checking</span>' +
            "</div>" +
            '<div class="status-row">' +
              '<span class="status-label">Model</span>' +
              '<span class="status-value" id="model-name">Loading</span>' +
            "</div>" +
            '<p class="status-copy" id="status-copy">Connecting to the bundled local model server.</p>' +
          "</section>" +
          '<div class="sidebar-actions">' +
            '<button class="primary-button" id="new-thread-button" type="button">New Chat</button>' +
          "</div>" +
          '<section class="thread-section">' +
            '<div class="thread-section-header">' +
              "<div>" +
                '<p class="eyebrow">Saved On This Device</p>' +
                "<h2>Chats</h2>" +
              "</div>" +
              '<span class="thread-count" id="thread-count">0</span>' +
            "</div>" +
            '<div class="thread-list" id="thread-list" aria-live="polite"></div>' +
          "</section>" +
        "</aside>" +
        '<main class="workspace">' +
          '<header class="workspace-topbar">' +
            '<div class="workspace-leading">' +
              '<button class="ghost-button drawer-toggle-button" id="open-drawer-button" type="button" aria-controls="thread-drawer" aria-expanded="false">Chats</button>' +
              "<div>" +
                '<p class="eyebrow">On-Device Assistant</p>' +
                '<h2 id="thread-title">New Chat</h2>' +
              "</div>" +
            "</div>" +
            '<div class="thread-actions">' +
              '<button class="ghost-button" id="rename-thread-button" type="button">Rename</button>' +
              '<button class="ghost-button" id="fork-thread-button" type="button">Fork</button>' +
              '<button class="ghost-button danger-button" id="delete-thread-button" type="button">Delete</button>' +
            "</div>" +
          "</header>" +
          '<section class="workspace-summary">' +
            '<p class="workspace-copy" id="thread-meta">Start a new conversation and it will be saved locally in this browser.</p>' +
            '<div class="overview-grid">' +
              '<article class="overview-card">' +
                '<span class="overview-label">Runtime</span>' +
                '<span class="overview-value" id="runtime-summary">Checking local runtime</span>' +
              "</article>" +
              '<article class="overview-card">' +
                '<span class="overview-label">Model</span>' +
                '<span class="overview-value" id="model-summary">Loading</span>' +
              "</article>" +
              '<article class="overview-card">' +
                '<span class="overview-label">Storage</span>' +
                '<span class="overview-value">Saved only in this browser</span>' +
              "</article>" +
            "</div>" +
          "</section>" +
          '<details class="panel system-panel" id="system-panel">' +
            '<summary class="panel-summary">' +
              "<div>" +
                '<p class="eyebrow">Behavior</p>' +
                "<h3>System Message</h3>" +
              "</div>" +
              '<p class="panel-copy">Set how this chat should respond before you ask anything.</p>' +
            "</summary>" +
            '<div class="panel-body">' +
              '<label class="field-label" for="system-prompt-input">System instructions for this chat</label>' +
              '<textarea id="system-prompt-input" class="system-input" rows="5" placeholder="Describe how the assistant should behave."></textarea>' +
            "</div>" +
          "</details>" +
          '<section class="panel transcript-panel">' +
            '<div class="transcript-toolbar">' +
              "<div>" +
                '<p class="eyebrow">Conversation</p>' +
                "<h3>History</h3>" +
              "</div>" +
              '<button class="ghost-button" id="clear-composer-button" type="button">Clear Draft</button>' +
            "</div>" +
            '<div class="transcript" id="transcript" aria-live="polite"></div>' +
            '<form class="composer" id="composer-form">' +
              '<label class="field-label" for="composer-input">Message</label>' +
              '<textarea id="composer-input" class="composer-input" rows="4" placeholder="Ask something about your box, your files, or a task you want to work through."></textarea>' +
              '<div class="composer-footer">' +
                '<p class="hint-text">Press <kbd>Enter</kbd> to send. Use <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line.</p>' +
                '<div class="composer-actions">' +
                  '<button class="ghost-button" id="cancel-request-button" type="button" disabled>Stop</button>' +
                  '<button class="primary-button" id="send-button" type="submit">Send</button>' +
                "</div>" +
              "</div>" +
            "</form>" +
          "</section>" +
        "</main>" +
      "</div>" +
      '<dialog class="dialog" id="rename-dialog">' +
        '<form class="dialog-card" id="rename-form" method="dialog">' +
          '<div class="dialog-header">' +
            '<p class="eyebrow">Chat</p>' +
            "<h3>Rename Conversation</h3>" +
          "</div>" +
          '<label class="field-label" for="rename-input">Chat name</label>' +
          '<input id="rename-input" class="rename-input" maxlength="' + maxThreadTitleLength + '" type="text">' +
          '<div class="dialog-actions">' +
            '<button class="ghost-button" id="rename-cancel-button" type="button">Cancel</button>' +
            '<button class="primary-button" type="submit">Save Name</button>' +
          "</div>" +
        "</form>" +
      "</dialog>" +
      '<template id="thread-item-template">' +
        '<button class="thread-item" type="button">' +
          '<span class="thread-item-title"></span>' +
          '<span class="thread-item-meta"></span>' +
          '<span class="thread-item-snippet"></span>' +
        "</button>" +
      "</template>" +
      '<template id="message-template">' +
        '<article class="message-card">' +
          '<div class="message-header">' +
            '<span class="message-role"></span>' +
            '<span class="message-time"></span>' +
          "</div>" +
          '<div class="message-body"></div>' +
        "</article>" +
      "</template>"
    );
  }

  function collectElements(root) {
    return {
      drawerBackdrop: root.querySelector("#drawer-backdrop"),
      openDrawerButton: root.querySelector("#open-drawer-button"),
      closeDrawerButton: root.querySelector("#close-drawer-button"),
      threadList: root.querySelector("#thread-list"),
      threadCount: root.querySelector("#thread-count"),
      threadTitle: root.querySelector("#thread-title"),
      threadMeta: root.querySelector("#thread-meta"),
      runtimeSummary: root.querySelector("#runtime-summary"),
      modelSummary: root.querySelector("#model-summary"),
      transcript: root.querySelector("#transcript"),
      composerForm: root.querySelector("#composer-form"),
      composerInput: root.querySelector("#composer-input"),
      systemPanel: root.querySelector("#system-panel"),
      systemPromptInput: root.querySelector("#system-prompt-input"),
      newThreadButton: root.querySelector("#new-thread-button"),
      renameThreadButton: root.querySelector("#rename-thread-button"),
      forkThreadButton: root.querySelector("#fork-thread-button"),
      deleteThreadButton: root.querySelector("#delete-thread-button"),
      clearComposerButton: root.querySelector("#clear-composer-button"),
      cancelRequestButton: root.querySelector("#cancel-request-button"),
      sendButton: root.querySelector("#send-button"),
      runtimeStatus: root.querySelector("#runtime-status"),
      modelName: root.querySelector("#model-name"),
      statusCopy: root.querySelector("#status-copy"),
      renameDialog: root.querySelector("#rename-dialog"),
      renameForm: root.querySelector("#rename-form"),
      renameInput: root.querySelector("#rename-input"),
      renameCancelButton: root.querySelector("#rename-cancel-button"),
      threadItemTemplate: root.querySelector("#thread-item-template"),
      messageTemplate: root.querySelector("#message-template"),
    };
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
      snippet: summary.length > 82 ? summary.slice(0, 79) + "..." : summary,
    };
  }

  function syncTextareaValue(element, value) {
    if (element.value !== value) {
      element.value = value;
    }
  }

  function syncLayout(ui, root, elements) {
    const desktop = isDesktopLayout();
    if (desktop) {
      ui.drawerOpen = false;
    }

    const drawerOpen = !desktop && ui.drawerOpen;
    root.classList.toggle("drawer-open", drawerOpen);
    elements.drawerBackdrop.classList.toggle("hidden", !drawerOpen);
    elements.openDrawerButton.setAttribute("aria-expanded", drawerOpen ? "true" : "false");
  }

  function closeDrawerIfMobile(ui, root, elements) {
    if (!isDesktopLayout()) {
      ui.drawerOpen = false;
      syncLayout(ui, root, elements);
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

  function renderRuntime(state, elements) {
    const ready = state.runtime.status === "ready";
    const offline = state.runtime.status === "error";

    elements.runtimeStatus.textContent = ready ? "Ready" : offline ? "Offline" : "Checking";
    elements.runtimeStatus.className =
      "status-pill " + (ready ? "status-ready" : offline ? "status-error" : "");
    elements.statusCopy.textContent = state.runtime.message;
    elements.runtimeSummary.textContent = ready
      ? "Ready for local replies"
      : offline
        ? "Runtime unavailable"
        : "Checking local runtime";
    elements.modelName.textContent = state.runtime.modelName;
    elements.modelSummary.textContent = state.runtime.modelName;
  }

  function renderThreads(args) {
    const state = args.state;
    const ui = args.ui;
    const root = args.root;
    const elements = args.elements;
    const app = args.app;
    const contract = args.contract;

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

      if (thread.id === state.activeThreadId) {
        button.classList.add("is-active");
      }

      button.addEventListener("click", function () {
        if (thread.id === ui.latestState.activeThreadId) {
          closeDrawerIfMobile(ui, root, elements);
          return;
        }

        void app.dispatch({
          type: contract.commands.THREAD_SELECT,
          threadId: thread.id,
        }).then(function () {
          closeDrawerIfMobile(ui, root, elements);
        });
      });

      elements.threadList.appendChild(fragment);
    });
  }

  function renderMessages(state, elements) {
    const thread = state.activeThread;
    const messages = thread.messages.slice();

    elements.transcript.replaceChildren();

    if (state.request.inFlight && state.request.threadId === thread.id) {
      messages.push({
        id: PENDING_MESSAGE_ID,
        role: "assistant",
        content: "Generating a local reply...",
        createdAt: new Date().toISOString(),
        pending: true,
      });
    }

    if (!messages.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.innerHTML =
        "<div><strong>This chat is empty.</strong><br>Ask a question to begin a local conversation.</div>";
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
      role.textContent = message.role === "assistant" ? "OurBox Chat" : "You";
      time.textContent = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(message.createdAt));
      body.textContent = message.content;

      elements.transcript.appendChild(fragment);
    });

    elements.transcript.scrollTop = elements.transcript.scrollHeight;
  }

  function renderWorkspace(state, elements) {
    const thread = state.activeThread;
    const threadInfo = describeThread(thread);

    elements.threadTitle.textContent = thread.title;
    elements.threadMeta.textContent = thread.messages.length
      ? threadInfo.meta
      : "Saved locally in this browser. The model runs entirely on this box.";
    syncTextareaValue(elements.systemPromptInput, thread.systemPrompt);
    syncTextareaValue(elements.composerInput, thread.draft);

    renderRuntime(state, elements);
    renderMessages(state, elements);
  }

  function openRenameDialog(state, elements, contract, app) {
    const activeThread = state.activeThread;
    elements.renameInput.maxLength = contract.limits.maxThreadTitleLength;
    elements.renameInput.value = activeThread.title;

    if (typeof elements.renameDialog.showModal === "function") {
      elements.renameDialog.showModal();
      elements.renameInput.focus();
      elements.renameInput.select();
      return;
    }

    const nextTitle = window.prompt("Rename chat", activeThread.title);
    if (nextTitle !== null) {
      void app.dispatch({
        type: contract.commands.THREAD_RENAME,
        threadId: activeThread.id,
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
      drawerOpen: false,
      latestState: app.getState(),
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
      renderThreads({
        state: state,
        ui: ui,
        root: root,
        elements: elements,
        app: app,
        contract: contract,
      });
      renderWorkspace(state, elements);
      setControlState(state, elements);
      syncLayout(ui, root, elements);
    }

    function sendActiveDraft() {
      const state = ui.latestState;
      return app.dispatch({
        type: contract.commands.REQUEST_SEND,
        threadId: state.activeThreadId,
      }).then(function (result) {
        if (!result.ok && result.code === contract.errors.EMPTY_DRAFT) {
          elements.composerInput.focus();
        }
      });
    }

    root.classList.add("ourbox-chat-view-root");
    root.innerHTML = renderTemplate(contract.limits.maxThreadTitleLength);

    const elements = collectElements(root);
    elements.systemPanel.open = isDesktopLayout();

    addListener(elements.openDrawerButton, "click", function () {
      ui.drawerOpen = true;
      syncLayout(ui, root, elements);
    });

    addListener(elements.closeDrawerButton, "click", function () {
      ui.drawerOpen = false;
      syncLayout(ui, root, elements);
    });

    addListener(elements.drawerBackdrop, "click", function () {
      ui.drawerOpen = false;
      syncLayout(ui, root, elements);
    });

    addListener(window, "resize", function () {
      syncLayout(ui, root, elements);
    });

    addListener(elements.newThreadButton, "click", function () {
      void app.dispatch({
        type: contract.commands.THREAD_CREATE,
      }).then(function (result) {
        if (result.ok) {
          closeDrawerIfMobile(ui, root, elements);
          elements.composerInput.focus();
        }
      });
    });

    addListener(elements.renameThreadButton, "click", function () {
      openRenameDialog(ui.latestState, elements, contract, app);
    });

    addListener(elements.renameForm, "submit", function (event) {
      event.preventDefault();

      void app.dispatch({
        type: contract.commands.THREAD_RENAME,
        threadId: ui.latestState.activeThreadId,
        title: elements.renameInput.value,
      }).then(function (result) {
        if (result.ok && typeof elements.renameDialog.close === "function") {
          elements.renameDialog.close();
        }
      });
    });

    addListener(elements.renameCancelButton, "click", function () {
      if (typeof elements.renameDialog.close === "function") {
        elements.renameDialog.close();
      }
    });

    addListener(elements.forkThreadButton, "click", function () {
      void app.dispatch({
        type: contract.commands.THREAD_FORK,
        threadId: ui.latestState.activeThreadId,
      }).then(function (result) {
        if (result.ok) {
          closeDrawerIfMobile(ui, root, elements);
          elements.composerInput.focus();
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
          closeDrawerIfMobile(ui, root, elements);
        }
      });
    });

    addListener(elements.clearComposerButton, "click", function () {
      void app.dispatch({
        type: contract.commands.THREAD_DRAFT_SET,
        threadId: ui.latestState.activeThreadId,
        draft: "",
      }).then(function () {
        elements.composerInput.focus();
      });
    });

    addListener(elements.composerInput, "input", function (event) {
      void app.dispatch({
        type: contract.commands.THREAD_DRAFT_SET,
        threadId: ui.latestState.activeThreadId,
        draft: event.target.value,
      });
    });

    addListener(elements.composerInput, "keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendActiveDraft();
      }
    });

    addListener(elements.systemPromptInput, "input", function (event) {
      void app.dispatch({
        type: contract.commands.THREAD_SYSTEM_PROMPT_SET,
        threadId: ui.latestState.activeThreadId,
        systemPrompt: event.target.value,
      });
    });

    addListener(elements.cancelRequestButton, "click", function () {
      void app.dispatch({
        type: contract.commands.REQUEST_CANCEL,
      });
    });

    addListener(elements.composerForm, "submit", function (event) {
      event.preventDefault();
      void sendActiveDraft();
    });

    ui.unsubscribe = app.subscribe(function (event) {
      render(event.state);
    });

    return {
      unmount: function unmount() {
        cleanupTasks.forEach(function (cleanup) {
          cleanup();
        });

        if (ui.unsubscribe) {
          ui.unsubscribe();
        }

        root.classList.remove("ourbox-chat-view-root", "drawer-open");
        root.replaceChildren();
      },
    };
  }

  window.OurBoxChatView = {
    id: "default",
    contractVersion: "1.0.0",
    mount: mountView,
  };
})();
