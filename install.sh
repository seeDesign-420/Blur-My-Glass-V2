#!/usr/bin/env bash
# blur-my-glass installer
# https://github.com/seeDesign-420/blur-my-glass
#
# Usage:
#   ./install.sh                    # Build with rounded corners mask (default)
#   ./install.sh --liquid-glass     # Build with full liquid glass compositor
#   ./install.sh --noconfirm        # Skip pacman confirmation prompts
#   ./install.sh --clean            # Clean build artifacts before building
#
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "${CYAN}::${RESET} ${BOLD}$*${RESET}"; }
ok()    { echo -e "${GREEN}✓${RESET} $*"; }
warn()  { echo -e "${YELLOW}⚠${RESET} $*"; }
err()   { echo -e "${RED}✗${RESET} $*" >&2; }
die()   { err "$@"; exit 1; }

# ── Parse args ──────────────────────────────────────────────────────────────
PATCH="rounded_corners_mask"
MAKEPKG_FLAGS="-si"
CLEAN=false

for arg in "$@"; do
  case "$arg" in
    --liquid-glass)  PATCH="liquid_glass_compositor" ;;
    --noconfirm)     MAKEPKG_FLAGS="-si --noconfirm" ;;
    --clean)         CLEAN=true ;;
    --help|-h)
      echo "blur-my-glass installer"
      echo ""
      echo "Usage: ./install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --liquid-glass   Use the liquid glass compositor patch (experimental)"
      echo "  --noconfirm      Skip pacman confirmation prompts"
      echo "  --clean          Remove previous build artifacts before building"
      echo "  -h, --help       Show this help"
      exit 0
      ;;
    *)
      die "Unknown option: $arg (try --help)"
      ;;
  esac
done

# ── Preflight checks ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Must be Arch Linux (or derivative)
if ! command -v makepkg &>/dev/null; then
  die "makepkg not found — this installer requires Arch Linux (or an Arch-based distro)"
fi

# Verify patch files exist
if [[ ! -f "patches/rounded_corners_mask.patch" ]]; then
  die "Base patch not found: patches/rounded_corners_mask.patch"
fi
if [[ "$PATCH" == "liquid_glass_compositor" ]] && [[ ! -f "patches/liquid_glass_compositor.patch" ]]; then
  die "Overlay patch not found: patches/liquid_glass_compositor.patch"
fi

# ── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║        ${CYAN}blur-my-glass${RESET}${BOLD} installer           ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""
info "Base patch: ${BOLD}rounded_corners_mask${RESET}"
if [[ "$PATCH" == "liquid_glass_compositor" ]]; then
  info "Overlay:    ${BOLD}liquid_glass_compositor${RESET}"
fi
info "GNOME Shell version: ${BOLD}50.0${RESET}"
echo ""

# ── Clean previous build ───────────────────────────────────────────────────
if [[ "$CLEAN" == true ]]; then
  info "Cleaning previous build artifacts..."
  rm -rf src/ pkg/ gnome-shell/ libgnome-volume-control/ jasmine-gjs/ libshew/ gvc build/
  rm -f *.pkg.tar* *.log
  ok "Clean complete"
fi

# ── Build & install ─────────────────────────────────────────────────────────
info "Installing makedepends (if needed)..."

# Check if any makedepends are missing
MAKEDEPS=(asciidoc bash-completion evolution-data-server gi-docgen git glib2-devel gnome-keybindings gobject-introspection meson python-docutils sassc)
MISSING=()
for dep in "${MAKEDEPS[@]}"; do
  if ! pacman -Qi "$dep" &>/dev/null; then
    MISSING+=("$dep")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  warn "Missing makedepends: ${MISSING[*]}"
  info "Installing them now..."
  sudo pacman -S --needed --noconfirm "${MISSING[@]}"
fi

info "Building gnome-shell-rounded-blur with ${BOLD}${PATCH}${RESET} patch..."
echo ""

BLUR_PATCH="$PATCH" makepkg $MAKEPKG_FLAGS

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}║          Installation complete!          ║${RESET}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${RESET}"
echo ""
info "Log out and back in (or reboot) to activate the patched GNOME Shell."
echo ""
