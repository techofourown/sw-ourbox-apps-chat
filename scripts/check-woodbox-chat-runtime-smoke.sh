#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="local/sw-ourbox-apps-chat-woodbox-chat:ci"
CONTAINER_NAME="woodbox-chat-runtime-smoke"
PORT="18080"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "required command not found: $1" >&2
    exit 1
  }
}

need_cmd docker
need_cmd curl
need_cmd python3

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}

trap cleanup EXIT
cleanup

docker run -d --rm \
  --name "${CONTAINER_NAME}" \
  -p "127.0.0.1:${PORT}:8080" \
  "${IMAGE_TAG}" >/dev/null

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >"${ROOT}/dist/woodbox-chat-runtime-health.json" 2>/dev/null; then
    break
  fi
  sleep 2
done

test -f "${ROOT}/dist/woodbox-chat-runtime-health.json" || {
  echo "woodbox-chat runtime did not become ready" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

grep -q '"status":"ok"' "${ROOT}/dist/woodbox-chat-runtime-health.json" || {
  echo "woodbox-chat health endpoint did not report ok" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

curl -fsSI "http://127.0.0.1:${PORT}/health" >"${ROOT}/dist/woodbox-chat-runtime-health.headers"

grep -qi '^Server: llama\.cpp' "${ROOT}/dist/woodbox-chat-runtime-health.headers" || {
  echo "woodbox-chat health endpoint did not advertise the llama.cpp server header" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

curl -fsS "http://127.0.0.1:${PORT}/v1/models" >"${ROOT}/dist/woodbox-chat-runtime-models.json"

grep -q '"object":"list"' "${ROOT}/dist/woodbox-chat-runtime-models.json" || {
  echo "woodbox-chat models endpoint did not return the expected model listing" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

curl --compressed -fsS "http://127.0.0.1:${PORT}/" >"${ROOT}/dist/woodbox-chat-runtime-ui.html"

grep -q 'data-app="woodbox-chat"' "${ROOT}/dist/woodbox-chat-runtime-ui.html" || {
  echo "woodbox-chat root page did not serve the custom app shell" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

grep -q "New Thread" "${ROOT}/dist/woodbox-chat-runtime-ui.html" || {
  echo "woodbox-chat root page did not include the thread UI controls" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

python3 - <<'PY' "http://127.0.0.1:${PORT}/v1/chat/completions" >"${ROOT}/dist/woodbox-chat-runtime-generation.json"
import json
import sys
import urllib.request

request = urllib.request.Request(
    sys.argv[1],
    data=json.dumps(
        {
            "messages": [
                {
                    "role": "system",
                    "content": "Reply with exactly READY and nothing else.",
                },
                {
                    "role": "user",
                    "content": "Reply with exactly READY.",
                },
            ],
            "max_tokens": 8,
            "temperature": 0,
        }
    ).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)

with urllib.request.urlopen(request, timeout=120) as response:
    body = response.read().decode("utf-8")

payload = json.loads(body)
content = payload["choices"][0]["message"]["content"].strip()
if not content.lower().startswith("ready"):
    raise SystemExit(f"unexpected generation output: {content!r}")

print(body)
PY

printf '[%s] woodbox-chat runtime smoke passed\n' "$(date -Is)"
