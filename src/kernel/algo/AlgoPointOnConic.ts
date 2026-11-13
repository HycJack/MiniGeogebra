import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';
import { GeoNumeric, AnimationType } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';
import { PathAnimator } from '../core/PathAnimation';

export class AlgoPointOnConic extends AlgoElement {
  private outputPoint: GeoPoint;
  /** 最近一次落在曲线上的参数（动画反弹回退点）。 */
  private lastValidT: number | null = null;
  /** 弧长匀速动画器（官方 PathNormalizer 语义，L6-5，状态机共享于 PathAnimator）。 */
  private pathAnimator = new PathAnimator(() => this.param, () => this.conicSampler());

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

  /** 匀速动画通道（GeoPoint.doAnimationStep 优先调用；测试直驱入口）。 */
  advancePathAnimation(frameRate: number): boolean {
    return this.pathAnimator.advance(frameRate);
  }

  /** 圆锥曲线采样器（弧长表输入；系数签名失效重建）。 */
  private conicSampler() {
    return {
      tMin: 0,
      tMax: 2 * Math.PI,
      pointAt: (t: number) => this.conic.pointAtAngle(t),
      key: () => this.conic.coeffs.join(','),
    };
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
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
