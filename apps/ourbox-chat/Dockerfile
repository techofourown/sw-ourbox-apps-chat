FROM ghcr.io/ggml-org/llama.cpp:server

LABEL org.opencontainers.image.title="OurBox Chat" \
      org.opencontainers.image.description="CPU-only local chat app for OurBox with a bundled small GGUF model." \
      org.opencontainers.image.source="https://github.com/techofourown/sw-ourbox-apps-chat"

ARG OURBOX_CHAT_VIEW=default

USER root

RUN mkdir -p /models /app

ADD https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf /models/qwen2.5-0.5b-instruct-q4_k_m.gguf

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

ENV MODEL_PATH=/models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
    OURBOX_CHAT_HOST=0.0.0.0 \
    OURBOX_CHAT_PORT=8080 \
    OURBOX_CHAT_CTX_SIZE=2048 \
    OURBOX_CHAT_THREADS=4 \
    OURBOX_CHAT_N_GPU_LAYERS=0 \
    OURBOX_CHAT_PREDICT=256

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
