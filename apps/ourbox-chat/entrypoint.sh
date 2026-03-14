#!/bin/sh
set -eu

exec /app/llama-server \
  -m "${MODEL_PATH}" \
  --host "${OURBOX_CHAT_HOST:-0.0.0.0}" \
  --port "${OURBOX_CHAT_PORT:-8080}" \
  --path /app/ui \
  -c "${OURBOX_CHAT_CTX_SIZE:-2048}" \
  -t "${OURBOX_CHAT_THREADS:-4}" \
  -ngl "${OURBOX_CHAT_N_GPU_LAYERS:-0}" \
  -n "${OURBOX_CHAT_PREDICT:-256}" \
  -np 1
