import St from 'gi://St';
import { getTransformSize, isPositiveSize } from './geometry.js';

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

function isQuickSettingsIgnoredActor(actor) {
    if (!actor || isManagedOverlayActor(actor) || isDrawingArea(actor))
        return true;

    const name = actor.get_name?.() ?? '';
    if (name.startsWith('_') || name.includes('overlay') || name.includes('Overlay'))
        return true;

    const styleClass = actor.get_style_class_name?.() ?? '';
    if (styleClass.includes('overlay') || styleClass.includes('placeholder'))
        return true;

    return false;
}

function isStButton(actor) {
    try {
        return actor instanceof St.Button;
    } catch {
        return actor?.constructor?.name === 'Button';
    }
}

function actorHasTextualContent(actor) {
    const queue = [...(actor?.get_children?.() ?? [])];
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

function classifyQuickSettingsControl(actor) {
    if (!actor || isQuickSettingsIgnoredActor(actor))
        return null;

    const styleClass = actor.get_style_class_name?.() ?? '';
    if (styleClass.includes('quick-slider'))
        return { shape: 'rounded' };

    if (styleClass.includes('quick-toggle') || styleClass.includes('quick-toggle-has-menu'))
        return { shape: 'rounded' };

    if (isStButton(actor)) {
        if (!actorHasTextualContent(actor))
            return { shape: 'circle' };

        return { shape: 'rounded' };
    }

    return null;
}

export function collectQuickSettingsControls(root) {
    const controls = [];
    const seen = new Set();
    const stack = [...(root?.get_children?.() ?? [])];

    while (stack.length > 0) {
        const actor = stack.pop();
        if (!actor || seen.has(actor))
            continue;

        seen.add(actor);
        if (isQuickSettingsIgnoredActor(actor))
            continue;

        const classification = classifyQuickSettingsControl(actor);
        if (classification) {
            controls.push({ actor, ...classification });
            continue;
        }

        const children = actor.get_children?.();
        if (children?.length)
            stack.push(...children);
    }

    return controls;
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
