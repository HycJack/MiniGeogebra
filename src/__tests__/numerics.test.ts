import { describe, expect, it } from 'vitest';
import {
  bisect,
  findExtrema,
  findRoots,
  integrate,
} from '../kernel/algebra/Numerics';

const near = (value: number, expected: number, digits = 8) => expect(value).toBeCloseTo(expected, digits);

describe('bisect', () => {
  it('finds the root of a sign change', () => {
    expect(bisect(x => x * x - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 10);
  });

  it('returns the endpoint when it is already a root', () => {
    expect(bisect(x => x - 3, 3, 5)).toBe(3);
    expect(bisect(x => x - 3, 1, 3)).toBe(3);
  });

  it('returns null when there is no sign change', () => {
    expect(bisect(x => x * x + 1, 0, 5)).toBeNull();
  });

  it('returns null when the function is undefined in the interval', () => {
    expect(bisect(x => (x > 0 ? 1 : NaN), -1, 1)).toBeNull();
  });
});

describe('findRoots', () => {
  it('finds all roots of a polynomial in the range', () => {
    // x³ - 6x² + 11x - 6 = (x-1)(x-2)(x-3)
    const roots = findRoots(x => x * x * x - 6 * x * x + 11 * x - 6, 0, 4);
    expect(roots).toHaveLength(3);
    roots.forEach((root, index) => near(root, [1, 2, 3][index], 6));
  });

  it('does not invent a root across an undefined gap', () => {
    // 1/(x-2) 在 x=2 无定义；两个分支没有根，也不应被连成一个假根
    const roots = findRoots(x => 1 / (x - 2), 0, 4);
    expect(roots).toEqual([]);
  });

  it('reports roots that lie exactly on a sample point', () => {
    const roots = findRoots(x => x, 0, 1);
    expect(roots).toContainEqual(0);
  });

  it('rejects degenerate ranges', () => {
    expect(findRoots(x => x, 5, 5)).toEqual([]);
    expect(findRoots(x => x, 5, 1)).toEqual([]);
    expect(findRoots(x => x, Number.NaN, 5)).toEqual([]);
    expect(findRoots(x => x, 0, 5, 1)).toEqual([]);
  });

  it('finds tightly spaced roots when given enough samples', () => {
    // (x-1.0)(x-1.001)(x-1.002)
    const roots = findRoots(
      x => (x - 1.0) * (x - 1.001) * (x - 1.002),
      0.9,
      1.1,
      4096,
    );
    expect(roots).toHaveLength(3);
  });
});

describe('findExtrema', () => {
  it('finds the vertex of a parabola', () => {
    const hits = findExtrema(
      x => x * x - 4 * x + 3,
      x => 2 * x - 4,
      0,
      4,
    );
    expect(hits).toHaveLength(1);
    near(hits[0].x, 2, 6);
    near(hits[0].y, -1, 6);
    expect(hits[0].kind).toBe('min');
  });

  it('classifies maxima and minima of a cubic', () => {
    // x³ - 3x  → 导数 3x² - 3，在 x=±1 有极值
    const hits = findExtrema(x => x * x * x - 3 * x, x => 3 * x * x - 3, -3, 3);
    expect(hits).toHaveLength(2);
    near(hits[0].x, -1, 6);
    expect(hits[0].kind).toBe('max');
    near(hits[1].x, 1, 6);
    expect(hits[1].kind).toBe('min');
  });

  it('marks a cusp where the derivative jumps but the function is continuous', () => {
    // |x|：导数从 -1 跳到 +1，最小值在 x=0
    const hits = findExtrema(x => Math.abs(x), x => (x >= 0 ? 1 : -1), -1, 1);
    expect(hits).toHaveLength(1);
    near(hits[0].x, 0, 4);
    near(hits[0].y, 0, 6);
    expect(hits[0].kind).toBe('min');
  });

  it('finds no extremum on a monotone function', () => {
    expect(findExtrema(x => x * x * x, x => 3 * x * x, -2, 2)).toEqual([]);
  });

  it('skips extrema where the function itself is undefined', () => {
    // 1/x 的导数 -1/x² 恒负，无极值；不应因为穿过 NaN 而报出假极值
    expect(findExtrema(x => 1 / x, x => -1 / (x * x), -3, 3)).toEqual([]);
  });

  it('de-duplicates adjacent detections of the same extremum', () => {
    // sin(x) 在 [-π, π] 上：x=-π/2 极小，x=π/2 极大
    const hits = findExtrema(
      x => Math.sin(x),
      x => Math.cos(x),
      -Math.PI,
      Math.PI,
      2048,
    );
    expect(hits).toHaveLength(2);
    expect(hits.map(hit => hit.kind)).toEqual(['min', 'max']);
    near(hits[0].x, -Math.PI / 2, 4);
    near(hits[1].x, Math.PI / 2, 4);
  });
});

describe('integrate', () => {
  it('integrates a polynomial exactly', () => {
    // ∫[0,1] 3x² dx = 1
    const result = integrate(x => 3 * x * x, 0, 1);
    near(result.value, 1, 6);
    expect(result.converged).toBe(true);
  });

  it('integrates transcendental functions', () => {
    // ∫[0,1] sin(x) dx = 1 - cos(1)
    near(integrate(x => Math.sin(x), 0, 1).value, 1 - Math.cos(1), 6);
    // ∫[1,2] 1/x dx = ln 2
    near(integrate(x => 1 / x, 1, 2).value, Math.LN2, 6);
    // ∫[0,∞)-近似 exp(-x) on [0,10] = 1 - e⁻¹⁰
    near(integrate(x => Math.exp(-x), 0, 10).value, 1 - Math.exp(-10), 4);
  });

  it('flips the sign when the bounds are reversed', () => {
    const forward = integrate(x => x, 0, 2).value;
    const backward = integrate(x => x, 2, 0).value;
    near(forward, 2, 8);
    near(backward, -2, 8);
  });

  it('returns zero for a degenerate interval', () => {
    expect(integrate(x => x * x, 3, 3).value).toBe(0);
  });

  it('reports a non-integrable endpoint as divergent (GeoGebra-aligned)', () => {
    // 1/x 在 0 处发散（p=1）：对标 GeoGebra 应返回未定义，
    // 而不是把区间收缩到探测点后给出伪收敛值（旧行为 ln 512）
    const result = integrate(x => 1 / x, 0, 2);
    expect(Number.isFinite(result.value)).toBe(false);
    expect(result.converged).toBe(false);
  });

  it('reports an interior 1/x singularity as divergent', () => {
    // 1/(x-1) 在 x=1 两侧都发散（p=1）；柯西主值不是数值积分的语义
    const result = integrate(x => 1 / (x - 1), 0, 2);
    expect(Number.isFinite(result.value)).toBe(false);
  });

  it('reports |1/(x-1)| as divergent', () => {
    // |1/(x-1)| 两侧发散为正（p=1）→ 未定义
    const result = integrate(x => Math.abs(1 / (x - 1)), 0, 2);
    expect(Number.isFinite(result.value)).toBe(false);
  });

  it('still integrates integrable endpoint singularities', () => {
    // 1/√x 的 p=0.5、ln|x| 的 p≈0：可积奇点照常积分，不被误判发散
    //（截断误差 ~2√step ≈ 0.09 / ~step·|ln step| ≈ 0.014，容差取 0.5）
    near(integrate(x => 1 / Math.sqrt(x), 0, 1).value, 2, 0);
    near(integrate(x => Math.log(x), 0, 1).value, -1, 0);
  });

  it('rejects non-finite bounds', () => {
    expect(integrate(x => x, Number.NaN, 1).value).toBeNaN();
    expect(integrate(x => x, 0, Infinity).value).toBeNaN();
  });

  it('reports the subdivision count as a cost indicator', () => {
    const easy = integrate(x => x, 0, 1);
    const hard = integrate(x => Math.sin(x * 50), 0, 1);
    expect(hard.subdivisions).toBeGreaterThan(easy.subdivisions);
    expect(easy.subdivisions).toBeGreaterThan(0);
  });
});
