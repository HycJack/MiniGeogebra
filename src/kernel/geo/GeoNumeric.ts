import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Animatable } from '../core/Animatable';
import { AnimationManager } from '../core/AnimationManager';

export enum AnimationType {
    OSCILLATING = 0,
    INCREASING = 1,
    DECREASING = 2
}

export class GeoNumeric extends GeoElement implements Animatable {
    private value: number;
    public intervalMin: number = 0;
    public intervalMax: number = 2 * Math.PI;
    public animationSpeed: number = 1;
    public animationDirection: number = 1;
    public animationType: AnimationType = AnimationType.INCREASING;
    public animationIncrement: number = 0.01;
    
    private animationValue: number = NaN;

    constructor(kernel: IKernel, value: number) {
        super(kernel, new GeoVec3D(0, 0, 0));
        this.value = value;
    }

    getClassName() { return 'GeoNumeric'; }

    getValue(): number { return this.value; }
    
    setValue(val: number, updateAnimationValue: boolean = true) {
        this.value = val;
        if (updateAnimationValue) {
            this.animationValue = val;
        }
        this.update();
    }

    isAnimatable(): boolean { return true; }

    doAnimationStep(frameRate: number): boolean {
        const oldValue = this.value;
        const intervalWidth = this.intervalMax - this.intervalMin;
        if (intervalWidth <= 0) return false;

        let currentDirection = this.animationDirection;
        if (this.animationType === AnimationType.DECREASING) {
            currentDirection = -Math.abs(currentDirection);
        } else if (this.animationType === AnimationType.INCREASING) {
            currentDirection = Math.abs(currentDirection);
        }

        const step = intervalWidth * this.animationSpeed * currentDirection / (AnimationManager.STANDARD_ANIMATION_TIME * frameRate);

        if (isNaN(this.animationValue)) {
            this.animationValue = oldValue;
        }
        this.animationValue += step;

        switch (this.animationType) {
            case AnimationType.INCREASING:
            case AnimationType.DECREASING:
                if (this.animationValue > this.intervalMax) this.animationValue -= intervalWidth;
                else if (this.animationValue < this.intervalMin) this.animationValue += intervalWidth;
                break;
            case AnimationType.OSCILLATING:
            default:
                if (this.animationValue >= this.intervalMax) {
                    this.animationValue = this.intervalMax;
                    this.animationDirection = -Math.abs(this.animationDirection);
                } else if (this.animationValue <= this.intervalMin) {
                    this.animationValue = this.intervalMin;
                    this.animationDirection = Math.abs(this.animationDirection);
                }
                break;
        }

        let param = this.animationValue - this.intervalMin;
        if (this.animationIncrement > 0) {
            param = Math.round(param / this.animationIncrement) * this.animationIncrement;
        }
        let newValue = this.intervalMin + param;
        
        this.setValue(newValue, false);

        return this.value !== oldValue;
    }
}
