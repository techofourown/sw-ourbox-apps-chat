# OurBox Chat View Layer Contract Specification

**Status:** Stable  
**Contract ID:** `ourbox-chat-view-contract`  
**Contract Version:** `1.0.0`

---

## 1. Purpose

This document defines the **formal, implementation-agnostic contract** between the OurBox Chat application domain/runtime and any pluggable Web App view layer.

Any view implementation (plain HTML/JS, TypeScript + framework, Web Components, etc.) that follows this contract can be mounted on top of OurBox Chat without requiring private knowledge of the built-in UI implementation.

This specification intentionally describes:

- Data shapes.
- Runtime endpoints.
- State lifecycle.
- User-intent actions.
- Error semantics.
- Required UX guarantees.
- Compatibility and versioning rules.

This specification intentionally does **not** prescribe:

- Internal architecture patterns.
- Rendering strategy.
- Styling strategy.
- Framework selection.
- Component library selection.

---

## 2. Contract Surface

A conforming view implementation MUST honor all three surfaces:

1. **Runtime API Surface** (HTTP endpoints).
2. **State Surface** (persisted chat/thread/message model).
3. **Interaction Surface** (intent-driven operations and expected outcomes).

The runtime and state model are authoritative. The view is replaceable.

---

## 3. Runtime API Surface (Required)

### 3.1 Endpoints

A conforming view MUST use these endpoint paths by default:

- Health: `GET /health`
- Model discovery: `GET /v1/models`
- Chat generation: `POST /v1/chat/completions`

### 3.2 Health endpoint contract

`GET /health` indicates runtime liveness.

- **Success criteria:** HTTP 2xx.
- **Expected semantics:** Runtime can be considered reachable.
- **Failure semantics:** Any non-2xx or network failure means runtime unavailable.

### 3.3 Models endpoint contract

`GET /v1/models` returns OpenAI-compatible model listing semantics.

- **Success criteria:** HTTP 2xx and JSON object with `data` array.
- **Preferred model identity:** first entry `data[0].id` when available.
- **Fallback behavior:** if absent/unparseable, render a generic local model label.

### 3.4 Chat completion endpoint contract

`POST /v1/chat/completions` MUST be called with JSON content.

#### Request body (minimum)

- `messages`: ordered array of messages where each message has:
  - `role`: one of `system | user | assistant`
  - `content`: string

#### Request body (recommended defaults)

- `max_tokens`: `256`
- `temperature`: `0.7`

#### Response body (minimum consumable path)

The view MUST parse OpenAI-compatible choice shape:

- `choices[0].message.content` as assistant output text.

#### Error path

If HTTP is non-2xx OR output is missing/empty, the view MUST represent a failed generation in a user-visible way without corrupting prior messages.

---

## 4. State Surface (Required Model)

### 4.1 Persistence key

Browser-local persistence key:

- `ourbox-chat-state-v1`

### 4.2 Persisted root shape

```ts
interface PersistedState {
  contractVersion?: string; // recommended
  activeThreadId: string;
  threads: Thread[];
}
```

### 4.3 Thread shape

```ts
interface Thread {
  id: string;
  title: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  systemPrompt: string;
  draft: string;
  messages: ChatMessage[];
}
```

### 4.4 Message shape

```ts
type MessageRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string; // ISO timestamp
}
```

### 4.5 Defaults

- Default system prompt:
  - `You are OurBox Chat, a local assistant running fully on this device. Be direct, practical, and concise. Admit uncertainty when needed.`
- If persisted state is missing/invalid, the view MUST initialize a valid default state with exactly one thread and set it active.

### 4.6 Validation and migration policy

A conforming view SHOULD:

- Ignore unknown fields.
- Repair invalid partial records by applying safe defaults.
- Guarantee at least one thread exists after load.
- Guarantee active thread resolves to a valid thread.

---

## 5. Interaction Surface (Intent Contract)

The following user intents define normative behavior. UI affordances can vary, but outcomes MUST match.

### 5.1 Runtime probe intent

- Triggered at initialization (and optionally manual retry).
- MUST evaluate health + models endpoints.
- MUST expose status state machine:
  - `checking`
  - `ready`
  - `error`

### 5.2 Create thread intent

- Creates a new thread with:
  - unique id
  - default system prompt
  - empty draft
  - empty messages
  - valid timestamps
- New thread becomes active.

### 5.3 Select thread intent

- Changes active thread only.
- MUST NOT mutate other thread content.

### 5.4 Rename thread intent

- Applies trimmed title.
- Empty/blank title resolves to implementation fallback (recommended `Untitled Chat`).
- MUST update `updatedAt`.

### 5.5 Delete thread intent

- Removes active thread.
- If one thread remains, deleting MUST still leave one valid thread in state.

### 5.6 Fork thread intent

- Creates a new thread duplicating:
  - system prompt
  - draft
  - message history content
- Forked thread MUST receive new ids for thread and duplicated messages.
- Forked thread becomes active.

### 5.7 Update system prompt intent

- Updates active thread system prompt.
- Blank prompt resolves to default system prompt.
- SHOULD refresh thread `updatedAt`.

### 5.8 Update draft intent

- Updates active thread draft text.
- MUST persist without sending.

### 5.9 Send message intent

A conforming send cycle MUST execute atomically:

1. Read and trim current draft.
2. If empty, no-op.
3. Append user message to active thread.
4. Clear draft.
5. Build completion payload with one `system` message + full thread message history.
6. Mark request in-flight (UI busy state).
7. On success, append assistant reply.
8. On non-abort failure, append assistant-visible error message.
9. Clear in-flight flag.
10. Persist final state.

### 5.10 Cancel generation intent

- If request is in-flight, abort it.
- Aborted request MUST NOT append synthesized failure text unless implementation explicitly opts in.
- Busy state MUST reset.

---

## 6. Required Behavioral Guarantees

A conforming view MUST guarantee:

1. **Local-first persistence:** thread and draft state survive reload in same browser profile.
2. **Conversation integrity:** message ordering preserved.
3. **No silent data loss:** destructive actions require explicit user intent.
4. **Resilience to runtime downtime:** user can still browse/edit local state while runtime is unavailable.
5. **Deterministic active context:** exactly one active thread is addressable after each operation.

---

## 7. Error and Empty-State Semantics

### 7.1 Runtime unavailable

- View MUST show non-ready runtime status.
- View SHOULD provide actionable copy (for example, retry/refresh guidance).

### 7.2 Empty conversation

- If active thread has no messages, view SHOULD render an explicit empty conversation state.

### 7.3 Generation errors

- Any failed generation (excluding clean abort) SHOULD produce user-visible diagnostic output in conversation context.

---

## 8. Accessibility and Input Expectations

A conforming view SHOULD include:

- Keyboard path for send action.
- Distinct labels for user vs assistant messages.
- Explicit controls for create/rename/fork/delete/send/cancel.
- Focus management on dialog-like interactions.

These are conformance recommendations for cross-implementation parity.

---

## 9. Public Contract Constants

The Web UI publishes a browser-global contract object:

```ts
window.OurBoxChatViewContract
```

Current published fields:

- `version` (`"1.0.0"`)
- `storageKey` (`"ourbox-chat-state-v1"`)
- `defaultSystemPrompt` (string)
- `messageRole` (`USER`, `ASSISTANT`, `SYSTEM` constants)
- `runtimeStatus` (`CHECKING`, `READY`, `ERROR` constants)
- `endpoints` (`HEALTH`, `MODELS`, `CHAT_COMPLETIONS`)
- `limits` (`MAX_THREAD_TITLE_LENGTH`, `DEFAULT_MAX_TOKENS`, `DEFAULT_TEMPERATURE`)
- `stateSchema` (descriptive schema metadata)

A custom view MAY consume these constants directly to avoid duplicating literals.

---

## 10. Versioning and Compatibility

### 10.1 Semantic intent

- Patch updates: non-breaking clarifications.
- Minor updates: additive, backwards-compatible fields/intents.
- Major updates: breaking changes to required fields/semantics.

### 10.2 Compatibility rule

Any view targeting contract `1.x` MUST continue functioning with future `1.y` additions by ignoring unknown fields.

---

## 11. Conformance Checklist

A view implementation is considered conformant when all are true:

- [ ] Uses the required runtime endpoints.
- [ ] Persists and restores state using the contract model.
- [ ] Supports all required intents.
- [ ] Preserves message order and thread integrity.
- [ ] Handles runtime unavailable and generation failure states.
- [ ] Maintains one valid active thread at all times.

---

## 12. Non-Normative Notes

- Any framework is acceptable.
- Rendering/animation differences are acceptable.
- Additional capabilities are acceptable if they do not violate required behaviors.

