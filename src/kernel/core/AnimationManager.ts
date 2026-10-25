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

        // 防御性剔除：删除路径漏调 removeAnimatedGeo 时，被删对象会滞留列表
        // （每帧推进死对象、阻塞 GC 并持续触发重渲染）；以"仍在构造中"为准绳就地清理。
        const cons = this.kernel.getConstruction();
        if (this.animatedGeos.some(geo => !cons.getElements().includes(geo))) {
            for (const geo of [...this.animatedGeos]) {
                if (!cons.getElements().includes(geo)) this.removeAnimatedGeo(geo);
            }
        }

        // 迭代副本：INCREASING_ONCE 走完会在 doAnimationStep 里 setAnimating(false)
        // → removeAnimatedGeo → splice 正在遍历的数组，同帧会跳过下一个动画对象。
        const snapshot = [...this.animatedGeos];

        // 批处理推进：setValue 的 notifyUpdate 进入 pendingUpdates 但不排微任务/回调，
        // 批末统一 flush —— 整条依赖链每帧只重算一遍（否则微任务 flush 会再算一遍）。
        try {
            this.kernel.withBatchedUpdates(() => {
                for (const geo of snapshot) {
                    if ((geo as any).doAnimationStep) {
                        (geo as any as Animatable).doAnimationStep(currentFrameRate);
                    }
                }
            });
            // 非独立元素（依赖数值被动画时）不进 pendingUpdates，批末 flush 覆盖不到，
            // 需显式沿正向图重算下游
            for (const geo of snapshot) {
                if (!geo.isIndependent()) {
                    this.kernel.getConstruction().updateDependentAlgorithms(geo);
                }
            }
        } finally {
            // Play-once 动画可能移除最后一个对象；此时不要继续空转。
            // 异常防护：无论本帧是否抛错都要排程下一帧，否则动画静默死亡且 isRunning 恒真。
            if (this.animatedGeos.length === 0) {
                this.timerId = null;
                return;
            }
            this.timerId = requestAnimationFrame(this.loop);
        }
    }
}
