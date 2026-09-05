import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Animatable } from '../core/Animatable';
import { AnimationManager } from '../core/AnimationManager';

/** 对标 GeoGebra 的动画类型。 */
export enum AnimationType {
    OSCILLATING = 0,
    INCREASING = 1,
    DECREASING = 2,
    INCREASING_ONCE = 3,
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

    isAnimatable(): boolean { return true; }

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
            case AnimationType.INCREASING:
            default:
                this.animationValue += step;
                if (this.animationValue > this.intervalMax) this.animationValue -= intervalWidth;
                break;
        }

        let param = this.animationValue - this.intervalMin;
        if (this.animationIncrement > 0) param = Math.round(param / this.animationIncrement) * this.animationIncrement;
        this.setValue(this.intervalMin + param, false);
        return this.value !== oldValue;
    }

    /** 代数描述：数值（4 位有效小数） */
    getAlgebraDescription(): string {
        if (!this.isDefined()) return `${this.label}（未定义）`;
        return `${this.label} = ${this.value.toFixed(4)}`;
    }
}
