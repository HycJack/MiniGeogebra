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
      roots.push(x);
    } else if (prevY === 0) {
      // 已在上一轮记录过
    } else if (prevY * y < 0) {
      const root = bisect(f, prevX, x);
      if (root !== null) roots.push(root);
    }

    prevX = x;
    prevY = y;
  }

  if (Number.isFinite(f(maxX)) && f(maxX) === 0 && roots[roots.length - 1] !== maxX) {
    roots.push(maxX);
  }

  return roots.sort((a, b) => a - b);
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
 * 用导函数的符号变化定位候选点，再二分精化，最后按两侧函数值判定极值类型。
 * `fPrime` 与 `f` 无定义的位置会被跳过。
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

  hits.sort((a, b) => a.x - b.x);
  // 去重：同一极值可能被相邻采样区间重复发现
  return hits.filter((hit, index, all) =>
    index === 0 || Math.abs(hit.x - all[index - 1].x) > (maxX - minX) / samples);
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

  // 先扫描出函数值连续有限的所有子区间，奇点（含端点奇点）自然成为分段边界。
  // 这比“只在递归中点碰到 NaN 才切”可靠：奇点不必恰好落在某个中点上。
  const segments = finiteSegments(f, lo, hi);
  if (segments.length === 0) return { value: NaN, subdivisions: 0, converged: false };

  let value = 0;
  for (const segment of segments) {
    value += adaptiveSimpson(f, segment.a, segment.b, tolerance, 0, state);
  }

  return { value: sign * value, subdivisions: state.subdivisions, converged: state.converged };
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
