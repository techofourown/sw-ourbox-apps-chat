# sw-ourbox-apps-chat

`sw-ourbox-apps-chat` publishes a small local-LLM chat application image for
OurBox.

The initial app in this repo is `woodbox-chat`:

- CPU-only local chat powered by `llama.cpp`
- bundles a small GGUF model into the image so the target does not download a
  model at install time or first boot
- exposes the built-in `llama.cpp` web UI over HTTP
- intended to be consumed by `sw-ourbox-catalog-*` repositories

## Published application

- `woodbox-chat`
  - local chat UI backed by a bundled Qwen 2.5 0.5B instruct GGUF model
  - image: `ghcr.io/techofourown/sw-ourbox-apps-chat/woodbox-chat`
  - default route: `chat.{box_host}`
  - default port: `8080`

## Model choice

The first bundled model is:

- source: `Qwen/Qwen2.5-0.5B-Instruct-GGUF`
- file: `qwen2.5-0.5b-instruct-q4_k_m.gguf`

This is intentionally a small CPU-first starting point. It is not meant to be
the final word on local models; it is meant to prove the full offline-staged
app path for a local chat experience on Woodbox.

## Repository layout

- [apps-manifest.json](/techofourown/sw-ourbox-apps-chat/apps-manifest.json)
  - machine-readable description of the published application
- [apps/woodbox-chat](/techofourown/sw-ourbox-apps-chat/apps/woodbox-chat)
  - image build inputs for the local chat application
- [.github/workflows/ci.yml](/techofourown/sw-ourbox-apps-chat/.github/workflows/ci.yml)
  - lightweight validation
- [.github/workflows/publish-images.yml](/techofourown/sw-ourbox-apps-chat/.github/workflows/publish-images.yml)
  - publishes the image to GHCR on `main`
