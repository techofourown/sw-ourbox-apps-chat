# sw-ourbox-apps-chat

`sw-ourbox-apps-chat` publishes a CPU-first local chat application image for
OurBox.

The initial app in this repo is `ourbox-chat`:

- CPU-only local chat powered by `llama.cpp`
- bundles a capable GGUF model into the image so the target does not download a
  model at install time or first boot
- exposes a custom mobile-first OurBox web UI over HTTP
- keeps multiple saved conversation threads in browser storage
- supports per-thread system prompts, rename, delete, and fork workflows
- separates the shipped shell, app model, and bundled mobile-native view so the
  browser contract stays clean
- intended to be consumed by `sw-ourbox-catalog-*` repositories

## Published application

- `ourbox-chat`
  - local chat UI backed by a bundled Qwen3 4B GGUF model
  - saved threads, forkable conversations, rename controls, and system prompt editing
  - product name: `OurBox Chat`
  - image: `ghcr.io/techofourown/sw-ourbox-apps-chat/ourbox-chat`
  - default route: `chat.{box_host}`
  - default port: `8080`

## Model choice

The bundled model is:

- source: `Qwen/Qwen3-4B-GGUF`
- file: `Qwen3-4B-Q4_K_M.gguf`

This is a more capable CPU-first baseline than the original 0.5B model while
still staying in a range that is realistic for local `llama.cpp` deployment on
OurBox. The deployment defaults to direct-answer chat behavior and strips any
reasoning artifacts before rendering them in the app UI.

## View-Layer Architecture

`ourbox-chat` now ships three separate browser-side layers:

- `ui/shell`
  - minimal HTML shell plus the public `window.OurBoxChatContract` and
    `window.OurBoxChat` app-model API
- `ui/views/mobile-native`
  - the shipped phone-first mountable view bundle (`window.OurBoxChatView`)
- `docs/reference/view-layer-contract.md`
  - the normative contract for browser views targeting the app model

The shell owns bootstrapping only. The app model owns threads, persistence,
runtime probing, request dispatch, and events. The shipped mobile-native view
owns DOM, layout, sheet state, dialogs, focus, and styling.

The Docker build still uses `OURBOX_CHAT_VIEW`, but the repo now ships
`mobile-native` as the bundled view and publishes a flat runtime asset set:

- `/contract.js`
- `/app-model.js`
- `/view.js`
- `/bootstrap.js`
- `/view.css`

## Repository layout

- [apps-manifest.json](/techofourown/sw-ourbox-apps-chat/apps-manifest.json)
  - machine-readable description of the published application
- [apps/ourbox-chat](/techofourown/sw-ourbox-apps-chat/apps/ourbox-chat)
  - image build inputs for the local chat application
- [docs/reference/view-layer-contract.md](/techofourown/sw-ourbox-apps-chat/docs/reference/view-layer-contract.md)
  - normative shell/app-model/view contract for browser UIs
- [.github/workflows/ci.yml](/techofourown/sw-ourbox-apps-chat/.github/workflows/ci.yml)
  - lightweight validation
- [.github/workflows/publish-images.yml](/techofourown/sw-ourbox-apps-chat/.github/workflows/publish-images.yml)
  - publishes the image to GHCR on `main`
