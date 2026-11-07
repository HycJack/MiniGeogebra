import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';
import { GeoNumeric, AnimationType } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';
import { ArcLengthTable } from '../core/ArcLength';
import { AnimationManager } from '../core/AnimationManager';

export class AlgoPointOnConic extends AlgoElement {
  private outputPoint: GeoPoint;
  /** 最近一次落在曲线上的参数（动画反弹回退点）。 */
  private lastValidT: number | null = null;
  // ---- 弧长匀速动画（官方 PathNormalizer 语义，L6-5）----
  private arcTable: ArcLengthTable | null = null;
  private arcTableKey = '';
  private arcPos = 0;
  private animDir: 1 | -1 = 1;

  constructor(
    kernel: IKernel,
    private conic: GeoConic,
    private param: GeoNumeric
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.conic, this.param];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    const t = normalizeAngle(this.param.getValue());
    const anchor = this.conic.getConicType() === 'parabola' ? this.conic.getVertex() : this.conic.getCenter();
    const hit = this.conic.pointAtAngle(t);

    if (!hit) {
      // 空扇区（双曲线渐近线之间）：动画反弹回最后有效参数，
      // 点停在本支渐近线端而非瞬移到另一支（官方按支连续移动的近似）。
      if (this.lastValidT !== null) {
        this.param.reverseAnimationDirection();
        this.param.setValue(this.lastValidT);
      }
      this.outputPoint.setUndefined();
      return;
    }
    this.lastValidT = t;
    this.outputPoint.setCoords(hit.x, hit.y, 1);
    this.outputPoint.setDefined();
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }

  /** 曲线系数签名：曲线移动（依赖点拖拽/动画驱动）时弧长表失效重建。 */
  private coeffsKey(): string {
    return this.conic.coeffs.join(',');
  }

  private getArcTable(): ArcLengthTable | null {
    const key = this.coeffsKey();
    if (this.arcTable && key === this.arcTableKey) return this.arcTable;
    const table = new ArcLengthTable({
      tMin: 0,
      tMax: 2 * Math.PI,
      pointAt: t => this.conic.pointAtAngle(t),
    });
    if (table.total <= 1e-9) return null;
    this.arcTable = table;
    this.arcTableKey = key;
    this.arcPos = this.param.getValue() >= 0 ? table.tAtArcLength(this.param.getValue()) ?? 0 : 0;
    return table;
  }

  /**
   * 路径点动画的匀速通道（GeoPoint.doAnimationStep 优先调用）：
   * 按弧长推进 arcPos，经反查表落到参数 t——曲率大处不再视觉加速。
   * 状态机对齐 GeoNumeric：OSCILLATING 两端反弹、INCREASING/DECREASING 环绕、
   * INCREASING_ONCE 到终点停、RANDOM 走参数滑块原通道（随机跳值无需匀速）。
   */
  advancePathAnimation(frameRate: number): boolean {
    const type = this.param.animationType;
    if (type === AnimationType.RANDOM || !this.param.isAnimating()) {
      return this.param.doAnimationStep(frameRate);
    }
    const table = this.getArcTable();
    if (!table) return this.param.doAnimationStep(frameRate);
    if (Number.isNaN(this.param.getValue()) === false && this.lastValidT !== null
        && Math.abs(((this.param.getValue() - this.lastValidT) % (2 * Math.PI))) > 1e-9) {
      // 外部改值（拖拽/输入栏）：弧长游标同步到新参数
      this.arcPos = table.tAtArcLength(this.lastValidT) ?? this.arcPos;
    }
    const speed = Math.abs(this.param.animationSpeed) || 1;
    const ds = (table.total * speed) / (AnimationManager.STANDARD_ANIMATION_TIME * frameRate) * this.animDir;
    this.arcPos += ds;
    const width = 2 * Math.PI;
    switch (type) {
      case AnimationType.OSCILLATING: {
        if (this.arcPos >= table.total) { this.arcPos = table.total; this.animDir = -1; }
        else if (this.arcPos <= 0) { this.arcPos = 0; this.animDir = 1; }
        break;
      }
      case AnimationType.INCREASING_ONCE: {
        if (this.arcPos >= table.total) {
          this.arcPos = table.total;
          this.param.setAnimating(false);
        }
        break;
      }
      default:
        break; // INCREASING/DECREASING：tAtArcLength 内部环绕
    }
    const newT = table.tAtArcLength(this.arcPos);
    if (newT === null) return false;
    // 空扇区守卫：落点无效则反弹回最后有效参数（双曲线两支不跨支）
    if (!this.conic.pointAtAngle(newT)) {
      this.animDir = this.animDir === 1 ? -1 : 1;
      if (this.lastValidT !== null) {
        this.param.setValue(this.lastValidT);
        this.arcPos = table.tAtArcLength(this.lastValidT) ?? this.arcPos;
      }
      this.outputPoint.setUndefined();
      return true;
    }
    this.lastValidT = newT;
    this.param.setValue(newT);
    return true;
  }

  /**
   * 把鼠标位置投影到圆锥曲线上：取“锚点 → 鼠标”方向的极角作为参数。
   * 对圆/椭圆/双曲线/抛物线均成立（与 compute 的解析求解自洽）。
   */
  updateParameter(x: number, y: number): void {
    const anchor = this.conic.getConicType() === 'parabola' ? this.conic.getVertex() : this.conic.getCenter();
    const angle = Math.atan2(y - anchor.y, x - anchor.x);
    this.param.setValue(normalizeAngle(angle));
  }
}

/** 把角度归一化到 [0, 2π)，与参数区间 [0, 2π] 保持一致。 */
function normalizeAngle(t: number): number {
  if (!Number.isFinite(t)) return 0;
  const twoPi = 2 * Math.PI;
  return ((t % twoPi) + twoPi) % twoPi;
}
