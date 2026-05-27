# Post-Pipeline Legacy Inventory

Generated for the post-pipeline rewire pass. This inventory records the remaining references to removed pipeline/static/customize-era concepts before any schema or runtime cleanup.

## Classification Legend

- `ACTIVE_RUNTIME`: still used by current extension runtime
- `ACTIVE_PREFS`: still used by active preferences UI
- `MIGRATION_ONLY`: only used to migrate old settings
- `SCHEMA_ONLY`: present in schema but not used by active runtime or prefs
- `DOCS_ONLY`: documentation or translation text only
- `DEAD`: stale reference to removed code/resources

## Inventory

| Reference | Location | Class | Action | Notes |
| --- | --- | --- | --- | --- |
| `DynamicBlurPipeline` runtime paths | `extension/src/components/*.js`, `extension/src/overlays/*.js`, `extension/src/integrations/*.js` | `ACTIVE_RUNTIME` | keep | This is the current blur implementation and not legacy. |
| `pipeline` as internal object naming for `DynamicBlurPipeline` instances | runtime component files, `extension/src/runtime/disposable_store.js` | `ACTIVE_RUNTIME` | keep | Variable names and helper method names refer to the active dynamic pipeline, not the removed custom pipeline system. |
| `customize`, `color`, `noise-amount`, `noise-lightness`, `color-and-noise` in `DEPRECATED_KEYS` | `extension/src/conveniences/keys.js` | `MIGRATION_ONLY` | remove in atomic settings commit | Only `settings_updater.js` consumes these keys today. |
| Deprecated migration branch using `deprecated_preferences` and `CUSTOMIZE` | `extension/src/conveniences/settings_updater.js` | `MIGRATION_ONLY` | remove or rewrite in atomic settings commit | The `old_version < 2` branch is the only live consumer of the deprecated key contract. |
| Global legacy keys `sigma`, `brightness`, `color`, `noise-*`, `color-and-noise` | root schema in `extension/schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml` | `SCHEMA_ONLY` | remove in atomic settings commit | Active runtime reads component-specific settings via `KEYS`; the global legacy keys only exist for the deprecated migration path. |
| Component legacy keys `customize`, `color`, `noise-*` | component schemas in `extension/schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml` | `SCHEMA_ONLY` | remove in atomic settings commit | Present in overview, appfolder, panel, dhruva, applications, and lockscreen schemas without active runtime/prefs use. |
| Stale pipeline UI resource references | `extension/po/*.po`, `extension/po/blur-my-shell@aunetx.pot` | `DEAD` | clean in docs/translation pass | Refer to removed resources like `effects-dialog.ui`, `pipeline-choose-row.ui`, `pipeline-group.ui`, and `pipelines.ui`. |
| Pipeline editor strings | `extension/po/*.po`, `extension/po/blur-my-shell@aunetx.pot` | `DOCS_ONLY` | clean in docs/translation pass | Strings such as `Pipeline`, `Pipelines`, `Add Pipeline`, and `The pipeline to be used with this component.` describe removed UI. |
| Static/custom pipeline product docs | `extension/README.md` | `DOCS_ONLY` | rewrite in docs pass | README still describes static blur, pipeline management, and old application blur modes. |
| Architecture history mentioning removed static/custom pipeline runtime | `docs/backend-runtime-architecture.md` | `DOCS_ONLY` | keep with clarification | This file documents historical architecture; update wording only if needed to make the removal status explicit. |
| Refactor audit references to dynamic pipeline split | `docs/refactor-completion-audit.md` | `DOCS_ONLY` | keep | These references describe the current dynamic implementation, not the removed custom pipeline system. |
| `An effect that blends a color into the pipeline.` | `extension/src/effects/effects.js`, `extension/po/*.po`, `extension/po/blur-my-shell@aunetx.pot` | `DOCS_ONLY` | defer | Legacy terminology remains in effect metadata, but effect/shader removal is outside this pass unless proven fully unreferenced. |
| Legacy effect/shader implementation files such as `extension/src/effects/color.js` and `extension/src/effects/color.glsl` | `extension/src/effects/` | `DEAD` | defer to later dead-code cleanup pass | These appear disconnected from active settings/schema cleanup, but should not be deleted in this pass without a separate reference audit. |
| `Recommended unless you want to customize your GNOME theme.` | `extension/resources/ui/panel.ui`, `extension/po/*.po`, `extension/po/blur-my-shell@aunetx.pot` | `ACTIVE_PREFS` | keep | Uses the English verb “customize” in theme guidance, unrelated to the removed `customize` schema key. |
| `lockscreen — to customize the already existing blur` | `extension/README.md` | `DOCS_ONLY` | rewrite in docs pass | User-facing wording implies the old upstream model and should be updated with the current dynamic-only explanation. |

## Deferred Removals

The following items should not be deleted in this pass unless a separate proof shows they are fully unreferenced and independent of schema/migration cleanup:

- legacy effect/shader implementation files under `extension/src/effects/`
- effect metadata strings that still use pipeline terminology
- historical architecture notes in docs that are still useful as audit context

## Planned Follow-up in This Pass

1. Remove deprecated schema and migration keys atomically across schema XML, `KEYS`, `DEPRECATED_KEYS`, and `settings_updater.js`.
2. Validate schema compilation and schema contract consistency immediately after the settings-contract commit.
3. Rewrite stale README and translation template/catalog references that still describe removed pipeline/static UI.
