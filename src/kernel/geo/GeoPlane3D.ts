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
  /** 面内 CoordSys-lite（C10）：origin 在平面上，e1/e2 为面内正交单位基。null = 懒初始化。 */
  private coordOrigin: Coords4 | null = null;
  private coordE1: Coords4 | null = null;
  private coordE2: Coords4 | null = null;

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
    // 法向/距离变化后旧基失效：下次访问重新懒初始化（依赖平面移动时面内点随之重投影）
    this.coordOrigin = null;
    this.coordE1 = null;
    this.coordE2 = null;
  }

  getNormal(): Coords4 { return this.normal; }
  getDistance(): number { return this.distance; }

  // ---- C10：面内 CoordSys-lite ----

  /** 确保 origin/e1/e2 有效：origin = 法向·d，e1/e2 由参考轴正交化。 */
  private ensureCoordSys(): void {
    if (this.coordOrigin && this.coordE1 && this.coordE2) return;
    this.coordOrigin = this.normal.scale(this.distance).toPoint();
    const ref = Math.abs(this.normal.z) < 0.9
      ? Coords4.fromDirection(0, 0, 1)
      : Coords4.fromDirection(1, 0, 0);
    let e1 = ref.sub(this.normal.scale(ref.dot(this.normal)));
    if (e1.norm() < 1e-12) {
      e1 = Coords4.fromDirection(1, 0, 0).sub(this.normal.scale(this.normal.x));
    }
    e1 = e1.normalize();
    this.coordE1 = e1;
    this.coordE2 = this.normal.cross(e1).normalize();
  }

  /** 显式设定面内坐标系（面内作图/测试用）。 */
  setCoordSys(origin: Coords4, e1: Coords4): void {
    const o = origin.toPoint();
    if (Math.abs(this.signedDistance(o)) > 1e-7) return; // origin 必须在平面上
    const e = e1.sub(this.normal.scale(e1.dot(this.normal)));
    if (e.norm() < 1e-12) return;
    this.coordOrigin = o;
    this.coordE1 = e.normalize();
    this.coordE2 = this.normal.cross(this.coordE1).normalize();
  }

  /** 面内 (u, v) → 3D 点。 */
  getPoint(u: number, v: number): Coords4 {
    this.ensureCoordSys();
    return this.coordOrigin!.add(this.coordE1!.scale(u)).add(this.coordE2!.scale(v));
  }

  /** 3D 点 → 面内 (u, v)（先正交投影到平面）。 */
  getPlaneCoords(p: Coords4): { u: number; v: number } {
    this.ensureCoordSys();
    const projected = p.toPoint().sub(this.normal.scale(this.signedDistance(p)));
    const w = projected.sub(this.coordOrigin!);
    return { u: w.dot(this.coordE1!), v: w.dot(this.coordE2!) };
  }

  /** 正交投影到平面。 */
  project(p: Coords4): Coords4 {
    return p.toPoint().sub(this.normal.scale(this.signedDistance(p)));
  }

  /** Region3D 语义：无限平面恒为 true（点在面上）。 */
  isInRegion3D(_p: Coords4): boolean { return true; }

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
