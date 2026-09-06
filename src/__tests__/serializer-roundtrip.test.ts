import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric, AnimationType } from '../kernel/geo/GeoNumeric';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoRay } from '../kernel/geo/GeoRay';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { AlgoSegmentTwoPoints } from '../kernel/algo/AlgoSegmentTwoPoints';
import { AlgoRayTwoPoints } from '../kernel/algo/AlgoRayTwoPoints';
import { AlgoMidpoint } from '../kernel/algo/AlgoMidpoint';
import { AlgoParallelLine } from '../kernel/algo/AlgoParallelLine';
import { AlgoOrthogonalLine } from '../kernel/algo/AlgoOrthogonalLine';
import { AlgoPointOnFunction } from '../kernel/algo/AlgoPointOnFunction';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { deserialize, serialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel, makePoint } from './helpers';

/** parseAlgebraInput returns elements without registering them; mirror the app's wiring. */
const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const roundtrip = (kernel: Kernel, coord?: CoordinateSystem): Kernel => {
  const restored = new Kernel();
  deserialize(restored, serialize(kernel, coord));
  return restored;
};

const ofType = <T extends ConstructionElement>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  kernel.getConstruction().getElements().filter((el): el is T => el instanceof type);

const byLabel = <T extends ConstructionElement & { label: string }>(
  kernel: Kernel,
  type: new (...args: any[]) => T,
  label: string,
): T => {
  const found = ofType(kernel, type).find(el => el.label === label);
  if (!found) throw new Error(`expected a ${type.name} labelled "${label}"`);
  return found;
};

const numbers = (kernel: Kernel) => ofType(kernel, GeoNumeric);
const points = (kernel: Kernel) => ofType(kernel, GeoPoint);
const functions = (kernel: Kernel) => ofType(kernel, GeoFunction);

describe('serialize -> deserialize fidelity', () => {
  it('round-trips an independent point with its label and coordinates', () => {
    const kernel = makeKernel();
    makePoint(kernel, 2.5, -3.25, 'P7');

    const restored = roundtrip(kernel);
    const point = byLabel(restored, GeoPoint, 'P7');

    expect(point.getX()).toBeCloseTo(2.5, 10);
    expect(point.getY()).toBeCloseTo(-3.25, 10);
    expect(point.getZ()).toBe(1);
    expect(point.isIndependent()).toBe(true);
    expect(points(restored)).toHaveLength(1);
  });

  it('round-trips a slider value, interval, and animation settings', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 3');
    const source = byLabel(kernel, GeoNumeric, 'a');
    source.intervalMin = -5;
    source.intervalMax = 10;
    source.animationSpeed = 2.5;
    source.animationIncrement = 0.25;
    source.setAnimationType(AnimationType.INCREASING);

    const restored = roundtrip(kernel);
    const numeric = byLabel(restored, GeoNumeric, 'a');

    expect(numeric.getValue()).toBe(3);
    expect(numeric.intervalMin).toBe(-5);
    expect(numeric.intervalMax).toBe(10);
    expect(numeric.animationSpeed).toBe(2.5);
    expect(numeric.animationIncrement).toBe(0.25);
    expect(numeric.animationType).toBe(AnimationType.INCREASING);
  });

  it('round-trips a segment with its label and endpoints', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 4, 3, 'B');
    addInput(kernel, 'Segment(A, B)');

    const restored = roundtrip(kernel);
    const segment = byLabel(restored, GeoSegment, 'l1');

    expect(segment.startPoint.label).toBe('A');
    expect(segment.endPoint.label).toBe('B');
    expect(segment.startPoint.getX()).toBeCloseTo(0, 10);
    expect(segment.endPoint.getX()).toBeCloseTo(4, 10);
    expect(segment.endPoint.getY()).toBeCloseTo(3, 10);
    expect(segment.b).toBeCloseTo(4, 10);
    expect(segment.a).toBeCloseTo(-3, 10);
    expect(segment.c).toBeCloseTo(0, 10);
  });

  it('round-trips a line with its coefficients', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 2, 'A');
    makePoint(kernel, 4, 6, 'B');
    addInput(kernel, 'Line(A, B)');

    const restored = roundtrip(kernel);
    const line = byLabel(restored, GeoLine, 'l1');

    expect(line.a).toBeCloseTo(-4, 10);
    expect(line.b).toBeCloseTo(3, 10);
    expect(line.c).toBeCloseTo(-2, 10);
  });

  it('round-trips a ray with its start and direction point', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    makePoint(kernel, 4, 5, 'B');
    addInput(kernel, 'Ray(A, B)');

    const restored = roundtrip(kernel);
    const ray = byLabel(restored, GeoRay, 'l1');

    expect(ray.getStartPoint().label).toBe('A');
    expect(ray.getSecondPoint().label).toBe('B');
    expect(ray.getSecondPoint().getX()).toBeCloseTo(4, 10);
    expect(ray.getSecondPoint().getY()).toBeCloseTo(5, 10);
  });

  it('round-trips a vector with its start and end', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 2, 'A');
    makePoint(kernel, 4, 6, 'B');
    addInput(kernel, 'Vector(A, B)');

    const restored = roundtrip(kernel);
    const vector = byLabel(restored, GeoVector, 'l1');

    expect(vector.startX).toBeCloseTo(1, 10);
    expect(vector.startY).toBeCloseTo(2, 10);
    expect(vector.endX).toBeCloseTo(4, 10);
    expect(vector.endY).toBeCloseTo(6, 10);
  });

  it('round-trips a circle with its center and radius', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    makePoint(kernel, 4, 5, 'B');
    addInput(kernel, 'Circle(A, B)');

    const restored = roundtrip(kernel);
    const circle = byLabel(restored, GeoConic, 'c1');
    const center = circle.getCenter();

    expect(center.x).toBeCloseTo(1, 8);
    expect(center.y).toBeCloseTo(1, 8);
    expect(circle.getRadius()).toBeCloseTo(5, 8);
  });

  it('round-trips derived midpoints, parallels, and perpendiculars', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    makePoint(kernel, 6, 4, 'B');
    makePoint(kernel, 0, 5, 'C');
    const line = addInput(kernel, 'Line(A, B)')
      .find((el): el is GeoLine => el instanceof GeoLine)!;
    line.label = 'l1';

    const midpointAlgo = new AlgoMidpoint(kernel, points(kernel).find(p => p.label === 'A')!, points(kernel).find(p => p.label === 'B')!);
    kernel.getConstruction().addElement(midpointAlgo);
    kernel.getConstruction().addElement(midpointAlgo.getOutput());
    midpointAlgo.getOutput().label = 'M';

    const parallelAlgo = new AlgoParallelLine(kernel, points(kernel).find(p => p.label === 'C')!, line);
    kernel.getConstruction().addElement(parallelAlgo);
    kernel.getConstruction().addElement(parallelAlgo.getOutput());
    parallelAlgo.getOutput().label = 'l2';

    const orthoAlgo = new AlgoOrthogonalLine(kernel, points(kernel).find(p => p.label === 'C')!, line);
    kernel.getConstruction().addElement(orthoAlgo);
    kernel.getConstruction().addElement(orthoAlgo.getOutput());
    orthoAlgo.getOutput().label = 'l3';

    kernel.getConstruction().updateAllAlgorithms();

    const restored = roundtrip(kernel);
    expect(byLabel(restored, GeoPoint, 'M').getX()).toBeCloseTo(3, 10);
    expect(byLabel(restored, GeoPoint, 'M').getY()).toBeCloseTo(2, 10);
    expect(byLabel(restored, GeoLine, 'l2').a).toBeCloseTo(-4, 10);
    expect(byLabel(restored, GeoLine, 'l2').b).toBeCloseTo(6, 10);
    expect(byLabel(restored, GeoLine, 'l2').c).toBeCloseTo(-30, 10);
    expect(byLabel(restored, GeoLine, 'l3').a).toBeCloseTo(-6, 10);
    expect(byLabel(restored, GeoLine, 'l3').b).toBeCloseTo(-4, 10);
    expect(byLabel(restored, GeoLine, 'l3').c).toBeCloseTo(20, 10);
  });

  it('round-trips a named function expression and keeps it evaluable', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2 + 3x - 1');

    const restored = roundtrip(kernel);
    const fn = byLabel(restored, GeoFunction, 'f');

    expect(fn.evaluateAt(2)).toBe(9);
    expect(fn.evaluateAt(0)).toBe(-1);
    expect(fn.expressionText).toBe('x^2 + 3x - 1');
    expect(fn.getAlgebraDescription()).toBe('f(x) = x^2 + 3x - 1');
  });

  it('round-trips a bare expression function', () => {
    const kernel = makeKernel();
    addInput(kernel, '2x + 3');

    const restored = roundtrip(kernel);
    const fn = functions(restored)[0];

    expect(fn.label).toBe('f');
    expect(fn.evaluateAt(2)).toBe(7);
  });

  it('round-trips a literal number and a dependent number chain', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 3');
    addInput(kernel, 'b = a + 4');

    const restored = roundtrip(kernel);

    expect(numbers(restored).map(n => n.label)).toEqual(['a', 'b']);
    expect(byLabel(restored, GeoNumeric, 'a').getValue()).toBe(3);
    expect(byLabel(restored, GeoNumeric, 'b').getValue()).toBe(7);
  });

  it('round-trips a slider, a dependent function, and a point on that function', () => {
    const kernel = buildSliderFunctionPoint();
    const restored = roundtrip(kernel);

    const fn = byLabel(restored, GeoFunction, 'f');
    const slider = byLabel(restored, GeoNumeric, 'a');
    expect(fn.evaluateAt(2)).toBe(4);

    const point = ofType(restored, AlgoPointOnFunction)[0].getOutput();
    expect(point.label).toBe('Q');
    expect(point.getX()).toBeCloseTo(3, 10);
    expect(point.getY()).toBeCloseTo(6, 10);

    // The dependency chain must still be live after the round trip.
    slider.setValue(10);
    restored.flushNow();
    expect(fn.evaluateAt(2)).toBe(20);
    expect(point.getY()).toBeCloseTo(30, 10);
  });

  it('restores the saved view (coordinate system)', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 1, 'A');
    const coord = new CoordinateSystem(800, 600, 300, 200, 40, 40);

    const restored = new Kernel();
    const result = deserialize(restored, serialize(kernel, coord));

    expect(result.coord).toBeDefined();
    expect(result.coord!.xZero).toBe(300);
    expect(result.coord!.yZero).toBe(200);
    expect(result.coord!.xScale).toBe(40);
    expect(result.coord!.yScale).toBe(40);
    expect(result.coord!.width).toBe(800);
    expect(result.coord!.height).toBe(600);
  });

  it('emits v2 metadata used by the expression reconstruction path', () => {
    const kernel = buildSliderFunctionPoint();
    const data = JSON.parse(serialize(kernel)) as any;

    expect(data.version).toBe(2);
    const functionAlgo = data.algorithms.find((a: any) => a.type === 'AlgoDependentFunction');
    const pointAlgo = data.algorithms.find((a: any) => a.type === 'AlgoPointOnFunction');
    expect(functionAlgo.expressionText).toBe('a*x');
    expect(functionAlgo.variableName).toBe('x');
    expect(functionAlgo.outputIndices).toEqual([3]);
    expect(pointAlgo.inputs).toEqual([3, 4]);
    expect(pointAlgo.outputIndices).toEqual([6]);
  });

  it('still deserializes version 1 files without outputIndices', () => {
    const legacy = JSON.stringify({
      version: 1,
      generator: 'MiniGeogebra',
      independentElements: [
        { type: 'GeoPoint', constIndex: 1, label: 'A', coords: [0, 0, 1] },
        { type: 'GeoPoint', constIndex: 2, label: 'B', coords: [6, 0, 1] },
      ],
      algorithms: [
        { type: 'AlgoMidpoint', constIndex: 3, inputs: [1, 2], outputLabels: ['M'] },
        { type: 'AlgoSegmentTwoPoints', constIndex: 4, inputs: [1, 2], outputLabels: ['l1'] },
      ],
    });

    const restored = new Kernel();
    deserialize(restored, legacy);

    const midpoint = byLabel(restored, GeoPoint, 'M');
    expect(midpoint.getX()).toBeCloseTo(3, 10);
    expect(midpoint.getY()).toBeCloseTo(0, 10);
    const segment = byLabel(restored, GeoSegment, 'l1');
    expect(segment.startPoint.label).toBe('A');
    expect(segment.endPoint.label).toBe('B');
  });

  it('is idempotent across two round trips', () => {
    const source = buildSliderFunctionPoint();
    const once = roundtrip(source);
    const twice = roundtrip(once);

    const snapshot = (kernel: Kernel) => ({
      labels: kernel
        .getConstruction()
        .getElements()
        .map(el => `${el.constructor.name}:${(el as { label?: string }).label ?? ''}`)
        .sort(),
      a: byLabel(kernel, GeoNumeric, 'a').getValue(),
      f2: byLabel(kernel, GeoFunction, 'f').evaluateAt(2),
      q: ofType(kernel, AlgoPointOnFunction)[0].getOutput().getCoords(),
    });

    expect(snapshot(twice)).toEqual(snapshot(once));
  });
});

/** slider a + f(x) = a*x + a point constrained to f at x = 3. */
function buildSliderFunctionPoint(): Kernel {
  const kernel = makeKernel();
  const construction = kernel.getConstruction();
  addInput(kernel, 'a = 2');
  addInput(kernel, 'f(x) = a*x');
  const fn = byLabel(kernel, GeoFunction, 'f');

  const param = new GeoNumeric(kernel, 3);
  param.label = construction.getNextNumericLabel();
  construction.addElement(param);
  const algo = new AlgoPointOnFunction(kernel, fn, param);
  construction.addElement(algo);
  construction.addElement(algo.getOutput());
  algo.getOutput().label = 'Q';
  construction.updateAllAlgorithms();
  return kernel;
}
