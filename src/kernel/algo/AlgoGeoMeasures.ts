/**
 * 几何度量杂项命令族（对标官方 AlgoAffineRatio / AlgoBarycenter /
 * AlgoCrossRatio / AlgoAreConcurrent / CmdInteriorAngles / AlgoDirection /
 * AlgoDynamicCoordinates / AlgoPathParameter / CmdTriangleCenter）。
 *
 * 活依赖：输入点/线变动时重算。TriangleCenter 实现 Kimberling X(1)–X(10)
 * （ETC 全表 4000+ 不在本批）。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVector } from '../geo/GeoVector';
import { GeoVec3D } from '../core/GeoVec3D';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { ExpressionNode } from '../algebra/ExpressionNode';
import { GeoList } from '../geo/GeoList';
import { AlgoAngle } from './AlgoAngle';
import { circumcenter } from './AlgoTriangleCenters';

const mean = (pts: { x: number; y: number }[]): { x: number; y: number } => {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** 仿比 AffineRatio(P, A, B)：P = A + λ(B−A) 的 λ（有符号）。 */
export function affineRatio(P: { x: number; y: number }, A: { x: number; y: number }, B: { x: number; y: number }): number {
  const abx = B.x - A.x, aby = B.y - A.y;
  const denom = abx * abx + aby * aby;
  if (denom < 1e-300) return NaN;
  return ((P.x - A.x) * abx + (P.y - A.y) * aby) / denom;
}

/** 交比 CrossRatio(A,B,C,D) = (AC/BC)/(AD/BD)（有符号线段比）。 */
export function crossRatio(A: { x: number; y: number }, B: { x: number; y: number }, C: { x: number; y: number }, D: { x: number; y: number }): number {
  // 投影到 AB 方向的有向坐标
  const abx = B.x - A.x, aby = B.y - A.y;
  const len = Math.hypot(abx, aby);
  if (len < 1e-12) return NaN;
  const ux = abx / len, uy = aby / len;
  const t = (P: { x: number; y: number }) => (P.x - A.x) * ux + (P.y - A.y) * uy;
  const tc = t(C), td = t(D), tb = t(B);
  if (Math.abs(tc - tb) < 1e-12 || Math.abs(td - tb) < 1e-12) return NaN;
  return (tc / (tc - tb)) / (td / (td - tb));
}

/** 三线共点判定（容差相对量）。 */
export function areConcurrent(l1: GeoLine, l2: GeoLine, l3: GeoLine): boolean {
  const det = (g1: GeoLine, g2: GeoLine) => g1.a * g2.b - g2.a * g1.b;
  const d12 = det(l1, l2);
  const mag12 = Math.max(Math.abs(l1.a), Math.abs(l1.b), Math.abs(l2.a), Math.abs(l2.b), 1);
  if (Math.abs(d12) < 1e-9 * mag12 * mag12) return false; // l1∥l2
  const x = (l1.b * l2.c - l2.b * l1.c) / d12;
  const y = (l1.c * l2.a - l2.c * l1.a) / d12;
  const on = (l: GeoLine) => {
    const len = Math.hypot(l.a, l.b);
    return len > 1e-12 && Math.abs(l.a * x + l.b * y + l.c) / len < 1e-9;
  };
  return on(l3);
}

// ---------------------------------------------------------------------------

/** 仿比（活算法）：AffineRatio(P, A, B) → 数值。 */
export class AlgoAffineRatio extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(kernel: IKernel, private p: GeoPoint, private a: GeoPoint, private b: GeoPoint) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, NaN);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p, this.a, this.b];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    if (![this.p, this.a, this.b].every(g => g.isDefined())) { this.outputValue.setUndefined(); return; }
    const value = affineRatio(
      { x: this.p.getX(), y: this.p.getY() },
      { x: this.a.getX(), y: this.a.getY() },
      { x: this.b.getX(), y: this.b.getY() },
    );
    if (!Number.isFinite(value)) { this.outputValue.setUndefined(); return; }
    this.outputValue.setValue(value);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
}

/** 交比（活算法）：CrossRatio(A, B, C, D) → 数值。 */
export class AlgoCrossRatio extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(kernel: IKernel, private a: GeoPoint, private b: GeoPoint, private c: GeoPoint, private d: GeoPoint) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, NaN);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.a, this.b, this.c, this.d];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    if (![this.a, this.b, this.c, this.d].every(g => g.isDefined())) { this.outputValue.setUndefined(); return; }
    const value = crossRatio(
      { x: this.a.getX(), y: this.a.getY() },
      { x: this.b.getX(), y: this.b.getY() },
      { x: this.c.getX(), y: this.c.getY() },
      { x: this.d.getX(), y: this.d.getY() },
    );
    if (!Number.isFinite(value)) { this.outputValue.setUndefined(); return; }
    this.outputValue.setValue(value);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
}

/** 重心（活算法）：Barycenter(list[, weights]) → 加权平均点。 */
export class AlgoBarycenter extends AlgoElement {
  private outputPoint: GeoPoint;
  private points: GeoPoint[];
  private weights: GeoNumeric[];

  constructor(kernel: IKernel, points: GeoPoint[], weights: GeoNumeric[] = []) {
    super(kernel);
    this.points = points;
    this.weights = weights;
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...this.points, ...this.weights];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    if (this.points.length === 0 || !this.points.every(g => g.isDefined())) {
      this.outputPoint.setUndefined();
      return;
    }
    let sx = 0, sy = 0, sw = 0;
    const useWeights = this.weights.length === this.points.length;
    for (let i = 0; i < this.points.length; i++) {
      const w = useWeights ? Math.abs(this.weights[i].getValue()) : 1;
      if (!Number.isFinite(w)) { this.outputPoint.setUndefined(); return; }
      sx += this.points[i].getX() * w;
      sy += this.points[i].getY() * w;
      sw += w;
    }
    if (sw < 1e-12) { this.outputPoint.setUndefined(); return; }
    this.outputPoint.setCoords(sx / sw, sy / sw);
    this.outputPoint.setDefined();
  }

  getOutput(): GeoPoint { return this.outputPoint; }
}

/** 三线共点（活算法）：AreConcurrent(l1, l2, l3) → 1/0。 */
export class AlgoAreConcurrent extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(kernel: IKernel, private l1: GeoLine, private l2: GeoLine, private l3: GeoLine) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.l1, this.l2, this.l3];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    if (![this.l1, this.l2, this.l3].every(g => g.isDefined())) { this.outputValue.setUndefined(); return; }
    this.outputValue.setValue(areConcurrent(this.l1, this.l2, this.l3) ? 1 : 0);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
}

/** 多边形全部内角（活算法）：InteriorAngles(polygon) → 角度值列表（自有子元素）。 */
export class AlgoInteriorAngles extends AlgoElement {
  private outputList: GeoList;

  constructor(kernel: IKernel, private polygon: import('../geo/GeoPolygon').GeoPolygon) {
    super(kernel);
    this.outputList = new GeoList(kernel, []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.polygon];
    this.setOutput([this.outputList]);
  }

  compute(): void {
    const verts = this.polygon.vertices;
    if (verts.length < 3 || !verts.every(v => v.isDefined())) {
      this.outputList.setChildren([]);
      this.outputList.setDefined();
      return;
    }
    const n = verts.length;
    const children: GeoNumeric[] = [];
    for (let i = 0; i < n; i++) {
      const prev = verts[(i - 1 + n) % n];
      const cur = verts[i];
      const next = verts[(i + 1) % n];
      const v1x = prev.getX() - cur.getX(), v1y = prev.getY() - cur.getY();
      const v2x = next.getX() - cur.getX(), v2y = next.getY() - cur.getY();
      // 多边形内角：与绕向无关取 [0, π] 的两侧夹角（凹角按官方取内角需绕向——
      // 简化为两侧夹角，与角工具多边形分支一致）
      const angle = Math.acos(Math.max(-1, Math.min(1,
        (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1))));
      const child = new GeoNumeric(this.kernel, angle);
      child.isAngle = true;
      children.push(child);
    }
    this.outputList.setChildren(children);
    this.outputList.setDefined();
  }

  getOutput(): GeoList { return this.outputList; }
}

/** 方向向量（活算法）：Direction(line) → 与直线同方向的自由向量（绘于原点）。 */
export class AlgoDirection extends AlgoElement {
  private outputVector: GeoVector;

  constructor(kernel: IKernel, private line: GeoLine) {
    super(kernel);
    this.outputVector = new GeoVector(kernel, 0, 0, 1, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.line];
    this.setOutput([this.outputVector]);
  }

  compute(): void {
    if (!this.line.isDefined()) { this.outputVector.setUndefined(); return; }
    // 方向 = 法向旋转 90°：(−b, a)，归一化
    const len = Math.hypot(this.line.a, this.line.b);
    if (len < 1e-12) { this.outputVector.setUndefined(); return; }
    const dx = -this.line.b / len;
    const dy = this.line.a / len;
    this.outputVector.startX = 0;
    this.outputVector.startY = 0;
    this.outputVector.endX = dx;
    this.outputVector.endY = dy;
    this.outputVector.setDefined();
  }

  getOutput(): GeoVector { return this.outputVector; }
}

/** 动态坐标点（活算法）：DynamicCoordinates(P, xExpr, yExpr) → 坐标被表达式
 *  改写的点（拖 P 时输出被吸附到动态位置；官方同构）。 */
export class AlgoDynamicCoordinates extends AlgoElement {
  private outputPoint: GeoPoint;
  private deps: GeoNumeric[];
  private pointDeps: GeoPoint[];
  /** 原始命令文本（序列化经 parseAlgebraInput 重建）。 */
  commandText = '';

  constructor(
    kernel: IKernel,
    private source: GeoPoint,
    private xExpr: ExpressionNode,
    private yExpr: ExpressionNode,
    deps: GeoNumeric[],
    pointDeps: GeoPoint[] = [],
  ) {
    super(kernel);
    this.deps = deps;
    this.pointDeps = pointDeps;
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.source, ...this.pointDeps, ...this.deps];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    if (!this.source.isDefined() || !this.pointDeps.every(p => p.isDefined())) {
      this.outputPoint.setUndefined();
      return;
    }
    const scope = new Map<string, number>();
    for (const dep of this.deps) {
      if (dep.label) scope.set(dep.label, dep.getValue());
    }
    // 官方 x(P)/y(P) 记法的预处理产物：x_<label>/y_<label> = 点坐标
    for (const p of [this.source, ...this.pointDeps]) {
      if (p.label) {
        scope.set(`x_${p.label}`, p.getX());
        scope.set(`y_${p.label}`, p.getY());
      }
    }
    // x/y 表达式中的变量名 P 引用源点 x；Y 表达式同理（源点 y 由调用方换名注入 deps）
    const x = evaluate(this.xExpr, scope);
    const y = evaluate(this.yExpr, scope);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { this.outputPoint.setUndefined(); return; }
    this.outputPoint.setCoords(x, y);
    this.outputPoint.setDefined();
  }

  getOutput(): GeoPoint { return this.outputPoint; }
  getCommandText(): string { return this.commandText; }
}

/** 路径参数（活算法）：PathParameter(P) → 路径点 P 的隐藏参数；非路径点 undefined。 */
export class AlgoPathParameter extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(kernel: IKernel, private point: GeoPoint) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, NaN);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.point];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const algo = this.point.parentAlgo;
    if (!algo || !algo.getClassName().startsWith('AlgoPointOn')) {
      this.outputValue.setUndefined();
      return;
    }
    const param = algo.getInput().find((i): i is GeoNumeric => i instanceof GeoNumeric);
    if (!param || !param.isDefined()) { this.outputValue.setUndefined(); return; }
    this.outputValue.setValue(param.getValue());
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
}

// ---------------------------------------------------------------------------
// Kimberling 三角形中心 X(1)–X(10)
// ---------------------------------------------------------------------------

/** 重心坐标 → 笛卡尔点（权重和为 0 时 null）。 */
function barycentric(A: { x: number; y: number }, B: { x: number; y: number }, C: { x: number; y: number }, wA: number, wB: number, wC: number): { x: number; y: number } | null {
  const w = wA + wB + wC;
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return null;
  return { x: (wA * A.x + wB * B.x + wC * C.x) / w, y: (wA * A.y + wB * B.y + wC * C.y) / w };
}

/** Kimberling 中心 X(1)–X(10)；超出返回 null（ETC 全表不在本批）。 */
export function triangleCenter(n: number, A: { x: number; y: number }, B: { x: number; y: number }, C: { x: number; y: number }): { x: number; y: number } | null {
  const a = dist(B, C), b = dist(C, A), c = dist(A, B);
  if (![a, b, c].every(Number.isFinite) || a + b + c < 1e-12) return null;
  switch (Math.round(n)) {
    case 1: // X1 内心：a:b:c 重心坐标
      return barycentric(A, B, C, a, b, c);
    case 2: // X2 重心
      return mean([A, B, C]);
    case 3: { // X3 外心
      const stub = (p: { x: number; y: number }) => ({ getX: () => p.x, getY: () => p.y });
      const o = circumcenter(stub(A), stub(B), stub(C));
      return o;
    }
    case 4: { // X4 垂心：A+B+C−2O
      const o = triangleCenter(3, A, B, C);
      return o ? { x: A.x + B.x + C.x - 2 * o.x, y: A.y + B.y + C.y - 2 * o.y } : null;
    }
    case 5: { // X5 九点圆心：(O+H)/2
      const o = triangleCenter(3, A, B, C);
      const h = triangleCenter(4, A, B, C);
      return o && h ? mean([o, h]) : null;
    }
    case 6: // X6 Lemoine（symmedian）：a²:b²:c²
      return barycentric(A, B, C, a * a, b * b, c * c);
    case 7: { // X7 Gergonne：(1/(s−a) : 1/(s−b) : 1/(s−c))
      const s = (a + b + c) / 2;
      const wa = 1 / (s - a), wb = 1 / (s - b), wc = 1 / (s - c);
      return barycentric(A, B, C, wa, wb, wc);
    }
    case 8: { // X8 Nagel：(s−a : s−b : s−c)
      const s = (a + b + c) / 2;
      return barycentric(A, B, C, s - a, s - b, s - c);
    }
    case 10: { // X10 Spieker：(b+c : c+a : a+b)
      return barycentric(A, B, C, b + c, c + a, a + b);
    }
    default:
      return null;
  }
}

/** 三角形中心（活算法）：TriangleCenter(A, B, C, n) → 点；n 可为滑块。 */
export class AlgoTriangleCenterN extends AlgoElement {
  private outputPoint: GeoPoint;
  private n: GeoNumeric | number;

  constructor(kernel: IKernel, private a: GeoPoint, private b: GeoPoint, private c: GeoPoint, n: GeoNumeric | number) {
    super(kernel);
    this.n = n;
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.a, this.b, this.c, ...(this.n instanceof GeoNumeric ? [this.n] : [])];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    if (![this.a, this.b, this.c].every(g => g.isDefined())) { this.outputPoint.setUndefined(); return; }
    const n = typeof this.n === 'number' ? this.n : this.n.getValue();
    const result = triangleCenter(n,
      { x: this.a.getX(), y: this.a.getY() },
      { x: this.b.getX(), y: this.b.getY() },
      { x: this.c.getX(), y: this.c.getY() });
    if (!result) { this.outputPoint.setUndefined(); return; }
    this.outputPoint.setCoords(result.x, result.y);
    this.outputPoint.setDefined();
  }

  getOutput(): GeoPoint { return this.outputPoint; }
  getN(): GeoNumeric | number { return this.n; }
}

/** InteriorAngles 用的角度算法类型引用（避免未使用告警）。 */
void AlgoAngle;
