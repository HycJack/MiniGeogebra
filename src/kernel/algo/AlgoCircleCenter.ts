import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoCircleCenter extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private circle: GeoConic,
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.circle];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    if (!this.circle.isDefined()) {
      this.outputPoint.setUndefined();
      return;
    }

    // 官方 AlgoCenterConic.java:60-77 语义：仅 CIRCLE/ELLIPSE/HYPERBOLA/
    // SINGLE_POINT/INTERSECTING_LINES 有中心；抛物线、平行线族、空集 undefined。
    // 此前 Mini 无条件取 getCenter()，抛物线被误回退为顶点（假值）。
    const [A, B, C, D, E] = this.circle.coeffs;
    const qmag = Math.max(Math.abs(A), Math.abs(B), Math.abs(C));
    // 无二次项（直线）或二次型降秩（抛物线/平行线族）：中心不存在或在无穷远
    if (qmag === 0) {
      this.outputPoint.setUndefined();
      return;
    }
    const denom = 4 * A * C - B * B;
    if (Math.abs(denom) < 1e-8 * qmag * qmag) {
      this.outputPoint.setUndefined();
      return;
    }

    const cx = (B * E - 2 * C * D) / denom;
    const cy = (B * D - 2 * A * E) / denom;

    // 中心型但实空集（如 x²+y²+1=0，官方 CONIC_EMPTY）：undefined。
    // 实空 ⟺ 二次块定正且平移后常数项同号：A·F' > 0（A 与 F' 分别两侧判）
    const F = this.circle.coeffs[5];
    const fPrime = F + (D * cx + E * cy) / 2;
    if (denom > 0) {
      const magF = Math.abs(F) + (Math.abs(D * cx) + Math.abs(E * cy)) / 2 + 1e-30;
      if (A * fPrime > 1e-10 * magF) {
        this.outputPoint.setUndefined();
        return;
      }
    }

    this.outputPoint.setCoords(cx, cy);
    this.outputPoint.setDefined();
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }
}
