import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoConic } from '../geo/GeoConic';
import { GeoVec3D } from '../core/GeoVec3D';
import {
  conicValue, dualLine, intersectLineWithConic, isConicDegenerate,
} from '../geo/conicSolve';

/**
 * 过定点作已知圆锥曲线的切线 —— 对标 GeoGebra `Tangent[Point, Circle/Conic]`。
 *
 * 输入：conic（任意非退化圆锥曲线：圆/椭圆/双曲线/抛物线，含旋转情形）、pointP
 * 输出：[切线 l1, 切线 l2, 切点 T1, 切点 T2]
 *   - 点在曲线上：退化为一条切线（第二对输出保持 undefined），与尺规作图语义一致；
 *   - 点在曲线外：两条切线 + 两个切点；
 *   - 点在曲线内（或双曲线两支之间等无实切线的情形）：全部置 undefined，
 *     而不是把线画到错误位置；
 *   - 退化圆锥曲线（空集、单点、一对直线）：全部 undefined。
 *
 * 算法（极线法）：对 A x² + B x y + C y² + D x + E y + F = 0，点 (u, v) 的对偶线
 * （极线）为 `dualLine`，它与圆锥曲线的交点就是切点——按极线的定义，
 * 极线与曲线相交的点恰好是「过该点的切线经过 (u, v)」的点。
 * 因此整个流程只有两步：求交得切点、对切点再求一次对偶线得切线。
 *
 * 好处：对圆/椭圆/双曲线/抛物线**同一个公式**，无需按类型分支，也无需
 * 判定「点在曲线内还是外」（无实切线自然表现为求交无实根）。
 * 旧实现用「切点弦中点 + 垂直向量」的几何推导，只在 B=0 且 A=C 的圆上成立，
 * 非圆直接 return —— 也就是椭圆/双曲线/抛物线切线长期缺失的原因。
 *
 * GeoGebra 用的是直径法（过中心作直径、求直径与曲线交点得切点），需要按类型
 * 分派（抛物线无中心，另走 updateTangentParabola）。极线法在结果上等价且更短。
 */
export class AlgoTangent extends AlgoElement {
  private readonly outputLines: GeoLine[] = [];
  private readonly outputPoints: GeoPoint[] = [];

  constructor(kernel: IKernel, private conic: GeoConic, private pointP: GeoPoint) {
    super(kernel);
    const usedLabelsL = new Set<string>();
    const usedLabelsP = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const l = new GeoLine(kernel, 0, 0, 0);
      l.label = kernel.getConstruction().getNextLineLabel(usedLabelsL);
      this.outputLines.push(l);
      const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
      p.label = kernel.getConstruction().getNextPointLabel(usedLabelsP);
      this.outputPoints.push(p);
    }
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.conic, this.pointP];
    this.setOutput([...this.outputLines, ...this.outputPoints]);
  }

  compute(): void {
    this.outputLines.forEach(l => l.setUndefined());
    this.outputPoints.forEach(p => p.setUndefined());

    if (!this.conic.isDefined() || !this.pointP.isDefined()) return;

    const coeffs = this.conic.coeffs;
    const [A, B, C, D, E, F] = coeffs;
    if (![A, B, C, D, E, F].every(Number.isFinite)) return;

    // 相对容差基准：系数整体缩放不改变曲线的几何，判据必须跟着缩放
    const mag = Math.max(
      1, Math.abs(A), Math.abs(B), Math.abs(C), Math.abs(D), Math.abs(E), Math.abs(F),
    );
    if (isConicDegenerate(coeffs, mag)) return;

    const px = this.pointP.getX();
    const py = this.pointP.getY();
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;

    // 点在曲线上：对偶线即切线，直接输出单条切线，
    // 避免走「求交」路径在重根附近产生数值噪声
    const valScale = mag * Math.max(1, px * px, py * py);
    if (Math.abs(conicValue(coeffs, px, py)) <= 1e-9 * valScale) {
      const [a, b, c] = dualLine(coeffs, px, py);
      if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return;
      this.writePair(0, a, b, c, px, py);
      return;
    }

    // 点在曲线外：对偶线是切点弦，与圆锥求交得切点
    const [pa, pb, pc] = dualLine(coeffs, px, py);
    if (Math.abs(pa) < 1e-12 && Math.abs(pb) < 1e-12) return; // 退化对偶线 ⟺ 无切线

    intersectLineWithConic(coeffs, pa, pb, pc).forEach((t, i) => {
      if (i >= 2) return;
      const [a, b, c] = dualLine(coeffs, t.x, t.y);
      if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return;
      this.writePair(i, a, b, c, t.x, t.y);
    });
  }

  private writePair(
    i: number,
    a: number,
    b: number,
    c: number,
    tx: number,
    ty: number,
  ): void {
    const line = this.outputLines[i];
    line.a = a;
    line.b = b;
    line.c = c;
    line.setDefined();

    this.outputPoints[i].setCoords(tx, ty, 1);
  }

  getOutputLines(): GeoLine[] {
    return this.outputLines;
  }

  getOutputPoints(): GeoPoint[] {
    return this.outputPoints;
  }
}
