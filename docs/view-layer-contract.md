# OurBox Chat View Layer Contract (Web App)

## 1. Purpose

This document defines the **public, implementation-agnostic contract** for building interchangeable view layers on top of the OurBox Chat web application.

The contract is intentionally designed so that any developer can build:

- a full replacement UI,
- a themed UI,
- an accessibility-first UI,
- a kiosk UI,
- an embedded UI shell,

without changing the chat runtime endpoints and without depending on private implementation details.

---

## 2. Scope and Non-Goals

### In scope

- The globally exposed browser contract for reading app state.
- The standard action interface for mutating state and invoking chat actions.
- The subscription/event model for reactive rendering.
- Required object shapes and behavior expectations.
- Error/result semantics for actions.

### Out of scope

- Internal DOM structure.
- Internal event wiring.
- Internal state storage strategy.
- Internal function names and implementation details.
- Styling system and CSS conventions.

A view implementation **must treat this contract as the only stable surface**.

---

## 3. Runtime Availability

A compliant host page exposes the contract at:

- `window.OurBoxChatViewContract`

The contract object must be available after the app initialization lifecycle has completed.

---

## 4. Contract Versioning

- Contract version field: `window.OurBoxChatViewContract.version`
- Current version: `1.0.0`

### Compatibility policy

- Patch releases (`1.0.x`) may add clarifications and non-breaking behavior adjustments.
- Minor releases (`1.x.0`) may add optional actions/fields/events while preserving existing behavior.
- Major releases (`x.0.0`, where `x > 1`) may include breaking changes.

A view should always check `version` and degrade gracefully when unknown fields/actions appear.

---

## 5. Public API Surface

The contract has three required methods.

## 5.1 `getState(): PublicState`

Returns a snapshot of the current public application state.

### Guarantees

- Returns a plain JSON-serializable object.
- Does not mutate state.
- Safe to call repeatedly.

---

## 5.2 `subscribe(listener): unsubscribe`

Registers a listener for state change notifications.

### Signature

- Input: `listener(payload: ContractEventPayload): void`
- Returns: `unsubscribe(): void`

### Behavior

- If `listener` is not a function, contract throws an error.
- Listener receives an immediate bootstrap callback with:
  - `eventType = "subscription.ready"`
  - current `state`
- Listener receives subsequent callbacks whenever relevant state/events are emitted.
- `unsubscribe` removes the listener.

---

## 5.3 `dispatch(action): Promise<ActionResult>`

Dispatches a user intent to the app.

### Guarantees

- Always returns a Promise.
- Promise resolves to structured action result.
- Unknown actions return structured failure (`ok: false`) rather than throwing.
- Invalid action envelope may throw (for example missing `type`).

---

## 6. State Model (`PublicState`)

```ts
interface PublicState {
  contractVersion: string;
  runtime: {
    ready: boolean;
    message: string;
    modelName: string;
  };
  request: {
    inFlight: boolean;
    threadId: string | null;
  };
  ui: {
    drawerOpen: boolean;
    isDesktopLayout: boolean;
  };
  activeThreadId: string | null;
  activeThread: ThreadSnapshot | null;
  threads: ThreadSnapshot[];
}

interface ThreadSnapshot {
  id: string;
  title: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  systemPrompt: string;
  draft: string;
  messages: MessageSnapshot[];
}

interface MessageSnapshot {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string; // ISO-8601
}
```

### State semantics

- `runtime.ready` indicates local model runtime availability.
- `runtime.message` is human-readable status text suitable for status banners.
- `request.inFlight` indicates an active completion request.
- `request.threadId` indicates which thread has the active request.
- `activeThread` is the currently selected thread, or `null` when unavailable.

### Ordering guarantees

- `threads` order is host-defined and may reflect recency.
- IDs are opaque strings.
- Timestamps are ISO-8601 strings.

---

## 7. Event Payload Model

All subscription callbacks receive:

```ts
interface ContractEventPayload {
  eventType: string;
  at: string; // ISO-8601 emit timestamp
  details: Record<string, unknown> | null;
  state: PublicState;
}
```

### Event delivery notes

- Events are best-effort notifications and should be treated as hints.
- The source of truth remains `payload.state` and `getState()`.
- Views should avoid strict dependence on receiving every intermediate event.

---

## 8. Standard Actions

All actions follow the envelope:

```ts
interface ContractAction {
  type: string;
  payload?: Record<string, unknown>;
}
```

### 8.1 `THREAD_CREATE`

Creates a new thread and activates it.

**Payload:** none

**Result (success):**

```ts
{ ok: true; threadId: string }
```

---

### 8.2 `THREAD_SELECT`

Selects an existing thread.

**Payload:**

```ts
{ threadId: string }
```

**Result:**

- success: `{ ok: true; threadId: string }`
- failure: `{ ok: false; reason: "thread_not_found" }`

---

### 8.3 `THREAD_RENAME`

Renames the active thread.

**Payload:**

```ts
{ title: string }
```

**Result:**

```ts
{ ok: true; threadId: string | null }
```

---

### 8.4 `THREAD_FORK`

Forks the active thread, preserving conversation context.

**Payload:** none

**Result:**

```ts
{ ok: true; threadId: string | null }
```

---

### 8.5 `THREAD_DELETE`

Deletes the active thread.

**Payload:** none

**Result:**

```ts
{ ok: true; threadId: string | null }
```

---

### 8.6 `THREAD_DRAFT_SET`

Sets draft text for active thread composer.

**Payload:**

```ts
{ value: string }
```

**Result:**

```ts
{ ok: true }
```

---

### 8.7 `THREAD_SYSTEM_PROMPT_SET`

Sets system prompt for active thread.

**Payload:**

```ts
{ value: string }
```

**Result:**

```ts
{ ok: true }
```

---

### 8.8 `MESSAGE_SEND`

Sends a user message for the active thread.

**Payload (optional):**

```ts
{ content?: string }
```

If `content` is provided, it replaces draft before send.

**Result:**

```ts
{ ok: true }
```

---

### 8.9 `REQUEST_CANCEL`

Requests cancellation of the active generation request.

**Payload:** none

**Result:**

```ts
{ ok: true }
```

---

### 8.10 `UI_DRAWER_SET_OPEN`

Sets left navigation drawer open/closed state in responsive layouts.

**Payload:**

```ts
{ open: boolean }
```

**Result:**

```ts
{ ok: true; open: boolean }
```

---

## 9. Unknown Action Behavior

Unknown action types must return:

```ts
{ ok: false; reason: "unknown_action"; type: string }
```

This behavior allows third-party views to probe optional actions safely.

---

## 10. Browser Event Bridge

In addition to callback subscribers, hosts emit a DOM CustomEvent:

- Event name: `ourboxchat:state`
- `event.detail` contains `ContractEventPayload`

This bridge enables integration when direct `subscribe()` wiring is inconvenient.

---

## 11. View Integrator Requirements

A compliant view implementation should:

1. Read initial state from `getState()` (or subscription bootstrap payload).
2. Render from `PublicState` only.
3. Trigger mutations through `dispatch()` only.
4. Handle both success and failure action results.
5. Be resilient to additional unknown fields/event types.
6. Avoid dependence on internal DOM markup or CSS class names.

---

## 12. Accessibility and UX Recommendations (Non-Normative)

These are recommendations for view authors:

- Provide keyboard-accessible thread switching and send controls.
- Respect user text scaling and reduced motion preferences.
- Expose runtime readiness and request-in-flight status clearly.
- Ensure message transcript regions are screen-reader-friendly.
- Preserve composer drafts where possible.

---

## 13. Minimal Integration Example (TypeScript)

```ts
const api = window.OurBoxChatViewContract;

if (!api) {
  throw new Error("OurBox Chat contract not available");
}

function render(state: any) {
  // Render your custom view from state.
}

const unsubscribe = api.subscribe((payload) => {
  render(payload.state);
});

async function send(text: string) {
  const result = await api.dispatch({
    type: "MESSAGE_SEND",
    payload: { content: text },
  });

  if (!result.ok) {
    // Show error state.
  }
}
```

---

## 14. Migration Guidance

When contract versions increase:

- Check `api.version` at startup.
- Log unsupported major versions.
- Feature-detect optional actions with optimistic dispatch and `unknown_action` handling.
- Keep render logic tolerant of additional fields.

---

## 15. Stability Statement

The goal of this contract is to decouple UI composition from host internals so multiple teams can build and ship independent web view layers with low coordination overhead.

Any future contract evolution should preserve this decoupling principle.
