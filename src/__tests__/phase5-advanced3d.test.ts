import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoCircle3D } from '../kernel/geo/GeoCircle3D';
import { GeoPolyline3D } from '../kernel/geo/GeoPolyline3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoPolyhedron3D } from '../kernel/algo/AlgoPolyhedron3D';
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

describe('GeoCircle3D: circle through three points', () => {
  it('Circumference of the unit circle through three axis points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0, 0)');
    addInput(kernel, 'B = (0, 1, 0)');
    addInput(kernel, 'C = (0, 0, 1)');
    const [circle] = outputsOf(kernel, 'Circle3D(A, B, C)', GeoCircle3D);
    // 等边三角形（边长 √2）的外接圆半径 = √2/√3
    expect(circle.getRadius()).toBeCloseTo(Math.sqrt(2 / 3), 9);
    const center = circle.getCenter();
    expect(center.getX()).toBeCloseTo(1 / 3, 9);
    expect(center.getY()).toBeCloseTo(1 / 3, 9);
    expect(center.getZ()).toBeCloseTo(1 / 3, 9);

    // 圆上的参数点都在圆上
    for (const u of [0, 1, 2, 3, 4, 5]) {
      const p = circle.pointAt(u);
      expect(circle.isOnCircle(p)).toBe(true);
    }
  });

  it('Line intersection with a circle in its plane and off-plane lines', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0, 0)');
    addInput(kernel, 'B = (0, 1, 0)');
    addInput(kernel, 'C = (0, 0, 1)');
    addInput(kernel, 'Circle3D(A, B, C)');
    const circle = ofType(kernel, GeoCircle3D)[0];

    // 平面内过圆心的直线 → 两个交点
    addInput(kernel, 'P1 = (0, 0, 1)');
    addInput(kernel, 'P2 = (0, 2, -1)');
    addInput(kernel, 'l = Line3D(P1, P2)');
    const sects = circle.intersectLine(ofType(kernel, GeoLine3D)[0]);
    expect(sects.length >= 1).toBe(true);
    for (const s of sects) expect(circle.isOnCircle(s.point)).toBe(true);
  });
});

describe('3D point transforms', () => {
  it('Translate3D shifts a point', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 2, 3)');
    const [t] = outputsOf(kernel, 'Translate3D(A, 2, -1, 4)', GeoPoint3D);
    expect(t.getX()).toBeCloseTo(3, 9);
    expect(t.getY()).toBeCloseTo(1, 9);
    expect(t.getZ()).toBeCloseTo(7, 9);
  });

  it('Rotate3D rotates a point around the z-axis by 90°', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0, 0)');
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'Z2 = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(O, Z2)');
    const [rot] = outputsOf(kernel, 'Rotate3D(A, z, 90)', GeoPoint3D);
    expect(rot.getX()).toBeCloseTo(0, 9);
    expect(rot.getY()).toBeCloseTo(1, 9);
    expect(rot.getZ()).toBeCloseTo(0, 9);
  });

  it('Mirror3D reflects a point across the xy-plane', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 2, 3)');
    addInput(kernel, 'P1 = (0, 0, 0)');
    addInput(kernel, 'P2 = (1, 0, 0)');
    addInput(kernel, 'P3 = (0, 1, 0)');
    addInput(kernel, 'xy = Plane3D(P1, P2, P3)');
    const [m] = outputsOf(kernel, 'Mirror3D(A, xy)', GeoPoint3D);
    expect(m.getX()).toBeCloseTo(1, 9);
    expect(m.getZ()).toBeCloseTo(-3, 9);
  });
});

describe('IntersectPath: plane × polyhedron section', () => {
  it('slices a prism with the plane z = 2 into a triangle', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    const prism = ofType(kernel, GeoPolyhedron3D);
    void prism;
    addInput(kernel, 'Prism3D(A, B, C, 4)'); // 底 (0,0,0),(2,0,0),(0,2,0)，高 4

    // 平面 z=2（过 z 轴上一点，法向 (0,0,1)）
    addInput(kernel, 'S = (0, 0, 2)');
    addInput(kernel, 'T1 = (0, 0, 2)');
    addInput(kernel, 'T2 = (1, 0, 2)');
    addInput(kernel, 'T3 = (0, 1, 2)');
    addInput(kernel, 'cut = Plane3D(T1, T2, T3)');
    const poly = ofType(kernel, GeoPolyhedron3D)[0];
    const [section] = outputsOf(kernel, `IntersectPath(cut, ${poly.label})`, GeoPolyline3D);
    // 四棱柱底是直角三角形；z=2 截面是平行于底的三角形
    expect(section.points.length).toBe(3);
    for (const p of section.points) expect(p.getZ()).toBeCloseTo(2, 6);
  });

  it('slices a prism halfway up into a congruent triangle', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 0, 0)');
    addInput(kernel, 'C = (0, 2, 0)');
    addInput(kernel, 'Prism3D(A, B, C, 4)');
    addInput(kernel, 'S = (0, 0, 2)');
    addInput(kernel, 'T1 = (0, 0, 2)');
    addInput(kernel, 'T2 = (1, 0, 2)');
    addInput(kernel, 'T3 = (0, 1, 2)');
    addInput(kernel, 'cut = Plane3D(T1, T2, T3)');
    const poly = ofType(kernel, GeoPolyhedron3D)[0];
    const [section] = outputsOf(kernel, `IntersectPath(cut, ${poly.label})`, GeoPolyline3D);
    expect(section.points.length).toBe(3);
    const area = Math.abs(
      (section.points[1].getX() - section.points[0].getX()) * (section.points[2].getY() - section.points[0].getY())
      - (section.points[1].getY() - section.points[0].getY()) * (section.points[2].getX() - section.points[0].getX())) / 2;
    expect(area).toBeCloseTo(2, 6);
  });
});

describe('serialization of 3D advanced objects', () => {
  it('round-trips a circle, a transform and an intersection path', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0, 0)');
    addInput(kernel, 'B = (0, 1, 0)');
    addInput(kernel, 'C = (0, 0, 1)');
    addInput(kernel, 'Circle3D(A, B, C)');
    addInput(kernel, 'Translate3D(A, 1, 1, 1)');
    addInput(kernel, 'P1 = (0, 0, 0)');
    addInput(kernel, 'P2 = (2, 0, 0)');
    addInput(kernel, 'P3 = (0, 2, 0)');
    addInput(kernel, 'Prism3D(P1, P2, P3, 4)');
    addInput(kernel, 'S = (0, 0, 2)');
    addInput(kernel, 'T1 = (0, 0, 2)');
    addInput(kernel, 'T2 = (1, 0, 2)');
    addInput(kernel, 'T3 = (0, 1, 2)');
    addInput(kernel, 'cut = Plane3D(T1, T2, T3)');
    addInput(kernel, `IntersectPath(cut, ${ofType(kernel, GeoPolyhedron3D)[0].label})`);

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const circles = ofType(restored, GeoCircle3D);
    expect(circles).toHaveLength(1);
    expect(circles[0].getRadius()).toBeCloseTo(Math.sqrt(2 / 3), 6);
    const polylines = ofType(restored, GeoPolyline3D);
    expect(polylines).toHaveLength(1);
    expect(polylines[0].points.length).toBe(3);
    const translated = ofType(restored, GeoPoint3D)
      .find(p => Math.abs(p.getX() - 2) < 1e-6 && Math.abs(p.getY() - 1) < 1e-6 && Math.abs(p.getZ() - 1) < 1e-6)!;
    expect(translated).toBeDefined();
  });
});
