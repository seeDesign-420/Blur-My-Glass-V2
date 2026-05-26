export class CapabilityService {
    constructor(blurModule) {
        this.blurModule = blurModule;
    }

    hasRoundedBlurSupport() {
        return this.blurModule !== null;
    }
}
