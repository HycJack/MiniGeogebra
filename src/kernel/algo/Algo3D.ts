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
