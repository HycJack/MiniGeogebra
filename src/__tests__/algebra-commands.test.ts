import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoLine } from '../kernel/geo/GeoLine';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { AlgoMidpoint } from '../kernel/algo/AlgoMidpoint';
import { AlgoPointOnLine } from '../kernel/algo/AlgoPointOnLine';
import { AlgoCirclePointRadius } from '../kernel/algo/AlgoCirclePointRadius';
import { AlgoCircleThreePoints } from '../kernel/algo/AlgoCircleThreePoints';
import { AlgoDerivative } from '../kernel/algo/AlgoDerivative';
import { DEFAULT_SEARCH_RANGE, parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const ofType = <T extends ConstructionElement>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  kernel.getConstruction().getElements().filter((el): el is T => el instanceof type);

const byLabel = <T extends ConstructionElement>(kernel: Kernel, type: new (...args: any[]) => T, label: string): T => {
  const found = kernel.getConstruction().getElements().filter((el): el is T => el instanceof type)
    .find(el => (el as any).label === label);
  if (!found) throw new Error(`expected a ${type.name} labelled "${label}"`);
  return found;
};

describe('extended commands: measurements and midpoints', () => {
  it('Midpoint(A, B) creates the midpoint', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 6, 8, 'B');
    addInput(kernel, 'Midpoint(A, B)');

    const midpoint = ofType(kernel, GeoPoint).find(p => p.label !== 'A' && p.label !== 'B')!;
    expect(midpoint.getX()).toBeCloseTo(3, 10);
    expect(midpoint.getY()).toBeCloseTo(4, 10);
    expect(ofType(kernel, AlgoMidpoint)).toHaveLength(1);
  });

  it('Distance(A, B) measures the distance between two points', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 3, 4, 'B');
    const elements = addInput(kernel, 'Distance(A, B)');

    const numeric = elements[elements.length - 1] as GeoNumeric;
    expect(numeric.getValue()).toBeCloseTo(5, 10);
    // AlgoNumeric 序列用 t 开头（t1, t2…），不能复用在直线序列上
    expect(numeric.label).toBe('t1');
  });

  it('Slope(l) returns the slope of a line and works for segments', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 1)');
    addInput(kernel, 'B = (2, 5)');
    const lineElements = addInput(kernel, 'Line(A, B)');
    const line = lineElements.filter(el => el instanceof GeoLine)[0] as GeoLine;

    // 直线方程 ax + by + c = 0，斜率 = -a/b；A=(0,1)、B=(2,5) 得 y = 2x+1
    expect(line.a / -line.b).toBeCloseTo(2, 10);

    const elements = addInput(kernel, `Slope(${line.label})`);
    const numeric = elements[elements.length - 1] as GeoNumeric;
    expect(numeric.getValue()).toBeCloseTo(2, 10);
  });

  it('Vector(u, v) builds a vector from its components when the args are not points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Vector(3, 4)');

    const vector = ofType(kernel, GeoVector)[0];
    expect(vector.startX).toBe(0);
    expect(vector.startY).toBe(0);
    expect(vector.endX).toBeCloseTo(3, 10);
    expect(vector.endY).toBeCloseTo(4, 10);
  });

  it('Vector(A, B) still uses the two labelled points when they exist', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    makePoint(kernel, 4, 5, 'B');
    addInput(kernel, 'Vector(A, B)');

    const vector = ofType(kernel, GeoVector)[0];
    expect(vector.startX).toBeCloseTo(1, 10);
    expect(vector.endX).toBeCloseTo(4, 10);
  });
});

describe('extended commands: intersections and circles', () => {
  it('Intersection(l1, l2) returns the crossing points of two lines', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Line((0, 0), (4, 4))');   // l1: y = x
    addInput(kernel, 'Line((0, 4), (4, 0))');   // l2: y = -x + 4

    const elements = addInput(kernel, 'Intersection(l1, l2)');
    const points = elements.filter(el => el instanceof GeoPoint);

    expect(points).toHaveLength(1);
    expect(points[0].getX()).toBeCloseTo(2, 8);
    expect(points[0].getY()).toBeCloseTo(2, 8);
    expect(points[0].isDefined()).toBe(true);
    expect(ofType(kernel, AlgoIntersect)).toHaveLength(1);
  });

  it('Intersection reports when two parallel lines do not cross', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Line((0, 0), (4, 0))');
    addInput(kernel, 'Line((0, 1), (4, 1))');

    expect(() => addInput(kernel, 'Intersection(l1, l2)')).toThrow(/do not intersect/);
  });

  it('Circle(A, r) builds a circle from a centre and a numeric radius', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 1)');
    addInput(kernel, 'Circle(A, 3)');

    const circle = ofType(kernel, GeoConic)[0];
    expect(circle.getCenter().x).toBeCloseTo(1, 10);
    expect(circle.getCenter().y).toBeCloseTo(1, 10);
    expect(circle.getRadius()).toBeCloseTo(3, 10);
    expect(ofType(kernel, AlgoCirclePointRadius)).toHaveLength(1);
  });

  it('Circle(A, r) accepts a numeric expression and rejects a non-positive radius', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'Circle(A, 2 + 3)');
    expect(ofType(kernel, GeoConic)[0].getRadius()).toBeCloseTo(5, 10);

    const kernel2 = makeKernel();
    addInput(kernel2, 'A = (0, 0)');
    expect(() => addInput(kernel2, 'Circle(A, 0)')).toThrow(/radius must be positive/);
    expect(() => addInput(kernel2, 'Circle(A, -2)')).toThrow(/radius must be positive/);
  });

  it('Circle(A, B, C) builds the circumcircle through three points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Circle((1, 0), (-1, 0), (0, 1))');

    const circle = ofType(kernel, GeoConic)[0];
    expect(circle.getCenter().x).toBeCloseTo(0, 8);
    expect(circle.getCenter().y).toBeCloseTo(0, 8);
    expect(circle.getRadius()).toBeCloseTo(1, 8);
    expect(ofType(kernel, AlgoCircleThreePoints)).toHaveLength(1);
  });

  it('PointOnLine(A, l) drops a constrained point onto the line', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Line((0, 0), (4, 0))');   // x 轴
    addInput(kernel, 'A = (2, 5)');
    const elements = addInput(kernel, 'PointOnLine(A, l1)');

    const point = elements.filter(el => el instanceof GeoPoint)[0];
    // A 投影到 x 轴上
    expect(point.getX()).toBeCloseTo(2, 8);
    expect(point.getY()).toBeCloseTo(0, 8);
    expect(ofType(kernel, AlgoPointOnLine)).toHaveLength(1);
    // 驱动参数作为可见数字对象登记
    expect(elements.some(el => el instanceof GeoNumeric)).toBe(true);
  });
});

describe('function analysis commands', () => {
  it('Derivative(f) creates the symbolic derivative', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2 + 3x - 1');
    const elements = addInput(kernel, 'Derivative(f)');

    const derived = elements.filter(el => el instanceof GeoFunction)[0] as GeoFunction;
    expect(derived.label).not.toBe('f');
    // f'(x) = 2x + 3
    expect(derived.evaluateAt(0)).toBeCloseTo(3, 8);
    expect(derived.evaluateAt(2)).toBeCloseTo(7, 8);
    expect(derived.evaluateAt(-2)).toBeCloseTo(-1, 8);
    expect(ofType(kernel, AlgoDerivative)).toHaveLength(1);
  });

  it('Derivative(f) propagates slider changes into the derivative', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 2');
    addInput(kernel, 'f(x) = a*x^2');
    const elements = addInput(kernel, 'Derivative(f)');
    const derived = elements.filter(el => el instanceof GeoFunction)[0] as GeoFunction;

    expect(derived.evaluateAt(3)).toBeCloseTo(12, 8);

    const slider = byLabel(kernel, GeoNumeric, 'a');
    slider.setValue(5);
    kernel.getConstruction().updateAllAlgorithms();

    // f'(x) = 2*a*x，a = 5, x = 3 → 30
    expect(derived.evaluateAt(3)).toBeCloseTo(30, 8);
  });

  it('Derivative(f) works for a free function without driving numerics', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = sin(x)');
    const elements = addInput(kernel, 'Derivative(f)');

    const derived = elements.filter(el => el instanceof GeoFunction)[0] as GeoFunction;
    expect(derived.evaluateAt(0)).toBeCloseTo(1, 8);
    expect(derived.evaluateAt(Math.PI / 2)).toBeCloseTo(0, 8);
  });

  it('Root(f) finds the first root inside the search range', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2 - 4');

    const elements = addInput(kernel, 'Root(f)');
    const point = elements[0] as GeoPoint;
    // [-20, 20] 内第一个根是 -2
    expect(point.getX()).toBeCloseTo(-2, 6);
    expect(point.getY()).toBe(0);
  });

  it('Root(f, a, b) restricts the search to the given interval', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2 - 4');
    const elements = addInput(kernel, 'Root(f, 0, 5)');

    const point = elements[0] as GeoPoint;
    expect(point.getX()).toBeCloseTo(2, 6);
  });

  it('Root(f, x0) searches around the starting point', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2 - 4');
    const elements = addInput(kernel, 'Root(f, 1)');

    const point = elements[0] as GeoPoint;
    expect(point.getX()).toBeCloseTo(2, 6);
  });

  it('Root reports when no root exists in the range', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2 + 1');
    expect(() => addInput(kernel, 'Root(f)')).toThrow(/No root found/);
  });

  it('Root(f) honours a driving slider', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 4');
    addInput(kernel, 'f(x) = x^2 - a');
    const elements = addInput(kernel, 'Root(f)');
    expect((elements[0] as GeoPoint).getX()).toBeCloseTo(-2, 6);
  });

  it('Extremum(f) returns every local extremum with the right kind', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^3 - 3x');
    const elements = addInput(kernel, 'Extremum(f)');

    const points = elements.filter(el => el instanceof GeoPoint);
    expect(points).toHaveLength(2);

    const left = points.find(p => p.getX() < 0)!;
    const right = points.find(p => p.getX() > 0)!;
    expect(left.getX()).toBeCloseTo(-1, 6);
    expect(left.getY()).toBeCloseTo(2, 6);
    expect(right.getX()).toBeCloseTo(1, 6);
    expect(right.getY()).toBeCloseTo(-2, 6);
  });

  it('Extremum reports when the function is monotone', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^3');
    expect(() => addInput(kernel, 'Extremum(f)')).toThrow(/No extremum found/);
  });

  it('Integral(f, a, b) evaluates the definite integral', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = 3x^2');
    const elements = addInput(kernel, 'Integral(f, 0, 1)');

    const numeric = elements[0] as GeoNumeric;
    expect(numeric.getValue()).toBeCloseTo(1, 6);
    // 滑块驱动的被积函数也要带上作用域
    addInput(kernel, 'a = 2');
    addInput(kernel, 'g(x) = a*x');
    const g = byLabel(kernel, GeoNumeric, 'a');
    g.setValue(2);
    kernel.getConstruction().updateAllAlgorithms();
    const second = addInput(kernel, 'Integral(g, 0, 3)')[0] as GeoNumeric;
    expect(second.getValue()).toBeCloseTo(9, 6);
  });

  it('Integral handles a reversed interval and an undefined range', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = 3x^2');
    expect((addInput(kernel, 'Integral(f, 1, 0)')[0] as GeoNumeric).getValue()).toBeCloseTo(-1, 6);

    // 1/x 在 0 处无定义：收缩后仍应给出有限值
    const kernel2 = makeKernel();
    addInput(kernel2, 'h(x) = 1/x');
    const result = (addInput(kernel2, 'Integral(h, 0, 2)')[0] as GeoNumeric).getValue();
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(Math.LN2);
  });

  it('rejects unknown functions in every analysis command', () => {
    const kernel = makeKernel();
    expect(() => addInput(kernel, 'Derivative(g)')).toThrow(/Unknown function "g"/);
    expect(() => addInput(kernel, 'Root(g)')).toThrow(/Unknown function "g"/);
    expect(() => addInput(kernel, 'Extremum(g)')).toThrow(/Unknown function "g"/);
    expect(() => addInput(kernel, 'Integral(g, 0, 1)')).toThrow(/Unknown function "g"/);
  });

  it('exposes the default search range for callers and tests', () => {
    expect(DEFAULT_SEARCH_RANGE).toBeGreaterThan(0);
  });
});

describe('command argument resolution', () => {
  it('resolves numeric command arguments against driving sliders', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 2');
    addInput(kernel, 'Point(a, 3)');

    const point = ofType(kernel, GeoPoint)[0];
    expect(point.getX()).toBeCloseTo(2, 10);
    expect(point.getY()).toBeCloseTo(3, 10);
  });

  it('reports unknown labels with a command-appropriate message', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    expect(() => addInput(kernel, 'Segment(Q, Z)')).toThrow(/Unknown point "Q"/);
    expect(() => addInput(kernel, 'Circle(A, ZZ)')).toThrow(/Unknown point "ZZ"/);
    expect(() => addInput(kernel, 'Slope(nada)')).toThrow(/Unknown line "nada"/);
  });

  it('enforces argument counts per command', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    expect(() => addInput(kernel, 'Point(1)')).toThrow(/requires 2 arguments/);
    expect(() => addInput(kernel, 'Midpoint(A)')).toThrow(/requires 2 arguments/);
    expect(() => addInput(kernel, 'Slope()')).toThrow(/requires 1 argument/);
    expect(() => addInput(kernel, 'Integral()')).toThrow(/requires 3 arguments/);
    expect(() => addInput(kernel, 'Circle(A)')).toThrow(/requires 2 or 3 arguments/);
  });

  it('creates a segment from the labelled endpoints', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (3, 4)');
    addInput(kernel, 'Segment(A, B)');

    const segment = ofType(kernel, GeoSegment)[0];
    expect(segment.startPoint.label).toBe('A');
    expect(segment.endPoint.label).toBe('B');
    expect(segment.endPoint.getX()).toBeCloseTo(3, 10);
    expect(segment.endPoint.getY()).toBeCloseTo(4, 10);
  });
});
