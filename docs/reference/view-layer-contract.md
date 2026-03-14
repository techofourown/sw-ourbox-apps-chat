# OurBox Chat View-Layer Contract

This document is the normative public contract for browser-based `ourbox-chat`
views. It defines the supported shell, app-model, and view-module boundaries.
It does not define or freeze the default DOM tree, CSS class names, layout, or
implementation details.

## 1. Scope and non-goals

The public contract exists so a developer can build a web view and mount it on
top of the shipped `ourbox-chat` browser app model without changing private UI
implementation details.

The following are not public API and must not be treated as public API:

- default view DOM structure
- default view CSS class names or IDs
- localStorage keys or storage schema details
- runtime endpoint paths
- default system prompt text
- drawer, dialog, breakpoint, or focus state

If a behavior is about threads, messages, persistence, runtime I/O, or
commands/events, it belongs to the app model. If it is about layout, drawer
state, dialogs, focus, or DOM structure, it belongs to the view.

## 2. Architecture split

`ourbox-chat` is split into three layers.

1. Shell
   Loads one mount root, the contract constants, the app model, one view
   bundle, and the bootstrap script.
2. App model
   Owns thread state, active-thread selection, persistence, runtime probing,
   request dispatch, cancellation, validation, and event publication.
3. View module
   Owns DOM, layout, dialogs, drawers, keyboard behavior, responsive behavior,
   and all other view-local state.

Alternative views target the app-model contract. They do not import or depend
on the default view.

## 3. Public globals

The shell publishes three globals:

- `window.OurBoxChatContract`
- `window.OurBoxChat`
- `window.OurBoxChatView`

`window.OurBoxChatContract` is the authoritative constant table. The current
contract object is:

```js
window.OurBoxChatContract = Object.freeze({
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
```

The public live app-model instance is exposed at `window.OurBoxChat`.

## 4. App-model contract

The public app-model surface is:

```ts
interface OurBoxChatApp {
  contract: {
    id: "ourbox-chat.view-layer";
    version: string;
  };
  constants: typeof window.OurBoxChatContract;
  getState(): PublicState;
  subscribe(listener: (event: AppEvent) => void): () => void;
  dispatch(command: Command): Promise<DispatchResult>;
  destroy(): void;
}
```

### 4.1 State shape

```ts
interface PublicState {
  contract: {
    id: "ourbox-chat.view-layer";
    version: string;
  };
  runtime: {
    status: "checking" | "ready" | "error";
    message: string;
    modelName: string;
  };
  request: {
    inFlight: boolean;
    threadId: string | null;
  };
  activeThreadId: string;
  activeThread: ThreadSnapshot;
  threads: ThreadSnapshot[];
}

interface ThreadSnapshot {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  systemPrompt: string;
  draft: string;
  messages: MessageSnapshot[];
}

interface MessageSnapshot {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
```

### 4.2 State invariants

- `threads.length >= 1`
- `activeThreadId` always references an existing thread
- `activeThread` is always present
- `request.inFlight` represents at most one active generation
- `threads` are returned in descending `updatedAt` order
- returned snapshots are copies from the perspective of the caller

### 4.3 Commands

```ts
type Command =
  | { type: "thread.create" }
  | { type: "thread.select"; threadId: string }
  | { type: "thread.rename"; threadId: string; title: string }
  | { type: "thread.fork"; threadId: string }
  | { type: "thread.delete"; threadId: string }
  | { type: "thread.draft.set"; threadId: string; draft: string }
  | { type: "thread.system-prompt.set"; threadId: string; systemPrompt: string }
  | { type: "request.send"; threadId: string; content?: string }
  | { type: "request.cancel" }
  | { type: "runtime.probe" };
```

Command rules:

- thread-addressed commands must include a valid `threadId`
- `thread.rename` trims and clamps the public title to the contract limit
- `thread.system-prompt.set` restores the app-model default prompt when given an
  empty string
- `request.send` derives message content from `command.content` when provided,
  otherwise from the thread draft
- `request.send` rejects empty content with `empty-draft`
- `request.send` resolves when the request is accepted and started, not when
  generation finishes
- `request.cancel` cancels the current in-flight generation when one exists
- `runtime.probe` re-runs runtime health and model discovery

Busy policy in v1:

- reject `thread.create`, `thread.fork`, `thread.delete`, and `request.send`
  while a request is in flight
- allow `thread.select`, `thread.rename`, `thread.draft.set`, and
  `thread.system-prompt.set` during an in-flight request

### 4.4 Dispatch result

```ts
interface DispatchResult {
  ok: boolean;
  code?:
    | "invalid-command"
    | "unknown-command"
    | "unknown-thread"
    | "empty-draft"
    | "busy";
  detail?: Record<string, unknown> | null;
  state: PublicState;
}
```

Dispatch result rules:

- `ok: true` means the command was accepted
- `ok: false` means the command was rejected synchronously
- `dispatch()` must not throw for normal contract-level failures
- callers should inspect `result.ok` and `result.code`

### 4.5 Events

```ts
interface AppEvent {
  type:
    | "subscription.ready"
    | "state.changed"
    | "runtime.changed"
    | "request.started"
    | "request.finished";
  at: string;
  cause: string | null;
  detail: Record<string, unknown> | null;
  state: PublicState;
}
```

Event rules:

- `subscribe()` immediately invokes the new listener with `subscription.ready`
- `state.changed` is emitted after every accepted state mutation
- `runtime.changed` is emitted when runtime status or model metadata changes
- `request.started` is emitted when a request is accepted and marked in-flight
- `request.finished` uses `detail.outcome = "success" | "error" | "aborted"`
- the browser also receives `window.dispatchEvent(new CustomEvent(contract.browserEventName, { detail: event }))`

## 5. View-module contract

Every drop-in web view must register:

```js
window.OurBoxChatView = {
  id: "my-view",
  contractVersion: "1.0.0",
  mount({ root, app, contract }) {
    return {
      unmount() {},
    };
  },
};
```

The required mount arguments are:

```ts
interface MountArgs {
  root: HTMLElement;
  app: OurBoxChatApp;
  contract: typeof window.OurBoxChatContract;
}
```

View rules:

- a view owns everything inside `root`
- a view reads state through `app.getState()` and `app.subscribe()`
- a view mutates state only through `app.dispatch()`
- a view keeps drawers, dialogs, focus, and breakpoints local to the view
- `mount()` must return an object with `unmount()`

A compliant view must not:

- call `/health`, `/v1/models`, or `/v1/chat/completions` directly
- read or write persistence directly
- depend on private DOM outside `root`
- assume another view’s CSS, DOM IDs, or templates are present

## 6. Shell and build behavior

The shell is intentionally minimal. The published runtime asset set is flat:

- `/index.html`
- `/contract.js`
- `/app-model.js`
- `/view.js`
- `/bootstrap.js`
- `/view.css`

The Docker build selects one view at build time through `OURBOX_CHAT_VIEW`.
The shell files are always shipped. The selected view bundle is copied into
`/view.js` and `/view.css`.

The recommended source tree is:

```text
apps/ourbox-chat/ui/
  shell/
    index.html
    contract.js
    app-model.js
    bootstrap.js
  views/
    default/
      view.js
      view.css
```

## 7. Versioning and compatibility

- `OurBoxChatContract.version` is the public contract version
- the view bundle declares `contractVersion`
- shell bootstrap uses major-version compatibility
- a view that targets a different major version is incompatible and must not be
  mounted
- storage schema versioning is an app-model implementation concern and is not
  part of the public view contract

## 8. Compliance checklist for view authors

An alternate view is compliant if all of the following are true:

- it registers `window.OurBoxChatView`
- it mounts only inside the supplied `root`
- it treats `OurBoxChatContract` and `OurBoxChat` as the only public browser
  contract
- it renders entirely from public state snapshots
- it dispatches only public commands
- it cleans up subscriptions and DOM listeners in `unmount()`
- it does not read or depend on the default view implementation

## 9. Minimal starter example

```js
(function () {
  window.OurBoxChatView = {
    id: "my-view",
    contractVersion: "1.0.0",
    mount({ root, app, contract }) {
      function paint(state) {
        root.innerHTML = "";

        const title = document.createElement("h1");
        title.textContent = state.activeThread.title;

        const runtime = document.createElement("p");
        runtime.textContent = state.runtime.status + ": " + state.runtime.message;

        const send = document.createElement("button");
        send.textContent = "Send hello";
        send.onclick = function () {
          void app.dispatch({
            type: contract.commands.REQUEST_SEND,
            threadId: state.activeThreadId,
            content: "Hello",
          });
        };

        root.appendChild(title);
        root.appendChild(runtime);
        root.appendChild(send);
      }

      const unsubscribe = app.subscribe(function (event) {
        paint(event.state);
      });

      paint(app.getState());

      return {
        unmount() {
          unsubscribe();
          root.replaceChildren();
        },
      };
    },
  };
})();
```

## 10. Default view note

The shipped default web UI is one compliant view implementation. Its DOM
structure, CSS selectors, and private layout behavior exist for that view only.
They are intentionally not part of this contract and may change without a
contract version bump.
