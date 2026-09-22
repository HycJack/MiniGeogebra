/**
 * Extremum(f) 多极值派生点集（A1-3 收尾，对标 GeoGebra CmdExtremum 的多点输出）。
 *
 * 结构：N 个 AlgoFunctionExtremumPoint 兄弟算法（各自窗口跟随 + near-to 选点，
 * 入构造以随 f/滑块联动）+ 一个 GeoList 容器（输出）。
 * 与 AlgoRootList 同构，差别仅在搜索内容是 findExtrema 而非 findRoots，
 * 以及槽位点的 y 坐标是极值函数值而非恒 0。
 *
 * 关键约定：兄弟算法**先于**本算法进入构造（constIndex 更小），依赖图按
 * 构造序重算——兄弟先各自锁点，本算法最后跑 assignHits 做"极值→槽位"
 * 就近分配：占用的槽位写回播种并置点，空闲槽位置 undefined。undefined
 * 槽位的兄弟算法 compute 会立即重新设值吗？不会——它们的 compute 只在
 * 搜索窗口内找到极值才设值，而空闲槽位的窗口中心 seedLastX(NaN) 使窗口
 * 落在 [NaN, NaN]，findExtrema 直接返回空 → 点保持 undefined。这是把
 * "禁用槽位"表达为 NaN 窗口的原因（否则兄弟 compute 与本算法分配在
 * 相邻两轮间互相覆盖，产生振荡）。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoList } from '../geo/GeoList';
import { GeoPoint } from '../geo/GeoPoint';
import { findExtrema, ExtremumHit } from '../algebra/Numerics';
import { AlgoFunctionExtremumPoint, makeDerivativeEvaluator } from './AlgoFunctionExtremumPoint';

export const EXTREMUM_LIST_CAPACITY = 8;

export class AlgoExtremumList extends AlgoElement {
  private outputList: GeoList;
  private pointAlgos: AlgoFunctionExtremumPoint[] = [];
  private pointOutputs: GeoPoint[] = [];
  private lo: number;
  private hi: number;

  constructor(kernel: IKernel, fn: GeoFunction, lo: number, hi: number,
              capacity = EXTREMUM_LIST_CAPACITY, initialHits?: ExtremumHit[]) {
    super(kernel);
    this.lo = lo;
    this.hi = hi;
    this.outputList = new GeoList(kernel, []);
    for (let i = 0; i < capacity; i++) {
      // 首轮播种：第 i 个槽位锁到第 i 个探测极值（或禁用），
      // 兄弟算法后续窗口跟随即从正确的极值点出发。
      const pointAlgo = new AlgoFunctionExtremumPoint(kernel, fn, lo, hi);
      if (initialHits) pointAlgo.seedLastX(i < initialHits.length ? initialHits[i].x : Number.NaN);
      this.pointAlgos.push(pointAlgo);
      this.pointOutputs.push(pointAlgo.getOutput());
    }
    if (initialHits) {
      this.pointOutputs.forEach((pt, i) => {
        if (i < initialHits.length) {
          pt.setCoords(initialHits[i].x, initialHits[i].y, 1);
          pt.setDefined();
        } else {
          pt.setUndefined(); // 禁用槽位默认 defined（GeoPoint 初值），显式关闭
        }
      });
      this.outputList.setChildren(this.pointOutputs.slice(0, initialHits.length));
      this.outputList.setDefined();
    }
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.pointAlgos[0]
      ? (this.pointAlgos[0] as unknown as { getInput(): GeoElement[] }).getInput()[0]
      : this.outputList];
    this.setOutput([this.outputList]);
  }

  getOutput(): GeoList { return this.outputList; }

  /** 兄弟极值点算法（调用方需把它们与各自输出按序加入构造，先于本算法）。 */
  getPointAlgos(): AlgoFunctionExtremumPoint[] { return this.pointAlgos; }

  getPointOutputs(): GeoPoint[] { return this.pointOutputs; }

  getSearchRange(): [number, number] { return [this.lo, this.hi]; }

  /** 各槽位当前锁定的极值 x（禁用槽位为 NaN）。 */
  getSlotRoots(): number[] {
    return this.pointAlgos.map(a => a.getLastSeedX());
  }

  compute(): void {
    const fn = this.input[0] as GeoFunction;
    if (!fn || !fn.isDefined()) {
      // 全部禁用（NaN 窗口）→ 兄弟 compute 自然置 undefined
      this.pointAlgos.forEach(a => a.seedLastX(Number.NaN));
      this.outputList.setUndefined();
      return;
    }
    const f = (x: number) => fn.evaluateAt(x);
    const fPrime = makeDerivativeEvaluator(fn);
    const hits = findExtrema(f, fPrime, this.lo, this.hi);
    const assignment = this.assignHits(hits);
    assignment.forEach((hit, slot) => {
      if (hit === null) {
        // 禁用槽位：NaN 窗口 → 兄弟下一轮 compute 找不到极值 → 保持 undefined
        this.pointAlgos[slot].seedLastX(Number.NaN);
        this.pointOutputs[slot].setUndefined();
      } else {
        this.pointAlgos[slot].seedLastX(hit.x);
        this.pointOutputs[slot].setCoords(hit.x, hit.y, 1);
        this.pointOutputs[slot].setDefined();
      }
    });
    this.outputList.setChildren(
      assignment
        .map((h, slot) => ({ h, slot }))
        .filter(({ h }) => h !== null)
        .map(({ slot }) => this.pointOutputs[slot]),
    );
    this.outputList.setDefined();
  }

  /** 极值 → 槽位就近分配（返回长度 = 容量，null = 空闲）。 */
  private assignHits(hits: ExtremumHit[]): (ExtremumHit | null)[] {
    const result: (ExtremumHit | null)[] = new Array(this.pointOutputs.length).fill(null);
    const usedHit = new Set<number>();
    // 第一轮：有定义槽位 ↔ 最近极值（距离升序贪心全局配对，保标签连续）
    const pairs: { slot: number; hi: number; dist: number }[] = [];
    this.pointOutputs.forEach((pt, slot) => {
      if (!pt.isDefined()) return;
      hits.forEach((hit, hi) => {
        pairs.push({ slot, hi, dist: Math.abs(pt.getX() - hit.x) });
      });
    });
    pairs.sort((a, b) => a.dist - b.dist);
    const takenSlot = new Set<number>();
    for (const { slot, hi } of pairs) {
      if (takenSlot.has(slot) || usedHit.has(hi)) continue;
      result[slot] = hits[hi];
      usedHit.add(hi);
      takenSlot.add(slot);
    }
    // 第二轮：剩余极值填空闲槽位（按 x 升序）
    hits.forEach((hit, hi) => {
      if (usedHit.has(hi)) return;
      const free = result.indexOf(null);
      if (free < 0) return;
      result[free] = hit;
      usedHit.add(hi);
    });
    return result;
  }
}
