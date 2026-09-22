import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';
import { GeoLine3D } from './GeoLine3D';
import { GeoPlane3D } from './GeoPlane3D';

/**
 * 3D 圆 —— 中心 + 平面法向 + 半径。
 * 由三点确定：外接圆（圆心 = 三角形外心，位于三点平面内）。
 */
export class GeoCircle3D extends GeoElement {
  private center: Coords4 = Coords4.origin();
  private normal: Coords4 = Coords4.fromDirection(0, 0, 1);
  private radius = 1;

  constructor(kernel: IKernel) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName(): string { return 'GeoCircle3D'; }

  get defaultStrokeColor(): string { return '#06b6d4'; }
  get defaultLineWidth(): number { return 2; }

  setCircle(center: Coords4, normal: Coords4, radius: number): void {
    const n = normal.normalize();
    if (n.norm() < 1e-12 || !(radius > 0)) return;
    this.center = center.toPoint();
    this.normal = n;
    this.radius = radius;
  }

  getCenter(): Coords4 { return this.center; }
  getNormal(): Coords4 { return this.normal; }
  getRadius(): number { return this.radius; }

  /** 三点定圆（外接圆）；共线返回 null。 */
  static throughPoints(
    a: Coords4, b: Coords4, c: Coords4,
  ): { center: Coords4; normal: Coords4; radius: number } | null {
    const plane = GeoPlane3D.throughPoints(a, b, c);
    if (!plane) return null;
    // 外心：解 |X−A|²=|X−B|²=|X−C|² + X 在平面上
    // 线性方程组：2(B−A)·X = |B|²−|A|²；2(C−A)·X = |C|²−|A|²；n·X = d
    const p = a.toPoint(); const q = b.toPoint(); const r = c.toPoint();
    const [bax, bay, baz] = [q.x - p.x, q.y - p.y, q.z - p.z];
    const [cax, cay, caz] = [r.x - p.x, r.y - p.y, r.z - p.z];
    const rhs1 = (q.normSquared() - p.normSquared()) / 2;
    const rhs2 = (r.normSquared() - p.normSquared()) / 2;
    const rhs3 = plane.distance;
    const det = bax * (cay * plane.normal.z - caz * plane.normal.y)
      - bay * (cax * plane.normal.z - caz * plane.normal.x)
      + baz * (cax * plane.normal.y - cay * plane.normal.x);
    if (Math.abs(det) < 1e-10) return null;
    const cx = (rhs1 * (cay * plane.normal.z - caz * plane.normal.y)
      - bay * (rhs2 * plane.normal.z - caz * rhs3)
      + baz * (rhs2 * plane.normal.y - cay * rhs3)) / det;
    const cy = (bax * (rhs2 * plane.normal.z - caz * rhs3)
      - rhs1 * (cax * plane.normal.z - caz * plane.normal.x)
      + baz * (cax * rhs3 - rhs2 * plane.normal.x)) / det;
    const cz = (bax * (cay * rhs3 - rhs2 * plane.normal.y)
      - bay * (cax * rhs3 - rhs2 * plane.normal.x)
      + rhs1 * (cax * plane.normal.y - cay * plane.normal.x)) / det;
    const center = new Coords4(cx, cy, cz, 1);
    const radius = center.distanceTo(p);
    if (!(radius > 0)) return null;
    return { center, normal: plane.normal, radius };
  }

  /** 圆上参数点：center + r·(cos u·e1 + sin u·e2)。 */
  pointAt(u: number): Coords4 {
    const ref = Math.abs(this.normal.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    let e1 = {
      x: this.normal.y * ref.z - this.normal.z * ref.y,
      y: this.normal.z * ref.x - this.normal.x * ref.z,
      z: this.normal.x * ref.y - this.normal.y * ref.x,
    };
    const l1 = Math.hypot(e1.x, e1.y, e1.z) || 1;
    e1 = { x: e1.x / l1, y: e1.y / l1, z: e1.z / l1 };
    const e2 = {
      x: this.normal.y * e1.z - this.normal.z * e1.y,
      y: this.normal.z * e1.x - this.normal.x * e1.z,
      z: this.normal.x * e1.y - this.normal.y * e1.x,
    };
    const cu = Math.cos(u) * this.radius;
    const su = Math.sin(u) * this.radius;
    return this.center.add(new Coords4(
      e1.x * cu + e2.x * su,
      e1.y * cu + e2.y * su,
      e1.z * cu + e2.z * su,
      0,
    ));
  }

  isOnCircle(p: Coords4): boolean {
    const pt = p.toPoint();
    const plane = new GeoPlane3D(this.kernel, this.normal, this.normal.dot(this.center));
    if (Math.abs(plane.signedDistance(pt)) > 1e-6) return false;
    return Math.abs(pt.distanceTo(this.center) - this.radius) < 1e-6;
  }

  /**
   * 直线 × 圆求交（至多 2 点）：
   * 直线不平行于平面 → 仅直线∩平面那一点可能在圆上；
   * 直线在平面内 → 2D 圆-线二次方程。
   */
  intersectLine(line: GeoLine3D): { t: number; point: Coords4 }[] {
    const plane = new GeoPlane3D(this.kernel, this.normal, this.normal.dot(this.center));
    const o = line.getOrigin();
    const d = line.getDirection();
    const denom = this.normal.dot(d);
    const results: { t: number; point: Coords4 }[] = [];

    if (Math.abs(denom) < 1e-12) {
      // 平行：共面（直线在圆平面内）时解 2D 圆线交
      const w = o.sub(this.center);
      const vPerp = d.sub(this.normal.scale(d.dot(this.normal)));
      const wPerp = w.sub(this.normal.scale(w.dot(this.normal)));
      const a = vPerp.normSquared();
      const b = 2 * vPerp.dot(wPerp);
      const c = wPerp.normSquared() - this.radius * this.radius;
      for (const t of solveQuadratic3DCircle(a, b, c)) {
        results.push({ t, point: line.pointAt(t) });
      }
      return results;
    }

    const t = (this.normal.dot(this.center) - this.normal.dot(o)) / denom;
    const limits = line.getLimits();
    if (limits && (t < limits.tMin - 1e-9 || t > limits.tMax + 1e-9)) return results;
    const hit = line.pointAt(t);
    if (Math.abs(hit.distanceTo(this.center) - this.radius) < 1e-6) {
      results.push({ t, point: hit });
    }
    return results;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const c = this.center;
    return `${this.label} : 圆（圆心 (${fmt(c.getX())}, ${fmt(c.getY())}, ${fmt(c.getZ())}), r = ${fmt(this.radius)}）`;
  }
}

/** 二次方程（复用相对容差约定）。 */
function solveQuadratic3DCircle(a: number, b: number, c: number): number[] {
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), 1e-12);
  if (Math.abs(a) < 1e-12 * scale) {
    if (Math.abs(b) < 1e-12 * scale) return [];
    return [-c / b];
  }
  const delta = b * b - 4 * a * c;
  if (delta < -1e-9 * scale * scale) return [];
  if (Math.abs(delta) < 1e-9 * scale * scale) return [-b / (2 * a)];
  const s = Math.sqrt(delta);
  return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
}

function fmt(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : String(v);
}