import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoNumeric } from '../geo/GeoNumeric';
import { PathAnimator } from '../core/PathAnimation';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoPointOnFunction extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private fn: GeoFunction,
    private param: GeoNumeric,
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.fn, this.param];
    this.setOutput([this.outputPoint]);
  }

  private pathAnimator = new PathAnimator(() => this.param, () => (() => {
      const lo = Number.isFinite(this.fn.getDomainMin()) ? this.fn.getDomainMin() : -20;
      const hi = Number.isFinite(this.fn.getDomainMax()) ? this.fn.getDomainMax() : 20;
      return {
        tMin: lo,
        tMax: hi,
        pointAt: (t: number) => {
          const y = this.fn.evaluateAt(t);
          return Number.isFinite(y) ? { x: t, y } : null;
        },
        key: () => this.fn.expressionText,
      };
    })());

  compute(): void {
    const x = this.param.getValue();
    const y = this.fn.evaluateAt(x);
    if (Number.isFinite(y)) {
      this.outputPoint.setCoords(x, y, 1);
      this.outputPoint.setDefined();
    } else {
      this.outputPoint.setUndefined();
    }
  }

  /** 匀速动画通道（L6-5：弧长归一，官方 PathNormalizer 语义）。 */
  advancePathAnimation(frameRate: number): boolean {
    return this.pathAnimator.advance(frameRate);
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }

  updateParameter(x: number): void {
    const lo = this.param.intervalMin, hi = this.param.intervalMax;
    let target = Number.isFinite(lo) && Number.isFinite(hi) ? Math.max(lo, Math.min(hi, x)) : x;
    // 出界处 f 为 NaN（If 条件域等）：从目标点向当前参数位置回搜最近的定义点，
    // 对标官方 GeoFunction.pointChanged 的"不可拖入无定义区"
    if (!Number.isFinite(this.fn.evaluateAt(target))) {
      const cur = this.param.getValue();
      let found = cur;
      for (let i = 1; i <= 64; i++) {
        const cand = target + (cur - target) * (i / 64);
        if (Number.isFinite(this.fn.evaluateAt(cand))) { found = cand; break; }
      }
      target = found;
    }
    this.param.setValue(target);
  }
}
