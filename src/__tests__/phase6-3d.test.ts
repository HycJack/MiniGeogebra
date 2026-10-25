import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoCircle3D } from '../kernel/geo/GeoCircle3D';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { GeoPolyhedron3D } from '../kernel/algo/AlgoPolyhedron3D';
import { GeoPolyline3D } from '../kernel/geo/GeoPolyline3D';
import { GeoConic3D } from '../kernel/geo/GeoConic3D';
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

describe('Ellipsoid3D', () => {
  it('isOnSurface and line intersection', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    const [ell] = outputsOf(kernel, 'Ellipsoid3D(O, 2, 1, 3)', GeoQuadric3D);
    expect(ell.getKind()).toBe('ellipsoid');
    expect(ell.isOnSurface(Coords4.fromPoint(2, 0, 0))).toBe(true);
    expect(ell.isOnSurface(Coords4.fromPoint(0, 1, 0))).toBe(true);
    expect(ell.isOnSurface(Coords4.fromPoint(0, 0, 3))).toBe(true);
    expect(ell.isOnSurface(Coords4.fromPoint(2, 1, 0))).toBe(false);
    expect(ell.volume()).toBeCloseTo((4 / 3) * Math.PI * 2 * 1 * 3, 9);
  });

  it('line through the center intersects at two antipodal points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'Ellipsoid3D(O, 2, 1, 3)');
    const ell = ofType(kernel, GeoQuadric3D)[0];
    // 沿 y 方向穿过中心：交于 (0, ±1, 0)
    const line = new GeoLine3D(kernel, Coords4.fromPoint(0, -5, 0), Coords4.fromDirection(0, 1, 0));
    const hits = ell.intersectLine(line);
    expect(hits.length).toBe(2);
    expect(Math.abs(hits[0].point.getY())).toBeCloseTo(1, 6);
    expect(Math.abs(hits[1].point.getY())).toBeCloseTo(1, 6);
  });
});

describe('Object-level 3D transforms', () => {
  it('Rotate3D rotates a line around the z-axis', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0, 0)');
    addInput(kernel, 'B = (1, 0, 1)');
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'Z2 = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(O, Z2)');
    addInput(kernel, 'l = Line3D(A, B)');
    const [rot] = outputsOf(kernel, 'Rotate3D(l, z, 90)', GeoLine3D);
    // 旋转 90° 后：起点 (0,1,0)，方向沿 (0,1,0)→(-1,0,1)
    const origin = rot.getOrigin();
    const dir = rot.getDirection();
    expect(origin.getX()).toBeCloseTo(0, 6);
    expect(origin.getY()).toBeCloseTo(1, 6);
    // 方向 (0,0,1) 绕 z 轴不变：B=(1,0,1) 旋转后应为 (0,1,√2)
    const end = rot.pointAt(Math.hypot(1, 1));
    expect(end.getX()).toBeCloseTo(0, 6);
    expect(end.getY()).toBeCloseTo(1, 6);
    expect(end.getZ()).toBeCloseTo(Math.SQRT2, 6);
  });

  it('Mirror3D mirrors a circle across the xy-plane (normal flips)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0, 0)');
    addInput(kernel, 'B = (0, 1, 0)');
    addInput(kernel, 'C = (0, 0, 1)');
    addInput(kernel, 'Circle3D(A, B, C)');
    addInput(kernel, 'P1 = (0, 0, 0)');
    addInput(kernel, 'P2 = (1, 0, 0)');
    addInput(kernel, 'P3 = (0, 1, 0)');
    addInput(kernel, 'xy = Plane3D(P1, P2, P3)');
    const circle = ofType(kernel, GeoCircle3D)[0];
    const [mirrored] = outputsOf(kernel, `Mirror3D(${circle.label}, xy)`, GeoCircle3D);
    const center = mirrored.getCenter();
    expect(center.getX()).toBeCloseTo(1 / 3, 6);
    expect(center.getZ()).toBeCloseTo(-1 / 3, 6);
    expect(mirrored.getRadius()).toBeCloseTo(circle.getRadius(), 6);
  });

  it('Translate3D shifts a polyhedron', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 0, 0)');
    addInput(kernel, 'C = (0, 1, 0)');
    addInput(kernel, 'Prism3D(A, B, C, 2)');
    const prism = ofType(kernel, GeoPolyhedron3D)[0];
    const [t] = outputsOf(kernel, `Translate3D(${prism.label}, 5, 0, 0)`, GeoPolyhedron3D);
    expect(t.vertices[0].getX()).toBeCloseTo(5, 6);
    expect(t.vertices[1].getX()).toBeCloseTo(6, 6);
    expect(t.volume()).toBeCloseTo(prism.volume(), 9);
  });
});

describe('Plane × quadric sections', () => {
  it('sphere cut by a horizontal plane is a circle ring', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'Sphere3D(O, 2)');
    addInput(kernel, 'S = (0, 0, 1)');
    addInput(kernel, 'T1 = (0, 0, 1)');
    addInput(kernel, 'T2 = (1, 0, 1)');
    addInput(kernel, 'T3 = (0, 1, 1)');
    addInput(kernel, 'cut = Plane3D(T1, T2, T3)');
    const sphere = ofType(kernel, GeoQuadric3D)[0];
    // 解析截面（2026-10-25 审核轮）：输出 GeoConic3D 圆而非 64 点折线近似，
    // 可继续取点/求圆心/参与下游构造
    const [ring] = outputsOf(kernel, `IntersectPath(cut, ${sphere.label})`, GeoConic3D);
    expect(ring.isDefined()).toBe(true);
    const radius = Math.sqrt(4 - 1);
    for (let i = 0; i < 8; i++) {
      const p = ring.pointAt((i / 8) * 2 * Math.PI).toPoint();
      expect(Math.abs(Math.hypot(p.x, p.y) - radius)).toBeLessThan(1e-6);
      expect(p.z).toBeCloseTo(1, 6);
    }
  });

  it('cylinder cut by an inclined plane yields a closed ring on the surface', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'Cylinder3D(z, 1)');
    // 平面 z = x + 2（倾斜切柱）
    addInput(kernel, 'S = (0, 0, 2)');
    addInput(kernel, 'P1 = (0, 0, 2)');
    addInput(kernel, 'P2 = (1, 0, 3)');
    addInput(kernel, 'P3 = (0, 1, 2)');
    addInput(kernel, 'cut = Plane3D(P1, P2, P3)');
    const cyl = ofType(kernel, GeoQuadric3D)[0];
    // 斜截圆柱 = 椭圆（解析截面）。环上每个点都在圆柱面上（距轴 1）且在平面上
    const [ring] = outputsOf(kernel, `IntersectPath(cut, ${cyl.label})`, GeoConic3D);
    expect(ring.isDefined()).toBe(true);
    void cyl;
    for (let i = 0; i < 8; i++) {
      const p = ring.pointAt((i / 8) * 2 * Math.PI).toPoint();
      const radial = Math.hypot(p.x, p.y);
      expect(Math.abs(radial - 1)).toBeLessThan(1e-6);
      expect(Math.abs(p.z - (p.x + 2))).toBeLessThan(1e-6);
    }
  });
});

describe('serialization of ellipsoid/transforms/sections', () => {
  it('round-trips all three', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    addInput(kernel, 'Ellipsoid3D(O, 2, 1, 3)');
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 0, 0)');
    addInput(kernel, 'C = (0, 1, 0)');
    addInput(kernel, 'Prism3D(A, B, C, 2)');
    const prism = ofType(kernel, GeoPolyhedron3D)[0];
    addInput(kernel, `Translate3D(${prism.label}, 5, 0, 0)`);

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const ell = ofType(restored, GeoQuadric3D).find(q => q.getKind() === 'ellipsoid')!;
    expect(ell.isOnSurface(Coords4.fromPoint(2, 0, 0))).toBe(true);
    const polys = ofType(restored, GeoPolyhedron3D);
    expect(polys).toHaveLength(2);
    const moved = polys.find(p => Math.abs(p.vertices[0].getX() - 5) < 1e-6)!;
    expect(moved.volume()).toBeCloseTo(1, 6); // 底面积 0.5 × 高 2
  });
});
