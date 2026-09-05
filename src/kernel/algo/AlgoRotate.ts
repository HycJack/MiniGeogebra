/**
 * 旋转变换算法 —— 绕中心旋转选中几何，生成新对象（GeoGebra 式"变换后新建"语义）。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoSegment } from '../geo/GeoSegment';
import { GeoConic } from '../geo/GeoConic';
import { GeoConicPart, CONIC_PART_SEGMENT } from '../geo/GeoConicPart';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoArc } from '../geo/GeoArc';
import { GeoRay } from '../geo/GeoRay';
import { GeoRegularPolygon } from '../geo/GeoRegularPolygon';
import { GeoLocus } from '../geo/GeoLocus';
import { GeoPolyLine } from '../geo/GeoPolyLine';

const rotatePt = (p: { x: number; y: number }, c: { x: number; y: number }, t: number): { x: number; y: number } => {
  const dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(t) - dy * Math.sin(t), y: c.y + dx * Math.sin(t) + dy * Math.cos(t) };
};
const scalePt = (p: { x: number; y: number }, c: { x: number; y: number }, r: number): { x: number; y: number } => ({
  x: c.x + r * (p.x - c.x), y: c.y + r * (p.y - c.y)
});
const mirrorPt = (p: { x: number; y: number }, A: number, B: number, C: number): { x: number; y: number } => {
  const d = A * A + B * B;
  return { x: p.x - 2 * A * (A * p.x + B * p.y + C) / d, y: p.y - 2 * B * (A * p.x + B * p.y + C) / d };
};
const lineInterceptPts = (a: number, b: number, c: number): [{ x: number; y: number }, { x: number; y: number }] => {
  if (Math.abs(a) > 1e-9) {
    const p = { x: -c / a, y: 0 };
    return [p, { x: p.x + b, y: p.y - a }];
  }
  const p = { x: 0, y: -c / b };
  return [p, { x: b, y: p.y - a }];
};
const circleCoeffs = (h: number, k: number, r: number): number[] => [1, 0, 1, -2 * h, -2 * k, h * h + k * k - r * r];

type TransOp = 'rotate' | 'dilate' | 'mirror' | 'translate' | 'invert' | 'shear' | 'stretch';

/** GeoGebra 的 Shear / Stretch 共用一个按直线分解的仿射矩阵。 */
type ShearStretchOp = 'shear' | 'stretch';

const translatePt = (p: { x: number; y: number }, v: { x: number; y: number }) => ({ x: p.x + v.x, y: p.y + v.y });

/** 点关于圆的反演。圆心处映射为无穷远，这里按未定义原点处理。 */
const invertPt = (p: { x: number; y: number }, c: { x: number; y: number }, radius: number) => {
    const dx = p.x - c.x, dy = p.y - c.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1e-12) return { x: c.x, y: c.y };
    const k = radius * radius / d2;
    return { x: c.x + dx * k, y: c.y + dy * k };
};

type AffineMatrix = { a: number; b: number; c: number; d: number; tx: number; ty: number };

const shearStretchPt = (p: { x: number; y: number }, m: AffineMatrix) => ({
  x: m.a * p.x + m.b * p.y + m.tx,
  y: m.c * p.x + m.d * p.y + m.ty,
});

/** 变换后的点坐标（供折线、弧等采样对象复用）。 */
const mapPoint = (p: { x: number; y: number }, op: TransOp, arg: any): { x: number; y: number } => {
  if (op === 'rotate') return rotatePt(p, arg.center, arg.angle);
  if (op === 'dilate') return scalePt(p, arg.center, arg.ratio);
  if (op === 'translate') return translatePt(p, arg.vector);
  if (op === 'invert') return invertPt(p, arg.center, arg.radius);
  if (op === 'shear' || op === 'stretch') return shearStretchPt(p, arg.matrix);
  return mirrorPt(p, arg.A, arg.B, arg.C);
};

const transformPoint = (p: GeoPoint, op: TransOp, arg: any): GeoPoint => {
  const cp = { x: p.getX(), y: p.getY() };
  const out = mapPoint(cp, op, arg);
  return new GeoPoint(p.kernel, new GeoVec3D(out.x, out.y, 1));
};

const transformLine = (l: GeoLine, op: TransOp, arg: any): GeoLine => {
  const pts = lineInterceptPts(l.a, l.b, l.c).map(p => mapPoint(p, op, arg));
  const a = pts[1].y - pts[0].y;
  const b = pts[0].x - pts[1].x;
  const cc = -a * pts[0].x - b * pts[0].y;
  return new GeoLine(l.kernel, a, b, cc);
};

export class AlgoRotate extends AlgoElement {
  private result: GeoElement;
  private source: GeoElement;

  constructor(kernel: IKernel, source: GeoElement, private center: GeoPoint, private angle: number) {
    super(kernel);
    this.source = source;
    this.result = buildTransformed(kernel, source, 'rotate', { center, angle });
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.source];
    this.setOutput([this.result]);
  }

  getOutput(): GeoElement { return this.result; }

  compute(): void { this.result.setDefined(); }
}

export class AlgoDilate extends AlgoElement {
  private result: GeoElement;
  private source: GeoElement;

  constructor(kernel: IKernel, source: GeoElement, private center: GeoPoint, private ratio: number) {
    super(kernel);
    this.source = source;
    this.result = buildTransformed(kernel, source, 'dilate', { center, ratio });
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.source];
    this.setOutput([this.result]);
  }

  getOutput(): GeoElement { return this.result; }

  compute(): void { this.result.setDefined(); }
}

export class AlgoMirror extends AlgoElement {
  private result: GeoElement;
  private source: GeoElement;

  constructor(kernel: IKernel, source: GeoElement, private A: number, private B: number, private C: number) {
    super(kernel);
    this.source = source;
    this.result = buildTransformed(kernel, source, 'mirror', { A, B, C });
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.source];
    this.setOutput([this.result]);
  }

  getOutput(): GeoElement { return this.result; }

  compute(): void { this.result.setDefined(); }
}

const sampleLimitedCircle = (
  center: { x: number; y: number }, radius: number,
  start: number, end: number, ccw: boolean,
  op: TransOp, arg: any,
): { x: number; y: number }[] => {
  let delta = end - start;
  if (ccw) {
    while (delta < 0) delta += 2 * Math.PI;
    while (delta >= 2 * Math.PI) delta -= 2 * Math.PI;
  } else {
    while (delta > 0) delta -= 2 * Math.PI;
    while (delta <= -2 * Math.PI) delta += 2 * Math.PI;
  }
  const count = Math.max(8, Math.ceil(Math.abs(delta) / (2 * Math.PI) * 64) + 1);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const angle = start + delta * i / count;
    pts.push(mapPoint({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }, op, arg));
  }
  return pts;
};

const transformLimitedCircle = (input: GeoConicPart | GeoArc, op: TransOp, arg: any) => {
  if (op !== 'shear' && op !== 'stretch') return null;
  const kernel = input.kernel;
  const mapped = sampleLimitedCircle(
    input.getCenter(), input.getRadius(),
    input.getStartAngle(), input.getEndAngle(),
    input instanceof GeoConicPart ? input.isCounterClockwise() : input.getEndAngle() >= input.getStartAngle(),
    op, arg,
  ).map(p => new GeoPoint(kernel, new GeoVec3D(p.x, p.y, 1)));
  if (input instanceof GeoConicPart && input.isSector()) {
    const center = mapPoint(input.getCenter(), op, arg);
    return new GeoPolygon(kernel, [...mapped, new GeoPoint(kernel, new GeoVec3D(center.x, center.y, 1))]);
  }
  if (input instanceof GeoConicPart && input.getPartType() === CONIC_PART_SEGMENT) return new GeoPolygon(kernel, mapped);
  return new GeoPolyLine(kernel, mapped);
};

/** Substitute P = M^-1(P' - T) into a conic equation. */
const transformConicCoeffs = (coeffs: number[], m: AffineMatrix): number[] => {
  const [A, B, C, D, E, F] = coeffs;
  const det = m.a * m.d - m.b * m.c;
  const ia = m.d / det;
  const ib = -m.b / det;
  const ic = -m.c / det;
  const id = m.a / det;
  const tx = (m.b * m.ty - m.d * m.tx) / det;
  const ty = (m.c * m.tx - m.a * m.ty) / det;
  const au = A * tx + B * ty / 2;
  const cu = B * tx / 2 + C * ty;
  return [
    A * ia * ia + B * ia * ic + C * ic * ic,
    2 * A * ia * ib + B * (ia * id + ib * ic) + 2 * C * ic * id,
    A * ib * ib + B * ib * id + C * id * id,
    2 * (ia * au + ic * cu) + ia * D + ic * E,
    2 * (ib * au + id * cu) + ib * D + id * E,
    A * tx * tx + B * tx * ty + C * ty * ty + D * tx + E * ty + F,
  ];
};

/** 按类型重建经变换后的几何副本（变换对象自身不变）。 */
export function buildTransformed(kernel: IKernel, input: GeoElement, op: TransOp, arg: any): GeoElement {
  if (input instanceof GeoPoint) return transformPoint(input, op, arg);
  if (input instanceof GeoNumeric) {
    const copy = new GeoNumeric(kernel, input.getValue());
    copy.label = input.label;
    return copy;
  }
  if (input instanceof GeoSegment) {
    const s = input as GeoSegment;
    const p1 = transformPoint(s.startPoint, op, arg);
    const p2 = transformPoint(s.endPoint, op, arg);
    return new GeoSegment(s.kernel, p1, p2);
  }
  if (input instanceof GeoLine) return transformLine(input as GeoLine, op, arg);
  if (input instanceof GeoConicPart) {
    const limited = transformLimitedCircle(input, op, arg);
    if (limited) return limited;
    if (op === 'translate') {
      const c = input.getCenter();
      return new GeoConic(kernel, circleCoeffs(c.x + arg.vector.x, c.y + arg.vector.y, input.getRadius()));
    }
    if (op === 'invert') {
      const c = input.getCenter();
      const sourceRadius = input.getRadius();
      const dx = c.x - arg.center.x, dy = c.y - arg.center.y;
      const centerDistance2 = dx * dx + dy * dy;
      if (Math.abs(centerDistance2 - sourceRadius * sourceRadius) < 1e-9) {
        // 经过反演中心的圆映射为直线。
        return new GeoLine(kernel, dx, dy, -(arg.radius * arg.radius) / 2);
      }
      const denominator = centerDistance2 - sourceRadius * sourceRadius;
      const k = arg.radius * arg.radius / denominator;
      const imageCenter = { x: arg.center.x + dx * k, y: arg.center.y + dy * k };
      const imageRadius = arg.radius * arg.radius * sourceRadius / Math.abs(denominator);
      return new GeoConic(kernel, circleCoeffs(imageCenter.x, imageCenter.y, imageRadius));
    }
    const { x, y } = op === 'mirror' ? mirrorPt({ x: input.getCenter().x, y: input.getCenter().y }, arg.A, arg.B, arg.C)
      : op === 'rotate' ? rotatePt(input.getCenter(), arg.center, arg.angle)
        : scalePt(input.getCenter(), arg.center, arg.ratio);
    const r = input.getRadius();
    return new GeoConic(kernel, circleCoeffs(x, y, r));
  }
  if (input instanceof GeoArc) {
    const limited = transformLimitedCircle(input, op, arg);
    if (limited) return limited;
    if (op === 'translate') {
      const c = input.getCenter();
      return new GeoArc(kernel, { x: c.x + arg.vector.x, y: c.y + arg.vector.y }, input.getRadius(), input.getStartAngle(), input.getEndAngle(), input.isCounterClockwise());
    }
    const c = op === 'mirror' ? mirrorPt({ x: input.getCenter().x, y: input.getCenter().y }, arg.A, arg.B, arg.C)
      : op === 'rotate' ? rotatePt(input.getCenter(), arg.center, arg.angle)
        : scalePt(input.getCenter(), arg.center, arg.ratio);
    return new GeoArc(kernel, { x: c.x, y: c.y }, input.getRadius(), input.getStartAngle(), input.getEndAngle(), input.isCounterClockwise());
  }
  if (input instanceof GeoRay) {
    const sp = { x: input.getStartPoint().getX(), y: input.getStartPoint().getY() };
    const ep = { x: input.getSecondPoint().getX(), y: input.getSecondPoint().getY() };
    const so = mapPoint(sp, op, arg);
    const eo = mapPoint(ep, op, arg);
    return new GeoRay(input.kernel, new GeoPoint(input.kernel, new GeoVec3D(so.x, so.y, 1)), new GeoPoint(input.kernel, new GeoVec3D(eo.x, eo.y, 1)));
  }
  if (input instanceof GeoPolyLine) {
    const mapped = input.vertices.map(v => transformPoint(v, op, arg));
    return new GeoPolyLine(input.kernel, mapped);
  }
  if (input instanceof GeoRegularPolygon) {
    if (op === 'shear' || op === 'stretch') {
      const mapped = input.vertices.map(v => transformPoint(v, op, arg));
      return new GeoPolygon(input.kernel, mapped);
    }
    if (op === 'translate') {
      const c = input.getCenter();
      return new GeoRegularPolygon(input.kernel, { x: c.x + arg.vector.x, y: c.y + arg.vector.y }, input.getRadius(), input.getSides());
    }
    const c = op === 'mirror' ? mirrorPt({ x: input.getCenter().x, y: input.getCenter().y }, arg.A, arg.B, arg.C)
      : op === 'rotate' ? rotatePt(input.getCenter(), arg.center, arg.angle)
        : scalePt(input.getCenter(), arg.center, arg.ratio);
    return new GeoRegularPolygon(input.kernel, c, input.getRadius(), input.getSides());
  }
  if (input instanceof GeoPolygon) {
    const vs = (input as GeoPolygon).vertices.map(v => transformPoint(v, op, arg));
    return new GeoPolygon(input.kernel, vs);
  }
  if (input instanceof GeoLocus) {
    const locus = input as GeoLocus;
    const mapped = locus.getSamples().map(({ x, y }) => mapPoint({ x, y }, op, arg));
    return new GeoLocus(locus.kernel, mapped, locus.getSegments().slice());
  }
  if (input instanceof GeoConic && (op === 'shear' || op === 'stretch')) {
    return new GeoConic(input.kernel, transformConicCoeffs(input.coeffs, arg.matrix));
  }
  if (op === 'shear' || op === 'stretch') {
    throw new Error(`Shear/stretch is not supported for ${input.getClassName?.() ?? input.constructor.name}`);
  }
  return input;
}

/**
 * GeoGebra AlgoShearOrStretch 的矩阵形式。
 * 对直线 ax+by+c=0，方向单位向量为 (-a, b)/|n|，
 * shear 沿法向偏移，stretch 沿直线方向缩放。
 */
export function shearStretchMatrix(a: number, b: number, c: number, factor: number, op: ShearStretchOp) {
  const n = Math.hypot(a, b);
  if (n < 1e-12) throw new Error('Shear/stretch axis is undefined');
  // 与 AlgoShearOrStretch 一致：line.x/line.y 是法向，这里换成轴线方向。
  const s = -a / n;
  const cDir = b / n;
  const matrix = op === 'shear'
    ? { a: 1 - cDir * s * factor, b: cDir * cDir * factor, c: -s * s * factor, d: 1 + s * cDir * factor }
    : { a: cDir * cDir + s * s * factor, b: cDir * s * (1 - factor), c: cDir * s * (1 - factor), d: s * s + cDir * cDir * factor };
  // GeoGebra translates the output by -Q before the linear map and by +Q after it.
  const qx = Math.abs(a) > Math.abs(b) ? c / a : 0;
  const qy = Math.abs(a) > Math.abs(b) ? 0 : c / b;
  return {
    ...matrix,
    tx: qx - (matrix.a * qx + matrix.b * qy),
    ty: qy - (matrix.c * qx + matrix.d * qy),
  };
}

export type { TransOp };
