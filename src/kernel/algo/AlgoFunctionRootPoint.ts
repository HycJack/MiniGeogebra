/**
 * 函数求根派生点（对标 GeoGebra AlgoRootNewton / CmdRoot 的单根变体）：
 * `Root(f, x0)` 在 x0 附近、`Root(f, a, b)` 在区间内求根，输出**派生点**——
 * f（或其驱动滑块）变化时点自动跟随。选根时优先离点上一次位置最近的根，
 * 保证拖动滑块时根的标签不跳变。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoVec3D } from '../core/GeoVec3D';
import { findRoots } from '../algebra/Numerics';

export class AlgoFunctionRootPoint extends AlgoElement {
  private outputPoint: GeoPoint;
  private lastX: number;

  constructor(kernel: IKernel, private fn: GeoFunction, private lo: number, private hi: number) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.lastX = Number.isFinite(lo) && Number.isFinite(hi) ? (lo + hi) / 2 : 0;
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.fn];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  getSearchRange(): [number, number] { return [this.lo, this.hi]; }

  /** 初始化"上次根位置"（AlgoRootList 分配槽位时播种用）。 */
  seedLastX(x: number): void { this.lastX = x; }

  /** 当前锁定的根位置（NaN = 禁用/未定）。 */
  getLastSeedX(): number { return this.lastX; }

  compute(): void {
    const f = (x: number) => this.fn.evaluateAt(x);
    // 搜索窗口跟随上一次的根位置——对标 GeoGebra Root(f, x0) 的牛顿式连续
    // 跟踪。滑块大幅跳变时根可能一步移出局部窗口，因此逐级扩窗兜底：
    // 局部窗口（宽 w）→ 2w → 4w … 最多 32w；仍无根才置 undefined。
    // lastX 为 NaN 表示"本槽位被禁用"（AlgoRootList 空闲槽）：直接置 undefined，
    // 否则兄弟 compute 会在下一轮把已分配走的槽点重新设值（振荡）。
    if (!Number.isFinite(this.lastX)) {
      this.outputPoint.setUndefined();
      return;
    }
    const width = Math.max(this.hi - this.lo, 1e-9);
    const center = this.lastX;
    let roots: number[] = [];
    for (let k = 0; k <= 5 && roots.length === 0; k++) {
      const half = (width / 2) * Math.pow(2, k);
      roots = findRoots(f, center - half, center + half);
    }
    if (roots.length === 0) {
      this.outputPoint.setUndefined();
      return;
    }
    // 选离上一次位置最近的根（标签连续性，对标 AlgoIntersect 的 near-to）
    let best = roots[0];
    let bestDist = Math.abs(roots[0] - this.lastX);
    for (const r of roots) {
      const dist = Math.abs(r - this.lastX);
      if (dist < bestDist) { bestDist = dist; best = r; }
    }
    this.lastX = best;
    this.outputPoint.setCoords(best, 0, 1);
    this.outputPoint.setDefined();
  }
}
