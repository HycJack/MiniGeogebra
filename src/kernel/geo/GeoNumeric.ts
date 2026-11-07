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

    // ---- 滑条显示（对标官方 GeoNumeric/DrawSlider：滑条是画布上的真实
    //      drawable，位置为屏幕绝对坐标，不随视图平移缩放移动）----
    /** 滑条是否以滑条形式显示在画布上（工具/Slider 命令置 true）。 */
    public sliderVisible = false;
    /** 滑条起点（屏幕像素，视口空间；官方 absolute screen loc）。 */
    public sliderX = 0;
    public sliderY = 0;
    /** 滑条轨道长度（屏幕像素；官方 DEFAULT_SLIDER_WIDTH_PIXEL = 200）。 */
    public sliderWidthPx = 200;
    /** 方向（官方 isSliderHorizontal；垂直轨道向上延伸）。 */
    public sliderHorizontal = true;
    /** 滑块半径（官方 DEFAULT_SLIDER_BLOB_SIZE = 5）。 */
    public sliderBlobSize = 5;

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

    /** 轨道参数 t∈[0,1] → 值（含 increment 吸附；官方 moveNumeric 的投影语义）。 */
    valueAtParam(t: number): number {
        const clamped = Math.max(0, Math.min(1, t));
        const width = this.intervalMax - this.intervalMin;
        let v = this.intervalMin + clamped * width;
        if (this.animationIncrement > 0) {
            v = this.intervalMin + Math.round((v - this.intervalMin) / this.animationIncrement) * this.animationIncrement;
        }
        return Math.max(this.intervalMin, Math.min(this.intervalMax, v));
    }

    /** 当前值 → 轨道参数 t∈[0,1]。 */
    paramOfValue(): number {
        const width = this.intervalMax - this.intervalMin;
        if (!(width > 0)) return 0;
        return (this.value - this.intervalMin) / width;
    }

    isAnimatable(): boolean {
        // 对标 GeoNumeric.isAnimatable：只有独立数值（滑块）可动画。
        // 此前恒 true——派生数值（a = 2b、距离/角度度量）右键也能"播放"，
        // doAnimationStep 改值与 parentAlgo 重算互相覆写打架；
        // 无效区间（宽 ≤ 0）开动画只会 60fps 空转，一并排除
        return this.isIndependent()
            && Number.isFinite(this.intervalMin) && Number.isFinite(this.intervalMax)
            && this.intervalMax > this.intervalMin;
    }

    setAnimationType(type: AnimationType) {
        this.animationType = type;
        this.animationDirection = type === AnimationType.DECREASING ? -1 : 1;
    }

    /** 动画方向反转。圆锥曲线动画"空扇区反弹"用（双曲线两支不跨支瞬移）：
     *  官方按连续参数 t 移动（PathMover.changeOrientation 对应物）。 */
    reverseAnimationDirection(): void {
        this.animationDirection = this.animationDirection === 1 ? -1 : 1;
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
                // 骰子/抽签类演示不可用）。增量为 0（连续滑块）退化为按宽度/20
                // 的累积阈值，否则 `increment <= 0 ||` 短路使每帧重掷复活
                this.randomAccum += Math.abs(step);
                {
                    const reRollThreshold = this.animationIncrement > 0
                        ? this.animationIncrement
                        : intervalWidth / 20;
                    if (this.randomAccum >= reRollThreshold) {
                        this.randomAccum = 0;
                        this.animationValue = this.intervalMin + Math.random() * intervalWidth;
                    }
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
    /** 当前值按 rounding 格式化（画布滑条 `a = 值` 标签用；fmt 为类内保护方法）。 */
    formatValue(): string { return this.fmt(this.value); }

    getAlgebraDescription(): string {
        if (!this.isDefined()) return `${this.label}（未定义）`;
        const value = this.isAngle
            ? formatAngle(this.value, this.kernel.getOptions())
            : this.fmt(this.value);
        return `${this.label} = ${value}`;
    }
}
