/**
 * 三角形中心族 —— 对标 GeoGebra 的 Centroid / Incenter / Orthocenter / Incircle 命令。
 * （外接圆 Circumcircle 直接复用 AlgoCircleThreePoints。）
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoConic } from '../geo/GeoConic';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoVec3D } from '../core/GeoVec3D';

/** 生成以 (h,k) 为圆心、r 为半径的圆系数。 */
const circleCoeffs = (h: number, k: number, r: number): number[] =>
  [1, 0, 1, -2 * h, -2 * k, h * h + k * k - r * r];

/** 三个顶点（或一个多边形）作为输入。 */
function resolveTrianglePoints(input: GeoElement[]): GeoPoint[] {
  if (input.length === 1 && input[0] instanceof GeoPolygon) {
    return (input[0] as GeoPolygon).vertices;
  }
  return input as GeoPoint[];
}

/** 外接圆圆心（三点共线时返回 null）。 */
export function circumcenter(A: GeoPoint, B: GeoPoint, C: GeoPoint): { x: number; y: number } | null {
  const ax = A.getX(), ay = A.getY();
  const bx = B.getX(), by = B.getY();
  const cx = C.getX(), cy = C.getY();
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  return {
    x: (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d,
    y: (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d,
  };
}

/** 重心：多边形顶点（或若干点）的算术平均。 */
export class AlgoCentroid extends AlgoElement {
  private outputPoint: GeoPoint;
  private points: GeoPoint[];

  constructor(kernel: IKernel, input: GeoElement[]) {
    super(kernel);
    this.points = resolveTrianglePoints(input);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.points;
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  compute(): void {
    let sx = 0, sy = 0;
    for (const p of this.points) {
      sx += p.getX();
      sy += p.getY();
    }
    this.outputPoint.setCoords(sx / this.points.length, sy / this.points.length, 1);
  }
}

/** 内心：按对边长度加权的顶点平均。 */
export class AlgoIncenter extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(kernel: IKernel, private A: GeoPoint, private B: GeoPoint, private C: GeoPoint) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.A, this.B, this.C];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  compute(): void {
    const a = Math.hypot(this.B.getX() - this.C.getX(), this.B.getY() - this.C.getY());
    const b = Math.hypot(this.A.getX() - this.C.getX(), this.A.getY() - this.C.getY());
    const c = Math.hypot(this.A.getX() - this.B.getX(), this.A.getY() - this.B.getY());
    const perimeter = a + b + c;
    if (perimeter < 1e-12) { this.outputPoint.setUndefined(); return; }
    this.outputPoint.setCoords(
      (a * this.A.getX() + b * this.B.getX() + c * this.C.getX()) / perimeter,
      (a * this.A.getY() + b * this.B.getY() + c * this.C.getY()) / perimeter, 1);
  }
}

/** 垂心：H = A + B + C − 2O（O 为外接圆圆心）。 */
export class AlgoOrthocenter extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(kernel: IKernel, private A: GeoPoint, private B: GeoPoint, private C: GeoPoint) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.A, this.B, this.C];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  compute(): void {
    const o = circumcenter(this.A, this.B, this.C);
    if (!o) { this.outputPoint.setUndefined(); return; }
    this.outputPoint.setCoords(
      this.A.getX() + this.B.getX() + this.C.getX() - 2 * o.x,
      this.A.getY() + this.B.getY() + this.C.getY() - 2 * o.y, 1);
  }
}

/** 内切圆：圆心为内心，半径 = 2·面积 / 周长。 */
export class AlgoIncircle extends AlgoElement {
  private outputConic: GeoConic;

  constructor(kernel: IKernel, private A: GeoPoint, private B: GeoPoint, private C: GeoPoint) {
    super(kernel);
    this.outputConic = new GeoConic(kernel, [1, 0, 1, 0, 0, -1]);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.A, this.B, this.C];
    this.setOutput([this.outputConic]);
  }

  getOutput(): GeoConic { return this.outputConic; }

  compute(): void {
    const incenterAlgo = this.incenter();
    if (!incenterAlgo) { this.outputConic.setUndefined(); return; }
    const { center, r } = incenterAlgo;
    if (!(r > 1e-12)) { this.outputConic.setUndefined(); return; }
    this.outputConic.coeffs = circleCoeffs(center.x, center.y, r);
    this.outputConic.setDefined();
  }

  /** 内心与内半径一次算出（避免再派生一个依赖）。 */
  private incenter(): { center: { x: number; y: number }; r: number } | null {
    const ax = this.A.getX(), ay = this.A.getY();
    const bx = this.B.getX(), by = this.B.getY();
    const cx = this.C.getX(), cy = this.C.getY();
    const a = Math.hypot(bx - cx, by - cy);
    const b = Math.hypot(ax - cx, ay - cy);
    const c = Math.hypot(ax - bx, ay - by);
    const perimeter = a + b + c;
    if (perimeter < 1e-12) return null;
    const center = {
      x: (a * ax + b * bx + c * cx) / perimeter,
      y: (a * ay + b * by + c * cy) / perimeter,
    };
    const area2 = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)); // 平行四边形面积的两倍
    // r = Δ/s = (area2/2)/(perimeter/2) = area2/perimeter
    const r = area2 / perimeter;
    return { center, r };
  }
}

/**
 * 关系判断基类：输出 GeoNumeric 1/0（true/false），输入变化时自动重算。
 * 各子类只需实现 evaluate()。
 */
export abstract class AlgoRelationBase extends AlgoElement {
  constructor(kernel: IKernel, input: GeoElement[]) {
    super(kernel);
    this.input = input;
    this.setOutput([new GeoNumeric(kernel, 0)]);
  }

  setInputOutput(): void {
    this.setOutput([this.output[0]]);
  }

  compute(): void {
    (this.output[0] as GeoNumeric).setValue(this.evaluate() ? 1 : 0);
  }

  protected abstract evaluate(): boolean;
}

/** 共线：三点行列式的绝对判据（对标 GeoGebra GeoPoint.collinear 的 MIN_PRECISION=1e-5）。 */
export class AlgoAreCollinear extends AlgoRelationBase {
  constructor(kernel: IKernel, private A: GeoPoint, private B: GeoPoint, private C: GeoPoint) {
    super(kernel, [A, B, C]);
  }

  protected evaluate(): boolean {
    const cross = (this.B.getX() - this.A.getX()) * (this.C.getY() - this.A.getY())
      - (this.B.getY() - this.A.getY()) * (this.C.getX() - this.A.getX());
    return Math.abs(cross) < 1e-5;
  }
}

/** 共用几何基类的平行/垂直判断（归一化法向量上的绝对判据，对标 GeoLine.isParallel 与 DoubleUtil 1e-8）。 */
abstract class AlgoAreLinesRelated extends AlgoRelationBase {
  protected readonly l1: GeoLine;
  protected readonly l2: GeoLine;

  constructor(kernel: IKernel, l1: GeoElement, l2: GeoElement) {
    super(kernel, [l1, l2]);
    this.l1 = l1 as GeoLine;
    this.l2 = l2 as GeoLine;
  }

  /** 把 (a,b) 归一化成单位法向，使判据与系数缩放无关。 */
  private unitNormal(l: GeoLine): [number, number] {
    const n = Math.hypot(l.a, l.b);
    if (n < 1e-12) return [0, 0];
    return [l.a / n, l.b / n];
  }

  protected get normals(): [[number, number], [number, number]] {
    return [this.unitNormal(this.l1), this.unitNormal(this.l2)];
  }
}

export class AlgoAreParallel extends AlgoAreLinesRelated {
  protected evaluate(): boolean {
    const [[a1, b1], [a2, b2]] = this.normals;
    return Math.abs(a1 * b2 - a2 * b1) < 1e-8;
  }
}

export class AlgoArePerpendicular extends AlgoAreLinesRelated {
  protected evaluate(): boolean {
    const [[a1, b1], [a2, b2]] = this.normals;
    return Math.abs(a1 * a2 + b1 * b2) < 1e-8;
  }
}

/**
 * 共圆：Ptolemy 恒等式（对标 GeoGebra GeoPoint.concyclic）。
 * 四点共圆 ⟺ 某个环序下 AB·CD + BC·AD = AC·BD；三点共线的退化情形同样满足（与官方一致返回 true）。
 * 三种乘积配对覆盖所有环序，容差按乘积量级取相对值。
 */
export class AlgoAreConcyclic extends AlgoRelationBase {
  private pts: GeoPoint[];

  constructor(kernel: IKernel, input: GeoElement[]) {
    super(kernel, input);
    this.pts = input as GeoPoint[];
  }

  protected evaluate(): boolean {
    const [A, B, C, D] = this.pts;
    const d = (P: GeoPoint, Q: GeoPoint) =>
      Math.hypot(P.getX() - Q.getX(), P.getY() - Q.getY());
    const ab = d(A, B), bc = d(B, C), cd = d(C, D), da = d(D, A), ac = d(A, C), bd = d(B, D);
    const f1 = ab * cd + bc * da - ac * bd;
    const f2 = ab * cd + ac * bd - bc * da;
    const f3 = bc * da + ac * bd - ab * cd;
    const scale = Math.max(ab * cd, bc * da, ac * bd, 1);
    const eps = 1e-6 * scale;
    return Math.abs(f1) < eps || Math.abs(f2) < eps || Math.abs(f3) < eps;
  }
}

/** 全等（等长）：比较两条线段长度（相对容差 1e-8，对标 DoubleUtil.isEqual）。 */
export class AlgoAreCongruent extends AlgoRelationBase {
  private segs: GeoElement[];

  constructor(kernel: IKernel, input: GeoElement[]) {
    super(kernel, input);
    this.segs = input;
  }

  protected evaluate(): boolean {
    const length = (el: GeoElement): number | null => {
      const seg = el as { startPoint?: GeoPoint; endPoint?: GeoPoint };
      if (!seg.startPoint || !seg.endPoint) return null;
      return Math.hypot(seg.endPoint.getX() - seg.startPoint.getX(), seg.endPoint.getY() - seg.startPoint.getY());
    };
    const l1 = length(this.segs[0]);
    const l2 = length(this.segs[1]);
    if (l1 === null || l2 === null) return false;
    return Math.abs(l1 - l2) < 1e-8 * Math.max(1, l1, l2);
  }
}
