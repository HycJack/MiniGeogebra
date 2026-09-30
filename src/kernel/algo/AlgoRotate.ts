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
export const circleCoeffs = (h: number, k: number, r: number): number[] => [1, 0, 1, -2 * h, -2 * k, h * h + k * k - r * r];

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

/** 中心参数：工具层传点击位置 {x,y}，也兼容 GeoPoint。 */
const toCenter = (center: any): { x: number; y: number } =>
  center instanceof GeoPoint ? { x: center.getX(), y: center.getY() } : center;

export class AlgoRotate extends AlgoElement {
  private result: GeoElement;
  private source: GeoElement;
  private center: { x: number; y: number };
  // 活中心：GeoPoint 时注册为输入，移动中心会联动重算（对标 AlgoRotatePoint 的活引用）
  private centerPoint: GeoPoint | null;

  constructor(kernel: IKernel, source: GeoElement, center: { x: number; y: number } | GeoPoint, private angle: number) {
    super(kernel);
    this.source = source;
    this.centerPoint = center instanceof GeoPoint ? center : null;
    this.center = toCenter(center);
    this.result = buildTransformed(kernel, source, 'rotate', { center: this.center, angle });
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.centerPoint ? [this.source, this.centerPoint] : [this.source];
    this.setOutput([this.result]);
  }

  getOutput(): GeoElement { return this.result; }

  // 序列化需要还原构造参数
  getAngle(): number { return this.angle; }
  getCenterCoords(): { x: number; y: number } { return this.center; }

  compute(): void {
    if (this.centerPoint) {
      this.center = { x: this.centerPoint.getX(), y: this.centerPoint.getY() };
    }
    // 源对象/中心移动后原地重算，保持输出对象身份。
    applyTransformed(this.result, this.source, 'rotate', { center: this.center, angle: this.angle });
    this.result.setDefined();
  }
}

export class AlgoDilate extends AlgoElement {
  private result: GeoElement;
  private source: GeoElement;
  private center: { x: number; y: number };
  private centerPoint: GeoPoint | null;

  constructor(kernel: IKernel, source: GeoElement, center: { x: number; y: number } | GeoPoint, private ratio: number) {
    super(kernel);
    this.source = source;
    this.centerPoint = center instanceof GeoPoint ? center : null;
    this.center = toCenter(center);
    this.result = buildTransformed(kernel, source, 'dilate', { center: this.center, ratio });
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.centerPoint ? [this.source, this.centerPoint] : [this.source];
    this.setOutput([this.result]);
  }

  getOutput(): GeoElement { return this.result; }

  getRatio(): number { return this.ratio; }
  getCenterCoords(): { x: number; y: number } { return this.center; }

  compute(): void {
    if (this.centerPoint) {
      this.center = { x: this.centerPoint.getX(), y: this.centerPoint.getY() };
    }
    applyTransformed(this.result, this.source, 'dilate', { center: this.center, ratio: this.ratio });
    this.result.setDefined();
  }
}

export class AlgoMirror extends AlgoElement {
  private result: GeoElement;
  private source: GeoElement;
  private A: number;
  private B: number;
  private C: number;
  // 活镜轴：GeoLine 时注册为输入，移动镜轴会联动重算（对标 AlgoMirror）
  private axisLine: GeoLine | null;

  constructor(kernel: IKernel, source: GeoElement, A: number, B: number, C: number, axisLine?: GeoLine) {
    super(kernel);
    this.source = source;
    this.A = A; this.B = B; this.C = C;
    this.axisLine = axisLine ?? null;
    this.result = buildTransformed(kernel, source, 'mirror', { A, B, C });
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.axisLine ? [this.source, this.axisLine] : [this.source];
    this.setOutput([this.result]);
  }

  getOutput(): GeoElement { return this.result; }

  /** 镜像轴 ax+by+c=0 的系数（序列化还原用；活轴时为当前快照）。 */
  getMirrorLine(): [number, number, number] { return [this.A, this.B, this.C]; }

  compute(): void {
    if (this.axisLine) {
      this.A = this.axisLine.a;
      this.B = this.axisLine.b;
      this.C = this.axisLine.c;
    }
    applyTransformed(this.result, this.source, 'mirror', { A: this.A, B: this.B, C: this.C });
    this.result.setDefined();
  }
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

/** 把 rotate/dilate/mirror/translate/shear/stretch 统一表示成正向仿射矩阵 P' = M·P + T。 */
const affineFor = (op: TransOp, arg: any): AffineMatrix | null => {
  if (op === 'translate') {
    return { a: 1, b: 0, c: 0, d: 1, tx: arg.vector.x, ty: arg.vector.y };
  }
  if (op === 'rotate') {
    const cos = Math.cos(arg.angle), sin = Math.sin(arg.angle);
    const cx = arg.center.x, cy = arg.center.y;
    return { a: cos, b: -sin, c: sin, d: cos, tx: cx - cos * cx + sin * cy, ty: cy - sin * cx - cos * cy };
  }
  if (op === 'dilate') {
    const r = arg.ratio, cx = arg.center.x, cy = arg.center.y;
    return { a: r, b: 0, c: 0, d: r, tx: (1 - r) * cx, ty: (1 - r) * cy };
  }
  if (op === 'mirror') {
    const d = arg.A * arg.A + arg.B * arg.B;
    return {
      a: (arg.B * arg.B - arg.A * arg.A) / d,
      b: -2 * arg.A * arg.B / d,
      c: -2 * arg.A * arg.B / d,
      d: (arg.A * arg.A - arg.B * arg.B) / d,
      tx: -2 * arg.A * arg.C / d,
      ty: -2 * arg.B * arg.C / d,
    };
  }
  if (op === 'shear' || op === 'stretch') return arg.matrix;
  return null; // invert 不是仿射变换
};

/** 圆弧经仿射映射后的新圆心/半径/起止角（mirror 会翻转方向）。 */
const mapArcGeometry = (
  center: { x: number; y: number }, radius: number,
  startAngle: number, endAngle: number, ccw: boolean,
  op: TransOp, arg: any,
): { center: { x: number; y: number }; radius: number; startAngle: number; endAngle: number; ccw: boolean } => {
  const c2 = mapPoint(center, op, arg);
  const p1 = mapPoint({ x: center.x + radius * Math.cos(startAngle), y: center.y + radius * Math.sin(startAngle) }, op, arg);
  const p2 = mapPoint({ x: center.x + radius * Math.cos(endAngle), y: center.y + radius * Math.sin(endAngle) }, op, arg);
  return {
    center: c2,
    radius: Math.hypot(p1.x - c2.x, p1.y - c2.y),
    startAngle: Math.atan2(p1.y - c2.y, p1.x - c2.x),
    endAngle: Math.atan2(p2.y - c2.y, p2.x - c2.x),
    ccw: ccw !== (op === 'mirror'),
  };
};

/**
 * 把 source 经变换后的几何原地写入 result（对象身份不变，下游引用不失效）。
 * 供 AlgoRotate/Dilate/Mirror/Translate 的 compute() 在依赖变化时重算使用。
 */
export function applyTransformed(result: GeoElement, source: GeoElement, op: TransOp, arg: any): void {
  if (result instanceof GeoPoint && source instanceof GeoPoint) {
    const out = mapPoint({ x: source.getX(), y: source.getY() }, op, arg);
    result.setCoords(out.x, out.y, 1);
    return;
  }
  if (result instanceof GeoNumeric && source instanceof GeoNumeric) {
    result.setValue(source.getValue());
    return;
  }
  if (result instanceof GeoSegment && source instanceof GeoSegment) {
    const s1 = mapPoint({ x: source.startPoint.getX(), y: source.startPoint.getY() }, op, arg);
    const s2 = mapPoint({ x: source.endPoint.getX(), y: source.endPoint.getY() }, op, arg);
    result.startPoint.setCoords(s1.x, s1.y, 1);
    result.endPoint.setCoords(s2.x, s2.y, 1);
    return;
  }
  if (result instanceof GeoRay && source instanceof GeoRay) {
    const s1 = mapPoint({ x: source.startPoint.getX(), y: source.startPoint.getY() }, op, arg);
    const s2 = mapPoint({ x: source.secondPoint.getX(), y: source.secondPoint.getY() }, op, arg);
    result.startPoint.setCoords(s1.x, s1.y, 1);
    result.secondPoint.setCoords(s2.x, s2.y, 1);
    return;
  }
  if (result instanceof GeoLine && source instanceof GeoLine) {
    const pts = lineInterceptPts(source.a, source.b, source.c).map(p => mapPoint(p, op, arg));
    const a = pts[1].y - pts[0].y;
    const b = pts[0].x - pts[1].x;
    const c = -a * pts[0].x - b * pts[0].y;
    result.a = a; result.b = b; result.c = c;
    return;
  }
  if (result instanceof GeoArc && source instanceof GeoArc) {
    const g = mapArcGeometry(source.getCenter(), source.getRadius(), source.getStartAngle(), source.getEndAngle(), source.isCounterClockwise(), op, arg);
    result.setGeometry(g.center, g.radius, g.startAngle, g.endAngle, g.ccw);
    return;
  }
  if (result instanceof GeoConicPart && source instanceof GeoConicPart) {
    const g = mapArcGeometry(source.getCenter(), source.getRadius(), source.getStartAngle(), source.getEndAngle(), source.isCounterClockwise(), op, arg);
    result.coeffs = circleCoeffs(g.center.x, g.center.y, g.radius);
    result.setParameters(g.startAngle, g.endAngle, g.ccw);
    return;
  }
  if (result instanceof GeoRegularPolygon && source instanceof GeoRegularPolygon) {
    const c2 = mapPoint(source.getCenter(), op, arg);
    const v0 = source.vertices[0];
    const v0m = mapPoint({ x: v0.getX(), y: v0.getY() }, op, arg);
    result.setGeometry(c2, Math.hypot(v0m.x - c2.x, v0m.y - c2.y));
    return;
  }
  if (result instanceof GeoPolygon && source instanceof GeoPolygon) {
    source.vertices.forEach((v, i) => {
      if (!result.vertices[i]) return;
      const m = mapPoint({ x: v.getX(), y: v.getY() }, op, arg);
      result.vertices[i].setCoords(m.x, m.y, 1);
    });
    return;
  }
  if (result instanceof GeoPolyLine && source instanceof GeoPolyLine) {
    source.vertices.forEach((v, i) => {
      if (!result.vertices[i]) return;
      const m = mapPoint({ x: v.getX(), y: v.getY() }, op, arg);
      result.vertices[i].setCoords(m.x, m.y, 1);
    });
    return;
  }
  if (result instanceof GeoLocus && source instanceof GeoLocus) {
    result.samples = source.getSamples().map(({ x, y }) => mapPoint({ x, y }, op, arg));
    result.segments = source.getSegments().slice();
    return;
  }
  if (result instanceof GeoConic && source instanceof GeoConic) {
    const m = affineFor(op, arg);
    if (m) {
      const nc = transformConicCoeffs(source.coeffs, m);
      for (let i = 0; i < 6; i++) result.coeffs[i] = nc[i];
    }
    return;
  }
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
    const limited = transformLimitedCircle(input, op, arg);
    if (limited) return limited;
    // mapPoint 覆盖全部非剪切/拉伸算子；圆心 + 边界角点映射后重建，
    // dilate 会正确缩放半径，mirror 自动翻转方向。经过反演中心的圆退化为直线。
    const c0 = input.getCenter();
    if (op === 'invert') {
      const dx = c0.x - arg.center.x, dy = c0.y - arg.center.y;
      const d2 = dx * dx + dy * dy;
      if (Math.abs(d2 - input.getRadius() * input.getRadius()) < 1e-9) {
        return new GeoLine(kernel, dx, dy, -(arg.radius * arg.radius) / 2);
      }
    }
    const g = mapArcGeometry(
      input.getCenter(), input.getRadius(),
      input.getStartAngle(), input.getEndAngle(),
      input.isCounterClockwise(), op, arg,
    );
    // 保留弧/扇形/弓形的部分圆语义（此前返回整圆 GeoConic，弧段范围丢失）
    return new GeoConicPart(
      kernel, g.center, g.radius,
      g.startAngle, g.endAngle,
      input.getPartType(), g.ccw,
    );
  }
  if (input instanceof GeoArc) {
    const limited = transformLimitedCircle(input, op, arg);
    if (limited) return limited;
    // mapPoint 对 rotate/dilate/mirror/translate/invert 均有逐点定义，
    // 圆心 + 两个边界角点映射后即可重建圆弧（mirror 自动翻转方向）。
    const g = mapArcGeometry(input.getCenter(), input.getRadius(), input.getStartAngle(), input.getEndAngle(), input.isCounterClockwise(), op, arg);
    return new GeoArc(kernel, g.center, g.radius, g.startAngle, g.endAngle, g.ccw);
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
  // 普通圆锥曲线（圆/椭圆/双曲线/抛物线）：旋转/缩放/镜像/平移/剪切/拉伸
  // 都是仿射变换，统一用系数代入法；经过反演中心的圆退化为直线。
  if (input instanceof GeoConic) {
    if (op === 'invert') {
      const c = input.getCenter();
      const r = input.getApproxRadius();
      const dx = c.x - arg.center.x, dy = c.y - arg.center.y;
      const d2 = dx * dx + dy * dy;
      if (r > 0 && Math.abs(d2 - r * r) < 1e-9) {
        return new GeoLine(kernel, dx, dy, -(arg.radius * arg.radius) / 2);
      }
      if (r > 0 && input.isCircle()) {
        const k = arg.radius * arg.radius / (d2 - r * r);
        const imageCenter = { x: arg.center.x + dx * k, y: arg.center.y + dy * k };
        const imageRadius = arg.radius * arg.radius * r / Math.abs(d2 - r * r);
        return new GeoConic(kernel, circleCoeffs(imageCenter.x, imageCenter.y, imageRadius));
      }
      // 非圆圆锥曲线的反演像是四次曲线，超出现有 Geo 类型表示能力。
      // 此前直接 return input（输出别名原对象）是语义错误，改为显式报错。
      throw new Error(`Inversion is only supported for circles and points, not ${input.getClassName()}`);
    }
    const m = affineFor(op, arg);
    if (m) return new GeoConic(input.kernel, transformConicCoeffs(input.coeffs, m));
    return input;
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
  // 直线 ax+by+c=0 上的锚点截距是 -c/a（此前写成 +c/a，导致不动线被原点镜像：
  // 声明轴 y=2 实际固定 y=-2）。
  const qx = Math.abs(a) > Math.abs(b) ? -c / a : 0;
  const qy = Math.abs(a) > Math.abs(b) ? 0 : -c / b;
  return {
    ...matrix,
    tx: qx - (matrix.a * qx + matrix.b * qy),
    ty: qy - (matrix.c * qx + matrix.d * qy),
  };
}

export type { TransOp };
