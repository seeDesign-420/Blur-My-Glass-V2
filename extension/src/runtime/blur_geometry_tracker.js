import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

const DEFAULT_GEOMETRY_SIGNALS = [
    'notify::x',
    'notify::y',
    'notify::width',
    'notify::height',
    'notify::scale-x',
    'notify::scale-y',
    'notify::translation-x',
    'notify::translation-y',
    'notify::pivot-point',
    'notify::visible',
    'notify::mapped',
];

export class BlurGeometryTracker {
    constructor(disposables, syncNow, signals = DEFAULT_GEOMETRY_SIGNALS) {
        this._disposables = disposables;
        this._syncNow = syncNow;
        this._signals = signals;
        this._disposed = false;
        this._queued = false;
        this._laterId = 0;
        this._sourceId = 0;
    }

    watchActor(actor) {
        if (!actor || !this._disposables)
            return;

        this._signals.forEach(signal => {
            this._disposables.addSignal(actor, signal, () => this.queueSync());
        });
    }

    queueSync() {
        if (this._disposed || this._queued)
            return;

        this._queued = true;
        try {
            this._laterId = Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                this._laterId = 0;
                return this._runSync();
            });
            return;
        } catch (e) {
            // Fallback for environments without Meta.later_add support.
        }

        this._sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._sourceId = 0;
            return this._runSync();
        });
    }

    _runSync() {
        this._queued = false;
        if (this._disposed)
            return GLib.SOURCE_REMOVE;

        this._syncNow();
        return GLib.SOURCE_REMOVE;
    }

    dispose() {
        if (this._disposed)
            return;

        this._disposed = true;
        this._queued = false;
        if (this._laterId) {
            try {
                Meta.later_remove(this._laterId);
            } catch (e) {
                // Ignore unsupported API variants.
            }
            this._laterId = 0;
        }
        if (this._sourceId) {
            try {
                GLib.source_remove(this._sourceId);
            } catch (e) {
                // Source may already be removed.
            }
            this._sourceId = 0;
        }
    }
}
