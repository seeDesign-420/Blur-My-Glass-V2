#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GNOME_SHELL_DIR="${1:-$ROOT_DIR/src/gnome-shell}"
BASE_PATCH="$ROOT_DIR/patches/rounded_corners_mask.patch"
OVERLAY_PATCH="$ROOT_DIR/patches/liquid_glass_compositor.patch"

if [[ ! -d "$GNOME_SHELL_DIR/.git" ]]; then
  # Fallback for repositories where sources are under ./src/gnome-shell.
  if [[ -d "$ROOT_DIR/src/gnome-shell/.git" ]]; then
    GNOME_SHELL_DIR="$ROOT_DIR/src/gnome-shell"
  else
    echo "ERROR: expected git checkout at: $GNOME_SHELL_DIR"
    echo "Usage: scripts/validate-patches.sh [/path/to/gnome-shell]"
    exit 1
  fi
fi

for patch in "$BASE_PATCH" "$OVERLAY_PATCH"; do
  if [[ ! -f "$patch" ]]; then
    echo "ERROR: missing patch file: $patch"
    exit 1
  fi
done

check_patch_state() {
  local tree="$1"
  local patch="$2"
  local label="$3"

  if git -C "$tree" apply --check "$patch" >/dev/null 2>&1; then
    echo "$label: applies cleanly"
    return 0
  fi

  if git -C "$tree" apply --reverse --check "$patch" >/dev/null 2>&1; then
    echo "$label: already applied"
    return 0
  fi

  echo "ERROR: $label neither applies nor reverses cleanly."
  echo "Patch may be stale or target source may not match expected version."
  return 1
}

cleanup_worktree() {
  local tree="$1"
  local tmp="$2"
  git -C "$tree" worktree remove "$tmp" --force >/dev/null 2>&1 || true
}

echo ":: Validating patch stack in clean detached worktree"
tmp_worktree="$(mktemp -d)"
trap 'cleanup_worktree "$GNOME_SHELL_DIR" "$tmp_worktree"' EXIT

if ! git -C "$GNOME_SHELL_DIR" worktree add --detach "$tmp_worktree" HEAD >/dev/null 2>&1; then
  echo "ERROR: failed to create temporary worktree for patch validation."
  exit 1
fi

echo ":: Validating base patch dry-run"
check_patch_state "$tmp_worktree" "$BASE_PATCH" "rounded_corners_mask.patch"

if ! git -C "$tmp_worktree" apply "$BASE_PATCH" >/dev/null 2>&1; then
  echo "ERROR: rounded_corners_mask.patch failed to apply in clean stack validation."
  exit 1
fi

echo ":: Validating overlay patch dry-run (on top of base patch)"
if git -C "$tmp_worktree" apply --check "$OVERLAY_PATCH" >/dev/null 2>&1; then
  echo "liquid_glass_compositor.patch: applies cleanly on top of base patch"
else
  echo "ERROR: liquid_glass_compositor.patch does not apply cleanly after rounded_corners_mask.patch."
  echo "Patch ordering/content is inconsistent."
  exit 1
fi

echo ":: Validating expected compositor symbols"
if ! rg --quiet "ShellBlurEffect|BlurEffect" "$OVERLAY_PATCH"; then
  echo "ERROR: overlay patch does not mention expected blur symbols."
  exit 1
fi

if ! rg --quiet "MetaBackground|rounded|corner|mask" "$BASE_PATCH"; then
  echo "ERROR: base patch does not mention expected rounded/mask symbols."
  exit 1
fi

echo ":: Validating patch ordering assumptions"
if ! rg --quiet "rounded_corners_mask\\.patch" PKGBUILD; then
  echo "ERROR: PKGBUILD no longer applies rounded_corners_mask.patch."
  exit 1
fi

if ! rg --quiet "liquid_glass_compositor\\.patch" PKGBUILD; then
  echo "ERROR: PKGBUILD no longer references liquid_glass_compositor.patch."
  exit 1
fi

if ! awk '
  /rounded_corners_mask\.patch/ { base = NR }
  /liquid_glass_compositor\.patch/ { overlay = NR }
  END {
    if (!base || !overlay || base > overlay) exit 1;
  }
' PKGBUILD; then
  echo "ERROR: patch ordering invalid in PKGBUILD (base must come before overlay)."
  exit 1
fi

echo "validate-patches.sh: passed"
