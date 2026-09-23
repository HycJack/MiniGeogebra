import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';
import { GeoLine3D } from './GeoLine3D';
import {
  QuadricTypeString,
  classifyFlatQuadric,
  evaluateFlatQuadric,
  QUADRIC_TYPE_DISPLAY,
} from './quadricClassify';

export type QuadricKind = 'sphere' | 'cylinder' | 'cone' | 'ellipsoid' | 'general';
export type { QuadricTypeString };

// 对标 GeoGebra AlgoIntersectLineQuadric3D 的 intersectionType 常量（1–6）
export const INTERSECTION_PRODUCING_LINE = 1;
export const INTERSECTION_ASYMPTOTIC_LINE = 2;
export const INTERSECTION_MEETING_LINE = 3;
export const INTERSECTION_TANGENT_LINE = 4;
export const INTERSECTION_SECANT_LINE = 5;
export const INTERSECTION_PASSING_LINE = 6;
export type LineQuadricIntersectionType =
  | typeof INTERSECTION_PRODUCING_LINE
  | typeof INTERSECTION_ASYMPTOTIC_LINE
  | typeof INTERSECTION_MEETING_LINE
  | typeof INTERSECTION_TANGENT_LINE
  | typeof INTERSECTION_SECANT_LINE
  | typeof INTERSECTION_PASSING_LINE;

/** 线×二次方程系数 a·t² + b·t + c（b 为完整一次项；官方为 u t² + 2b_g t + w）。 */
interface LineQuadricCoeffs { a: number; b: number; c: number; }

/** 直线×曲面分类结果：type + 双槽输出（null = undefined，槽位对齐官方 Q[0]/Q[1]）。 */
export interface LineQuadricIntersection {
  type: LineQuadricIntersectionType;
  slots: ({ t: number; point: Coords4 } | null)[];
}

/**
 * 二次曲面（球/无限柱/无限锥/椭球）—— 对标 GeoGebra GeoQuadric3D 的轻量子集。
 * 统一以「基准点 + 轴单位方向 + 参数」描述，提供解析的线×曲面求交。
 */
export class GeoQuadric3D extends GeoElement {
  private kind: QuadricKind;
  private base: Coords4;       // 球心 / 轴上一点 / 锥顶点 / 椭球中心
  private axis: Coords4;       // 单位轴方向
  private param: number;       // 球：半径；柱：半径；锥：半顶角（弧度）
  private height: number | null = null; // 柱/锥有限高（沿轴 t∈[0,h]；null=无限）
  private radii: [number, number, number] = [1, 1, 1]; // 椭球三半轴
  private basis: [Coords4, Coords4, Coords4] = [
    Coords4.fromDirection(1, 0, 0),
    Coords4.fromDirection(0, 1, 0),
    Coords4.fromDirection(0, 0, 1),
  ]; // 椭球局部帧（默认轴对齐）
  /** 一般二次曲面 10 系数（setMatrix 时写入；解析型为空）。 */
  private matrix: number[] | null = null;
  private typeString: QuadricTypeString = 'Quadric';

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
  get defaultFillColor(): string { return 'rgba(236, 72, 153, 0.14)'; }

  setSphere(center: Coords4, radius: number): void {
    this.kind = 'sphere';
    this.base = center.toPoint();
    this.param = radius;
    this.height = null;
  }

  /** height 缺省/非法 → 无限柱；有限 h>0 时为端盖柱体（t∈[0,h]）。 */
  setCylinder(base: Coords4, axis: Coords4, radius: number, height?: number | null): void {
    this.kind = 'cylinder';
    this.base = base.toPoint();
    this.axis = axis.normalize();
    this.param = radius;
    this.height = height !== undefined && Number.isFinite(height) && height > 0 ? height : null;
  }

  /** height 缺省/非法 → 无限锥；有限 h>0 时为顶点在 base、沿轴 h 的单叶锥体。 */
  setCone(base: Coords4, axis: Coords4, halfAngle: number, height?: number | null): void {
    this.kind = 'cone';
    this.base = base.toPoint();
    this.axis = axis.normalize();
    this.param = halfAngle;
    this.height = height !== undefined && Number.isFinite(height) && height > 0 ? height : null;
  }

  setEllipsoid(center: Coords4, a: number, b: number, c: number, basis?: [Coords4, Coords4, Coords4]): void {
    this.kind = 'ellipsoid';
    this.base = center.toPoint();
    this.param = 1;
    this.height = null;
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
  /** 官方 getTypeString() 短键（有 matrix 时用分类结果；否则按解析 kind 推导）。 */
  getTypeString(): QuadricTypeString {
    if (this.matrix) return this.typeString;
    if (this.kind === 'sphere') return 'Sphere';
    if (this.kind === 'ellipsoid') return 'Ellipsoid';
    if (this.kind === 'cylinder') return 'Cylinder';
    if (this.kind === 'cone') return 'Cone';
    return this.typeString;
  }
  /** 英文全名（对齐 menu.properties）。 */
  getTypeDisplay(): string { return QUADRIC_TYPE_DISPLAY[this.getTypeString()]; }
  getMatrix(): number[] | null { return this.matrix ? [...this.matrix] : null; }

  /**
   * 10 系数一般二次曲面（对标 GeoQuadric3D.setMatrix + classifyQuadric）。
   * 分类为球/椭球时回填解析参数，复用既有渲染与体积；其余留 general。
   */
  setMatrix(m: number[]): void {
    if (!Array.isArray(m) || m.length < 10 || m.slice(0, 10).some(v => !Number.isFinite(v))) {
      this.setUndefined();
      return;
    }
    this.matrix = m.slice(0, 10);
    this.typeString = classifyFlatQuadric(this.matrix);
    this.kind = 'general';
    this.height = null;
    this.base = Coords4.origin();
    this.axis = Coords4.fromDirection(0, 0, 1);
    this.param = 1;
    // 球/椭球（对角形式）回填解析参数 → 复用既有渲染/体积/求交
    if (this.typeString === 'Sphere') {
      const center = this.centerFromMatrix();
      if (center) {
        const λ = this.matrix[0];
        const radius = Math.sqrt(Math.max(0, -this.betaAt(center) / λ));
        if (radius > 0) {
          this.setSphere(center, radius); // kind → sphere，matrix/typeString 保留
        }
      }
    } else if (this.typeString === 'Ellipsoid') {
      const mm = this.matrix;
      const noCross = Math.abs(mm[4]) < 1e-12 && Math.abs(mm[5]) < 1e-12 && Math.abs(mm[6]) < 1e-12;
      const center = noCross ? this.centerFromMatrix() : null;
      if (center && mm[0] > 0 && mm[1] > 0 && mm[2] > 0) {
        const beta = this.betaAt(center);
        if (beta < 0) {
          const a = Math.sqrt(-beta / mm[0]);
          const b = Math.sqrt(-beta / mm[1]);
          const c = Math.sqrt(-beta / mm[2]);
          if (a > 0 && b > 0 && c > 0) this.setEllipsoid(center, a, b, c);
        }
      }
    }
    this.setDefined();
  }

  /** 中心 −A⁻¹b（det=0 时 null）。 */
  private centerFromMatrix(): Coords4 | null {
    const m = this.matrix;
    if (!m) return null;
    const det =
      m[0] * m[1] * m[2] - m[0] * m[6] * m[6] - m[1] * m[5] * m[5] - m[2] * m[4] * m[4] +
      2 * m[4] * m[5] * m[6];
    if (Math.abs(det) < 1e-14) return null;
    const cx = (
      -m[1] * m[2] * m[7] + m[1] * m[5] * m[9] + m[2] * m[4] * m[8] -
      m[4] * m[6] * m[9] - m[5] * m[6] * m[8] + m[6] * m[6] * m[7]
    ) / det;
    const cy = (
      -m[0] * m[2] * m[8] + m[0] * m[6] * m[9] + m[2] * m[4] * m[7] -
      m[4] * m[5] * m[9] + m[5] * m[5] * m[8] - m[5] * m[6] * m[7]
    ) / det;
    const cz = (
      -m[0] * m[1] * m[9] + m[0] * m[6] * m[8] + m[1] * m[5] * m[7] +
      m[4] * m[4] * m[9] - m[4] * m[5] * m[8] - m[4] * m[6] * m[7]
    ) / det;
    if (![cx, cy, cz].every(Number.isFinite)) return null;
    return Coords4.fromPoint(cx, cy, cz);
  }

  private betaAt(c: Coords4): number {
    const m = this.matrix;
    if (!m) return 0;
    return m[7] * c.getX() + m[8] * c.getY() + m[9] * c.getZ() + m[3];
  }
  getBase(): Coords4 { return this.base; }
  getAxis(): Coords4 { return this.axis; }
  getParam(): number { return this.param; }
  getRadii(): [number, number, number] { return this.radii; }
  /** 柱/锥有限高（沿轴）；null = 无限。 */
  getHeight(): number | null { return this.height; }
  isLimited(): boolean { return this.height !== null; }

  /** 点沿轴参数（相对 base，>0 为 axis 正向）。 */
  private axialOf(p: Coords4): number {
    return p.sub(this.base).dot(this.axis);
  }

  /** 有限体：轴向参数是否落在 [0, height]（含端盖，eps 容差）。 */
  private withinHeight(p: Coords4): boolean {
    if (this.height === null) return true;
    const t = this.axialOf(p);
    return t >= -1e-9 && t <= this.height + 1e-9;
  }

  /** 球/椭球体积 / 曲面包含判断（有限柱/锥同时检查轴向范围）。 */
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
    if (this.kind === 'general') {
      if (this.matrix) return Math.abs(evaluateFlatQuadric(this.matrix, p.getX(), p.getY(), p.getZ())) < 1e-6;
      return false;
    }
    if (this.kind === 'cylinder') {
      if (!this.withinHeight(p)) return false;
      const d = axisDistance(p, this.base, this.axis);
      return Math.abs(d - this.param) < 1e-6;
    }
    // 锥：径向/轴向比 = tan(半顶角)；有限时仅保留 base→top 单叶
    if (!this.withinHeight(p)) return false;
    const w = p.sub(this.base);
    const along = w.dot(this.axis);
    if (this.height !== null && Math.abs(along) < 1e-9) return Math.abs(this.param) < 1e-6; // 顶点处
    const radial = Math.sqrt(Math.max(0, w.normSquared() - along * along));
    const actual = radial / Math.max(1e-12, Math.abs(along));
    return Math.abs(Math.atan(actual) - this.param) < 1e-6;
  }

  /**
   * 直线 × 曲面二次方程系数 a·t² + b·t + c（与 solveQuadratic3D 约定一致）。
   * 分类与求根共用，避免两套系数口径漂移。
   */
  private lineQuadricCoeffs(line: GeoLine3D): LineQuadricCoeffs {
    const o = line.getOrigin();
    const d = line.getDirection();
    let a = 0, b = 0, c = 0;

    if (this.kind === 'general' && this.matrix) {
      // Q(P) = Q(o + t d) → a = dᵀAd, b = 2(dᵀAo + d·b), c = Q(o)
      const m = this.matrix;
      const ox = o.getX(), oy = o.getY(), oz = o.getZ();
      const dx = d.getX(), dy = d.getY(), dz = d.getZ();
      a =
        m[0] * dx * dx + m[1] * dy * dy + m[2] * dz * dz +
        2 * m[4] * dx * dy + 2 * m[5] * dx * dz + 2 * m[6] * dy * dz;
      const dAo =
        m[0] * dx * ox + m[1] * dy * oy + m[2] * dz * oz +
        m[4] * (dx * oy + dy * ox) + m[5] * (dx * oz + dz * ox) + m[6] * (dy * oz + dz * oy) +
        m[7] * dx + m[8] * dy + m[9] * dz;
      b = 2 * dAo;
      c = evaluateFlatQuadric(m, ox, oy, oz);
    } else if (this.kind === 'sphere') {
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
    return { a, b, c };
  }

  /**
   * 直线 × 曲面求交并分类（对标官方 computeNoPermutation）。
   * 官方在齐次矩阵上解 u t² + 2b_g t + w；此处 a=u、b=2b_g、c=w，
   * 零判据用官方 STANDARD_PRECISION=1e-8 的绝对阈值。
   */
  intersectLineClassified(line: GeoLine3D): LineQuadricIntersection {
    const { a, b, c } = this.lineQuadricCoeffs(line);
    // 官方 b_g = b/2；dis = b_g² − u·w
    const u = a;
    const bg = b / 2;
    const w = c;
    const EPS = 1e-8;

    let type: LineQuadricIntersectionType;
    if (Math.abs(u) < EPS) {
      if (Math.abs(bg) < EPS) {
        type = Math.abs(w) < EPS
          ? INTERSECTION_PRODUCING_LINE   // 整条直线落在曲面上
          : INTERSECTION_ASYMPTOTIC_LINE; // 平行无交（如柱面外平行轴线）
      } else {
        type = INTERSECTION_MEETING_LINE;  // 一次方程唯一解
      }
    } else {
      const dis = bg * bg - u * w;
      if (Math.abs(dis) < EPS) type = INTERSECTION_TANGENT_LINE;
      else type = dis > 0 ? INTERSECTION_SECANT_LINE : INTERSECTION_PASSING_LINE;
    }

    const limits = line.getLimits();
    const within = (t: number): boolean =>
      !limits || (t >= limits.tMin - 1e-9 && t <= limits.tMax + 1e-9);
    const hit = (t: number): { t: number; point: Coords4 } => ({ t, point: line.pointAt(t) });
    const slots: ({ t: number; point: Coords4 } | null)[] = [null, null];

    if (type === INTERSECTION_MEETING_LINE) {
      // t = −w / (2b_g) = −c/b；官方按 b_g 符号决定落在 Q[0] 还是 Q[1]
      const t0 = -c / b;
      if (within(t0)) {
        const h = hit(t0);
        if (bg < 0) slots[0] = h;
        else slots[1] = h;
      }
    } else if (type === INTERSECTION_TANGENT_LINE) {
      // 双槽同点（官方 Q[0]=Q[1]）
      const t1 = -bg / u;
      if (within(t1)) {
        const h = hit(t1);
        slots[0] = h;
        slots[1] = { t: h.t, point: h.point };
      }
    } else if (type === INTERSECTION_SECANT_LINE) {
      // 求根走既有相对容差路径，保证数值稳定
      const roots = solveQuadratic3D(a, b, c);
      roots.forEach((t, i) => {
        if (i < 2 && within(t)) slots[i] = hit(t);
      });
    }
    // 有限柱/锥：轴向超出 [0,h] 的交点剔除；全被剔 → passing
    if (this.height !== null) {
      let any = false;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s && !this.withinHeight(s.point.toPoint())) slots[i] = null;
        if (slots[i]) any = true;
      }
      if (!any) type = INTERSECTION_PASSING_LINE;
    }
    return { type, slots };
  }

  /**
   * 直线 × 曲面求交（解析二次方程），至多 2 个交点。
   * 返回沿直线方向的参数 t 与点；相切/无交/退化为 0~1 个。
   */
  intersectLine(line: GeoLine3D): { t: number; point: Coords4 }[] {
    const { a, b, c } = this.lineQuadricCoeffs(line);
    const limits = line.getLimits();
    const roots = solveQuadratic3D(a, b, c);
    const results: { t: number; point: Coords4 }[] = [];
    for (const t of roots) {
      if (limits && (t < limits.tMin - 1e-9 || t > limits.tMax + 1e-9)) continue;
      const point = line.pointAt(t);
      if (!this.withinHeight(point.toPoint())) continue;
      results.push({ t, point });
    }
    return results;
  }

  /** 体积：球/椭球；有限柱 π r² h；有限锥 (1/3)π (h·tanα)² h；无限柱/锥 Infinity。 */
  volume(): number {
    // 有 matrix 时按分类：球/椭球已回填解析参 → 走下方 kind 分支；其余无限
    if (this.matrix && this.kind === 'general') {
      if (this.typeString === 'Sphere' && this.param > 0) {
        return (4 / 3) * Math.PI * this.param ** 3;
      }
      if (this.typeString === 'Ellipsoid') {
        const [a, b, c] = this.radii;
        if (a > 0 && b > 0 && c > 0) return (4 / 3) * Math.PI * a * b * c;
      }
      return Infinity;
    }
    if (this.kind === 'sphere') return (4 / 3) * Math.PI * this.param ** 3;
    if (this.kind === 'ellipsoid') {
      const [a, b, c] = this.radii;
      return (4 / 3) * Math.PI * a * b * c;
    }
    if (this.height === null) return Infinity;
    const h = this.height;
    if (this.kind === 'cylinder') return Math.PI * this.param * this.param * h;
    // 锥：顶点在 base，top 半径 = h·tan(半顶角)
    const rTop = h * Math.tan(this.param);
    return (1 / 3) * Math.PI * rTop * rTop * h;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const b = this.base;
    if (this.kind === 'sphere') return `${this.label} : 球心 (${fmt(b.getX())}, ${fmt(b.getY())}, ${fmt(b.getZ())}), r = ${fmt(this.param)}`;
    if (this.kind === 'ellipsoid') return `${this.label} : 椭球中心 (${fmt(b.getX())}, ${fmt(b.getY())}, ${fmt(b.getZ())}), 半轴 ${fmt(this.radii[0])}/${fmt(this.radii[1])}/${fmt(this.radii[2])}`;
    if (this.kind === 'cylinder') {
      return this.height !== null
        ? `${this.label} : 圆柱 (轴向 (${fmt(this.axis.x)}, ${fmt(this.axis.y)}, ${fmt(this.axis.z)})), r = ${fmt(this.param)}, h = ${fmt(this.height)}`
        : `${this.label} : 无限圆柱 (轴方向 (${fmt(this.axis.x)}, ${fmt(this.axis.y)}, ${fmt(this.axis.z)})), r = ${fmt(this.param)}`;
    }
    if (this.kind === 'cone') {
      return this.height !== null
        ? `${this.label} : 圆锥 (顶点 (${fmt(b.getX())}, ${fmt(b.getY())}, ${fmt(b.getZ())})), 半顶角 ${fmt(this.param * 180 / Math.PI)}°, h = ${fmt(this.height)}`
        : `${this.label} : 无限圆锥 (顶点 (${fmt(b.getX())}, ${fmt(b.getY())}, ${fmt(b.getZ())})), 半顶角 ${fmt(this.param * 180 / Math.PI)}°`;
    }
    // general 且未回填解析参：显示分类类型（英文，对齐官方代数区）
    if (this.kind === 'general') return `${this.label} : ${this.getTypeDisplay()}`;
    return `${this.label} : ${this.getTypeDisplay()}`;
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
