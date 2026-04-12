# Maintainer: seeDesign-420
# Based on Arch Linux extra/gnome-shell PKGBUILD
# Original maintainers:
#   Jan Alexander Steffens (heftig) <heftig@archlinux.org>
#   Fabian Bornschein <fabiscafe@archlinux.org>

pkgbase=gnome-shell-rounded-blur
pkgname=(
  gnome-shell-rounded-blur
  gnome-shell-rounded-blur-docs
)
pkgver=50.0
pkgrel=1
epoch=1
pkgdesc="GNOME Shell with rounded blur mask for blur-my-shell (liquid glass capable)"
url="https://github.com/seeDesign-420/blur-my-glass"
arch=(x86_64)
license=(GPL-3.0-or-later)
depends=(
  accountsservice
  at-spi2-core
  bash
  cairo
  dconf
  gcr-4
  gdk-pixbuf2
  gjs
  glib2
  glibc
  gnome-autoar
  gnome-desktop-4
  gnome-session
  gnome-settings-daemon
  graphene
  gsettings-desktop-schemas
  gtk4
  hicolor-icon-theme
  ibus
  json-glib
  libadwaita
  libcanberra-pulse
  libgcc
  libgdm
  libglvnd
  libgweather-4
  libibus
  libical
  libnm
  libnma-gtk4
  libpipewire
  libpulse
  libsecret
  libsoup3
  libx11
  libxext
  libxfixes
  mutter
  pango
  polkit
  systemd-libs
  unzip
  upower
  webkitgtk-6.0
)
makedepends=(
  asciidoc
  bash-completion
  evolution-data-server
  gi-docgen
  git
  glib2-devel
  gnome-keybindings
  gobject-introspection
  meson
  python-docutils
  sassc
)

# --- Patch selection ---
# Set BLUR_PATCH env var before building to choose the patch:
#   BLUR_PATCH=liquid_glass  makepkg -si    # full liquid glass compositor
#   makepkg -si                              # default: rounded corners mask
_patch="${BLUR_PATCH:-rounded_corners_mask}"
_patchfile="${_patch}.patch"

source=(
  # GNOME Shell tags use SSH signatures which makepkg doesn't understand
  "git+https://gitlab.gnome.org/GNOME/gnome-shell.git#tag=${pkgver/[a-z]/.&}"
  "git+https://gitlab.gnome.org/GNOME/libgnome-volume-control.git#commit=664eba4c054ecc4a140f0ef01ae9297422b71fdc"
  "git+https://github.com/ptomato/jasmine-gjs.git#commit=856465dddbd92e82e574891e1ebc79e17d7b708a"
  "git+https://gitlab.gnome.org/GNOME/libshew.git#commit=ed782477cb5164320ae4f731d49bc5d475ab2a52"
)
b2sums=('1dc5c04956466cf3d98498defdac415dbf54f2e49fd7f84e9c4e95ae20154a11a39101f834993d03ae306bad310787829e329f6420c3114a5ceadfc811a147cc'
        '535b45732b09204639930a88f6578f5d3e81239aed857c12cf084351a6ecd45fff262da6ff9f74ac48d1d7a92b1a90dbe708a4e8131f789aace7e27482220a9a'
        'ecbbb9ce5895cc1caed2ddef39c70b4768d78ea0a929ea932d4149f923f92650973cdaefc2aacc9063f2ccf4ec965b57a9698a286f9a6561e39ce2e579ae4522'
        'ec120324e4fe90fb8017847e5eda3c0b181b6609b78610b3a61ea106ee4d56d2b3bf243c3bc5d3ddd59fe55bb5ceed4f55b41f09626137027ed1c3e27930d082')

prepare() {
  # Inject gvc
  ln -sf libgnome-volume-control gvc

  # Copy selected patch into srcdir
  cp "$startdir/patches/${_patchfile}" "$srcdir/${_patchfile}"

  cd gnome-shell
  echo ":: Applying patch: ${_patchfile}"
  patch -p1 -i "$srcdir/${_patchfile}"
}

build() {
  local meson_options=(
    -D gtk_doc=true
    -D tests=false
  )

  CFLAGS="${CFLAGS/-O2/-O3} -fno-semantic-interposition"
  LDFLAGS+=" -Wl,-Bsymbolic-functions"

  # Inject subprojects
  export MESON_PACKAGE_CACHE_DIR="$srcdir"

  arch-meson gnome-shell build "${meson_options[@]}"
  meson compile -C build
}

package_gnome-shell-rounded-blur() {
  provides=('gnome-shell')
  conflicts=('gnome-shell' 'gnome-shell-debug')
  depends+=(libmutter-18.so)
  optdepends=(
    'evolution-data-server: Evolution calendar integration'
    'gnome-bluetooth-3.0: Bluetooth support'
    'gnome-control-center: System settings'
    'gnome-disk-utility: Mount with keyfiles'
    'gst-plugin-pipewire: Screen recording'
    'gst-plugins-good: Screen recording'
    'power-profiles-daemon: Power profile switching'
    'python-gobject: gnome-shell-test-tool performance tester'
    'python-simplejson: gnome-shell-test-tool performance tester'
    'switcheroo-control: Multi-GPU support'
  )
  groups=(gnome)

  meson install -C build --destdir "$pkgdir"

  install -Dm644 /dev/stdin "$pkgdir/usr/share/glib-2.0/schemas/30_org.archlinux.$pkgname.gschema.override" <<END
[org.gnome.mutter:GNOME]
experimental-features=['scale-monitor-framebuffer', 'variable-refresh-rate', 'xwayland-native-scaling']
END

  mkdir -p doc/usr/share
  mv {"$pkgdir",doc}/usr/share/doc
}

package_gnome-shell-rounded-blur-docs() {
  pkgdesc+=" (API documentation)"
  depends=()

  mv doc/* "$pkgdir"
}

# vim:set sw=2 sts=-1 et:
