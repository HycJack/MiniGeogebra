/**
 * C1：一般二次曲面（10 系数 + classifyQuadric + 方程创建）。
 * 类型 parity 对标 GeoGebra GeoQuadric3DTest.testObjectTypes。
 */

import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { AlgoDependentQuadric3D } from '../kernel/algo/AlgoDependentQuadric3D';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { classifyFlatQuadric, flatMatrixFromPolyCoeffs } from '../kernel/geo/quadricClassify';
import { Coords4 } from '../kernel/core/Coords4';
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

/** 由方程创建 quadric 并取输出（无标签时自动取第一个 GeoQuadric3D）。 */
const quadricOf = (kernel: Kernel, equation: string): GeoQuadric3D => {
  const before = new Set(ofType(kernel, GeoQuadric3D));
  const elements = addInput(kernel, equation);
  const created = elements.find(
    el => el instanceof GeoQuadric3D && !before.has(el as GeoQuadric3D),
  ) as GeoQuadric3D | undefined;
  if (created) return created;
  const all = ofType(kernel, GeoQuadric3D);
  const q = all[all.length - 1];
  if (!q) throw new Error(`no quadric created for: ${equation}`);
  return q;
};

describe('classifyFlatQuadric type strings (parity with GeoQuadric3DTest)', () => {
  const typed: [string, string][] = [
    ['(x - z)(x + z) = 0', 'Intersecting Planes'],
    ['(x - z)(x - z - 1) = 0', 'Parallel Planes'],
    ['(x - z)(x + z) = 1', 'Hyperbolic Cylinder'],
    ['x^2 - z = 0', 'Parabolic Cylinder'],
    ['x^2 + y^2 - z^2 = 1', 'Hyperboloid of one sheet'],
    ['x^2 + y^2 - z^2 = -1', 'Hyperboloid of two sheets'],
    ['x^2 + y^2 + z^2 = -1', 'Empty Set'],
    ['x^2 + y^2 + z^2 = 1', 'Sphere'],
    ['x^2 + y^2 + z^2 = 0', 'Point'],
    ['x^2 + z^2 = 0', 'Line'],
  ];

  for (const [eq, display] of typed) {
    it(`${eq} → ${display}`, () => {
      const kernel = makeKernel();
      const q = quadricOf(kernel, eq);
      expect(q.getTypeDisplay()).toBe(display);
      expect(q.isDefined()).toBe(true);
    });
  }
});

describe('setMatrix / classify unit', () => {
  it('classifies a unit sphere matrix', () => {
    // x²+y²+z²−1 → flat [1,1,1,−1,0…]
    const m = flatMatrixFromPolyCoeffs(1, 1, 1, -1, 0, 0, 0, 0, 0, 0);
    expect(classifyFlatQuadric(m)).toBe('Sphere');
  });

  it('classifies empty set', () => {
    const m = flatMatrixFromPolyCoeffs(1, 1, 1, 1, 0, 0, 0, 0, 0, 0);
    expect(classifyFlatQuadric(m)).toBe('EmptySet');
  });

  it('GeoQuadric3D.setMatrix fills sphere radius', () => {
    const kernel = makeKernel();
    const q = new GeoQuadric3D(kernel, 'sphere');
    q.setMatrix(flatMatrixFromPolyCoeffs(1, 1, 1, -4, 0, 0, 0, 0, 0, 0));
    expect(q.getTypeString()).toBe('Sphere');
    expect(q.getParam()).toBeCloseTo(2, 9);
    expect(q.getKind()).toBe('sphere');
    expect(q.getMatrix()).not.toBeNull();
  });

  it('isOnSurface uses matrix for general quadrics', () => {
    const kernel = makeKernel();
    const q = new GeoQuadric3D(kernel, 'general');
    // x² + y² − z² − 1 = 0（单叶双曲面，general 未回填）
    q.setMatrix(flatMatrixFromPolyCoeffs(1, 1, -1, -1, 0, 0, 0, 0, 0, 0));
    expect(q.getKind()).toBe('general');
    expect(q.getTypeString()).toBe('HyperboloidOneSheet');
    expect(q.isOnSurface(Coords4.fromPoint(1, 0, 0))).toBe(true);
    expect(q.isOnSurface(Coords4.fromPoint(0, 0, 0))).toBe(false);
  });
});

describe('equation creation wiring', () => {
  it('labeled quadric keeps label and type', () => {
    const kernel = makeKernel();
    const q = quadricOf(kernel, 'quad = x^2 + y^2 + z^2 - 1');
    expect(q.label).toBe('quad');
    expect(q.getTypeDisplay()).toBe('Sphere');
  });

  it('creates AlgoDependentQuadric3D for equation', () => {
    const kernel = makeKernel();
    addInput(kernel, 'x^2 + y^2 - z^2 = 1');
    expect(ofType(kernel, AlgoDependentQuadric3D).length).toBe(1);
  });

  it('non-quadric definitions still work', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 3');
    expect(ofType(kernel, GeoNumeric).find(n => n.label === 'a')?.getValue()).toBe(3);
    addInput(kernel, 'f(x) = x^2');
    expect(ofType(kernel, GeoQuadric3D)).toHaveLength(0);
  });

  it('slider dependency updates coefficients', () => {
    const kernel = makeKernel();
    addInput(kernel, 'r = 2');
    const q = quadricOf(kernel, 'x^2 + y^2 + z^2 = r^2');
    expect(q.getTypeDisplay()).toBe('Sphere');
    expect(q.getParam()).toBeCloseTo(2, 9);

    const r = ofType(kernel, GeoNumeric).find(n => n.label === 'r')!;
    r.setValue(3);
    kernel.flushNow();
    c(kernel).updateAllAlgorithms();
    expect(q.getParam()).toBeCloseTo(3, 9);
  });
});

describe('line × general quadric', () => {
  it('secant line hits sphere equation twice', () => {
    const kernel = makeKernel();
    const q = quadricOf(kernel, 'x^2 + y^2 + z^2 = 1');
    // z 轴：过球心 → 两交点 (0,0,±1)
    const line = new GeoLine3D(kernel, Coords4Origin(), Coords4Z());
    const hits = q.intersectLine(line);
    expect(hits.length).toBe(2);
    const zs = hits.map(h => h.point.getZ()).sort((a, b) => a - b);
    expect(zs[0]).toBeCloseTo(-1, 5);
    expect(zs[1]).toBeCloseTo(1, 5);
  });

  it('general hyperboloid matrix line coeffs', () => {
    const kernel = makeKernel();
    const q = new GeoQuadric3D(kernel, 'general');
    q.setMatrix(flatMatrixFromPolyCoeffs(1, 1, -1, -1, 0, 0, 0, 0, 0, 0));
    // x 轴：x²−1=0 → x=±1
    const line = new GeoLine3D(kernel, Coords4Origin(), Coords4X());
    const hits = q.intersectLine(line);
    expect(hits.length).toBe(2);
    const xs = hits.map(h => h.point.getX()).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-1, 5);
    expect(xs[1]).toBeCloseTo(1, 5);
  });
});

describe('serializer roundtrip', () => {
  it('round-trips labeled quadric equation', () => {
    const kernel = makeKernel();
    addInput(kernel, 'quad = x^2 + y^2 + z^2 - 1');
    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const qs = ofType(restored, GeoQuadric3D);
    expect(qs.length).toBe(1);
    expect(qs[0].label).toBe('quad');
    expect(qs[0].getTypeDisplay()).toBe('Sphere');
    expect(qs[0].getParam()).toBeCloseTo(1, 9);
    expect(ofType(restored, AlgoDependentQuadric3D).length).toBe(1);
  });

  it('round-trips unlabeled hyperboloid', () => {
    const kernel = makeKernel();
    addInput(kernel, 'x^2 + y^2 - z^2 = 1');
    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const qs = ofType(restored, GeoQuadric3D);
    expect(qs.length).toBe(1);
    expect(qs[0].getTypeDisplay()).toBe('Hyperboloid of one sheet');
  });
});

function Coords4Origin(): Coords4 { return Coords4.origin(); }
function Coords4Z(): Coords4 { return Coords4.fromDirection(0, 0, 1); }
function Coords4X(): Coords4 { return Coords4.fromDirection(1, 0, 0); }
