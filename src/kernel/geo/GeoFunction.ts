import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { Scope } from '../algebra/ExpressionNode';
import { ExpressionNode } from '../algebra/ExpressionNode';

/** 曲线采样点。`y === NaN` 表示该处函数无定义（域限制、除零、越界开方），
 *  渲染时应在此处断开路径。 */
export interface FunctionSample { x: number; y: number }

/** 可选的可视范围，用于让自适应采样与渐近线判定随视图缩放。 */
export interface SampleViewBounds {
  minY?: number;
  maxY?: number;
}

/** 未传入可视范围时使用的默认视高（世界单位）。 */
export const DEFAULT_VIEW_HEIGHT = 20;

/** 曲线采样点数上限（自适应细分的预算）。 */
const MAX_SAMPLE_COUNT = 4096;

/** 均匀采样的基础分辨率：每 2 像素一个点。 */
const MIN_SAMPLE_COUNT = 64;
const MAX_BASE_COUNT = 1200;

/** 自适应细分的最大递归深度。 */
const MAX_REFINE_DEPTH = 4;

/** 细分触发阈值：弦中点与真实中点的偏差超过视高的该比例时继续细分。 */
const REFINE_TOLERANCE_RATIO = 0.02;

/** 渐近线判定阈值：跨零点两侧的峰值超过视高的该倍数时插入断点。 */
const ASYMPTOTE_RATIO = 4;

export class GeoFunction extends GeoElement {
  private scope: Scope = new Map();
  private samples: FunctionSample[] = [];
  private sampledRange: { minX: number; maxX: number; pixelWidth: number; viewHeight: number } | null = null;
  private samplesDirty = true;

  constructor(
    kernel: IKernel,
    public readonly expression: ExpressionNode,
    public readonly variableName: string,
    public readonly expressionText: string,
  ) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName(): string { return 'GeoFunction'; }

  get defaultStrokeColor(): string { return '#dc2626'; }
  get defaultLineWidth(): number { return 2; }

  setScope(scope: Scope): void {
    this.scope = scope;
    this.samplesDirty = true;
  }

  evaluateAt(x: number): number {
    const scope = new Map(this.scope);
    scope.set(this.variableName, x);
    return evaluate(this.expression, scope);
  }

  /**
   * 在 `[minX, maxX]` 上重新采样曲线。
   *
   * 采样策略（对标 GeoGebra 的 FunctionGraphing）：
   *   1. 均匀基础采样（每 2 像素一个点）；
   *   2. 自适应细分：弦中点与真实中点偏差过大时递归二分，捕捉高曲率区；
   *   3. 渐近线断点：跨零点两侧且峰值远超视高时插入 NaN，避免画出假竖线；
   *   4. 仅对**真正无定义**的值写 NaN，不对有限值做任意截断（由画布自然裁剪）。
   *
   * 端点（`minX` / `maxX` 处）在细分与断点插入中保持不变。
   */
  updateSamples(
    minX: number,
    maxX: number,
    pixelWidth: number,
    viewBounds?: SampleViewBounds,
  ): ReadonlyArray<FunctionSample> {
    const viewHeight = resolveViewHeight(viewBounds, minX, maxX);

    if (
      !this.samplesDirty && this.sampledRange &&
      Math.abs(this.sampledRange.minX - minX) < 1e-9 &&
      Math.abs(this.sampledRange.maxX - maxX) < 1e-9 &&
      Math.abs(this.sampledRange.pixelWidth - pixelWidth) < 0.5 &&
      Math.abs(this.sampledRange.viewHeight - viewHeight) < 1e-9
    ) return this.samples;

    const width = Math.max(0, maxX - minX);
    if (width === 0) {
      this.samples = [{ x: minX, y: this.sampleValue(minX) }];
      this.sampledRange = { minX, maxX, pixelWidth, viewHeight };
      this.samplesDirty = false;
      return this.samples;
    }

    const count = Math.max(MIN_SAMPLE_COUNT, Math.min(MAX_BASE_COUNT, Math.ceil(pixelWidth / 2)));
    const step = width / count;

    const base: FunctionSample[] = [];
    for (let i = 0; i <= count; i++) {
      const x = minX + step * i;
      base.push({ x, y: this.sampleValue(x) });
    }

    this.samples = this.breakAtAsymptotes(this.refine(base, viewHeight), viewHeight);
    this.sampledRange = { minX, maxX, pixelWidth, viewHeight };
    this.samplesDirty = false;
    return this.samples;
  }

  /** 读取上一次采样的结果（未采样时返回空数组）。 */
  getSamples(): ReadonlyArray<FunctionSample> {
    return this.samples;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label}(${this.variableName}) = ${this.expressionText}`;
  }

  // ------------------------------------------------------------------
  // 内部实现
  // ------------------------------------------------------------------

  /** 采样单点：只把"无定义"记为 NaN，保留所有有限值。 */
  private sampleValue(x: number): number {
    const y = this.evaluateAt(x);
    return Number.isFinite(y) ? y : NaN;
  }

  /** 自适应细分：在不改变端点的前提下，向高曲率区间插入中间采样点。 */
  private refine(samples: FunctionSample[], viewHeight: number): FunctionSample[] {
    const tolerance = Math.max(viewHeight * REFINE_TOLERANCE_RATIO, 1e-9);
    const budget = { left: MAX_SAMPLE_COUNT };
    const refined: FunctionSample[] = [];

    for (let i = 0; i < samples.length - 1; i++) {
      refined.push(samples[i]);
      refined.push(...this.subdivide(samples[i], samples[i + 1], 0, tolerance, budget));
    }
    refined.push(samples[samples.length - 1]);
    return refined;
  }

  /** 递归二分 [a, b]，返回插入在 a、b 之间的点（不含端点）。 */
  private subdivide(
    a: FunctionSample,
    b: FunctionSample,
    depth: number,
    tolerance: number,
    budget: { left: number },
  ): FunctionSample[] {
    if (depth >= MAX_REFINE_DEPTH || budget.left <= 0) return [];
    if (!Number.isFinite(a.y) || !Number.isFinite(b.y)) return [];

    const mid = { x: (a.x + b.x) / 2, y: this.sampleValue((a.x + b.x) / 2) };
    if (!Number.isFinite(mid.y)) return [];

    if (Math.abs(mid.y - (a.y + b.y) / 2) <= tolerance) return [];

    budget.left--;
    const left = this.subdivide(a, mid, depth + 1, tolerance, budget);
    const right = this.subdivide(mid, b, depth + 1, tolerance, budget);
    return [...left, mid, ...right];
  }

  /** 渐近线断点：在垂直渐近线处插入 NaN，使渲染路径在此断开。 */
  private breakAtAsymptotes(samples: FunctionSample[], viewHeight: number): FunctionSample[] {
    const threshold = Math.max(viewHeight * ASYMPTOTE_RATIO, 1e-9);
    const result: FunctionSample[] = [];

    for (let i = 0; i < samples.length; i++) {
      result.push(samples[i]);
      const next = samples[i + 1];
      if (i >= samples.length - 1 || !next) continue;

      const crossedZero = Number.isFinite(samples[i].y) && Number.isFinite(next.y) && samples[i].y * next.y < 0;
      const peak = Math.max(Math.abs(samples[i].y), Math.abs(next.y));
      if (crossedZero && peak > threshold) {
        result.push({ x: (samples[i].x + next.x) / 2, y: NaN });
      }
    }
    return result;
  }
}

/** 计算可视高度；不可用时回退到默认视高。 */
function resolveViewHeight(viewBounds: SampleViewBounds | undefined, minX: number, maxX: number): number {
  if (viewBounds && Number.isFinite(viewBounds.minY) && Number.isFinite(viewBounds.maxY)) {
    const height = Math.abs(viewBounds.maxY - viewBounds.minY);
    if (height > 0) return height;
  }
  return DEFAULT_VIEW_HEIGHT;
}
