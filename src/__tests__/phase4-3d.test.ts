import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoPlane3D } from '../kernel/geo/GeoPlane3D';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
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

describe('3D minimal kernel: objects', () => {
  it('parses (x, y, z) tuple definitions into 3D points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 2, 3)');
    const pts = ofType(kernel, GeoPoint3D);
    expect(pts).toHaveLength(1);
    expect(pts[0].getX()).toBeCloseTo(1, 9);
    expect(pts[0].getY()).toBeCloseTo(2, 9);
    expect(pts[0].getZ()).toBeCloseTo(3, 9);
    // 2D 元组仍然工作
    addInput(kernel, 'B = (4, 5)');
    expect(ofType(kernel, GeoPoint3D)).toHaveLength(1);
  });

  it('Point3D(x, y, z) creates a labeled 3D point', () => {
    const kernel = makeKernel();
    const [p] = outputsOf(kernel, 'Point3D(-1, 0.5, 2)', GeoPoint3D);
    expect(p.getX()).toBeCloseTo(-1, 9);
    expect(p.getZ()).toBeCloseTo(2, 9);
  });
});

describe('3D minimal kernel: algorithms', () => {
  it('Line3D through two points and its parameterization', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 2, 3)');
    const [line] = outputsOf(kernel, 'Line3D(A, B)', GeoLine3D);
    // 方向已归一化，t 是沿直线的距离：pointAt(0) = A，pointAt(|AB|) = B
    const ab = Math.hypot(1, 2, 3);
    const p = line.pointAt(ab / 2);
    expect(p.getX()).toBeCloseTo(0.5, 9);
    expect(p.getY()).toBeCloseTo(1, 9);
    expect(p.getZ()).toBeCloseTo(1.5, 9);
    expect(line.contains(line.pointAt(ab * 2))).toBe(true);
  });

  it('Midpoint3D averages the coordinates', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (2, 4, 6)');
    const [mid] = outputsOf(kernel, 'Midpoint3D(A, B)', GeoPoint3D);
    expect(mid.getX()).toBeCloseTo(1, 9);
    expect(mid.getY()).toBeCloseTo(2, 9);
    expect(mid.getZ()).toBeCloseTo(3, 9);
  });

  it('Plane3D through three points contains them and has the right normal', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0, 0)');
    addInput(kernel, 'B = (0, 1, 0)');
    addInput(kernel, 'C = (0, 0, 1)');
    const [plane] = outputsOf(kernel, 'Plane3D(A, B, C)', GeoPlane3D);
    // x + y + z = 1
    const n = plane.getNormal();
    expect(Math.abs(n.x - n.y)).toBeLessThan(1e-9);
    expect(Math.abs(n.x - n.z)).toBeLessThan(1e-9);
    expect(plane.contains({ getX: () => 0.2, getY: () => 0.3, getZ: () => 0.5, toPoint: () => ({ x: 0.2, y: 0.3, z: 0.5 }) } as any)).toBe(true);
    // (0,0,2) 到平面 x+y+z=1 的距离 = |0+0+2−1|/√3 = 1/√3
    expect(plane.signedDistance({ getX: () => 0, getY: () => 0, getZ: () => 2, toPoint: () => ({ x: 0, y: 0, z: 2 }) } as any)).toBeCloseTo(1 / Math.sqrt(3), 6);
  });

  it('IntersectLinePlane finds the line-plane intersection', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 1, 1)');
    addInput(kernel, 'P1 = (0, 0, 1)');
    addInput(kernel, 'P2 = (1, 0, 1)');
    addInput(kernel, 'P3 = (0, 1, 1)');
    addInput(kernel, 'l = Line3D(A, B)');
    addInput(kernel, 'pl = Plane3D(P1, P2, P3)');
    const [hit] = outputsOf(kernel, 'IntersectLinePlane(l, pl)', GeoPoint3D);
    // 直线方向 (1,1,1) 与平面 z=1 交于 (1,1,1)
    expect(hit.getX()).toBeCloseTo(1, 9);
    expect(hit.getY()).toBeCloseTo(1, 9);
    expect(hit.getZ()).toBeCloseTo(1, 9);
  });

  it('IntersectLinePlane is undefined when the line is parallel', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 0, 0)');
    addInput(kernel, 'P1 = (0, 0, 1)');
    addInput(kernel, 'P2 = (1, 0, 1)');
    addInput(kernel, 'P3 = (0, 1, 1)');
    addInput(kernel, 'l = Line3D(A, B)');
    addInput(kernel, 'pl = Plane3D(P1, P2, P3)');
    const [hit] = outputsOf(kernel, 'IntersectLinePlane(l, pl)', GeoPoint3D);
    expect(hit.isDefined()).toBe(false);
  });

  it('Distance3D computes point-plane distance', () => {
    const kernel = makeKernel();
    addInput(kernel, 'Q = (0, 0, 1)');
    addInput(kernel, 'P1 = (0, 0, 0)');
    addInput(kernel, 'P2 = (1, 0, 0)');
    addInput(kernel, 'P3 = (0, 1, 0)');
    addInput(kernel, 'pl = Plane3D(P1, P2, P3)');
    const [d] = outputsOf(kernel, 'Distance3D(Q, pl)', GeoNumeric);
    expect(d.getValue()).toBeCloseTo(1, 9);
  });

  it('Segment3D is limited to its endpoints', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 0, 0)');
    const [seg] = outputsOf(kernel, 'Segment3D(A, B)', GeoLine3D);
    expect(seg.contains(seg.pointAt(0.5))).toBe(true);
    expect(seg.contains(seg.pointAt(2))).toBe(false); // 超出端点
    const [line] = outputsOf(kernel, 'Line3D(A, B)', GeoLine3D);
    expect(line.contains(line.pointAt(2))).toBe(true); // 直线无界
  });
});

describe('3D minimal kernel: serialization', () => {
  it('round-trips 3D points, lines and intersections', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (1, 1, 1)');
    addInput(kernel, 'l = Line3D(A, B)');
    addInput(kernel, 'P1 = (0, 0, 1)');
    addInput(kernel, 'P2 = (1, 0, 1)');
    addInput(kernel, 'P3 = (0, 1, 1)');
    addInput(kernel, 'pl = Plane3D(P1, P2, P3)');
    addInput(kernel, 'X = IntersectLinePlane(l, pl)');

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const points = ofType(restored, GeoPoint3D).filter(p => p.isDefined());
    // A, B, P1..P3, X = 6 个定义点
    expect(points.length).toBe(6);
    const x = points.find(p => p.label === 'X')!;
    expect(x.getX()).toBeCloseTo(1, 6);
    expect(x.getZ()).toBeCloseTo(1, 6);
    const lines = ofType(restored, GeoLine3D);
    expect(lines).toHaveLength(1);
    expect(lines[0].contains(lines[0].pointAt(0.5))).toBe(true);
  });
});
