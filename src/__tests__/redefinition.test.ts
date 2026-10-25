/**
 * B12 标签重定义 回归测试（对标 GeoGebra 覆盖式重定义语义）：
 *   - `a = 1` 已存在时 `a = 2` 覆盖旧值，依赖它的算法级联更新；
 *   - 自由坐标点 `A = (1,2)` 同样可重定义；
 *   - 派生对象 / 函数标签不可重定义（保持报错）。
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel } from './helpers';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

describe('B12：标签重定义', () => {
  it('a = 1 后再 a = 2 覆盖旧值，依赖它的 f 跟随更新', () => {
    const kernel = makeKernel();
    addInput(kernel, 'a = 1');
    addInput(kernel, 'f(x) = a*x');
    addInput(kernel, 'a = 2');
    const a = kernel.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 'a') as GeoNumeric;
    expect(a.getValue()).toBe(2);
    // 依赖 a 的 f 应级联更新（f(3) = 6 而非 3）
    const fnEl = kernel.getConstruction().getElements().find(el => (el as any).evaluateAt) as any;
    expect(fnEl.evaluateAt(3)).toBeCloseTo(6, 9);
    // 旧的 a 已被删除重建：构造中只有一个 a
    const allA = kernel.getConstruction().getElements().filter(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 'a');
    expect(allA).toHaveLength(1);
  });

  it('自由坐标点可重定义', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 2)');
    addInput(kernel, 'A = (5, 6)');
    const pt = kernel.getConstruction().getElements().find(el => el instanceof GeoPoint && (el as GeoPoint).label === 'A') as GeoPoint;
    expect(pt.getX()).toBe(5);
    expect(pt.getY()).toBe(6);
  });

  it('依赖它的派生点在重定义后跟随', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (4, 0)');
    addInput(kernel, 'M = Midpoint(A, B)');
    addInput(kernel, 'A = (2, 2)');
    const m = kernel.getConstruction().getElements().find(el => el instanceof GeoPoint && (el as GeoPoint).label === 'M') as GeoPoint;
    // M = Midpoint((2,2),(4,0)) = (3, 1)
    expect(m.getX()).toBeCloseTo(3, 9);
    expect(m.getY()).toBeCloseTo(1, 9);
  });

  it('函数标签重定义已支持（2026-10-25）：换定义式成功且值更新', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = x^2');
    addInput(kernel, 'f(x) = x^3');
    const f = kernel.getConstruction().getElements().find(e => e instanceof GeoFunction) as GeoFunction;
    expect(f.evaluateAt(2)).toBeCloseTo(8, 6);
  });
});
