/**
 * 数值分析原语 —— 求根、极值、定积分。
 *
 * 全部是纯函数，输入只有一元实函数（或函数 + 导函数），不接触 kernel / 几何对象，
 * 便于单元测试，也便于代数命令层（Root / Extremum / Integral）复用。
 *
 * 约定：
 *   - 被积/被求函数返回 NaN 表示该点无定义；算法会在无定义处停止而非跨越它；
 *   - 所有搜索都在闭区间 `[minX, maxX]` 内进行。
 */

export interface RootHit {
  /** 根所在的 x 值 */
  x: number;
}

export interface ExtremumHit {
  x: number;
  y: number;
  /** 'max' = 极大值，'min' = 极小值，'cusp' = 不可导的尖点（如 |x| 的顶点） */
  kind: 'max' | 'min' | 'cusp';
}

export interface IntegrationResult {
  /** 定积分数值 */
  value: number;
  /** 自适应辛普森用到的小区间总数（复杂度指标） */
  subdivisions: number;
  /** 是否达到容差（false 表示触及最大递归深度） */
  converged: boolean;
}

/** 二分法默认迭代次数（收敛到约 1e-15 的相对精度）。 */
const BISECTION_ITERATIONS = 80;

/** 自适应辛普森的最大递归深度。 */
const MAX_QUAD_DEPTH = 30;

/**
 * 在 `[minX, maxX]` 上求 `f(x) = 0` 的所有根。
 *
 * 做法：先均匀采样扫描符号变化，再对每个候选区间做二分细化。
 * 采样点数越多越不易漏掉窄峰之间的根。
 *
 * 注意：无定义处（NaN）会打断符号扫描，因此不会把两个不连通的分支
 * 误连成一个假根。
 */
export function findRoots(
  f: (x: number) => number,
  minX: number,
  maxX: number,
  samples = 1024,
): number[] {
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX < minX || samples < 2) return [];
  if (minX === maxX) {
    return Number.isFinite(f(minX)) && f(minX) === 0 ? [minX] : [];
  }

  const roots: number[] = [];
  const step = (maxX - minX) / (samples - 1);

  let prevX = minX;
  let prevY = f(minX);
  if (Number.isFinite(prevY) && prevY === 0) roots.push(prevX);

  for (let i = 1; i < samples; i++) {
    const x = minX + step * i;
    const y = f(x);

    if (!Number.isFinite(prevY) || !Number.isFinite(y)) {
      prevX = x;
      prevY = y;
      continue;
    }

    if (y === 0) {
      // 只在零游程的起点记录一次（f ≡ 0 时相邻样本全为零，不能重复记根）
      if (prevY !== 0) roots.push(x);
    } else if (prevY === 0) {
      // 零游程结束
    } else if (prevY * y < 0) {
      const root = bisect(f, prevX, x);
      if (root !== null) roots.push(root);
    } else {
      // 相切重根（极值触零、无变号）：该段内 |f| 的极小值与二次触零量级匹配
      // （≈ C·step²，C 为 |f''| 量级）→ 三分搜索求 |f| 极小，足够小则记切根。
      // Intersect(f,g) 的相切交点（如 x² 与 0）此前静默丢失。
      if (prevY * y > 0) {
        // 段内可能有极值触零（无变号重根）。两种进入条件：
        //   a) 线性外推零点落在段内（常规鼓包）；b) 两端几乎相等（平坦段，
        //      对称函数在极值点两侧的对称采样恰好同值——外推除零会失败）
        const flat = Math.abs(y - prevY) < 1e-15 * Math.max(1, Math.abs(y), Math.abs(prevY));
        const xm = flat ? (prevX + x) / 2 : prevX - (step * prevY) / (y - prevY);
        if ((flat || (xm > prevX && xm < x)) && Math.min(Math.abs(prevY), Math.abs(y)) < Math.max(1e-6, 100 * step)) {
          let lo = prevX, hi = x;
          for (let k = 0; k < 60; k++) {
            const m1 = lo + (hi - lo) / 3;
            const m2 = hi - (hi - lo) / 3;
            if (Math.abs(f(m1)) < Math.abs(f(m2))) hi = m2; else lo = m1;
          }
          const cand = (lo + hi) / 2;
          const fmin = Math.abs(f(cand));
          // 触零判据：|f|(极小) 远小于段端（真极值凹陷）且绝对量级 < O(step²)（真触零，
          // 如 x² 的极小 ≈ (step/2)²·|f''|；远离触零的普通极小值（(x−1)²+0.01）不满足）
          if (fmin < Math.min(Math.abs(prevY), Math.abs(y)) * 1e-3
              && fmin < 1000 * step * step) {
            if (!roots.some(r => Math.abs(r - cand) < step)) roots.push(cand);
          }
        }
      }
    }

    prevX = x;
    prevY = y;
  }

  // 终点恰为零，且不属于已在起点记录过的零游程
  if (Number.isFinite(f(maxX)) && f(maxX) === 0 && prevY !== 0) {
    roots.push(maxX);
  }

  // 兜底去重（浮点采样可能产生极近的重复根）
  return dedupeSorted(roots.sort((a, b) => a - b), (maxX - minX) / Math.max(1, samples - 1));
}

/** 移除排序数组中彼此距离小于 `minGap` 的重复项。 */
function dedupeSorted(sorted: number[], minGap: number): number[] {
  return sorted.filter((v, i, all) =>
    i === 0 || Math.abs(v - all[i - 1]) > Math.max(minGap, 1e-12 * Math.max(1, Math.abs(v))));
}

/** 二分法求根；f(lo)、f(hi) 必须异号（或其中一个为 0）。无解返回 null。 */
export function bisect(f: (x: number) => number, lo: number, hi: number): number | null {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);

  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) return null;

  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (!Number.isFinite(fm)) return null;
    if (fm === 0 || (b - a) < 1e-15 * Math.max(1, Math.abs(mid))) return mid;
    if (fa * fm < 0) {
      b = mid;
      fb = fm;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/**
 * 在 `[minX, maxX]` 上求 `f` 的局部极值。
 *
 * 双通道定位（对标 GeoGebra：多项式走导数根 + 符号过滤，一般函数走
 * AlgoExtremumMulti 的函数值采样）：
 *   1. **导数通道** —— f′ 符号变化定位候选，二分精化，按两侧函数值判定类型；
 *   2. **函数值通道** —— 网格扫描局部极大/极小，黄金分割精化。导数在尖点
 *      （如 |x| 的顶点）为 NaN 时通道 1 全盲，通道 2 仍然命中。
 * 两通道结果合并去重。
 */
export function findExtrema(
  f: (x: number) => number,
  fPrime: (x: number) => number,
  minX: number,
  maxX: number,
  samples = 1024,
): ExtremumHit[] {
  const hits: ExtremumHit[] = [];
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX < minX || samples < 2) return hits;
  if (minX === maxX) return hits;

  const step = (maxX - minX) / (samples - 1);
  let prevX = minX;
  let prevD = fPrime(minX);

  for (let i = 1; i < samples; i++) {
    const x = minX + step * i;
    const d = fPrime(x);

    if (Number.isFinite(prevD) && Number.isFinite(d)) {
      let candidate: number | null = null;
      if (prevD === 0) candidate = prevX;
      else if (d === 0) candidate = x;
      else if (prevD * d < 0) candidate = bisect(fPrime, prevX, x);

      if (candidate !== null) {
        const y = f(candidate);
        if (Number.isFinite(y)) {
          const hit = classifyExtremum(f, candidate);
          if (hit) hits.push({ x: candidate, y, kind: hit });
        }
      }
    }

    prevX = x;
    prevD = d;
  }

  hits.push(...findExtremaByValue(f, fPrime, minX, maxX, samples));
  hits.sort((a, b) => a.x - b.x);
  // 去重：同一极值可能被两个通道/相邻采样区间重复发现
  return hits.filter((hit, index, all) =>
    index === 0 || Math.abs(hit.x - all[index - 1].x) > (maxX - minX) / samples);
}

/**
 * 函数值扫描通道：网格上找"不低于两侧邻居"的局部极大/极小，
 * 再在邻居区间内做黄金分割精化。对标 AlgoExtremumMulti.findExtremums
 * 的函数值梯度扫描——对尖点与导数 NaN 处鲁棒。
 */
function findExtremaByValue(
  f: (x: number) => number,
  fPrime: (x: number) => number,
  minX: number,
  maxX: number,
  samples: number,
): ExtremumHit[] {
  const hits: ExtremumHit[] = [];
  const step = (maxX - minX) / (samples - 1);

  const ys: number[] = new Array(samples);
  for (let i = 0; i < samples; i++) ys[i] = f(minX + step * i);

  for (let i = 1; i < samples - 1; i++) {
    const y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
    if (![y0, y1, y2].every(Number.isFinite)) continue;
    const wantMax = y1 >= y0 && y1 > y2;
    const wantMin = y1 <= y0 && y1 < y2;
    if (!wantMax && !wantMin) continue;

    const xa = minX + step * (i - 1);
    const xb = minX + step * (i + 1);
    const x = refineUnimodal(f, xa, xb, wantMax);
    const y = f(x);
    if (!Number.isFinite(y)) continue;
    // 导数符号校验（对标 AlgoExtremumMulti 的 gradientChangesSign）：
    // 极大要求导数 + → −，极小要求 − → +。两侧导数同号说明是奇点旁的
    // 伪极值（如 1/x 在 0 左侧网格上的"局部最小"），拒绝。
    // 导数不可得（NaN，尖点）时不拒绝——这正是本通道存在的意义。
    const h = 1e-6 * Math.max(1, Math.abs(x));
    const dL = fPrime(x - h);
    const dR = fPrime(x + h);
    if (Number.isFinite(dL) && Number.isFinite(dR)) {
      if (wantMax && !(dL > 0 && dR < 0)) continue;
      if (!wantMax && !(dL < 0 && dR > 0)) continue;
    }
    const hit = classifyExtremum(f, x);
    // 通道 1 已按导数符号正确分类光滑极值；这里只补它漏掉的（尖点/NaN 导数）。
    // 与导数通道重复的候选经外层按 x 去重合并，kind 以先到者为准。
    if (hit) hits.push({ x, y, kind: hit });
  }
  return hits;
}

/** 黄金分割搜索 [a, b] 内的局部极大（wantMax=false 时求极小）。要求区间内单峰。 */
function refineUnimodal(
  f: (x: number) => number,
  a: number,
  b: number,
  wantMax: boolean,
): number {
  const gr = (Math.sqrt(5) - 1) / 2;
  let lo = a, hi = b;
  let c = hi - gr * (hi - lo);
  let d = lo + gr * (hi - lo);
  let fc = f(c), fd = f(d);
  for (let i = 0; i < 60; i++) {
    if (hi - lo < 1e-12 * Math.max(1, Math.abs(lo), Math.abs(hi))) break;
    const better = wantMax ? fc > fd : fc < fd;
    if (better) {
      hi = d; d = c; fd = fc;
      c = hi - gr * (hi - lo); fc = f(c);
    } else {
      lo = c; c = d; fc = fd;
      d = lo + gr * (hi - lo); fd = f(d);
    }
  }
  return (lo + hi) / 2;
}

/** 用一侧邻域比较判定极值类型；尖点（左右导数符号相反但函数不可导）单独标记。 */
function classifyExtremum(f: (x: number) => number, x: number): 'max' | 'min' | 'cusp' | null {
  const h = 1e-6 * Math.max(1, Math.abs(x));
  const y = f(x);
  const yLeft = f(x - h);
  const yRight = f(x + h);
  if (![y, yLeft, yRight].every(Number.isFinite)) return null;

  if (y >= yLeft && y >= yRight) {
    if (y === yLeft && y === yRight) return null;
    return 'max';
  }
  if (y <= yLeft && y <= yRight) {
    if (y === yLeft && y === yRight) return null;
    return 'min';
  }
  // 非极大也非极小：通常是尖点（如 |x| 在 0 处，导数从负跳正但函数值连续）
  if (y <= Math.max(yLeft, yRight) + 1e-9 && y >= Math.min(yLeft, yRight) - 1e-9) {
    return 'cusp';
  }
  return null;
}

/**
 * 自适应辛普森积分 `∫[a,b] f(x) dx`。
 *
 * 每层把区间二等分，若 `|16*S(h/2) - S(h)|` 小于 `15*tolerance` 就接受，
 * 否则递归细化。触及最大深度时返回当前最佳估计并标记未收敛。
 * 遇到 NaN（无定义点）时按分段积分处理。
 */
export function integrate(
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance = 1e-10,
): IntegrationResult {
  const state = { subdivisions: 0, converged: true };
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { value: NaN, subdivisions: 0, converged: false };
  if (a === b) return { value: 0, subdivisions: 0, converged: true };

  // 统一按升序积分，最后按原方向补回符号
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const sign = a < b ? 1 : -1;

  // 容差随区间长度缩放：绝对容差在大区间（如 [0, 1e6]）上永远达不到，
  // 每个子区间都会递归到最大深度白算。
  const scaledTolerance = tolerance * Math.max(1, hi - lo);

  // 先扫描出函数值连续有限的所有子区间，奇点（含端点奇点）自然成为分段边界。
  // 这比“只在递归中点碰到 NaN 才切”可靠：奇点不必恰好落在某个中点上。
  const probeStep = (hi - lo) / 512;
  const segments = finiteSegments(f, lo, hi);
  if (segments.length === 0) return { value: NaN, subdivisions: 0, converged: false };

  // 发散检测（对标 GeoGebra：奇点使求积失败 → 未定义，而不是静默给出
  // "截断到有限采样点"的伪收敛值）。分段边界外侧相邻的探测点就是奇点
  // （距段边缘恰好一个探测步长），从它起算幂律阶梯估计奇点指数 p：
  // |f| ~ d^-p 且 p ≥ 1 视为发散。
  for (const segment of segments) {
    if (segment.a > lo && divergentAtEdge(f, segment.a, -1, probeStep)) {
      return { value: NaN, subdivisions: state.subdivisions, converged: false };
    }
    if (segment.b < hi && divergentAtEdge(f, segment.b, 1, probeStep)) {
      return { value: NaN, subdivisions: state.subdivisions, converged: false };
    }
  }

  let value = 0;
  for (const segment of segments) {
    value += adaptiveSimpson(f, segment.a, segment.b, scaledTolerance, 0, state);
  }

  return { value: sign * value, subdivisions: state.subdivisions, converged: state.converged };
}

/**
 * 判断段边缘外侧相邻的奇点是否使积分发散。
 *
 * 奇点位于段边缘外一个探测步长处（finiteSegments 的相邻探测点就是非有限点）。
 * 从奇点向段内取距离阶梯 u_k = step·2^-k（采样点 x_k = edge + dir·step·(1−2^-k)），
 * |f| ~ C·u^-p 时相邻两级之比为 2^p：p 的均值 ≥ 0.95 判发散。
 *
 * 可积奇点不会误报：1/√x 的 p=0.5、ln|x| 的 p≈0、有界跳跃/孤立无定义点的 p=0。
 */
function divergentAtEdge(
  f: (x: number) => number,
  edge: number,
  dir: number,
  step: number,
): boolean {
  if (!(step > 0)) return false;
  const vals: number[] = [];
  for (let k = 1; k <= 8; k++) {
    const x = edge + dir * step * (1 - Math.pow(2, -k));
    const y = f(x);
    if (!Number.isFinite(y)) return false; // 采样落在段外非有限处，交给分段逻辑
    vals.push(Math.abs(y));
  }
  const ps: number[] = [];
  for (let k = 0; k + 1 < vals.length; k++) {
    if (!(vals[k] > 0) || !(vals[k + 1] > 0)) continue;
    // 距奇点的距离每次减半，|f| 应增到 2^p 倍
    const p = Math.log2(vals[k + 1] / vals[k]);
    if (Number.isFinite(p)) ps.push(p);
  }
  if (ps.length < 3) return false;
  const mean = ps.reduce((sum, v) => sum + v, 0) / ps.length;
  return mean >= 0.95;
}

/** 扫描 `[lo, hi]`，返回函数值连续有限的所有子区间（边界收缩到探测网格上）。 */
function finiteSegments(
  f: (x: number) => number,
  lo: number,
  hi: number,
  probes = 512,
): { a: number; b: number }[] {
  const step = (hi - lo) / probes;
  const segments: { a: number; b: number }[] = [];
  let start = -1;

  for (let i = 0; i <= probes; i++) {
    const x = lo + step * i;
    if (Number.isFinite(f(x))) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      segments.push({ a: lo + step * start, b: lo + step * (i - 1) });
      start = -1;
    }
  }
  if (start !== -1) segments.push({ a: lo + step * start, b: hi });
  return segments;
}

/** 把自适应辛普森的数值结果包装成 IntegrationResult。 */
function finish(value: number, state: { subdivisions: number; converged: boolean }): IntegrationResult {
  return { value, subdivisions: state.subdivisions, converged: state.converged };
}

function adaptiveSimpson(
  f: (x: number) => number,
  a: number,
  b: number,
  tolerance: number,
  depth: number,
  state: { subdivisions: number; converged: boolean },
): number {
  state.subdivisions++;

  const fa = f(a);
  const fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
    // 子区间内存在无定义点：切一刀，分别积分两段
    const cut = findFiniteMidpoint(f, a, b);
    if (cut === null) return 0;
    return adaptiveSimpson(f, a, cut, tolerance, depth + 1, state)
      + adaptiveSimpson(f, cut, b, tolerance, depth + 1, state);
  }

  if (depth >= MAX_QUAD_DEPTH) {
    state.converged = false;
    return simpson(f, a, b, fa, fb);
  }

  const mid = (a + b) / 2;
  const fm = f(mid);
  if (!Number.isFinite(fm)) {
    const cut = findFiniteMidpoint(f, a, b);
    if (cut === null) return 0;
    return adaptiveSimpson(f, a, cut, tolerance, depth + 1, state)
      + adaptiveSimpson(f, cut, b, tolerance, depth + 1, state);
  }

  const whole = simpson(f, a, b, fa, fb);
  const left = simpson(f, a, mid, fa, fm);
  const right = simpson(f, mid, b, fm, fb);

  if (Math.abs(left + right - whole) <= 15 * tolerance) return left + right;

  const halfTolerance = tolerance / 2;
  return adaptiveSimpson(f, a, mid, halfTolerance, depth + 1, state)
    + adaptiveSimpson(f, mid, b, halfTolerance, depth + 1, state);
}

/** 复合辛普森单段公式。 */
function simpson(f: (x: number) => number, a: number, b: number, fa: number, fb: number): number {
  const mid = (a + b) / 2;
  const fm = f(mid);
  if (!Number.isFinite(fm)) return NaN;
  return (b - a) * (fa + 4 * fm + fb) / 6;
}

/** 在 (a, b) 内找一个函数值有限的位置，用于绕开无定义点。 */
function findFiniteMidpoint(f: (x: number) => number, a: number, b: number): number | null {
  for (let i = 1; i < 64; i++) {
    const x = a + (b - a) * i / 64;
    if (Number.isFinite(f(x))) return x;
  }
  return null;
}
