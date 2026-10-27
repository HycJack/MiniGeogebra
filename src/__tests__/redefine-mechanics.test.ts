/**
 * 重定义机制补强回归（未实现清单.md H2-8 簇，2026-10-27 第三批）：
 * 样式/条件保留（copyStyleForRedefine）、循环定义递归守卫（isChildOf 语义）、
 * 条件依赖重映射与删除解除、条件求值失败即隐藏（官方 isShown 语义）、
 * 条件显隐/动态颜色序列化 roundtrip。
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { makeKernel, makePoint } from './helpers';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const roundtrip = (kernel: Kernel): Kernel => {
  const restored = new Kernel();
  deserialize(restored, serialize(kernel, new CoordinateSystem(800, 600, 400, 300, 50, 50)));
  restored.getConstruction().updateAllAlgorithms();
  return restored;
};

const labelOf = <T>(kernel: Kernel, label: string): T | undefined =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label) as T | undefined;

describe('重定义样式保留（copyStyleForRedefine）', () => {
  it('重定义后颜色/fixed/labelOffset/条件显隐全部保留（此前回退默认）', () => {
    const k = makeKernel();
    makePoint(k, 1, 1, 'A');
    const a = labelOf<GeoPoint>(k, 'A')!;
    a.strokeColor = '#ff0000';
    a.isFixed = true;
    a.labelOffsetX = 17;
    a.labelOffsetY = -9;
    a.trace = true;
    a.layer = 4;
    addInput(k, 'n = 2');
    addInput(k, 'A = (3, 3)'); // 重定义：自由点 → 依赖坐标字面量点（标识符元组 (n,n) 是既有解析限制）
    const a2 = labelOf<GeoPoint>(k, 'A')!;
    expect(a2).toBeDefined();
    expect(a2.strokeColor).toBe('#ff0000');
    expect(a2.isFixed).toBe(true);
    expect(a2.labelOffsetX).toBe(17);
    expect(a2.labelOffsetY).toBe(-9);
    expect(a2.trace).toBe(true);
    expect(a2.layer).toBe(4);
    expect(a2.getX()).toBeCloseTo(3, 9);
  });

  it('依赖对象的条件显隐在重定义其上游后保留且跟随新值', () => {
    const k = makeKernel();
    addInput(k, 't = 2');
    addInput(k, 'k = 0');
    addInput(k, 'B = (1, 1)');
    const b = labelOf<GeoPoint>(k, 'B')!;
    addInput(k, 'SetConditionToShowObject(k > 1, B)');
    expect(b.isEffectivelyVisible()).toBe(false); // k=0 不满足
    addInput(k, 'k = t + 2'); // 重定义 k：0 → 4（不引用自身的合法重定义）
    const b2 = labelOf<GeoPoint>(k, 'B')!;
    expect(b2.isEffectivelyVisible()).toBe(true); // 条件跟随新 k=4
  });
});

describe('循环定义递归守卫', () => {
  it('间接环被拒：a=c+1 于 c=a+1 之后（此前被接受、值互相冻结）', () => {
    const k = makeKernel();
    addInput(k, 'a = 1');
    addInput(k, 'c = a + 1');
    expect(() => addInput(k, 'a = c + 1')).toThrow(/Circular definition/);
    // 构造未被破坏：a 仍是自由数值 1
    const a = labelOf<GeoNumeric>(k, 'a')!;
    expect(a.getValue()).toBe(1);
    expect(a.isIndependent()).toBe(true);
  });

  it('函数互引环被拒：g(x)=f(x)+1 之后重定义 f(x)=g(x)', () => {
    const k = makeKernel();
    addInput(k, 'f(x) = x + 1');
    addInput(k, 'g(x) = f(x) + 1');
    expect(() => addInput(k, 'f(x) = g(x) + 1')).toThrow(/Circular definition/);
  });

  it('无环重定义仍可用：a=b+1 于 b=2 之后', () => {
    const k = makeKernel();
    addInput(k, 'b = 2');
    addInput(k, 'a = 1');
    addInput(k, 'a = b + 1');
    const a = labelOf<GeoNumeric>(k, 'a')!;
    expect(a.getValue()).toBe(3);
  });
});

describe('条件求值语义（官方 isShown）', () => {
  it('条件依赖未定义/被删除 → 对象隐藏（此前冻结于旧值或恒可见）', () => {
    const k = makeKernel();
    addInput(k, 'n = 1');
    addInput(k, 'P = (2, 2)');
    const p = labelOf<GeoPoint>(k, 'P')!;
    addInput(k, 'SetConditionToShowObject(n > 0, P)');
    expect(p.isEffectivelyVisible()).toBe(true);
    // 删除依赖数值 → 条件解除引用 → AST 求值 NaN → 隐藏（不再冻结于旧值）
    const n = labelOf<GeoNumeric>(k, 'n')!;
    k.getConstruction().deleteElementWithDependents(n);
    const p2 = labelOf<GeoPoint>(k, 'P')!;
    expect(p2.visibleCondition?.deps.length ?? 0).toBe(0);
    expect(p2.isEffectivelyVisible()).toBe(false);
  });
});

describe('条件显隐/动态颜色序列化 roundtrip', () => {
  it('SetConditionToShowObject + SetDynamicColor 存取后语义保持', () => {
    const k = makeKernel();
    addInput(k, 'n = 2');
    addInput(k, 'Q = (1, 1)');
    addInput(k, 'SetConditionToShowObject(n > 1, Q)');
    addInput(k, 'SetDynamicColor(Q, sin(n), 0, 0.5)'); // 官方参数序：target 在前
    const restored = roundtrip(k);
    const q = labelOf<GeoPoint>(restored, 'Q')!;
    expect(q).toBeDefined();
    expect(q.visibleCondition).not.toBeNull();
    expect(q.isEffectivelyVisible()).toBe(true); // n=2 > 1
    const color = q.resolveDynamicColor();
    expect(color).not.toBeNull();
    expect(color!.b).toBeCloseTo(0.5, 9);
    expect(color!.r).toBeCloseTo(Math.sin(2), 9);
    // 条件在恢复后仍活：改 n=0 → 隐藏
    const n = labelOf<GeoNumeric>(restored, 'n')!;
    n.setValue(0);
    restored.getConstruction().updateDependentAlgorithms(n);
    expect(q.isEffectivelyVisible()).toBe(false);
  });

  it('无条件对象 roundtrip 后仍无条件', () => {
    const k = makeKernel();
    addInput(k, 'R = (3, 3)');
    const restored = roundtrip(k);
    const r = labelOf<GeoPoint>(restored, 'R')!;
    expect(r.visibleCondition).toBeNull();
    expect(r.dynamicColor).toBeNull();
  });
});
