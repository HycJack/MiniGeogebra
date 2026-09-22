import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoPlane3D } from '../kernel/geo/GeoPlane3D';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { GeoPolyhedron3D } from '../kernel/algo/AlgoPolyhedron3D';
import { GeoSurface } from '../kernel/geo/GeoSurface';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
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

describe('Phase 5: quadrics (sphere/cylinder/cone)', () => {
  it('Sphere3D(center, radius) and line intersection', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    const [sphere] = outputsOf(kernel, 'Sphere3D(O, 2)', GeoQuadric3D);
    expect(sphere.getKind()).toBe('sphere');
    expect(sphere.isOnSurface(Coords4.fromPoint(2, 0, 0))).toBe(true);
    expect(sphere.isOnSurface(Coords4.fromPoint(1, 0, 0))).toBe(false);

    addInput(kernel, 'A = (0, 0, -5)');
    addInput(kernel, 'B = (0, 0, 5)');
    addInput(kernel, `l = Line3D(A, B)`);
    const [hit1, hit2] = outputsOf(kernel, `IntersectLineQuadric(l, ${sphere.label})`, GeoPoint3D);
    expect(hit1.getZ()).toBeCloseTo(-2, 6);
    expect(hit2.getZ()).toBeCloseTo(2, 6);
  });

  it('Sphere3D(center, surface point) derives the radius', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'P = (0, 0, 3)');
    const [sphere] = outputsOf(kernel, 'Sphere3D(O, P)', GeoQuadric3D);
    expect(sphere.isOnSurface(Coords4.fromPoint(0, 3, 0))).toBe(true);
  });

  it('Cylinder3D(axis, radius): containment and intersection', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, -1)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    const [cyl] = outputsOf(kernel, 'Cylinder3D(z, 1)', GeoQuadric3D);
    expect(cyl.getKind()).toBe('cylinder');
    expect(cyl.isOnSurface(Coords4.fromPoint(1, 0, 0))).toBe(true);

    // 平行于轴的直线在外围 → 无交点
    addInput(kernel, 'C = (2, 0, -5)');
    addInput(kernel, 'D = (2, 0, 5)');
    addInput(kernel, 'm = Line3D(C, D)');
    const hits = outputsOf(kernel, `IntersectLineQuadric(m, ${cyl.label})`, GeoPoint3D).filter(p => p.isDefined());
    expect(hits).toHaveLength(0);

    // 垂直于轴的直线 → 两个交点 (±1, 0, 0)
    addInput(kernel, 'E = (-2, 0, 0)');
    addInput(kernel, 'F = (2, 0, 0)');
    addInput(kernel, 'n = Line3D(E, F)');
    const [h1, h2] = outputsOf(kernel, `IntersectLineQuadric(n, ${cyl.label})`, GeoPoint3D);
    expect(h1.getX()).toBeCloseTo(-1, 6);
    expect(h2.getX()).toBeCloseTo(1, 6);
  });

  it('Cone3D(axis, half-angle in degrees): containment', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    const [cone] = outputsOf(kernel, 'Cone3D(z, 45)', GeoQuadric3D);
    expect(cone.getKind()).toBe('cone');
    expect(cone.isOnSurface(Coords4.fromPoint(1, 0, 1))).toBe(true); // 45° 半顶角
    expect(cone.isOnSurface(Coords4.fromPoint(2, 0, 1))).toBe(false);
  });
});

describe('Phase 5: polyhedra and volume', () => {
  it('Prism3D(base, height): volume = baseArea × height', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    const [prism] = outputsOf(kernel, 'Prism3D(A, B, C, 3)', GeoPolyhedron3D);
    expect(prism.kind).toBe('prism');
    expect(prism.baseArea()).toBeCloseTo(2, 9); // 直角三角形面积
    expect(prism.height()).toBeCloseTo(3, 9);
    expect(prism.volume()).toBeCloseTo(6, 9);
    const [v] = outputsOf(kernel, `Volume3D(${prism.label})`, GeoNumeric);
    expect(v.getValue()).toBeCloseTo(6, 9);
  });

  it('Pyramid3D(base, apex): volume = baseArea × height / 3', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    addInput(kernel, 'T = (0, 0, 3)');
    const [pyramid] = outputsOf(kernel, 'Pyramid3D(A, B, C, T)', GeoPolyhedron3D);
    expect(pyramid.kind).toBe('pyramid');
    expect(pyramid.volume()).toBeCloseTo(2, 9);
  });

  it('Volume3D(sphere) = 4/3πr³', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'Sphere3D(O, 2)');
    const sphere = ofType(kernel, GeoQuadric3D)[0];
    const [v] = outputsOf(kernel, `Volume3D(${sphere.label})`, GeoNumeric);
    expect(v.getValue()).toBeCloseTo((4 / 3) * Math.PI * 8, 9);
  });
});

describe('Phase 5: 3D angle measurements', () => {
  it('Angle3D between two lines is the angle of their directions', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 0, 0)');
    addInput(kernel, 'C = (0, 1, 0)');
    addInput(kernel, 'l1 = Line3D(A, B)');
    addInput(kernel, 'l2 = Line3D(A, C)');
    const [angle] = outputsOf(kernel, 'Angle3D(l1, l2)', GeoNumeric);
    expect(angle.getValue()).toBeCloseTo(Math.PI / 2, 9);
  });

  it('Angle3D between two planes is the angle of their normals', () => {
    const kernel = makeKernel();
    addInput(kernel, 'P1 = (0, 0, 0)');
    addInput(kernel, 'P2 = (1, 0, 0)');
    addInput(kernel, 'P3 = (0, 1, 0)');
    addInput(kernel, 'Q1 = (0, 0, 0)');
    addInput(kernel, 'Q2 = (1, 0, 0)');
    addInput(kernel, 'Q3 = (0, 0, 1)');
    addInput(kernel, 'z0 = Plane3D(P1, P2, P3)');
    addInput(kernel, 'xz = Plane3D(Q1, Q2, Q3)');
    const [dihedral] = outputsOf(kernel, 'Angle3D(z0, xz)', GeoNumeric);
    expect(dihedral.getValue()).toBeCloseTo(Math.PI / 2, 9);
  });
});

describe('Phase 6: parametric surfaces', () => {
  it('Surface(u cos v, u sin v, u, ...) is a cone parametrization', () => {
    const kernel = makeKernel();
    const [surface] = outputsOf(
      kernel,
      'Surface(u*cos(v), u*sin(v), u, u, 0, 2, v, 0, 6.28318530718)',
      GeoSurface,
    );
    const p = surface.evaluatePoint(1, 0);
    expect(p!.x).toBeCloseTo(1, 9);
    expect(p!.y).toBeCloseTo(0, 9);
    expect(p!.z).toBeCloseTo(1, 9);
    const q = surface.evaluatePoint(1, Math.PI / 2);
    expect(q!.x).toBeCloseTo(0, 9);
    expect(q!.y).toBeCloseTo(1, 9);
    const grid = surface.sampleGrid(8, 8);
    expect(grid.length).toBe(81);
  });

  it('serializes a sphere, a prism and a surface', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 0, 0)');
    addInput(kernel, 'C = (0, 1, 0)');
    addInput(kernel, 'Sphere3D(O, 2)');
    addInput(kernel, 'Prism3D(A, B, C, 4)');
    addInput(kernel, 'Surface(u*cos(v), u*sin(v), u, u, 0, 1, v, 0, 6.28318530718)');

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    expect(ofType(restored, GeoQuadric3D)).toHaveLength(1);
    expect(ofType(restored, GeoPolyhedron3D)).toHaveLength(1);
    expect(ofType(restored, GeoSurface)).toHaveLength(1);
    const prism = ofType(restored, GeoPolyhedron3D)[0];
    expect(prism.volume()).toBeCloseTo(2, 6); // 面积 0.5 × 高 4
  });
});
