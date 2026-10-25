import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoCurve } from '../kernel/geo/GeoCurve';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoInequality } from '../kernel/geo/GeoInequality';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel, makePoint } from './helpers';

const c = (kernel: Kernel) => kernel.getConstruction();

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => c(kernel).addElement(el));
  c(kernel).updateAllAlgorithms();
  return elements;
};

const outputsOf = <T>(kernel: Kernel, text: string, type: new (...args: any[]) => T): T[] =>
  addInput(kernel, text).filter(el => el instanceof (type as any)) as T[];

const ofType = <T>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  c(kernel).getElements().filter(el => el instanceof (type as any)) as T[];

describe('B4: parametric curves', () => {
  it('Curve creates a circle of radius 2 from (2cos t, 2sin t)', () => {
    const kernel = makeKernel();
    const [curve] = outputsOf(kernel, 'Curve(2*cos(t), 2*sin(t), t, 0, 6.28318530718)', GeoCurve);
    const p = curve.pointAt(0.5);
    expect(p!.x).toBeCloseTo(2 * Math.cos(0.5), 9);
    expect(p!.y).toBeCloseTo(2 * Math.sin(0.5), 9);
    // 采样点都在半径 2 的圆上
    const samples = curve.updateSamples(800);
    expect(samples.length).toBeGreaterThan(64);
    for (const s of samples.slice(0, 30)) {
      expect(Math.hypot(s.x, s.y)).toBeCloseTo(2, 2);
    }
    expect(curve.isClosedPath()).toBe(true);
  });

  it('PointOn(curve) places a constrained point and drags via nearest parameter', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Curve(2*cos(t), 2*sin(t), t, 0, 6.28318530718)');
    const curve = ofType(kernel, GeoCurve)[0];
    const [point] = outputsOf(kernel, `PointOn(${curve.label})`, GeoPoint);
    // 参数在 (tMin+tMax)/2 = π → 点 ≈ (−2, 0)
    expect(point.getX()).toBeCloseTo(-2, 6);
    expect(point.getY()).toBeCloseTo(0, 6);
    // 拖拽：请求把点放到 (2, 0.1) 附近 → 参数应回到 ≈ 0
    const algo = point.parentAlgo as unknown as { updateParameter: (x: number, y: number) => void };
    algo.updateParameter(2, 0.1);
    c(kernel).updateAllAlgorithms();
    // (2, 0.1) 的最近点其实在 t≈0.05 处（离曲线仅 0.0026），投影会吸到那里而不是 (2,0)
    expect(Math.hypot(point.getX(), point.getY())).toBeCloseTo(2, 4); // 仍在圆上
    expect(point.getY()).toBeCloseTo(0.1, 2);
  });

  it('curve follows a slider dependency', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 2');
    addInput(kernel, 'Curve(a*cos(t), a*sin(t), t, 0, 6.28318530718)');
    const curve = ofType(kernel, GeoCurve)[0];
    const p = curve.pointAt(0);
    expect(p!.x).toBeCloseTo(2, 9);
    const slider = ofType(kernel, GeoNumeric).find(n => n.label === 'a')!;
    slider.setValue(5);
    c(kernel).updateAllAlgorithms();
    const q = curve.pointAt(0);
    expect(q!.x).toBeCloseTo(5, 9);
  });

  it('Tangent(curve, t) and Tangent(f, a)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Curve(cos(t), sin(t), t, 0, 6.28318530718)');
    const curve = ofType(kernel, GeoCurve)[0];
    // 单位圆在 t=π/2 处切线的斜率 = 0（水平）
    const [tangent] = outputsOf(kernel, `Tangent(${curve.label}, 1.57079632679)`, GeoLine);
    expect(tangent.a).toBeCloseTo(0, 6); // 法向 (dy, −dx) ≈ (0, 1) → 水平线 y = 1
    expect(tangent.c).toBeCloseTo(-1, 6);

    addInput(kernel, 'h(x) = x^2');
    const [tangentF] = outputsOf(kernel, 'Tangent(h, 2)', GeoLine);
    // f(2)=4, f'(2)=4 → y − 4 = 4(x−2) → 4x − y − 4 = 0
    expect(tangentF.a).toBeCloseTo(4, 9);
    expect(tangentF.c).toBeCloseTo(-4, 9);
  });

  it('serializes a curve and a point-on-curve', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Curve(2*cos(t), 2*sin(t), t, 0, 6.28318530718)');
    addInput(kernel, `PointOn(${ofType(kernel, GeoCurve)[0].label})`);

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const curves = ofType(restored, GeoCurve);
    expect(curves).toHaveLength(1);
    const p = curves[0].pointAt(0);
    expect(p!.x).toBeCloseTo(2, 6);
    const points = ofType(restored, GeoPoint).filter(p => p.isDefined());
    expect(points.length).toBeGreaterThan(0);
  });
});

describe('B7: curvature and osculating circle', () => {
  it('Curvature(f, a) for f = x² at 0 is 2', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2');
    const [k] = outputsOf(kernel, 'Curvature(f, 0)', GeoNumeric);
    expect(k.getValue()).toBeCloseTo(2, 9);
  });

  it('OsculatingCircle(f, a) for f = x² at 0 has center (0, 1/2) and radius 1/2', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2');
    const [circle] = outputsOf(kernel, 'OsculatingCircle(f, 0)', GeoConic);
    const center = circle.getCenter();
    expect(center.x).toBeCloseTo(0, 9);
    expect(center.y).toBeCloseTo(0.5, 9);
    expect(circle.getRadius()).toBeCloseTo(0.5, 9);
  });

  it('Curvature of a radius-2 circle is 0.5 at every parameter', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Curve(2*cos(t), 2*sin(t), t, 0, 6.28318530718)');
    const [k] = outputsOf(kernel, `Curvature(${ofType(kernel, GeoCurve)[0].label}, 1.2)`, GeoNumeric);
    expect(k.getValue()).toBeCloseTo(0.5, 6);
  });
});

describe('B5: regions', () => {
  it('PointIn(polygon) lands inside and is clamped back when dragged out', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (4, 0)');
    addInput(kernel, 'C = (4, 3)');
    addInput(kernel, 'D = (0, 3)');
    addInput(kernel, 'poly = Polygon(A, B, C, D)');
    const poly = ofType(kernel, GeoPolygon)[0];

    const [point] = outputsOf(kernel, 'PointIn(poly)', GeoPoint);
    expect(poly.isInRegionXY(point.getX(), point.getY())).toBe(true);

    // 拖到远处 → 投影回边界内
    const algo = point.parentAlgo as unknown as { updateParameter: (x: number, y: number) => void };
    algo.updateParameter(100, 100);
    c(kernel).updateAllAlgorithms();
    // 拖到远处会被夹回边界上最近的点 (4, 3)
    expect(point.getX()).toBeCloseTo(4, 9);
    expect(point.getY()).toBeCloseTo(3, 9);
  });

  it('IsInRegion works for polygon and circle', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (2, 0)');
    addInput(kernel, 'C = (2, 2)');
    addInput(kernel, 'D = (0, 2)');
    addInput(kernel, 'sq = Polygon(A, B, C, D)');
    addInput(kernel, 'P = (1, 1)');
    addInput(kernel, 'Q = (5, 5)');
    const [inside] = outputsOf(kernel, 'IsInRegion(P, sq)', GeoNumeric);
    const [outside] = outputsOf(kernel, 'IsInRegion(Q, sq)', GeoNumeric);
    expect(inside.getValue()).toBe(1);
    expect(outside.getValue()).toBe(0);
  });

  it('RandomPointIn(polygon) always lands inside', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (3, 0)');
    addInput(kernel, 'C = (1, 1)');
    addInput(kernel, 'tri = Polygon(A, B, C)');
    const poly = ofType(kernel, GeoPolygon)[0];
    for (let i = 0; i < 20; i++) {
      const [point] = outputsOf(kernel, 'RandomPointIn(tri)', GeoPoint);
      expect(poly.isInRegionXY(point.getX(), point.getY())).toBe(true);
    }
  });
});

describe('B9: polynomial interpolation', () => {
  it('Polynomial through (0,1), (1,2), (2,5) is x² + 1', () => {
    const kernel = makeKernel();
    const [poly] = outputsOf(kernel, 'Polynomial((0, 1), (1, 2), (2, 5))', GeoFunction);
    expect(poly.evaluateAt(0)).toBeCloseTo(1, 9);
    expect(poly.evaluateAt(1)).toBeCloseTo(2, 9);
    expect(poly.evaluateAt(2)).toBeCloseTo(5, 9);
    expect(poly.evaluateAt(3)).toBeCloseTo(10, 9);
  });

  it('Polynomial rejects duplicate x coordinates', () => {
    const kernel = makeKernel();
    expect(() => addInput(kernel, 'Polynomial((0, 1), (0, 2))')).toThrow();
  });
});

describe('B6: inequality regions', () => {
  it('parses y > x^2 and evaluates membership', () => {
    const kernel = makeKernel();
    addInput(kernel, 'y > x^2');
    const [ineq] = ofType(kernel, GeoInequality);
    expect(ineq.satisfied(0, 1)).toBe(true);
    expect(ineq.satisfied(0, 0)).toBe(false);
    expect(ineq.satisfied(1, 2)).toBe(true);
    expect(ineq.satisfied(1, 1)).toBe(false);
    expect(ineq.includesBoundary()).toBe(false); // 严格
  });

  it('parses x^2 + y^2 <= 25 with non-strict boundary', () => {
    const kernel = makeKernel();
    addInput(kernel, 'x^2 + y^2 <= 25');
    const [ineq] = ofType(kernel, GeoInequality);
    expect(ineq.satisfied(3, 4)).toBe(true);   // 边界上
    expect(ineq.satisfied(5, 0)).toBe(true);   // 边界上
    expect(ineq.satisfied(5, 1)).toBe(false);
    expect(ineq.includesBoundary()).toBe(true);
  });

  it('follows a slider dependency', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 2');
    addInput(kernel, 'y < a*x');
    const [ineq] = ofType(kernel, GeoInequality);
    expect(ineq.satisfied(1, 1)).toBe(true);   // 1 < 2
    expect(ineq.satisfied(1, 3)).toBe(false);  // 3 > 2
    const slider = ofType(kernel, GeoNumeric).find(n => n.label === 'a')!;
    slider.setValue(4);
    c(kernel).updateAllAlgorithms();
    expect(ineq.satisfied(1, 3)).toBe(true);   // 3 < 4
  });

  it('serializes an inequality', () => {
    const kernel = makeKernel();
    addInput(kernel, 'y > x^2');
    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const ineqs = restored.getConstruction().getElements()
      .filter(el => el instanceof GeoInequality) as GeoInequality[];
    expect(ineqs).toHaveLength(1);
    expect(ineqs[0].satisfied(0, 1)).toBe(true);
  });
});
