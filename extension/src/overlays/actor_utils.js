import St from 'gi://St';
import { getTransformSize, isPositiveSize } from './geometry.js';

export const QUICK_SETTINGS_FILTER_STATE = Object.freeze({
    TARGET: 'TARGET',
    TRAVERSE_ONLY: 'TRAVERSE_ONLY',
    IGNORE_SUBTREE: 'IGNORE_SUBTREE',
});

export function actorSignature(actor) {
    if (!actor)
        return '<null>';

    const typeName = actor.constructor?.name ?? 'UnknownActor';
    const name = actor.get_name?.() ?? '';
    const styleClass = actor.get_style_class_name?.() ?? '';
    return `${typeName}:${name}:${styleClass}`;
}

export function resolveBoxPointer(actor) {
    if (!actor)
        return null;

    if (actor.bin)
        return actor;

    const boxPointer = actor._boxPointer ?? actor._delegate?._boxPointer ?? null;
    if (boxPointer?.bin)
        return boxPointer;

    return null;
}

export function isDrawingArea(actor) {
    try {
        return actor instanceof St.DrawingArea;
    } catch {
        return actor?.constructor?.name === 'DrawingArea';
    }
}

export function resolvePopupContentActor(actor) {
    if (!actor)
        return null;

    const delegate = actor._delegate ?? actor._boxPointer?._delegate ?? null;
    if (delegate?.box)
        return delegate.box;

    const boxPointer = resolveBoxPointer(actor);
    if (boxPointer?.bin?.get_child) {
        const child = boxPointer.bin.get_child();
        if (child)
            return child;
    }

    const candidates = [];
    const queue = [...(actor.get_children?.() ?? [])];
    while (queue.length > 0) {
        const child = queue.shift();
        if (!child)
            continue;

        if (child.visible && child.mapped && isPositiveSize(child) && !isDrawingArea(child))
            candidates.push(child);

        const children = child.get_children?.();
        if (children?.length)
            queue.push(...children);
    }

    if (candidates.length > 0) {
        candidates.sort((a, b) => {
            const areaA = (a.width ?? a.get_width?.() ?? 0) * (a.height ?? a.get_height?.() ?? 0);
            const areaB = (b.width ?? b.get_width?.() ?? 0) * (b.height ?? b.get_height?.() ?? 0);
            return areaB - areaA;
        });
        return candidates[0];
    }

    return actor;
}

export function isManagedOverlayActor(actor) {
    if (!actor)
        return false;

    const name = actor.get_name?.() ?? '';
    if (name.startsWith('bms-overlay-'))
        return true;

    const styleClass = actor.get_style_class_name?.() ?? '';
    return styleClass.includes('bms-overlay-');
}

function isStButton(actor) {
    try {
        return actor instanceof St.Button;
    } catch {
        return actor?.constructor?.name === 'Button';
    }
}

function getActorChildren(actor) {
    return actor?.get_children?.() ?? [];
}

function isActorDestroyed(actor) {
    if (!actor)
        return true;

    try {
        if (actor.destroyed || actor.is_destroyed?.())
            return true;
    } catch {
        return true;
    }

    return false;
}

function getIgnoreSubtreeReason(actor) {
    if (!actor)
        return 'null-actor';
    if (isActorDestroyed(actor))
        return 'destroyed';
    if (isManagedOverlayActor(actor))
        return 'extension-blur-actor';
    if (isDrawingArea(actor))
        return 'drawing-actor';

    return null;
}

function actorHasTextualContent(actor) {
    const queue = [...getActorChildren(actor)];
    while (queue.length > 0) {
        const child = queue.shift();
        if (!child)
            continue;

        const name = child.get_name?.() ?? '';
        const styleClass = child.get_style_class_name?.() ?? '';
        if (name.includes('label') || name.includes('text') || styleClass.includes('label') ||
            styleClass.includes('text'))
            return true;

        const children = child.get_children?.();
        if (children?.length)
            queue.push(...children);
    }

    return false;
}

function getActorArea(actor) {
    const [width, height] = getTransformSize(actor);
    return width * height;
}

function actorHasMultipleButtonDescendants(actor) {
    let buttonCount = 0;
    const queue = [...getActorChildren(actor)];

    while (queue.length > 0) {
        const child = queue.shift();
        if (!child || getIgnoreSubtreeReason(child))
            continue;

        if (isStButton(child) && ++buttonCount > 1)
            return true;

        const children = getActorChildren(child);
        if (children.length)
            queue.push(...children);
    }

    return false;
}

function isQuickSettingsHeaderContainer(actor) {
    if (!actor)
        return false;

    const styleClass = actor.get_style_class_name?.() ?? '';
    if (styleClass.includes('quick-settings-system-item'))
        return true;

    if (!isStButton(actor) || !actorHasTextualContent(actor) ||
        !actorHasMultipleButtonDescendants(actor))
        return false;

    const [width, height] = getTransformSize(actor);
    return width > 0 && height > 0 && width >= height * 2;
}

function getTraverseOnlyReason(actor) {
    if (!actor)
        return 'null-actor';

    const styleClass = actor.get_style_class_name?.() ?? '';
    if (styleClass.includes('quick-settings-system-item'))
        return 'header-container';

    const name = actor.get_name?.() ?? '';
    if (name.startsWith('_'))
        return 'private-wrapper';
    if (name.includes('overlay') || name.includes('Overlay') || styleClass.includes('overlay'))
        return 'overlay-wrapper';
    if (styleClass.includes('placeholder'))
        return 'placeholder';
    if (isQuickSettingsHeaderContainer(actor))
        return 'textual-wide-container';

    return null;
}

function isQuickSettingsPaintSurface(actor, shape) {
    if (!actor || getIgnoreSubtreeReason(actor) || getTraverseOnlyReason(actor) ||
        !actor.visible || !actor.mapped ||
        !isPositiveSize(actor))
        return false;

    const styleClass = actor.get_style_class_name?.() ?? '';
    if (styleClass.includes('quick-slider'))
        return shape === 'rounded';

    if (styleClass.includes('quick-toggle') || styleClass.includes('quick-toggle-has-menu'))
        return true;

    if (isStButton(actor))
        return shape !== 'circle' || !actorHasTextualContent(actor);

    return false;
}

function resolveQuickSettingsControlBoundsActor(actor, shape) {
    let current = actor;
    const visited = new Set();

    while (current && !visited.has(current)) {
        visited.add(current);

        const children = getActorChildren(current)
            .filter(child => isQuickSettingsPaintSurface(child, shape));
        if (children.length !== 1)
            break;

        const next = children[0];
        const currentArea = Math.max(1, getActorArea(current));
        const nextArea = getActorArea(next);
        const currentStyle = current.get_style_class_name?.() ?? '';
        const nextStyle = next.get_style_class_name?.() ?? '';
        const nextIsMoreSpecific = nextStyle !== currentStyle ||
            (!isStButton(current) && isStButton(next));

        if (nextArea <= 0)
            break;

        // Only descend when the child is both more specific and materially smaller;
        // otherwise we keep the logical control bounds.
        if (!nextIsMoreSpecific || nextArea >= currentArea * 0.98)
            break;

        current = next;
    }

    return current ?? actor;
}

function classifyQuickSettingsControl(actor) {
    if (!actor)
        return null;

    const styleClass = actor.get_style_class_name?.() ?? '';
    if (styleClass.includes('quick-slider'))
        return { shape: 'rounded', controlKind: 'slider' };

    if (styleClass.includes('quick-toggle') || styleClass.includes('quick-toggle-has-menu'))
        return { shape: 'rounded', controlKind: 'toggle' };

    if (isStButton(actor)) {
        if (!actorHasTextualContent(actor))
            return { shape: 'circle', controlKind: 'button' };

        return { shape: 'rounded', controlKind: 'button' };
    }

    return null;
}

function decideQuickSettingsActor(actor) {
    const ignoreReason = getIgnoreSubtreeReason(actor);
    if (ignoreReason) {
        return {
            state: QUICK_SETTINGS_FILTER_STATE.IGNORE_SUBTREE,
            reason: ignoreReason,
        };
    }

    const traverseReason = getTraverseOnlyReason(actor);
    if (traverseReason) {
        return {
            state: QUICK_SETTINGS_FILTER_STATE.TRAVERSE_ONLY,
            reason: traverseReason,
        };
    }

    const classification = classifyQuickSettingsControl(actor);
    if (classification) {
        return {
            state: QUICK_SETTINGS_FILTER_STATE.TARGET,
            reason: 'control',
            ...classification,
        };
    }

    return {
        state: QUICK_SETTINGS_FILTER_STATE.TRAVERSE_ONLY,
        reason: 'not-control',
    };
}

function isVisibleHeaderButton(actor) {
    return Boolean(isStButton(actor) && actor.visible && actor.mapped && isPositiveSize(actor) &&
        !isQuickSettingsHeaderContainer(actor));
}

function incrementReason(map, reason) {
    map.set(reason, (map.get(reason) ?? 0) + 1);
}

function recordHeaderSkip(diagnostics, actor, reason) {
    diagnostics.headerSkippedActors.set(actor, reason);
    incrementReason(diagnostics.headerSkippedReasons, reason);
}

export function collectQuickSettingsControls(root) {
    const controls = [];
    const diagnostics = {
        decisions: [],
        selected: [],
        headerButtons: new Set(),
        headerButtonTargets: new Set(),
        headerSkippedActors: new Map(),
        headerSkippedReasons: new Map(),
    };
    const seen = new Set();
    const stack = getActorChildren(root).map(actor => ({
        actor,
        inHeader: false,
        ancestors: [],
    }));

    while (stack.length > 0) {
        const { actor, inHeader, ancestors } = stack.pop();
        if (!actor || seen.has(actor))
            continue;

        seen.add(actor);
        const decision = decideQuickSettingsActor(actor);
        const actorIsHeaderContainer = isQuickSettingsHeaderContainer(actor);
        const childInHeader = inHeader || actorIsHeaderContainer;
        const visibleHeaderButton = inHeader && isVisibleHeaderButton(actor);

        if (visibleHeaderButton)
            diagnostics.headerButtons.add(actor);

        diagnostics.decisions.push({
            actor,
            state: decision.state,
            reason: decision.reason,
            shape: decision.shape ?? null,
            controlKind: decision.controlKind ?? null,
            inHeader,
            visibleHeaderButton,
            ancestors,
        });

        if (decision.state === QUICK_SETTINGS_FILTER_STATE.IGNORE_SUBTREE) {
            if (visibleHeaderButton)
                recordHeaderSkip(diagnostics, actor, decision.reason);
            continue;
        }

        if (decision.state === QUICK_SETTINGS_FILTER_STATE.TARGET) {
            const control = {
                actor,
                boundsActor: resolveQuickSettingsControlBoundsActor(actor, decision.shape),
                shape: decision.shape,
                controlKind: decision.controlKind,
                inHeader,
                isHeaderButton: visibleHeaderButton,
                ancestors,
            };
            controls.push(control);
            diagnostics.selected.push(control);
            if (visibleHeaderButton)
                diagnostics.headerButtonTargets.add(actor);
            continue;
        }

        const children = getActorChildren(actor);
        if (children.length) {
            for (const child of children)
                stack.push({ actor: child, inHeader: childInHeader, ancestors: [...ancestors, actor] });
        } else if (visibleHeaderButton) {
            recordHeaderSkip(diagnostics, actor, decision.reason);
        }
    }

    return { controls, diagnostics };
}

export function isDhruvaContextMenuOverlayActor(actor) {
    if (!actor)
        return false;

    try {
        const styleClass = actor.get_style_class_name?.() ?? '';
        return styleClass.includes('context-menu-overlay');
    } catch {
        return false;
    }
}

export function getOpenStateActor(menu, popupContent) {
    return menu?._boxPointer ?? menu?.actor ?? popupContent;
}
