# Bundled Model

- upstream repo: `Qwen/Qwen3-4B-GGUF`
- bundled file: `Qwen3-4B-Q4_K_M.gguf`
- license: Apache-2.0
- purpose: more capable CPU-first local chat model for the offline-staged
  OurBox chat application path

This repo intentionally bakes the model into the published application image so
the target does not need to download model bytes after installation.
