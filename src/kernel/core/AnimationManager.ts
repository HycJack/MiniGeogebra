import { IKernel } from './Interfaces';
import { Animatable } from './Animatable';
import { GeoElement } from '../geo/GeoElement';

export class AnimationManager {
    public static readonly STANDARD_ANIMATION_TIME = 10;
    public static readonly MAX_ANIMATION_FRAME_RATE = 30;
    public static readonly MIN_ANIMATION_FRAME_RATE = 2;

    private kernel: IKernel;
    private animatedGeos: GeoElement[] = [];
    private animationStartValues = new Map<GeoElement, number>();
    private timerId: number | null = null;
    private lastTime = 0;

    constructor(kernel: IKernel) {
        this.kernel = kernel;
    }

    public addAnimatedGeo(geo: GeoElement) {
        if (!geo.isAnimating() || this.animatedGeos.includes(geo)) return;
        const value = (geo as any).getValue?.();
        if (typeof value === 'number' && !isNaN(value)) {
            this.animationStartValues.set(geo, value);
        }
        this.animatedGeos.push(geo);
    }

    public removeAnimatedGeo(geo: GeoElement) {
        const index = this.animatedGeos.indexOf(geo);
        if (index === -1) return;
        this.animatedGeos.splice(index, 1);
        this.animationStartValues.delete(geo);
        if (this.animatedGeos.length === 0) {
            this.stopAnimation();
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

    /** Stop the clock and return each animated numeric to its value at playback start. */
    public stopAllAnimation(): void {
        const geos = [...this.animatedGeos];
        this.stopAnimation();
        geos.forEach(geo => {
            const startValue = this.animationStartValues.get(geo);
            if (startValue !== undefined && typeof (geo as any).setValue === 'function') {
                // setValue 内部会 notifyUpdate，微任务 flush 统一重算依赖链，无需再手动 recompute。
                (geo as any).setValue(startValue);
            }
            geo.setAnimating(false);
        });
        this.animationStartValues.clear();
    }

    public getAnimatedGeos(): GeoElement[] {
        return this.animatedGeos;
    }

    private loop = () => {
        const now = performance.now();
        let dt = now - this.lastTime;
        this.lastTime = now;

        // 用真实帧率标定步长：把测得帧率钳到 30 会让 60/120Hz 屏幕上动画成倍偏快
        // （每帧步长 1/30 秒但每秒来 60/120 帧）。只保留下限，防止切后台后
        // dt 巨大导致单帧跳变过大。
        const currentFrameRate = Math.max(AnimationManager.MIN_ANIMATION_FRAME_RATE, 1000 / (dt || 16));

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
            // 增量重算依赖链；视图刷新只通知一次，不把滑块塞回 pendingUpdates
            // （否则微任务 flush 会把同一条依赖链再算一遍）。
            for (const element of changedElements) {
                this.kernel.getConstruction().updateDependentAlgorithms(element);
            }
            this.kernel.notifyViewChanged();
        }

        // Play-once 动画可能移除最后一个对象；此时不要继续空转。
        if (this.animatedGeos.length === 0) {
            this.timerId = null;
            return;
        }

        this.timerId = requestAnimationFrame(this.loop);
    }
}
