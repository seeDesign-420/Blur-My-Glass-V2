import GLib from 'gi://GLib';

export class DisposableStore {
    constructor() {
        this._disposed = false;
        this._cleanups = [];
    }

    addSignal(object, signalName, callback) {
        if (!object?.connect)
            return null;

        const id = object.connect(signalName, callback);
        this.addCleanup(() => {
            try {
                object.disconnect(id);
            } catch (e) {
                // The object may already be destroyed/disconnected.
            }
        });
        return id;
    }

    addSource(sourceId) {
        if (!sourceId)
            return null;

        this.addCleanup(() => {
            try {
                GLib.source_remove(sourceId);
            } catch (e) {
                // The source may already be removed.
            }
        });
        return sourceId;
    }

    addActor(actor) {
        if (!actor?.destroy)
            return null;

        this.addCleanup(() => {
            try {
                actor.destroy();
            } catch (e) {
                // The actor may already be destroyed.
            }
        });
        return actor;
    }

    addPipeline(pipeline) {
        if (!pipeline?.destroy)
            return null;

        this.addCleanup(() => {
            try {
                pipeline.destroy();
            } catch (e) {
                // The pipeline may already be destroyed.
            }
        });
        return pipeline;
    }

    addCleanup(callback) {
        if (this._disposed || !callback)
            return;
        this._cleanups.push(callback);
    }

    dispose() {
        if (this._disposed)
            return;

        this._disposed = true;
        for (let i = this._cleanups.length - 1; i >= 0; i--) {
            try {
                this._cleanups[i]();
            } catch (e) {
                // Keep disposing even when one cleanup fails.
            }
        }
        this._cleanups = [];
    }
}
