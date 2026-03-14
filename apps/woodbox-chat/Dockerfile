FROM ghcr.io/ggml-org/llama.cpp:server

LABEL org.opencontainers.image.title="OurBox Chat" \
      org.opencontainers.image.description="CPU-only local chat app for OurBox with a bundled small GGUF model." \
      org.opencontainers.image.source="https://github.com/techofourown/sw-ourbox-apps-chat"

USER root

RUN mkdir -p /models /app

ADD https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf /models/qwen2.5-0.5b-instruct-q4_k_m.gguf

COPY entrypoint.sh /app/entrypoint.sh
COPY ui /app/ui

RUN chmod +x /app/entrypoint.sh

ENV MODEL_PATH=/models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
    WOODBOX_CHAT_HOST=0.0.0.0 \
    WOODBOX_CHAT_PORT=8080 \
    WOODBOX_CHAT_CTX_SIZE=2048 \
    WOODBOX_CHAT_THREADS=4 \
    WOODBOX_CHAT_N_GPU_LAYERS=0 \
    WOODBOX_CHAT_PREDICT=256

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
