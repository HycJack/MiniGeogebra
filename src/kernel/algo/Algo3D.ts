/**
 * 3D 最小内核算法族 —— 对标 GeoGebra 的 AlgoJoinPoints3D / AlgoMidpoint3D /
 * AlgoPlaneThreePoints / AlgoIntersectCS1D2D / AlgoDistancePointPlane3D。
 *
 * 输入移动后随依赖链自动重算（compute() 用 getX/getY/getZ 实时取值）。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoLine3D } from '../geo/GeoLine3D';
import { GeoPlane3D } from '../geo/GeoPlane3D';
import { GeoNumeric } from '../geo/GeoNumeric';
import { Coords4 } from '../core/Coords4';

const point3D = (el: GeoElement): Coords4 => {
  if (!(el instanceof GeoPoint3D)) throw new Error(`Expected a 3D point, got ${el.getClassName()}`);
  return el.getCoords3();
};

/** 过两点的 3D 直线（线段限界可选）。 */
export class AlgoJoinPoints3D extends AlgoElement {
  private outputLine: GeoLine3D;

  constructor(kernel: IKernel, private A: GeoPoint3D, private B: GeoPoint3D, private asSegment = false) {
    super(kernel);
    this.outputLine = new GeoLine3D(kernel);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.A, this.B];
    this.setOutput([this.outputLine]);
  }

  getOutput(): GeoLine3D { return this.outputLine; }

  compute(): void {
    this.outputLine.setUndefined();
    const a = this.A.getCoords3();
    const b = this.B.getCoords3();
    if (!this.A.isDefined() || !this.B.isDefined() || a.distanceTo(b) < 1e-12) return;
    const dir = b.sub(a).asDirection();
    this.outputLine.setGeometry(
      a.toPoint(),
      dir,
      this.asSegment ? { tMin: 0, tMax: a.distanceTo(b) } : undefined,
    );
    this.outputLine.setDefined();
  }
}

/** 3D 中点。 */
export class AlgoMidpoint3D extends AlgoElement {
  private outputPoint: GeoPoint3D;

  constructor(kernel: IKernel, private A: GeoPoint3D, private B: GeoPoint3D) {
    super(kernel);
    this.outputPoint = new GeoPoint3D(kernel);
    // 与 2D AlgoMidpoint 一致：输出自动取点标签，代数输入才能引用
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.A, this.B];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint3D { return this.outputPoint; }

  compute(): void {
    if (!this.A.isDefined() || !this.B.isDefined()) { this.outputPoint.setUndefined(); return; }
    // 注意：不能用齐次坐标直接相加（A+B 的 w=2，getX() 再除 w 会得到 1/4 结果），
    // 中点取仿射坐标平均。
    this.outputPoint.setCoords(
      (this.A.getX() + this.B.getX()) / 2,
      (this.A.getY() + this.B.getY()) / 2,
      (this.A.getZ() + this.B.getZ()) / 2,
    );
    this.outputPoint.setDefined();
  }
}

/** 过三点的 3D 平面（共线时 undefined）。 */
export class AlgoPlaneThreePoints3D extends AlgoElement {
  private outputPlane: GeoPlane3D;

  constructor(kernel: IKernel, private A: GeoPoint3D, private B: GeoPoint3D, private C: GeoPoint3D) {
    super(kernel);
    this.outputPlane = new GeoPlane3D(kernel);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.A, this.B, this.C];
    this.setOutput([this.outputPlane]);
  }

  getOutput(): GeoPlane3D { return this.outputPlane; }

  compute(): void {
    this.outputPlane.setUndefined();
    const ab = this.B.getCoords3().sub(this.A.getCoords3()).asDirection();
    const ac = this.C.getCoords3().sub(this.A.getCoords3()).asDirection();
    if (ab.cross(ac).norm() < 1e-9) return;
    const { normal, distance } = GeoPlane3D.throughPoints(
      this.A.getCoords3(), this.B.getCoords3(), this.C.getCoords3())!;
    this.outputPlane.setGeometry(normal, distance);
    this.outputPlane.setDefined();
  }
}

/** 直线 × 平面交点（平行时 undefined）。 */
export class AlgoIntersectLinePlane3D extends AlgoElement {
  private outputPoint: GeoPoint3D;

  constructor(kernel: IKernel, private line: GeoLine3D, private plane: GeoPlane3D) {
    super(kernel);
    this.outputPoint = new GeoPoint3D(kernel);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.line, this.plane];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint3D { return this.outputPoint; }

  compute(): void {
    this.outputPoint.setUndefined();
    const hit = this.plane.intersectLine(this.line);
    if (!hit) return;
    this.outputPoint.setCoords(hit.getX(), hit.getY(), hit.getZ());
    this.outputPoint.setDefined();
  }
}

/** 点 × 平面有向距离（数值输出）。 */
export class AlgoDistancePointPlane3D extends AlgoElement {
  private outputNumeric: GeoNumeric;

  constructor(kernel: IKernel, private point: GeoPoint3D, private plane: GeoPlane3D) {
    super(kernel);
    this.outputNumeric = new GeoNumeric(kernel, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.point, this.plane];
    this.setOutput([this.outputNumeric]);
  }

  getOutput(): GeoNumeric { return this.outputNumeric; }

  compute(): void {
    const d = this.plane.signedDistance(this.point.getCoords3());
    this.outputNumeric.setValue(Math.abs(d));
    this.outputNumeric.setDefined();
  }
}

/** 两平面交线（平行时 undefined）——官方 CmdIntersect3D 的 plane×plane 分支。 */
export class AlgoIntersectPlanes3D extends AlgoElement {
  private outputLine: GeoLine3D;

  constructor(kernel: IKernel, private p1: GeoPlane3D, private p2: GeoPlane3D) {
    super(kernel);
    this.outputLine = new GeoLine3D(kernel);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2];
    this.setOutput([this.outputLine]);
  }

  getOutput(): GeoLine3D { return this.outputLine; }

  compute(): void {
    this.outputLine.setUndefined();
    if (!this.p1.isDefined() || !this.p2.isDefined()) return;
    // 交线方向 = n1×n2；点 = 解 n1·X=d1、n2·X=d2、dir·X=0（取过原点法向平面的交）
    const n1 = this.p1.getNormal().toPoint();
    const n2 = this.p2.getNormal().toPoint();
    const dir = n1.cross(n2);
    if (dir.norm() < 1e-12) return; // 平行或重合
    const d1 = this.p1.getDistance();
    const d2 = this.p2.getDistance();
    // 点 = (d1·(n2×dir) + d2·(dir×n1)) / |dir|²（克拉默式：三个互正交方向的分解）
    const t1 = n2.cross(dir);
    const t2 = dir.cross(n1);
    const point = t1.scale(d1).add(t2.scale(d2)).scale(1 / dir.normSquared());
    this.outputLine.setGeometry(point.toPoint(), dir.asDirection());
    this.outputLine.setDefined();
  }
}

/** 两 3D 直线交点（平行/异面时 undefined）——官方 CmdIntersect3D 的 line×line 分支。 */
export class AlgoIntersectLines3D extends AlgoElement {
  private outputPoint: GeoPoint3D;

  constructor(kernel: IKernel, private l1: GeoLine3D, private l2: GeoLine3D) {
    super(kernel);
    this.outputPoint = new GeoPoint3D(kernel);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.l1, this.l2];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint3D { return this.outputPoint; }

  compute(): void {
    this.outputPoint.setUndefined();
    if (!this.l1.isDefined() || !this.l2.isDefined()) return;
    const o1 = this.l1.getOrigin().toPoint();
    const d1 = this.l1.getDirection();
    const o2 = this.l2.getOrigin().toPoint();
    const d2 = this.l2.getDirection();
    const w = o2.sub(o1);
    const cross = d1.cross(d2);
    const cross2 = cross.normSquared();
    if (cross2 < 1e-24) return; // 平行（重合也不建交点，与官方一致）
    // 联立 o1+s·d1 = o2+t·d2：s = (w×d2)·cross / |cross|²、t = (w×d1)·cross / |cross|²
    const s = w.cross(d2).dot(cross) / cross2;
    const t = w.cross(d1).dot(cross) / cross2;
    const p1 = o1.add(d1.scale(s));
    const p2 = o2.add(d2.scale(t));
    // 异面（两最近点距离超出相对容差）→ undefined
    if (p1.sub(p2).norm() > 1e-7 * Math.max(1, w.norm())) return;
    this.outputPoint.setCoords(p1.x, p1.y, p1.z);
    this.outputPoint.setDefined();
  }
}
