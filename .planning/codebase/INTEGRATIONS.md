# Integrations

## Upstream Integration
- **GNOME Shell:** Pulls from `gitlab.gnome.org/GNOME/gnome-shell.git`
- **Subprojects:** Pulls `libgnome-volume-control`, `jasmine-gjs`, `libshew` as part of the GNOME Shell build process.

## Extension Integration
- **blur-my-shell:** This patched compositor exposes new GObject properties (`corner-radius`, `refraction-strength`) on `ShellBlurEffect`. The `blur-my-shell` extension (or other extensions) interacts with these properties at runtime via GJS to control the blur appearance.

*(Generated on 2026-04-29)*
