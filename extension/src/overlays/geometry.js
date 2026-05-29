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

function _extractTransformedPoint(result) {
    if (!(result instanceof Array))
        return null;

    if (result.length >= 3 && typeof result[0] === 'boolean') {
        if (!result[0])
            return null;
        return [result[1], result[2]];
    }

    if (result.length >= 2)
        return [result[0], result[1]];

    return null;
}

export function stageRectToActorSpace(actor, x, y, width, height) {
    try {
        const points = [
            _extractTransformedPoint(actor.transform_stage_point(x, y)),
            _extractTransformedPoint(actor.transform_stage_point(x + width, y)),
            _extractTransformedPoint(actor.transform_stage_point(x, y + height)),
            _extractTransformedPoint(actor.transform_stage_point(x + width, y + height)),
        ];

        if (points.every(Boolean)) {
            const xs = points.map(point => point[0]);
            const ys = points.map(point => point[1]);
            const x1 = Math.min(...xs);
            const y1 = Math.min(...ys);
            const x2 = Math.max(...xs);
            const y2 = Math.max(...ys);
            return {
                x: x1,
                y: y1,
                width: x2 - x1,
                height: y2 - y1,
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

export function snapRectOutwards(rect) {
    if (!rect ||
        !Number.isFinite(rect.x) ||
        !Number.isFinite(rect.y) ||
        !Number.isFinite(rect.width) ||
        !Number.isFinite(rect.height) ||
        rect.width <= 0 ||
        rect.height <= 0)
        return null;

    const x1 = Math.floor(rect.x);
    const y1 = Math.floor(rect.y);
    const x2 = Math.ceil(rect.x + rect.width);
    const y2 = Math.ceil(rect.y + rect.height);

    return {
        x: x1,
        y: y1,
        width: Math.max(1, x2 - x1),
        height: Math.max(1, y2 - y1),
    };
}
