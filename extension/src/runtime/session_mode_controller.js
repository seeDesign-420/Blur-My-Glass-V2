export class SessionModeController {
    constructor(onEnterUser, onEnterUnlockDialog) {
        this._onEnterUser = onEnterUser;
        this._onEnterUnlockDialog = onEnterUnlockDialog;
    }

    handleSessionModeChanged(session, userSessionEnabled) {
        if (session.currentMode === 'user' || session.parentMode === 'user') {
            if (!userSessionEnabled)
                this._onEnterUser();
            return;
        }

        if (session.currentMode === 'unlock-dialog') {
            if (userSessionEnabled)
                this._onEnterUnlockDialog();
        }
    }
}
