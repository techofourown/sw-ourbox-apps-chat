FROM ghcr.io/ggml-org/llama.cpp@sha256:9945b5afed75c3f09a5ca73c1aadd277101922a243c09a91c4931a85312be805

LABEL org.opencontainers.image.title="OurBox Chat" \
      org.opencontainers.image.description="CPU-only local chat app for OurBox with a bundled Qwen3 4B GGUF model." \
      org.opencontainers.image.source="https://github.com/techofourown/sw-ourbox-apps-chat"

ARG OURBOX_CHAT_VIEW=mobile-native

USER root

RUN mkdir -p /models /app

ADD https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/a9a60d009fa7ff9606305047c2bf77ac25dbec49/Qwen3-4B-Q4_K_M.gguf /models/Qwen3-4B-Q4_K_M.gguf
RUN echo "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5  /models/Qwen3-4B-Q4_K_M.gguf" | sha256sum -c -

COPY entrypoint.sh /app/entrypoint.sh
COPY ui /app/ui-src

RUN set -eu; \
    test -f "/app/ui-src/views/${OURBOX_CHAT_VIEW}/view.js"; \
    test -f "/app/ui-src/views/${OURBOX_CHAT_VIEW}/view.css"; \
    mkdir -p /app/ui; \
    cp /app/ui-src/shell/index.html /app/ui/index.html; \
    cp /app/ui-src/shell/contract.js /app/ui/contract.js; \
    cp /app/ui-src/shell/app-model.js /app/ui/app-model.js; \
    cp /app/ui-src/shell/bootstrap.js /app/ui/bootstrap.js; \
    cp "/app/ui-src/views/${OURBOX_CHAT_VIEW}/view.js" /app/ui/view.js; \
    cp "/app/ui-src/views/${OURBOX_CHAT_VIEW}/view.css" /app/ui/view.css

RUN chmod +x /app/entrypoint.sh

ENV MODEL_PATH=/models/Qwen3-4B-Q4_K_M.gguf \
    OURBOX_CHAT_HOST=0.0.0.0 \
    OURBOX_CHAT_LISTEN_PORT=8080 \
    OURBOX_CHAT_CTX_SIZE=2048 \
    OURBOX_CHAT_THREADS=4 \
    OURBOX_CHAT_N_GPU_LAYERS=0 \
    OURBOX_CHAT_PREDICT=256 \
    OURBOX_CHAT_REASONING_FORMAT=deepseek \
    OURBOX_CHAT_REASONING_BUDGET=0

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
