import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoPlane3D } from '../kernel/geo/GeoPlane3D';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { GeoPolyhedron3D, AlgoIntersectLineQuadric3D } from '../kernel/algo/AlgoPolyhedron3D';
import {
  INTERSECTION_ASYMPTOTIC_LINE,
  INTERSECTION_MEETING_LINE,
  INTERSECTION_PASSING_LINE,
  INTERSECTION_PRODUCING_LINE,
  INTERSECTION_SECANT_LINE,
  INTERSECTION_TANGENT_LINE,
} from '../kernel/geo/GeoQuadric3D';
import { GeoSurface } from '../kernel/geo/GeoSurface';
import { AlgoSurfaceOfRevolution } from '../kernel/algo/AlgoSurfaceOfRevolution';
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

describe('C9: line × quadric intersectionType', () => {
  const algoOf = (kernel: Kernel): AlgoIntersectLineQuadric3D =>
    ofType(kernel, AlgoIntersectLineQuadric3D)[0];
  const ptsOf = (algo: AlgoIntersectLineQuadric3D) =>
    algo.getGeoElements() as import('../kernel/geo/GeoPoint3D').GeoPoint3D[];

  it('secant through sphere: type 5 and two distinct points', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    const [sphere] = outputsOf(kernel, 'Sphere3D(O, 2)', GeoQuadric3D);
    addInput(kernel, 'A = (0, 0, -5)');
    addInput(kernel, 'B = (0, 0, 5)');
    addInput(kernel, 'l = Line3D(A, B)');
    addInput(kernel, `IntersectLineQuadric(l, ${sphere.label})`);
    const algo = algoOf(kernel);
    expect(algo.getIntersectionType()).toBe(INTERSECTION_SECANT_LINE);
    const pts = ptsOf(algo);
    expect(pts[0].isDefined()).toBe(true);
    expect(pts[1].isDefined()).toBe(true);
    expect(pts[0].getZ()).not.toBeCloseTo(pts[1].getZ(), 6);
  });

  it('tangent line to sphere: type 4 and both slots share the same point', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    const [sphere] = outputsOf(kernel, 'Sphere3D(O, 2)', GeoQuadric3D);
    // x = 2 的竖直切线：仅接触 (2, 0, 0)
    addInput(kernel, 'A = (2, 0, -5)');
    addInput(kernel, 'B = (2, 0, 5)');
    addInput(kernel, 'l = Line3D(A, B)');
    addInput(kernel, `IntersectLineQuadric(l, ${sphere.label})`);
    const algo = algoOf(kernel);
    expect(algo.getIntersectionType()).toBe(INTERSECTION_TANGENT_LINE);
    const [p0, p1] = ptsOf(algo);
    expect(p0.isDefined()).toBe(true);
    expect(p1.isDefined()).toBe(true);
    expect(p0.getX()).toBeCloseTo(2, 6);
    expect(p0.getY()).toBeCloseTo(0, 6);
    expect(p1.getX()).toBeCloseTo(2, 6);
    expect(p1.getY()).toBeCloseTo(0, 6);
  });

  it('passing line (misses sphere): type 6, both points undefined', () => {
    const kernel = makeKernel();
    addInput(kernel, 'O = (0, 0, 0)');
    const [sphere] = outputsOf(kernel, 'Sphere3D(O, 1)', GeoQuadric3D);
    addInput(kernel, 'A = (3, 0, -5)');
    addInput(kernel, 'B = (3, 0, 5)');
    addInput(kernel, 'l = Line3D(A, B)');
    addInput(kernel, `IntersectLineQuadric(l, ${sphere.label})`);
    const algo = algoOf(kernel);
    expect(algo.getIntersectionType()).toBe(INTERSECTION_PASSING_LINE);
    expect(ptsOf(algo).every(p => !p.isDefined())).toBe(true);
  });

  it('asymptotic line (parallel to cylinder axis, outside): type 2', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, -1)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    const [cyl] = outputsOf(kernel, 'Cylinder3D(z, 1)', GeoQuadric3D);
    addInput(kernel, 'C = (2, 0, -5)');
    addInput(kernel, 'D = (2, 0, 5)');
    addInput(kernel, 'm = Line3D(C, D)');
    addInput(kernel, `IntersectLineQuadric(m, ${cyl.label})`);
    const algo = algoOf(kernel);
    expect(algo.getIntersectionType()).toBe(INTERSECTION_ASYMPTOTIC_LINE);
    expect(ptsOf(algo).every(p => !p.isDefined())).toBe(true);
  });

  it('producing line (on cylinder surface, parallel to axis): type 1', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, -1)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    const [cyl] = outputsOf(kernel, 'Cylinder3D(z, 1)', GeoQuadric3D);
    addInput(kernel, 'C = (1, 0, -5)');
    addInput(kernel, 'D = (1, 0, 5)');
    addInput(kernel, 'm = Line3D(C, D)');
    addInput(kernel, `IntersectLineQuadric(m, ${cyl.label})`);
    const algo = algoOf(kernel);
    expect(algo.getIntersectionType()).toBe(INTERSECTION_PRODUCING_LINE);
    expect(ptsOf(algo).every(p => !p.isDefined())).toBe(true);
  });

  it('meeting line (parallel to cone generator, one hit): type 3, single defined point', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    const [cone] = outputsOf(kernel, 'Cone3D(z, 45)', GeoQuadric3D);
    // 平行于母线 (1,0,1) 但不过顶点：与 45° 锥恰交一次
    addInput(kernel, 'C = (1, 0, -1)');
    addInput(kernel, 'D = (2, 0, 0)');
    addInput(kernel, 'm = Line3D(C, D)');
    addInput(kernel, `IntersectLineQuadric(m, ${cone.label})`);
    const algo = algoOf(kernel);
    expect(algo.getIntersectionType()).toBe(INTERSECTION_MEETING_LINE);
    const pts = ptsOf(algo);
    const defined = pts.filter(p => p.isDefined());
    expect(defined).toHaveLength(1);
    // 单解应落在官方约定的槽位之一（b_g 符号决定）
    expect(pts[0].isDefined() !== pts[1].isDefined()).toBe(true);
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

describe('C3: limited-height cylinder/cone', () => {
  it('Cylinder3D(axis, radius, height): finite volume and end caps', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    const [cyl] = outputsOf(kernel, 'Cylinder3D(z, 2, 5)', GeoQuadric3D);
    expect(cyl.isLimited()).toBe(true);
    expect(cyl.getHeight()).toBe(5);
    expect(cyl.volume()).toBeCloseTo(Math.PI * 4 * 5, 9);
    // 高度范围内侧面在曲面上；超出高度 → 不在
    expect(cyl.isOnSurface(Coords4.fromPoint(2, 0, 2.5))).toBe(true);
    expect(cyl.isOnSurface(Coords4.fromPoint(2, 0, 6))).toBe(false);
    expect(cyl.isOnSurface(Coords4.fromPoint(2, 0, -0.5))).toBe(false);
    // Volume3D 有限
    const [v] = outputsOf(kernel, `Volume3D(${cyl.label})`, GeoNumeric);
    expect(v.getValue()).toBeCloseTo(Math.PI * 4 * 5, 9);
    // 超出端盖的横截线 → 无交；穿过中部 → 两交点
    addInput(kernel, 'C = (-3, 0, 2.5)');
    addInput(kernel, 'D = (3, 0, 2.5)');
    addInput(kernel, 'm = Line3D(C, D)');
    const mid = outputsOf(kernel, `IntersectLineQuadric(m, ${cyl.label})`, GeoPoint3D).filter(p => p.isDefined());
    expect(mid).toHaveLength(2);
    addInput(kernel, 'E = (-3, 0, 7)');
    addInput(kernel, 'F = (3, 0, 7)');
    addInput(kernel, 'n = Line3D(E, F)');
    const above = outputsOf(kernel, `IntersectLineQuadric(n, ${cyl.label})`, GeoPoint3D).filter(p => p.isDefined());
    expect(above).toHaveLength(0);
  });

  it('Cone3D(axis, halfAngle, height): volume = π r² h / 3 with r = h·tanα', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    const [cone] = outputsOf(kernel, 'Cone3D(z, 45, 3)', GeoQuadric3D);
    expect(cone.isLimited()).toBe(true);
    expect(cone.getHeight()).toBe(3);
    // 45° → top r = 3，V = π·9·3/3 = 9π
    expect(cone.volume()).toBeCloseTo(9 * Math.PI, 9);
    expect(cone.isOnSurface(Coords4.fromPoint(3, 0, 3))).toBe(true);
    expect(cone.isOnSurface(Coords4.fromPoint(4, 0, 4))).toBe(false); // 超出高度
    const [v] = outputsOf(kernel, `Volume3D(${cone.label})`, GeoNumeric);
    expect(v.getValue()).toBeCloseTo(9 * Math.PI, 9);
  });

  it('infinite Cylinder3D/Cone3D stay unlimited with Infinity volume', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    const [cyl] = outputsOf(kernel, 'Cylinder3D(z, 1)', GeoQuadric3D);
    const [cone] = outputsOf(kernel, 'Cone3D(z, 45)', GeoQuadric3D);
    expect(cyl.isLimited()).toBe(false);
    expect(cyl.volume()).toBe(Infinity);
    expect(cone.isLimited()).toBe(false);
    expect(cone.volume()).toBe(Infinity);
    // 无限体的 Volume3D 输出 undefined
    const vOut = outputsOf(kernel, `Volume3D(${cyl.label})`, GeoNumeric);
    expect(vOut[0].isDefined()).toBe(false);
  });

  it('live height slider updates limited cylinder volume', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'h = 2');
    const [cyl] = outputsOf(kernel, 'Cylinder3D(z, 1, h)', GeoQuadric3D);
    expect(cyl.isLimited()).toBe(true);
    expect(cyl.volume()).toBeCloseTo(Math.PI * 1 * 2, 9);
    const slider = ofType(kernel, GeoNumeric).find(n => n.label === 'h')!;
    slider.setValue(4);
    c(kernel).updateAllAlgorithms();
    expect(cyl.getHeight()).toBe(4);
    expect(cyl.volume()).toBeCloseTo(Math.PI * 4, 9);
  });

  it('round-trips frozen and live limited cylinder height', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 0, 1)');
    addInput(kernel, 'z = Line3D(A, B)');
    addInput(kernel, 'h = 3');
    addInput(kernel, 'Cylinder3D(z, 1, 2)');
    addInput(kernel, 'Cylinder3D(z, 1, h)');

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const cyls = ofType(restored, GeoQuadric3D).filter(q => q.getKind() === 'cylinder');
    expect(cyls).toHaveLength(2);
    const heights = cyls.map(q => q.getHeight()).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(heights).toEqual([2, 3]);
    expect(cyls.every(q => q.isLimited())).toBe(true);
    expect(cyls.every(q => Number.isFinite(q.volume()))).toBe(true);
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

describe('C6: surface of revolution', () => {
  it('Surface(f, 360) revolves y=f(x) around the x-axis into a cylinder shell', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = 1');
    const [surf] = outputsOf(kernel, 'Surface(f, 360)', GeoSurface);
    expect(surf.isDefined()).toBe(true);
    // 半径 1 的圆柱面：任一 u 处绕 x 轴一周半径恒为 1
    for (const v of [0, Math.PI / 3, Math.PI, 5.5]) {
      const p = surf.evaluatePoint(2, v);
      expect(p).not.toBeNull();
      expect(Math.hypot(p!.y, p!.z)).toBeCloseTo(1, 9);
      expect(p!.x).toBeCloseTo(2, 9);
    }
    expect(surf.sampleGrid(8, 8).length).toBe(81);
  });

  it('partial angle only sweeps the given arc', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = 1');
    const [surf] = outputsOf(kernel, 'Surface(f, 90)', GeoSurface);
    expect(surf.vMax).toBeCloseTo(Math.PI / 2, 9);
    expect(surf.vMin).toBe(0);
    expect(surf.uMin).toBe(-10);
    expect(surf.uMax).toBe(10);
  });

  it('live angle slider updates the sweep range', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = 1');
    addInput(kernel, 'a = 45');
    const slider = ofType(kernel, GeoNumeric).find(n => n.label === 'a')!;
    const [surf] = outputsOf(kernel, 'Surface(f, a)', GeoSurface);
    expect(surf.vMax).toBeCloseTo(Math.PI / 4, 9);
    slider.setValue(180);
    c(kernel).updateAllAlgorithms();
    expect(surf.vMax).toBeCloseTo(Math.PI, 9);
    expect(surf.isDefined()).toBe(true);
  });

  it('revolves a curve around an explicit 3D axis', () => {
    const kernel = makeKernel();
    addInput(kernel, 'c = Curve(t, 2, t, 0, 1)'); // xOy 平面内竖直线段 (t, 2)
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 1, 0)');
    addInput(kernel, 'ax = Line3D(A, B)'); // y 轴
    const [surf] = outputsOf(kernel, 'Surface(c, 360, ax)', GeoSurface);
    expect(surf.isDefined()).toBe(true);
    // 绕 y 轴转：曲线上点 (t,2,0) → 半径 |t| 的圆柱（y 不变）
    const p = surf.evaluatePoint(3, Math.PI / 2);
    expect(p).not.toBeNull();
    expect(p!.y).toBeCloseTo(2, 9);
    expect(Math.hypot(p!.x, p!.z)).toBeCloseTo(3, 9);
  });

  it('zero angle leaves the surface undefined', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = 1');
    const [surf] = outputsOf(kernel, 'Surface(f, 0)', GeoSurface);
    expect(surf.isDefined()).toBe(false);
  });

  it('round-trips Surface(f, 90) and Surface(curve, 180, axis)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2');
    addInput(kernel, 'Surface(f, 90)');
    addInput(kernel, 'c = Curve(t, 1+t, t, 0, 2)');
    addInput(kernel, 'A = (0, 0, 0)');
    addInput(kernel, 'B = (0, 1, 0)');
    addInput(kernel, 'ax = Line3D(A, B)');
    addInput(kernel, 'Surface(c, 180, ax)');

    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    const surfaces = ofType(restored, GeoSurface);
    expect(surfaces).toHaveLength(2);
    expect(surfaces.every(s => s.isDefined())).toBe(true);
    const algos = ofType(restored, AlgoSurfaceOfRevolution);
    expect(algos).toHaveLength(2);
    expect(algos.some(a => a.getCommandText().includes('ax'))).toBe(true);
    expect(surfaces.some(s => Math.abs(s.vMax - Math.PI / 2) < 1e-9)).toBe(true);
  });
});
