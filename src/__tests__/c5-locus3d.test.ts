/**
 * C5：3D 空间轨迹（AlgoLocus3D / GeoLocus3D）—— 对标 GeoGebra AlgoLocusND。
 */

import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoCircle3D } from '../kernel/geo/GeoCircle3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoLocus3D } from '../kernel/geo/GeoLocus3D';
import { AlgoLocus } from '../kernel/algo/AlgoLocus';
import { AlgoLocus3D } from '../kernel/algo/AlgoLocus3D';
import { AlgoPointOnCircle3D, AlgoPointOnLine3D } from '../kernel/algo/AlgoPointOn3D';
import { AlgoPointOnConic } from '../kernel/algo/AlgoPointOnConic';
import { AlgoMidpoint3D } from '../kernel/algo/Algo3D';
import { Coords4 } from '../kernel/core/Coords4';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel } from './helpers';

const c = (kernel: Kernel) => kernel.getConstruction();

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => c(kernel).addElement(el));
  c(kernel).updateAllAlgorithms();
  kernel.flushNow?.();
  return elements;
};

const ofType = <T>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  c(kernel).getElements().filter(el => el instanceof (type as any)) as T[];

const addElement = (kernel: Kernel, el: unknown) => {
  c(kernel).addElement(el as any);
  c(kernel).updateAllAlgorithms();
  kernel.flushNow?.();
  return el;
};

describe('AlgoLocus3D', () => {
  it('traces a midpoint of a circle point — 120 samples on a circle in 3D', () => {
    const kernel = makeKernel();
    const circle = new GeoCircle3D(kernel);
    circle.setCircle(Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(0, 0, 1), 3);
    addElement(kernel, circle);
    const param = new GeoNumeric(kernel, 0);
    addElement(kernel, param);
    const poc = new AlgoPointOnCircle3D(kernel, circle, param);
    addElement(kernel, poc);
    addElement(kernel, poc.getOutput());
    const driver = poc.getOutput();

    const origin = new GeoPoint3D(kernel, Coords4.fromPoint(0, 0, 0));
    origin.label = 'O3';
    addElement(kernel, origin);
    const mid = new AlgoMidpoint3D(kernel, origin, driver);
    addElement(kernel, mid);
    addElement(kernel, mid.getOutput());
    const tracer = mid.getOutput();

    const locus = new AlgoLocus3D(kernel, tracer, driver);
    addElement(kernel, locus);
    expect(() => locus.update()).not.toThrow();
    const out = locus.getOutputLocus();
    expect(out.isDefined()).toBe(true);
    expect(out.samples.length).toBe(120);
    expect(out.segments.length).toBeGreaterThanOrEqual(1);
    // 中点轨迹：半径 1.5 的圆（z=0 平面）
    const s = out.samples[30];
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1.5, 5);
    expect(s.z).toBeCloseTo(0, 6);
    for (const p of out.samples) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1.5, 4);
    }
  });

  it('traces a line segment: driver = point on line, tracer = driver', () => {
    const kernel = makeKernel();
    const line = new GeoLine3D(
      kernel, Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(1, 0, 0),
    );
    addElement(kernel, line);
    const param = new GeoNumeric(kernel, 0);
    param.intervalMin = 0;
    param.intervalMax = 4;
    addElement(kernel, param);
    const algo = new AlgoPointOnLine3D(kernel, line, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    const driver = algo.getOutput();

    const locus = new AlgoLocus3D(kernel, driver, driver);
    addElement(kernel, locus);
    expect(locus.getOutputLocus().samples.length).toBe(120);
    for (const p of locus.getOutputLocus().samples) {
      expect(p.y).toBeCloseTo(0, 6);
      expect(p.z).toBeCloseTo(0, 6);
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x).toBeLessThanOrEqual(4 + 1e-6);
    }
    expect(locus.getOutputLocus().samples[0].x).toBeCloseTo(0, 6);
    expect(locus.getOutputLocus().samples[119].x).toBeCloseTo(4, 6);
  });

  it('traces a circle in a plane z=2', () => {
    const kernel = makeKernel();
    const circle = new GeoCircle3D(kernel);
    circle.setCircle(Coords4.fromPoint(0, 0, 2), Coords4.fromDirection(0, 0, 1), 1);
    addElement(kernel, circle);
    const param = new GeoNumeric(kernel, 0);
    addElement(kernel, param);
    const poc = new AlgoPointOnCircle3D(kernel, circle, param);
    addElement(kernel, poc);
    addElement(kernel, poc.getOutput());
    const driver = poc.getOutput();

    const locus = new AlgoLocus3D(kernel, driver, driver);
    addElement(kernel, locus);
    const samples = locus.getOutputLocus().samples;
    expect(samples.length).toBe(120);
    for (const p of samples) {
      expect(p.z).toBeCloseTo(2, 6);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 4);
    }
  });

  it('undefined tracer yields undefined locus', () => {
    const kernel = makeKernel();
    const line = new GeoLine3D(
      kernel, Coords4.fromPoint(0, 0, 0), Coords4.fromDirection(1, 0, 0),
    );
    addElement(kernel, line);
    const param = new GeoNumeric(kernel, 0);
    addElement(kernel, param);
    const algo = new AlgoPointOnLine3D(kernel, line, param);
    addElement(kernel, algo);
    addElement(kernel, algo.getOutput());
    const free = new GeoPoint3D(kernel, Coords4.fromPoint(1, 1, 1));
    free.setUndefined();
    addElement(kernel, free);
    const locus = new AlgoLocus3D(kernel, free, algo.getOutput());
    addElement(kernel, locus);
    expect(locus.getOutputLocus().isDefined()).toBe(false);
    expect(locus.getOutputLocus().samples).toHaveLength(0);
  });

  it('free driver (no parameter) yields undefined locus', () => {
    const kernel = makeKernel();
    const a = new GeoPoint3D(kernel, Coords4.fromPoint(0, 0, 0));
    const b = new GeoPoint3D(kernel, Coords4.fromPoint(1, 1, 1));
    addElement(kernel, a);
    addElement(kernel, b);
    const locus = new AlgoLocus3D(kernel, b, a);
    addElement(kernel, locus);
    expect(locus.getOutputLocus().isDefined()).toBe(false);
  });
});

describe('Locus algebra wiring (2D + 3D)', () => {
  it('Locus(Q, P) creates AlgoLocus3D for 3D points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'A = (3, 0, 0)');
    addInput(kernel, 'B = (0, 3, 0)');
    addInput(kernel, 'C = (-3, 0, 0)');
    addInput(kernel, 'c3 = Circle3D(A, B, C)');
    addInput(kernel, 'PointOn(c3)');
    const driver = ofType(kernel, AlgoPointOnCircle3D)[0].getOutput();
    const origin = ofType(kernel, GeoPoint3D).find(p => p.label === 'O')!;
    addInput(kernel, `M = Midpoint3D(${origin.label}, ${driver.label})`);
    const midAlgo = ofType(kernel, AlgoMidpoint3D)[0];
    const tracer = midAlgo.getOutput();
    expect(tracer.label).toBeTruthy();

    const elements = addInput(kernel, `Locus(${tracer.label}, ${driver.label})`);
    const algo = elements.find(el => el instanceof AlgoLocus3D) as AlgoLocus3D | undefined;
    expect(algo).toBeDefined();
    expect(algo!.getOutputLocus().isDefined()).toBe(true);
    expect(algo!.getOutputLocus().samples.length).toBe(120);
  });

  it('Locus falls back to 2D AlgoLocus for 2D points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0)');
    addInput(kernel, 'c = Circle(O, 3)');
    addInput(kernel, 'PointOn(c)');
    const driver = ofType(kernel, AlgoPointOnConic)[0].getOutput();
    const elements = addInput(kernel, `Locus(${driver.label}, ${driver.label})`);
    expect(elements.some(el => el instanceof AlgoLocus)).toBe(true);
  });

  it('rejects unknown Locus arguments', () => {
    const kernel = makeKernel();
    expect(() => addInput(kernel, 'Locus(nope, alsonope)')).toThrow();
  });
});

describe('GeoLocus3D serialize round-trip', () => {
  it('AlgoLocus3D survives save/load', () => {
    const kernel = makeKernel();
    // 依赖圆（Circle3D 三点）可随算法链序列化；自由 GeoCircle3D 尚不支持
    addInput(kernel, 'A = (2, 0, 0)');
    addInput(kernel, 'B = (0, 2, 0)');
    addInput(kernel, 'C = (-2, 0, 0)');
    addInput(kernel, 'c = Circle3D(A, B, C)');
    addInput(kernel, 'PointOn(c)');
    addInput(kernel, `Locus(${ofType(kernel, AlgoPointOnCircle3D)[0].getOutput().label}, ${ofType(kernel, AlgoPointOnCircle3D)[0].getOutput().label})`);
    const original = ofType(kernel, AlgoLocus3D)[0];
    expect(original.getOutputLocus().samples.length).toBe(120);

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const algos = restored.getConstruction().getElements()
      .filter(el => el instanceof AlgoLocus3D) as AlgoLocus3D[];
    expect(algos).toHaveLength(1);
    algos[0].update();
    expect(algos[0].getOutputLocus().samples.length).toBe(120);
    expect(algos[0].getOutputLocus().isDefined()).toBe(true);
  });
});
