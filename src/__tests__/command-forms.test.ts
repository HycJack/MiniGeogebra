/**
 * 命令面高频参数形式回归（未实现清单.md H2 命令面项，2026-10-27 第四批）：
 * Derivative(f,n)、Intersect(f,g,index)、Point(path,number)/PointOn(path,number)、
 * Vector(P)、Segment(A,len)、Midpoint(segment/conic)、LineBisector(segment)、
 * Slope(function)、Length(arc/vector)、Perimeter/Circumference(conic)。
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoConicPart } from '../kernel/geo/GeoConicPart';
import { GeoLine } from '../kernel/geo/GeoLine';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const labelOf = <T>(kernel: Kernel, label: string): T | undefined =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label) as T | undefined;

describe('Derivative(f, n) n 阶导数', () => {
  it('Derivative(f, 2)：x³ 的二阶导 = 6x', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^3');
    addInput(k, "f2 = Derivative(f, 2)");
    const f2 = labelOf<GeoFunction>(k, 'f2');
    expect(f2).toBeDefined();
    expect(f2!.evaluateAt(3)).toBeCloseTo(18, 9);
  });

  it('Derivative(f) 一阶仍可用', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = sin(x)');
    addInput(k, "d = Derivative(f)");
    const d = labelOf<GeoFunction>(k, 'd');
    expect(d!.evaluateAt(0.3)).toBeCloseTo(Math.cos(0.3), 9);
  });
});

describe('Intersect(f, g, index) 选点', () => {
  it('圆与 x 轴交点取第 1/2 个（此前 arity [2,2] 不可达）', () => {
    const k = makeKernel();
    addInput(k, 'x² + y² = 25');
    const c = k.getConstruction().getElements().find(el => el instanceof GeoConic) as GeoConic;
    makePoint(k, 5, 0, 'T1');
    makePoint(k, -5, 0, 'T2');
    addInput(k, 'ax = Line(T1, T2)');
    addInput(k, `P1 = Intersect(${c.label}, ax, 1)`);
    addInput(k, `P2 = Intersect(${c.label}, ax, 2)`);
    const p1 = labelOf<GeoPoint>(k, 'P1')!;
    const p2 = labelOf<GeoPoint>(k, 'P2')!;
    expect(p1.isDefined() && p2.isDefined()).toBe(true);
    // 两个点都是 (±5, 0)，且互不重合
    expect(Math.abs(p1.getX())).toBeCloseTo(5, 6);
    expect(Math.abs(p2.getX())).toBeCloseTo(5, 6);
    expect(p1.getX()).toBeCloseTo(-p2.getX(), 6);
  });

  it('index 超界 → 干净报错', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A1');
    makePoint(k, 1, 0, 'A2');
    makePoint(k, 0, 1, 'B1');
    makePoint(k, 1, 1, 'B2');
    addInput(k, 'la = Line(A1, A2)');
    addInput(k, 'lb = Line(B1, B2)');
    // 两平行线无交点，index=2 必然超界
    expect(() => addInput(k, 'p = Intersect(la, lb, 2)')).toThrow(/fewer intersection|No intersection/);
  });
});

describe('Point(path, number) / PointOn(path, number)', () => {
  it('Point(f, 2)：函数上 x=2 处的点', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^2');
    addInput(k, 'P = Point(f, 2)');
    const p = labelOf<GeoPoint>(k, 'P')!;
    expect(p.isDefined()).toBe(true);
    expect(p.getX()).toBeCloseTo(2, 9);
    expect(p.getY()).toBeCloseTo(4, 9);
  });

  it('PointOn(s, 0.25)：线段参数点', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    addInput(k, 's = Segment(A, B)');
    addInput(k, 'P = PointOn(s, 0.25)');
    const p = labelOf<GeoPoint>(k, 'P')!;
    expect(p.getX()).toBeCloseTo(1, 9);
    expect(p.getY()).toBeCloseTo(0, 9);
  });
});

describe('Vector(P) 位置向量', () => {
  it('Vector(P)：P 动向量跟随（活依赖，起点为隐藏原点）', () => {
    const k = makeKernel();
    makePoint(k, 3, 4, 'P');
    addInput(k, 'u = Vector(P)');
    const u = labelOf<GeoVector>(k, 'u')!;
    expect(u.startX).toBeCloseTo(0, 9);
    expect(u.startY).toBeCloseTo(0, 9);
    expect(u.endX).toBeCloseTo(3, 9);
    expect(u.endY).toBeCloseTo(4, 9);
    // P 动 → 向量跟随
    const p = labelOf<GeoPoint>(k, 'P')!;
    p.setCoords(6, 2, 1);
    k.getConstruction().updateAllAlgorithms();
    const u2 = labelOf<GeoVector>(k, 'u')!;
    expect(u2.endX).toBeCloseTo(6, 9);
    expect(u2.endY).toBeCloseTo(2, 9);
  });
});

describe('Segment(A, length) 定长线段', () => {
  it('从 A 沿 x 正方向取长度的线段；Segment(A, B) 两点形式不受影响', () => {
    const k = makeKernel();
    makePoint(k, 1, 2, 'A');
    makePoint(k, 5, 6, 'B');
    addInput(k, 's1 = Segment(A, 3)');
    const s1 = labelOf<GeoSegment>(k, 's1')!;
    expect(s1.startPoint.getX()).toBeCloseTo(1, 9);
    expect(s1.endPoint.getX()).toBeCloseTo(4, 9);
    expect(s1.endPoint.getY()).toBeCloseTo(2, 9);
    addInput(k, 's2 = Segment(A, B)');
    const s2 = labelOf<GeoSegment>(k, 's2')!;
    expect(s2.endPoint.getX()).toBeCloseTo(5, 9);
    expect(s2.endPoint.getY()).toBeCloseTo(6, 9);
  });
});

describe('Midpoint / LineBisector 单参形式', () => {
  it('Midpoint(segment)：线段中点', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 2, 'B');
    addInput(k, 's = Segment(A, B)');
    addInput(k, 'M = Midpoint(s)');
    const m = labelOf<GeoPoint>(k, 'M')!;
    expect(m.getX()).toBeCloseTo(2, 9);
    expect(m.getY()).toBeCloseTo(1, 9);
  });

  it('Midpoint(circle)：圆心', () => {
    const k = makeKernel();
    addInput(k, '(x-3)² + (y+1)² = 4');
    const cc = k.getConstruction().getElements().find(el => el instanceof GeoConic) as GeoConic;
    addInput(k, `C = Midpoint(${cc.label})`);
    const c = labelOf<GeoPoint>(k, 'C')!;
    expect(c.getX()).toBeCloseTo(3, 9);
    expect(c.getY()).toBeCloseTo(-1, 9);
  });

  it('LineBisector(segment)：垂直平分线', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'B');
    addInput(k, 's = Segment(A, B)');
    addInput(k, 'b = LineBisector(s)');
    const b = labelOf<GeoLine>(k, 'b')!;
    // x=2 的竖直线：法向量水平（b=0）、-c/a=2
    expect(b.b).toBeCloseTo(0, 9);
    expect(-b.c / b.a).toBeCloseTo(2, 9);
  });
});

describe('Slope(function)', () => {
  it('Slope(f) = f\'(0)', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^3');
    addInput(k, 'm = Slope(f)');
    const m = labelOf<GeoNumeric>(k, 'm')!;
    expect(m.isDefined()).toBe(true);
    expect(m.getValue()).toBeCloseTo(0, 9);
  });
});

describe('Length / Perimeter / Circumference', () => {
  it('Length(弧) = r·extent（全仓库首个弧长计算）', () => {
    const k = makeKernel();
    addInput(k, 'Semicircle((0,0), (4,0))');
    const sc = k.getConstruction().getElements().find(el => el instanceof GeoConicPart) as GeoConicPart;
    addInput(k, `L = Length(${sc.label})`);
    const L = labelOf<GeoNumeric>(k, 'L')!;
    expect(L.isDefined()).toBe(true);
    expect(L.getValue()).toBeCloseTo(2 * Math.PI, 6); // r=2, extent=π
  });

  it('Length(vector) = 向量长度', () => {
    const k = makeKernel();
    makePoint(k, 3, 4, 'P');
    addInput(k, 'u = Vector(P)');
    addInput(k, 'L = Length(u)');
    expect(labelOf<GeoNumeric>(k, 'L')!.getValue()).toBeCloseTo(5, 9);
  });

  it('Perimeter(圆) = 2πr；Circumference(椭圆) = Ramanujan 近似', () => {
    const k = makeKernel();
    addInput(k, 'x² + y² = 9');
    const circ = k.getConstruction().getElements().find(el => el instanceof GeoConic) as GeoConic;
    addInput(k, `p1 = Perimeter(${circ.label})`);
    expect(labelOf<GeoNumeric>(k, 'p1')!.getValue()).toBeCloseTo(6 * Math.PI, 6);

    const k2 = makeKernel();
    addInput(k2, 'x²/4 + y² = 1');
    const ell = k2.getConstruction().getElements().find(el => el instanceof GeoConic) as GeoConic;
    addInput(k2, `p2 = Circumference(${ell.label})`);
    const p2 = labelOf<GeoNumeric>(k2, 'p2')!;
    const a = 2, b = 1;
    const ramanujan = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    expect(p2.getValue()).toBeCloseTo(ramanujan, 6);
  });

  it('Perimeter(扇形) = 弧长 + 2r；抛物线 Circumference 干净报错', () => {
    const k = makeKernel();
    addInput(k, 'M = (0,0)');
    addInput(k, 'S = (3,0)');
    addInput(k, 'E = (0,3)');
    addInput(k, 'CircularSector(M, S, E)');
    const sec = k.getConstruction().getElements().find(el => el instanceof GeoConicPart) as GeoConicPart;
    addInput(k, `p = Perimeter(${sec.label})`);
    const p = labelOf<GeoNumeric>(k, 'p')!;
    expect(p.getValue()).toBeCloseTo(3 * (Math.PI / 2) + 6, 6);

    const k2 = makeKernel();
    addInput(k2, 'y² = x');
    const par = k2.getConstruction().getElements().find(el => el instanceof GeoConic) as GeoConic;
    expect(() => addInput(k2, `q = Circumference(${par.label})`)).toThrow(/only defined for circles and ellipses/);
  });
});
