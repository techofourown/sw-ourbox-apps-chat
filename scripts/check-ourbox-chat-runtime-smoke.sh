#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="local/sw-ourbox-apps-chat-ourbox-chat:ci"
CONTAINER_NAME="ourbox-chat-runtime-smoke"
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
  -e OURBOX_CHAT_PORT="tcp://10.43.22.203:8080" \
  -p "127.0.0.1:${PORT}:8080" \
  "${IMAGE_TAG}" >/dev/null

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >"${ROOT}/dist/ourbox-chat-runtime-health.json" 2>/dev/null; then
    break
  fi
  sleep 2
done

test -f "${ROOT}/dist/ourbox-chat-runtime-health.json" || {
  echo "ourbox-chat runtime did not become ready" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

grep -q '"status":"ok"' "${ROOT}/dist/ourbox-chat-runtime-health.json" || {
  echo "ourbox-chat health endpoint did not report ok" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

curl -fsSI "http://127.0.0.1:${PORT}/health" >"${ROOT}/dist/ourbox-chat-runtime-health.headers"

grep -qi '^Server: llama\.cpp' "${ROOT}/dist/ourbox-chat-runtime-health.headers" || {
  echo "ourbox-chat health endpoint did not advertise the llama.cpp server header" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

curl -fsS "http://127.0.0.1:${PORT}/v1/models" >"${ROOT}/dist/ourbox-chat-runtime-models.json"

grep -q '"object":"list"' "${ROOT}/dist/ourbox-chat-runtime-models.json" || {
  echo "ourbox-chat models endpoint did not return the expected model listing" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

curl --compressed -fsS "http://127.0.0.1:${PORT}/" >"${ROOT}/dist/ourbox-chat-runtime-ui.html"

grep -q 'data-app="ourbox-chat"' "${ROOT}/dist/ourbox-chat-runtime-ui.html" || {
  echo "ourbox-chat root page did not serve the custom app shell" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

grep -q 'id="ourbox-chat-root"' "${ROOT}/dist/ourbox-chat-runtime-ui.html" || {
  echo "ourbox-chat root page did not expose the shell mount root" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

grep -q 'src="/contract.js"' "${ROOT}/dist/ourbox-chat-runtime-ui.html" || {
  echo "ourbox-chat root page did not load contract.js" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

grep -q 'src="/app-model.js"' "${ROOT}/dist/ourbox-chat-runtime-ui.html" || {
  echo "ourbox-chat root page did not load app-model.js" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

grep -q 'src="/view.js"' "${ROOT}/dist/ourbox-chat-runtime-ui.html" || {
  echo "ourbox-chat root page did not load view.js" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

grep -q 'src="/bootstrap.js"' "${ROOT}/dist/ourbox-chat-runtime-ui.html" || {
  echo "ourbox-chat root page did not load bootstrap.js" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

grep -q "OurBox Chat" "${ROOT}/dist/ourbox-chat-runtime-ui.html" || {
  echo "ourbox-chat root page did not include expected shell metadata" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

python3 - <<'PY' "http://127.0.0.1:${PORT}/v1/chat/completions" >"${ROOT}/dist/ourbox-chat-runtime-generation.json"
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

printf '[%s] ourbox-chat runtime smoke passed\n' "$(date -Is)"
