#!/bin/sh
set -eu

resolve_listen_port() {
  case "${OURBOX_CHAT_LISTEN_PORT:-}" in
    "")
      case "${OURBOX_CHAT_PORT:-}" in
        "")
          printf '%s\n' "8080"
          ;;
        *[!0-9]*)
          printf '%s\n' "8080"
          ;;
        *)
          printf '%s\n' "${OURBOX_CHAT_PORT}"
          ;;
      esac
      ;;
    *[!0-9]*)
      printf '%s\n' "invalid OURBOX_CHAT_LISTEN_PORT: ${OURBOX_CHAT_LISTEN_PORT}" >&2
      exit 64
      ;;
    *)
      printf '%s\n' "${OURBOX_CHAT_LISTEN_PORT}"
      ;;
  esac
}

LISTEN_PORT="$(resolve_listen_port)"

exec /app/llama-server \
  -m "${MODEL_PATH}" \
  --host "${OURBOX_CHAT_HOST:-0.0.0.0}" \
  --port "${LISTEN_PORT}" \
  --path /app/ui \
  --jinja \
  --reasoning-format "${OURBOX_CHAT_REASONING_FORMAT:-deepseek}" \
  --reasoning-budget "${OURBOX_CHAT_REASONING_BUDGET:-0}" \
  -c "${OURBOX_CHAT_CTX_SIZE:-2048}" \
  -t "${OURBOX_CHAT_THREADS:-4}" \
  -ngl "${OURBOX_CHAT_N_GPU_LAYERS:-0}" \
  -n "${OURBOX_CHAT_PREDICT:-256}" \
  -np 1
