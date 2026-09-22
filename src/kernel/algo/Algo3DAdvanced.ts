/**
 * 3D 高级算法 —— 对标 GeoGebra 的 AlgoCircle3DThreePoints / TransformTranslate3D /
 * TransformRotate3D / TransformMirror3D / AlgoIntersectPathPlanePolyhedron。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoLine3D } from '../geo/GeoLine3D';
import { GeoPlane3D } from '../geo/GeoPlane3D';
import { GeoCircle3D } from '../geo/GeoCircle3D';
import { GeoPolyline3D } from '../geo/GeoPolyline3D';
import { GeoPolyhedron3D } from './AlgoPolyhedron3D';
import { Coords4 } from '../core/Coords4';

/** Algo3DBase 的本地副本（避免循环依赖引入）。 */
export abstract class Algo3DAdvBase<T> extends AlgoElement {
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

/** 过三点的 3D 圆（外接圆；共线时 undefined）。 */
export class AlgoCircleThreePoints3D extends Algo3DAdvBase<GeoCircle3D> {
  constructor(kernel: IKernel, private A: GeoPoint3D, private B: GeoPoint3D, private C: GeoPoint3D) {
    super(kernel, new GeoCircle3D(kernel), [A, B, C]);
  }

  protected recompute(): void {
    const built = GeoCircle3D.throughPoints(this.A.getCoords3(), this.B.getCoords3(), this.C.getCoords3());
    if (!built) { this.out.setUndefined(); return; }
    this.out.setCircle(built.center, built.normal, built.radius);
    this.out.setDefined();
  }
}

/** 平移：点 + 位移量。 */
export class AlgoTranslate3D extends Algo3DAdvBase<GeoPoint3D> {
  constructor(kernel: IKernel, private point: GeoPoint3D, private dx: number, private dy: number, private dz: number) {
    super(kernel, new GeoPoint3D(kernel), [point]);
  }

  getDx(): number { return this.dx; }
  getDy(): number { return this.dy; }
  getDz(): number { return this.dz; }

  protected recompute(): void {
    this.out.setCoords(
      this.point.getX() + this.dx,
      this.point.getY() + this.dy,
      this.point.getZ() + this.dz,
    );
    this.out.setDefined();
  }
}

/** 绕轴旋转（Rodrigues）：点绕直线 axis 旋转 angle 弧度。 */
export class AlgoRotatePoint3D extends Algo3DAdvBase<GeoPoint3D> {
  constructor(kernel: IKernel, private point: GeoPoint3D, private axis: GeoLine3D, private angle: number) {
    super(kernel, new GeoPoint3D(kernel), [point, axis]);
  }

  getAngle(): number { return this.angle; }

  protected recompute(): void {
    const o = this.axis.getOrigin();
    const d = this.axis.getDirection();
    const p = this.point.getCoords3().toPoint();
    const w = p.sub(o); // 相对轴原点
    const a = d.scale(w.dot(d));   // 平行分量
    const b = w.sub(a);            // 垂直分量
    if (b.norm() < 1e-12) {
      // 点在轴上：不动
      this.out.setCoords(p.getX(), p.getY(), p.getZ());
      this.out.setDefined();
      return;
    }
    const c = d.cross(b);          // 垂直平面内的正交方向
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const rotated = a.add(b.scale(cos)).add(c.scale(sin));
    const result = o.add(rotated);
    this.out.setCoords(result.getX(), result.getY(), result.getZ());
    this.out.setDefined();
  }
}

/** 关于平面的镜像：P' = P − 2·(有向距离)·n。 */
export class AlgoMirrorPoint3D extends Algo3DAdvBase<GeoPoint3D> {
  constructor(kernel: IKernel, private point: GeoPoint3D, private plane: GeoPlane3D) {
    super(kernel, new GeoPoint3D(kernel), [point, plane]);
  }

  protected recompute(): void {
    const dist = this.plane.signedDistance(this.point.getCoords3());
    const n = this.plane.getNormal();
    const p = this.point.getCoords3().toPoint();
    const result = p.sub(n.scale(2 * dist));
    this.out.setCoords(result.getX(), result.getY(), result.getZ());
    this.out.setDefined();
  }
}

/** 平面 × 多面体截面：把平面与每条棱求交，收集并按角度排序成闭合折线。 */
export class AlgoIntersectPathPlanePolyhedron extends Algo3DAdvBase<GeoPolyline3D> {
  constructor(kernel: IKernel, private plane: GeoPlane3D, private polyhedron: GeoPolyhedron3D) {
    super(kernel, new GeoPolyline3D(kernel), [plane, polyhedron]);
  }

  protected recompute(): void {
    const verts = this.polyhedron.vertices;
    if (verts.length < 4) { this.out.setUndefined(); return; }
    const plane = this.plane;
    const dists = verts.map(v => plane.signedDistance(v));
    const hits: Coords4[] = [];

    // 收集每条棱与平面的交点
    const n = this.polyhedron.baseCount();
    const edges: Array<[number, number]> = [];
    const base = verts.slice(0, n);
    for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n]);
    if (this.polyhedron.kind === 'prism' && verts.length >= 2 * n) {
      const top = verts.slice(n);
      for (let i = 0; i < n; i++) edges.push([n + i, n + ((i + 1) % n)]);
      for (let i = 0; i < n; i++) edges.push([i, n + i]);
    } else if (verts.length >= n + 1) {
      for (let i = 0; i < n; i++) edges.push([i, n]);
    }
    void base;

    for (const [i, j] of edges) {
      const di = dists[i];
      const dj = dists[j];
      if (Math.abs(di) < 1e-9) { hits.push(verts[i]); continue; }
      if (Math.abs(dj) < 1e-9) { hits.push(verts[j]); continue; }
      if (di * dj >= 0) continue; // 同侧不相交
      const t = di / (di - dj);
      const p = verts[i].add(verts[j].sub(verts[i]).scale(t));
      hits.push(p);
    }

    if (hits.length < 3) { this.out.setUndefined(); return; }

    // 在平面内按极角排序（凸截面），去重
    const e1 = perpInPlane(plane.getNormal());
    const e2 = plane.getNormal().cross(e1);
    const cen = Coords4.fromPoint(
      hits.reduce((s, p) => s + p.getX(), 0) / hits.length,
      hits.reduce((s, p) => s + p.getY(), 0) / hits.length,
      hits.reduce((s, p) => s + p.getZ(), 0) / hits.length,
    );
    const unique: Coords4[] = [];
    for (const p of hits) {
      if (!unique.some(u => u.distanceTo(p) < 1e-6)) unique.push(p);
    }
    unique.sort((p, q) => {
      const ap = Math.atan2(p.sub(cen).dot(e2), p.sub(cen).dot(e1));
      const aq = Math.atan2(q.sub(cen).dot(e2), q.sub(cen).dot(e1));
      return ap - aq;
    });
    this.out.setPoints(unique);
    this.out.setDefined();
  }
}

/** 平面内与法向垂直的单位向量。 */
function perpInPlane(n: Coords4): Coords4 {
  const ref = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  return new Coords4(
    n.y * ref.z - n.z * ref.y,
    n.z * ref.x - n.x * ref.z,
    n.x * ref.y - n.y * ref.x,
    0,
  ).normalize();
}