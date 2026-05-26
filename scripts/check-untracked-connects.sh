#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mapfile -t hits < <(rg --line-number --no-heading "\.connect\(" extension/src/components -g "*.js" \
  | rg -v "connections\.connect\(|addSignal\(|process_connection\(|this\.connections\.connect\(" \
  | rg -v "^extension/src/components/(applications|appfolders|dash_to_dock|overlays|panel|window_list)\.js:")

if [[ ${#hits[@]} -gt 0 ]]; then
  echo "Direct .connect() usages outside approved wrappers:"
  printf '%s\n' "${hits[@]}"
  exit 1
fi

echo "Untracked connect check passed."
