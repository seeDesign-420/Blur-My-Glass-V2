#!/usr/bin/env bash
# blur-my-glass installer
# https://github.com/seeDesign-420/blur-my-glass
#
# Usage:
#   ./install.sh                    # Build shell + extension
#   ./install.sh --shell-only       # Build only the patched shell package
#   ./install.sh --extension-only   # Install only the extension fork
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
INSTALL_SHELL=true
INSTALL_EXTENSION=true

for arg in "$@"; do
  case "$arg" in
    --liquid-glass)  PATCH="liquid_glass_compositor" ;;
    --noconfirm)     MAKEPKG_FLAGS="-si --noconfirm" ;;
    --clean)         CLEAN=true ;;
    --shell-only)    INSTALL_EXTENSION=false ;;
    --extension-only) INSTALL_SHELL=false ;;
    --help|-h)
      echo "blur-my-glass installer"
      echo ""
      echo "Usage: ./install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --shell-only     Build only the patched shell package"
      echo "  --extension-only Install only the extension fork"
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

if [[ "$INSTALL_SHELL" == false && "$INSTALL_EXTENSION" == false ]]; then
  die "Nothing selected — choose at least one of --shell-only or --extension-only"
fi

# ── Preflight checks ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Must be Arch Linux (or derivative) for shell builds
if [[ "$INSTALL_SHELL" == true ]] && ! command -v makepkg &>/dev/null; then
  die "makepkg not found — this installer requires Arch Linux (or an Arch-based distro)"
fi

if [[ "$INSTALL_EXTENSION" == true ]] && ! command -v gnome-extensions &>/dev/null; then
  warn "gnome-extensions not found — extension installation may fail"
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
  rm -rf extension/build/
  rm -f extension/po/*.mo
  rm -f *.pkg.tar* *.log
  if [[ -d extension ]]; then
    make -C extension clean >/dev/null 2>&1 || true
  fi
  ok "Clean complete"
fi

# ── Build shell package ────────────────────────────────────────────────────
if [[ "$INSTALL_SHELL" == true ]]; then
  info "Installing makedepends (if needed)..."

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

  info "Building shell package with ${BOLD}${PATCH}${RESET} patch..."
  echo ""
  BLUR_PATCH="$PATCH" makepkg $MAKEPKG_FLAGS
fi

# ── Build extension package ────────────────────────────────────────────────
if [[ "$INSTALL_EXTENSION" == true ]]; then
  info "Installing bundled extension..."
  make -C extension install
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}║          Installation complete!          ║${RESET}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${RESET}"
echo ""
if [[ "$INSTALL_SHELL" == true && "$INSTALL_EXTENSION" == true ]]; then
  info "Log out and back in (or reboot) to activate the shell and extension changes."
elif [[ "$INSTALL_SHELL" == true ]]; then
  info "Log out and back in (or reboot) to activate the patched GNOME Shell."
else
  info "Restart GNOME Shell or log out and back in to reload the extension."
fi
echo ""
