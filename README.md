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

## Repository layout

- [apps-manifest.json](/techofourown/sw-ourbox-apps-chat/apps-manifest.json)
  - machine-readable description of the published application
- [apps/ourbox-chat](/techofourown/sw-ourbox-apps-chat/apps/ourbox-chat)
  - image build inputs for the local chat application
- [docs/reference/view-layer-contract.md](/techofourown/sw-ourbox-apps-chat/docs/reference/view-layer-contract.md)
  - formal pluggable view-layer contract for building alternate Web App interfaces
- [.github/workflows/ci.yml](/techofourown/sw-ourbox-apps-chat/.github/workflows/ci.yml)
  - lightweight validation
- [.github/workflows/publish-images.yml](/techofourown/sw-ourbox-apps-chat/.github/workflows/publish-images.yml)
  - publishes the image to GHCR on `main`
