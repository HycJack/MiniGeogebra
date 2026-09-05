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
import { GeoConicPart } from '../geo/GeoConicPart';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoArc } from '../geo/GeoArc';
import { GeoRay } from '../geo/GeoRay';
import { GeoRegularPolygon } from '../geo/GeoRegularPolygon';
import { GeoLocus } from '../geo/GeoLocus';

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

type TransOp = 'rotate' | 'dilate' | 'mirror' | 'translate' | 'invert';

const translatePt = (p: { x: number; y: number }, v: { x: number; y: number }) => ({ x: p.x + v.x, y: p.y + v.y });

/** 点关于圆的反演。圆心处映射为无穷远，这里按未定义原点处理。 */
const invertPt = (p: { x: number; y: number }, c: { x: number; y: number }, radius: number) => {
    const dx = p.x - c.x, dy = p.y - c.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1e-12) return { x: c.x, y: c.y };
    const k = radius * radius / d2;
    return { x: c.x + dx * k, y: c.y + dy * k };
};

const transformPoint = (p: GeoPoint, op: TransOp, arg: any): GeoPoint => {
  const cp = { x: p.getX(), y: p.getY() };
  let out: { x: number; y: number };
  if (op === 'rotate') out = rotatePt(cp, arg.center, arg.angle);
  else if (op === 'dilate') out = scalePt(cp, arg.center, arg.ratio);
  else if (op === 'translate') out = translatePt(cp, arg.vector);
  else if (op === 'invert') out = invertPt(cp, arg.center, arg.radius);
  else out = mirrorPt(cp, arg.A, arg.B, arg.C);
  return new GeoPoint(p.kernel, new GeoVec3D(out.x, out.y, 1));
};

const transformLine = (l: GeoLine, op: TransOp, arg: any): GeoLine => {
  const pts = lineInterceptPts(l.a, l.b, l.c).map(p =>
    op === 'rotate' ? rotatePt(p, arg.center, arg.angle)
    : op === 'dilate' ? scalePt(p, arg.center, arg.ratio)
    : op === 'translate' ? translatePt(p, arg.vector)
    : op === 'invert' ? invertPt(p, arg.center, arg.radius)
    : mirrorPt(p, arg.A, arg.B, arg.C)
  );
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
    const so = op === 'mirror' ? mirrorPt(sp, arg.A, arg.B, arg.C)
      : op === 'rotate' ? rotatePt(sp, arg.center, arg.angle)
        : scalePt(sp, arg.center, arg.ratio);
    const eo = op === 'mirror' ? mirrorPt(ep, arg.A, arg.B, arg.C)
      : op === 'rotate' ? rotatePt(ep, arg.center, arg.angle)
        : scalePt(ep, arg.center, arg.ratio);
    return new GeoRay(input.kernel, new GeoPoint(input.kernel, new GeoVec3D(so.x, so.y, 1)), new GeoPoint(input.kernel, new GeoVec3D(eo.x, eo.y, 1)));
  }
  if (input instanceof GeoRegularPolygon) {
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
    const mapped = locus.getSamples().map(({ x, y }) =>
      op === 'mirror' ? mirrorPt({ x, y }, arg.A, arg.B, arg.C)
      : op === 'rotate' ? rotatePt({ x, y }, arg.center, arg.angle)
        : scalePt({ x, y }, arg.center, arg.ratio)
    );
    return new GeoLocus(locus.kernel, mapped, locus.getSegments().slice());
  }
  return input;
}

export type { TransOp };
