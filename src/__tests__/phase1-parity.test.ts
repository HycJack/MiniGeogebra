import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoConic } from '../kernel/geo/GeoConic';
import { AlgoCirclePointRadius } from '../kernel/algo/AlgoCirclePointRadius';
import { AlgoLineTwoPoints } from '../kernel/algo/AlgoLineTwoPoints';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { intersectConicConic } from '../kernel/geo/conicSolve';
import { findRoots, integrate } from '../kernel/algebra/Numerics';
import {
  extractPolynomialCoefficients,
  polynomialRealRoots,
} from '../kernel/algebra/Polynomial';
import { parseExpression } from '../kernel/algebra/ExpressionParser';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';

const c = (kernel: Kernel) => kernel.getConstruction();

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => c(kernel).addElement(el));
  c(kernel).updateAllAlgorithms();
  return elements;
};

const conicValue = (coeffs: number[], x: number, y: number) => {
  const [A, B, C, D, E, F] = coeffs;
  return A * x * x + B * x * y + C * y * y + D * x + E * y + F;
};

describe('A1: intersection label continuity', () => {
  it('keeps each output point tracking the same geometric branch while the line rotates', () => {
    const kernel = makeKernel();
    const O = makePoint(kernel, 0, 0, 'O');
    const circleAlgo = new AlgoCirclePointRadius(kernel, O, 1);
    c(kernel).addElement(circleAlgo);
    const circle = circleAlgo.getOutput();

    // 直线过 (0, 0.5)，方向角 θ：θ 从 0° 经 85° 转到 95°
    // 两个交点绕原点连续旋转；θ 跨过 90° 时"按 x 排序"会互换标签
    const P1 = makePoint(kernel, 0.866, 0.5, 'P1');
    const P2 = makePoint(kernel, -0.866, 0.5, 'P2');
    const lineAlgo = new AlgoLineTwoPoints(kernel, P1, P2);
    c(kernel).addElement(lineAlgo);
    const line = lineAlgo.getOutput();

    const intersect = new AlgoIntersect(kernel, line, circle);
    c(kernel).addElement(intersect);
    const [slot0, slot1] = intersect.getOutputPoints();

    const rotateTo = (deg: number) => {
      const rad = deg * Math.PI / 180;
      P1.setCoords(0.866 * Math.cos(rad), 0.5 + 0.866 * Math.sin(rad), 1);
      P2.setCoords(-0.866 * Math.cos(rad), 0.5 - 0.866 * Math.sin(rad), 1);
      c(kernel).updateAllAlgorithms();
    };

    rotateTo(0);
    rotateTo(85);
    rotateTo(95);

    // 连续性：slot0 一直跟踪从 (−0.866, 0.5) 出发的那支（θ=95° 时在下方）。
    // 按 x 排序的旧实现会让 slot0 跳到 (−0.0437, 0.9990)（距离 1.39 的跳变），
    // 置换匹配后只移动 0.261 跟住同一支。
    expect(slot0!.getX()).toBeCloseTo(0.1305, 3);
    expect(slot0!.getY()).toBeCloseTo(-0.9915, 3);
    expect(slot1!.getX()).toBeCloseTo(-0.0437, 3);
    expect(slot1!.getY()).toBeCloseTo(0.9990, 3);
    // 每个输出点都仍在圆上
    for (const p of [slot0, slot1]) {
      expect(Math.hypot(p!.getX(), p!.getY())).toBeCloseTo(1, 5);
    }
  });
});

describe('A2: general conic-conic intersection (Plücker)', () => {
  it('intersects a circle and a rotated ellipse in 4 points', () => {
    const kernel = makeKernel();
    // 椭圆 10x² − 16xy + 10y² = 18（长轴沿 45° 对角线）与圆 x²+y² = 8.41 (r=2.9)
    const ellipse = new GeoConic(kernel, [10, -16, 10, 0, 0, -18]);
    const circle = new GeoConic(kernel, [1, 0, 1, 0, 0, -8.41]);
    c(kernel).addElement(ellipse);
    c(kernel).addElement(circle);

    const algo = new AlgoIntersect(kernel, ellipse, circle);
    c(kernel).addElement(algo);
    c(kernel).updateAllAlgorithms();
    const pts = algo.getOutputPoints().filter(p => p.isDefined());
    expect(pts).toHaveLength(4);
    for (const p of pts) {
      expect(conicValue(ellipse.coeffs, p.getX(), p.getY())).toBeCloseTo(0, 5);
      expect(conicValue(circle.coeffs, p.getX(), p.getY())).toBeCloseTo(0, 5);
    }
  });

  it('intersects a parabola (A=0) and a circle via the degenerate-conic path', () => {
    // 抛物线 y² = 2x 与圆 x²+y² = 4：代入得 x = −1+√5, y = ±√(2x)
    const parabola = [0, 0, 1, -2, 0, 0];
    const circle = [1, 0, 1, 0, 0, -4];
    const pts = intersectConicConic(parabola, circle);
    const x = -1 + Math.sqrt(5);
    expect(pts).toHaveLength(2);
    expect(pts[0].x).toBeCloseTo(x, 6);
    expect(Math.abs(pts[0].y)).toBeCloseTo(Math.sqrt(2 * x), 6);
  });

  it('still solves circle-circle through the same code path', () => {
    const c1 = [1, 0, 1, 0, 0, -4];       // r=2 at origin
    const c2 = [1, 0, 1, -4, 0, 2.25];    // (x-2)^2 + y^2 = 1.75
    const pts = intersectConicConic(c1, c2);
    expect(pts).toHaveLength(2);
    const x = 1.5625; // 4 - 4x = -2.25
    const y = Math.sqrt(4 - x * x);
    expect(pts[0].x).toBeCloseTo(x, 6);
    expect(Math.abs(pts[1].y)).toBeCloseTo(y, 6);
  });
});

describe('A3: full real roots of polynomials (Durand-Kerner)', () => {
  it('finds all roots of x³ − 2x including 0', () => {
    expect(polynomialRealRoots([0, -2, 0, 1]).map(r => +r.toFixed(6)))
      .toEqual([-Math.SQRT2, 0, Math.SQRT2].map(r => +r.toFixed(6)));
  });

  it('extracts polynomial coefficients from an AST with slider scope', () => {
    const coeffs = extractPolynomialCoefficients(
      parseExpression('a*x^2 - 2'), 'x', new Map([['a', 3]]));
    expect(coeffs).toEqual([-2, 0, 3]);
  });

  it('Root(f) returns every real root of a polynomial function', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^3 - 2x');
    const elements = addInput(kernel, 'Root(f)');
    // Root(f) 返回列表 + 有定义的派生根点（空闲槽位 undefined 不入构造检查）
    const roots = elements
      .filter((el): el is GeoPoint => el instanceof GeoPoint && el.isDefined())
      .map(p => +p.getX().toFixed(6))
      .sort((a, b) => a - b);
    expect(roots).toEqual([-Math.SQRT2, 0, Math.SQRT2].map(r => +r.toFixed(6)));
  });

  it('Root(f) falls back to numeric scanning for non-polynomials', () => {
    const kernel = makeKernel();
    addInput(kernel, 'g(x) = sin(x)');
    const elements = addInput(kernel, 'Root(g)');
    const roots = elements.filter((el): el is GeoPoint => el instanceof GeoPoint);
    expect(roots.length).toBeGreaterThanOrEqual(5);
  });

  it('findRoots no longer duplicates roots when consecutive samples hit zero', () => {
    const roots = findRoots(() => 0, -1, 1, 64);
    expect(roots).toHaveLength(1);
  });
});

describe('A4: integral tolerance scaling and convergence', () => {
  it('converges on a wide interval without hitting max depth', () => {
    const result = integrate((x) => 2 * x, 0, 1e6);
    expect(result.converged).toBe(true);
    expect(result.value).toBeCloseTo(1e12, -2);
    expect(result.subdivisions).toBeLessThan(500);
  });

  it('flags non-convergence for an infinitely oscillatory integrand', () => {
    const result = integrate((x) => Math.sin(1 / (x * x)), 0, 1);
    expect(result.converged).toBe(false);
  });
});
