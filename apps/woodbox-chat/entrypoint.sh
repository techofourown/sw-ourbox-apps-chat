#!/bin/sh
set -eu

exec /app/llama-server \
  -m "${MODEL_PATH}" \
  --host "${WOODBOX_CHAT_HOST:-0.0.0.0}" \
  --port "${WOODBOX_CHAT_PORT:-8080}" \
  --path /app/ui \
  -c "${WOODBOX_CHAT_CTX_SIZE:-2048}" \
  -t "${WOODBOX_CHAT_THREADS:-4}" \
  -ngl "${WOODBOX_CHAT_N_GPU_LAYERS:-0}" \
  -n "${WOODBOX_CHAT_PREDICT:-256}" \
  -np 1
