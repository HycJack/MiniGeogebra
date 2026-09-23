/**
 * 轻量 3D 多面体（棱柱/棱锥）+ 3D 测量算法 —— 对标 GeoGebra
 * GeoPolyhedron / AlgoPolyhedronPointsPrism / AlgoPolyhedronPointsPyramid /
 * AlgoVolume / AlgoAngleLines3D / AlgoAnglePlanes3D。
 *
 * 底面：任意 n≥3 个 3D 点；棱柱由「底面 + 高（直）」或「底面 + 顶面参考点（斜）」定义，
 * 棱锥由「底面 + 顶点」定义。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoLine3D } from '../geo/GeoLine3D';
import { GeoPlane3D } from '../geo/GeoPlane3D';
import { GeoQuadric3D, INTERSECTION_PASSING_LINE, LineQuadricIntersectionType } from '../geo/GeoQuadric3D';

export type PolyhedronKind = 'prism' | 'pyramid';

/** 3D 多面体：顶点列表。底面法向自动取三点平面。 */
export class GeoPolyhedron3D extends GeoElement {
  public vertices: Coords4[] = [];
  public kind: PolyhedronKind;

  constructor(kernel: IKernel, kind: PolyhedronKind = 'prism') {
    super(kernel, new GeoVec3D(0, 0, 0));
    this.kind = kind;
  }

  getClassName(): string { return 'GeoPolyhedron3D'; }

  get defaultStrokeColor(): string { return '#a855f7'; }
  get defaultLineWidth(): number { return 1; }
  get defaultFillColor(): string { return 'rgba(168, 85, 247, 0.14)'; }

  /**
   * 构造棱柱。
   * - extrusion 为 number：直棱柱，沿底面法向平移 height；
   * - extrusion 为点（w≠0）：斜棱柱，所有底面点统一按 base[0]→该点平移
   *   （对齐 GeoGebra AlgoPolyhedronPointsPrism uptranslation）；
   * - extrusion 为方向（w=0）：按给定向量挤出（变换重建用）。
   */
  setPrism(base: Coords4[], extrusion: number | Coords4): void {
    this.kind = 'prism';
    this.vertices = base.map(p => p.toPoint());
    let t: Coords4;
    if (typeof extrusion === 'number') {
      t = this.baseNormal().scale(extrusion);
    } else if (extrusion.isPoint()) {
      t = extrusion.toPoint().sub(this.vertices[0]);
    } else {
      t = extrusion.asDirection();
    }
    this.vertices.push(...this.vertices.slice().map(v => v.add(t)));
  }

  setPyramid(base: Coords4[], apex: Coords4): void {
    this.kind = 'pyramid';
    this.vertices = base.map(p => p.toPoint());
    this.vertices.push(apex.toPoint());
  }

  /** 底面顶点；棱柱的顶面为后半段。 */
  baseVertices(): Coords4[] { return this.vertices.slice(0, this.baseCount()); }
  topVertices(): Coords4[] { return this.vertices.slice(this.baseCount()); }
  baseCount(): number { return this.kind === 'prism' ? Math.floor(this.vertices.length / 2) : this.vertices.length - 1; }

  /** 底面法向（单位）。 */
  baseNormal(): Coords4 {
    const v = this.baseVertices();
    if (v.length < 3) return Coords4.fromDirection(0, 0, 1);
    return v[1].sub(v[0]).asDirection().cross(v[2].sub(v[0]).asDirection()).normalize();
  }

  /** 底面多边形面积（半模叉积和）。 */
  baseArea(): number {
    const v = this.baseVertices();
    if (v.length < 3) return 0;
    let sum = Coords4.fromDirection(0, 0, 0);
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      sum = sum.add(v[i].asDirection().cross(v[j].asDirection()));
    }
    return sum.norm() / 2;
  }

  /** 高：棱柱 = 底面到顶面的垂直距离；棱锥 = 顶点到底面距离。 */
  height(): number {
    if (this.kind === 'prism') {
      const base = this.baseVertices();
      const top = this.topVertices();
      if (base.length === 0 || top.length === 0) return 0;
      // 垂直高 = |挤出·法向|：斜棱柱的侧移不计入（对齐 GeoGebra distPlaneOriented）
      const t = top[0].sub(base[0]).asDirection();
      return Math.abs(t.dot(this.baseNormal()));
    }
    const v = this.vertices;
    if (v.length < 4) return 0;
    const plane = GeoPlane3D.throughPoints(v[0], v[1], v[2]);
    if (!plane) return 0;
    return Math.abs(plane.normal.dot(v[v.length - 1].toPoint()) - plane.distance);
  }

  volume(): number {
    const area = this.baseArea();
    const h = this.height();
    return this.kind === 'prism' ? area * h : (area * h) / 3;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} : ${this.kind === 'prism' ? '棱柱' : '棱锥'}（底面 ${this.baseCount()} 边形, V = ${fmt(this.volume())}）`;
  }
}

function fmt(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : String(v);
}

// ---------------------------------------------------------------------------
// 算法
// ---------------------------------------------------------------------------

/** 公共基类：输出 + 输入，compute 委托 recompute()。 */
export abstract class Algo3DBase<T> extends AlgoElement {
  protected out: T;

  constructor(kernel: IKernel, out: T, inputs: GeoElement[]) {
    super(kernel);
    this.out = out;
    this.input = inputs;
    this.setOutput(Array.isArray(out) ? (out as unknown as GeoElement[]) : [out as unknown as GeoElement]);
  }

  getOutput(): T { return this.out; }

  // 输入/输出已在构造函数中接线
  setInputOutput(): void {}

  compute(): void {
    this.recompute();
  }

  protected abstract recompute(): void;
}

/** 球：球心（3D 点）+ 半径（数或球面上一点）。 */
export class AlgoSphere3D extends Algo3DBase<GeoQuadric3D> {
  constructor(kernel: IKernel, private center: GeoPoint3D, private radius: number | GeoPoint3D) {
    super(kernel, new GeoQuadric3D(kernel, 'sphere'), typeof radius === 'number' ? [center] : [center, radius]);
  }

  getRadiusValue(): number {
    return typeof this.radius === 'number'
      ? this.radius
      : this.radius.getCoords3().distanceTo(this.center.getCoords3());
  }

  protected recompute(): void {
    const r = this.getRadiusValue();
    if (!(r > 0) || !Number.isFinite(r)) { this.out.setUndefined(); return; }
    this.out.setSphere(this.center.getCoords3(), r);
    this.out.setDefined();
  }
}

/** 圆柱：轴（3D 直线）+ 半径 + 可选有限高（height 缺省/非法 → 无限）。 */
export class AlgoCylinder3D extends Algo3DBase<GeoQuadric3D> {
  constructor(
    kernel: IKernel,
    private axis: GeoLine3D,
    private radius: number,
    private height: number | GeoNumeric | null = null,
  ) {
    super(
      kernel,
      new GeoQuadric3D(kernel, 'cylinder'),
      height instanceof GeoNumeric ? [axis, height] : [axis],
    );
  }

  getRadiusValue(): number { return this.radius; }
  getHeightInput(): number | GeoNumeric | null { return this.height; }
  getHeightValue(): number | null {
    if (this.height === null) return null;
    return typeof this.height === 'number' ? this.height : this.height.getValue();
  }

  protected recompute(): void {
    if (!(this.radius > 0) || !Number.isFinite(this.radius)) { this.out.setUndefined(); return; }
    const h = this.getHeightValue();
    if (h !== null && (!Number.isFinite(h) || h <= 0)) { this.out.setUndefined(); return; }
    this.out.setCylinder(this.axis.getOrigin(), this.axis.getDirection(), this.radius, h);
    this.out.setDefined();
  }
}

/** 椭球：中心 + 三半轴（轴对齐）。 */
export class AlgoEllipsoid3D extends Algo3DBase<GeoQuadric3D> {
  constructor(kernel: IKernel, private center: GeoPoint3D, private a: number, private b: number, private c: number) {
    super(kernel, new GeoQuadric3D(kernel, 'ellipsoid'), [center]);
  }

  getRadiiValue(): [number, number, number] { return [this.a, this.b, this.c]; }

  protected recompute(): void {
    if (![this.a, this.b, this.c].every(v => v > 0 && Number.isFinite(v))) {
      this.out.setUndefined();
      return;
    }
    this.out.setEllipsoid(this.center.getCoords3(), this.a, this.b, this.c);
    this.out.setDefined();
  }
}

/** 圆锥：轴（3D 直线）+ 半顶角（弧度）+ 可选有限高（height 缺省/非法 → 无限）。 */
export class AlgoCone3D extends Algo3DBase<GeoQuadric3D> {
  constructor(
    kernel: IKernel,
    private axis: GeoLine3D,
    private halfAngle: number,
    private height: number | GeoNumeric | null = null,
  ) {
    super(
      kernel,
      new GeoQuadric3D(kernel, 'cone'),
      height instanceof GeoNumeric ? [axis, height] : [axis],
    );
  }

  getHalfAngle(): number { return this.halfAngle; }
  getHeightInput(): number | GeoNumeric | null { return this.height; }
  getHeightValue(): number | null {
    if (this.height === null) return null;
    return typeof this.height === 'number' ? this.height : this.height.getValue();
  }

  protected recompute(): void {
    if (!(this.halfAngle > 0) || this.halfAngle >= Math.PI / 2) { this.out.setUndefined(); return; }
    const h = this.getHeightValue();
    if (h !== null && (!Number.isFinite(h) || h <= 0)) { this.out.setUndefined(); return; }
    this.out.setCone(this.axis.getOrigin(), this.axis.getDirection(), this.halfAngle, h);
    this.out.setDefined();
  }
}

/** 直线 × 曲面交点（至多 2 个输出点）+ 官方 intersectionType 分类。 */
export class AlgoIntersectLineQuadric3D extends Algo3DBase<GeoPoint3D[]> {
  private intersectionType: LineQuadricIntersectionType = INTERSECTION_PASSING_LINE;

  constructor(kernel: IKernel, private line: GeoLine3D, private quadric: GeoQuadric3D) {
    super(kernel, [new GeoPoint3D(kernel), new GeoPoint3D(kernel)], [line, quadric]);
  }

  /** 1=producing 2=asymptotic 3=meeting 4=tangent 5=secant 6=passing（对标官方常量）。 */
  getIntersectionType(): LineQuadricIntersectionType { return this.intersectionType; }

  protected recompute(): void {
    this.out.forEach(p => p.setUndefined());
    const { type, slots } = this.quadric.intersectLineClassified(this.line);
    this.intersectionType = type;
    // 槽位对齐官方 Q[0]/Q[1]（meeting 按 b_g 符号、tangent 双槽同点）
    slots.forEach((slot, i) => {
      if (slot && i < this.out.length) {
        this.out[i].setCoords(slot.point.getX(), slot.point.getY(), slot.point.getZ());
        this.out[i].setDefined();
      }
    });
  }
}

/**
 * 棱柱：任意 n≥3 底面点 + 挤出方式。
 * - number：冻结高（直棱柱，沿底面法向）；
 * - GeoPoint3D：顶面参考点（斜棱柱，base[0]→该点统一平移，活引用）。
 */
export class AlgoPrism3D extends Algo3DBase<GeoPolyhedron3D> {
  constructor(kernel: IKernel, private pts: GeoPoint3D[], private heightOrTop: number | GeoPoint3D) {
    super(
      kernel,
      new GeoPolyhedron3D(kernel, 'prism'),
      typeof heightOrTop === 'number' ? [...pts] : [...pts, heightOrTop],
    );
  }

  /** 直棱柱的冻结高；斜棱柱返回 null。 */
  getHeight(): number | null {
    return typeof this.heightOrTop === 'number' ? this.heightOrTop : null;
  }

  /** 斜棱柱的顶面参考点；直棱柱返回 null。 */
  getTopPoint(): GeoPoint3D | null {
    return this.heightOrTop instanceof GeoPoint3D ? this.heightOrTop : null;
  }

  isOblique(): boolean {
    return this.heightOrTop instanceof GeoPoint3D;
  }

  protected recompute(): void {
    if (this.pts.length < 3) { this.out.setUndefined(); return; }
    const base = this.pts.map(p => p.getCoords3());
    if (typeof this.heightOrTop === 'number') {
      if (!(this.heightOrTop > 0) || !Number.isFinite(this.heightOrTop)) {
        this.out.setUndefined();
        return;
      }
      this.out.setPrism(base, this.heightOrTop);
    } else {
      const top = this.heightOrTop.getCoords3();
      if (!top.isPoint()) { this.out.setUndefined(); return; }
      this.out.setPrism(base, top);
    }
    this.out.setDefined();
  }
}

/** 棱锥：任意 n≥3 底面点 + 顶点。 */
export class AlgoPyramid3D extends Algo3DBase<GeoPolyhedron3D> {
  constructor(kernel: IKernel, private pts: GeoPoint3D[], private apex: GeoPoint3D) {
    super(kernel, new GeoPolyhedron3D(kernel, 'pyramid'), [...pts, apex]);
  }

  protected recompute(): void {
    if (this.pts.length < 3) { this.out.setUndefined(); return; }
    this.out.setPyramid(this.pts.map(p => p.getCoords3()), this.apex.getCoords3());
    this.out.setDefined();
  }
}

/** 体积：球/多面体（无限体 undefined）。 */
export class AlgoVolume3D extends Algo3DBase<GeoNumeric> {
  constructor(kernel: IKernel, private target: GeoQuadric3D | GeoPolyhedron3D) {
    super(kernel, new GeoNumeric(kernel, 0), [target]);
  }

  protected recompute(): void {
    const v = this.target.volume();
    if (!Number.isFinite(v)) { this.out.setUndefined(); return; }
    this.out.setValue(v);
    this.out.setDefined();
  }
}

/** 两直线夹角（0..π，取锐角侧）。 */
export class AlgoAngleLines3D extends Algo3DBase<GeoNumeric> {
  constructor(kernel: IKernel, private l1: GeoLine3D, private l2: GeoLine3D) {
    super(kernel, new GeoNumeric(kernel, 0), [l1, l2]);
  }

  protected recompute(): void {
    const cos = Math.abs(this.l1.getDirection().dot(this.l2.getDirection()));
    this.out.setValue(Math.acos(Math.min(1, cos)));
    this.out.setDefined();
  }
}

/** 二面角：两平面法向夹角（0..π）。 */
export class AlgoAnglePlanes3D extends Algo3DBase<GeoNumeric> {
  constructor(kernel: IKernel, private p1: GeoPlane3D, private p2: GeoPlane3D) {
    super(kernel, new GeoNumeric(kernel, 0), [p1, p2]);
  }

  protected recompute(): void {
    const cos = Math.abs(this.p1.getNormal().dot(this.p2.getNormal()));
    this.out.setValue(Math.acos(Math.min(1, cos)));
    this.out.setDefined();
  }
}
