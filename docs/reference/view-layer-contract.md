# OurBox Chat View Layer Contract (Web App Clients)

## 1) Purpose and Scope

This document defines the **normative contract** between the OurBox Chat application core and any swappable web view implementation.

A compliant view implementation may use any UI framework (or no framework), any rendering strategy, and any component architecture, as long as it honors the contract in this specification.

This contract is intentionally focused on:

- data shapes
- operations
- lifecycle expectations
- error semantics
- persistence semantics
- runtime capability signaling
- accessibility and interaction requirements relevant to cross-view interoperability

This contract intentionally does **not** require any specific implementation detail, source organization, state library, CSS strategy, component hierarchy, or transport helper implementation.

---

## 2) Contract Versioning

- **Contract name:** `ourbox-chat-view-contract`
- **Contract version:** `1.0.0`
- **Compatibility target:** any web app client that consumes the OurBox Chat runtime endpoints and persists local thread state according to this document.

### 2.1 Versioning rules

- Patch updates (`1.0.x`) MUST NOT break existing clients.
- Minor updates (`1.x.0`) MAY add optional fields and optional operations.
- Major updates (`x.0.0`, x > 1) MAY introduce breaking changes.

Clients SHOULD expose the contract version they target in developer diagnostics (console output, about panel, or build metadata).

---

## 3) Terminology

- **Core**: the chat domain logic and runtime interaction behavior.
- **View**: any UI implementation layered on top of the core behavior.
- **Thread**: one saved conversation container.
- **Message**: one user or assistant entry in a thread transcript.
- **Draft**: unsent user input associated with a thread.
- **Runtime**: local model server exposed through HTTP endpoints.

The terms **MUST**, **SHOULD**, and **MAY** are used with RFC 2119 meaning.

---

## 4) Required Capabilities

A compliant view implementation MUST support all capabilities below:

1. Load thread state from browser-local persistence.
2. Create a new thread.
3. Select an active thread.
4. Rename the active thread.
5. Fork the active thread.
6. Delete the active thread.
7. Edit per-thread system prompt.
8. Edit per-thread user draft.
9. Send a user message and append assistant response.
10. Cancel an in-flight generation request.
11. Probe runtime readiness and model identity.
12. Render runtime status (checking / ready / offline).
13. Persist all thread mutations locally.

---

## 5) Domain Types (Normative)

## 5.1 Role

```ts
type MessageRole = "user" | "assistant";
```

## 5.2 Message

```ts
interface ChatMessage {
  id: string;                // unique within client state
  role: MessageRole;         // "user" or "assistant"
  content: string;           // UTF-8 text, may contain newlines
  createdAt: string;         // ISO-8601 timestamp
}
```

Rules:

- `id` MUST be stable once created.
- `content` MUST be preserved exactly as generated/user-authored, except transport decoding.
- `createdAt` MUST be parseable as a date/time.

## 5.3 Thread

```ts
interface ChatThread {
  id: string;                // unique within client state
  title: string;             // user-visible title
  createdAt: string;         // ISO-8601 timestamp
  updatedAt: string;         // ISO-8601 timestamp
  systemPrompt: string;      // active system instruction for this thread
  draft: string;             // unsent user text
  messages: ChatMessage[];   // ordered oldest->newest
}
```

Rules:

- `messages` order MUST reflect conversation order.
- `updatedAt` MUST be updated when thread content mutates.
- `systemPrompt` MUST always resolve to a non-empty effective value (view may substitute default when input is empty).

## 5.4 Persisted Client State

```ts
interface PersistedChatState {
  threads: ChatThread[];
  activeThreadId: string;
}
```

Rules:

- At least one thread MUST exist after initialization.
- `activeThreadId` MUST point to an existing thread after normalization.

## 5.5 Runtime State

```ts
type RuntimeStatusKind = "checking" | "ready" | "error";

interface RuntimeStatus {
  kind: RuntimeStatusKind;
  message: string;   // user-facing status copy
  modelName: string; // discovered model id or fallback display value
}
```

---

## 6) Required Defaults

View implementations MUST provide defaults equivalent in behavior to the following:

- A default system prompt used when no valid thread-level prompt is present.
- A generated thread title for new threads.
- Fallback runtime model label while probing.
- Fallback runtime status copy while probing.

Exact wording MAY vary by view, but semantics MUST be equivalent.

---

## 7) Storage Contract

## 7.1 Storage medium

- Browser-local storage MUST be used for persisted thread state in standard web clients.
- An alternative local persistence layer MAY be used in a non-browser wrapper (for example embedded webview), if behavior is equivalent.

## 7.2 Storage key namespace

- Implementations SHOULD use a versioned key namespace to allow safe migrations.
- Implementations SHOULD avoid colliding with unrelated application keys.

## 7.3 Load/normalize behavior

On initialization:

1. Attempt to parse persisted state.
2. If state is missing, malformed, or empty, initialize default state with one thread.
3. Normalize each thread and message to required shape.
4. Guarantee active-thread validity.

## 7.4 Persist behavior

Every mutation to threads, messages, titles, drafts, prompts, fork/delete, and active selection MUST be persisted before the mutation is considered complete from the user standpoint.

---

## 8) Runtime HTTP Contract

The view communicates with the local model runtime via HTTP.

## 8.1 Health endpoint

- **Method:** `GET`
- **Path:** `/health`
- **Expectation:** `2xx` means runtime reachable.

Failure semantics:

- non-2xx or network error => runtime status `error`.

## 8.2 Model listing endpoint

- **Method:** `GET`
- **Path:** `/v1/models`
- **Expectation:** OpenAI-compatible response where first model id can be used as display name.

Expected response shape (minimum):

```json
{
  "data": [
    { "id": "string" }
  ]
}
```

If model id is absent, client MUST use fallback model label.

## 8.3 Chat completion endpoint

- **Method:** `POST`
- **Path:** `/v1/chat/completions`
- **Content-Type:** `application/json`

Request payload (minimum contract):

```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "max_tokens": 256,
  "temperature": 0.7
}
```

Message projection rules:

- Client MUST prepend a single effective system message.
- Client MUST append conversation messages in original order.
- Client MUST include only fields required by runtime contract (`role`, `content`) unless runtime extension is explicitly supported.

Response payload (minimum contract):

```json
{
  "choices": [
    {
      "message": {
        "content": "assistant response"
      }
    }
  ]
}
```

Reply extraction rules:

- Client MUST read first choice message content.
- Empty/missing content MUST be treated as generation failure.

---

## 9) User Interaction and Operation Semantics

## 9.1 Create thread

- MUST create a new `ChatThread` with valid ids/timestamps.
- MUST set new thread as active.
- MUST preserve existing threads.

## 9.2 Select active thread

- MUST switch active context immediately.
- MUST render selected thread draft, prompt, and transcript.

## 9.3 Rename thread

- MUST trim input.
- Empty trimmed value MUST resolve to fallback title (for example `Untitled Chat`).
- MUST update `updatedAt`.

## 9.4 Fork thread

- MUST duplicate message history and thread-level prompt/draft into a new thread.
- Forked thread MUST receive a new thread id and new message ids.
- Forked thread SHOULD receive a derivative title (for example `"<title> Fork"`).

## 9.5 Delete thread

- If more than one thread exists: remove active thread and activate a remaining thread.
- If exactly one thread exists: replace with a newly initialized default thread (no zero-thread state).

## 9.6 Update draft

- Draft changes MUST be per-thread.
- Draft updates SHOULD persist on each input event or debounced equivalent.

## 9.7 Update system prompt

- Prompt is per-thread.
- Empty prompt input MUST fall back to default effective prompt.
- Prompt change MUST update `updatedAt`.

## 9.8 Send message

On send with non-empty draft and no active request:

1. Append user message to active thread.
2. Clear draft.
3. Optionally retitle thread if thread still has an auto-generated title and message count indicates first user turn.
4. Persist thread mutation.
5. Start cancellable runtime request.
6. On success: append assistant message and persist.
7. On non-abort failure: append assistant error message and persist.
8. On completion (success, failure, or abort): clear in-flight request state.

## 9.9 Cancel request

- Client MUST expose a cancellation action while request is in flight.
- Cancellation MUST abort transport request if underlying platform supports abort signals.
- Aborted requests MUST NOT append synthetic success content.

## 9.10 Busy-state gating

While a generation request is active, client MUST prevent conflicting mutations that can corrupt request/thread coherence.

Minimum required disabled interactions while busy:

- send action
- composer text entry (or equivalent send-lock)
- thread create/rename/fork/delete actions
- clear draft action

---

## 10) Runtime Status and UX Signaling Contract

The view MUST represent three runtime states:

- `checking`: runtime probe in progress
- `ready`: runtime healthy and model name resolved/fallback
- `error`: runtime unavailable or probe failed

The view MUST expose:

- concise status indicator label
- explanatory status copy
- runtime summary text suitable for compact display
- model summary text

Copy wording MAY vary. Semantic mapping MUST remain equivalent.

---

## 11) Ordering, Sorting, and Derived Presentation Rules

- Threads SHOULD be sorted by descending `updatedAt`.
- Message transcript MUST render in ascending chronological order.
- Thread list metadata SHOULD include message count and recent timestamp.
- Thread preview snippet SHOULD derive from latest message content when available.

---

## 12) Error Handling Contract

## 12.1 Persistence errors

If local persistence fails:

- Client SHOULD fail gracefully and keep in-memory state for current session.
- Client SHOULD log a developer-visible diagnostic.

## 12.2 Runtime request errors

If generation fails (excluding user abort):

- Client MUST provide user-visible assistant-side failure feedback in transcript.
- Error feedback SHOULD encourage retry and mention local runtime availability.

## 12.3 Probe errors

Probe failure MUST transition runtime status to `error` and maintain recoverable UI state.

---

## 13) Accessibility and Input Contract

Any compliant view MUST ensure the following behavioral accessibility guarantees:

- Primary transcript region supports live updates (`aria-live` or equivalent).
- Composer has an explicit accessible label.
- Send action available via keyboard form submission.
- Multi-line entry preserved via modifier-based newline behavior (or equivalent documented gesture).
- Thread selection controls have clear active-state semantics for assistive technologies.

Visual styling and DOM structure are implementation-defined.

---

## 14) Security and Data Locality Constraints

- Thread data is local to client/browser storage by default.
- Runtime calls are limited to local OurBox runtime endpoints unless deployment explicitly extends this.
- View implementations MUST NOT silently exfiltrate thread content to third-party endpoints.
- Any telemetry/analytics integration MUST be explicit, consent-aware, and documented outside this contract.

---

## 15) Compliance Checklist (Quick Validation)

A view is considered contract-compliant when all statements below are true:

1. It can initialize from missing or malformed saved state without crashing.
2. It guarantees at least one thread exists at all times.
3. It supports create/select/rename/fork/delete thread operations.
4. It persists draft, prompt, and message mutations.
5. It probes `/health` and `/v1/models` and displays runtime state.
6. It posts to `/v1/chat/completions` using system + transcript message projection.
7. It supports aborting in-flight generation.
8. It appends assistant replies or assistant-visible errors appropriately.
9. It enforces busy-state gating for conflicting controls.
10. It keeps implementation details decoupled from this contract.

---

## 16) Optional Extensions (Non-Breaking)

The following MAY be added by implementations without violating this contract:

- streaming token rendering
- richer message metadata (latency, token counts, tool markers)
- import/export of thread archives
- search/filter over local threads
- multi-tab synchronization
- pluggable prompt templates

Extensions MUST NOT break required baseline behaviors.

---

## 17) Reference TypeScript Interface Block (Copy/Paste)

```ts
export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  systemPrompt: string;
  draft: string;
  messages: ChatMessage[];
}

export interface PersistedChatState {
  threads: ChatThread[];
  activeThreadId: string;
}

export type RuntimeStatusKind = "checking" | "ready" | "error";

export interface RuntimeStatus {
  kind: RuntimeStatusKind;
  message: string;
  modelName: string;
}
```

This block is informative but aligned with all normative requirements above.
