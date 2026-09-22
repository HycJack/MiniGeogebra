/**
 * 函数极值派生点（对标 GeoGebra AlgoExtremumMulti 的单点变体）：
 * `Extremum(f)` / `Extremum(f, a, b)` 的占用槽位点——f（或其驱动滑块）变化时
 * 点自动跟随。选点时优先离点上一次位置最近的极值，保证拖动滑块时标签不跳变。
 *
 * 与 AlgoFunctionRootPoint 同构：搜索窗口跟随上次位置 + 渐进扩窗兜底；
 * 差别仅在搜索内容是 findExtrema（需要 f′）而非 findRoots。
 * 导数走符号微分一次缓存 + 每次求值带上驱动滑块作用域（对标识别器 Extremum 分支）。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoVec3D } from '../core/GeoVec3D';
import { AlgoDependentFunction } from './AlgoDependentFunction';
import { differentiate } from '../algebra/Differentiator';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { Scope } from '../algebra/ExpressionNode';
import { findExtrema, ExtremumHit } from '../algebra/Numerics';

/** 为 f 构造 f′ 求值闭包：AST 只求导一次，每次调用带上驱动滑块的当前值。 */
export function makeDerivativeEvaluator(fn: GeoFunction): (x: number) => number {
  const ast = differentiate(fn.expression, fn.variableName);
  return (x: number) => {
    const scope: Scope = new Map();
    const source = fn.parentAlgo;
    if (source instanceof AlgoDependentFunction) {
      source.getDependencies().forEach((dependency, index) =>
        scope.set(dependency.label || `dep${index}`, dependency.getValue()));
    }
    scope.set(fn.variableName, x);
    return evaluate(ast, scope);
  };
}

export class AlgoFunctionExtremumPoint extends AlgoElement {
  private outputPoint: GeoPoint;
  private lastX: number;
  private derivative: (x: number) => number;

  constructor(kernel: IKernel, private fn: GeoFunction, private lo: number, private hi: number) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.lastX = Number.isFinite(lo) && Number.isFinite(hi) ? (lo + hi) / 2 : 0;
    this.derivative = makeDerivativeEvaluator(fn);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.fn];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  getSearchRange(): [number, number] { return [this.lo, this.hi]; }

  /** 初始化"上次极值位置"（AlgoExtremumList 分配槽位时播种用）。 */
  seedLastX(x: number): void { this.lastX = x; }

  /** 当前锁定的极值位置（NaN = 禁用/未定）。 */
  getLastSeedX(): number { return this.lastX; }

  compute(): void {
    // lastX 为 NaN 表示"本槽位被禁用"（AlgoExtremumList 空闲槽）：直接置 undefined，
    // 否则兄弟 compute 会在下一轮把已分配走的槽点重新设值（振荡）。
    if (!Number.isFinite(this.lastX)) {
      this.outputPoint.setUndefined();
      return;
    }
    const f = (x: number) => this.fn.evaluateAt(x);
    const fPrime = this.derivative;
    // 搜索窗口跟随上一次的极值位置，逐级扩窗兜底（与 AlgoFunctionRootPoint 同构）。
    const width = Math.max(this.hi - this.lo, 1e-9);
    const center = this.lastX;
    let hits: ExtremumHit[] = [];
    for (let k = 0; k <= 5 && hits.length === 0; k++) {
      const half = (width / 2) * Math.pow(2, k);
      hits = findExtrema(f, fPrime, center - half, center + half);
    }
    if (hits.length === 0) {
      this.outputPoint.setUndefined();
      return;
    }
    // 选离上一次位置最近的极值（标签连续性，对标 AlgoIntersect 的 near-to）
    let best = hits[0];
    let bestDist = Math.abs(hits[0].x - this.lastX);
    for (const h of hits) {
      const dist = Math.abs(h.x - this.lastX);
      if (dist < bestDist) { bestDist = dist; best = h; }
    }
    this.lastX = best.x;
    this.outputPoint.setCoords(best.x, best.y, 1);
    this.outputPoint.setDefined();
  }
}
