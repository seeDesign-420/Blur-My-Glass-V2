export class ComponentRegistry {
    constructor(settings) {
        this.settings = settings;
        this._components = new Map();
    }

    register(definition) {
        this._components.set(definition.key, definition);
    }

    initAll(factoryContext) {
        for (const def of this._components.values())
            def.instance = def.factory(factoryContext);
    }

    get(key) {
        return this._components.get(key)?.instance ?? null;
    }

    forEach(fn) {
        for (const def of this._components.values())
            fn(def.instance, def);
    }

    enableUserSessionComponents() {
        this.forEach((instance, def) => {
            if (!instance || def.sessionScope !== 'user')
                return;
            if (def.shouldEnable?.(this.settings) && !instance.enabled)
                instance.enable();
        });
    }

    disableUserSessionComponents() {
        this.forEach((instance, def) => {
            if (!instance || def.sessionScope !== 'user')
                return;
            instance.disable?.();
        });
    }

    clear() {
        this.forEach((_instance, def) => {
            def.instance = null;
        });
    }
}
