import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Animatable } from '../core/Animatable';
import { AnimationManager } from '../core/AnimationManager';
import { formatAngle } from '../core/Options';

/** 对标 GeoGebra 的动画类型。 */
export enum AnimationType {
    OSCILLATING = 0,
    INCREASING = 1,
    DECREASING = 2,
    INCREASING_ONCE = 3,
    RANDOM = 4,
}

export class GeoNumeric extends GeoElement implements Animatable {
    private value: number;
    public intervalMin: number = 0;
    public intervalMax: number = 2 * Math.PI;
    public animationSpeed: number = 1;
    public animationIncrement: number = 0.01;
    public animationType: AnimationType = AnimationType.OSCILLATING;
    private animationDirection: 1 | -1 = 1;
    private animationValue: number = NaN;
    // 随机动画的步长累积器（达到一个 increment 才重掷一次，对标官方节奏）
    private randomAccum: number = 0;

    /** 角度量输出（AlgoAngle/AlgoAngleOriented 标记）：代数描述按 angleUnit 显示。 */
    public isAngle = false;

    constructor(kernel: IKernel, value: number) {
        super(kernel, new GeoVec3D(0, 0, 0));
        this.value = value;
    }

    getClassName() { return 'GeoNumeric'; }

    getValue(): number { return this.value; }

    setValue(val: number, updateAnimationValue: boolean = true) {
        this.value = val;
        if (updateAnimationValue) this.animationValue = val;
        this.update();
    }

    isAnimatable(): boolean {
        // 对标 GeoNumeric.isAnimatable：只有独立数值（滑块）可动画。
        // 此前恒 true——派生数值（a = 2b、距离/角度度量）右键也能"播放"，
        // doAnimationStep 改值与 parentAlgo 重算互相覆写打架
        return this.isIndependent() && Number.isFinite(this.intervalMin) && Number.isFinite(this.intervalMax);
    }

    setAnimationType(type: AnimationType) {
        this.animationType = type;
        this.animationDirection = type === AnimationType.DECREASING ? -1 : 1;
    }

    doAnimationStep(frameRate: number): boolean {
        const oldValue = this.value;
        const intervalWidth = this.intervalMax - this.intervalMin;
        if (intervalWidth <= 0) return false;
        const step = intervalWidth * this.animationSpeed * this.animationDirection /
            (AnimationManager.STANDARD_ANIMATION_TIME * frameRate);
        if (isNaN(this.animationValue)) this.animationValue = oldValue;

        switch (this.animationType) {
            case AnimationType.OSCILLATING:
                this.animationValue += step;
                if (this.animationValue >= this.intervalMax) {
                    this.animationValue = this.intervalMax;
                    this.animationDirection = -1;
                } else if (this.animationValue <= this.intervalMin) {
                    this.animationValue = this.intervalMin;
                    this.animationDirection = 1;
                }
                break;
            case AnimationType.DECREASING:
                this.animationValue += step;
                if (this.animationValue < this.intervalMin) this.animationValue += intervalWidth;
                break;
            case AnimationType.INCREASING_ONCE:
                this.animationValue += step;
                if (this.animationValue >= this.intervalMax) {
                    this.animationValue = this.intervalMax;
                    this.setAnimating(false);
                }
                break;
            case AnimationType.RANDOM:
                // 对标 GeoGebra 的随机动画：重掷频率 = speed·宽度/(10·增量)——
                // 累积步长达到一个增量才重掷一次，而非每帧重掷（30Hz 闪烁，
                // 骰子/抽签类演示不可用）
                this.randomAccum += Math.abs(step);
                if (this.animationIncrement <= 0 || this.randomAccum >= this.animationIncrement) {
                    this.randomAccum = 0;
                    this.animationValue = this.intervalMin + Math.random() * intervalWidth;
                }
                break;
            case AnimationType.INCREASING:
            default:
                this.animationValue += step;
                if (this.animationValue > this.intervalMax) this.animationValue -= intervalWidth;
                break;
        }

        let param = this.animationValue - this.intervalMin;
        if (this.animationIncrement > 0) param = Math.round(param / this.animationIncrement) * this.animationIncrement;
        const next = this.intervalMin + param;
        // 值未变化（如振荡动画钉在边界）不入队：否则静止滑块也让整条依赖链逐帧空转重算
        if (next === this.value) return false;
        this.setValue(next, false);
        return true;
    }

    /** 代数描述：数值按 rounding 显示；角度量按 angleUnit 显示。 */
    getAlgebraDescription(): string {
        if (!this.isDefined()) return `${this.label}（未定义）`;
        const value = this.isAngle
            ? formatAngle(this.value, this.kernel.getOptions())
            : this.fmt(this.value);
        return `${this.label} = ${value}`;
    }
}
