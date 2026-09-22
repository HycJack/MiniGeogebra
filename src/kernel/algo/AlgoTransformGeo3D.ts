/**
 * 对象级 3D 变换 + 平面×二次曲面截面 —— 对标 GeoGebra TransformTranslate3D /
 * TransformRotate3D / TransformMirror3D 的对象版 与 AlgoIntersectPlaneQuadric。
 *
 * 变换作用于 GeoLine3D / GeoCircle3D / GeoPolyhedron3D 的全体几何量
 * （直线：origin+方向；圆：圆心+法向；多面体：全部顶点），输出同类型副本。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoLine3D } from '../geo/GeoLine3D';
import { GeoPlane3D } from '../geo/GeoPlane3D';
import { GeoCircle3D } from '../geo/GeoCircle3D';
import { GeoPolyhedron3D } from './AlgoPolyhedron3D';
import { GeoQuadric3D } from '../geo/GeoQuadric3D';
import { GeoPolyline3D } from '../geo/GeoPolyline3D';
import { quadricPlaneSection } from '../geo/quadricSection';
import { Coords4 } from '../core/Coords4';

export type Transform3DOp = 'translate' | 'rotate' | 'mirror';

export interface Transform3DArgs {
  op: Transform3DOp;
  dx?: number; dy?: number; dz?: number;          // translate
  axis?: GeoLine3D; angle?: number;               // rotate
  plane?: GeoPlane3D;                             // mirror
}

export abstract class AlgoTransformBase3D<T> extends AlgoElement {
  protected out: T;
  constructor(kernel: IKernel, out: T, inputs: GeoElement[], private args: Transform3DArgs) {
    super(kernel);
    this.out = out;
    this.input = inputs;
    this.setOutput(Array.isArray(out) ? (out as unknown as GeoElement[]) : [out as unknown as GeoElement]);
  }
  getOutput(): T { return this.out; }
  setInputOutput(): void {}
  compute(): void { this.recompute(); }
  protected abstract recompute(): void;
  getArgs(): Transform3DArgs { return this.args; }
  getOpIndex(): number {
    return this.args.op === 'translate' ? 0 : this.args.op === 'rotate' ? 1 : 2;
  }
}

// ---------------------------------------------------------------------------
// 变换原语（对 Coords4 生效）
// ---------------------------------------------------------------------------

function translatePoint(p: Coords4, dx: number, dy: number, dz: number): Coords4 {
  return p.add(new Coords4(dx, dy, dz, 0));
}

function rotatePoint(p: Coords4, axis: GeoLine3D, angle: number): Coords4 {
  const o = axis.getOrigin();
  const d = axis.getDirection();
  const w = p.sub(o);
  const a = d.scale(w.dot(d));
  const b = w.sub(a);
  if (b.norm() < 1e-12) return p;
  const c = d.cross(b);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return o.add(a.add(b.scale(cos)).add(c.scale(sin)));
}

function mirrorPoint(p: Coords4, plane: GeoPlane3D): Coords4 {
  const dist = plane.signedDistance(p);
  return p.sub(plane.getNormal().scale(2 * dist));
}

/** 旋转一个方向向量（绕轴方向，无平移分量）。 */
function rotateDirection(v: Coords4, axis: GeoLine3D, angle: number): Coords4 {
  const d = axis.getDirection();
  const a = d.scale(v.dot(d));
  const b = v.sub(a);
  if (b.norm() < 1e-12) return v;
  const c = d.cross(b);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return a.add(b.scale(cos)).add(c.scale(sin));
}

function mirrorDirection(v: Coords4, plane: GeoPlane3D): Coords4 {
  return v.sub(plane.getNormal().scale(2 * v.dot(plane.getNormal())));
}

/** 变换算法输入：源对象 + （绕轴旋转时）轴 /（镜像时）平面。 */
function transformInputs(source: GeoElement, args: Transform3DArgs): GeoElement[] {
  if (args.op === 'rotate' && args.axis) return [source, args.axis];
  if (args.op === 'mirror' && args.plane) return [source, args.plane];
  return [source];
}

export function applyTransform3D(p: Coords4, args: Transform3DArgs): Coords4 {
  switch (args.op) {
    case 'translate': return translatePoint(p, args.dx ?? 0, args.dy ?? 0, args.dz ?? 0);
    case 'rotate': return rotatePoint(p, args.axis!, args.angle ?? 0);
    case 'mirror': return mirrorPoint(p, args.plane!);
  }
}

function applyDirection3D(v: Coords4, args: Transform3DArgs): Coords4 {
  switch (args.op) {
    case 'translate': return v;
    case 'rotate': return rotateDirection(v, args.axis!, args.angle ?? 0);
    case 'mirror': return mirrorDirection(v, args.plane!);
  }
}

// ---------------------------------------------------------------------------
// 各对象类型的变换
// ---------------------------------------------------------------------------

export class AlgoTransformLine3D extends AlgoTransformBase3D<GeoLine3D> {
  constructor(kernel: IKernel, private source: GeoLine3D, args: Transform3DArgs) {
    super(kernel, new GeoLine3D(kernel), transformInputs(source, args), args);
  }

  protected recompute(): void {
    const args = this.getArgs();
    const origin = applyTransform3D(this.source.getOrigin(), args);
    const direction = applyDirection3D(this.source.getDirection(), args);
    if (direction.norm() < 1e-12) { this.out.setUndefined(); return; }
    this.out.setGeometry(origin, direction, this.source.getLimits());
    this.out.setDefined();
  }
}

export class AlgoTransformCircle3D extends AlgoTransformBase3D<GeoCircle3D> {
  constructor(kernel: IKernel, private source: GeoCircle3D, args: Transform3DArgs) {
    super(kernel, new GeoCircle3D(kernel), transformInputs(source, args), args);
  }

  protected recompute(): void {
    const args = this.getArgs();
    const center = applyTransform3D(this.source.getCenter(), args);
    const normal = applyDirection3D(this.source.getNormal(), args);
    if (normal.norm() < 1e-12) { this.out.setUndefined(); return; }
    this.out.setCircle(center, normal, this.source.getRadius());
    this.out.setDefined();
  }
}

export class AlgoTransformPolyhedron3D extends AlgoTransformBase3D<GeoPolyhedron3D> {
  constructor(kernel: IKernel, private source: GeoPolyhedron3D, args: Transform3DArgs) {
    super(kernel, new GeoPolyhedron3D(kernel, source.kind), transformInputs(source, args), args);
  }

  protected recompute(): void {
    const args = this.getArgs();
    const transformed = this.source.vertices.map(v => applyTransform3D(v, args));
    if (this.source.kind === 'prism') {
      const n = this.source.baseCount();
      this.out.setPrism(transformed.slice(0, n), this.source.height());
    } else {
      this.out.setPyramid(transformed.slice(0, this.source.baseCount()), transformed[transformed.length - 1]);
    }
    this.out.setDefined();
  }
}

// ---------------------------------------------------------------------------
// 平面 × 二次曲面截面（采样环）
// ---------------------------------------------------------------------------

/** 平面与球/柱/锥的交线采样成闭合折线（u ∈ [0, 2π) 均匀采样）。 */
export function quadricPlaneSectionRing(
  quadric: GeoQuadric3D,
  plane: GeoPlane3D,
  samples = 64,
): Coords4[] {
  const kind = quadric.getKind();
  const base = quadric.getBase();
  const n = plane.getNormal();
  const d = plane.getDistance();
  const ring: Coords4[] = [];

  if (kind === 'sphere') {
    const delta = n.dot(base) - d;
    const r = quadric.getParam();
    if (Math.abs(delta) >= r) return ring;
    const center = base.sub(n.scale(delta));
    const radius = Math.sqrt(r * r - delta * delta);
    const ref = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    let e1 = {
      x: n.y * ref.z - n.z * ref.y,
      y: n.z * ref.x - n.x * ref.z,
      z: n.x * ref.y - n.y * ref.x,
    };
    const l1 = Math.hypot(e1.x, e1.y, e1.z) || 1;
    e1 = { x: e1.x / l1, y: e1.y / l1, z: e1.z / l1 };
    const e2 = { x: n.y * e1.z - n.z * e1.y, y: n.z * e1.x - n.x * e1.z, z: n.x * e1.y - n.y * e1.x };
    for (let i = 0; i < samples; i++) {
      const u = (2 * Math.PI * i) / samples;
      ring.push(center.add(new Coords4(
        e1.x * Math.cos(u) * radius + e2.x * Math.sin(u) * radius,
        e1.y * Math.cos(u) * radius + e2.y * Math.sin(u) * radius,
        e1.z * Math.cos(u) * radius + e2.z * Math.sin(u) * radius,
        0,
      )));
    }
    return ring;
  }

  const axis = quadric.getAxis();
  const denom = n.dot(axis);
  // 平面 ∥ 轴：截面不是环（柱：0/1/2 条母线；锥同理），返回空
  if (Math.abs(denom) < 1e-9) return ring;
  const ref = Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  let e1 = new Coords4(
    axis.y * ref.z - axis.z * ref.y,
    axis.z * ref.x - axis.x * ref.z,
    axis.x * ref.y - axis.y * ref.x,
    0,
  ).normalize();
  const e2 = axis.cross(e1);

  const tanHalf = kind === 'cone' ? Math.tan(quadric.getParam()) : 0;
  const radiusAt = kind === 'cylinder' ? quadric.getParam() : 0;
  for (let i = 0; i < samples; i++) {
    const u = (2 * Math.PI * i) / samples;
    const cu = Math.cos(u), su = Math.sin(u);
    // 柱/锥面上参数点：base + radial(u) + t·(axis + 锥形径向分量)
    const radial = e1.scale(cu * radiusAt).add(e2.scale(su * radiusAt));
    const start = base.add(radial);
    const dir = kind === 'cone'
      ? axis.add(e1.scale(cu * tanHalf)).add(e2.scale(su * tanHalf))
      : axis;
    const t = (d - n.dot(start)) / denom;
    if (!Number.isFinite(t) || t <= 1e-9) continue;
    ring.push(start.add(dir.scale(t)));
  }
  return ring;
}

/** 平面 × 二次曲面截面 → 折线（优先从解析截面采样，回退逐母线求交环）。 */
export class AlgoIntersectPlaneQuadric extends AlgoTransformBase3D<GeoPolyline3D> {
  constructor(kernel: IKernel, private plane: GeoPlane3D, private quadric: GeoQuadric3D) {
    super(kernel, new GeoPolyline3D(kernel), [plane, quadric], { op: 'translate' });
  }

  protected recompute(): void {
    // 解析截面可用时从精确圆锥曲线上采样（椭圆闭合环；双曲线两支连成
    // 一条折线，跨支连接段是输出类型限制，精确曲线用 IntersectConic 查看）。
    const section = quadricPlaneSection(this.quadric, this.plane);
    if (section) {
      const pts: Coords4[] = [];
      const N = 64;
      if (section.kind === 'ellipse') {
        for (let i = 0; i < N; i++) {
          const u = (2 * Math.PI * i) / N;
          pts.push(section.center
            .add(section.dir1.scale(section.a * Math.cos(u)))
            .add(section.dir2.scale(section.b * Math.sin(u))));
        }
        pts.push(pts[0]); // 闭合（保持 64 采样 + 1 闭合点的既有契约）
        this.out.setPoints(pts);
        this.out.setDefined();
        return;
      }
      // 双曲线：u ∈ [-4, 4] 两支（pointAt 语义同 GeoConic3D）
      for (let i = 0; i <= N; i++) {
        const u = -4 + (8 * i) / N;
        const t = Math.abs(u);
        const sign = u < 0 ? -1 : 1;
        pts.push(section.center
          .add(section.dir1.scale(sign * section.a * Math.cosh(t)))
          .add(section.dir2.scale(section.b * Math.sinh(t))));
      }
      this.out.setPoints(pts);
      this.out.setDefined();
      return;
    }
    const ring = quadricPlaneSectionRing(this.quadric, this.plane);
    if (ring.length < 3) { this.out.setUndefined(); return; }
    this.out.setPoints([...ring, ring[0]]);
    this.out.setDefined();
  }
}
