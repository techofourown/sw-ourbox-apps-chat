(function () {
  const contract = Object.freeze({
    id: "ourbox-chat.view-layer",
    version: "1.2.0",
    browserEventName: "ourboxchat:event",
    commands: Object.freeze({
      THREAD_CREATE: "thread.create",
      THREAD_SELECT: "thread.select",
      THREAD_RENAME: "thread.rename",
      THREAD_FORK: "thread.fork",
      THREAD_DELETE: "thread.delete",
      THREAD_DRAFT_SET: "thread.draft.set",
      THREAD_SYSTEM_PROMPT_SET: "thread.system-prompt.set",
      THREAD_GENERATION_SETTINGS_SET: "thread.generation-settings.set",
      THREAD_LATEST_USER_MESSAGE_EDIT: "thread.latest-user-message.edit",
      THREAD_LATEST_ASSISTANT_MESSAGE_REGENERATE:
        "thread.latest-assistant-message.regenerate",
      REQUEST_SEND: "request.send",
      REQUEST_CANCEL: "request.cancel",
      RUNTIME_PROBE: "runtime.probe",
    }),
    events: Object.freeze({
      SUBSCRIPTION_READY: "subscription.ready",
      STATE_CHANGED: "state.changed",
      RUNTIME_CHANGED: "runtime.changed",
      REQUEST_STARTED: "request.started",
      REQUEST_FINISHED: "request.finished",
    }),
    errors: Object.freeze({
      INVALID_COMMAND: "invalid-command",
      UNKNOWN_COMMAND: "unknown-command",
      UNKNOWN_THREAD: "unknown-thread",
      EMPTY_DRAFT: "empty-draft",
      BUSY: "busy",
    }),
    runtimeStatus: Object.freeze({
      CHECKING: "checking",
      READY: "ready",
      ERROR: "error",
    }),
    limits: Object.freeze({
      maxThreadTitleLength: 80,
      generationSettings: Object.freeze({
        maxTokens: Object.freeze({
          min: 1,
          max: 2048,
          step: 1,
          default: 256,
        }),
        temperature: Object.freeze({
          min: 0,
          max: 2,
          step: 0.1,
          default: 0.7,
        }),
        topP: Object.freeze({
          min: 0,
          max: 1,
          step: 0.05,
          default: 0.8,
        }),
        topK: Object.freeze({
          min: 1,
          max: 200,
          step: 1,
          default: 20,
        }),
        presencePenalty: Object.freeze({
          min: 0,
          max: 2,
          step: 0.1,
          default: 1.5,
        }),
      }),
    }),
  });

  window.OurBoxChatContract = contract;
})();
