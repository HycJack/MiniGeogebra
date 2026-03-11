import { IKernel } from './Interfaces';
import { Animatable } from './Animatable';
import { GeoElement } from '../geo/GeoElement';

export class AnimationManager {
    public static readonly STANDARD_ANIMATION_TIME = 10;
    public static readonly MAX_ANIMATION_FRAME_RATE = 60;
    public static readonly MIN_ANIMATION_FRAME_RATE = 2;

    private kernel: IKernel;
    private animatedGeos: GeoElement[] = [];
    private timerId: number | null = null;
    private lastTime = 0;

    constructor(kernel: IKernel) {
        this.kernel = kernel;
    }

    public addAnimatedGeo(geo: GeoElement) {
        if (geo.isAnimating() && !this.animatedGeos.includes(geo)) {
            this.animatedGeos.push(geo);
        }
    }

    public removeAnimatedGeo(geo: GeoElement) {
        const index = this.animatedGeos.indexOf(geo);
        if (index > -1) {
            this.animatedGeos.splice(index, 1);
            if (this.animatedGeos.length === 0) {
                this.stopAnimation();
            }
        }
    }

    public startAnimation() {
        if (this.timerId === null && this.animatedGeos.length > 0) {
            this.lastTime = performance.now();
            this.loop();
        }
    }

    public stopAnimation() {
        if (this.timerId !== null) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }
    }

    public isRunning(): boolean {
        return this.timerId !== null;
    }

    public getAnimatedGeos(): GeoElement[] {
        return this.animatedGeos;
    }

    private loop = () => {
        const now = performance.now();
        const dt = now - this.lastTime;
        this.lastTime = now;

        let currentFrameRate = 1000 / (dt || 16);
        currentFrameRate = Math.max(AnimationManager.MIN_ANIMATION_FRAME_RATE, Math.min(AnimationManager.MAX_ANIMATION_FRAME_RATE, currentFrameRate));

        let changed = false;
        const changedElements: GeoElement[] = [];
        
        for (const geo of this.animatedGeos) {
            if ((geo as any).doAnimationStep) {
                if ((geo as any as Animatable).doAnimationStep(currentFrameRate)) {
                    changed = true;
                    changedElements.push(geo);
                }
            }
        }

        if (changed) {
            // 使用增量算法更新：只更新依赖于变化元素的算法
            for (const element of changedElements) {
                this.kernel.getConstruction().updateDependentAlgorithms(element);
            }
            
            if (this.animatedGeos.length > 0) {
                this.kernel.notifyUpdate(this.animatedGeos[0]);
            }
        }

        this.timerId = requestAnimationFrame(this.loop);
    }
}
