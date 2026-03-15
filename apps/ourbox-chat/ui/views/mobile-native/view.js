(function () {
  const PENDING_MESSAGE_ID = "pending-assistant-message";
  const LONG_PRESS_MS = 450;
  const PANELS = Object.freeze({
    NONE: null,
    THREADS: "threads",
    MENU: "menu",
    SYSTEM: "system",
    ADVANCED: "advanced",
  });
  const MESSAGE_ACTIONS = Object.freeze({
    EDIT: "edit",
    REGENERATE: "regenerate",
  });

  function renderTemplate(contract) {
    const maxThreadTitleLength = contract.limits.maxThreadTitleLength;
    const generationLimits = contract.limits.generationSettings;

    return (
      '<div class="phone-shell app-shell" data-view="mobile-native">' +
        '<div class="ambient ambient-one"></div>' +
        '<div class="ambient ambient-two"></div>' +
        '<header class="topbar chat-header">' +
          '<h1 class="sr-only">OurBox Chat</h1>' +
          '<button class="icon-button" id="open-drawer-button" type="button" aria-label="Open saved chats">' +
            '<span class="icon-stack"><span></span><span></span><span></span></span>' +
          '</button>' +
          '<div class="topbar-copy">' +
            '<p class="topbar-title" id="thread-title">Chat</p>' +
          '</div>' +
          '<button class="icon-button" id="open-thread-menu-button" type="button" aria-label="Open conversation actions">' +
            '<span class="icon-dots"><span></span><span></span><span></span></span>' +
          '</button>' +
        '</header>' +

        '<main class="workspace conversation-stage">' +
          '<section class="transcript-shell transcript-panel">' +
            '<div class="transcript" id="transcript" aria-live="polite"></div>' +
          '</section>' +
        '</main>' +

        '<footer class="composer-dock">' +
          '<form class="composer" id="composer-form">' +
            '<label class="sr-only" for="composer-input">Message</label>' +
            '<textarea id="composer-input" class="composer-input" rows="1" placeholder="Message your local assistant"></textarea>' +
            '<button class="send-button" id="send-button" type="submit" aria-label="Send message">' +
              '<span class="send-icon" id="send-icon">&rarr;</span>' +
            '</button>' +
          '</form>' +
        '</footer>' +

        '<button class="sheet-backdrop hidden" id="sheet-backdrop" type="button" aria-label="Close overlay"></button>' +

        '<section class="sheet sheet-threads" id="thread-drawer" aria-label="Saved chats">' +
          '<div class="sheet-grabber"></div>' +
          '<div class="sheet-header">' +
            '<div>' +
              '<p class="sheet-kicker">Chats</p>' +
              '<h2>Saved Chats <span class="thread-count" id="thread-count">0</span></h2>' +
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
            '<p class="sheet-status-copy" id="sheet-status-copy">Connecting to the bundled local model server.</p>' +
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
              '<span class="action-copy">Adjust the system prompt for this chat</span>' +
            '</button>' +
            '<button class="action-row" id="advanced-settings-button" type="button">' +
              '<span class="action-title">Advanced</span>' +
              '<span class="action-copy">Adjust response length and sampling</span>' +
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
            '<p class="sheet-status-copy">This only affects the active chat. Leave it blank to restore the built-in default.</p>' +
            '<label class="field-label" for="system-prompt-input">System instructions</label>' +
            '<textarea id="system-prompt-input" class="system-input" rows="7" placeholder="Describe how this chat should behave."></textarea>' +
            '<div class="system-actions">' +
              '<button class="ghost-button compact-button" id="reset-system-prompt-button" type="button">Reset</button>' +
            '</div>' +
          '</section>' +
        '</section>' +

        '<section class="sheet sheet-advanced" id="advanced-sheet" aria-label="Advanced settings">' +
          '<div class="sheet-grabber"></div>' +
          '<div class="sheet-header">' +
            '<div>' +
              '<p class="sheet-kicker">Advanced</p>' +
              '<h2>Generation</h2>' +
            '</div>' +
            '<button class="soft-button text-button" id="close-advanced-sheet-button" type="button">Done</button>' +
          '</div>' +
          '<section class="advanced-panel" id="advanced-panel">' +
            '<p class="sheet-status-copy">These settings affect only the active chat. They apply to future replies from this conversation.</p>' +
            '<div class="advanced-grid">' +
              '<label class="field-group" for="advanced-max-tokens-input">' +
                '<span class="field-label">Max response tokens</span>' +
                '<input id="advanced-max-tokens-input" class="advanced-input" type="number" inputmode="numeric" min="' + generationLimits.maxTokens.min + '" max="' + generationLimits.maxTokens.max + '" step="' + generationLimits.maxTokens.step + '">' +
              '</label>' +
              '<label class="field-group" for="advanced-temperature-input">' +
                '<span class="field-label">Temperature</span>' +
                '<input id="advanced-temperature-input" class="advanced-input" type="number" inputmode="decimal" min="' + generationLimits.temperature.min + '" max="' + generationLimits.temperature.max + '" step="' + generationLimits.temperature.step + '">' +
              '</label>' +
              '<label class="field-group" for="advanced-top-p-input">' +
                '<span class="field-label">Top-p</span>' +
                '<input id="advanced-top-p-input" class="advanced-input" type="number" inputmode="decimal" min="' + generationLimits.topP.min + '" max="' + generationLimits.topP.max + '" step="' + generationLimits.topP.step + '">' +
              '</label>' +
              '<label class="field-group" for="advanced-top-k-input">' +
                '<span class="field-label">Top-k</span>' +
                '<input id="advanced-top-k-input" class="advanced-input" type="number" inputmode="numeric" min="' + generationLimits.topK.min + '" max="' + generationLimits.topK.max + '" step="' + generationLimits.topK.step + '">' +
              '</label>' +
              '<label class="field-group" for="advanced-presence-penalty-input">' +
                '<span class="field-label">Presence penalty</span>' +
                '<input id="advanced-presence-penalty-input" class="advanced-input" type="number" inputmode="decimal" min="' + generationLimits.presencePenalty.min + '" max="' + generationLimits.presencePenalty.max + '" step="' + generationLimits.presencePenalty.step + '">' +
              '</label>' +
            '</div>' +
            '<section class="advanced-runtime-card">' +
              '<div>' +
                '<span class="meta-label">Context window</span>' +
                '<p class="advanced-runtime-value" id="advanced-context-window-value">Loading</p>' +
              '</div>' +
              '<p class="sheet-status-copy">Context window is controlled by the running model server and is shown here for reference.</p>' +
            '</section>' +
            '<div class="system-actions">' +
              '<button class="ghost-button compact-button" id="reset-advanced-settings-button" type="button">Reset</button>' +
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
      '</dialog>' +

      '<dialog class="message-action-dialog" id="message-action-dialog">' +
        '<form class="message-action-card" id="message-action-form" method="dialog">' +
          '<p class="sheet-kicker">Message</p>' +
          '<h2 id="message-action-title">Message Action</h2>' +
          '<p class="sheet-status-copy" id="message-action-copy">Choose how to continue from this message.</p>' +
          '<button class="primary-button block-button" id="message-action-button" type="button">Continue</button>' +
          '<button class="ghost-button block-button" id="message-copy-button" type="button">Copy</button>' +
          '<button class="ghost-button block-button" id="message-action-cancel-button" type="button">Cancel</button>' +
        '</form>' +
      '</dialog>' +

      '<dialog class="edit-message-dialog" id="edit-message-dialog">' +
        '<form class="edit-message-card" id="edit-message-form" method="dialog">' +
          '<p class="sheet-kicker">Message</p>' +
          '<h2>Edit Latest Prompt</h2>' +
          '<label class="field-label" for="edit-message-input">Message</label>' +
          '<textarea id="edit-message-input" class="system-input edit-message-input" rows="5" placeholder="Update the latest prompt."></textarea>' +
          '<div class="rename-actions">' +
            '<button class="ghost-button compact-button" id="edit-message-cancel-button" type="button">Cancel</button>' +
            '<button class="primary-button compact-button" type="submit">Update</button>' +
          '</div>' +
        '</form>' +
      '</dialog>'
    );
  }

  function collectElements(root) {
    return {
      openDrawerButton: root.querySelector("#open-drawer-button"),
      openThreadMenuButton: root.querySelector("#open-thread-menu-button"),
      advancedSettingsButton: root.querySelector("#advanced-settings-button"),
      closeDrawerButton: root.querySelector("#close-drawer-button"),
      closeThreadMenuButton: root.querySelector("#close-thread-menu-button"),
      closeSystemSheetButton: root.querySelector("#close-system-sheet-button"),
      closeAdvancedSheetButton: root.querySelector("#close-advanced-sheet-button"),
      sheetBackdrop: root.querySelector("#sheet-backdrop"),
      threadList: root.querySelector("#thread-list"),
      threadCount: root.querySelector("#thread-count"),
      threadTitle: root.querySelector("#thread-title"),
      sheetRuntimeStatus: root.querySelector("#sheet-runtime-status"),
      sheetStatusCopy: root.querySelector("#sheet-status-copy"),
      sheetModelName: root.querySelector("#sheet-model-name"),
      transcript: root.querySelector("#transcript"),
      composerForm: root.querySelector("#composer-form"),
      composerInput: root.querySelector("#composer-input"),
      systemPromptButton: root.querySelector("#system-prompt-button"),
      systemPromptInput: root.querySelector("#system-prompt-input"),
      resetSystemPromptButton: root.querySelector("#reset-system-prompt-button"),
      advancedMaxTokensInput: root.querySelector("#advanced-max-tokens-input"),
      advancedTemperatureInput: root.querySelector("#advanced-temperature-input"),
      advancedTopPInput: root.querySelector("#advanced-top-p-input"),
      advancedTopKInput: root.querySelector("#advanced-top-k-input"),
      advancedPresencePenaltyInput: root.querySelector("#advanced-presence-penalty-input"),
      advancedContextWindowValue: root.querySelector("#advanced-context-window-value"),
      resetAdvancedSettingsButton: root.querySelector("#reset-advanced-settings-button"),
      sendButton: root.querySelector("#send-button"),
      sendIcon: root.querySelector("#send-icon"),
      newThreadButton: root.querySelector("#new-thread-button"),
      renameThreadButton: root.querySelector("#rename-thread-button"),
      forkThreadButton: root.querySelector("#fork-thread-button"),
      deleteThreadButton: root.querySelector("#delete-thread-button"),
      renameDialog: root.querySelector("#rename-dialog"),
      renameForm: root.querySelector("#rename-form"),
      renameInput: root.querySelector("#rename-input"),
      renameCancelButton: root.querySelector("#rename-cancel-button"),
      messageActionDialog: root.querySelector("#message-action-dialog"),
      messageActionForm: root.querySelector("#message-action-form"),
      messageActionTitle: root.querySelector("#message-action-title"),
      messageActionCopy: root.querySelector("#message-action-copy"),
      messageActionButton: root.querySelector("#message-action-button"),
      messageCopyButton: root.querySelector("#message-copy-button"),
      messageActionCancelButton: root.querySelector("#message-action-cancel-button"),
      editMessageDialog: root.querySelector("#edit-message-dialog"),
      editMessageForm: root.querySelector("#edit-message-form"),
      editMessageInput: root.querySelector("#edit-message-input"),
      editMessageCancelButton: root.querySelector("#edit-message-cancel-button"),
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
    const advancedOpen = ui.openPanel === PANELS.ADVANCED;
    const anyOpen = threadsOpen || menuOpen || systemOpen || advancedOpen;

    root.classList.toggle("drawer-open", threadsOpen);
    root.classList.toggle("menu-open", menuOpen);
    root.classList.toggle("system-open", systemOpen);
    root.classList.toggle("advanced-open", advancedOpen);
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

  function findMessageById(thread, messageId) {
    return (
      thread.messages.find(function (message) {
        return message.id === messageId;
      }) || null
    );
  }

  function getLatestActionableMessageIds(thread) {
    let latestUserMessageId = null;
    let latestAssistantMessageId = null;

    for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
      if (!latestUserMessageId && thread.messages[index].role === "user") {
        latestUserMessageId = thread.messages[index].id;
      }

      if (!latestAssistantMessageId && thread.messages[index].role === "assistant") {
        latestAssistantMessageId = thread.messages[index].id;
      }

      if (latestUserMessageId && latestAssistantMessageId) {
        break;
      }
    }

    return {
      latestUserMessageId: latestUserMessageId,
      latestAssistantMessageId: latestAssistantMessageId,
    };
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }

  function copyTextToClipboard(value) {
    const text = String(value || "");

    if (
      window.navigator &&
      window.navigator.clipboard &&
      typeof window.navigator.clipboard.writeText === "function"
    ) {
      return window.navigator.clipboard.writeText(text);
    }

    if (!document.body || typeof document.execCommand !== "function") {
      return Promise.reject(new Error("clipboard unavailable"));
    }

    return new Promise(function (resolve, reject) {
      const element = document.createElement("textarea");
      element.value = text;
      element.setAttribute("readonly", "readonly");
      element.style.position = "fixed";
      element.style.opacity = "0";
      element.style.pointerEvents = "none";
      document.body.appendChild(element);
      element.focus();
      element.select();

      try {
        if (!document.execCommand("copy")) {
          throw new Error("copy command failed");
        }
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(element);
      }
    });
  }

  function closeMessageActionDialog(ui, elements) {
    ui.messageAction = null;
    closeDialog(elements.messageActionDialog);
  }

  function openMessageActionDialog(ui, elements, state, actionKind, messageId) {
    if (!actionKind || !messageId || state.request.inFlight) {
      return;
    }

    ui.messageAction = {
      kind: actionKind,
      messageId: messageId,
    };

    elements.messageActionTitle.textContent =
      actionKind === MESSAGE_ACTIONS.EDIT ? "Edit Latest Prompt" : "Regenerate Response";
    elements.messageActionCopy.textContent =
      actionKind === MESSAGE_ACTIONS.EDIT
        ? "Replace the latest user message and generate a fresh reply."
        : "Discard the latest assistant message and generate it again.";
    elements.messageActionButton.textContent =
      actionKind === MESSAGE_ACTIONS.EDIT ? "Edit Message" : "Regenerate";

    if (
      elements.messageActionDialog &&
      typeof elements.messageActionDialog.showModal === "function" &&
      !elements.messageActionDialog.open
    ) {
      elements.messageActionDialog.showModal();
      return;
    }

    elements.messageActionButton.click();
  }

  function syncTextareaValue(element, value) {
    if (element.value !== value) {
      element.value = value;
    }
  }

  function syncNumberInputValue(element, value) {
    const nextValue = String(value);
    if (element.value !== nextValue) {
      element.value = nextValue;
    }
  }

  function cancelLongPress(ui) {
    if (ui.longPressTimer) {
      window.clearTimeout(ui.longPressTimer);
      ui.longPressTimer = null;
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

  function renderRuntime(state, root, elements) {
    const ready = state.runtime.status === "ready";
    const offline = state.runtime.status === "error";
    const checking = state.runtime.status === "checking";

    root.setAttribute("data-runtime-status", state.runtime.status);

    elements.sheetRuntimeStatus.textContent = ready ? "Ready" : offline ? "Offline" : "Checking";
    elements.sheetRuntimeStatus.className =
      "status-pill mini-pill" +
      (ready ? " status-ready" : offline ? " status-error" : checking ? " status-checking" : "");

    elements.sheetStatusCopy.textContent = state.runtime.message;
    elements.sheetModelName.textContent = state.runtime.modelName;
  }

  function renderThreadList(state, elements) {
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

  function buildMessageCard(message, actionKind) {
    const kind = message.pending ? "pending" : message.role;
    const row = document.createElement("div");
    row.className = "message-row role-" + kind;

    const card = document.createElement("article");
    card.className = "message-card role-" + kind;
    card.setAttribute(
      "aria-label",
      message.role === "assistant" ? "Assistant message" : "Your message"
    );
    card.title = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(message.createdAt));
    if (actionKind) {
      row.setAttribute("data-message-action", actionKind);
      row.setAttribute("data-message-id", message.id);
      card.classList.add("is-actionable");
      card.setAttribute("aria-haspopup", "dialog");
    }

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

    card.appendChild(body);
    row.appendChild(card);

    return row;
  }

  function renderEmptyState(state) {
    const empty = document.createElement("section");
    empty.className = "conversation-empty";

    const copy = document.createElement("p");
    copy.textContent =
      state.runtime.status === "error"
        ? "The local model is unavailable right now. Open chats to check runtime details."
        : state.runtime.status === "checking"
          ? "Starting the local model…"
          : "Send a message to start.";

    empty.appendChild(copy);
    return empty;
  }

  function renderMessages(state, ui, elements) {
    const thread = state.activeThread;
    const messages = thread.messages.slice();
    const actionableIds = getLatestActionableMessageIds(thread);
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
      transcript.appendChild(renderEmptyState(state));
    } else {
      messages.forEach(function (message) {
        let actionKind = null;

        if (!state.request.inFlight) {
          if (message.id === actionableIds.latestUserMessageId) {
            actionKind = MESSAGE_ACTIONS.EDIT;
          } else if (message.id === actionableIds.latestAssistantMessageId) {
            actionKind = MESSAGE_ACTIONS.REGENERATE;
          }
        }

        transcript.appendChild(buildMessageCard(message, actionKind));
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
    elements.sendButton.classList.toggle("is-busy", busy);
    elements.sendButton.setAttribute("aria-label", busy ? "Stop response" : "Send message");
    elements.sendIcon.innerHTML = busy ? "&#9632;" : "&rarr;";
    elements.newThreadButton.disabled = busy;
    elements.forkThreadButton.disabled = busy;
    elements.deleteThreadButton.disabled = busy;
  }

  function renderWorkspace(state, elements) {
    const thread = state.activeThread;
    const generationSettings = thread.generationSettings;

    elements.threadTitle.textContent = thread.title;
    syncTextareaValue(elements.composerInput, thread.draft);
    syncTextareaValue(elements.systemPromptInput, thread.systemPrompt);
    syncNumberInputValue(elements.advancedMaxTokensInput, generationSettings.maxTokens);
    syncNumberInputValue(elements.advancedTemperatureInput, generationSettings.temperature);
    syncNumberInputValue(elements.advancedTopPInput, generationSettings.topP);
    syncNumberInputValue(elements.advancedTopKInput, generationSettings.topK);
    syncNumberInputValue(
      elements.advancedPresencePenaltyInput,
      generationSettings.presencePenalty
    );
    elements.advancedContextWindowValue.textContent =
      state.runtime.contextWindow && state.runtime.contextWindow > 0
        ? String(state.runtime.contextWindow) + " tokens"
        : "Unavailable";
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
      longPressTimer: null,
      longPressStartX: 0,
      longPressStartY: 0,
      messageAction: null,
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
      if (ui.messageAction && !findMessageById(state.activeThread, ui.messageAction.messageId)) {
        closeMessageActionDialog(ui, elements);
        closeDialog(elements.editMessageDialog);
      }
      renderRuntime(state, root, elements);
      renderThreadList(state, elements);
      renderWorkspace(state, elements);
      renderMessages(state, ui, elements);
      setControlState(state, elements);
      syncPanels(ui, root, elements);
    }

    function focusComposer() {
      elements.composerInput.focus();
      const length = elements.composerInput.value.length;
      elements.composerInput.setSelectionRange(length, length);
      autoResizeTextarea(elements.composerInput, 160);
    }

    function editLatestUserMessage(content) {
      return app.dispatch({
        type: contract.commands.THREAD_LATEST_USER_MESSAGE_EDIT,
        threadId: ui.latestState.activeThreadId,
        content: content,
      });
    }

    function regenerateLatestAssistantMessage() {
      return app.dispatch({
        type: contract.commands.THREAD_LATEST_ASSISTANT_MESSAGE_REGENERATE,
        threadId: ui.latestState.activeThreadId,
      });
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

    function handlePrimaryAction(optionalContent) {
      if (ui.latestState.request.inFlight) {
        return app.dispatch({
          type: contract.commands.REQUEST_CANCEL,
        });
      }

      return sendMessage(optionalContent);
    }

    function updateGenerationSettings(patch) {
      return app.dispatch({
        type: contract.commands.THREAD_GENERATION_SETTINGS_SET,
        threadId: ui.latestState.activeThreadId,
        settings: patch,
      });
    }

    root.classList.add("ourbox-chat-mobile-native-root");
    root.innerHTML = renderTemplate(contract);

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

    addListener(elements.systemPromptButton, "click", function () {
      openPanel(ui, root, elements, PANELS.SYSTEM);
      requestAnimationFrame(function () {
        elements.systemPromptInput.focus();
      });
    });

    addListener(elements.advancedSettingsButton, "click", function () {
      openPanel(ui, root, elements, PANELS.ADVANCED);
      requestAnimationFrame(function () {
        elements.advancedMaxTokensInput.focus();
        elements.advancedMaxTokensInput.select();
      });
    });

    addListener(elements.closeSystemSheetButton, "click", function () {
      closePanels(ui, root, elements);
    });

    addListener(elements.closeAdvancedSheetButton, "click", function () {
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
        focusComposer();
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
          focusComposer();
        }
      });
    });

    addListener(elements.transcript, "contextmenu", function (event) {
      const target = event.target.closest("[data-message-action]");
      if (!target || ui.latestState.request.inFlight) {
        return;
      }

      event.preventDefault();
      openMessageActionDialog(
        ui,
        elements,
        ui.latestState,
        target.getAttribute("data-message-action"),
        target.getAttribute("data-message-id")
      );
    });

    addListener(elements.transcript, "pointerdown", function (event) {
      const target = event.target.closest("[data-message-action]");
      if (
        !target ||
        ui.latestState.request.inFlight ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return;
      }

      cancelLongPress(ui);
      ui.longPressStartX = typeof event.clientX === "number" ? event.clientX : 0;
      ui.longPressStartY = typeof event.clientY === "number" ? event.clientY : 0;
      ui.longPressTimer = window.setTimeout(function () {
        ui.longPressTimer = null;
        openMessageActionDialog(
          ui,
          elements,
          ui.latestState,
          target.getAttribute("data-message-action"),
          target.getAttribute("data-message-id")
        );
      }, LONG_PRESS_MS);
    });

    addListener(elements.transcript, "pointermove", function (event) {
      if (!ui.longPressTimer) {
        return;
      }

      if (
        Math.abs((typeof event.clientX === "number" ? event.clientX : 0) - ui.longPressStartX) >
          10 ||
        Math.abs((typeof event.clientY === "number" ? event.clientY : 0) - ui.longPressStartY) >
          10
      ) {
        cancelLongPress(ui);
      }
    });

    addListener(elements.transcript, "pointerup", function () {
      cancelLongPress(ui);
    });

    addListener(elements.transcript, "pointercancel", function () {
      cancelLongPress(ui);
    });

    addListener(elements.transcript, "scroll", function () {
      cancelLongPress(ui);
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
        void handlePrimaryAction();
      }
    });

    addListener(elements.messageActionButton, "click", function () {
      const action = ui.messageAction;
      if (!action) {
        return;
      }

      closeMessageActionDialog(ui, elements);

      if (action.kind === MESSAGE_ACTIONS.REGENERATE) {
        void regenerateLatestAssistantMessage().then(function (result) {
          if (result.ok) {
            focusComposer();
          }
        });
        return;
      }

      const message = findMessageById(ui.latestState.activeThread, action.messageId);
      if (!message) {
        return;
      }

      elements.editMessageInput.value = message.content;
      autoResizeTextarea(elements.editMessageInput, 240);
      if (elements.editMessageDialog && typeof elements.editMessageDialog.showModal === "function") {
        elements.editMessageDialog.showModal();
        requestAnimationFrame(function () {
          elements.editMessageInput.focus();
          elements.editMessageInput.setSelectionRange(
            elements.editMessageInput.value.length,
            elements.editMessageInput.value.length
          );
        });
        return;
      }

      const nextContent = window.prompt("Edit message", message.content);
      if (nextContent !== null) {
        void editLatestUserMessage(nextContent).then(function (result) {
          if (result.ok) {
            focusComposer();
          }
        });
      }
    });

    addListener(elements.messageCopyButton, "click", function () {
      const action = ui.messageAction;
      if (!action) {
        return;
      }

      const message = findMessageById(ui.latestState.activeThread, action.messageId);
      if (!message) {
        closeMessageActionDialog(ui, elements);
        return;
      }

      void copyTextToClipboard(message.content).finally(function () {
        closeMessageActionDialog(ui, elements);
      });
    });

    addListener(elements.messageActionCancelButton, "click", function () {
      closeMessageActionDialog(ui, elements);
    });

    addListener(elements.editMessageCancelButton, "click", function () {
      closeDialog(elements.editMessageDialog);
    });

    addListener(elements.editMessageInput, "input", function () {
      autoResizeTextarea(elements.editMessageInput, 240);
    });

    addListener(elements.editMessageForm, "submit", function (event) {
      event.preventDefault();
      void editLatestUserMessage(elements.editMessageInput.value).then(function (result) {
        if (!result.ok) {
          return;
        }

        closeDialog(elements.editMessageDialog);
        focusComposer();
      });
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

    addListener(elements.advancedMaxTokensInput, "change", function (event) {
      void updateGenerationSettings({
        maxTokens: event.target.value,
      });
    });

    addListener(elements.advancedTemperatureInput, "change", function (event) {
      void updateGenerationSettings({
        temperature: event.target.value,
      });
    });

    addListener(elements.advancedTopPInput, "change", function (event) {
      void updateGenerationSettings({
        topP: event.target.value,
      });
    });

    addListener(elements.advancedTopKInput, "change", function (event) {
      void updateGenerationSettings({
        topK: event.target.value,
      });
    });

    addListener(elements.advancedPresencePenaltyInput, "change", function (event) {
      void updateGenerationSettings({
        presencePenalty: event.target.value,
      });
    });

    addListener(elements.resetAdvancedSettingsButton, "click", function () {
      void updateGenerationSettings({
        maxTokens: contract.limits.generationSettings.maxTokens.default,
        temperature: contract.limits.generationSettings.temperature.default,
        topP: contract.limits.generationSettings.topP.default,
        topK: contract.limits.generationSettings.topK.default,
        presencePenalty: contract.limits.generationSettings.presencePenalty.default,
      });
    });

    addListener(elements.composerForm, "submit", function (event) {
      event.preventDefault();
      void handlePrimaryAction();
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

        cancelLongPress(ui);
        if (elements.renameDialog && elements.renameDialog.open && typeof elements.renameDialog.close === "function") {
          elements.renameDialog.close();
        }
        closeDialog(elements.messageActionDialog);
        closeDialog(elements.editMessageDialog);

        root.classList.remove(
          "ourbox-chat-mobile-native-root",
          "drawer-open",
          "menu-open",
          "system-open",
          "advanced-open",
          "sheet-open"
        );
        root.removeAttribute("data-runtime-status");
        root.replaceChildren();
      },
    };
  }

  window.OurBoxChatView = {
    id: "mobile-native",
    contractVersion: "1.2.0",
    mount: mountView,
  };
})();
