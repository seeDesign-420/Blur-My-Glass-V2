import { OverlaySurfaceController } from './overlay_surface_controller.js';
import { getOpenStateActor } from './actor_utils.js';
import { DisposableStore } from '../runtime/disposable_store.js';

export class PopupOverlayController extends OverlaySurfaceController {
    constructor(runtime, options) {
        super(runtime, options);
        this.menu = options.menu;
        this._menuSignals = new DisposableStore();
    }

    enable() {
        this.surfaceActor = this.getSurfaceActor?.() ?? null;
        this.insertActor = this.getInsertActor?.() ?? this.surfaceActor;

        if (!this.menu || !this.surfaceActor || !this.insertActor)
            return;

        this._connectLifecycle(this.surfaceActor);
        if (this.insertActor !== this.surfaceActor)
            this._connectLifecycle(this.insertActor);

        this._connectMenu();
        this.sync();
    }

    _connectMenu() {
        this._menuSignals.dispose();
        this._menuSignals = new DisposableStore();

        const connect = (obj, signal, callback) => {
            try {
                this._menuSignals.addSignal(obj, signal, callback);
            } catch (e) {
                this.runtime._logSkipOnce(this.target, obj, `could not connect ${signal}: ${e}`);
            }
        };

        connect(this.menu, 'open-state-changed', (_menu, open) => {
            if (open) {
                this._cancelTimers();
                this.show();
                this._scheduleOpenSync();
                this._geometryTracker.queueSync();
            } else {
                this._scheduleCloseHide();
            }
        });

        if (this.menu.actor)
            connect(this.menu.actor, 'destroy', () => this.destroy());

        const opacityActor = this.getOpenStateActor?.() ?? getOpenStateActor(this.menu, this.surfaceActor);
        if (opacityActor && opacityActor !== this.surfaceActor)
            this._connectLifecycle(opacityActor);
    }

    _isReadyForOpen() {
        if (!this.menu)
            return false;
        if (!this.menu.isOpen)
            return !this._isVisuallyGone();

        return super._isReadyForOpen();
    }

    destroy() {
        this._menuSignals.dispose();
        this._menuSignals = new DisposableStore();
        super.destroy();
    }
}
