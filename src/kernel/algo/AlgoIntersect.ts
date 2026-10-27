import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoConic } from '../geo/GeoConic';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoPolyLine } from '../geo/GeoPolyLine';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoArc, angleInArcWindow } from '../geo/GeoArc';
import { GeoConicPart } from '../geo/GeoConicPart';
import { intersectLineWithConic, intersectConicConic } from '../geo/conicSolve';

interface Solution { x: number; y: number }

/** 多边形（闭合）与折线（开放）统一按边序列处理。 */
type PolyLike = GeoPolygon | GeoPolyLine;

const asPolyLike = (el: GeoElement): PolyLike | null => {
  if (el instanceof GeoPolygon || el instanceof GeoPolyLine) return el;
  return null;
};

/** 边数：多边形闭合 n 条边；折线 n−1 条。 */
const edgeCount = (poly: PolyLike): number =>
  poly instanceof GeoPolygon ? poly.vertices.length : Math.max(0, poly.vertices.length - 1);

export class AlgoIntersect extends AlgoElement {
  private outputPoints: GeoPoint[] = [];

  // ---- 标签置换记忆（对标 GeoGebra AlgoIntersectAbstract）----
  // lastPositions/age 在输出 undefined 期间也保留（GGB 的 D[]/age），
  // 交点经过 undefined 区间后标签匹配不会失忆；perm 持久保存上次置换。
  private lastPositions: (Solution | null)[] = [];
  private undefinedAge: number[] = [];
  private perm: number[] = [];

  constructor(
    kernel: IKernel,
    private obj1: GeoElement,
    private obj2: GeoElement,
    private pointIndex?: number, // Intersect(f, g, index)：只输出第 index 个交点（1-based，官方语义）
  ) {
    super(kernel);
    // Determine max number of intersection points
    let count = 0;
    const poly1 = asPolyLike(obj1);
    const poly2 = asPolyLike(obj2);
    if (obj1 instanceof GeoLine && obj2 instanceof GeoLine) count = 1;
    else if (obj1 instanceof GeoLine && obj2 instanceof GeoConic) count = 2;
    else if (obj1 instanceof GeoConic && obj2 instanceof GeoLine) count = 2;
    else if (obj1 instanceof GeoConic && obj2 instanceof GeoConic) count = 4;
    // 多边形/折线 × 圆锥曲线：每条边至多 2 个交点（对标 GGB AlgoIntersectPolyLineConic）
    else if (poly1 && obj2 instanceof GeoConic) count = 2 * edgeCount(poly1);
    else if (obj1 instanceof GeoConic && poly2) count = 2 * edgeCount(poly2);

    // 指定 index 时只创建单点输出（此前 Intersect(f,g,index) 因 arity [2,2] 不可达）
    if (pointIndex !== undefined) count = 1;

    const usedLabels = new Set<string>();
    for (let i = 0; i < count; i++) {
      const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
      const label = kernel.getConstruction().getNextPointLabel(usedLabels);
      usedLabels.add(label);
      p.label = label;
      this.outputPoints.push(p);
    }

    this.lastPositions = new Array(count).fill(null);
    this.undefinedAge = new Array(count).fill(0);
    this.perm = new Array(count).fill(-1);

    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.obj1, this.obj2];
    this.setOutput(this.outputPoints);
  }

  compute(): void {
    // Reset points to undefined initially
    this.outputPoints.forEach(p => p.setUndefined());

    if (!this.obj1.isDefined() || !this.obj2.isDefined()) {
      this.bumpAges();
      return;
    }

    let solutions: Solution[] = [];
    const poly1 = asPolyLike(this.obj1);
    const poly2 = asPolyLike(this.obj2);
    if (this.obj1 instanceof GeoLine && this.obj2 instanceof GeoLine) {
      solutions = this.solveLineLine(this.obj1, this.obj2);
    } else if (this.obj1 instanceof GeoLine && this.obj2 instanceof GeoConic) {
      solutions = this.solveLineConic(this.obj1, this.obj2);
    } else if (this.obj1 instanceof GeoConic && this.obj2 instanceof GeoLine) {
      solutions = this.solveLineConic(this.obj2, this.obj1);
    } else if (this.obj1 instanceof GeoConic && this.obj2 instanceof GeoConic) {
      solutions = intersectConicConic(this.obj1.coeffs, this.obj2.coeffs);
    } else if (poly1 && this.obj2 instanceof GeoConic) {
      solutions = this.solvePolyConic(poly1, this.obj2);
    } else if (this.obj1 instanceof GeoConic && poly2) {
      solutions = this.solvePolyConic(poly2, this.obj1);
    }

    // 弧/扇形（GeoArc / GeoConicPart extends GeoConic）按整圆求解后，
    // 必须再按角窗过滤（对标官方 allowOutlyingIntersections=false）——
    // 此前半圆与直线的交点会落在未画出的另一半上。
    solutions = this.filterArcWindow(solutions);

    // 指定 index：直接取第 index 个解（1-based），不做标签置换匹配
    if (this.pointIndex !== undefined) {
      const idx = this.pointIndex - 1;
      const pt = idx >= 0 && idx < solutions.length ? solutions[idx] : null;
      if (pt && this.outputPoints[0]) {
        this.outputPoints[0].setCoords(pt.x, pt.y, 1);
        this.outputPoints[0].setDefined();
      }
      return;
    }

    // 标签连续性（对标 GeoGebra AlgoIntersectAbstract 的置换机制）：
    // 拖动曲线时解本身在动，若始终按 x 排序写入输出点，两个交点会互换标签。
    const assigned = this.matchToPrevious(solutions);

    assigned.forEach((pt, i) => {
      if (i >= this.outputPoints.length || !pt) return;
      const p = this.outputPoints[i];
      p.setCoords(pt.x, pt.y, 1);
      p.setDefined();
    });

    this.updateMemory(assigned);
  }

  /** 输出全 undefined 时各槽位年龄 +1，位置记忆保留。 */
  private bumpAges(): void {
    this.undefinedAge = this.undefinedAge.map(age => age + 1);
  }

  /** 计算后更新位置/年龄/置换记忆。 */
  private updateMemory(assigned: (Solution | null)[]): void {
    this.lastPositions = this.outputPoints.map((p, i) => {
      if (assigned[i]) return { x: p.getX(), y: p.getY() };
      return this.lastPositions[i]; // undefined 槽位保留旧位置记忆
    });
    this.undefinedAge = this.outputPoints.map((_, i) => (assigned[i] ? 0 : this.undefinedAge[i] + 1));
    this.perm = assigned.map(pt => (pt ? this.lastSolutionIndex.get(pt) ?? -1 : -1));
  }

  /** 本次分配中 solution 对象 → 原始下标（用于持久化 perm）。 */
  private lastSolutionIndex = new Map<Solution, number>();

  /**
   * 把新解匹配到输出点上一次的位置，四层保护对标 GeoGebra setNearTo：
   *   1. **eps 冻结**：两个新解几乎重合（近切点拖动）时沿用上次置换，防抖动；
   *   2. **age 惩罚**：undefined 越久的槽位匹配代价越高（新解优先给"刚有效"的槽位）；
   *   3. **互最近确认**：槽位与解互为最近邻的配对优先分配；
   *   4. **持久记忆**：undefined 期间保留位置与 perm，恢复时不失忆。
   */
  private matchToPrevious(solutions: Solution[]): (Solution | null)[] {
    const n = this.outputPoints.length;
    const assigned: (Solution | null)[] = new Array(n).fill(null);
    this.lastSolutionIndex = new Map(solutions.map((s, i) => [s, i]));

    if (solutions.length === 0) return assigned;

    const eps = this.freezeEpsilon(solutions);
    const hasPrev = this.lastPositions.some(p => p !== null);

    // 1) eps 冻结：新解两两几乎重合 → 沿用上次置换（perm 中记录原始解下标）
    if (hasPrev && this.perm.some(i => i >= 0) && this.solutionsNearlyCoincident(solutions, eps)) {
      const used = new Set<number>();
      this.perm.forEach((solIdx, slot) => {
        if (slot < n && solIdx >= 0 && solIdx < solutions.length && !used.has(solIdx)) {
          assigned[slot] = solutions[solIdx];
          used.add(solIdx);
        }
      });
      // 置换没覆盖到的解按顺序填空槽
      let cursor = 0;
      for (let slot = 0; slot < n; slot++) {
        if (assigned[slot]) continue;
        while (cursor < solutions.length && used.has(cursor)) cursor++;
        if (cursor >= solutions.length) break;
        assigned[slot] = solutions[cursor];
        used.add(cursor);
        cursor++;
      }
      return assigned;
    }

    if (!hasPrev) {
      // 首次计算：自然顺序
      solutions.forEach((s, i) => { if (i < n) assigned[i] = s; });
      return assigned;
    }

    // 2)+3) 代价表 = 距离 + age 惩罚；互最近对优先，其余贪心
    const cost = (slot: number, solIdx: number): number => {
      const prev = this.lastPositions[slot]!;
      const base = Math.hypot(solutions[solIdx].x - prev.x, solutions[solIdx].y - prev.y);
      return base + this.undefinedAge[slot] * eps;
    };

    const taken = new Set<number>();
    // 互最近确认：slot 的最近解同时是该解的最近 slot
    const mutualPairs: { slot: number; sol: number; d: number }[] = [];
    for (let slot = 0; slot < n; slot++) {
      if (!this.lastPositions[slot]) continue;
      let best = -1, bestD = Infinity;
      for (let s = 0; s < solutions.length; s++) {
        const d = cost(slot, s);
        if (d < bestD) { bestD = d; best = s; }
      }
      if (best < 0) continue;
      // 该解的最近槽位是否也是本槽位
      let backBest = -1, backD = Infinity;
      for (let slot2 = 0; slot2 < n; slot2++) {
        if (!this.lastPositions[slot2]) continue;
        const d = cost(slot2, best);
        if (d < backD) { backD = d; backBest = slot2; }
      }
      if (backBest === slot) mutualPairs.push({ slot, sol: best, d: bestD });
    }
    mutualPairs.sort((a, b) => a.d - b.d);
    for (const pair of mutualPairs) {
      if (assigned[pair.slot] || taken.has(pair.sol)) continue;
      assigned[pair.slot] = solutions[pair.sol];
      taken.add(pair.sol);
    }
    // 剩余槽位：贪心取最小代价
    for (let slot = 0; slot < n; slot++) {
      if (assigned[slot] || !this.lastPositions[slot]) continue;
      let best = -1, bestD = Infinity;
      for (let s = 0; s < solutions.length; s++) {
        if (taken.has(s)) continue;
        const d = cost(slot, s);
        if (d < bestD) { bestD = d; best = s; }
      }
      if (best >= 0) { assigned[slot] = solutions[best]; taken.add(best); }
    }
    // 没匹配上的解按顺序填进剩余空槽
    let cursor = 0;
    for (let slot = 0; slot < n; slot++) {
      if (assigned[slot]) continue;
      while (cursor < solutions.length && taken.has(cursor)) cursor++;
      if (cursor >= solutions.length) break;
      assigned[slot] = solutions[cursor];
      taken.add(cursor);
      cursor++;
    }
    return assigned;
  }

  /** 新解两两间距是否全部小于 eps（近切点情形）。 */
  private solutionsNearlyCoincident(solutions: Solution[], eps: number): boolean {
    if (solutions.length < 2) return false;
    for (let i = 0; i < solutions.length; i++) {
      for (let j = i + 1; j < solutions.length; j++) {
        if (Math.hypot(solutions[i].x - solutions[j].x, solutions[i].y - solutions[j].y) > eps) {
          return false;
        }
      }
    }
    return true;
  }

  /** 冻结判定的 eps：与解的坐标量级成比例的世界距离。 */
  private freezeEpsilon(solutions: Solution[]): number {
    let mag = 1;
    for (const s of solutions) mag = Math.max(mag, Math.abs(s.x), Math.abs(s.y));
    return 1e-6 * mag;
  }

  /** 输入含弧/扇形时，过滤掉落在角窗外的解（整圆求解的越界交点）。 */
  private filterArcWindow(sols: Solution[]): Solution[] {
    const arcs: (GeoArc | GeoConicPart)[] = [];
    if (this.obj1 instanceof GeoArc || this.obj1 instanceof GeoConicPart) arcs.push(this.obj1);
    if (this.obj2 instanceof GeoArc || this.obj2 instanceof GeoConicPart) arcs.push(this.obj2);
    if (arcs.length === 0 || sols.length === 0) return sols;
    return sols.filter(s => arcs.every(arc => {
      const c = arc.getCenter();
      const r = arc.getRadius();
      // 解由代入消元得出，理论上在圆上；容差按半径相对放宽
      if (Math.abs(Math.hypot(s.x - c.x, s.y - c.y) - r) > 1e-6 * Math.max(1, r)) return false;
      const a = Math.atan2(s.y - c.y, s.x - c.x);
      return angleInArcWindow(a, arc.getStartAngle(), arc.getEndAngle(), arc.isCounterClockwise(), 1e-7);
    }));
  }

  private solveLineLine(l1: GeoLine, l2: GeoLine): Solution[] {    const det = l1.a * l2.b - l2.a * l1.b;
    const mag = Math.max(Math.abs(l1.a), Math.abs(l1.b), Math.abs(l2.a), Math.abs(l2.b), 1);
    if (Math.abs(det) < 1e-12 * mag * mag) return []; // 平行（相对容差）

    const x = (l1.b * l2.c - l2.b * l1.c) / det;
    const y = (l1.c * l2.a - l2.c * l1.a) / det;
    return [{ x, y }];
  }

  private solveLineConic(line: GeoLine, conic: GeoConic): Solution[] {
    // 直线-圆锥求交的代入消元下沉到 conicSolve.intersectLineWithConic，
    // 与 AlgoTangent 的切点弦求交共用同一份推导。
    const { a, b, c } = line;
    const roots = intersectLineWithConic(conic.coeffs, a, b, c);
    if (line.getClassName() !== 'GeoSegment') return roots;
    // 有界线段：先过滤出落在线段上的解，避免"定义了又立刻 undefined"打乱匹配
    return roots.filter(pt => {
      const probe = new GeoPoint(this.kernel, new GeoVec3D(pt.x, pt.y, 1));
      return (line as any).isOnPath(probe);
    });
  }

  /**
   * 多边形/折线 × 圆锥曲线（对标 GGB AlgoIntersectPolyLineConic）：
   * 逐边把边所在直线与圆锥曲线求交，再过滤出真正落在边上的交点。
   * 顶点恰好落在曲线上时相邻两边会报告同一点，按坐标近邻去重。
   */
  private solvePolyConic(poly: PolyLike, conic: GeoConic): Solution[] {
    const verts = poly.vertices;
    const n = verts.length;
    const closed = poly instanceof GeoPolygon;
    const segs = closed ? n : n - 1;
    if (segs < 1 || !conic.isDefined()) return [];

    const solutions: Solution[] = [];
    const dedupEps = this.polyDedupEps(verts);
    for (let i = 0; i < segs; i++) {
      const A = verts[i];
      const B = verts[(i + 1) % n];
      const ax = A.getX(), ay = A.getY();
      const bx = B.getX(), by = B.getY();
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-18) continue;
      // 过 A、B 的直线：b1·x − a1·y + c = 0 形式（与 GeoLine a,b,c 约定一致）
      const a1 = ay - by;
      const b1 = bx - ax;
      const c1 = -(a1 * ax + b1 * ay);
      const roots = intersectLineWithConic(conic.coeffs, a1, b1, c1);
      for (const pt of roots) {
        // 交点在边上的参数（0..1），留 1e-9 相对容差
        const s = ((pt.x - ax) * dx + (pt.y - ay) * dy) / len2;
        const tol = 1e-9;
        if (s < -tol || s > 1 + tol) continue;
        if (solutions.some(q => Math.hypot(q.x - pt.x, q.y - pt.y) < dedupEps)) continue;
        solutions.push({ x: pt.x, y: pt.y });
      }
    }
    return solutions;
  }

  /** 去重半径与坐标量级成比例（顶点落在曲线上时相邻边重复报告同一点）。 */
  private polyDedupEps(verts: GeoPoint[]): number {
    let mag = 1;
    for (const v of verts) mag = Math.max(mag, Math.abs(v.getX()), Math.abs(v.getY()));
    return 1e-6 * mag;
  }

  getOutputPoints(): GeoPoint[] {
    return this.outputPoints;
  }
}
