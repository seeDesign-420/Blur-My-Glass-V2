import St from 'gi://St';

export class DhruvaTargetResolver {
    walkActorTree(actor, callback) {
        let stack = actor?.get_children?.() ?? [];
        while (stack.length > 0) {
            let child = stack.pop();
            callback(child);

            let children = child?.get_children?.();
            if (children?.length)
                stack.push(...children);
        }
    }

    findContainer(actor) {
        if (!actor)
            return null;

        if (actor.get_name?.() === 'DhruvaContainer')
            return actor;

        if (actor.get_name?.() === 'DhruvaBackground')
            return actor.get_parent?.() ?? null;

        let background = null;
        this.walkActorTree(actor, child => {
            if (!background && child.get_name?.() === 'DhruvaBackground')
                background = child;
        });

        return background?.get_parent?.() ?? null;
    }

    isMenuOverlay(actor) {
        let styleClass = actor.get_style_class_name?.() ?? '';
        return styleClass.includes('context-menu-overlay');
    }

    findBackgroundActor(container) {
        let directBackground = container.get_children?.()
            .find(child => child.get_name?.() === 'DhruvaBackground');
        if (directBackground)
            return directBackground;

        let background = null;
        this.walkActorTree(container, child => {
            if (!background && child.get_name?.() === 'DhruvaBackground')
                background = child;
        });

        return background;
    }

    findContextMenuParts(overlay) {
        let menuContainer = null;
        let panel = null;
        let bgDrawingArea = null;

        for (let child of overlay.get_children()) {
            let children = child.get_children?.() ?? [];
            if (children.length < 2)
                continue;

            let candidatePanel = null;
            let candidateBg = null;
            for (let sub of children) {
                if (sub instanceof St.DrawingArea)
                    candidateBg = sub;
                else if (sub instanceof St.BoxLayout)
                    candidatePanel = sub;
            }

            if (candidatePanel) {
                menuContainer = child;
                panel = candidatePanel;
                bgDrawingArea = candidateBg;
                break;
            }
        }

        return { menuContainer, panel, bgDrawingArea };
    }
}
