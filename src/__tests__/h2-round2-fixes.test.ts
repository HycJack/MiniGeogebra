/**
 * 2026-10-26 复审轮第二批修复回归（未实现清单.md H2 前五项）：
 * 嵌套用户函数链传递闭包、Angle(P,Q) 两点形式、Distance 点-线段端点钳制与
 * 平行线距、Extremum 2 参干净报错、Arc 非圆干净报错、TaylorSeries 官方参数序
 * （phase2-commands.test.ts 已覆盖）。
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoSegment } from '../kernel/geo/GeoSegment';
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

describe('嵌套用户函数链（传递闭包）', () => {
  it('h(x)=g(x)+1、g(x)=f(x)+1、f(x)=x² 三层链全部可求值（此前 h 全域 NaN）', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^2');
    addInput(k, 'g(x) = f(x) + 1');
    addInput(k, 'h(x) = g(x) + 1');
    const h = labelOf<GeoFunction>(k, 'h');
    expect(h).toBeDefined();
    // f(2)=4 → g(2)=5 → h(2)=6（此前 h 全域 NaN）
    expect(h!.evaluateAt(2)).toBeCloseTo(6, 9);
    const g = labelOf<GeoFunction>(k, 'g');
    expect(g!.evaluateAt(2)).toBeCloseTo(5, 9);
    // 数值上下文同样走链：v = h(3) = f(3)+2 = 11
    addInput(k, 'v = h(3)');
    const v = labelOf<GeoNumeric>(k, 'v');
    expect(v).toBeDefined();
    expect(v!.getValue()).toBeCloseTo(11, 9);
  });
});

describe('Angle(P, Q) 两点形式（官方 CmdAngle.process2）', () => {
  it('Angle((1,0),(0,1)) = 90°；此前对 undefined 取 trim 抛 TypeError', () => {
    const k = makeKernel();
    addInput(k, 'A = (1, 0)');
    addInput(k, 'B = (0, 1)');
    addInput(k, 'ang = Angle(A, B)');
    const ang = labelOf<GeoNumeric>(k, 'ang');
    expect(ang).toBeDefined();
    expect(ang!.isDefined()).toBe(true);
    expect(ang!.getValue()).toBeCloseTo(Math.PI / 2, 9);
  });

  it('Angle((0,0),Q) 零向量 → undefined（无方向）', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (1, 1)');
    addInput(k, 'ang = Angle(A, B)');
    const ang = labelOf<GeoNumeric>(k, 'ang');
    expect(ang).toBeDefined();
    expect(ang!.isDefined()).toBe(false);
  });

  it('Angle 参数不匹配 → 干净报错而非 TypeError', () => {
    const k = makeKernel();
    addInput(k, 'A = (1, 0)');
    expect(() => addInput(k, 'ang = Angle(A)')).toThrow(/Angle/);
    expect(() => addInput(k, 'ang = Angle(A, 3)')).toThrow(/Angle/);
  });
});

describe('Distance 语义', () => {
  it('Distance(点, 线段) 垂足出段时取最近端点（此前按无限直线偏小）', () => {
    const k = makeKernel();
    addInput(k, 'A = (0, 0)');
    addInput(k, 'B = (4, 0)');
    addInput(k, 's = Segment(A, B)');
    addInput(k, 'P = (6, 3)');
    addInput(k, 'd = Distance(P, s)');
    const d = labelOf<GeoNumeric>(k, 'd');
    expect(d).toBeDefined();
    expect(d!.isDefined()).toBe(true);
    // 垂足 x=6 出段 → 最近端点 B=(4,0)，距离 √(4+9)=√13（无限直线算给 3）
    expect(d!.getValue()).toBeCloseTo(Math.sqrt(13), 9);
  });

  it('Distance(l1, l2) 平行线距（此前静默 undefined）', () => {
    const k = makeKernel();
    // 标签冒号前缀（l1: y=1）不受支持（已知解析限制），用 Line 命令创建
    addInput(k, 'l1 = Line((0, 1), (1, 1))');
    addInput(k, 'l2 = Line((0, 4), (1, 4))');
    addInput(k, 'd = Distance(l1, l2)');
    const d = labelOf<GeoNumeric>(k, 'd');
    expect(d).toBeDefined();
    expect(d!.isDefined()).toBe(true);
    expect(d!.getValue()).toBeCloseTo(3, 9);
  });

  it('Distance(l1, l2) 相交线 → undefined', () => {
    const k = makeKernel();
    addInput(k, 'l1 = Line((0, 0), (1, 0))');
    addInput(k, 'l2 = Line((0, 0), (0, 1))');
    addInput(k, 'd = Distance(l1, l2)');
    const d = labelOf<GeoNumeric>(k, 'd');
    expect(d).toBeDefined();
    expect(d!.isDefined()).toBe(false);
  });
});

describe('干净报错（此前静默错误结果或 TypeError）', () => {
  it('Extremum(f, x0) 两参 → 参数错误提示（此前 args[1] 被静默吞掉）', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x^2');
    expect(() => addInput(k, 'e = Extremum(f, 1)')).toThrow(/Extremum expects/);
  });

  it('Arc(椭圆, A, B) → 明确不支持提示（此前静默降级为错误半径的圆弧）', () => {
    const k = makeKernel();
    makePoint(k, 1, 1, 'A');
    makePoint(k, -1, 1, 'B');
    addInput(k, 'x²/4 + y² = 1');
    expect(() => addInput(k, 'arc = Arc(x²/4 + y² = 1, A, B)')).toThrow(/not supported/);
  });
});
