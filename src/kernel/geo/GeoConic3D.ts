import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';
import { GeoLine3D } from './GeoLine3D';
import { GeoPlane3D } from './GeoPlane3D';
import { dualLine, isConicDegenerate } from './conicSolve';

export type Conic3DKind = 'ellipse' | 'hyperbola' | 'parabola';

/**
 * 3D 圆锥曲线（椭圆/双曲线/抛物线）—— 对标 GeoGebra GeoConic3D 的轻量版：
 * 平面内圆锥曲线 = 平面（法向 n）+ 锚点 + 平面内正交基 (e1, e2) + 参数。
 * 椭圆/双曲线：锚点为中心，半轴 a/b；抛物线：锚点为顶点，e1 为开口方向，
 * a 为焦距（顶点→焦点），方程 v² = 4a·u（u 沿 e1、v 沿 e2）。
 * pointAt 参数化：椭圆 cos/sin；双曲线 cosh/sinh 两支；抛物线 (a t², 2a t)。
 * 隐式系数/极线/退化判定经 getCoeffs/getMatrix/polarLine/isDegenerate 暴露
 * （对标 GeoConicND 的 flat matrix + polarLine/classifyConic 能力）。
 */
export class GeoConic3D extends GeoElement {
  private kind: Conic3DKind = 'ellipse';
  /** 椭圆/双曲线中心；抛物线顶点。 */
  private center: Coords4 = Coords4.origin();
  private e1: Coords4 = Coords4.fromDirection(1, 0, 0);
  private e2: Coords4 = Coords4.fromDirection(0, 1, 0);
  private normal: Coords4 = Coords4.fromDirection(0, 0, 1);
  private a = 1;
  private b = 1;

  constructor(kernel: IKernel) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName(): string { return 'GeoConic3D'; }

  get defaultStrokeColor(): string { return '#22c55e'; }
  get defaultLineWidth(): number { return 2; }

  setEllipse(center: Coords4, e1: Coords4, e2: Coords4, a: number, b: number): void {
    this.kind = 'ellipse';
    this.apply(center, e1, e2, a, b);
  }

  setHyperbola(center: Coords4, e1: Coords4, e2: Coords4, a: number, b: number): void {
    this.kind = 'hyperbola';
    this.apply(center, e1, e2, a, b);
  }

  /** 抛物线：顶点 + 开口方向 e1 + 平面内垂直 e2 + 焦距 a（>0）。非法参数静默保留原状态。 */
  setParabola(vertex: Coords4, axis: Coords4, e2: Coords4, a: number): void {
    if (!(a > 0) || !Number.isFinite(a)) return;
    this.kind = 'parabola';
    this.apply(vertex, axis, e2, a, 1);
    this.b = 0;
  }

  private apply(center: Coords4, e1: Coords4, e2: Coords4, a: number, b: number): void {
    if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return;
    this.center = center.toPoint();
    this.e1 = e1.normalize();
    const e2Orth = e2.sub(this.e1.scale(e2.dot(this.e1)));
    if (e2Orth.norm() > 1e-12) {
      this.e2 = e2Orth.normalize();
    } else {
      // e2 与 e1 平行（退化输入）：任取不平行于 e1 的参考轴构造垂直方向
      const ref = Math.abs(this.e1.z) < 0.9
        ? Coords4.fromDirection(0, 0, 1)
        : Coords4.fromDirection(1, 0, 0);
      this.e2 = this.e1.cross(ref).normalize();
    }
    this.normal = this.e1.cross(this.e2).normalize();
    this.a = a;
    this.b = b;
  }

  getKind(): Conic3DKind { return this.kind; }
  /** 椭圆/双曲线中心；抛物线顶点。 */
  getCenter(): Coords4 { return this.center; }
  getE1(): Coords4 { return this.e1; }
  getE2(): Coords4 { return this.e2; }
  getNormal(): Coords4 { return this.normal; }
  getA(): number { return this.a; }
  /** 抛物线时为 0（无第二半轴）。 */
  getB(): number { return this.b; }

  /** 参数化：椭圆 u∈[0,2π)；双曲线两支（u<0 与 u>0，|u| 是双曲角）；抛物线 (a t², 2a t)。 */
  pointAt(u: number): Coords4 {
    if (this.kind === 'ellipse') {
      return this.center.add(this.e1.scale(this.a * Math.cos(u))).add(this.e2.scale(this.b * Math.sin(u)));
    }
    if (this.kind === 'parabola') {
      return this.center.add(this.e1.scale(this.a * u * u)).add(this.e2.scale(2 * this.a * u));
    }
    // 双曲线：(±a·cosh t, b·sinh t)，t = |u|，u 的符号选支
    const t = Math.max(-4, Math.min(4, Math.abs(u)));
    const ch = Math.cosh(t);
    const sh = Math.sinh(t);
    const sign = u < 0 ? -1 : 1;
    return this.center.add(this.e1.scale(sign * this.a * ch)).add(this.e2.scale(this.b * sh));
  }

  /** 平面内坐标 (u, v)（沿 e1/e2，原点在 center/vertex）。 */
  private planeCoords(p: Coords4): { u: number; v: number } {
    const w = p.toPoint().sub(this.center);
    return { u: w.dot(this.e1), v: w.dot(this.e2) };
  }

  isOnConic(p: Coords4): boolean {
    const pt = p.toPoint();
    const plane = new GeoPlane3D(this.kernel, this.normal, this.normal.dot(this.center));
    if (Math.abs(plane.signedDistance(pt)) > 1e-6) return false;
    const { u, v } = this.planeCoords(pt);
    if (this.kind === 'parabola') {
      // v² = 4a·u，按长度量纲取相对容差
      const residual = (v * v) / (4 * this.a) - u;
      return Math.abs(residual) < 1e-6 * Math.max(1, Math.abs(u), Math.abs((v * v) / (4 * this.a)));
    }
    const value = this.kind === 'ellipse'
      ? (u * u) / (this.a * this.a) + (v * v) / (this.b * this.b) - 1
      : (u * u) / (this.a * this.a) - (v * v) / (this.b * this.b) - 1;
    return Math.abs(value) < 1e-6;
  }

  /**
   * 平面内隐式系数 [A, B, C, D, E, F]：A u² + B uv + C v² + D u + E v + F = 0，
   * (u, v) 为 planeCoords。对标 GeoConicND matrix（顺序差异见 getMatrix）。
   */
  getCoeffs(): [number, number, number, number, number, number] {
    if (this.kind === 'parabola') return [0, 0, 1, -4 * this.a, 0, 0];
    const invA = 1 / (this.a * this.a);
    const invB = 1 / (this.b * this.b);
    return this.kind === 'ellipse'
      ? [invA, 0, invB, 0, 0, -1]
      : [invA, 0, -invB, 0, 0, -1];
  }

  /** GeoGebra 扁平矩阵 [A, C, F, B/2, D/2, E/2]（对标 ConicMatrix 索引 XX/YY/CONST/XY/X/Y）。 */
  getMatrix(): [number, number, number, number, number, number] {
    const [A, B, C, D, E, F] = this.getCoeffs();
    return [A, C, F, B / 2, D / 2, E / 2];
  }

  /** 退化判定（空集/单点/两直线）：3×3 行列式为零（量纲相对容差）。 */
  isDegenerate(): boolean {
    return isConicDegenerate(this.getCoeffs());
  }

  /**
   * 极线：点 p 关于本圆锥曲线的对偶线，返回曲线平面内的 3D 直线；
   * p 在曲线上时即切线。p 的面外分量被投影丢弃；退化对偶线返回 null。
   */
  polarLine(p: Coords4): GeoLine3D | null {
    if (!this.isDefined()) return null;
    const { u, v } = this.planeCoords(p);
    const [la, lb, lc] = dualLine(this.getCoeffs(), u, v);
    if (Math.abs(la) < 1e-12 && Math.abs(lb) < 1e-12) return null;
    // 平面内直线 la·u + lb·v + lc = 0：取垂足原点 + 方向 (-lb, la)
    const n2 = la * la + lb * lb;
    const u0 = (-la * lc) / n2;
    const v0 = (-lb * lc) / n2;
    const origin = this.center.add(this.e1.scale(u0)).add(this.e2.scale(v0));
    // GeoLine3D.parameterOf 假定单位方向，必须 normalize
    const line = new GeoLine3D(this.kernel, origin, this.e1.scale(-lb).add(this.e2.scale(la)).normalize());
    line.setDefined();
    return line;
  }

  /** 直线 × 圆锥曲线：先求线∩平面，再检查是否在曲线上。 */
  intersectLine(line: GeoLine3D): { t: number; point: Coords4 }[] {
    const plane = new GeoPlane3D(this.kernel, this.normal, this.normal.dot(this.center));
    const results: { t: number; point: Coords4 }[] = [];
    const denom = this.normal.dot(line.getDirection());
    if (Math.abs(denom) < 1e-12) return results; // 平行（共面时退化为 2D，暂不支持）
    const t = (this.normal.dot(this.center) - this.normal.dot(line.getOrigin())) / denom;
    const limits = line.getLimits();
    if (limits && (t < limits.tMin - 1e-9 || t > limits.tMax + 1e-9)) return results;
    const hit = line.pointAt(t);
    if (this.isOnConic(hit)) results.push({ t, point: hit });
    return results;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    if (this.kind === 'parabola') {
      return `${this.label} : 3D 抛物线（焦距 ${fmt(this.a)}）`;
    }
    return `${this.label} : 3D ${this.kind === 'ellipse' ? '椭圆' : '双曲线'}（半轴 ${fmt(this.a)} / ${fmt(this.b)}）`;
  }
}

function fmt(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : String(v);
}
