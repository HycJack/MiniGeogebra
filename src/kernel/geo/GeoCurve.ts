import { IKernel, Path, PathMover } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoPoint } from './GeoPoint';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { differentiate } from '../algebra/Differentiator';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';

/** 参数曲线采样点；x/y 为 NaN 表示该参数处无定义，渲染时断开。 */
export interface CurveSample { t: number; x: number; y: number }

/** 采样预算与细分阈值（与 GeoFunction 的函数采样同一套准则）。 */
const MAX_SAMPLE_COUNT = 4096;
const MAX_REFINE_DEPTH = 4;
const REFINE_TOLERANCE_RATIO = 0.02;
const MAX_BEND = Math.PI / 9;
const DEFAULT_VIEW_HEIGHT = 20;

/**
 * 参数曲线 —— 对标 GeoGebra GeoCurveCartesian：x = x(t), y = y(t), t ∈ [tMin, tMax]。
 *
 * 实现 Path 接口：路径点（AlgoPointOnCurve）、切线、曲率都从解析导数取值；
 * 绘制采样用「均匀基础 + 弦偏差/弯折角自适应细分」（与函数采样同准则）。
 */
export class GeoCurve extends GeoElement implements Path {
  private scope: Scope = new Map();
  private samples: CurveSample[] = [];
  private sampledRange: { tMin: number; tMax: number; pixelWidth: number; viewHeight: number } | null = null;
  private samplesDirty = true;

  /** 解析导数（构造期一次求好，compute 热路径不重复做符号运算）。 */
  private readonly dxExpr: ExpressionNode;
  private readonly dyExpr: ExpressionNode;

  constructor(
    kernel: IKernel,
    public readonly xExpr: ExpressionNode,
    public readonly yExpr: ExpressionNode,
    public readonly paramName: string,
    public readonly tMin: number,
    public readonly tMax: number,
    public readonly expressionTexts: { x: string; y: string } = { x: '', y: '' },
  ) {
    super(kernel, new GeoVec3D(0, 0, 0));
    this.dxExpr = differentiate(xExpr, paramName);
    this.dyExpr = differentiate(yExpr, paramName);
  }

  getClassName(): string { return 'GeoCurve'; }

  get defaultStrokeColor(): string { return '#16a34a'; }
  get defaultLineWidth(): number { return 2; }

  setScope(scope: Scope): void {
    this.scope = scope;
    this.samplesDirty = true;
  }

  evaluateX(t: number): number {
    const scope = new Map(this.scope);
    scope.set(this.paramName, t);
    return evaluate(this.xExpr, scope);
  }

  evaluateY(t: number): number {
    const scope = new Map(this.scope);
    scope.set(this.paramName, t);
    return evaluate(this.yExpr, scope);
  }

  derivativeX(t: number): number {
    const scope = new Map(this.scope);
    scope.set(this.paramName, t);
    return evaluate(this.dxExpr, scope);
  }

  derivativeY(t: number): number {
    const scope = new Map(this.scope);
    scope.set(this.paramName, t);
    return evaluate(this.dyExpr, scope);
  }

  /** 参数 t 处的点；无定义返回 null。 */
  pointAt(t: number): { x: number; y: number } | null {
    const x = this.evaluateX(t);
    const y = this.evaluateY(t);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const x = this.expressionTexts.x || '…';
    const y = this.expressionTexts.y || '…';
    return `${this.label} : Curve(${x}, ${y}, ${this.paramName}, ${fmt(this.tMin)}, ${fmt(this.tMax)})`;
  }

  // ------------------------------------------------------------------
  // Path 接口
  // ------------------------------------------------------------------

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    // 找最近采样点：粗扫 + 局部细化
    if (this.samples.length < 2) this.updateSamples(800, DEFAULT_VIEW_HEIGHT);
    let best = Infinity;
    let bestT = this.tMin;
    const coarse = 256;
    for (let i = 0; i <= coarse; i++) {
      const t = this.tMin + (this.tMax - this.tMin) * i / coarse;
      const p = this.pointAt(t);
      if (!p) continue;
      const d = Math.hypot(p.x - PI.getX(), p.y - PI.getY());
      if (d < best) { best = d; bestT = t; }
    }
    // 局部细化
    const span = (this.tMax - this.tMin) / coarse;
    for (let i = 0; i <= 40; i++) {
      const t = bestT - span + 2 * span * i / 40;
      if (t < this.tMin || t > this.tMax) continue;
      const p = this.pointAt(t);
      if (!p) continue;
      const d = Math.hypot(p.x - PI.getX(), p.y - PI.getY());
      if (d < best) { best = d; bestT = t; }
    }
    return best < Math.max(eps, 1e-9);
  }

  getMinParameter(): number { return this.tMin; }
  getMaxParameter(): number { return this.tMax; }

  isClosedPath(): boolean {
    const head = this.pointAt(this.tMin);
    const tail = this.pointAt(this.tMax);
    if (!head || !tail) return false;
    const span = Math.hypot(this.evaluateX(this.tMax) - this.evaluateX(this.tMin),
      this.evaluateY(this.tMax) - this.evaluateY(this.tMin));
    const scale = Math.max(Math.abs(this.tMax - this.tMin), 1);
    return span < 1e-6 * scale;
  }

  createPathMover(): PathMover {
    return new CurvePathMover(this);
  }

  // ------------------------------------------------------------------
  // 采样
  // ------------------------------------------------------------------

  updateSamples(
    pixelWidth: number,
    viewHeight = DEFAULT_VIEW_HEIGHT,
  ): ReadonlyArray<CurveSample> {
    if (
      !this.samplesDirty && this.sampledRange &&
      Math.abs(this.sampledRange.pixelWidth - pixelWidth) < 0.5 &&
      Math.abs(this.sampledRange.viewHeight - viewHeight) < 1e-9
    ) return this.samples;

    const baseCount = Math.max(64, Math.min(1200, Math.ceil(pixelWidth / 2)));
    const step = (this.tMax - this.tMin) / baseCount;
    const base: CurveSample[] = [];
    for (let i = 0; i <= baseCount; i++) {
      const t = this.tMin + step * i;
      const p = this.pointAt(t);
      base.push(p ? { t, x: p.x, y: p.y } : { t, x: NaN, y: NaN });
    }

    this.samples = this.refine(base, viewHeight);
    this.sampledRange = { tMin: this.tMin, tMax: this.tMax, pixelWidth, viewHeight };
    this.samplesDirty = false;
    return this.samples;
  }

  getSamples(): ReadonlyArray<CurveSample> {
    return this.samples;
  }

  /** 找曲线上离 (x, y) 最近的参数 t（拖拽路径点时用）。 */
  nearestParameter(x: number, y: number): number {
    const coarse = 256;
    let best = Infinity;
    let bestT = this.tMin;
    for (let i = 0; i <= coarse; i++) {
      const t = this.tMin + (this.tMax - this.tMin) * i / coarse;
      const p = this.pointAt(t);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < best) { best = d; bestT = t; }
    }
    // 局部黄金分割式细化三段
    let span = (this.tMax - this.tMin) / coarse;
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i <= 40; i++) {
        const t = bestT - span + 2 * span * i / 40;
        if (t < this.tMin || t > this.tMax) continue;
        const p = this.pointAt(t);
        if (!p) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < best) { best = d; bestT = t; }
      }
      span /= 10;
    }
    return bestT;
  }

  private refine(samples: CurveSample[], viewHeight: number): CurveSample[] {
    const tolerance = Math.max(viewHeight * REFINE_TOLERANCE_RATIO, 1e-9);
    const budget = { left: MAX_SAMPLE_COUNT };
    const refined: CurveSample[] = [];
    for (let i = 0; i < samples.length - 1; i++) {
      refined.push(samples[i]);
      refined.push(...this.subdivide(samples[i], samples[i + 1], 0, tolerance, budget));
    }
    refined.push(samples[samples.length - 1]);
    return refined;
  }

  private subdivide(
    a: CurveSample,
    b: CurveSample,
    depth: number,
    tolerance: number,
    budget: { left: number },
  ): CurveSample[] {
    if (depth >= MAX_REFINE_DEPTH || budget.left <= 0) return [];
    if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) return [];

    const midT = (a.t + b.t) / 2;
    const mid = this.pointAt(midT);
    if (!mid) return [];
    const midSample = { t: midT, x: mid.x, y: mid.y };

    const flat = Math.hypot(mid.x - (a.x + b.x) / 2, mid.y - (a.y + b.y) / 2) <= tolerance;
    if (flat && !this.isSharpBend(a, midSample, b)) return [];

    budget.left--;
    const left = this.subdivide(a, midSample, depth + 1, tolerance, budget);
    const right = this.subdivide(midSample, b, depth + 1, tolerance, budget);
    return [...left, midSample, ...right];
  }

  private isSharpBend(a: CurveSample, mid: CurveSample, b: CurveSample): boolean {
    const v1x = mid.x - a.x, v1y = mid.y - a.y;
    const v2x = b.x - mid.x, v2y = b.y - mid.y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (l1 === 0 || l2 === 0) return false;
    const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
    return Math.acos(Math.min(1, Math.max(-1, cos))) > MAX_BEND;
  }
}

function fmt(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : String(v);
}

class CurvePathMover implements PathMover {
  private idx = 0;
  private samples: CurveSample[];

  constructor(private curve: GeoCurve) {
    this.samples = [...curve.updateSamples(800)];
  }

  getCurrentPosition(p: GeoPoint): void {
    const s = this.samples[this.idx % this.samples.length];
    if (s && Number.isFinite(s.x)) {
      p.setCoords(s.x, s.y, 1);
    } else {
      const start = this.curve.pointAt(this.curve.getMinParameter());
      if (start) p.setCoords(start.x, start.y, 1);
    }
  }
  getNext(_p: GeoPoint): boolean {
    if (this.idx >= this.samples.length - 1) return false;
    this.idx++;
    return true;
  }
  hasNext(): boolean { return this.idx < this.samples.length - 1; }
  resetStartParameter(): void { this.idx = 0; }
  changeOrientation(): void { this.samples.reverse(); this.idx = 0; }
}
