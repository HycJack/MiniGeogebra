/**
 * Root(f) 多根派生点集（A1-3 收尾，对标 GeoGebra CmdRoot 的列表输出）。
 *
 * 结构：N 个 AlgoFunctionRootPoint 兄弟算法（各自窗口跟随 + near-to 选根，
 * 入构造以随 f/滑块联动）+ 一个 GeoList 容器（输出）。
 *
 * 关键约定：兄弟算法**先于**本算法进入构造（constIndex 更小），依赖图按
 * 构造序重算——兄弟先各自锁定根，本算法最后跑 assignRoots 做"根→槽位"
 * 就近分配：占用的槽位写回播种并置点，空闲槽位置 undefined。undefined
 * 槽位的兄弟算法 compute 会立即重新设值吗？不会——它们的 compute 只在
 * 搜索窗口内找到根才设值，而空闲槽位的窗口中心 seedLastX(NaN) 使窗口
 * 落在 [NaN, NaN]，findRoots 直接返回空 → 点保持 undefined。这是把
 * "禁用槽位"表达为 NaN 窗口的原因（否则兄弟 compute 与本算法分配在
 * 相邻两轮间互相覆盖，产生振荡）。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoList } from '../geo/GeoList';
import { GeoPoint } from '../geo/GeoPoint';
import { findRoots } from '../algebra/Numerics';
import { AlgoFunctionRootPoint } from './AlgoFunctionRootPoint';

export const ROOT_LIST_CAPACITY = 8;

export class AlgoRootList extends AlgoElement {
  private outputList: GeoList;
  private rootAlgos: AlgoFunctionRootPoint[] = [];
  private rootPoints: GeoPoint[] = [];
  private lo: number;
  private hi: number;

  constructor(kernel: IKernel, fn: GeoFunction, lo: number, hi: number,
              capacity = ROOT_LIST_CAPACITY, initialRoots?: number[]) {
    super(kernel);
    this.lo = lo;
    this.hi = hi;
    this.outputList = new GeoList(kernel, []);
    for (let i = 0; i < capacity; i++) {
      // 首轮播种：第 i 个槽位锁到第 i 个探测根（或禁用），
      // 兄弟算法后续窗口跟随即从正确的根出发。
      const rootAlgo = new AlgoFunctionRootPoint(kernel, fn, lo, hi);
      if (initialRoots) rootAlgo.seedLastX(i < initialRoots.length ? initialRoots[i] : Number.NaN);
      this.rootAlgos.push(rootAlgo);
      this.rootPoints.push(rootAlgo.getOutput());
    }
    if (initialRoots) {
      this.rootPoints.forEach((pt, i) => {
        if (i < initialRoots.length) {
          pt.setCoords(initialRoots[i], 0, 1);
          pt.setDefined();
        } else {
          pt.setUndefined(); // 禁用槽位默认 defined（GeoPoint 初值），显式关闭
        }
      });
      this.outputList.setChildren(this.rootPoints.slice(0, initialRoots.length));
      this.outputList.setDefined();
    }
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.rootAlgos[0]
      ? (this.rootAlgos[0] as unknown as { getInput(): GeoElement[] }).getInput()[0]
      : this.outputList];
    this.setOutput([this.outputList]);
  }

  getOutput(): GeoList { return this.outputList; }

  /** 兄弟根点算法（调用方需把它们与各自输出按序加入构造，先于本算法）。 */
  getRootAlgos(): AlgoFunctionRootPoint[] { return this.rootAlgos; }

  getRootPoints(): GeoPoint[] { return this.rootPoints; }

  getSearchRange(): [number, number] { return [this.lo, this.hi]; }

  /** 各槽位当前锁定的根（禁用槽位为 NaN）。 */
  getSlotRoots(): number[] {
    return this.rootAlgos.map(a => {
      const algo = a as unknown as { getLastSeedX(): number };
      return algo.getLastSeedX();
    });
  }

  compute(): void {
    const fn = this.input[0] as GeoFunction;
    if (!fn || !fn.isDefined()) {
      // 全部禁用（NaN 窗口）→ 兄弟 compute 自然置 undefined
      this.rootAlgos.forEach(a => a.seedLastX(Number.NaN));
      this.outputList.setUndefined();
      return;
    }
    const roots = findRoots((x: number) => fn.evaluateAt(x), this.lo, this.hi);
    const assignment = this.assignRoots(roots);
    assignment.forEach((root, slot) => {
      if (root === null) {
        // 禁用槽位：NaN 窗口 → 兄弟下一轮 compute 找不到根 → 保持 undefined
        this.rootAlgos[slot].seedLastX(Number.NaN);
        this.rootPoints[slot].setUndefined();
      } else {
        this.rootAlgos[slot].seedLastX(root);
        this.rootPoints[slot].setCoords(root, 0, 1);
        this.rootPoints[slot].setDefined();
      }
    });
    this.outputList.setChildren(
      assignment
        .map((r, slot) => ({ r, slot }))
        .filter(({ r }) => r !== null)
        .map(({ slot }) => this.rootPoints[slot]),
    );
    this.outputList.setDefined();
  }

  /** 根 → 槽位就近分配（返回长度 = 容量，null = 空闲）。 */
  private assignRoots(roots: number[]): (number | null)[] {
    const result: (number | null)[] = new Array(this.rootPoints.length).fill(null);
    const usedRoot = new Set<number>();
    // 第一轮：有定义槽位 ↔ 最近根（距离升序贪心全局配对，保标签连续）
    const pairs: { slot: number; ri: number; dist: number }[] = [];
    this.rootPoints.forEach((pt, slot) => {
      if (!pt.isDefined()) return;
      roots.forEach((root, ri) => {
        pairs.push({ slot, ri, dist: Math.abs(pt.getX() - root) });
      });
    });
    pairs.sort((a, b) => a.dist - b.dist);
    const takenSlot = new Set<number>();
    for (const { slot, ri } of pairs) {
      if (takenSlot.has(slot) || usedRoot.has(ri)) continue;
      result[slot] = roots[ri];
      usedRoot.add(ri);
      takenSlot.add(slot);
    }
    // 第二轮：剩余根填空闲槽位（按根升序）
    roots.forEach((root, ri) => {
      if (usedRoot.has(ri)) return;
      const free = result.indexOf(null);
      if (free < 0) return;
      result[free] = root;
      usedRoot.add(ri);
    });
    return result;
  }
}
