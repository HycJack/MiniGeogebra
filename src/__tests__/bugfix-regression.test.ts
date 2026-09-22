import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoCirclePointRadius } from '../kernel/algo/AlgoCirclePointRadius';
import { AlgoPointOnConic } from '../kernel/algo/AlgoPointOnConic';
import { AlgoMidpoint } from '../kernel/algo/AlgoMidpoint';
import { AlgoLocus } from '../kernel/algo/AlgoLocus';
import { AlgoArc } from '../kernel/algo/AlgoArc';
import { AlgoRotate } from '../kernel/algo/AlgoRotate';
import { AlgoConicFivePoints } from '../kernel/algo/AlgoConicFivePoints';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoArc } from '../kernel/geo/GeoArc';
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

const ofType = <T>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  c(kernel).getElements().filter(el => el instanceof (type as any)) as T[];

describe('AlgoLocus recompute (regression: self-recursion stack overflow)', () => {
  it('builds a locus for a point on a circle without stack overflow', () => {
    const kernel = makeKernel();
    const O = makePoint(kernel, 0, 0, 'O');
    const circleAlgo = new AlgoCirclePointRadius(kernel, O, 3);
    c(kernel).addElement(circleAlgo);
    const circle = circleAlgo.getOutput();
    const param = new GeoNumeric(kernel, 0);
    c(kernel).addElement(param); // 默认区间 [0, 2π]
    const poc = new AlgoPointOnConic(kernel, circle, param);
    c(kernel).addElement(poc);
    const driver = poc.getOutput();
    circleAlgo.update(); poc.update();
    const midAlgo = new AlgoMidpoint(kernel, O, driver);
    c(kernel).addElement(midAlgo);
    const tracer = midAlgo.getOutput();
    midAlgo.update();

    const locus = new AlgoLocus(kernel, tracer, driver);
    c(kernel).addElement(locus);
    expect(() => locus.update()).not.toThrow();
    expect(locus.getOutputLocus().samples.length).toBe(120);
    // 轨迹是半径 1.5 的圆上的点，采样点应落在该圆附近
    const s = locus.getOutputLocus().samples[30];
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1.5, 5);
  });

  it('recomputes when the driver parameter changes', () => {
    const kernel = makeKernel();
    const O = makePoint(kernel, 0, 0, 'O');
    const circleAlgo = new AlgoCirclePointRadius(kernel, O, 3);
    c(kernel).addElement(circleAlgo);
    const circle = circleAlgo.getOutput();
    const param = new GeoNumeric(kernel, 0);
    c(kernel).addElement(param);
    const poc = new AlgoPointOnConic(kernel, circle, param);
    c(kernel).addElement(poc);
    const driver = poc.getOutput();
    circleAlgo.update(); poc.update();
    const tracerAlgo = new AlgoMidpoint(kernel, O, driver);
    c(kernel).addElement(tracerAlgo);

    param.setValue(0);
    c(kernel).updateAllAlgorithms();
    expect(driver.getX()).toBeCloseTo(3, 5);
  });
});

describe('withBatchedUpdates flush (regression: updates stuck inside batch)', () => {
  it('recomputes dependents queued during the batch when the batch ends', () => {
    const kernel = makeKernel();
    const a = new GeoNumeric(kernel, 1);
    a.label = 'a';
    c(kernel).addElement(a);
    addInput(kernel, 'b = a + 1');
    const b = ofType(kernel, GeoNumeric).find(n => n.label === 'b')!;
    expect(b.getValue()).toBe(2);

    kernel.withBatchedUpdates(() => {
      a.setValue(5);
      // 批次内依赖值允许暂时陈旧（干算语义），但批次结束时必须已被同步冲刷
    });
    expect(b.getValue()).toBe(6);
  });
});

describe('transform algorithms recompute (regression: frozen outputs)', () => {
  it('AlgoRotate follows a moving source point', () => {
    const kernel = makeKernel();
    const P = makePoint(kernel, 1, 0, 'P');
    const algo = new AlgoRotate(kernel, P, { x: 0, y: 0 }, Math.PI / 2);
    c(kernel).addElement(algo);
    const out = algo.getOutput() as GeoPoint;
    expect(out.getX()).toBeCloseTo(0, 5);
    expect(out.getY()).toBeCloseTo(1, 5);

    P.setCoords(2, 0, 1);
    c(kernel).updateAllAlgorithms();
    expect(out.getX()).toBeCloseTo(0, 5);
    expect(out.getY()).toBeCloseTo(2, 5);
  });
});

describe('AlgoArc recompute (regression: frozen arc)', () => {
  it('follows a moved end point', () => {
    const kernel = makeKernel();
    const O = makePoint(kernel, 0, 0, 'O');
    const S = makePoint(kernel, 3, 0, 'S');
    const E = makePoint(kernel, 0, 3, 'E');
    const algo = new AlgoArc(kernel, O, S, E);
    c(kernel).addElement(algo);
    const arc = algo.getOutput();
    expect(arc.getEndAngle()).toBeCloseTo(Math.PI / 2, 5);

    E.setCoords(0, -3, 1);
    c(kernel).updateAllAlgorithms();
    expect(arc.getEndAngle()).toBeCloseTo(-Math.PI / 2, 5);
  });
});

describe('AlgoConicFivePoints (regression: conics through the origin)', () => {
  it('recovers a circle passing through the origin (F = 0)', () => {
    const kernel = makeKernel();
    // 圆 x² + y² - 2x = 0 过原点，固定 F=1 的旧解法会误判无解
    const pts = [0, 72, 144, 216, 288].map(deg => {
      const rad = deg * Math.PI / 180;
      return makePoint(kernel, 1 + Math.cos(rad), Math.sin(rad));
    });
    const algo = new AlgoConicFivePoints(kernel, pts);
    c(kernel).addElement(algo);
    algo.update();
    const conic = algo.getOutput();
    expect(conic.isDefined()).toBe(true);
    expect(conic.getConicType()).toBe('circle');
    const [A, B, cc, D, E, F] = conic.coeffs;
    const evalAt = (x: number, y: number) => A * x * x + B * x * y + cc * y * y + D * x + E * y + F;
    for (const deg of [10, 100, 250]) {
      const rad = deg * Math.PI / 180;
      expect(evalAt(1 + Math.cos(rad), Math.sin(rad))).toBeCloseTo(0, 6);
    }
  });
});

describe('serializer coverage (regression: unimportable types)', () => {
  const roundtrip = (kernel: Kernel): Kernel => {
    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    return restored;
  };

  it('round-trips a GeoPolygon with its vertices', () => {
    const kernel = makeKernel();
    const p1 = makePoint(kernel, 0, 0, 'A');
    const p2 = makePoint(kernel, 4, 0, 'B');
    const p3 = makePoint(kernel, 0, 3, 'C');
    const poly = new GeoPolygon(kernel, [p1, p2, p3]);
    poly.label = 'poly1';
    c(kernel).addElement(poly);

    const restored = roundtrip(kernel);
    const polys = ofType(restored, GeoPolygon);
    expect(polys).toHaveLength(1);
    expect(polys[0].label).toBe('poly1');
    expect(polys[0].vertices.map(v => v.label)).toEqual(['A', 'B', 'C']);
    // 顶点 (0,0)(4,0)(0,3) 的鞋带面积 = 6
    const vs = polys[0].vertices;
    let area = 0;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      area += vs[j].getX() * vs[i].getY() - vs[i].getX() * vs[j].getY();
    }
    expect(Math.abs(area) / 2).toBeCloseTo(6, 5);
  });

  it('round-trips AlgoRotate including its rotation angle and center', () => {
    const kernel = makeKernel();
    const P = makePoint(kernel, 1, 0, 'P');
    const algo = new AlgoRotate(kernel, P, { x: 0, y: 0 }, Math.PI / 2);
    algo.getOutput().label = "P'";
    c(kernel).addElement(algo);

    const restored = roundtrip(kernel);
    const rotated = ofType(restored, GeoPoint).find(p => p.label === "P'");
    expect(rotated).toBeDefined();
    expect(rotated!.getX()).toBeCloseTo(0, 5);
    expect(rotated!.getY()).toBeCloseTo(1, 5);
  });

  it('round-trips an arc built by AlgoArc', () => {
    const kernel = makeKernel();
    const O = makePoint(kernel, 0, 0, 'O');
    const S = makePoint(kernel, 3, 0, 'S');
    const E = makePoint(kernel, 0, 3, 'E');
    const algo = new AlgoArc(kernel, O, S, E);
    algo.getOutput().label = 'a1';
    c(kernel).addElement(algo);

    const restored = roundtrip(kernel);
    const arcs = ofType(restored, GeoArc);
    expect(arcs).toHaveLength(1);
    expect(arcs[0].getRadius()).toBeCloseTo(3, 5);
    expect(arcs[0].getEndAngle()).toBeCloseTo(Math.PI / 2, 5);
  });

  it('round-trips Derivative(f) as an equivalent dependent function', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 3');
    addInput(kernel, 'f(x) = a*x');
    const derived = parseAlgebraInput(kernel, 'Derivative(f)');
    derived.forEach(el => c(kernel).addElement(el));
    c(kernel).updateAllAlgorithms();

    const restored = roundtrip(kernel);
    const fns = ofType(restored, GeoFunction);
    expect(fns).toHaveLength(2);
    // f'(x) = a = 3：导函数经表达式重建后仍可求值且随滑块联动
    const fPrime = fns.find(fn => fn.label !== 'f')!;
    expect(fPrime.evaluateAt(5)).toBeCloseTo(3, 6);
  });

  it('keeps the current construction intact when the file is invalid', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 2, 'P');
    expect(() => deserialize(kernel, '{not json')).toThrow();
    expect(ofType(kernel, GeoPoint)).toHaveLength(1);
  });
});
