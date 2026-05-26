#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo ":: Linting GJS sources"

mapfile -t js_files < <(rg --files extension/src scripts -g "*.js")

if [[ ${#js_files[@]} -eq 0 ]]; then
  echo "No JS files found to lint."
  exit 0
fi

echo ":: Syntax checking with node --check"
for file in "${js_files[@]}"; do
  node --check "$file"
done

echo ":: Checking for raw setTimeout usage in shell runtime code"
if rg --line-number --no-heading "setTimeout\\s*\\(" \
  extension/src/components \
  extension/src/conveniences \
  extension/src/runtime \
  extension/src/overlays \
  extension/src/integrations \
  extension/src/extension.js; then
  echo "ERROR: raw setTimeout() usage found in shell runtime sources."
  exit 1
fi

echo ":: Checking for empty catch blocks"
if rg --line-number --no-heading "catch\\s*\\(?.*\\)?\\s*\\{\\s*\\}" extension/src; then
  echo "ERROR: empty catch block(s) found."
  exit 1
fi

echo ":: Checking for untracked GLib source usage"
if rg --line-number --no-heading "GLib\\.(timeout_add|idle_add)\\s*\\(" extension/src/components \
  | rg -v "addSource\\(|_bms_size_retry|_restart_source_id|_reset_source_id|_dtp_idle_source_ids|sourceId\\s*=\\s*GLib\\.idle_add" \
  | rg -v "^extension/src/components/dhruva\\.js:"; then
  echo "ERROR: untracked GLib timeout/idle source usage found."
  exit 1
fi

echo ":: Checking direct .connect() calls outside wrappers"
scripts/check-untracked-connects.sh

echo "lint-gjs.sh: passed"
