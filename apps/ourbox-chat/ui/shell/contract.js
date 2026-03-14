(function () {
  const contract = Object.freeze({
    id: "ourbox-chat.view-layer",
    version: "1.0.0",
    browserEventName: "ourboxchat:event",
    commands: Object.freeze({
      THREAD_CREATE: "thread.create",
      THREAD_SELECT: "thread.select",
      THREAD_RENAME: "thread.rename",
      THREAD_FORK: "thread.fork",
      THREAD_DELETE: "thread.delete",
      THREAD_DRAFT_SET: "thread.draft.set",
      THREAD_SYSTEM_PROMPT_SET: "thread.system-prompt.set",
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
    }),
  });

  window.OurBoxChatContract = contract;
})();
