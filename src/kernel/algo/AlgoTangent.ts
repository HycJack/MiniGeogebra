import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoConic } from '../geo/GeoConic';
import { GeoVec3D } from '../core/GeoVec3D';
import {
  conicValue, dualLine, intersectLineWithConic, isConicDegenerate, analyzeConic,
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
      // getNext*Label 不自行登记——漏 add 会让两条切线/两个切点同名
      usedLabelsL.add(l.label);
      this.outputLines.push(l);
      const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
      p.label = kernel.getConstruction().getNextPointLabel(usedLabelsP);
      usedLabelsP.add(p.label);
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
    if (isConicDegenerate(coeffs)) return;

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

/**
 * Tangent(line, conic)：与给定直线平行的圆锥曲线切线（官方 CmdTangent 分支）。
 * 支持中心型曲线（圆/椭圆/双曲线，含旋转）；抛物线/退化曲线输出 undefined。
 *
 * 原理：方向平行的切线法向 n ∥ l 法向。中心型曲线在自身主轴系下半轴
 * (A, B)，单位法向在主轴系分量 (nu, nv) 的支撑线距离 h = √(A²·nu² + B²·nv²)，
 * 两条切线为 n·(x − C) = ±h。
 */
export class AlgoTangentLineConic extends AlgoElement {
  private readonly outputLines: GeoLine[] = [];

  constructor(kernel: IKernel, private line: GeoLine, private conic: GeoConic) {
    super(kernel);
    for (let i = 0; i < 2; i++) {
      const l = new GeoLine(kernel, 0, 0, 0);
      l.label = kernel.getConstruction().getNextLineLabel(new Set());
      this.outputLines.push(l);
    }
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.line, this.conic];
    this.setOutput([...this.outputLines]);
  }

  compute(): void {
    this.outputLines.forEach(l => l.setUndefined());
    if (!this.line.isDefined() || !this.conic.isDefined()) return;
    const canonical = analyzeConic(this.conic.coeffs);
    if (!canonical || !canonical.center) return;
    if (canonical.type !== 'circle' && canonical.type !== 'ellipse' && canonical.type !== 'hyperbola') return;

    // 主轴系半轴：s1 沿 λ1 方向（theta），s2 沿 λ2 方向（theta+π/2）。
    // analyzeConic 对圆不填 a/b（null），圆用半径；椭圆 a 沿 λ2、双曲线实轴
    // 沿 majorAngle（theta 或 theta+π/2）——按特征方向重排。
    let s1: number, s2: number;
    if (canonical.type === 'circle') {
      const r = Math.sqrt(-canonical.fPrime / canonical.lambda1);
      s1 = r; s2 = r;
    } else if (canonical.type === 'ellipse') {
      if (!canonical.a || !canonical.b) return;
      s1 = canonical.b; s2 = canonical.a;
    } else {
      if (!canonical.a || !canonical.b) return;
      if (canonical.majorAngle !== null && Math.abs(canonical.majorAngle - canonical.theta) < 1e-9) {
        s1 = canonical.a; s2 = canonical.b;
      } else {
        s1 = canonical.b; s2 = canonical.a;
      }
    }
    if (!(s1 > 0) || !(s2 > 0)) return;

    const len = Math.hypot(this.line.a, this.line.b);
    if (len < 1e-15) return;
    // 单位法向 → 主轴系分量
    const nu0 = this.line.a / len, nv0 = this.line.b / len;
    const ct = Math.cos(canonical.theta), st = Math.sin(canonical.theta);
    const nu = nu0 * ct + nv0 * st;
    const nv = -nu0 * st + nv0 * ct;
    const h = Math.sqrt(s1 * s1 * nu * nu + s2 * s2 * nv * nv);
    const cx = canonical.center.x, cy = canonical.center.y;
    // n·(x − C) = ±h → nu0·x + nv0·y + (−nu0·Cx − nv0·Cy ∓ h) = 0
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? h : -h;
      this.outputLines[i].a = nu0;
      this.outputLines[i].b = nv0;
      this.outputLines[i].c = -nu0 * cx - nv0 * cy - s;
      this.outputLines[i].setDefined();
    }
  }

  getOutputLines(): GeoLine[] { return this.outputLines; }
}
