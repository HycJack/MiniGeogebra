import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Animatable } from '../core/Animatable';
import { AnimationManager } from '../core/AnimationManager';

export class GeoNumeric extends GeoElement implements Animatable {
    private value: number;
    public intervalMin: number = 0;
    public intervalMax: number = 2 * Math.PI;
    public animationSpeed: number = 1;
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

        const step = intervalWidth * this.animationSpeed / (AnimationManager.STANDARD_ANIMATION_TIME * frameRate);

        if (isNaN(this.animationValue)) {
            this.animationValue = oldValue;
        }
        this.animationValue += step;

        // 递增循环
        if (this.animationValue > this.intervalMax) {
            this.animationValue -= intervalWidth;
        } else if (this.animationValue < this.intervalMin) {
            this.animationValue += intervalWidth;
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
