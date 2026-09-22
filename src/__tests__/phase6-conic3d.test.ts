import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoConic3D } from '../kernel/geo/GeoConic3D';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { Coords4 } from '../kernel/core/Coords4';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel } from './helpers';

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

describe('Ellipse3D (foci + point)', () => {
  it('builds the ellipse from foci (-2,0,0),(2,0,0) through (0,3,0)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F1 = (-2, 0, 0)');
    addInput(kernel, 'F2 = (2, 0, 0)');
    addInput(kernel, 'P = (0, 3, 0)');
    const [ell] = outputsOf(kernel, 'Ellipse3D(F1, F2, P)', GeoConic3D);
    expect(ell.getKind()).toBe('ellipse');
    // a = (|PF1|+|PF2|)/2 = √13, c = 2, b = √(13−4) = 3
    expect(ell.getA()).toBeCloseTo(Math.sqrt(13), 9);
    expect(ell.getB()).toBeCloseTo(3, 9);
    expect(ell.isOnConic(Coords4.fromPoint(0, 3, 0))).toBe(true);
    // 参数点都在椭圆上
    for (const u of [0, 0.7, 1.3, 2.1, 3.4, 4.9]) {
      expect(ell.isOnConic(ell.pointAt(u))).toBe(true);
    }
  });
});

describe('Hyperbola3D (foci + point)', () => {
  it('builds the hyperbola from foci (±3,0,0) through (2,1,0)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F1 = (-3, 0, 0)');
    addInput(kernel, 'F2 = (3, 0, 0)');
    addInput(kernel, 'P = (2, 1, 0)');
    const [hyp] = outputsOf(kernel, 'Hyperbola3D(F1, F2, P)', GeoConic3D);
    expect(hyp.getKind()).toBe('hyperbola');
    // a = ||PF1|−|PF2||/2 = (√26−√2)/2；c = 3；b = √(c²−a²)
    const a = (Math.sqrt(26) - Math.sqrt(2)) / 2;
    expect(hyp.getA()).toBeCloseTo(a, 9);
    expect(hyp.getB()).toBeCloseTo(Math.sqrt(9 - a * a), 9);
    expect(hyp.isOnConic(Coords4.fromPoint(2, 1, 0))).toBe(true);
    // 两支参数点都在双曲线上
    for (const u of [-2, -0.8, 0.5, 1.6]) {
      expect(hyp.isOnConic(hyp.pointAt(u))).toBe(true);
    }
  });
});

describe('IntersectConic: plane × quadric → exact conic', () => {
  it('cylinder cut by a perpendicular plane yields a circle (a = b = r)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cylinder3D(z, 1)');
    addInput(kernel, 'P1 = (0, 0, 0)');
    addInput(kernel, 'P2 = (1, 0, 0)');
    addInput(kernel, 'P3 = (0, 1, 0)');
    addInput(kernel, 'xy = Plane3D(P1, P2, P3)');
    const cyl = ofType(kernel, GeoQuadric3D)[0];
    const [section] = outputsOf(kernel, `IntersectConic(xy, ${cyl.label})`, GeoConic3D);
    expect(section.getKind()).toBe('ellipse');
    expect(section.getA()).toBeCloseTo(1, 6);
    expect(section.getB()).toBeCloseTo(1, 6);
  });

  it('cylinder cut by a 45° plane yields an ellipse with semi-axes (√2, 1)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cylinder3D(z, 1)');
    // 平面 x + z = 2（法向 (1,0,1)，与轴成 45°）
    addInput(kernel, 'P1 = (2, 0, 0)');
    addInput(kernel, 'P2 = (2, 1, 0)');
    addInput(kernel, 'P3 = (1, 0, 1)');
    addInput(kernel, 'cut = Plane3D(P1, P2, P3)');
    const cyl = ofType(kernel, GeoQuadric3D)[0];
    const [section] = outputsOf(kernel, `IntersectConic(cut, ${cyl.label})`, GeoConic3D);
    expect(section.getA()).toBeCloseTo(Math.SQRT2, 5);
    expect(section.getB()).toBeCloseTo(1, 5);
    // 拟合出的椭圆上的参数点都应在圆柱面上（距轴 1）
    for (const u of [0, 1, 2, 3, 4, 5]) {
      const p = section.pointAt(u);
      expect(Math.hypot(p.getX(), p.getY())).toBeCloseTo(1, 4);
    }
  });
});

describe('serialization of 3D conics', () => {
  it('round-trips an Ellipse3D and an IntersectConic section', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F1 = (-2, 0, 0)');
    addInput(kernel, 'F2 = (2, 0, 0)');
    addInput(kernel, 'P = (0, 3, 0)');
    addInput(kernel, 'Ellipse3D(F1, F2, P)');
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cylinder3D(z, 1)');
    addInput(kernel, 'P1 = (0, 0, 0)');
    addInput(kernel, 'P2 = (1, 0, 0)');
    addInput(kernel, 'P3 = (0, 1, 0)');
    addInput(kernel, 'xy = Plane3D(P1, P2, P3)');
    addInput(kernel, `IntersectConic(xy, ${ofType(kernel, GeoQuadric3D)[0].label})`);

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const conics = ofType(restored, GeoConic3D);
    expect(conics).toHaveLength(2);
    const ellipse = conics.find(k => k.getKind() === 'ellipse' && Math.abs(k.getA() - Math.sqrt(13)) < 1e-6)!;
    expect(ellipse.isOnConic(Coords4.fromPoint(0, 3, 0))).toBe(true);
  });
});
