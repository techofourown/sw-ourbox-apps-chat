# OurBox Chat View Layer Contract (Web App)

## 1. Purpose and Scope

This document defines the **normative contract** between:

1. the OurBox Chat application core (model + runtime integration), and
2. any interchangeable web-based view layer.

A view implementation that follows this contract can be mounted on top of the
application without requiring implementation-specific coupling.

This contract is intentionally implementation-agnostic. It specifies:

- required domain objects,
- required commands and events,
- transport assumptions,
- lifecycle and state transitions,
- error and cancellation behavior,
- accessibility and compatibility minimums.

It does **not** prescribe styling, framework choice, or internal architecture of
an implementation.

---

## 2. Definitions

- **Core**: the application logic that owns chat state, persistence, and runtime I/O.
- **View**: any UI implementation (HTML/CSS/TS, framework-based SPA, or other web UI)
  that renders state and dispatches user intents.
- **Thread**: a saved conversation with metadata, system prompt, draft, and message list.
- **Message**: one conversational turn with role + content + metadata.
- **Session state**: the complete serializable state required to restore all threads and
  the active thread.
- **Runtime**: local model server exposed through OpenAI-compatible HTTP routes.

---

## 3. Contract Versioning

- **Contract ID**: `ourbox-chat.view-layer`
- **Contract Version**: `1.0.0`
- **Versioning policy**:
  - Patch (`1.0.x`): editorial clarifications only, no behavioral changes.
  - Minor (`1.x.0`): backward-compatible additions (new optional fields/events/commands).
  - Major (`x.0.0`): breaking changes to existing command/event/state semantics.

A compliant core implementation **must** expose its contract id + version at initialization
(see [Section 7](#7-initialization-handshake)).

---

## 4. Architecture Boundary

A view implementation integrates through a single logical adapter:

```ts
interface OurBoxChatAdapter {
  readonly contract: {
    id: 'ourbox-chat.view-layer';
    version: string;
  };

  initialize(): Promise<BootstrapState>;
  dispatch(command: ViewCommand): Promise<DispatchResult>;
  subscribe(listener: (event: CoreEvent) => void): Unsubscribe;
  snapshot(): ViewState;
}
```

The adapter contract is normative; names may vary per language/framework as long as
behavior is equivalent.

### 4.1 Adapter Responsibilities

The adapter must:

- act as the source of truth for state,
- validate and normalize persisted data before emission,
- serialize runtime requests,
- guarantee deterministic event ordering,
- provide cancellation for in-flight generation,
- publish immutable snapshots.

The view must:

- treat `snapshot()` output as read-only,
- render according to current state,
- send all mutations as explicit commands,
- tolerate late/duplicate events idempotently.

---

## 5. Domain Model (Normative)

## 5.1 Primitive Types

```ts
type ISODateTime = string; // RFC 3339 / ISO-8601 UTC timestamp
type ThreadId = string;
type MessageId = string;
```

## 5.2 Runtime Status

```ts
type RuntimeStatusKind = 'checking' | 'ready' | 'error';

interface RuntimeStatus {
  kind: RuntimeStatusKind;
  message: string;
  modelName: string;
}
```

## 5.3 Messages

```ts
type MessageRole = 'user' | 'assistant';

interface ChatMessage {
  id: MessageId;
  role: MessageRole;
  content: string;
  createdAt: ISODateTime;
}
```

## 5.4 Threads

```ts
interface ChatThread {
  id: ThreadId;
  title: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  systemPrompt: string;
  draft: string;
  messages: ChatMessage[];
}
```

## 5.5 Global View State

```ts
interface ViewState {
  contract: {
    id: 'ourbox-chat.view-layer';
    version: string;
  };
  threads: ChatThread[];
  activeThreadId: ThreadId;
  request: {
    inFlight: boolean;
    threadId: ThreadId | null;
  };
  runtime: RuntimeStatus;
}
```

### 5.6 Required Invariants

1. `threads.length >= 1` always.
2. `activeThreadId` must match an existing thread id.
3. Every thread id and message id is unique within the snapshot.
4. `updatedAt >= createdAt` for each thread.
5. `request.inFlight === true` implies `request.threadId !== null`.
6. Only one generation request may be active at any time.
7. `systemPrompt` must be non-empty after normalization.

---

## 6. Persistence Contract

The core must persist and restore a serializable session state:

```ts
interface PersistedSessionV1 {
  threads: ChatThread[];
  activeThreadId: ThreadId;
}
```

### 6.1 Restore Normalization Rules

On restore, core must:

- discard malformed thread records,
- coerce unknown message roles to `'user'` unless explicitly `'assistant'`,
- populate missing ids/timestamps,
- ensure at least one default thread exists,
- ensure active thread fallback to first valid thread.

Views must not rely on persistence backend specifics (e.g., `localStorage` key names).

---

## 7. Initialization Handshake

`initialize()` must:

1. hydrate persisted session state,
2. emit baseline state,
3. begin runtime probe,
4. emit runtime status updates.

Expected minimum event sequence:

1. `core.initialized`
2. `state.changed` (hydrated session)
3. `runtime.status.changed` (`checking` -> `ready` or `error`)

A view may call `snapshot()` at any time after `initialize()` resolves.

---

## 8. Command Contract (View -> Core)

All mutations occur via `dispatch(command)`.

```ts
type ViewCommand =
  | { type: 'thread.create' }
  | { type: 'thread.select'; threadId: ThreadId }
  | { type: 'thread.rename'; threadId: ThreadId; title: string }
  | { type: 'thread.fork'; threadId: ThreadId }
  | { type: 'thread.delete'; threadId: ThreadId }
  | { type: 'thread.systemPrompt.set'; threadId: ThreadId; systemPrompt: string }
  | { type: 'thread.draft.set'; threadId: ThreadId; draft: string }
  | { type: 'request.send'; threadId: ThreadId }
  | { type: 'request.cancel' }
  | { type: 'runtime.probe' };
```

### 8.1 Command Semantics

- `thread.create`: create empty thread, make active.
- `thread.select`: make target thread active.
- `thread.rename`: trim title; fallback to `Untitled Chat` when empty.
- `thread.fork`: duplicate thread content into new thread with new ids.
- `thread.delete`: delete thread; if it was last thread, create replacement default thread.
- `thread.systemPrompt.set`: normalize empty value to default system prompt.
- `thread.draft.set`: replace draft verbatim (may be empty).
- `request.send`: append user draft as user message, clear draft, issue model completion,
  append assistant response or assistant error message.
- `request.cancel`: abort active completion if present.
- `runtime.probe`: refresh runtime availability and model metadata.

### 8.2 Send Preconditions

`request.send` must be ignored (no-op) when:

- no active request target matches command thread,
- draft is empty after trim,
- a request is already in flight.

### 8.3 Dispatch Result

```ts
interface DispatchResult {
  accepted: boolean;
  reason?:
    | 'busy'
    | 'invalid-command'
    | 'unknown-thread'
    | 'empty-draft'
    | 'runtime-unavailable';
}
```

---

## 9. Event Contract (Core -> View)

```ts
type CoreEvent =
  | { type: 'core.initialized' }
  | { type: 'state.changed'; state: ViewState; cause: EventCause }
  | { type: 'runtime.status.changed'; runtime: RuntimeStatus }
  | { type: 'request.started'; threadId: ThreadId }
  | { type: 'request.finished'; threadId: ThreadId; outcome: 'success' | 'error' | 'aborted' }
  | { type: 'error'; code: ErrorCode; message: string; recoverable: boolean };

type EventCause =
  | 'hydrate'
  | 'thread.create'
  | 'thread.select'
  | 'thread.rename'
  | 'thread.fork'
  | 'thread.delete'
  | 'thread.systemPrompt.set'
  | 'thread.draft.set'
  | 'request.send'
  | 'request.cancel'
  | 'runtime.probe';

type ErrorCode =
  | 'E_UNKNOWN_THREAD'
  | 'E_RUNTIME_HEALTH'
  | 'E_RUNTIME_MODELS'
  | 'E_RUNTIME_COMPLETION'
  | 'E_ABORTED'
  | 'E_PERSISTENCE_READ'
  | 'E_PERSISTENCE_WRITE'
  | 'E_INTERNAL';
```

### 9.1 Event Ordering Guarantees

For each accepted command, event order must be:

1. zero or one domain-specific events (`request.started`, etc.),
2. one `state.changed`,
3. optional `error`.

For send flow, required order:

1. `request.started`
2. `state.changed` (user message appended, pending request reflected)
3. completion path:
   - success: `request.finished(success)` then `state.changed`
   - runtime/model error: `error` then `request.finished(error)` then `state.changed`
   - abort: `request.finished(aborted)` then `state.changed`

---

## 10. Runtime HTTP Interop Contract

Core runtime communication must remain OpenAI-compatible for chat completion.

### 10.1 Health Probe

- `GET /health`
- success criterion: HTTP 2xx

### 10.2 Model Discovery

- `GET /v1/models`
- success criterion: HTTP 2xx + JSON response
- preferred model name: first entry at `data[0].id`

### 10.3 Completion Request

- `POST /v1/chat/completions`
- request JSON:

```json
{
  "messages": [{ "role": "system", "content": "..." }, { "role": "user", "content": "..." }],
  "max_tokens": 256,
  "temperature": 0.7
}
```

- success criterion: HTTP 2xx + non-empty `choices[0].message.content`

### 10.4 Cancellation

Cancellation must use request abort semantics (e.g., `AbortController` in web runtime)
so that view action can stop in-flight generation quickly.

---

## 11. View Requirements (Compliance)

A compliant view implementation must:

1. render all threads and active-thread details from `ViewState` only,
2. disable conflicting controls while `request.inFlight === true`,
3. present runtime status + model identity,
4. render pending generation state,
5. preserve multiline drafting,
6. support create/select/rename/fork/delete workflows,
7. support per-thread system prompt editing,
8. support send + cancel,
9. tolerate adapter reconnect or reinitialization idempotently.

Recommended but non-mandatory:

- optimistic UI for lightweight commands,
- keyboard submit (`Enter`) with newline modifier support,
- transcript auto-scroll to newest message when appropriate,
- truncation-safe thread summaries,
- confirmation UX before destructive delete.

---

## 12. Accessibility Requirements (Minimum)

Views should provide at least:

- labeled controls for all interactive elements,
- visible focus indicators,
- keyboard-only operability for all commands,
- polite live region behavior for transcript updates,
- clear status messaging for runtime unavailable/error states,
- semantic grouping for thread list, message list, and composer.

---

## 13. Security and Privacy Guarantees

A compliant view must assume and preserve these guarantees:

- conversation state is local to the user agent storage context,
- runtime calls target the local bundled model service,
- no contract requirement exists for external telemetry,
- view implementations must not silently exfiltrate prompts/messages.

If a view adds analytics or remote integrations, it must do so explicitly and out-of-band
from this contract.

---

## 14. Reference TypeScript Facade (Optional)

```ts
export type Unsubscribe = () => void;

export interface OurBoxChatViewLayerContract {
  readonly contract: {
    id: 'ourbox-chat.view-layer';
    version: string;
  };
  initialize(): Promise<BootstrapState>;
  dispatch(command: ViewCommand): Promise<DispatchResult>;
  subscribe(listener: (event: CoreEvent) => void): Unsubscribe;
  snapshot(): ViewState;
}

export interface BootstrapState {
  state: ViewState;
  runtime: RuntimeStatus;
}
```

This facade is illustrative and non-binding; any implementation is acceptable if
behavior matches Sections 4 through 13.

---

## 15. Compliance Checklist

A new view implementation can claim `ourbox-chat.view-layer@1.0.0` compatibility when it:

- [ ] Integrates through adapter lifecycle (`initialize`, `dispatch`, `subscribe`, `snapshot`).
- [ ] Implements all command types in Section 8.
- [ ] Handles all required events in Section 9.
- [ ] Honors invariants in Section 5.6.
- [ ] Supports send/cancel semantics and in-flight UI locking.
- [ ] Surfaces runtime probe/model status.
- [ ] Meets accessibility minimums in Section 12.

