import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';
import { GeoLine3D } from './GeoLine3D';

/**
 * 3D 平面 —— n·p = d（单位法向 + 距离），对标 GeoGebra GeoPlane3D。
 * 同时提供"过三点 / 点+法向"的构造静态方法与线面求交。
 */
export class GeoPlane3D extends GeoElement {
  private normal: Coords4;   // 单位法向（w=0）
  private distance: number;  // d

  constructor(kernel: IKernel, normal?: Coords4, distance?: number) {
    super(kernel, new GeoVec3D(0, 0, 0));
    const n = (normal ?? Coords4.fromDirection(0, 0, 1)).normalize();
    this.normal = n;
    this.distance = distance ?? 0;
  }

  getClassName(): string { return 'GeoPlane3D'; }

  get defaultStrokeColor(): string { return '#10b981'; }
  get defaultLineWidth(): number { return 1; }

  setGeometry(normal: Coords4, distance: number): void {
    const n = normal.normalize();
    if (n.norm() < 1e-12) return;
    this.normal = n;
    this.distance = distance;
  }

  getNormal(): Coords4 { return this.normal; }
  getDistance(): number { return this.distance; }

  /** 有向距离（点法式求值）；0 表示点在平面上。 */
  signedDistance(point: Coords4): number {
    return this.normal.dot(point.toPoint()) - this.distance;
  }

  contains(point: Coords4): boolean {
    return Math.abs(this.signedDistance(point)) < 1e-7;
  }

  isParallelTo(line: GeoLine3D): boolean {
    return Math.abs(this.normal.dot(line.getDirection())) < 1e-9;
  }

  /**
   * 直线与平面求交：origin + t·dir 满足 n·(origin + t·dir) = d。
   * 平行（含共面）返回 null。
   */
  intersectLine(line: GeoLine3D): Coords4 | null {
    const o = line.getOrigin();
    const dir = line.getDirection();
    const denom = this.normal.dot(dir);
    if (Math.abs(denom) < 1e-12) return null;
    const t = (this.distance - this.normal.dot(o)) / denom;
    const limits = line.getLimits();
    if (limits && (t < limits.tMin - 1e-9 || t > limits.tMax + 1e-9)) return null;
    return line.pointAt(t);
  }

  /** 过三点的平面（共线返回 null）。 */
  static throughPoints(a: Coords4, b: Coords4, c: Coords4): { normal: Coords4; distance: number } | null {
    const ab = b.sub(a).asDirection();
    const ac = c.sub(a).asDirection();
    const normal = ab.cross(ac);
    if (normal.norm() < 1e-9) return null; // 共线
    const n = normal.normalize();
    return { normal: n, distance: n.dot(a.toPoint()) };
  }

  /** 过点且法向为 n 的平面（距离取点到原点的投影）。 */
  static throughPointNormal(point: Coords4, normal: Coords4): { normal: Coords4; distance: number } {
    const n = normal.normalize();
    return { normal: n, distance: n.dot(point.toPoint()) };
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const n = this.normal;
    return `${this.label} : ${fmt(n.x)}x + ${fmt(n.y)}y + ${fmt(n.z)}z = ${fmt(this.distance)}`;
  }
}

function fmt(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : String(v);
}
