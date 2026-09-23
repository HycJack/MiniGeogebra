/**
 * 3D 圆锥曲线算法 —— 对标 GeoGebra AlgoEllipseFociPoint3D / AlgoHyperbolaFociPoint3D /
 * AlgoIntersectPlaneQuadric 的精确表示（椭圆）。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoPlane3D } from '../geo/GeoPlane3D';
import { GeoQuadric3D } from '../geo/GeoQuadric3D';
import { GeoConic3D } from '../geo/GeoConic3D';
import { GeoLine3D } from '../geo/GeoLine3D';
import { Coords4 } from '../core/Coords4';
import { quadricPlaneSection } from '../geo/quadricSection';

export abstract class AlgoConic3DBase<T> extends AlgoElement {
  protected out: T;
  constructor(kernel: IKernel, out: T, inputs: GeoElement[]) {
    super(kernel);
    this.out = out;
    this.input = inputs;
    this.setOutput(Array.isArray(out) ? (out as unknown as GeoElement[]) : [out as unknown as GeoElement]);
  }
  getOutput(): T { return this.out; }
  setInputOutput(): void {}
  compute(): void { this.recompute(); }
  protected abstract recompute(): void;
}

/** 椭圆：焦点 F1、F2 + 曲线上一点 P（椭圆在三点平面内）。 */
export class AlgoEllipse3D extends AlgoConic3DBase<GeoConic3D> {
  constructor(kernel: IKernel, private F1: GeoPoint3D, private F2: GeoPoint3D, private P: GeoPoint3D) {
    super(kernel, new GeoConic3D(kernel), [F1, F2, P]);
  }

  protected recompute(): void {
    const plane = GeoPlane3D.throughPoints(this.F1.getCoords3(), this.F2.getCoords3(), this.P.getCoords3());
    if (!plane) { this.out.setUndefined(); return; }
    const f1 = this.F1.getCoords3();
    const f2 = this.F2.getCoords3();
    const p = this.P.getCoords3();
    const focal = f1.distanceTo(f2) / 2;
    const a = (p.distanceTo(f1) + p.distanceTo(f2)) / 2;
    if (!(a > focal + 1e-9)) { this.out.setUndefined(); return; }
    const b = Math.sqrt(a * a - focal * focal);
    const center = f1.add(f2).scale(0.5);
    const e1 = f2.sub(f1).normalize();
    const e2 = plane.normal.cross(e1);
    this.out.setEllipse(center, e1, e2, a, b);
    this.out.setDefined();
  }
}

/** 双曲线：焦点 F1、F2 + 曲线上一点 P。 */
export class AlgoHyperbola3D extends AlgoConic3DBase<GeoConic3D> {
  constructor(kernel: IKernel, private F1: GeoPoint3D, private F2: GeoPoint3D, private P: GeoPoint3D) {
    super(kernel, new GeoConic3D(kernel), [F1, F2, P]);
  }

  protected recompute(): void {
    const plane = GeoPlane3D.throughPoints(this.F1.getCoords3(), this.F2.getCoords3(), this.P.getCoords3());
    if (!plane) { this.out.setUndefined(); return; }
    const f1 = this.F1.getCoords3();
    const f2 = this.F2.getCoords3();
    const p = this.P.getCoords3();
    const focal = f1.distanceTo(f2) / 2;
    const a = Math.abs(p.distanceTo(f1) - p.distanceTo(f2)) / 2;
    if (!(a > 1e-9) || !(a < focal - 1e-9)) { this.out.setUndefined(); return; }
    const b = Math.sqrt(focal * focal - a * a);
    const center = f1.add(f2).scale(0.5);
    const e1 = f2.sub(f1).normalize();
    const e2 = plane.normal.cross(e1);
    this.out.setHyperbola(center, e1, e2, a, b);
    this.out.setDefined();
  }
}

/** 平面 × 二次曲面 → 精确圆锥曲线（解析合同变换，对标 AlgoIntersectPlaneQuadric）。 */
export class AlgoIntersectConicPlaneQuadric extends AlgoConic3DBase<GeoConic3D> {
  constructor(kernel: IKernel, private plane: GeoPlane3D, private quadric: GeoQuadric3D) {
    super(kernel, new GeoConic3D(kernel), [plane, quadric]);
  }

  protected recompute(): void {
    // 解析截面：球→圆（a=b）、柱/椭球→椭圆、锥→椭圆/双曲线/抛物线，全部精确。
    const section = quadricPlaneSection(this.quadric, this.plane);
    if (section) {
      if (section.kind === 'ellipse') {
        this.out.setEllipse(section.center, section.dir1, section.dir2, section.a, section.b);
      } else if (section.kind === 'hyperbola') {
        this.out.setHyperbola(section.center, section.dir1, section.dir2, section.a, section.b);
      } else {
        this.out.setParabola(section.center, section.dir1, section.dir2, section.a);
      }
      this.out.setDefined();
      return;
    }
    // 两直线退化（平面 ∥ 柱轴等）：置 undefined 而不是输出拟合出的伪椭圆。
    this.out.setUndefined();
  }
}

/**
 * 焦点 + 准线 → 3D 抛物线（对标 GeoGebra CmdParabola3D：`Parabola[point, line]`）。
 * 焦点在准线上时输出 undefined（退化为点）。
 */
export class AlgoParabola3D extends AlgoConic3DBase<GeoConic3D> {
  constructor(
    kernel: IKernel,
    private readonly focus: GeoPoint3D,
    private readonly directrix: GeoLine3D,
  ) {
    super(kernel, new GeoConic3D(kernel), [focus, directrix]);
  }

  protected recompute(): void {
    if (!this.focus.isDefined() || !this.directrix.isDefined()) {
      this.out.setUndefined();
      return;
    }
    const f = this.focus.getCoords3();
    const o = this.directrix.getOrigin();
    const d = this.directrix.getDirection().normalize();
    // 焦点在准线上的投影 H：顶点 = F 与 H 中点，轴 = F − H（⊥ 准线），焦距 = |F − H|/2
    const t = f.sub(o).dot(d);
    const h = o.add(d.scale(t));
    const dist = f.sub(h).norm();
    if (!(dist > 1e-9) || !Number.isFinite(dist)) {
      this.out.setUndefined();
      return;
    }
    // axis ⊥ d（H 为垂足）→ 准线方向即平面内垂直于轴的方向
    // 注意 scale 保留 w：f+h 得 w=2，toPoint() 归一即中点（scale(0.5) 会二次折半）
    const vertex = f.add(h).toPoint();
    const axis = f.sub(h).normalize();
    this.out.setParabola(vertex, axis, d, dist / 2);
    this.out.setDefined();
  }
}
