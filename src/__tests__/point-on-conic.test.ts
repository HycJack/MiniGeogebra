import { describe, expect, it } from 'vitest';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { AlgoPointOnConic } from '../kernel/algo/AlgoPointOnConic';
import { makeKernel } from './helpers';

const TWO_PI = 2 * Math.PI;
const EPS = 1e-6;

/** A x² + B xy + C y² + D x + E y + F = 0 */
const CIRCLE = [1, 0, 1, -4, 2, -4];          // (x-2)² + (y+1)² = 9，中心 (2,-1)，r=3
const ELLIPSE = [1 / 9, 0, 1 / 16, 0, 0, -1]; // x²/9 + y²/16 = 1
const HYPERBOLA = [1, 0, -1, 0, 0, -1];       // x² - y² = 1
const PARABOLA_RIGHT = [0, 0, 1, -4, 0, 0];   // y² = 4x
const PARABOLA_UP = [1, 0, 0, 0, -4, 0];      // x² = 4y
const ROTATED_HYPERBOLA = [1, 1, -1, 0, 0, -1]; // x² + xy - y² = 1

const conic = (coeffs: number[]) => new GeoConic(makeKernel(), coeffs);
const at = (c: GeoConic, theta: number) => c.pointAtAngle(theta);
const probe = (x: number, y: number) => new GeoPoint(makeKernel(), new GeoVec3D(x, y, 1));
const expectNear = (hit: { x: number; y: number } | null, x: number, y: number) => {
  expect(hit).not.toBeNull();
  expect(hit!.x).toBeCloseTo(x, 9);
  expect(hit!.y).toBeCloseTo(y, 9);
};

describe('GeoConic.pointAtAngle', () => {
  it('returns exact points on a circle', () => {
    const c = conic(CIRCLE);
    expect(c.getConicType()).toBe('circle');
    expectNear(at(c, 0), 5, -1);
    expectNear(at(c, Math.PI / 2), 2, 2);
    expectNear(at(c, Math.PI), -1, -1);
    expectNear(at(c, -Math.PI / 2), 2, -4);
  });

  it('solves an ellipse analytically instead of approximating with the radius', () => {
    const c = conic(ELLIPSE);
    expect(c.getConicType()).toBe('ellipse');
    expectNear(at(c, 0), 3, 0);
    expectNear(at(c, Math.PI / 2), 0, 4);
    // x²/9 + y²/16 = 1 沿 y = x 方向：t = 12/5
    expectNear(at(c, Math.PI / 4), 2.4, 2.4);
  });

  it('returns the nearer branch for a hyperbola and null where the ray misses', () => {
    const c = conic(HYPERBOLA);
    expect(c.getConicType()).toBe('hyperbola');
    expectNear(at(c, 0), 1, 0);
    expectNear(at(c, Math.PI), -1, 0);
    // 竖直方向穿过两支之间，无交点
    expect(at(c, Math.PI / 2)).toBeNull();
  });

  it('handles parabolas from the vertex anchor', () => {
    const right = conic(PARABOLA_RIGHT);
    expect(right.getConicType()).toBe('parabola');
    expectNear(right.getVertex(), 0, 0);
    expectNear(at(right, Math.PI / 4), 4, 4);
    expectNear(at(right, -Math.PI / 4), 4, -4);
    // 轴方向只接触顶点，不产生新的交点
    expect(at(right, 0)).toBeNull();
    expect(at(right, Math.PI)).toBeNull();

    const up = conic(PARABOLA_UP);
    expectNear(at(up, Math.PI / 4), 4, 4);
    expect(at(up, Math.PI / 2)).toBeNull();
  });

  it('supports rotated conics', () => {
    const c = conic(ROTATED_HYPERBOLA);
    expect(c.getConicType()).toBe('hyperbola');
    const hit = at(c, 0);
    expect(hit).not.toBeNull();
    expect(c.isOnPath(probe(hit!.x, hit!.y), EPS)).toBe(true);
  });

  it('keeps samplePoints on the curve after the ray-intersection refactor', () => {
    for (const coeffs of [CIRCLE, ELLIPSE, HYPERBOLA, PARABOLA_RIGHT, ROTATED_HYPERBOLA]) {
      const c = conic(coeffs);
      const points = c.samplePoints(180);
      expect(points.length).toBeGreaterThan(50);
      for (const p of points) {
        expect(c.isOnPath(probe(p.x, p.y), EPS)).toBe(true);
      }
    }
  });
});

describe('AlgoPointOnConic', () => {
  const setup = (coeffs: number[], paramValue: number) => {
    const kernel = makeKernel();
    const path = new GeoConic(kernel, coeffs);
    const param = new GeoNumeric(kernel, paramValue);
    const algo = new AlgoPointOnConic(kernel, path, param);
    algo.compute();
    return { kernel, path, param, algo, point: algo.getOutput() };
  };

  it('places the point on the curve for every parameter of a circle', () => {
    for (const theta of [0, 0.5, 1.1, Math.PI / 2, 2.0, 4.4, 6.2]) {
      const { path, point } = setup(CIRCLE, theta);
      expect(point.isDefined()).toBe(true);
      expect(path.isOnPath(point, EPS)).toBe(true);
    }
  });

  it('places the point on a non-circular conic (the previous bug)', () => {
    const { path, point } = setup(ELLIPSE, Math.PI / 4);
    // 旧实现按圆的极坐标计算，参数 π/4 会得到 (r/√2, r/√2)，不在椭圆上
    expect(point.getX()).toBeCloseTo(2.4, 6);
    expect(point.getY()).toBeCloseTo(2.4, 6);
    expect(path.isOnPath(point, EPS)).toBe(true);
  });

  it('keeps the point on a parabola for every direction that hits it', () => {
    const { path, param, algo, point } = setup(PARABOLA_RIGHT, Math.PI / 4);
    expect(point.isDefined()).toBe(true);
    expect(path.isOnPath(point, EPS)).toBe(true);

    let onCurve = 0;
    let undefinedCount = 0;
    for (let i = 0; i <= 360; i++) {
      const theta = (TWO_PI * i) / 360;
      param.setValue(theta);
      algo.compute();
      if (point.isDefined()) {
        expect(path.isOnPath(point, 1e-4)).toBe(true);
        onCurve++;
      } else {
        undefinedCount++;
      }
    }
    // y² = 4x 开口向右：只有 cos(theta) > 0 的半个平面命中，
    // 另一半方向必须标记为未定义，而不是落到错误位置
    expect(onCurve).toBeGreaterThan(150);
    expect(undefinedCount).toBeGreaterThan(150);
  });

  it('marks the point undefined instead of misplacing it when the ray misses', () => {
    const { point } = setup(HYPERBOLA, Math.PI / 2);
    expect(point.isDefined()).toBe(false);
  });

  it('normalizes the parameter into [0, 2π) so dragging is continuous', () => {
    const { param, algo } = setup(CIRCLE, 0);

    algo.updateParameter(100, -1); // 方向角 0
    expect(param.getValue()).toBeCloseTo(0, 9);
    algo.compute();
    expect(algo.getOutput().getX()).toBeCloseTo(5, 6);
    expect(algo.getOutput().getY()).toBeCloseTo(-1, 6);

    algo.updateParameter(-2, 2); // 方向角 3π/2
    expect(param.getValue()).toBeGreaterThan(0);
    expect(param.getValue()).toBeLessThan(TWO_PI);
  });

  it('projects a click to the correct direction on an ellipse', () => {
    const { path, param, algo } = setup(ELLIPSE, 0);

    algo.updateParameter(100, 100); // 方向 π/4
    algo.compute();
    const point = algo.getOutput();
    expect(param.getValue()).toBeCloseTo(Math.PI / 4, 9);
    expect(point.getX()).toBeCloseTo(2.4, 6);
    expect(point.getY()).toBeCloseTo(2.4, 6);
    expect(path.isOnPath(point, EPS)).toBe(true);
  });
});
