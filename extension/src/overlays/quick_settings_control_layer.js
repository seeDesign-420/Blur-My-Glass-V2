import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { DisposableStore } from '../runtime/disposable_store.js';
import {
    OPEN_ANIMATION_DURATION_MS,
    CLOSE_ANIMATION_DURATION_MS,
} from './constants.js';
import { getTransformSize, hasPositiveTransformedSize } from './geometry.js';
import { actorSignature, collectQuickSettingsControls } from './actor_utils.js';
import { QuickSettingsControlBlurSurface } from './quick_settings_control_surface.js';

const MAX_QUICK_SETTINGS_CONTROL_SURFACES = 12;
const MIN_QUICK_SETTINGS_CONTROL_AREA = 900;
const QUICK_SETTINGS_REFRESH_DEBOUNCE_MS = 48;
const QUICK_SETTINGS_CANDIDATE_PRIORITY = Object.freeze({
    header: 0,
    slider: 1,
    'primary-tile': 2,
    'secondary-tile': 3,
    'other-qs': 4,
    'non-qs': 5,
});

const NON_QS_REJECT_PATTERN = /notification|message|media|mpris|calendar|datemenu|date-menu|message-list|messageList/i;
const PRIMARY_TILE_PATTERN = /network|wifi|wireless|bluetooth|power|battery|night|airplane|vpn|dark|light|color|accessibility/i;
const QS_REGION_PATTERN = /quick|system|status|indicator|power|lock|settings|screenshot|dnd|bluetooth|network|wifi|night|airplane|vpn/i;

export class QuickSettingsControlBlurLayer {
    constructor(runtime, menu) {
        this.runtime = runtime;
        this.menu = menu;
        this._surfaces = new Map();
        this._disposables = new DisposableStore();
        this._gridDisposables = new DisposableStore();
        this._refresh_source_id = 0;
        this._open_source_id = 0;
        this._close_source_id = 0;
        this._nextSurfaceId = 1;
        this._overlayContainer = null;
        this._grid = null;
        this._shown = false;
        this._openSettled = false;
        this.destroyed = false;
    }

    enable() {
        if (this.destroyed || !this.menu)
            return;

        this._connect(this.menu, 'open-state-changed', (_menu, open) => {
            if (open) {
                this._cancelCloseHide();
                this._scheduleOpenRefresh();
            } else {
                this._openSettled = false;
                this._scheduleCloseHide();
            }
        });

        if (this.menu.actor)
            this._connect(this.menu.actor, 'destroy', () => this.destroy());

        if (this.isOpen()) {
            this._openSettled = true;
            this.sync();
        }
    }

    isOpen() {
        return Boolean(!this.destroyed && this.menu?.isOpen);
    }

    getOverlayParent() {
        return this._overlayContainer?.get_parent?.() ?? null;
    }

    _connect(obj, signal, callback) {
        try {
            this._disposables.addSignal(obj, signal, callback);
        } catch (e) {
            this.runtime._logSkipOnce('quick-settings', obj, `could not connect ${signal}: ${e}`);
        }
    }

    _connectGrid(grid, signal, callback) {
        try {
            this._gridDisposables.addSignal(grid, signal, callback);
        } catch (e) {
            this.runtime._logSkipOnce('quick-settings', grid, `could not connect ${signal}: ${e}`);
        }
    }

    _resolveGrid() {
        return this.menu?._grid ?? Main.panel?.statusArea?.quickSettings?._system?._grid ?? null;
    }

    _connectGridSignals(grid) {
        if (this._grid === grid)
            return;

        this._gridDisposables.dispose();
        this._gridDisposables = new DisposableStore();
        this._grid = grid;

        if (!grid)
            return;

        this._connectGrid(grid, 'child-added', () => this.queueRefresh());
        this._connectGrid(grid, 'child-removed', () => this.queueRefresh());
        this._connectGrid(grid, 'notify::allocation', () => this.queueRefresh());
        this._connectGrid(grid, 'destroy', () => {
            this._grid = null;
            this._gridDisposables.dispose();
            this._gridDisposables = new DisposableStore();
            this._destroySurfaces();
        });
    }

    _ensureOverlayContainer() {
        const parent = this._resolveOverlayParent();
        if (!parent)
            return false;

        if (!this._overlayContainer) {
            this._overlayContainer = new St.Widget({
                name: 'bms-overlay-quick-settings-layer',
                reactive: false,
                can_focus: false,
                track_hover: false,
                clip_to_allocation: false,
            });
        }

        if (this._overlayContainer.get_parent?.() !== parent) {
            try {
                this._overlayContainer.get_parent?.()?.remove_child(this._overlayContainer);
            } catch {
                // Ignore detach failures.
            }

            try {
                parent.insert_child_below(this._overlayContainer, this._insertActor);
            } catch (e) {
                this.runtime._warn(`failed to show quick-settings layer: ${e}`);
                return false;
            }
        }

        return true;
    }

    _resolveOverlayParent() {
        this._insertActor = this.menu?._boxPointer ?? this.menu?.actor ?? null;
        return this._insertActor?.get_parent?.() ?? null;
    }

    queueRefresh() {
        if (this._refresh_source_id || this.destroyed)
            return;
        if (!this.isOpen() || !this._openSettled)
            return;
        if (this.runtime.isOverlayWorkSuspended()) {
            this.runtime._perfCount('quick-settings.refresh_skipped_suspended');
            return;
        }

        this._refresh_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, QUICK_SETTINGS_REFRESH_DEBOUNCE_MS, () => {
            this._refresh_source_id = 0;
            if (!this.destroyed && this.runtime.enabled)
                this.sync();
            return GLib.SOURCE_REMOVE;
        });
        this._disposables.addSource(this._refresh_source_id);
    }

    _scheduleOpenRefresh() {
        if (this._open_source_id)
            GLib.source_remove(this._open_source_id);

        this._openSettled = false;
        this._open_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, OPEN_ANIMATION_DURATION_MS, () => {
            this._open_source_id = 0;
            this._openSettled = this.isOpen();
            if (!this.destroyed && this._openSettled)
                this.sync();
            return GLib.SOURCE_REMOVE;
        });
        this._disposables.addSource(this._open_source_id);
    }

    _scheduleCloseHide() {
        this._cancelOpenRefresh();
        if (this._close_source_id)
            return;

        this._close_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CLOSE_ANIMATION_DURATION_MS, () => {
            this._close_source_id = 0;
            if (!this.destroyed && !this.isOpen())
                this._destroySurfaces();
            return GLib.SOURCE_REMOVE;
        });
        this._disposables.addSource(this._close_source_id);
    }

    _destroySurfaces() {
        this._shown = false;

        for (const surface of this._surfaces.values())
            surface.destroy();
        this._surfaces.clear();
        this.runtime._perfSet('quick-settings.surface-count', 0);

        if (this._overlayContainer?.get_parent?.()) {
            try {
                this._overlayContainer.get_parent().remove_child(this._overlayContainer);
            } catch {
                // Ignore detach failures.
            }
        }
    }

    suspend() {
        if (this.destroyed)
            return;

        this._openSettled = false;
        this._cancelOpenRefresh();
        this._cancelCloseHide();
        this._destroySurfaces();
    }

    _cancelOpenRefresh() {
        if (!this._open_source_id)
            return;

        GLib.source_remove(this._open_source_id);
        this._open_source_id = 0;
    }

    _cancelCloseHide() {
        if (!this._close_source_id)
            return;

        GLib.source_remove(this._close_source_id);
        this._close_source_id = 0;
    }

    _upsertSurface(actor, boundsActor, shape) {
        let surface = this._surfaces.get(actor);
        if (surface && (surface.shape !== shape || surface.boundsActor !== boundsActor)) {
            surface.destroy();
            this._surfaces.delete(actor);
            surface = null;
        }

        if (!surface) {
            const id = `quick-settings-control-${this._nextSurfaceId++}`;
            surface = new QuickSettingsControlBlurSurface(
                this.runtime,
                this,
                actor,
                boundsActor,
                shape,
                id
            );
            this._surfaces.set(actor, surface);
            surface.enable();
            this.runtime._perfCount('quick-settings.surfaces_created');
            return surface;
        }

        surface.boundsActor = boundsActor;
        surface.shape = shape;
        surface.sync();
        return surface;
    }

    _isEligiblePerControlActor(actor) {
        if (!actor || !actor.visible || !actor.mapped)
            return false;

        const [width, height] = getTransformSize(actor);
        return (width * height) >= MIN_QUICK_SETTINGS_CONTROL_AREA;
    }

    _collectSurfaceCandidates(grid) {
        const { controls, diagnostics } = collectQuickSettingsControls(grid);
        const classifiedControls = controls.map(control => this._classifyRawCandidate(control));
        const rejectedNonQsControls = classifiedControls
            .filter(control => control.category === 'non-qs')
            .map(control => ({ ...control, reason: 'non-qs-notification-media-message' }));
        const qsControls = classifiedControls
            .filter(control => control.category !== 'non-qs');
        const { controls: dedupedControls, dropped: dedupedControlsDropped } =
            this._dedupeCandidates(qsControls);
        const eligibleControls = [];
        const skippedEligibleControls = [];

        for (const control of dedupedControls) {
            if (!this._isEligiblePerControlActor(control.boundsActor ?? control.actor)) {
                skippedEligibleControls.push({ ...control, reason: 'too-small' });
                continue;
            }

            eligibleControls.push(control);
        }

        const sortedControls = this._sortCandidatesByPriority(eligibleControls);
        const capHit = sortedControls.length > MAX_QUICK_SETTINGS_CONTROL_SURFACES;
        if (capHit)
            this.runtime._perfCount('quick-settings.surface_cap_hits');

        const selectedControls = sortedControls.slice(0, MAX_QUICK_SETTINGS_CONTROL_SURFACES);
        const cappedControls = capHit ?
            sortedControls.slice(MAX_QUICK_SETTINGS_CONTROL_SURFACES) : [];

        this._logCandidateDiagnostics(
            diagnostics,
            controls,
            rejectedNonQsControls,
            dedupedControls,
            dedupedControlsDropped,
            sortedControls,
            selectedControls,
            skippedEligibleControls,
            cappedControls,
            capHit
        );

        return selectedControls;
    }

    _isStButton(actor) {
        try {
            return actor instanceof St.Button;
        } catch {
            return actor?.constructor?.name === 'Button';
        }
    }

    _candidateText(control) {
        return [control.actor, control.boundsActor, ...(control.ancestors ?? [])]
            .filter(Boolean)
            .map(actor => actorSignature(actor))
            .join(' ');
    }

    _isNonQsCandidate(control) {
        return NON_QS_REJECT_PATTERN.test(this._candidateText(control));
    }

    _isInQuickSettingsControlRegion(control) {
        if (control.inHeader || control.controlKind !== 'button')
            return true;

        return QS_REGION_PATTERN.test(this._candidateText(control));
    }

    _classifyRawCandidate(control) {
        const styleClass = control.actor?.get_style_class_name?.() ?? '';
        let category = 'other-qs';

        if (this._isNonQsCandidate(control)) {
            category = 'non-qs';
        } else if (control.isHeaderButton || control.inHeader) {
            category = 'header';
        } else if (styleClass.includes('quick-slider') || control.controlKind === 'slider') {
            category = 'slider';
        } else if (styleClass.includes('quick-toggle') || styleClass.includes('quick-toggle-has-menu') ||
            control.controlKind === 'toggle') {
            category = PRIMARY_TILE_PATTERN.test(this._candidateText(control)) ?
                'primary-tile' : 'secondary-tile';
        } else if (this._isStButton(control.actor) && !this._isInQuickSettingsControlRegion(control)) {
            category = 'non-qs';
        }

        return {
            ...control,
            category,
            priority: QUICK_SETTINGS_CANDIDATE_PRIORITY[category],
        };
    }

    _candidateRect(control) {
        const actor = control.boundsActor ?? control.actor;
        const [x, y] = actor?.get_transformed_position?.() ?? [actor?.x ?? 0, actor?.y ?? 0];
        const [width, height] = getTransformSize(actor);
        return { x, y, width, height, area: Math.max(0, width * height) };
    }

    _isAncestorActor(parent, child) {
        if (!parent || !child || parent === child)
            return false;

        let current = child.get_parent?.() ?? null;
        const visited = new Set();
        while (current && !visited.has(current)) {
            if (current === parent)
                return true;

            visited.add(current);
            current = current.get_parent?.() ?? null;
        }

        return false;
    }

    _overlapRatio(a, b) {
        const rectA = this._candidateRect(a);
        const rectB = this._candidateRect(b);
        const left = Math.max(rectA.x, rectB.x);
        const top = Math.max(rectA.y, rectB.y);
        const right = Math.min(rectA.x + rectA.width, rectB.x + rectB.width);
        const bottom = Math.min(rectA.y + rectA.height, rectB.y + rectB.height);
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);
        const minArea = Math.max(1, Math.min(rectA.area, rectB.area));
        return (width * height) / minArea;
    }

    _compareDedupePreference(candidate, existing) {
        if (candidate.category === 'header' && existing.category !== 'header')
            return -1;
        if (existing.category === 'header' && candidate.category !== 'header')
            return 1;

        if (this._isAncestorActor(candidate.actor, existing.actor))
            return 1;
        if (this._isAncestorActor(existing.actor, candidate.actor))
            return -1;

        if (candidate.priority !== existing.priority)
            return candidate.priority - existing.priority;

        const candidateArea = this._candidateRect(candidate).area;
        const existingArea = this._candidateRect(existing).area;
        if (candidateArea !== existingArea)
            return candidateArea - existingArea;

        return actorSignature(candidate.actor).localeCompare(actorSignature(existing.actor));
    }

    _dedupeCandidates(candidates) {
        const controls = [];
        const dropped = [];

        for (const candidate of candidates) {
            let replaced = false;
            let duplicateIndex = -1;

            for (let i = 0; i < controls.length; i++) {
                const existing = controls[i];
                const nested = this._isAncestorActor(candidate.actor, existing.actor) ||
                    this._isAncestorActor(existing.actor, candidate.actor);
                const overlapping = this._overlapRatio(candidate, existing) >= 0.85;

                if (!nested && !overlapping)
                    continue;

                duplicateIndex = i;
                const comparison = this._compareDedupePreference(candidate, existing);
                if (comparison < 0) {
                    controls[i] = candidate;
                    dropped.push({
                        ...existing,
                        reason: `dedupe:${actorSignature(candidate.actor)}`,
                    });
                    replaced = true;
                } else {
                    dropped.push({
                        ...candidate,
                        reason: `dedupe:${actorSignature(existing.actor)}`,
                    });
                }
                break;
            }

            if (duplicateIndex === -1)
                controls.push(candidate);
            else if (replaced)
                continue;
        }

        return { controls, dropped };
    }

    _sortCandidatesByPriority(candidates) {
        return [...candidates].sort((a, b) => {
            if (a.priority !== b.priority)
                return a.priority - b.priority;

            const rectA = this._candidateRect(a);
            const rectB = this._candidateRect(b);
            const yDiff = Math.round(rectA.y) - Math.round(rectB.y);
            if (yDiff !== 0)
                return yDiff;

            const xDiff = Math.round(rectA.x) - Math.round(rectB.x);
            if (xDiff !== 0)
                return xDiff;

            return actorSignature(a.actor).localeCompare(actorSignature(b.actor));
        });
    }

    _describeActor(actor) {
        const [width, height] = getTransformSize(actor);
        const roundedWidth = Math.round(width);
        const roundedHeight = Math.round(height);
        return `${actorSignature(actor)} size=${roundedWidth}x${roundedHeight} area=${Math.round(width * height)}`;
    }

    _formatReasonCounts(reasonCounts) {
        if (!reasonCounts || reasonCounts.size === 0)
            return '{}';

        return `{${[...reasonCounts.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([reason, count]) => `${reason}=${count}`)
            .join(', ')}}`;
    }

    _incrementReason(reasonCounts, reason) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }

    _logCandidateDiagnostics(diagnostics, rawControls, rejectedNonQsControls,
        dedupedControls, dedupedControlsDropped, sortedControls, selectedControls,
        skippedEligibleControls, cappedControls, capHit) {
        if (!this.runtime.settings.DEBUG)
            return;

        const capConsumers = selectedControls
            .map((control, index) =>
                `${index + 1}:${actorSignature(control.actor)} category=${control.category}`)
            .join(' | ');
        const sortedCandidates = sortedControls
            .map((control, index) =>
                `${index + 1}:${actorSignature(control.actor)} category=${control.category}`)
            .join(' | ');

        this.runtime._log('quick-settings candidate summary ' +
            `totalRawCandidates=${rawControls.length} ` +
            `rejectedNonQsNotificationMediaMessageCandidates=${rejectedNonQsControls.length} ` +
            `selectedAfterDedupe=${dedupedControls.length} ` +
            `selectedAfterPrioritySort=${sortedControls.length} ` +
            `capConsumers=${capConsumers || '<none>'}`);

        this.runtime._log(`quick-settings priority-order selectedAfterPrioritySort=${sortedCandidates || '<none>'}`);

        for (const decision of diagnostics.decisions) {
            if (decision.state === 'TARGET')
                continue;

            this.runtime._log(`quick-settings candidate ${decision.state.toLowerCase()} ` +
                `${this._describeActor(decision.actor)} reason=${decision.reason}` +
                ` inHeader=${decision.inHeader}`);
        }

        for (const control of selectedControls) {
            this.runtime._log(`quick-settings candidate selected ${this._describeActor(control.actor)} ` +
                `category=${control.category} shape=${control.shape} ` +
                `bounds=${actorSignature(control.boundsActor ?? control.actor)} ` +
                `inHeader=${control.inHeader}`);
        }

        for (const control of rejectedNonQsControls) {
            this.runtime._log(`quick-settings candidate skipped ${this._describeActor(control.actor)} ` +
                `category=${control.category} shape=${control.shape} reason=${control.reason} ` +
                `bounds=${actorSignature(control.boundsActor ?? control.actor)} inHeader=${control.inHeader}`);
        }

        for (const control of dedupedControlsDropped) {
            this.runtime._log(`quick-settings candidate skipped ${this._describeActor(control.actor)} ` +
                `category=${control.category} shape=${control.shape} reason=${control.reason} ` +
                `bounds=${actorSignature(control.boundsActor ?? control.actor)} inHeader=${control.inHeader}`);
        }

        for (const control of skippedEligibleControls) {
            this.runtime._log(`quick-settings candidate skipped ${this._describeActor(control.actor)} ` +
                `category=${control.category} shape=${control.shape} reason=${control.reason} ` +
                `bounds=${actorSignature(control.boundsActor ?? control.actor)} inHeader=${control.inHeader}`);
        }

        if (capHit) {
            this.runtime._log(`quick-settings cap-hit max=${MAX_QUICK_SETTINGS_CONTROL_SURFACES} ` +
                `consumers=${capConsumers}`);

            for (const control of cappedControls) {
                this.runtime._log(`quick-settings candidate skipped ${this._describeActor(control.actor)} ` +
                    `category=${control.category} shape=${control.shape} reason=cap ` +
                    `bounds=${actorSignature(control.boundsActor ?? control.actor)} ` +
                    `inHeader=${control.inHeader}`);
            }
        }

        if (selectedControls.some(control => control.category === 'non-qs')) {
            this.runtime._warn('quick-settings candidate invariant failed: ' +
                'non-qs candidate consumed a cap slot');
        }

        const selectedHeaderActors = new Set(selectedControls
            .filter(control => diagnostics.headerButtons.has(control.actor))
            .map(control => control.actor));
        const skippedReasons = new Map(diagnostics.headerSkippedReasons);
        const skippedHeaderActors = new Set(diagnostics.headerSkippedActors.keys());
        const missingHeaderReasons = new Map();

        const recordMissingHeader = (actor, reason) => {
            if (!diagnostics.headerButtons.has(actor))
                return;
            skippedHeaderActors.add(actor);
            missingHeaderReasons.set(actor, reason);
            this._incrementReason(skippedReasons, reason.split(':')[0]);
        };

        for (const control of rejectedNonQsControls)
            recordMissingHeader(control.actor, control.reason);

        for (const control of dedupedControlsDropped)
            recordMissingHeader(control.actor, control.reason);

        for (const control of skippedEligibleControls) {
            recordMissingHeader(control.actor, control.reason);
        }

        for (const control of cappedControls) {
            recordMissingHeader(control.actor, 'cap');
        }

        for (const actor of diagnostics.headerButtons) {
            if (selectedHeaderActors.has(actor))
                continue;
            if (!skippedHeaderActors.has(actor)) {
                skippedHeaderActors.add(actor);
                missingHeaderReasons.set(actor, diagnostics.headerSkippedActors.get(actor) ?? 'unknown');
                this._incrementReason(skippedReasons, 'unknown');
            }
        }

        const visibleHeaderButtonsFound = diagnostics.headerButtons.size;
        const headerButtonTargetsSelected = selectedHeaderActors.size;
        const headerButtonsSkipped = Math.max(0,
            visibleHeaderButtonsFound - headerButtonTargetsSelected);

        this.runtime._log('quick-settings header summary ' +
            `visibleHeaderButtonsFound=${visibleHeaderButtonsFound} ` +
            `headerButtonTargetsSelected=${headerButtonTargetsSelected} ` +
            `headerButtonsSkipped=${headerButtonsSkipped} ` +
            `skippedReasons=${this._formatReasonCounts(skippedReasons)} ` +
            `capHit=${capHit}`);

        if (visibleHeaderButtonsFound === 6 && headerButtonTargetsSelected < 6) {
            for (const actor of diagnostics.headerButtons) {
                if (selectedHeaderActors.has(actor))
                    continue;

                const reason = missingHeaderReasons.get(actor) ??
                    diagnostics.headerSkippedActors.get(actor) ?? 'unknown';
                if (reason === 'cap' && selectedControls.some(control => control.category !== 'header')) {
                    this.runtime._warn('quick-settings header cap invariant failed: ' +
                        'a lower-priority control consumed cap before a missing header button');
                }
                this.runtime._warn(`quick-settings missing header button ` +
                    `${actorSignature(actor)} reason=${reason}`);
            }
        }

        if (visibleHeaderButtonsFound > headerButtonTargetsSelected && !capHit) {
            this.runtime._warn('quick-settings header target invariant failed: ' +
                'visibleHeaderButtonsFound is greater than headerButtonTargetsSelected while capHit=false');
        }
    }

    sync() {
        if (this.destroyed)
            return;

        if (!this.runtime.isTargetEnabled('quick-settings')) {
            this._destroySurfaces();
            return;
        }

        if (!this.isOpen()) {
            this._scheduleCloseHide();
            return;
        }

        if (!this._openSettled)
            return;

        if (this.runtime.isOverlayWorkSuspended()) {
            this.runtime._perfCount('surfaces.create_blocked_suspended');
            return;
        }

        this._cancelCloseHide();

        const grid = this._resolveGrid();
        this._connectGridSignals(grid);

        if (!grid || !hasPositiveTransformedSize(grid) || !this._ensureOverlayContainer()) {
            this._destroySurfaces();
            return;
        }

        this._shown = true;

        const keepActors = new Set();
        for (const { actor, boundsActor, shape } of this._collectSurfaceCandidates(grid)) {
            keepActors.add(actor);
            this._upsertSurface(actor, boundsActor, shape);
        }

        for (const [actor, surface] of this._surfaces.entries()) {
            if (!keepActors.has(actor)) {
                surface.destroy();
                this._surfaces.delete(actor);
            }
        }

        for (const surface of this._surfaces.values())
            surface.sync();

        this.runtime._perfSet('quick-settings.surface-count', this._surfaces.size);
    }

    destroy() {
        if (this.destroyed)
            return;

        this.destroyed = true;
        this._refresh_source_id = 0;
        this._open_source_id = 0;
        this._close_source_id = 0;
        this._openSettled = false;
        this._disposables.dispose();
        this._gridDisposables.dispose();
        this._destroySurfaces();
    }
}
