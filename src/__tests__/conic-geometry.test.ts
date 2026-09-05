import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint, makeLine } from './helpers';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoConic } from '../kernel/geo/GeoConic';

import { AlgoEllipse } from '../kernel/algo/AlgoEllipse';
import { AlgoHyperbola } from '../kernel/algo/AlgoHyperbola';
import { AlgoParabola } from '../kernel/algo/AlgoParabola';
import { AlgoConicFivePoints } from '../kernel/algo/AlgoConicFivePoints';
import { AlgoCompass } from '../kernel/algo/AlgoCompass';

function evalConic(c: GeoConic, x: number, y: number): number {
  const [A, B, C, D, E, F] = c.coeffs;
  return A * x * x + B * x * y + C * y * y + D * x + E * y + F;
}

/** Verify that a set of sample points lies on the conic within tolerance. */
function expectSamplesOnConic(c: GeoConic, tol = 1e-4): void {
  const pts = c.samplePoints(120);
  expect(pts.length).toBeGreaterThan(10);
  for (const p of pts) {
    expect(Math.abs(evalConic(c, p.x, p.y))).toBeLessThan(tol);
  }
}

describe('GeoConic classification', () => {
  it('identifies a circle', () => {
    const k = makeKernel();
    const c = new GeoConic(k, [1, 0, 1, -4, -6, 3]);
    expect(c.getConicType()).toBe('circle');
    expect(c.isCircle()).toBe(true);
    expect(c.getCenter()).toEqual({ x: 2, y: 3 });
    expect(c.getRadius()).toBeCloseTo(Math.sqrt(10), 6);
  });

  it('identifies an ellipse', () => {
    const k = makeKernel();
    // x²/4 + y²/9 = 1
    const c = new GeoConic(k, [0.25, 0, 1, 0, 0, -1]);
    expect(c.getConicType()).toBe('ellipse');
    expect(c.isCircle()).toBe(false);
    expect(c.getCenter().x).toBeCloseTo(0, 6);
    expect(c.getCenter().y).toBeCloseTo(0, 6);
  });

  it('identifies a hyperbola', () => {
    const k = makeKernel();
    // x²/4 - y²/9 = 1
    const c = new GeoConic(k, [0.25, 0, -1, 0, 0, -1]);
    expect(c.getConicType()).toBe('hyperbola');
    expect(c.getCenter().x).toBeCloseTo(0, 6);
    expect(c.getCenter().y).toBeCloseTo(0, 6);
  });

  it('identifies a parabola', () => {
    const k = makeKernel();
    // y = x² → x² - y = 0
    const c = new GeoConic(k, [1, 0, 0, 0, -1, 0]);
    expect(c.getConicType()).toBe('parabola');
    // Vertex should be at (0, 0)
    expect(c.getVertex().x).toBeCloseTo(0, 6);
    expect(c.getVertex().y).toBeCloseTo(0, 6);
  });

  it('identifies a shifted parabola', () => {
    const k = makeKernel();
    // y = (x-3)² + 1 → x² - 6x - y + 10 = 0
    const c = new GeoConic(k, [1, 0, 0, -6, -1, 10]);
    expect(c.getConicType()).toBe('parabola');
    const v = c.getVertex();
    expect(v.x).toBeCloseTo(3, 6);
    expect(v.y).toBeCloseTo(1, 6);
  });
});

describe('GeoConic samplePoints', () => {
  it('samples lie on a circle', () => {
    const k = makeKernel();
    const c = new GeoConic(k, [1, 0, 1, -4, -6, 3]);
    expectSamplesOnConic(c);
    // Check radius from center for each sample
    const center = c.getCenter();
    const r = c.getRadius();
    for (const p of c.samplePoints(60)) {
      expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeCloseTo(r, 4);
    }
  });

  it('samples lie on an ellipse', () => {
    const k = makeKernel();
    // x²/4 + y²/9 = 1
    const c = new GeoConic(k, [0.25, 0, 1, 0, 0, -1]);
    expectSamplesOnConic(c);
  });

  it('samples lie on a hyperbola', () => {
    const k = makeKernel();
    // x²/4 - y²/9 = 1
    const c = new GeoConic(k, [0.25, 0, -1, 0, 0, -1]);
    expectSamplesOnConic(c, 1e-3);
  });

  it('samples lie on a parabola y = x²', () => {
    const k = makeKernel();
    const c = new GeoConic(k, [1, 0, 0, 0, -1, 0]);
    const pts = c.samplePoints(50);
    expect(pts.length).toBe(51);
    for (const p of pts) {
      expect(p.y).toBeCloseTo(p.x * p.x, 4);
    }
  });
});

describe('GeoConic ConicPathMover', () => {
  it('iterates over sampled points', async () => {
    const k = makeKernel();
    const c = new GeoConic(k, [1, 0, 1, 0, 0, -1]);
    const mover = c.createPathMover();
    expect(mover.hasNext()).toBe(true);
    let count = 0;
    const dummy = makePoint(k, 0, 0);
    while (mover.hasNext() && count < 500) {
      mover.getNext(dummy);
      count++;
    }
    expect(count).toBe(180);
    expect(mover.hasNext()).toBe(false);
  });
});

describe('AlgoEllipse coefficients', () => {
  it('produces conic satisfied by the defining point', () => {
    const k = makeKernel();
    const f1 = makePoint(k, -1, 0);
    const f2 = makePoint(k, 1, 0);
    const p = makePoint(k, 0, 2); // on the ellipse x²/4 + y²/3 = 1
    const algo = new AlgoEllipse(k, f1, f2, p);
    algo.compute();
    const c = algo.getOutput();
    expect(c.isDefined()).toBe(true);
    expect(c.getConicType()).toBe('ellipse');
    // Defining point is on the curve
    expect(Math.abs(evalConic(c, 0, 2))).toBeLessThan(1e-6);
    // Center is midpoint of foci
    expect(c.getCenter().x).toBeCloseTo(0, 6);
    expect(c.getCenter().y).toBeCloseTo(0, 6);
    expectSamplesOnConic(c);
  });

  it('handles rotated foci', () => {
    const k = makeKernel();
    const f1 = makePoint(k, 0, -1);
    const f2 = makePoint(k, 0, 1);
    const p = makePoint(k, 2, 0);
    const algo = new AlgoEllipse(k, f1, f2, p);
    algo.compute();
    const c = algo.getOutput();
    expect(c.isDefined()).toBe(true);
    expect(Math.abs(evalConic(c, 2, 0))).toBeLessThan(1e-6);
    expect(c.getCenter().x).toBeCloseTo(0, 6);
    expect(c.getCenter().y).toBeCloseTo(0, 6);
  });
});

describe('AlgoHyperbola coefficients', () => {
  it('produces conic satisfied by the defining point', () => {
    const k = makeKernel();
    const f1 = makePoint(k, -2, 0);
    const f2 = makePoint(k, 2, 0);
    const p = makePoint(k, 3, 1);
    const algo = new AlgoHyperbola(k, f1, f2, p);
    algo.compute();
    const c = algo.getOutput();
    expect(c.isDefined()).toBe(true);
    expect(c.getConicType()).toBe('hyperbola');
    expect(Math.abs(evalConic(c, 3, 1))).toBeLessThan(1e-6);
    expect(c.getCenter().x).toBeCloseTo(0, 6);
    expect(c.getCenter().y).toBeCloseTo(0, 6);
  });
});

describe('AlgoParabola coefficients', () => {
  it('produces y² = 4px for focus (p, 0), directrix x = -p', () => {
    const k = makeKernel();
    // focus (1, 0), directrix x = -1 => line: x + 1 = 0
    const focus = makePoint(k, 1, 0);
    const directrix = makeLine(k, 1, 0, 1);
    const algo = new AlgoParabola(k, focus, directrix);
    algo.compute();
    const c = algo.getOutput();
    expect(c.isDefined()).toBe(true);
    expect(c.getConicType()).toBe('parabola');
    // Check a known point: (1, 2) should satisfy y² = 4·1·x = 4x
    // So y² - 4x = 4 - 4 = 0
    expect(Math.abs(evalConic(c, 1, 2))).toBeLessThan(1e-6);
    // Vertex at (0, 0)
    expect(c.getVertex().x).toBeCloseTo(0, 6);
    expect(c.getVertex().y).toBeCloseTo(0, 6);
  });

  it('produces x² = 4py for focus (0, p), directrix y = -p', () => {
    const k = makeKernel();
    // focus (0, 1), directrix y = -1
    const focus = makePoint(k, 0, 1);
    const directrix = makeLine(k, 0, 1, 1);
    const algo = new AlgoParabola(k, focus, directrix);
    algo.compute();
    const c = algo.getOutput();
    expect(c.isDefined()).toBe(true);
    expect(c.getConicType()).toBe('parabola');
    // (2, 1) should satisfy x² = 4·1·y = 4y → 4 - 4 = 0
    expect(Math.abs(evalConic(c, 2, 1))).toBeLessThan(1e-6);
  });

  it('handles rotated directrix', () => {
    const k = makeKernel();
    // focus (0, 1), directrix x + y = 0
    const focus = makePoint(k, 0, 1);
    const directrix = makeLine(k, 1, 1, 0);
    const algo = new AlgoParabola(k, focus, directrix);
    algo.compute();
    const c = algo.getOutput();
    expect(c.isDefined()).toBe(true);
    expect(c.getConicType()).toBe('parabola');
  });
});

describe('AlgoConicFivePoints coefficients', () => {
  it('recovers exact circle coefficients', () => {
    const k = makeKernel();
    // 5 points on circle x² + y² - 2x - 4y + 1 = 0 (center (1,2), r=2)
    const cx = 1, cy = 2, r = 2;
    const angles = [0, Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3];
    const pts = angles.map(a => makePoint(k, cx + r * Math.cos(a), cy + r * Math.sin(a)));
    const algo = new AlgoConicFivePoints(k, pts);
    algo.compute();
    const c = algo.getOutput();
    expect(c.isDefined()).toBe(true);
    expect(c.getConicType()).toBe('circle');
    expect(c.getCenter().x).toBeCloseTo(1, 3);
    expect(c.getCenter().y).toBeCloseTo(2, 3);
    expect(c.getRadius()).toBeCloseTo(2, 3);
  });

  it('recovers an ellipse from five points', () => {
    const k = makeKernel();
    // x²/4 + y²/9 = 1
    const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4];
    const pts = angles.map(a => makePoint(k, 2 * Math.cos(a), 3 * Math.sin(a)));
    const algo = new AlgoConicFivePoints(k, pts);
    algo.compute();
    const c = algo.getOutput();
    expect(c.isDefined()).toBe(true);
    expect(c.getConicType()).toBe('ellipse');
    // Verify a known point
    expect(Math.abs(evalConic(c, 2, 0))).toBeLessThan(1e-3);
    expect(Math.abs(evalConic(c, 0, 3))).toBeLessThan(1e-3);
  });
});

describe('AlgoCompass coefficients', () => {
  it('produces exact circle coefficients', () => {
    const k = makeKernel();
    const a = makePoint(k, 0, 0);
    const b = makePoint(k, 5, 0);
    const center = makePoint(k, 3, -2);
    const algo = new AlgoCompass(k, a, b, center);
    algo.compute();
    const c = algo.getOutput();
    expect(c.isDefined()).toBe(true);
    expect(c.getConicType()).toBe('circle');
    expect(c.getCenter().x).toBeCloseTo(3, 6);
    expect(c.getCenter().y).toBeCloseTo(-2, 6);
    expect(c.getRadius()).toBeCloseTo(5, 6);
    // Verify a point on the circle
    expect(Math.abs(evalConic(c, 3 + 5, -2))).toBeLessThan(1e-9);
  });
});
