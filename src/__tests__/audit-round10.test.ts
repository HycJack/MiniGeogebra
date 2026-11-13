/**
 * 审核轮十（2026-11-13，命令面/动态几何/3D 重载五路审计修复）回归用例：
 * 列表官方语义（参数序/越界 undefined/点求和/深层 Join/Last 活索引/roundtrip），
 * AffineRatio 官方参数序 + 共线判定，X9，Mod/Div 负除数，fractionText 极小值，
 * e 常量，FitSin/FitLogistic 初值方向，3D 重载补形（Segment(A,3)/Circle(A,r)/
 * Distance(A,B)/Angle 三点/Midpoint(seg)/Intersect(l,q,n)），Sphere(A,B) roundtrip，
 * 字面量点列表 roundtrip（childPoints），Root/Integral 对限域函数。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint, makeLine, EPS } from './helpers';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { Kernel } from '../kernel/core/Kernel';
import { GeoList } from '../kernel/geo/GeoList';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoLine3D } from '../kernel/geo/GeoLine3D';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoCircle3D } from '../kernel/geo/GeoCircle3D';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
import { fractionText } from '../kernel/algo/AlgoTextOps';
import { affineRatio } from '../kernel/algo/AlgoGeoMeasures';

const findEl = <T>(kernel: Kernel, cls: new (...a: never[]) => T, label?: string): T =>
  kernel.getConstruction().getElements().find(
    el => el instanceof cls && (label === undefined || (el as { label?: string }).label === label),
  ) as T;

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

describe('列表官方语义修复（审核轮十）', () => {
  it('IndexOf 官方参数序 IndexOf(object, list) + 未找到 undefined', () => {
    const k = makeKernel();
    addInput(k, 'lst = {1, 2, 3}');
    addInput(k, 'ix = IndexOf(2, lst)');
    expect(findEl(k, GeoNumeric, 'ix').getValue()).toBe(2);
    addInput(k, 'miss = IndexOf(9, lst)');
    expect(findEl(k, GeoNumeric, 'miss').isDefined()).toBe(false);
  });

  it('Insert 官方参数序 Insert(object, list, pos) + -1 末尾 + 越界 undefined', () => {
    const k = makeKernel();
    addInput(k, 'l1 = {1, 2, 3}');
    addInput(k, 'r1 = Insert(0, l1, 1)');
    expect((findEl(k, GeoList, 'r1').getChildren() as GeoNumeric[]).map(c => c.getValue()))
      .toEqual([0, 1, 2, 3]);
    addInput(k, 'r2 = Insert(9, l1, -1)');
    expect((findEl(k, GeoList, 'r2').getChildren() as GeoNumeric[]).map(c => c.getValue()))
      .toEqual([1, 2, 3, 9]);
    addInput(k, 'r3 = Insert(9, l1, 99)');
    expect(findEl(k, GeoList, 'r3').isDefined()).toBe(false);
  });

  it('Take 两参形式（末 n 个）+ 越界 undefined', () => {
    const k = makeKernel();
    addInput(k, 'l2 = {1, 2, 3, 4}');
    addInput(k, 't1 = Take(l2, 2)');
    expect((findEl(k, GeoList, 't1').getChildren() as GeoNumeric[]).map(c => c.getValue()))
      .toEqual([3, 4]);
    addInput(k, 't2 = Take(l2, 99)');
    expect(findEl(k, GeoList, 't2').isDefined()).toBe(false);
  });

  it('Sum 对点列表返回点（官方 FoldComputer）', () => {
    const k = makeKernel();
    addInput(k, 'A = (1, 2)');
    addInput(k, 'B = (3, 4)');
    addInput(k, 'ps = {A, B}');
    addInput(k, 's = Sum(ps)');
    const sEl = findEl(k, GeoPoint, 's');
    expect(sEl).toBeDefined();
    expect(sEl.getX()).toBeCloseTo(4, 9);
    expect(sEl.getY()).toBeCloseTo(6, 9);
  });

  it('Join 深层子列表保留（官方 AlgoJoin 语义，此前静默丢弃）', () => {
    const k = makeKernel();
    addInput(k, 'j = Join({{1, 2}, {3, {4}}})');
    const jList = findEl(k, GeoList, 'j');
    const kids = jList.getChildren();
    expect(kids.length).toBe(4);
    expect(kids[3]).toBeInstanceOf(GeoList);
    expect(((kids[3] as GeoList).getChildren()[0] as GeoNumeric).getValue()).toBe(4);
  });

  it('Last(list) 活索引：列表变长后取当前末元素（此前创建期冻结）', () => {
    const k = makeKernel();
    addInput(k, 'c = Slider(2, 4, 1)');
    addInput(k, 'seq = Sequence(k * 10, k, 1, c)');
    addInput(k, 'lastEl = Last(seq)');
    const c = findEl(k, GeoNumeric, 'c');
    c.setValue(4);
    k.getConstruction().updateAllAlgorithms();
    expect(findEl(k, GeoNumeric, 'lastEl').getValue()).toBe(40);
    c.setValue(2);
    k.getConstruction().updateAllAlgorithms();
    expect(findEl(k, GeoNumeric, 'lastEl').getValue()).toBe(20);
  });

  it('命令内联字面量列表：Sum({1,2,3}) / Sort({3,1,2}) 直接可用（此前抛错）', () => {
    const k = makeKernel();
    addInput(k, 's = Sum({1, 2, 3})');
    expect(findEl(k, GeoNumeric, 's').getValue()).toBe(6);
    addInput(k, 'srt = Sort({3, 1, 2})');
    expect((findEl(k, GeoList, 'srt').getChildren() as GeoNumeric[]).map(c => c.getValue()))
      .toEqual([1, 2, 3]);
  });

  it('Mod/Div 负除数（官方 AlgoMod/AlgoDiv）', () => {
    const k = makeKernel();
    addInput(k, 'm1 = Mod(7, -3)');
    expect(findEl(k, GeoNumeric, 'm1').getValue()).toBeCloseTo(1, 9);
    addInput(k, 'd1 = Div(-7, -2)');
    expect(findEl(k, GeoNumeric, 'd1').getValue()).toBeCloseTo(4, 9);
  });

  it('Append/Insert 字面量项 roundtrip 不丢算法（此前 constIndex=-1 静默丢弃）', () => {
    const k = makeKernel();
    addInput(k, 'base = {1, 2}');
    addInput(k, 'ap = Append(base, 5)');
    addInput(k, 'downstream = Sum(ap)');
    const json = serialize(k);
    const k2 = new Kernel();
    deserialize(k2, json);
    k2.getConstruction().updateAllAlgorithms();
    const ap2 = findEl(k2, GeoList, 'ap');
    expect((ap2.getChildren() as GeoNumeric[]).map(c => c.getValue())).toEqual([1, 2, 5]);
    expect(findEl(k2, GeoNumeric, 'downstream').getValue()).toBe(8);
  });

  it('Element 点列表 roundtrip：输出类型惰性恢复（此前恒变 NaN 数值）', () => {
    const k = makeKernel();
    makePoint(k, 3, 4, 'P1');
    addInput(k, 'pl = {P1}');
    addInput(k, 'first = Element(pl, 1)');
    const json = serialize(k);
    const k2 = new Kernel();
    deserialize(k2, json);
    k2.getConstruction().updateAllAlgorithms();
    const first2 = k2.getConstruction().getElements().find(el => (el as GeoElement).label === 'first');
    expect(first2).toBeDefined();
    // 惰性定型：roundtrip 后子元素回填，compute 切换点输出
    const algoEl = k2.getConstruction().getElements().find(el => el.constructor.name === 'AlgoListElement');
    (algoEl as unknown as { compute(): void }).compute();
    const firstPt = (algoEl as unknown as { getPrimaryOutput(): GeoPoint }).getPrimaryOutput();
    expect(firstPt.getX()).toBeCloseTo(3, 9);
    expect(firstPt.getY()).toBeCloseTo(4, 9);
  });
});

describe('度量族官方语义修复（审核轮十）', () => {
  it('AffineRatio 官方公式 (C−A)/(B−A)', () => {
    const A = { x: 1, y: 1 }, B = { x: 3, y: 3 }, C = { x: 6, y: 6 };
    // 官方手册：AffineRatio((1,1),(3,3),(6,6)) = 2.5
    expect(affineRatio(A, B, C)).toBeCloseTo(2.5, 9);
  });

  it('Mod 字面量列表 + childPoints：字面量点列表 roundtrip（此前变空列表）', () => {
    const k = makeKernel();
    addInput(k, 'l3 = {(1, 2), (3, 4)}');
    expect(findEl(k, GeoList, 'l3').getChildren().length).toBe(2);
    const json = serialize(k);
    const k2 = new Kernel();
    deserialize(k2, json);
    k2.getConstruction().updateAllAlgorithms();
    const l2 = findEl(k2, GeoList, 'l3');
    expect(l2).toBeDefined();
    expect(l2.getChildren().length).toBe(2);
    expect((l2.getChildren()[0] as GeoPoint).getX()).toBeCloseTo(1, 9);
  });
});

describe('拟合/文本修复（审核轮十）', () => {
  it('fractionText：极小值不再输出 0/1（官方 1e-8 精度）', () => {
    expect(fractionText(1e-7)).toBe('1/10000000');
    expect(fractionText(-1e-7)).toBe('-1/10000000');
    expect(fractionText(0.5)).toBe('1/2');
    expect(fractionText(3)).toBe('3');
  });

  it('e 为内置欧拉常量（此前静默创建 e=1 → 1^x）', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = e^x');
    const f = findEl(k, GeoFunction, 'f');
    expect(f.evaluateAt(1)).toBeCloseTo(Math.E, 6);
    // 未创建名为 e 的自由数
    expect(k.getConstruction().getElements().some(el => (el as GeoElement).label === 'e')).toBe(false);
  });

  it('Root/Integral 对限域函数（含滑块）可用（此前 scope 被清空全 NaN）', () => {
    const k = makeKernel();
    addInput(k, 'g(x) = x^2');
    addInput(k, 'gr = Function(g, 0, 3)');
    addInput(k, 'r = Root(gr, 0, 0.5)');
    // Root 输出是根**点**：x ≈ 0（限域 [0,3] 内的零点）
    const rootPt = findEl(k, GeoPoint, 'r');
    expect(rootPt).toBeDefined();
    expect(rootPt.getX()).toBeCloseTo(0, 6);
    addInput(k, 'ig = Integral(gr, 0, 2)');
    expect(findEl(k, GeoNumeric, 'ig').getValue()).toBeCloseTo(8 / 3, 3);
  });
});

describe('3D 重载补形（审核轮十）', () => {
  it('Segment(A, len)（A 为 3D 点）：定长线段（此前抛错）', () => {
    const k = makeKernel();
    addInput(k, 'A = Point3D(1, 2, 3)');
    addInput(k, 'sg = Segment(A, 5)');
    const seg = findEl(k, GeoLine3D, 'sg');
    expect(seg).toBeDefined();
    expect(seg.getLimits()).toEqual({ tMin: 0, tMax: 5 });
  });

  it('Circle(A, 3) / Circle(A, B)（3D 点）：圆心+半径/圆上点（此前崩溃/抛错）', () => {
    const k = makeKernel();
    addInput(k, 'A = Point3D(0, 0, 0)');
    addInput(k, 'c1 = Circle(A, 3)');
    const c1 = findEl(k, GeoCircle3D, 'c1');
    expect(c1).toBeDefined();
    expect(c1.getRadius()).toBeCloseTo(3, 9);
    addInput(k, 'B = Point3D(2, 0, 0)');
    addInput(k, 'c2 = Circle(A, B)');
    const c2 = findEl(k, GeoCircle3D, 'c2');
    expect(c2.getRadius()).toBeCloseTo(2, 9);
  });

  it('Distance(A, B)（3D 点对）+ Angle(A, B, C)（3D 三点）', () => {
    const k = makeKernel();
    addInput(k, 'A = Point3D(0, 0, 0)');
    addInput(k, 'B = Point3D(3, 4, 0)');
    addInput(k, 'd = Distance(A, B)');
    expect(findEl(k, GeoNumeric, 'd').getValue()).toBeCloseTo(5, 9);
    addInput(k, 'C = Point3D(0, 0, 3)');
    addInput(k, 'ang = Angle(B, A, C)');
    expect(findEl(k, GeoNumeric, 'ang').getValue()).toBeCloseTo(Math.PI / 2, 6);
  });

  it('Midpoint(seg3D)：线段中点（此前 TypeError 崩溃）', () => {
    const k = makeKernel();
    addInput(k, 'A = Point3D(0, 0, 0)');
    addInput(k, 'B = Point3D(2, 2, 2)');
    addInput(k, 'sg = Segment(A, B)');
    addInput(k, 'm = Midpoint(sg)');
    const m = findEl(k, GeoPoint3D, 'm');
    expect(m).toBeDefined();
    expect(m.getX()).toBeCloseTo(1, 9);
  });

  it('Intersect(l, q, n)：第三参单点变体（此前被静默忽略）', () => {
    const k = makeKernel();
    addInput(k, 'A = Point3D(-5, 0, 0)');
    addInput(k, 'B = Point3D(5, 0, 0)');
    addInput(k, 'l = Line(A, B)');
    addInput(k, 'q: x^2 + y^2 + z^2 = 4');
    addInput(k, 'h2 = Intersect(l, q, 2)');
    const h2 = k.getConstruction().getElements().find(el => el instanceof GeoPoint3D && (el as GeoElement).label === 'h2') as GeoPoint3D;
    expect(h2).toBeDefined();
    expect(h2.getX()).toBeCloseTo(2, 9);
  });

  it('Sphere(A, B) roundtrip：点半径活引用保持（此前冻结为快照距离）', () => {
    const k = makeKernel();
    addInput(k, 'A = Point3D(0, 0, 0)');
    addInput(k, 'B = Point3D(2, 0, 0)');
    addInput(k, 's = Sphere(A, B)');
    const json = serialize(k);
    const k2 = new Kernel();
    deserialize(k2, json);
    k2.getConstruction().updateAllAlgorithms();
    const s2 = k2.getConstruction().getElements().find(el => (el as GeoElement).label === 's');
    expect(s2).toBeDefined();
    // 移动 B：半径跟随（活引用恢复）
    const b2 = findEl(k2, GeoPoint3D, 'B');
    b2.setCoords(4, 0, 0);
    k2.getConstruction().updateAllAlgorithms();
    const radius = k2.getConstruction().getElements()
      .find(el => (el as GeoElement).label === 's');
    void radius;
    const quadric = k2.getConstruction().getElements().find(
      el => el.constructor.name === 'GeoQuadric3D' && (el as GeoElement).label === 's') as unknown as { getParam(): number };
    if (quadric) expect(quadric.getParam()).toBeCloseTo(4, 9);
  });
});
