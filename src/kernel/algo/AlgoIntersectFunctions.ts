/**
 * Intersect(f, g) 两函数交点列表（对标 GeoGebra CmdIntersect 函数×函数分支）。
 *
 * 结构与 AlgoRootList 完全同构：N 个 AlgoIntersectFunctionsPoint 兄弟算法
 * （窗口跟随 + near-to 选根，入构造随 f/g 联动）+ 一个 GeoList 容器（输出）。
 * 求根对象是差函数 f−g；槽位点的 y 取 f(x)（交点处 f(x)=g(x)）。
 * "根→槽位就近分配"保标签连续；空闲槽位 NaN 窗口禁用（防兄弟间振荡）。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoList } from '../geo/GeoList';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';
import { findRoots } from '../algebra/Numerics';

export const INTERSECT_FUNCTIONS_CAPACITY = 8;

/** 单个交点派生点：窗口跟随上一次交点位置，在 f−g 上求最近根。 */
export class AlgoIntersectFunctionsPoint extends AlgoElement {
  private outputPoint: GeoPoint;
  private lastX: number;

  constructor(kernel: IKernel, private f: GeoFunction, private g: GeoFunction, private lo: number, private hi: number) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.lastX = Number.isFinite(lo) && Number.isFinite(hi) ? (lo + hi) / 2 : 0;
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.f, this.g];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  getSearchRange(): [number, number] { return [this.lo, this.hi]; }

  seedLastX(x: number): void { this.lastX = x; }

  getLastSeedX(): number { return this.lastX; }

  compute(): void {
    const diff = (x: number) => this.f.evaluateAt(x) - this.g.evaluateAt(x);
    if (!Number.isFinite(this.lastX)) {
      this.outputPoint.setUndefined();
      return;
    }
    const width = Math.max(this.hi - this.lo, 1e-9);
    let roots: number[] = [];
    for (let k = 0; k <= 5 && roots.length === 0; k++) {
      const half = (width / 2) * Math.pow(2, k);
      roots = findRoots(diff, this.lastX - half, this.lastX + half);
    }
    if (roots.length === 0) {
      this.outputPoint.setUndefined();
      return;
    }
    let best = roots[0];
    let bestDist = Math.abs(roots[0] - this.lastX);
    for (const r of roots) {
      const dist = Math.abs(r - this.lastX);
      if (dist < bestDist) { bestDist = dist; best = r; }
    }
    this.lastX = best;
    // 交点 y = f(x)（= g(x)）；f 无定义处（NaN）交点无效
    const y = this.f.evaluateAt(best);
    if (!Number.isFinite(y)) {
      this.outputPoint.setUndefined();
      return;
    }
    this.outputPoint.setCoords(best, y, 1);
    this.outputPoint.setDefined();
  }
}

export class AlgoIntersectFunctions extends AlgoElement {
  private outputList: GeoList;
  private brothers: AlgoIntersectFunctionsPoint[] = [];
  private points: GeoPoint[] = [];
  private lo: number;
  private hi: number;

  constructor(kernel: IKernel, f: GeoFunction, g: GeoFunction, lo: number, hi: number,
              capacity = INTERSECT_FUNCTIONS_CAPACITY, initialXs?: number[]) {
    super(kernel);
    this.lo = lo;
    this.hi = hi;
    this.outputList = new GeoList(kernel, []);
    for (let i = 0; i < capacity; i++) {
      const brother = new AlgoIntersectFunctionsPoint(kernel, f, g, lo, hi);
      if (initialXs) brother.seedLastX(i < initialXs.length ? initialXs[i] : Number.NaN);
      this.brothers.push(brother);
      this.points.push(brother.getOutput());
    }
    if (initialXs) {
      this.points.forEach((pt, i) => {
        if (i < initialXs.length) {
          pt.setCoords(initialXs[i], f.evaluateAt(initialXs[i]), 1);
          pt.setDefined();
        } else {
          pt.setUndefined();
        }
      });
      this.outputList.setChildren(this.points.slice(0, initialXs.length));
      this.outputList.setDefined();
    }
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.brothers[0]
      ? (this.brothers[0] as unknown as { getInput(): GeoElement[] }).getInput()[0]
      : this.outputList,
      this.brothers[0]
      ? (this.brothers[0] as unknown as { getInput(): GeoElement[] }).getInput()[1]
      : this.outputList];
    this.setOutput([this.outputList]);
  }

  getOutput(): GeoList { return this.outputList; }

  getBrothers(): AlgoIntersectFunctionsPoint[] { return this.brothers; }

  getPoints(): GeoPoint[] { return this.points; }

  getSearchRange(): [number, number] { return [this.lo, this.hi]; }

  /** 各槽位当前交点 x（禁用槽为 NaN），供序列化恢复。 */
  getSlotXs(): number[] {
    return this.brothers.map(a => a.getLastSeedX());
  }

  compute(): void {
    const f = this.input[0] as GeoFunction;
    const g = this.input[1] as GeoFunction;
    if (!f || !g || !f.isDefined() || !g.isDefined()) {
      this.brothers.forEach(a => a.seedLastX(Number.NaN));
      this.outputList.setUndefined();
      return;
    }
    const xs = findRoots((x: number) => f.evaluateAt(x) - g.evaluateAt(x), this.lo, this.hi);
    const assignment = this.assignNearest(xs);
    assignment.forEach((x, slot) => {
      if (x === null) {
        this.brothers[slot].seedLastX(Number.NaN);
        this.points[slot].setUndefined();
      } else {
        this.brothers[slot].seedLastX(x);
        this.points[slot].setCoords(x, f.evaluateAt(x), 1);
        this.points[slot].setDefined();
      }
    });
    this.outputList.setChildren(
      assignment
        .map((x, slot) => ({ x, slot }))
        .filter(({ x }) => x !== null)
        .map(({ slot }) => this.points[slot]),
    );
    this.outputList.setDefined();
  }

  private assignNearest(xs: number[]): (number | null)[] {
    const result: (number | null)[] = new Array(this.points.length).fill(null);
    const used = new Set<number>();
    const pairs: { slot: number; xi: number; dist: number }[] = [];
    this.points.forEach((pt, slot) => {
      if (!pt.isDefined()) return;
      xs.forEach((x, xi) => pairs.push({ slot, xi, dist: Math.abs(pt.getX() - x) }));
    });
    pairs.sort((a, b) => a.dist - b.dist);
    const takenSlot = new Set<number>();
    for (const { slot, xi } of pairs) {
      if (takenSlot.has(slot) || used.has(xi)) continue;
      result[slot] = xs[xi];
      used.add(xi);
      takenSlot.add(slot);
    }
    xs.forEach((x, xi) => {
      if (used.has(xi)) return;
      const free = result.indexOf(null);
      if (free < 0) return;
      result[free] = x;
      used.add(xi);
    });
    return result;
  }
}
