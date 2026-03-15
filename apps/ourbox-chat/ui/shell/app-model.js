(function () {
  const contract = window.OurBoxChatContract;
  if (!contract) {
    throw new Error("OurBox Chat contract must load before the app model.");
  }

  const STORAGE_KEY = "ourbox-chat-state-v1";
  const STORAGE_SCHEMA = 1;
  const DEFAULT_SYSTEM_PROMPT =
    "You are OurBox Chat, a local assistant running fully on this device. " +
    "You do not have internet access or external tools in this app. " +
    "Be direct, practical, and concise. Admit uncertainty when needed.";
  const DEFAULT_RUNTIME_MESSAGE = "Connecting to the bundled local model server.";
  const DEFAULT_READY_MESSAGE = "Bundled model server is online and ready.";
  const DEFAULT_ERROR_MESSAGE =
    "The local model server is not responding yet. Refresh after the model finishes loading.";
  const DEFAULT_MODEL_NAME = "Loading";
  const UNAVAILABLE_MODEL_NAME = "Unavailable";
  const FALLBACK_MODEL_NAME = "Bundled local model";
  const COMPLETION_DEFAULTS = Object.freeze({
    max_tokens: 256,
    temperature: 0.7,
    top_p: 0.8,
    top_k: 20,
    min_p: 0,
    presence_penalty: 1.5,
  });
  const ENDPOINTS = Object.freeze({
    health: "/health",
    models: "/v1/models",
    chat: "/v1/chat/completions",
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + "-" + window.crypto.randomUUID();
    }

    return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function formatThreadTitle(date) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function clampTitle(value) {
    const cleaned = String(value || "").trim();
    const fallback = "Untitled Chat";

    if (!cleaned) {
      return fallback;
    }

    if (cleaned.length <= contract.limits.maxThreadTitleLength) {
      return cleaned;
    }

    return cleaned.slice(0, contract.limits.maxThreadTitleLength).trimEnd() || fallback;
  }

  function createMessage(seed, fallbackCreatedAt) {
    return {
      id: seed && seed.id ? String(seed.id) : makeId("message"),
      role: seed && seed.role === "assistant" ? "assistant" : "user",
      content: seed && typeof seed.content === "string" ? seed.content : "",
      createdAt:
        seed && typeof seed.createdAt === "string" ? seed.createdAt : fallbackCreatedAt || nowIso(),
    };
  }

  function createThread(seed) {
    const createdAt = nowIso();
    const title =
      seed && seed.title
        ? clampTitle(seed.title)
        : "Chat " + formatThreadTitle(new Date());

    return {
      id: seed && seed.id ? String(seed.id) : makeId("thread"),
      title: title,
      createdAt: createdAt,
      updatedAt: createdAt,
      systemPrompt:
        seed && typeof seed.systemPrompt === "string" && seed.systemPrompt.trim()
          ? seed.systemPrompt
          : DEFAULT_SYSTEM_PROMPT,
      draft: seed && typeof seed.draft === "string" ? seed.draft : "",
      messages:
        seed && Array.isArray(seed.messages)
          ? seed.messages.map(function (message) {
              return createMessage(message, createdAt);
            })
          : [],
    };
  }

  function defaultStoredState() {
    const thread = createThread();
    return {
      threads: [thread],
      activeThreadId: thread.id,
    };
  }

  function normalizeThread(candidate) {
    if (!candidate || !Array.isArray(candidate.messages)) {
      return null;
    }

    const createdAt =
      typeof candidate.createdAt === "string" ? candidate.createdAt : nowIso();
    const updatedAt =
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : createdAt;

    return {
      id: candidate.id ? String(candidate.id) : makeId("thread"),
      title: clampTitle(candidate.title || "Untitled Chat"),
      createdAt: createdAt,
      updatedAt: updatedAt,
      systemPrompt:
        typeof candidate.systemPrompt === "string" && candidate.systemPrompt.trim()
          ? candidate.systemPrompt
          : DEFAULT_SYSTEM_PROMPT,
      draft: typeof candidate.draft === "string" ? candidate.draft : "",
      messages: candidate.messages.map(function (message) {
        return createMessage(message, createdAt);
      }),
    };
  }

  function loadStoredState(storage) {
    if (!storage) {
      return defaultStoredState();
    }

    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultStoredState();
      }

      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        (parsed.schema !== undefined && parsed.schema !== STORAGE_SCHEMA) ||
        !Array.isArray(parsed.threads) ||
        !parsed.threads.length
      ) {
        return defaultStoredState();
      }

      const threads = parsed.threads
        .map(normalizeThread)
        .filter(function (thread) {
          return thread !== null;
        });

      if (!threads.length) {
        return defaultStoredState();
      }

      return {
        threads: threads,
        activeThreadId:
          typeof parsed.activeThreadId === "string" ? parsed.activeThreadId : threads[0].id,
      };
    } catch (error) {
      console.error("failed to load saved OurBox Chat state", error);
      return defaultStoredState();
    }
  }

  function sortThreads(threads) {
    threads.sort(function (left, right) {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }

  function cloneMessage(message) {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  function cloneThread(thread) {
    return {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      systemPrompt: thread.systemPrompt,
      draft: thread.draft,
      messages: thread.messages.map(cloneMessage),
    };
  }

  window.createOurBoxChatApp = function createOurBoxChatApp(options) {
    const config = options || {};
    const storage =
      config.storage !== undefined
        ? config.storage
        : typeof window.localStorage !== "undefined"
          ? window.localStorage
          : null;
    const fetchImpl =
      typeof config.fetch === "function"
        ? config.fetch
        : typeof window.fetch === "function"
          ? window.fetch.bind(window)
          : null;

    const restored = loadStoredState(storage);
    sortThreads(restored.threads);

    const state = {
      threads: restored.threads,
      activeThreadId: restored.activeThreadId,
      runtime: {
        status: contract.runtimeStatus.CHECKING,
        message: DEFAULT_RUNTIME_MESSAGE,
        modelName: DEFAULT_MODEL_NAME,
      },
      request: {
        inFlight: false,
        threadId: null,
      },
      requestController: null,
      destroyed: false,
    };
    const listeners = new Set();

    function touchThread(thread) {
      thread.updatedAt = nowIso();
    }

    function findThread(threadId) {
      return state.threads.find(function (thread) {
        return thread.id === threadId;
      }) || null;
    }

    function ensureActiveThread() {
      let activeThread = findThread(state.activeThreadId);
      if (activeThread) {
        return activeThread;
      }

      if (!state.threads.length) {
        const replacement = createThread();
        state.threads = [replacement];
        state.activeThreadId = replacement.id;
        return replacement;
      }

      sortThreads(state.threads);
      state.activeThreadId = state.threads[0].id;
      return state.threads[0];
    }

    function persistState() {
      if (!storage) {
        return;
      }

      try {
        storage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            schema: STORAGE_SCHEMA,
            activeThreadId: state.activeThreadId,
            threads: state.threads,
          })
        );
      } catch (error) {
        console.error("failed to persist OurBox Chat state", error);
      }
    }

    function getPublicState() {
      const activeThread = ensureActiveThread();
      sortThreads(state.threads);

      return {
        contract: {
          id: contract.id,
          version: contract.version,
        },
        runtime: {
          status: state.runtime.status,
          message: state.runtime.message,
          modelName: state.runtime.modelName,
        },
        request: {
          inFlight: state.request.inFlight,
          threadId: state.request.threadId,
        },
        activeThreadId: activeThread.id,
        activeThread: cloneThread(activeThread),
        threads: state.threads.map(cloneThread),
      };
    }

    function emit(type, cause, detail) {
      const event = {
        type: type,
        at: nowIso(),
        cause: cause || null,
        detail: detail || null,
        state: getPublicState(),
      };

      listeners.forEach(function (listener) {
        listener(event);
      });

      publishBrowserEvent(event);

      return event;
    }

    function publishBrowserEvent(event) {
      if (typeof window.CustomEvent !== "function") {
        return;
      }

      window.dispatchEvent(
        new window.CustomEvent(contract.browserEventName, {
          detail: event,
        })
      );
    }

    function acceptedResult() {
      return {
        ok: true,
        state: getPublicState(),
      };
    }

    function rejectedResult(code, detail) {
      return {
        ok: false,
        code: code,
        detail: detail || null,
        state: getPublicState(),
      };
    }

    function unknownThreadResult(threadId) {
      return rejectedResult(contract.errors.UNKNOWN_THREAD, {
        threadId: threadId || null,
      });
    }

    function maybeRetitleThread(thread, messageContent) {
      if (thread.messages.length !== 1) {
        return;
      }

      if (!thread.title.startsWith("Chat ")) {
        return;
      }

      const compact = messageContent.replace(/\s+/g, " ").trim();
      if (!compact) {
        return;
      }

      thread.title = compact.length > 40 ? compact.slice(0, 37) + "..." : compact;
    }

    function flattenMessageContent(content) {
      if (typeof content === "string") {
        return content;
      }

      if (!Array.isArray(content)) {
        return "";
      }

      return content
        .map(function (part) {
          if (typeof part === "string") {
            return part;
          }

          if (!part || typeof part !== "object") {
            return "";
          }

          if (typeof part.text === "string") {
            return part.text;
          }

          return "";
        })
        .join("");
    }

    function stripLeadingThinkBlocks(value) {
      let text = String(value || "");

      for (;;) {
        const trimmed = text.trimStart();
        if (!trimmed.startsWith("<think>")) {
          return trimmed.trim();
        }

        const closeIndex = trimmed.indexOf("</think>");
        if (closeIndex === -1) {
          return trimmed.replace(/^<think>/, "").trim();
        }

        text = trimmed.slice(closeIndex + "</think>".length);
      }
    }

    function extractAssistantReply(payload) {
      const choice = payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
      const message = choice && choice.message ? choice.message : null;

      if (!message) {
        return "";
      }

      return stripLeadingThinkBlocks(flattenMessageContent(message.content));
    }

    function buildChatPayload(thread) {
      return {
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
        max_tokens: COMPLETION_DEFAULTS.max_tokens,
        temperature: COMPLETION_DEFAULTS.temperature,
        top_p: COMPLETION_DEFAULTS.top_p,
        top_k: COMPLETION_DEFAULTS.top_k,
        min_p: COMPLETION_DEFAULTS.min_p,
        presence_penalty: COMPLETION_DEFAULTS.presence_penalty,
      };
    }

    function updateRuntime(nextRuntime, cause, detail) {
      if (state.destroyed) {
        return;
      }

      const changed =
        state.runtime.status !== nextRuntime.status ||
        state.runtime.message !== nextRuntime.message ||
        state.runtime.modelName !== nextRuntime.modelName;

      state.runtime.status = nextRuntime.status;
      state.runtime.message = nextRuntime.message;
      state.runtime.modelName = nextRuntime.modelName;

      if (changed) {
        emit(contract.events.RUNTIME_CHANGED, cause, detail || null);
        emit(contract.events.STATE_CHANGED, cause, detail || null);
      }
    }

    async function probeRuntime(cause) {
      if (!fetchImpl) {
        updateRuntime(
          {
            status: contract.runtimeStatus.ERROR,
            message: DEFAULT_ERROR_MESSAGE,
            modelName: UNAVAILABLE_MODEL_NAME,
          },
          cause,
          {
            status: contract.runtimeStatus.ERROR,
            reason: "fetch-unavailable",
          }
        );
        return;
      }

      updateRuntime(
        {
          status: contract.runtimeStatus.CHECKING,
          message: DEFAULT_RUNTIME_MESSAGE,
          modelName:
            state.runtime.modelName === UNAVAILABLE_MODEL_NAME
              ? DEFAULT_MODEL_NAME
              : state.runtime.modelName,
        },
        cause,
        {
          status: contract.runtimeStatus.CHECKING,
        }
      );

      try {
        const healthResponse = await fetchImpl(ENDPOINTS.health, {
          cache: "no-store",
        });
        if (!healthResponse.ok) {
          throw new Error("health endpoint returned " + healthResponse.status);
        }

        const modelsResponse = await fetchImpl(ENDPOINTS.models, {
          cache: "no-store",
        });
        if (!modelsResponse.ok) {
          throw new Error("model listing returned " + modelsResponse.status);
        }

        const models = await modelsResponse.json();
        const modelName =
          models &&
          Array.isArray(models.data) &&
          models.data[0] &&
          typeof models.data[0].id === "string"
            ? models.data[0].id
            : FALLBACK_MODEL_NAME;

        updateRuntime(
          {
            status: contract.runtimeStatus.READY,
            message: DEFAULT_READY_MESSAGE,
            modelName: modelName,
          },
          cause,
          {
            status: contract.runtimeStatus.READY,
            modelName: modelName,
          }
        );
      } catch (error) {
        console.error("runtime probe failed", error);
        updateRuntime(
          {
            status: contract.runtimeStatus.ERROR,
            message: DEFAULT_ERROR_MESSAGE,
            modelName: UNAVAILABLE_MODEL_NAME,
          },
          cause,
          {
            status: contract.runtimeStatus.ERROR,
            reason: error && error.message ? error.message : "runtime-probe-failed",
          }
        );
      }
    }

    function clearRequestState(controller) {
      if (state.requestController !== controller) {
        return false;
      }

      state.requestController = null;
      state.request.inFlight = false;
      state.request.threadId = null;
      return true;
    }

    async function completeRequest(context) {
      try {
        const response = await fetchImpl(ENDPOINTS.chat, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(context.payload),
          signal: context.controller.signal,
        });

        if (!response.ok) {
          throw new Error("generation failed with status " + response.status);
        }

        const data = await response.json();
        const content = extractAssistantReply(data);

        if (!content) {
          throw new Error("generation returned an empty reply");
        }

        const thread = findThread(context.threadId);
        if (thread) {
          thread.messages.push({
            id: makeId("message"),
            role: "assistant",
            content: content,
            createdAt: nowIso(),
          });
          touchThread(thread);
          sortThreads(state.threads);
          persistState();
        }

        if (!clearRequestState(context.controller) || state.destroyed) {
          return;
        }

        emit(contract.events.REQUEST_FINISHED, context.cause, {
          threadId: context.threadId,
          outcome: "success",
        });
        emit(contract.events.STATE_CHANGED, context.cause, {
          threadId: context.threadId,
          outcome: "success",
        });
      } catch (error) {
        const aborted = error && error.name === "AbortError";
        const thread = findThread(context.threadId);

        if (!aborted && thread) {
          thread.messages.push({
            id: makeId("message"),
            role: "assistant",
            content:
              "The local model could not complete this request. " +
              "Check that the model is ready and try again.\n\n" +
              "Details: " +
              (error && error.message ? error.message : "unknown error"),
            createdAt: nowIso(),
          });
          touchThread(thread);
          sortThreads(state.threads);
          persistState();
        }

        if (!clearRequestState(context.controller) || state.destroyed) {
          return;
        }

        emit(contract.events.REQUEST_FINISHED, context.cause, {
          threadId: context.threadId,
          outcome: aborted ? "aborted" : "error",
          error: aborted ? null : error && error.message ? error.message : "unknown error",
        });
        emit(contract.events.STATE_CHANGED, context.cause, {
          threadId: context.threadId,
          outcome: aborted ? "aborted" : "error",
        });
      }
    }

    async function dispatch(command) {
      if (state.destroyed) {
        return rejectedResult(contract.errors.INVALID_COMMAND, {
          reason: "app-destroyed",
        });
      }

      if (!command || typeof command !== "object" || typeof command.type !== "string") {
        return rejectedResult(contract.errors.INVALID_COMMAND, {
          reason: "command-must-be-an-object-with-a-type",
        });
      }

      switch (command.type) {
        case contract.commands.THREAD_CREATE: {
          if (state.request.inFlight) {
            return rejectedResult(contract.errors.BUSY, {
              type: command.type,
            });
          }

          const thread = createThread();
          state.threads.unshift(thread);
          sortThreads(state.threads);
          state.activeThreadId = thread.id;
          persistState();
          emit(contract.events.STATE_CHANGED, command.type, {
            threadId: thread.id,
          });
          return acceptedResult();
        }

        case contract.commands.THREAD_SELECT: {
          const threadId =
            command.threadId && typeof command.threadId === "string" ? command.threadId : null;
          const thread = threadId ? findThread(threadId) : null;
          if (!thread) {
            return unknownThreadResult(threadId);
          }

          if (state.activeThreadId !== thread.id) {
            state.activeThreadId = thread.id;
            emit(contract.events.STATE_CHANGED, command.type, {
              threadId: thread.id,
            });
          }

          return acceptedResult();
        }

        case contract.commands.THREAD_RENAME: {
          const threadId =
            command.threadId && typeof command.threadId === "string" ? command.threadId : null;
          const thread = threadId ? findThread(threadId) : null;
          if (!thread) {
            return unknownThreadResult(threadId);
          }

          thread.title = clampTitle(command.title);
          touchThread(thread);
          sortThreads(state.threads);
          persistState();
          emit(contract.events.STATE_CHANGED, command.type, {
            threadId: thread.id,
          });
          return acceptedResult();
        }

        case contract.commands.THREAD_FORK: {
          if (state.request.inFlight) {
            return rejectedResult(contract.errors.BUSY, {
              type: command.type,
            });
          }

          const threadId =
            command.threadId && typeof command.threadId === "string" ? command.threadId : null;
          const thread = threadId ? findThread(threadId) : null;
          if (!thread) {
            return unknownThreadResult(threadId);
          }

          const forkedThread = createThread({
            title: thread.title + " Fork",
            systemPrompt: thread.systemPrompt,
            draft: thread.draft,
            messages: thread.messages,
          });
          state.threads.unshift(forkedThread);
          sortThreads(state.threads);
          state.activeThreadId = forkedThread.id;
          persistState();
          emit(contract.events.STATE_CHANGED, command.type, {
            threadId: forkedThread.id,
            sourceThreadId: thread.id,
          });
          return acceptedResult();
        }

        case contract.commands.THREAD_DELETE: {
          if (state.request.inFlight) {
            return rejectedResult(contract.errors.BUSY, {
              type: command.type,
            });
          }

          const threadId =
            command.threadId && typeof command.threadId === "string" ? command.threadId : null;
          const thread = threadId ? findThread(threadId) : null;
          if (!thread) {
            return unknownThreadResult(threadId);
          }

          if (state.threads.length === 1) {
            const replacement = createThread();
            state.threads = [replacement];
            state.activeThreadId = replacement.id;
            persistState();
            emit(contract.events.STATE_CHANGED, command.type, {
              deletedThreadId: thread.id,
              threadId: replacement.id,
            });
            return acceptedResult();
          }

          state.threads = state.threads.filter(function (candidate) {
            return candidate.id !== thread.id;
          });
          sortThreads(state.threads);
          if (state.activeThreadId === thread.id || !findThread(state.activeThreadId)) {
            state.activeThreadId = state.threads[0].id;
          }
          persistState();
          emit(contract.events.STATE_CHANGED, command.type, {
            deletedThreadId: thread.id,
            threadId: state.activeThreadId,
          });
          return acceptedResult();
        }

        case contract.commands.THREAD_DRAFT_SET: {
          const threadId =
            command.threadId && typeof command.threadId === "string" ? command.threadId : null;
          const thread = threadId ? findThread(threadId) : null;
          if (!thread) {
            return unknownThreadResult(threadId);
          }

          thread.draft = typeof command.draft === "string" ? command.draft : "";
          persistState();
          emit(contract.events.STATE_CHANGED, command.type, {
            threadId: thread.id,
          });
          return acceptedResult();
        }

        case contract.commands.THREAD_SYSTEM_PROMPT_SET: {
          const threadId =
            command.threadId && typeof command.threadId === "string" ? command.threadId : null;
          const thread = threadId ? findThread(threadId) : null;
          if (!thread) {
            return unknownThreadResult(threadId);
          }

          thread.systemPrompt =
            typeof command.systemPrompt === "string" && command.systemPrompt.trim()
              ? command.systemPrompt
              : DEFAULT_SYSTEM_PROMPT;
          touchThread(thread);
          sortThreads(state.threads);
          persistState();
          emit(contract.events.STATE_CHANGED, command.type, {
            threadId: thread.id,
          });
          return acceptedResult();
        }

        case contract.commands.REQUEST_SEND: {
          if (state.request.inFlight) {
            return rejectedResult(contract.errors.BUSY, {
              type: command.type,
            });
          }

          const threadId =
            command.threadId && typeof command.threadId === "string" ? command.threadId : null;
          const thread = threadId ? findThread(threadId) : null;
          if (!thread) {
            return unknownThreadResult(threadId);
          }

          const rawContent =
            typeof command.content === "string" ? command.content : thread.draft;
          const content = rawContent.trim();
          if (!content) {
            return rejectedResult(contract.errors.EMPTY_DRAFT, {
              threadId: thread.id,
            });
          }

          thread.messages.push({
            id: makeId("message"),
            role: "user",
            content: content,
            createdAt: nowIso(),
          });
          thread.draft = "";
          maybeRetitleThread(thread, content);
          touchThread(thread);
          sortThreads(state.threads);
          persistState();

          if (!fetchImpl) {
            thread.messages.push({
              id: makeId("message"),
              role: "assistant",
              content:
                "The local model could not complete this request. " +
                "Check that the model is ready and try again.\n\n" +
                "Details: fetch is unavailable in this browser.",
              createdAt: nowIso(),
            });
            touchThread(thread);
            sortThreads(state.threads);
            persistState();
            emit(contract.events.STATE_CHANGED, command.type, {
              threadId: thread.id,
              outcome: "error",
            });
            return acceptedResult();
          }

          const controller = new AbortController();
          const payload = buildChatPayload(thread);
          state.request.inFlight = true;
          state.request.threadId = thread.id;
          state.requestController = controller;

          emit(contract.events.REQUEST_STARTED, command.type, {
            threadId: thread.id,
          });
          emit(contract.events.STATE_CHANGED, command.type, {
            threadId: thread.id,
          });

          void completeRequest({
            threadId: thread.id,
            payload: payload,
            controller: controller,
            cause: command.type,
          });

          return acceptedResult();
        }

        case contract.commands.REQUEST_CANCEL: {
          if (state.requestController) {
            state.requestController.abort();
          }

          return acceptedResult();
        }

        case contract.commands.RUNTIME_PROBE: {
          void probeRuntime(command.type);
          return acceptedResult();
        }

        default:
          return rejectedResult(contract.errors.UNKNOWN_COMMAND, {
            type: command.type,
          });
      }
    }

    function subscribe(listener) {
      if (typeof listener !== "function") {
        return function unsubscribeNoop() {};
      }

      listeners.add(listener);
      const event = {
        type: contract.events.SUBSCRIPTION_READY,
        at: nowIso(),
        cause: null,
        detail: {
          source: "subscribe",
        },
        state: getPublicState(),
      };
      listener(event);
      publishBrowserEvent(event);

      return function unsubscribe() {
        listeners.delete(listener);
      };
    }

    function destroy() {
      if (state.destroyed) {
        return;
      }

      state.destroyed = true;
      if (state.requestController) {
        state.requestController.abort();
      }
      listeners.clear();
    }

    ensureActiveThread();
    persistState();
    void probeRuntime(null);

    return {
      contract: {
        id: contract.id,
        version: contract.version,
      },
      constants: contract,
      getState: getPublicState,
      subscribe: subscribe,
      dispatch: dispatch,
      destroy: destroy,
    };
  };
})();
