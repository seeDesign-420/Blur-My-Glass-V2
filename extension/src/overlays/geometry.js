export function isPositiveSize(actor) {
    if (!actor)
        return false;

    const width = actor.width ?? actor.get_width?.() ?? 0;
    const height = actor.height ?? actor.get_height?.() ?? 0;
    return width > 0 && height > 0;
}

export function getTransformPosition(actor) {
    try {
        return actor?.get_transformed_position?.() ?? [0, 0];
    } catch {
        return [0, 0];
    }
}

export function getTransformSize(actor) {
    try {
        return actor?.get_transformed_size?.() ?? [0, 0];
    } catch {
        return [0, 0];
    }
}

export function hasPositiveTransformedSize(actor) {
    const [width, height] = getTransformSize(actor);
    return width > 0 && height > 0;
}

export function stageRectToActorSpace(actor, x, y, width, height) {
    try {
        const [ok1, x1, y1] = actor.transform_stage_point(x, y);
        const [ok2, x2, y2] = actor.transform_stage_point(x + width, y + height);
        if (ok1 && ok2) {
            return {
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1),
            };
        }
    } catch {
        // Fall through to a simple translated stage-space approximation.
    }

    const [parentX, parentY] = getTransformPosition(actor);
    return {
        x: x - parentX,
        y: y - parentY,
        width,
        height,
    };
}
