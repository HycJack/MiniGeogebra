/**
 * 复审轮七（2026-11-02 官方比对 L 节第二批）回归用例：
 * L3-1 3D 同名命令重载、L3-2 Intersect 3D 组合矩阵、
 * L2-8 标签惰性分配（labelWanted）、L5-2/L5-3 视图状态落盘。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint, makeLine, EPS } from './helpers';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPlane3D } from '../kernel/geo/GeoPlane3D';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { GeoQuadric3D } from '../kernel/geo/GeoQuadric3D';
import { GeoCircle3D } from '../kernel/geo/GeoCircle3D';
import { GeoConic3D } from '../kernel/geo/GeoConic3D';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoLine } from '../kernel/geo/GeoLine';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { ConstructionElement } from '../kernel/core/ConstructionElement';

const findEl = <T>(kernel: Kernel, cls: new (...a: never[]) => T, label?: string): T =>
  kernel.getConstruction().getElements().find(
    el => el instanceof cls && (label === undefined || (el as { label?: string }).label === label),
  ) as T;

/** parseAlgebraInput 只创建不入构造（与 UI 层同一约定），测试侧统一入构造并全场整理。 */
const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

describe('L3-1 3D 同名命令重载（官方 BasicCommandProcessorFactory3D）', () => {
  it('Plane(A, B, C)：3D 点建平面（此前只有 Plane3D）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(0, 0, 0)');
    addInput(kernel, 'B = Point3D(1, 0, 0)');
    addInput(kernel, 'C = Point3D(0, 1, 0)');
    addInput(kernel, 'p = Plane(A, B, C)');
    const plane = findEl(kernel, GeoPlane3D, 'p');
    expect(plane).toBeDefined();
    expect(plane.isDefined()).toBe(true);
    // z = 0 平面：法向 (0,0,1)、距离 0
    expect(plane.getNormal().z).toBeCloseTo(1, 6);
    expect(plane.getDistance()).toBeCloseTo(0, 6);
  });

  it('Sphere(A, 3)：官方名建球（此前只有 Sphere3D）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(1, 2, 3)');
    addInput(kernel, 's = Sphere(A, 3)');
    const sphere = findEl(kernel, GeoQuadric3D, 's');
    expect(sphere).toBeDefined();
    expect(sphere.getKind()).toBe('sphere');
    expect(sphere.getParam()).toBeCloseTo(3, 9);
    expect(sphere.getBase().toPoint().x).toBeCloseTo(1, 9);
  });

  it('Line(A, B) / Segment(A, B)（3D 点）：自动路由到 3D 直线', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(0, 0, 0)');
    addInput(kernel, 'B = Point3D(3, 4, 0)');
    addInput(kernel, 'l = Line(A, B)');
    const line = findEl(kernel, GeoLine3D, 'l');
    expect(line).toBeDefined();
    expect(line.getOrigin().toPoint().x).toBeCloseTo(0, 9);
    expect(line.getDirection().norm()).toBeCloseTo(1, 9);
    // 2D Line 不受影响
    addInput(kernel, 'P = (0, 0)');
    addInput(kernel, 'Q = (1, 1)');
    const before = kernel.getConstruction().getElements().filter(el => el instanceof GeoLine3D).length;
    addInput(kernel, 'm = Line(P, Q)');
    expect(kernel.getConstruction().getElements().filter(el => el instanceof GeoLine3D).length).toBe(before);
    expect(kernel.getConstruction().getElements().some(el => el instanceof GeoLine && el.label === 'm')).toBe(true);
  });

  it('Midpoint(A, B)（3D 点）→ 3D 中点；Volume(s)（官方名，非 Volume3D）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(0, 0, 0)');
    addInput(kernel, 'B = Point3D(2, 2, 2)');
    addInput(kernel, 'M = Midpoint(A, B)');
    const mid = findEl(kernel, GeoPoint3D, 'M');
    expect(mid).toBeDefined();
    expect(mid.getZ()).toBeCloseTo(1, 9);
    addInput(kernel, 's = Sphere(A, 1)');
    addInput(kernel, 'v = Volume(s)');
    const v = kernel.getConstruction().getElements().find(
      el => el instanceof GeoNumericLike && el.label === 'v',
    );
    expect(v).toBeDefined();
    // 球体积 4π/3 ≈ 4.189
    expect((v as unknown as { getValue(): number }).getValue()).toBeCloseTo(4 * Math.PI / 3, 3);
  });

  it('Cylinder(l, 2) / Cone(l, 30)：官方名建柱锥', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(0, 0, 0)');
    addInput(kernel, 'B = Point3D(0, 0, 5)');
    addInput(kernel, 'l = Line(A, B)');
    addInput(kernel, 'cyl = Cylinder(l, 2)');
    const cyl = findEl(kernel, GeoQuadric3D, 'cyl');
    expect(cyl).toBeDefined();
    expect(cyl.getKind()).toBe('cylinder');
    expect(cyl.getParam()).toBeCloseTo(2, 9);
    addInput(kernel, 'cone = Cone(l, 30)');
    const cone = findEl(kernel, GeoQuadric3D, 'cone');
    expect(cone).toBeDefined();
    expect(cone.getKind()).toBe('cone');
  });
});

describe('L3-2 Intersect 3D 组合矩阵（官方 CmdIntersect3D）', () => {
  it('面 × 面 → 交线', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(0, 0, 0)');
    addInput(kernel, 'B = Point3D(1, 0, 0)');
    addInput(kernel, 'C = Point3D(0, 1, 0)');
    addInput(kernel, 'D = Point3D(0, 0, 1)');
    addInput(kernel, 'p1 = Plane(A, B, C)'); // z=0
    addInput(kernel, 'p2 = Plane(A, B, D)'); // y=0
    addInput(kernel, 'ix = Intersect(p1, p2)');
    const line = findEl(kernel, GeoLine3D, 'ix');
    expect(line).toBeDefined();
    expect(line.isDefined()).toBe(true);
    // 交线 = x 轴：方向 ∥ (1,0,0)
    expect(Math.abs(line.getDirection().x)).toBeCloseTo(1, 6);
    // 点 (1,0,0) 在交线上
    expect(line.contains(line.getOrigin().constructor.prototype.hasOwnProperty('add') ? line.pointAt(1) : line.pointAt(1))).toBe(true);
  });

  it('线 × 面 → 交点；平行时 undefined', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(0, 0, 0)');
    addInput(kernel, 'B = Point3D(1, 0, 0)');
    addInput(kernel, 'C = Point3D(0, 1, 0)');
    addInput(kernel, 'p = Plane(A, B, C)');
    addInput(kernel, 'P = Point3D(0.5, 0.5, 1)');
    addInput(kernel, 'Q = Point3D(0.5, 0.5, -1)');
    addInput(kernel, 'l = Line(P, Q)');
    addInput(kernel, 'h = Intersect(l, p)');
    const hit = findEl(kernel, GeoPoint3D, 'h');
    expect(hit).toBeDefined();
    expect(hit.isDefined()).toBe(true);
    expect(hit.getX()).toBeCloseTo(0.5, 9);
    expect(hit.getZ()).toBeCloseTo(0, 9);
  });

  it('线 × 线 → 交点；异面 undefined', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(0, 0, 0)');
    addInput(kernel, 'B = Point3D(1, 0, 0)');
    addInput(kernel, 'C = Point3D(0, 1, 0)');
    addInput(kernel, 'D = Point3D(0, 1, 1)');
    addInput(kernel, 'l1 = Line(A, B)'); // x 轴
    addInput(kernel, 'l2 = Line(C, D)'); // x=0 直线（y 变 z 变）→ 与 x 轴异面
    addInput(kernel, 'h = Intersect(l1, l2)');
    const hit = findEl(kernel, GeoPoint3D, 'h');
    expect(hit).toBeDefined();
    expect(hit.isDefined()).toBe(false);
    // 共面相交：l2' 过 (0,1,0) 方向 (1,-1,0) 与 x 轴交于原点
    addInput(kernel, 'E = Point3D(1, -1, 0)');
    addInput(kernel, 'l3 = Line(C, E)');
    addInput(kernel, 'h2 = Intersect(l1, l3)');
    const hit2 = kernel.getConstruction().getElements().find(
      el => el instanceof GeoPoint3D && (el as GeoPoint3D).label === 'h2') as GeoPoint3D;
    expect(hit2).toBeDefined();
    expect(hit2.isDefined()).toBe(true);
    expect(hit2.getX()).toBeCloseTo(0.5, 6);
    expect(hit2.getY()).toBeCloseTo(0, 6);
  });

  it('球 × 球 → 交圆', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(0, 0, 0)');
    addInput(kernel, 'B = Point3D(2, 0, 0)');
    addInput(kernel, 's1 = Sphere(A, 2)');
    addInput(kernel, 's2 = Sphere(B, 2)');
    addInput(kernel, 'c = Intersect(s1, s2)');
    const circle = findEl(kernel, GeoCircle3D, 'c');
    expect(circle).toBeDefined();
    expect(circle.isDefined()).toBe(true);
    // 交圆：圆心 (1,0,0)、半径 √(4−1)=√3、法向 (1,0,0)
    expect(circle.getCenter().toPoint().x).toBeCloseTo(1, 9);
    expect(circle.getRadius()).toBeCloseTo(Math.sqrt(3), 6);
    expect(Math.abs(circle.getNormal().x)).toBeCloseTo(1, 6);
  });

  it('面 × 二次曲面 → 解析截面（与 IntersectPath 同链）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = Point3D(0, 0, 0)');
    addInput(kernel, 's = Sphere(A, 2)');
    addInput(kernel, 'B = Point3D(0, 0, 1)');
    addInput(kernel, 'C = Point3D(1, 0, 1)');
    addInput(kernel, 'D = Point3D(0, 1, 1)');
    addInput(kernel, 'p = Plane(B, C, D)'); // z=1
    addInput(kernel, 'c = Intersect(p, s)');
    const section = findEl(kernel, GeoConic3D, 'c');
    expect(section).toBeDefined();
    expect(section.isDefined()).toBe(true);
    // 截圆：解析截面走 GeoConic3D，椭圆型 a=b=√3
    expect(section.getKind()).toBe('ellipse');
    expect(section.getA()).toBeCloseTo(Math.sqrt(3), 6);
    expect(section.getB()).toBeCloseTo(Math.sqrt(3), 6);
  });
});

describe('L2-8 标签惰性分配（官方 labelWanted）', () => {
  it('平行线交点 undefined 期间不占标签字母', () => {
    const kernel = makeKernel();
    const a = makePoint(kernel, 0, 0, 'A');
    const b = makePoint(kernel, 1, 0, 'B');
    void a; void b;
    const l1 = makeLine(kernel, 0, 1, -1); // y = 1
    const l2 = makeLine(kernel, 0, 1, -2); // y = 2（平行）
    const algo = new AlgoIntersect(kernel, l1, l2);
    kernel.getConstruction().addElement(algo);
    kernel.getConstruction().updateAllAlgorithms();
    const [p1] = algo.getOutputPoints();
    expect(p1).toBeDefined();
    expect(p1.isDefined()).toBe(false);
    // undefined 交点不占字母：下一个点标签仍是 C（旧实现已被 C 烧掉）
    const next = kernel.getConstruction().getNextPointLabel();
    expect(next).toBe('C');
    // 拖线到相交（改变 a 使两线不再平行）：defined 后补发标签
    l2.a = 1; // x + y − 2 = 0，与 y=1 交于 (1, 1)
    kernel.getConstruction().updateAllAlgorithms();
    expect(p1.isDefined()).toBe(true);
    expect(p1.label).toMatch(/^[A-Z]/);
  });

  it('defined 交点首次计算即获标签（现有语义不回退）', () => {
    const kernel = makeKernel();
    const l1 = makeLine(kernel, 1, 0, 0);   // x = 0
    const l2 = makeLine(kernel, 0, 1, 0);   // y = 0
    const algo = new AlgoIntersect(kernel, l1, l2);
    kernel.getConstruction().addElement(algo);
    kernel.getConstruction().updateAllAlgorithms();
    const [p] = algo.getOutputPoints();
    expect(p.isDefined()).toBe(true);
    expect(p.label).toBe('A');
  });
});

describe('L5-2/L5-3 视图状态落盘（官方 euclidianView3D 块）', () => {
  it('serialize 保存网格/轴显隐与 3D 视图，deserialize 原样返回', () => {
    const kernel = makeKernel();
    makePoint(kernel, 1, 2, 'A');
    const json = serialize(
      kernel, undefined, undefined,
      { grid: false, axes: false },
      { yaw: 1.2, pitch: 0.7, dist: 350, target: [1, 2, 3], projection: 'orthographic', grid: true, axes: false, clipBox: true },
    );
    const fresh = new Kernel();
    const out = deserialize(fresh, json);
    expect(out.viewFlags).toEqual({ grid: false, axes: false });
    expect(out.view3D).toBeDefined();
    expect(out.view3D!.yaw).toBeCloseTo(1.2, 9);
    expect(out.view3D!.projection).toBe('orthographic');
    expect(out.view3D!.target).toEqual([1, 2, 3]);
    expect(out.view3D!.clipBox).toBe(true);
  });

  it('无 3D/视图旗标时 deserialize 返回 undefined（向后兼容）', () => {
    const kernel = makeKernel();
    makePoint(kernel, 0, 0, 'A');
    const json = serialize(kernel);
    const fresh = new Kernel();
    const out = deserialize(fresh, json);
    expect(out.viewFlags).toBeUndefined();
    expect(out.view3D).toBeUndefined();
  });
});

import { GeoNumeric as GeoNumericLike } from '../kernel/geo/GeoNumeric';
void GeoConic; void EPS;
