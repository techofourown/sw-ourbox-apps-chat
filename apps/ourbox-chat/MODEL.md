# Bundled Model

- upstream repo: `Qwen/Qwen2.5-0.5B-Instruct-GGUF`
- bundled file: `qwen2.5-0.5b-instruct-q4_k_m.gguf`
- purpose: small CPU-first chat model suitable for proving the offline-staged
  local-LLM app path on OurBox

This repo intentionally bakes the model into the published application image so
the target does not need to download model bytes after installation.
