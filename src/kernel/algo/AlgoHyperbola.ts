import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoConic } from '../geo/GeoConic';

export class AlgoHyperbola extends AlgoElement {
  private outputConic: GeoConic;

  constructor(
    kernel: IKernel,
    private f1: GeoPoint,
    private f2: GeoPoint,
    /** 第三参：双曲线上一点（官方 Hyperbola(F1,F2,P)）或实半轴（数值/滑块，
     *  官方 CmdEllipseHyperbola 的 GeoNumberValue 分支，a ≥ |F1F2|/2 → 未定义）。 */
    private p: GeoPoint | GeoNumeric | number,
  ) {
    super(kernel);
    this.outputConic = new GeoConic(kernel, [1, 0, -1, 0, 0, -1]);
    // 标签由调用方统一分配（工具 assignOutputLabel / 识别器 assignNextLabel）——
    // 构造器错用线表会给椭圆拿到 'f'（评审 I4）
    this.setInputOutput();
  }

  setInputOutput(): void {
    // 数值实半轴不是 GeoElement，不入 input（同 AlgoEllipse）
    const third: GeoElement | null = this.p instanceof GeoNumeric || this.p instanceof GeoPoint ? this.p : null;
    this.input = third ? [this.f1, this.f2, third] : [this.f1, this.f2];
    this.setOutput([this.outputConic]);
  }

  compute(): void {
    if (!this.f1.isDefined() || !this.f2.isDefined()) {
      this.outputConic.setUndefined();
      return;
    }
    const f1x = this.f1.getX(), f1y = this.f1.getY();
    const f2x = this.f2.getX(), f2y = this.f2.getY();
    let a: number;
    if (typeof this.p === 'number') {
      a = this.p;
    } else if (this.p instanceof GeoNumeric) {
      if (!this.p.isDefined()) { this.outputConic.setUndefined(); return; }
      a = this.p.getValue();
    } else {
      if (!this.p.isDefined()) { this.outputConic.setUndefined(); return; }
      const px = this.p.getX(), py = this.p.getY();
      a = Math.abs(Math.hypot(px - f1x, py - f1y) - Math.hypot(px - f2x, py - f2y)) / 2;
    }
    if (!(a > 0) || !Number.isFinite(a)) { this.outputConic.setUndefined(); return; }
    const cx = (f1x + f2x) / 2, cy = (f1y + f2y) / 2;
    const c = Math.hypot(f2x - f1x, f2y - f1y) / 2;
    const b2 = c * c - a * a;
    if (b2 <= 0) { this.outputConic.setUndefined(); return; }
    const theta = Math.atan2(f2y - f1y, f2x - f1x);
    const ct = Math.cos(theta), st = Math.sin(theta);
    const A = (ct * ct) / (a * a) - (st * st) / b2;
    const B = 2 * ct * st * (1 / (a * a) + 1 / b2);
    const C = (st * st) / (a * a) - (ct * ct) / b2;
    const D = -2 * A * cx - B * cy;
    const E = -B * cx - 2 * C * cy;
    const F = A * cx * cx + B * cx * cy + C * cy * cy - 1;
    (this.outputConic as any).coeffs = [A, B, C, D, E, F];
    this.outputConic.setDefined();
  }

  getOutput(): GeoConic { return this.outputConic; }
}
