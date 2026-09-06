import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoRay } from '../kernel/geo/GeoRay';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoConic } from '../kernel/geo/GeoConic';
import { AlgoSegmentTwoPoints } from '../kernel/algo/AlgoSegmentTwoPoints';
import { AlgoLineTwoPoints } from '../kernel/algo/AlgoLineTwoPoints';
import { AlgoRayTwoPoints } from '../kernel/algo/AlgoRayTwoPoints';
import { AlgoCircleCenterPoint } from '../kernel/algo/AlgoCircleCenterPoint';
import { AlgoVector } from '../kernel/algo/AlgoVector';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const ofType = <T extends ConstructionElement>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  kernel.getConstruction().getElements().filter((el): el is T => el instanceof type);

describe('GeoGebra command input: points', () => {
  it('Point(x, y) creates a labelled free point', () => {
    const kernel = makeKernel();
    const elements = addInput(kernel, 'Point(1, 2)');

    expect(elements).toHaveLength(1);
    const point = ofType(kernel, GeoPoint)[0];
    expect(point.label).toBe('A');
    expect(point.getX()).toBeCloseTo(1, 10);
    expect(point.getY()).toBeCloseTo(2, 10);
    expect(point.isIndependent()).toBe(true);
  });

  it('Point(x, y) evaluates numeric expressions for each coordinate', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Point(2 + 3, 4 * 2)');

    const point = ofType(kernel, GeoPoint)[0];
    expect(point.getX()).toBeCloseTo(5, 10);
    expect(point.getY()).toBeCloseTo(8, 10);
  });

  it('Point((x, y)) is not supported and reports a parse error', () => {
    const kernel = makeKernel();
    expect(() => parseAlgebraInput(kernel, 'Point((1, 2))')).toThrow();
  });

  it('"A = (1, 2)" creates a point from a coordinate tuple', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 2)');

    // 曾是不可达分支：parseExpression(rightText) 先于 tryParseCoordTuple 执行，
    // "(1, 2)" 被当成非法算术表达式而抛 "Missing ")""。现在元组判断已提前。
    const point = ofType(kernel, GeoPoint)[0];
    expect(point.label).toBe('A');
    expect(point.getX()).toBeCloseTo(1, 10);
    expect(point.getY()).toBeCloseTo(2, 10);
    expect(point.isIndependent()).toBe(true);
    expect(ofType(kernel, GeoPoint)).toHaveLength(1);
  });
});

describe('GeoGebra command input: two-point objects', () => {
  const fresh = () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    makePoint(kernel, 4, 5, 'B');
    return kernel;
  };

  it('Segment(A, B) rebuilds the segment from the labelled endpoints', () => {
    const kernel = fresh();
    addInput(kernel, 'Segment(A, B)');

    const segment = ofType(kernel, GeoSegment)[0];
    expect(segment.label).toBe('l1');
    expect(segment.startPoint.label).toBe('A');
    expect(segment.endPoint.label).toBe('B');
    expect(segment.a).toBeCloseTo(-4, 10);
    expect(segment.b).toBeCloseTo(3, 10);
    expect(segment.c).toBeCloseTo(1, 10);
    expect(ofType(kernel, AlgoSegmentTwoPoints)).toHaveLength(1);
  });

  it('Line(A, B) rebuilds the line equation', () => {
    const kernel = fresh();
    addInput(kernel, 'Line(A, B)');

    const line = ofType(kernel, GeoLine)[0];
    expect(line.label).toBe('l1');
    expect(line.a).toBeCloseTo(-4, 10);
    expect(line.b).toBeCloseTo(3, 10);
    expect(line.c).toBeCloseTo(1, 10);
    expect(ofType(kernel, AlgoLineTwoPoints)).toHaveLength(1);
  });

  it('Ray(A, B) keeps start and direction point', () => {
    const kernel = fresh();
    addInput(kernel, 'Ray(A, B)');

    const ray = ofType(kernel, GeoRay)[0];
    expect(ray.label).toBe('l1');
    expect(ray.getStartPoint().label).toBe('A');
    expect(ray.getSecondPoint().label).toBe('B');
    expect(ofType(kernel, AlgoRayTwoPoints)).toHaveLength(1);
  });

  it('Vector(A, B) keeps start and end', () => {
    const kernel = fresh();
    addInput(kernel, 'Vector(A, B)');

    const vector = ofType(kernel, GeoVector)[0];
    expect(vector.label).toBe('l1');
    expect(vector.startX).toBeCloseTo(1, 10);
    expect(vector.endX).toBeCloseTo(4, 10);
    expect(vector.endY).toBeCloseTo(5, 10);
    expect(ofType(kernel, AlgoVector)).toHaveLength(1);
  });

  it('Circle(A, B) uses A as center and |AB| as radius', () => {
    const kernel = fresh();
    addInput(kernel, 'Circle(A, B)');

    const circle = ofType(kernel, GeoConic)[0];
    expect(circle.label).toBe('c1');
    const center = circle.getCenter();
    expect(center.x).toBeCloseTo(1, 8);
    expect(center.y).toBeCloseTo(1, 8);
    expect(circle.getRadius()).toBeCloseTo(5, 8);
    expect(ofType(kernel, AlgoCircleCenterPoint)).toHaveLength(1);
  });

  it('accepts inline coordinate tuples as arguments', () => {
    const kernel = makeKernel();
    // 曾不可达：argsText.split(/\s*,\s*/) 先拆掉元组内的逗号，把 "(0, 0), (3, 4)"
    // 切成 4 个参数而触发 arity 报错，解析器内部的 tuple 分支因此是死代码。
    // 现在 splitArgs 只按顶层逗号切分。
    addInput(kernel, 'Segment((0, 0), (3, 4))');

    const segment = ofType(kernel, GeoSegment)[0];
    expect(segment.startPoint.getX()).toBeCloseTo(0, 10);
    expect(segment.startPoint.getY()).toBeCloseTo(0, 10);
    expect(segment.endPoint.getX()).toBeCloseTo(3, 10);
    expect(segment.endPoint.getY()).toBeCloseTo(4, 10);
  });

  it('Circle((1, 1), (4, 5)) builds the circle from two inline points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Circle((1, 1), (4, 5))');

    const circle = ofType(kernel, GeoConic)[0];
    const center = circle.getCenter();
    expect(center.x).toBeCloseTo(1, 8);
    expect(center.y).toBeCloseTo(1, 8);
    expect(circle.getRadius()).toBeCloseTo(5, 8);
  });
  it('resolves every argument by an existing point label', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 3, 4, 'B');

    addInput(kernel, 'Segment(A, B)');

    const segment = ofType(kernel, GeoSegment)[0];
    expect(segment.label).toBe('l1');
    expect(Math.hypot(segment.endPoint.getX() - segment.startPoint.getX(), segment.endPoint.getY() - segment.startPoint.getY()))
      .toBeCloseTo(5, 10);
  });
});

describe('GeoGebra command input: error paths', () => {
  it('rejects unknown point labels', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');

    expect(() => parseAlgebraInput(kernel, 'Segment(Q, Z)')).toThrow(/Unknown point "Q"/);
    expect(() => parseAlgebraInput(kernel, 'Circle(A, ZZ)')).toThrow(/Unknown point "ZZ"/);
  });

  it('rejects a wrong argument count', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');

    expect(() => parseAlgebraInput(kernel, 'Point(1)')).toThrow(/requires 2 arguments/);
    expect(() => parseAlgebraInput(kernel, 'Point(1, 2, 3)')).toThrow(/requires 2 arguments/);
    expect(() => parseAlgebraInput(kernel, 'Segment(A)')).toThrow(/requires 2 arguments/);
    expect(() => parseAlgebraInput(kernel, 'Circle()')).toThrow(/requires 2 or 3 arguments/);
  });

  it('rejects illegal numeric expressions in Point(x, y)', () => {
    const kernel = makeKernel();

    expect(() => parseAlgebraInput(kernel, 'Point(foo, 2)')).toThrow(/Invalid coordinate/);
    expect(() => parseAlgebraInput(kernel, 'Point(1 + *2, 3)')).toThrow();
    expect(() => parseAlgebraInput(kernel, 'Point(1/0, 3)')).toThrow(/Invalid coordinate/);
  });

  it('rejects an unknown command name', () => {
    const kernel = makeKernel();
    expect(() => parseAlgebraInput(kernel, 'Hyperboloid(1, 2)')).toThrow();
  });
});

describe('GeoGebra command input: label allocation', () => {
  it('never reuses a label and increments per object family', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Point(1, 2)');
    addInput(kernel, 'Point(3, 4)');
    addInput(kernel, 'Point(5, 6)');
    addInput(kernel, 'Segment(A, B)');
    addInput(kernel, 'Line(C, A)');
    addInput(kernel, 'Circle(A, B)');
    addInput(kernel, 'Vector(A, C)');

    const labels = kernel
      .getConstruction()
      .getElements()
      .map(el => (el as { label?: string }).label)
      .filter((label): label is string => Boolean(label));

    expect(new Set(labels).size).toBe(labels.length);
    expect(ofType(kernel, GeoPoint).map(p => p.label)).toEqual(['A', 'B', 'C']);
    expect(labels.filter(l => l.startsWith('l')).sort()).toEqual(['l1', 'l2', 'l3']);
    expect(labels.filter(l => l.startsWith('c')).sort()).toEqual(['c1']);
  });

  it('skips labels already taken by existing points', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 0, 0, 'B');

    addInput(kernel, 'Point(9, 9)');

    expect(ofType(kernel, GeoPoint).map(p => p.label)).toEqual(['A', 'B', 'C']);
  });
});
