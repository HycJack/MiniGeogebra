/**
 * AlgoTangent —— 过定点作圆锥曲线切线。
 *
 * 验证方式刻意不用「数值求导」，而是用可手工验算的解析事实：
 *   1. 切点在曲线上（conicValue ≈ 0）；
 *   2. 切线过给定的 P；
 *   3. 切线与圆锥相切 ⟺ 代入消元后判别式 ≈ 0（相切的代数定义）。
 * 三条同时成立即证明确实是切线而非割线或随机线。
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoTangent } from '../kernel/algo/AlgoTangent';
import {
  conicValue, dualLine, intersectLineWithConic, isConicDegenerate,
} from '../kernel/geo/conicSolve';
import { makeKernel } from './helpers';

const EPS = 1e-6;

/** A x² + B x y + C y² + D x + E y + F = 0 */
const CIRCLE = [1, 0, 1, -4, 2, -4];          // (x-2)² + (y+1)² = 9，中心 (2,-1)，r=3
const CIRCLE_UNIT = [1, 0, 1, 0, 0, -1];       // x² + y² = 1
const ELLIPSE = [1 / 9, 0, 1 / 16, 0, 0, -1]; // x²/9 + y²/16 = 1
const HYPERBOLA = [1, 0, -1, 0, 0, -1];        // x² - y² = 1
const PARABOLA_RIGHT = [0, 0, 1, -4, 0, 0];    // y² = 4x
const PARABOLA_UP = [1, 0, 0, 0, -4, 0];       // x² = 4y
const ROTATED_ELLIPSE = [2, 1, 2, 0, 0, -1];   // x² + x y + y² = 1（B≠0）

/** 直线 a x + b y + c = 0 与圆锥 a' x² + b' x y + c' y² + d' x + e' y + f' = 0 的代入判别式。 */
function discriminant(coeffs: number[], a: number, b: number, c: number): number {
  const [A, B, C, D, E, F] = coeffs;
  if (Math.abs(b) > 1e-12) {
    const p = -a / b;
    const q = -c / b;
    const qa = A + B * p + C * p * p;
    const qb = B * q + 2 * C * p * q + D + E * p;
    const qc = C * q * q + E * q + F;
    return qb * qb - 4 * qa * qc;
  }
  const x = -c / a;
  const qb = B * x + E;
  const qc = A * x * x + D * x + F;
  return qb * qb - 4 * C * qc;
}

/**
 * 直线 a x + b y + c = 0 的尺度不变表示：方向单位向量 + 到原点的带符号距离。
 * 直线方程的系数只定义到正数倍，直接比系数会误报。
 * 方向向量取规范朝向（ux 为正，ux 为零时 uy 为正），避免 ± 翻转造成误报。
 */
function normalizeLine(a: number, b: number, c: number): { ux: number; uy: number; d: number } {
  const len = Math.hypot(a, b);
  let ux = a / len;
  let uy = b / len;
  let d = c / len;
  if (ux < 0 || (Math.abs(ux) < 1e-15 && uy < 0)) {
    ux = -ux; uy = -uy; d = -d;
  }
  return { ux, uy, d };
}

/** 直线 a x + b y + c = 0 是否过点 (x, y)（世界坐标）。 */
const passesThrough = (a: number, b: number, c: number, x: number, y: number) =>
  Math.abs(a * x + b * y + c) < EPS;

function build(coeffs: number[], px: number, py: number) {
  const kernel: Kernel = makeKernel();
  const conic = new GeoConic(kernel, coeffs);
  const point = new GeoPoint(kernel, new GeoVec3D(px, py, 1));
  const algo = new AlgoTangent(kernel, conic, point);
  algo.compute();
  return {
    kernel, conic, point, algo,
    lines: algo.getOutputLines().filter(l => l.isDefined()),
    pts: algo.getOutputPoints().filter(p => p.isDefined()),
  };
}

describe('conicSolve 纯函数', () => {
  it('dualLine 给出可手工验算的切线', () => {
    // 单位圆在 (1, 0) 的切线是 x = 1
    expect(dualLine(CIRCLE_UNIT, 1, 0)).toEqual([1, 0, -1]);
    // x²/9 + y²/16 = 1 在 (3, 0) 的切线是 x = 3 → (1/3, 0, -1)
    expect(dualLine(ELLIPSE, 3, 0)).toEqual([1 / 3, 0, -1]);
    // y² = 4x 在 (1, 2) 的切线是 y = x + 1，即 -x + y - 1 = 0
    expect(dualLine(PARABOLA_RIGHT, 1, 2)).toEqual([-2, 2, -2]);
    // x² - y² = 1 在 (1, 0) 的切线是 x = 1
    expect(dualLine(HYPERBOLA, 1, 0)).toEqual([1, 0, -1]);
  });

  it('isConicDegenerate 识别点/两直线，且对系数缩放不敏感', () => {
    const pointLike = [1, 0, 1, 0, 0, 0];       // x² + y² = 0 → 单点
    const linePair = [1, 0, -1, 0, 0, 0];       // x² - y² = 0 → 两直线
    expect(isConicDegenerate(pointLike)).toBe(true);
    expect(isConicDegenerate(linePair)).toBe(true);

    for (const conic of [CIRCLE, CIRCLE_UNIT, ELLIPSE, HYPERBOLA, PARABOLA_RIGHT, ROTATED_ELLIPSE]) {
      expect(isConicDegenerate(conic), `false for ${conic}`).toBe(false);
      // 系数整体缩放 100 倍后判定必须不变
      expect(isConicDegenerate(conic.map(v => v * 100))).toBe(false);
    }
  });

  it('intersectLineWithConic 对直线求交与解析解一致', () => {
    // y = 0 与 x² + y² = 1 → (±1, 0)
    const h = intersectLineWithConic(CIRCLE_UNIT, 0, 1, 0);
    expect(h).toHaveLength(2);
    expect(Math.abs(Math.abs(h[0].x) - 1)).toBeLessThan(EPS);
    expect(Math.abs(Math.abs(h[1].x) - 1)).toBeLessThan(EPS);

    // x = 0.5 与 x² + y² = 1 → y = ±√3/2
    const v = intersectLineWithConic(CIRCLE_UNIT, 1, 0, -0.5);
    expect(v).toHaveLength(2);
    expect(v[0].y).toBeCloseTo(-Math.sqrt(3) / 2, 10);
    expect(v[1].y).toBeCloseTo(Math.sqrt(3) / 2, 10);

    // x = 2 与单位圆无交点
    expect(intersectLineWithConic(CIRCLE_UNIT, 1, 0, -2)).toHaveLength(0);
    // 退化直线
    expect(intersectLineWithConic(CIRCLE_UNIT, 0, 0, -1)).toHaveLength(0);
  });
});

describe('AlgoTangent —— 圆（原实现行为不回归）', () => {
  it('点在圆上：单条切线，第二对保持 undefined', () => {
    const { lines, pts } = build(CIRCLE, 5, -1);
    expect(lines).toHaveLength(1);
    expect(pts).toHaveLength(1);
    expect(pts[0].getX()).toBeCloseTo(5, 10);
    expect(pts[0].getY()).toBeCloseTo(-1, 10);
  });

  it('点在圆外：两条切线 + 两个切点，切点均在圆上', () => {
    const { conic, point, lines, pts } = build(CIRCLE, 2, 5);
    expect(lines).toHaveLength(2);
    expect(pts).toHaveLength(2);
    for (const t of pts) expect(Math.abs(conicValue(CIRCLE, t.getX(), t.getY()))).toBeLessThan(1e-9);
    for (const l of lines) {
      expect(Math.abs(l.a * point.getX() + l.b * point.getY() + l.c)).toBeLessThan(EPS);
    }
  });

  it('点在圆内：无实切线，全部 undefined', () => {
    const { lines, pts } = build(CIRCLE, 2, -1);
    expect(lines).toHaveLength(0);
    expect(pts).toHaveLength(0);
  });

  it('圆心：无切线', () => {
    const { lines } = build(CIRCLE, 2, -1);
    expect(lines).toHaveLength(0);
  });

  it('单位圆从 (2,0) 出发的两条切线各自解析可验算', () => {
    const { lines } = build(CIRCLE_UNIT, 2, 0);
    expect(lines).toHaveLength(2);
    // 切点 (0.5, ±√3/2)，切线 0.5x ± (√3/2)y = 1
    // 直线系数只定义到正数倍，所以比较尺度不变的方向向量 + 带符号距离
    for (const l of lines) {
      const n = normalizeLine(l.a, l.b, l.c);
      expect(Math.abs(n.ux - 0.5)).toBeLessThan(EPS);
      expect(Math.abs(Math.abs(n.uy) - Math.sqrt(3) / 2)).toBeLessThan(EPS);
      expect(Math.abs(Math.abs(n.d) - 1)).toBeLessThan(EPS); // 圆心到切线距离 = r
      expect(passesThrough(l.a, l.b, l.c, 2, 0)).toBe(true);
    }
  });
});

describe('AlgoTangent —— 椭圆（原实现静默返回 undefined）', () => {
  it('点在椭圆上：单条切线', () => {
    const { lines, pts } = build(ELLIPSE, 3, 0);
    expect(lines).toHaveLength(1);
    expect(Math.abs(lines[0].a * 3 + lines[0].b * 0 + lines[0].c)).toBeLessThan(EPS);
    expect(pts[0].getX()).toBeCloseTo(3, 10);
    expect(pts[0].getY()).toBeCloseTo(0, 10);
  });

  it('点在椭圆外：两条切线 + 两个切点，且真的相切', () => {
    const { conic, point, lines, pts } = build(ELLIPSE, 5, 3);
    expect(lines).toHaveLength(2);
    expect(pts).toHaveLength(2);
    for (const t of pts) expect(Math.abs(conicValue(ELLIPSE, t.getX(), t.getY()))).toBeLessThan(1e-7);
    for (const l of lines) {
      expect(Math.abs(l.a * point.getX() + l.b * point.getY() + l.c)).toBeLessThan(1e-7);
      expect(Math.abs(discriminant(ELLIPSE, l.a, l.b, l.c))).toBeLessThan(1e-6);
    }
  });

  it('点在椭圆内：无切线', () => {
    const { lines, pts } = build(ELLIPSE, 0, 0);
    expect(lines).toHaveLength(0);
    expect(pts).toHaveLength(0);
  });

  it('旋转椭圆（B≠0）也能算', () => {
    const { conic, point, lines, pts } = build(ROTATED_ELLIPSE, 3, 3);
    expect(lines).toHaveLength(2);
    expect(pts).toHaveLength(2);
    for (const t of pts) expect(Math.abs(conicValue(ROTATED_ELLIPSE, t.getX(), t.getY()))).toBeLessThan(1e-9);
    for (const l of lines) {
      expect(Math.abs(l.a * point.getX() + l.b * point.getY() + l.c)).toBeLessThan(1e-9);
    }
  });
});

describe('AlgoTangent —— 双曲线（原实现静默返回 undefined）', () => {
  it('点在双曲线上：单条切线', () => {
    const { lines, pts } = build(HYPERBOLA, 1, 0);
    expect(lines).toHaveLength(1);
    const n = normalizeLine(lines[0].a, lines[0].b, lines[0].c);
    expect(Math.abs(n.ux - 1)).toBeLessThan(EPS);
    expect(Math.abs(n.uy)).toBeLessThan(EPS);
    expect(Math.abs(Math.abs(n.d) - 1)).toBeLessThan(EPS);
    expect(pts[0].getX()).toBeCloseTo(1, 10);
    expect(pts[0].getY()).toBeCloseTo(0, 10);
  });

  it('点在各支外侧：两条切线', () => {
    const { point, lines, pts } = build(HYPERBOLA, 0, 3);
    expect(lines).toHaveLength(2);
    expect(pts).toHaveLength(2);
    for (const l of lines) {
      expect(passesThrough(l.a, l.b, l.c, point.getX(), point.getY())).toBe(true);
      expect(Math.abs(discriminant(HYPERBOLA, l.a, l.b, l.c))).toBeLessThan(1e-9);
    }
    // 切点弦 y = −1/3 横穿两支：切点 x 相反、y 相等，且都在双曲线上
    expect(pts[0].getX() + pts[1].getX()).toBeCloseTo(0, 10);
    expect(pts[0].getY()).toBeCloseTo(pts[1].getY(), 10);
    for (const t of pts) {
      expect(Math.abs(conicValue(HYPERBOLA, t.getX(), t.getY()))).toBeLessThan(1e-9);
      expect(Math.abs(t.getY() + 1 / 3)).toBeLessThan(1e-9);
    }
  });

  it('两支之间（含原点）：无实切线', () => {
    expect(build(HYPERBOLA, 0, 0).lines).toHaveLength(0);
    expect(build(HYPERBOLA, 2, 0).lines).toHaveLength(0); // 「内侧」区域
  });

  it('切点确实落在双曲线上', () => {
    const { conic, pts } = build(HYPERBOLA, 0, 3);
    for (const t of pts) {
      expect(Math.abs(conicValue(HYPERBOLA, t.getX(), t.getY()))).toBeLessThan(1e-9);
    }
  });
});

describe('AlgoTangent —— 抛物线（原实现静默返回 undefined）', () => {
  it('点在抛物线上：单条切线（解析可验算）', () => {
    const { lines, pts } = build(PARABOLA_RIGHT, 1, 2);
    expect(lines).toHaveLength(1);
    // 2y y' = 4 → y' = 4/(2·2) = 1；过 (1,2) 斜率 1 → -x + y - 1 = 0
    expect(lines[0].a).toBeCloseTo(-2, 10);
    expect(lines[0].b).toBeCloseTo(2, 10);
    expect(lines[0].c).toBeCloseTo(-2, 10);
    expect(pts[0].getX()).toBeCloseTo(1, 10);
    expect(pts[0].getY()).toBeCloseTo(2, 10);
  });

  it('x² = 4y 开口向上的抛物线：顶点切线是 x 轴', () => {
    const { lines } = build(PARABOLA_UP, 0, 0);
    expect(lines).toHaveLength(1);
    // y = 0 → 方向 (0,1)，到原点距离 0
    const n = normalizeLine(lines[0].a, lines[0].b, lines[0].c);
    expect(Math.abs(n.ux)).toBeLessThan(EPS);
    expect(Math.abs(n.uy - 1)).toBeLessThan(EPS);
    expect(Math.abs(n.d)).toBeLessThan(EPS);
  });

  it('点在抛物线开口内侧：无实切线', () => {
    expect(build(PARABOLA_RIGHT, 5, 0).lines).toHaveLength(0);
  });

  it('两点都给出切线，且切线确实相切', () => {
    const { point, lines, pts } = build(PARABOLA_RIGHT, 10, 7);
    expect(lines).toHaveLength(2);
    expect(pts).toHaveLength(2);
    for (const t of pts) expect(Math.abs(conicValue(PARABOLA_RIGHT, t.getX(), t.getY()))).toBeLessThan(1e-9);
    for (const l of lines) {
      expect(Math.abs(l.a * point.getX() + l.b * point.getY() + l.c)).toBeLessThan(1e-9);
      expect(Math.abs(discriminant(PARABOLA_RIGHT, l.a, l.b, l.c))).toBeLessThan(1e-6);
    }
  });
});

describe('AlgoTangent —— 退化与异常输入', () => {
  it('退化圆锥（点、两直线）：无切线', () => {
    expect(build([1, 0, 1, 0, 0, 0], 3, 1).lines).toHaveLength(0);
    expect(build([1, 0, -1, 0, 0, 0], 3, 1).lines).toHaveLength(0);
    expect(build([0, 0, 0, 1, 1, 1], 3, 1).lines).toHaveLength(0); // 退化为直线
  });

  it('输入未定义时不抛错，输出保持 undefined', () => {
    const kernel = makeKernel();
    const conic = new GeoConic(kernel, CIRCLE);
    conic.setUndefined();
    const point = new GeoPoint(kernel, new GeoVec3D(2, 5, 1));
    const algo = new AlgoTangent(kernel, conic, point);
    expect(() => algo.compute()).not.toThrow();
    expect(algo.getOutputLines().every(l => !l.isDefined())).toBe(true);
  });

  it('输入含 NaN 时不抛错', () => {
    const kernel = makeKernel();
    const conic = new GeoConic(kernel, [1, 0, 1, 0, 0, NaN]);
    const point = new GeoPoint(kernel, new GeoVec3D(2, 5, 1));
    const algo = new AlgoTangent(kernel, conic, point);
    expect(() => algo.compute()).not.toThrow();
    expect(algo.getOutputLines().every(l => !l.isDefined())).toBe(true);
  });

  it('切点参数化：曲线上的点由其它算法给出时仍成立', () => {
    // 先取曲线上的点再求切线，模拟用户「点在线上」的构造顺序
    const kernel = makeKernel();
    const conic = new GeoConic(kernel, ELLIPSE);
    const onCurve = new GeoPoint(kernel, new GeoVec3D(3, 0, 1));
    const algo = new AlgoTangent(kernel, conic, onCurve);
    algo.compute();
    expect(algo.getOutputLines().filter(l => l.isDefined())).toHaveLength(1);
  });
});
