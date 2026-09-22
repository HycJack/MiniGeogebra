import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';
import { GeoLine3D } from './GeoLine3D';

export type QuadricKind = 'sphere' | 'cylinder' | 'cone' | 'ellipsoid';

/**
 * 二次曲面（球/无限柱/无限锥/椭球）—— 对标 GeoGebra GeoQuadric3D 的轻量子集。
 * 统一以「基准点 + 轴单位方向 + 参数」描述，提供解析的线×曲面求交。
 */
export class GeoQuadric3D extends GeoElement {
  private kind: QuadricKind;
  private base: Coords4;       // 球心 / 轴上一点 / 锥顶点 / 椭球中心
  private axis: Coords4;       // 单位轴方向
  private param: number;       // 球：半径；柱：半径；锥：半顶角（弧度）
  private radii: [number, number, number] = [1, 1, 1]; // 椭球三半轴
  private basis: [Coords4, Coords4, Coords4] = [
    Coords4.fromDirection(1, 0, 0),
    Coords4.fromDirection(0, 1, 0),
    Coords4.fromDirection(0, 0, 1),
  ]; // 椭球局部帧（默认轴对齐）

  constructor(kernel: IKernel, kind: QuadricKind = 'sphere') {
    super(kernel, new GeoVec3D(0, 0, 0));
    this.kind = kind;
    this.base = Coords4.origin();
    this.axis = Coords4.fromDirection(0, 0, 1);
    this.param = 1;
  }

  getClassName(): string { return 'GeoQuadric3D'; }

  get defaultStrokeColor(): string { return '#ec4899'; }
  get defaultLineWidth(): number { return 1; }

  setSphere(center: Coords4, radius: number): void {
    this.kind = 'sphere';
    this.base = center.toPoint();
    this.param = radius;
  }

  setCylinder(base: Coords4, axis: Coords4, radius: number): void {
    this.kind = 'cylinder';
    this.base = base.toPoint();
    this.axis = axis.normalize();
    this.param = radius;
  }

  setCone(base: Coords4, axis: Coords4, halfAngle: number): void {
    this.kind = 'cone';
    this.base = base.toPoint();
    this.axis = axis.normalize();
    this.param = halfAngle;
  }

  setEllipsoid(center: Coords4, a: number, b: number, c: number, basis?: [Coords4, Coords4, Coords4]): void {
    this.kind = 'ellipsoid';
    this.base = center.toPoint();
    this.param = 1;
    this.radii = [a, b, c];
    if (basis) {
      // 正交化：e2 去除 e1 分量，e3 = e1×e2
      const e1 = basis[0].normalize();
      const e2Raw = basis[1].sub(e1.scale(basis[1].dot(e1)));
      const e2 = e2Raw.normalize();
      const e3 = e2.norm() > 1e-12 ? e1.cross(e2).normalize() : e1.cross(Coords4.fromDirection(0, 0, 1)).normalize();
      this.basis = [e1, e2, e3];
    } else {
      this.basis = [
        Coords4.fromDirection(1, 0, 0),
        Coords4.fromDirection(0, 1, 0),
        Coords4.fromDirection(0, 0, 1),
      ];
    }
  }

  getBasis(): [Coords4, Coords4, Coords4] { return this.basis; }

  getKind(): QuadricKind { return this.kind; }
  getBase(): Coords4 { return this.base; }
  getAxis(): Coords4 { return this.axis; }
  getParam(): number { return this.param; }
  getRadii(): [number, number, number] { return this.radii; }

  /** 球/椭球体积 / 曲面包含判断。 */
  isOnSurface(point: Coords4): boolean {
    const p = point.toPoint();
    if (this.kind === 'sphere') {
      return Math.abs(p.distanceTo(this.base) - this.param) < 1e-6;
    }
    if (this.kind === 'ellipsoid') {
      const [a, b, c] = this.radii;
      const w = p.sub(this.base);
      const u = w.dot(this.basis[0]) / a;
      const v = w.dot(this.basis[1]) / b;
      const t = w.dot(this.basis[2]) / c;
      return Math.abs(u * u + v * v + t * t - 1) < 1e-6;
    }
    if (this.kind === 'cylinder') {
      const d = axisDistance(p, this.base, this.axis);
      return Math.abs(d - this.param) < 1e-6;
    }
    // 锥：径向/轴向比 = tan(半顶角)
    const w = p.sub(this.base);
    const along = w.dot(this.axis);
    const radial = Math.sqrt(Math.max(0, w.normSquared() - along * along));
    const actual = radial / Math.max(1e-12, Math.abs(along));
    return Math.abs(Math.atan(actual) - this.param) < 1e-6;
  }

  /**
   * 直线 × 曲面求交（解析二次方程），至多 2 个交点。
   * 返回沿直线方向的参数 t 与点；相切/无交/退化为 0~1 个。
   */
  intersectLine(line: GeoLine3D): { t: number; point: Coords4 }[] {
    const o = line.getOrigin();
    const d = line.getDirection();
    const limits = line.getLimits();
    let a = 0, b = 0, c = 0;

    if (this.kind === 'sphere') {
      const w = o.sub(this.base);
      a = d.normSquared();
      b = 2 * d.dot(w);
      c = w.normSquared() - this.param * this.param;
    } else if (this.kind === 'ellipsoid') {
      // 局部帧：u_i = (P−C)·e_i，Σ(u_i/r_i)² = 1；直线按基投影后解二次方程
      const [ra, rb, rc] = this.radii;
      const w = o.sub(this.base);
      const du0 = d.dot(this.basis[0]);
      const du1 = d.dot(this.basis[1]);
      const du2 = d.dot(this.basis[2]);
      const wu0 = w.dot(this.basis[0]);
      const wu1 = w.dot(this.basis[1]);
      const wu2 = w.dot(this.basis[2]);
      a = (du0 * du0) / (ra * ra) + (du1 * du1) / (rb * rb) + (du2 * du2) / (rc * rc);
      b = 2 * ((wu0 * du0) / (ra * ra) + (wu1 * du1) / (rb * rb) + (wu2 * du2) / (rc * rc));
      c = (wu0 * wu0) / (ra * ra) + (wu1 * wu1) / (rb * rb) + (wu2 * wu2) / (rc * rc) - 1;
    } else if (this.kind === 'cylinder') {
      const w = o.sub(this.base);
      const vPerp = d.sub(this.axis.scale(d.dot(this.axis)));
      const wPerp = w.sub(this.axis.scale(w.dot(this.axis)));
      a = vPerp.normSquared();
      b = 2 * vPerp.dot(wPerp);
      c = wPerp.normSquared() - this.param * this.param;
    } else {
      // 锥：((P−A)·D)² = cos²α · |P−A|²
      const w = o.sub(this.base);
      const cos2 = Math.cos(this.param) ** 2;
      const wD = w.dot(this.axis);
      const dD = d.dot(this.axis);
      a = dD * dD - cos2 * d.normSquared();
      b = 2 * (wD * dD - cos2 * w.dot(d));
      c = wD * wD - cos2 * w.normSquared();
    }

    const roots = solveQuadratic3D(a, b, c);
    const results: { t: number; point: Coords4 }[] = [];
    for (const t of roots) {
      if (limits && (t < limits.tMin - 1e-9 || t > limits.tMax + 1e-9)) continue;
      results.push({ t, point: line.pointAt(t) });
    }
    return results;
  }

  /** 体积（球/椭球；柱/锥为无限体，返回 Infinity）。 */
  volume(): number {
    if (this.kind === 'sphere') return (4 / 3) * Math.PI * this.param ** 3;
    if (this.kind === 'ellipsoid') {
      const [a, b, c] = this.radii;
      return (4 / 3) * Math.PI * a * b * c;
    }
    return Infinity;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const b = this.base;
    if (this.kind === 'sphere') return `${this.label} : 球心 (${fmt(b.getX())}, ${fmt(b.getY())}, ${fmt(b.getZ())}), r = ${fmt(this.param)}`;
    if (this.kind === 'ellipsoid') return `${this.label} : 椭球中心 (${fmt(b.getX())}, ${fmt(b.getY())}, ${fmt(b.getZ())}), 半轴 ${fmt(this.radii[0])}/${fmt(this.radii[1])}/${fmt(this.radii[2])}`;
    if (this.kind === 'cylinder') return `${this.label} : 无限圆柱 (轴方向 (${fmt(this.axis.x)}, ${fmt(this.axis.y)}, ${fmt(this.axis.z)})), r = ${fmt(this.param)}`;
    return `${this.label} : 无限圆锥 (顶点 (${fmt(b.getX())}, ${fmt(b.getY())}, ${fmt(b.getZ())})), 半顶角 ${fmt(this.param * 180 / Math.PI)}°`;
  }
}

/** 点到过 base、方向 axis 的直线的距离。 */
function axisDistance(p: Coords4, base: Coords4, axis: Coords4): number {
  const w = p.sub(base);
  const along = w.dot(axis);
  return Math.sqrt(Math.max(0, w.normSquared() - along * along));
}

/** 二次方程 a·t² + b·t + c = 0 的实根（相对容差）。 */
export function solveQuadratic3D(a: number, b: number, c: number): number[] {
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
