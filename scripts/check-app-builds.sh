#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v python3 >/dev/null 2>&1 || {
  echo "required command not found: python3" >&2
  exit 1
}
command -v docker >/dev/null 2>&1 || {
  echo "required command not found: docker" >&2
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  echo "required command not found: curl" >&2
  exit 1
}

mkdir -p "${ROOT}/dist"

python3 - <<'PY' "${ROOT}/apps-manifest.json" "${ROOT}"
import json
import subprocess
import sys
from pathlib import Path

manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
root = Path(sys.argv[2])

for app in manifest["apps"]:
    app_id = str(app["app_id"]).strip()
    source_path = root / str(app["source_path"]).strip()
    tag = f"local/sw-ourbox-apps-chat-{app_id}:ci"
    subprocess.run(
        ["docker", "build", "--pull", "--tag", tag, str(source_path)],
        check=True,
    )
PY

bash "${ROOT}/scripts/check-ourbox-chat-runtime-smoke.sh"

printf '[%s] app build smoke passed\n' "$(date -Is)"
