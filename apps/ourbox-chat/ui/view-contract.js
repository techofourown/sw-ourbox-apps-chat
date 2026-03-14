(function () {
  const VIEW_CONTRACT_VERSION = "1.0.0";
  const STORAGE_KEY = "ourbox-chat-state-v1";
  const DEFAULT_SYSTEM_PROMPT =
    "You are OurBox Chat, a local assistant running fully on this device. " +
    "Be direct, practical, and concise. Admit uncertainty when needed.";

  const MESSAGE_ROLE = Object.freeze({
    USER: "user",
    ASSISTANT: "assistant",
    SYSTEM: "system",
  });

  const RUNTIME_STATUS = Object.freeze({
    CHECKING: "checking",
    READY: "ready",
    ERROR: "error",
  });

  const ENDPOINTS = Object.freeze({
    HEALTH: "/health",
    MODELS: "/v1/models",
    CHAT_COMPLETIONS: "/v1/chat/completions",
  });

  const LIMITS = Object.freeze({
    MAX_THREAD_TITLE_LENGTH: 80,
    DEFAULT_MAX_TOKENS: 256,
    DEFAULT_TEMPERATURE: 0.7,
  });

  const stateSchema = Object.freeze({
    type: "OurBoxChatPersistedState",
    required: ["threads", "activeThreadId"],
    threadShape: {
      required: [
        "id",
        "title",
        "createdAt",
        "updatedAt",
        "systemPrompt",
        "draft",
        "messages",
      ],
      messageShape: {
        required: ["id", "role", "content", "createdAt"],
      },
    },
  });

  window.OurBoxChatViewContract = Object.freeze({
    version: VIEW_CONTRACT_VERSION,
    storageKey: STORAGE_KEY,
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    messageRole: MESSAGE_ROLE,
    runtimeStatus: RUNTIME_STATUS,
    endpoints: ENDPOINTS,
    limits: LIMITS,
    stateSchema: stateSchema,
  });
})();
