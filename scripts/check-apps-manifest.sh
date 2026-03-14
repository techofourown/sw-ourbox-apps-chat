#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 - <<'PY' "${ROOT}/apps-manifest.json"
import json
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1])
root = manifest_path.parent
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

if manifest.get("schema") != 1 or manifest.get("kind") != "ourbox-apps-collection":
    raise SystemExit("apps-manifest.json must declare schema=1 and kind=ourbox-apps-collection")

collection_id = str(manifest.get("collection_id", "")).strip()
if not collection_id:
    raise SystemExit("apps-manifest.json must declare a non-empty collection_id")

apps = manifest.get("apps")
if not isinstance(apps, list) or len(apps) != 1:
    raise SystemExit("chat apps manifest must declare exactly one app")

app = apps[0]
app_id = str(app.get("app_id", "")).strip()
image_repo = str(app.get("image_repo", "")).strip()
source_path = str(app.get("source_path", "")).strip()
default_tag = str(app.get("default_tag", "")).strip()
if not app_id or not image_repo or not source_path or not default_tag:
    raise SystemExit("chat app must declare non-empty app_id, image_repo, source_path, and default_tag")
if image_repo != "ghcr.io/techofourown/sw-ourbox-apps-chat/ourbox-chat":
    raise SystemExit(f"unexpected image_repo: {image_repo}")

app_dir = root / source_path
if not app_dir.is_dir():
    raise SystemExit(f"missing app source path: {app_dir}")
for required_file in ("Dockerfile", "entrypoint.sh", "MODEL.md"):
    if not (app_dir / required_file).is_file():
        raise SystemExit(f"missing required file: {app_dir / required_file}")

for required_file in (
    "ui/shell/index.html",
    "ui/shell/contract.js",
    "ui/shell/app-model.js",
    "ui/shell/bootstrap.js",
    "ui/views/mobile-native/view.js",
    "ui/views/mobile-native/view.css",
):
    if not (app_dir / required_file).is_file():
        raise SystemExit(f"missing required file: {app_dir / required_file}")

contract_doc = root / "docs/reference/view-layer-contract.md"
if not contract_doc.is_file():
    raise SystemExit(f"missing required file: {contract_doc}")
PY

printf '[%s] apps manifest validation passed\n' "$(date -Is)"
