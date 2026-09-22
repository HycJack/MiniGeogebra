import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';
import { GeoLine3D } from './GeoLine3D';
import { GeoPlane3D } from './GeoPlane3D';

export type Conic3DKind = 'ellipse' | 'hyperbola';

/**
 * 3D 圆锥曲线（椭圆/双曲线）—— 对标 GeoGebra GeoConic3D 的轻量版：
 * 平面内圆锥曲线 = 平面（法向 n）+ 中心 + 平面内正交基 (e1, e2) + 半轴 a/b。
 * pointAt 用参数化（椭圆：cos/sin；双曲线：cosh/sinh 两支）。
 */
export class GeoConic3D extends GeoElement {
  private kind: Conic3DKind = 'ellipse';
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

  private apply(center: Coords4, e1: Coords4, e2: Coords4, a: number, b: number): void {
    if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return;
    this.center = center.toPoint();
    this.e1 = e1.normalize();
    const e2Orth = e2.sub(this.e1.scale(e2.dot(this.e1))).normalize();
    // e2 与 e1 平行（退化输入）时兜底：任取平面内垂直方向
    this.e2 = e2Orth.norm() < 1e-12
      ? this.e1.cross(this.e1.cross(this.e1.add(new Coords4(0, 0, 1, 0)))).normalize()
      : e2Orth;
    if (this.e2.norm() < 1e-12) {
      this.e2 = new Coords4(-this.e1.y, this.e1.x, 0, 0).normalize();
    }
    this.normal = this.e1.cross(this.e2).normalize();
    this.a = a;
    this.b = b;
  }

  getKind(): Conic3DKind { return this.kind; }
  getCenter(): Coords4 { return this.center; }
  getE1(): Coords4 { return this.e1; }
  getE2(): Coords4 { return this.e2; }
  getNormal(): Coords4 { return this.normal; }
  getA(): number { return this.a; }
  getB(): number { return this.b; }

  /** 参数化：椭圆 u∈[0,2π)；双曲线两支（u<0 与 u>0，|u| 是双曲角）。 */
  pointAt(u: number): Coords4 {
    if (this.kind === 'ellipse') {
      return this.center.add(this.e1.scale(this.a * Math.cos(u))).add(this.e2.scale(this.b * Math.sin(u)));
    }
    // 双曲线：(±a·cosh t, b·sinh t)，t = |u|，u 的符号选支
    const t = Math.max(-4, Math.min(4, Math.abs(u)));
    const ch = Math.cosh(t);
    const sh = Math.sinh(t);
    const sign = u < 0 ? -1 : 1;
    return this.center.add(this.e1.scale(sign * this.a * ch)).add(this.e2.scale(this.b * sh));
  }

  /** 平面内坐标 (u, v)（沿 e1/e2）。 */
  private planeCoords(p: Coords4): { u: number; v: number } {
    const w = p.toPoint().sub(this.center);
    return { u: w.dot(this.e1), v: w.dot(this.e2) };
  }

  isOnConic(p: Coords4): boolean {
    const pt = p.toPoint();
    const plane = new GeoPlane3D(this.kernel, this.normal, this.normal.dot(this.center));
    if (Math.abs(plane.signedDistance(pt)) > 1e-6) return false;
    const { u, v } = this.planeCoords(pt);
    const value = this.kind === 'ellipse'
      ? (u * u) / (this.a * this.a) + (v * v) / (this.b * this.b) - 1
      : (u * u) / (this.a * this.a) - (v * v) / (this.b * this.b) - 1;
    return Math.abs(value) < 1e-6;
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
    return `${this.label} : 3D ${this.kind === 'ellipse' ? '椭圆' : '双曲线'}（半轴 ${fmt(this.a)} / ${fmt(this.b)}）`;
  }
}

function fmt(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : String(v);
}
