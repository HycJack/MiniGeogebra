/**
 * 重定义（Redefine）回归——对标 GeoGebra changeGeoElement + Construction.replace：
 * 自由↔依赖互换、换定义式、依赖者保留并跟随、函数重定义。
 */
import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoConic } from '../kernel/geo/GeoConic';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const byLabel = <T extends ConstructionElement>(kernel: Kernel, label: string): T =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label) as T;

describe('重定义：自由点 → 依赖点', () => {
  it('A = Midpoint(B, C) 后 A 变为依赖点并跟随 B/C', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 2, 0, 'B');
    makePoint(k, 4, 0, 'C');
    addInput(k, 'A = Midpoint(B, C)');
    const a = byLabel<GeoPoint>(k, 'A');
    expect(a.getX()).toBeCloseTo(3, 6);
    expect(a.isIndependent()).toBe(false);

    // 依赖者保留并跟随：拖 B → A 重算
    byLabel<GeoPoint>(k, 'B').setCoords(6, 2, 1);
    k.flushNow();
    expect(a.getX()).toBeCloseTo(5, 6);
    expect(a.getY()).toBeCloseTo(1, 6);
  });

  it('以 A 为输入的下游对象（Midpoint(A, C)）在重定义后改接新 A 并跟随', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 4, 0, 'C');
    makePoint(k, 2, 4, 'B');
    addInput(k, 'M = Midpoint(A, C)');
    addInput(k, 'A = Midpoint(B, B)'); // 新 A = (2, 4)
    const m = byLabel<GeoPoint>(k, 'M');
    // M = Midpoint(新A, C) = ((2+4)/2, (4+0)/2) = (3, 2)
    expect(m.getX()).toBeCloseTo(3, 6);
    expect(m.getY()).toBeCloseTo(2, 6);
    void k;
  });
});

describe('重定义：依赖点 → 自由点 / 换定义式', () => {
  it('依赖点 A = Midpoint(B,C) 改为 A = (1, 1) 后脱离 B/C', () => {
    const k = makeKernel();
    makePoint(k, 2, 0, 'B');
    makePoint(k, 4, 0, 'C');
    addInput(k, 'A = Midpoint(B, C)');
    addInput(k, 'A = (1, 1)');
    const a = byLabel<GeoPoint>(k, 'A');
    expect(a.isIndependent()).toBe(true);
    expect(a.getX()).toBeCloseTo(1, 6);
    // B 移动不再影响 A
    byLabel<GeoPoint>(k, 'B').setCoords(10, 10, 1);
    k.flushNow();
    expect(a.getX()).toBeCloseTo(1, 6);
  });

  it('依赖点换定义式：A = Midpoint(B,C) → A = Midpoint(B, D)', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'B');
    makePoint(k, 2, 0, 'C');
    makePoint(k, 8, 0, 'D');
    addInput(k, 'A = Midpoint(B, C)');
    addInput(k, 'A = Midpoint(B, D)');
    const a = byLabel<GeoPoint>(k, 'A');
    expect(a.getX()).toBeCloseTo(4, 6);
    byLabel<GeoPoint>(k, 'D').setCoords(10, 4, 1);
    k.flushNow();
    expect(a.getX()).toBeCloseTo(5, 6);
    expect(a.getY()).toBeCloseTo(2, 6);
  });
});

describe('重定义：数值自由 ↔ 依赖', () => {
  it('a = 2 → a = b + 1 升级为依赖数值并跟随 b', () => {
    const k = makeKernel();
    addInput(k, 'a = 2');
    addInput(k, 'b = 3');
    addInput(k, 'a = b + 1');
    const a = byLabel<GeoNumeric>(k, 'a');
    expect(a.getValue()).toBeCloseTo(4, 9);
    expect(a.isIndependent()).toBe(false);
    byLabel<GeoNumeric>(k, 'b').setValue(10);
    k.flushNow();
    expect(a.getValue()).toBeCloseTo(11, 9);
  });

  it('依赖数值 a = b + 1 → a = 5 降级为自由数值', () => {
    const k = makeKernel();
    addInput(k, 'b = 3');
    addInput(k, 'a = b + 1');
    addInput(k, 'a = 5');
    const a = byLabel<GeoNumeric>(k, 'a');
    expect(a.isIndependent()).toBe(true);
    expect(a.getValue()).toBeCloseTo(5, 9);
    byLabel<GeoNumeric>(k, 'b').setValue(100);
    k.flushNow();
    expect(a.getValue()).toBeCloseTo(5, 9);
  });
});

describe('重定义：函数', () => {
  it('f(x) = x → f(x) = 2x，函数上约束点跟随', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x');
    addInput(k, 'P = PointOn(f)');
    const p = byLabel<GeoPoint>(k, 'P');
    addInput(k, 'f(x) = 2x');
    const f = byLabel<GeoFunction>(k, 'f');
    expect(f.evaluateAt(3)).toBeCloseTo(6, 6);
    // 约束点仍在重定义后的函数上：P.y === f(P.x)
    expect(p.getY()).toBeCloseTo(f.evaluateAt(p.getX()), 6);
  });
});

describe('重定义：类型族校验', () => {
  it('点 → 线（跨类）报错且原对象保留', () => {
    const k = makeKernel();
    makePoint(k, 0, 0, 'A');
    makePoint(k, 2, 2, 'B');
    expect(() => addInput(k, 'A = Line(A, B)')).toThrow(/type change not supported/);
    const a = byLabel<GeoPoint>(k, 'A');
    expect(a).toBeDefined();
    expect(a.isIndependent()).toBe(true);
  });

  it('多输出对象（Intersect 的某个点）不支持重定义', () => {
    // 构造两个交点再重定义其一 —— 用 Circle 与 line
    const k2 = makeKernel();
    addInput(k2, 'x² + y² = 25'); // 圆（自动标签）
    addInput(k2, 'x + y = 1');    // 直线（自动标签；单变量 x=/y= 形式 tryImplicit2D 不支持）
    const line = k2.getConstruction().getElements().find(e => e instanceof GeoLine) as any;
    const conic = k2.getConstruction().getElements().find(e => e instanceof GeoConic) as any;
    addInput(k2, `pts = Intersect(${line.label}, ${conic.label})`);
    const ints = k2.getConstruction().getElements().filter(e => e instanceof GeoPoint && (e as GeoPoint).parentAlgo?.getClassName() === 'AlgoIntersect');
    expect(ints.length).toBeGreaterThanOrEqual(1);
    const label = (ints[0] as GeoPoint).label;
    expect(() => addInput(k2, `${label} = (1, 1)`)).toThrow(/multi-output/);
  });
});
