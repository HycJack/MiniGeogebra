import { IKernel } from './Interfaces';
import { Animatable } from './Animatable';
import { GeoElement } from '../geo/GeoElement';

export class AnimationManager {
    public static readonly STANDARD_ANIMATION_TIME = 10;
    public static readonly MAX_ANIMATION_FRAME_RATE = 30;
    public static readonly MIN_ANIMATION_FRAME_RATE = 6;

    private kernel: IKernel;
    private animatedGeos: GeoElement[] = [];
    private animationStartValues = new Map<GeoElement, number>();
    private timerId: number | null = null;
    private lastTime = 0;
    // 自适应帧率（官方 adaptFrameRate，AnimationManager.java:138-160）：
    // 动画只允许占用约 80% CPU 预算，按上一帧实际耗时把步进频率钳到 [MIN, MAX]。
    // RAF 仍满频运行（渲染共用），但步进按本帧率节流。
    private frameRate = AnimationManager.MAX_ANIMATION_FRAME_RATE;
    private lastFrameDuration = 0;

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

        // 自适应降档/升档（官方 adaptFrameRate）：framesPossible = 800ms 预算 / 帧耗时。
        // 帧耗时超预算 → 降频保 UI 响应（大 Locus/重拟合场景此前满帧卡死主线程）；
        // 预算富余 → 逐步回升到上限。
        const framesPossible = 800 / Math.max(1, this.lastFrameDuration);
        if (framesPossible < this.frameRate) {
            this.frameRate = Math.max(framesPossible, AnimationManager.MIN_ANIMATION_FRAME_RATE);
        } else if (this.frameRate < AnimationManager.MAX_ANIMATION_FRAME_RATE
            && framesPossible > this.frameRate + 1) {
            this.frameRate = Math.min(framesPossible, AnimationManager.MAX_ANIMATION_FRAME_RATE);
        }

        // 按自适应帧率节流步进（渲染不受影响）
        if (this.timerId !== null && now - this.lastTime < 1000 / this.frameRate - 1) {
            this.timerId = requestAnimationFrame(this.loop);
            return;
        }

        let dt = now - this.lastTime;
        this.lastTime = now;
        // 切后台回来 dt 巨大：钳到 100ms，否则单帧步长按 2fps 标定会跳过
        // 差不多整个区间宽度的十分之一
        dt = Math.min(dt, 100);

        // 步长按真实间隔标定（60/120Hz 屏幕上不会成倍偏快）；
        // 频率下限只防 dt 异常时单帧跳变过大。
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
        const frameStart = performance.now();
        try {
            this.kernel.withBatchedUpdates(() => {
                for (const geo of snapshot) {
                    if ((geo as any).doAnimationStep) {
                        (geo as any as Animatable).doAnimationStep(currentFrameRate);
                    }
                }
            });
            this.lastFrameDuration = performance.now() - frameStart;
            // 依赖链重算由 setValue 的 notifyUpdate → 批末 flush 统一覆盖：
            // 约束点的驱动滑块是独立数值，flush 沿正向图到达全部下游——
            // 此前再对非独立 geo 显式 updateDependentAlgorithms 是每帧双算
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
