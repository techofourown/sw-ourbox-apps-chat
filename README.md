# sw-ourbox-apps-chat

`sw-ourbox-apps-chat` publishes a small local-LLM chat application image for
OurBox.

The initial app in this repo is `ourbox-chat`:

- CPU-only local chat powered by `llama.cpp`
- bundles a small GGUF model into the image so the target does not download a
  model at install time or first boot
- exposes a custom mobile-first OurBox web UI over HTTP
- keeps multiple saved conversation threads in browser storage
- supports per-thread system prompts, rename, delete, and fork workflows
- separates the shipped shell, app model, and bundled mobile-native view so the
  browser contract stays clean
- intended to be consumed by `sw-ourbox-catalog-*` repositories

## Published application

- `ourbox-chat`
  - local chat UI backed by a bundled Qwen 2.5 0.5B instruct GGUF model
  - saved threads, forkable conversations, rename controls, and system prompt editing
  - product name: `OurBox Chat`
  - image: `ghcr.io/techofourown/sw-ourbox-apps-chat/ourbox-chat`
  - default route: `chat.{box_host}`
  - default port: `8080`

## Model choice

The first bundled model is:

- source: `Qwen/Qwen2.5-0.5B-Instruct-GGUF`
- file: `qwen2.5-0.5b-instruct-q4_k_m.gguf`

This is intentionally a small CPU-first starting point. It is not meant to be
the final word on local models; it is meant to prove the full offline-staged
app path for a local chat experience on OurBox.

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
