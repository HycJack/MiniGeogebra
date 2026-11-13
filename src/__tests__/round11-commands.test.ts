/**
 * 审核轮十一补充回归：Sum(list, n) 截断、AxisStepX/Y、FitImplicit、
 * L6-5 全路径匀速（path-uniform.test.ts 另有）。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint } from './helpers';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoLine } from '../kernel/geo/GeoLine';

const findEl = <T>(kernel: ReturnType<typeof makeKernel>, cls: new (...a: never[]) => T, label?: string): T =>
  kernel.getConstruction().getElements().find(
    el => el instanceof cls && (label === undefined || (el as { label?: string }).label === label),
  ) as T;

const addInput = (kernel: ReturnType<typeof makeKernel>, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

describe('Sum(list, n) 截断（官方 AlgoStats1D Truncate）', () => {
  it('前 n 项和', () => {
    const k = makeKernel();
    addInput(k, 'l = {1, 2, 3, 4}');
    addInput(k, 's = Sum(l, 2)');
    expect(findEl(k, GeoNumeric, 's').getValue()).toBe(3);
  });

  it('n=0 → 0；n 越界 → undefined', () => {
    const k = makeKernel();
    addInput(k, 'l = {1, 2, 3, 4}');
    addInput(k, 's0 = Sum(l, 0)');
    expect(findEl(k, GeoNumeric, 's0').getValue()).toBe(0);
    addInput(k, 's9 = Sum(l, 9)');
    expect(findEl(k, GeoNumeric, 's9').isDefined()).toBe(false);
  });
});

describe('AxisStepX/Y（官方 view.getGridDistances 通道）', () => {
  it('返回当前网格步长（视图缩放回写）', () => {
    const k = makeKernel();
    addInput(k, 'sx = AxisStepX()');
    addInput(k, 'sy = AxisStepY()');
    const sx = findEl(k, GeoNumeric, 'sx');
    expect(sx).toBeDefined();
    expect(sx.getValue()).toBeGreaterThan(0);
  });
});

describe('FitImplicit（官方 AlgoFitImplicit：SVD 零空间拟合）', () => {
  it('order 1：共线点拟合成直线', () => {
    const k = makeKernel();
    for (const [x, y] of [[0, 1], [1, 3], [2, 5], [3, 7]]) {
      makePoint(k, x, y, `P${x}`);
    }
    addInput(k, 'f = FitImplicit({P0, P1, P2, P3}, 1)');
    const line = findEl(k, GeoLine, 'f');
    expect(line).toBeDefined();
    expect(line.isDefined()).toBe(true);
    // 直线 2x − y + 1 = 0：点 (0,1) 满足
    expect(Math.abs(line.a * 0 + line.b * 1 + line.c)).toBeLessThan(1e-6);
    expect(Math.abs(line.a * 3 + line.b * 7 + line.c)).toBeLessThan(1e-6);
  });

  it('order 2：圆上点拟合成圆方程', () => {
    const k = makeKernel();
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * 2 * Math.PI;
      makePoint(k, 2 * Math.cos(t), 2 * Math.sin(t), `C${i}`);
    }
    const pts = Array.from({ length: 8 }, (_, i) => `C${i}`).join(', ');
    addInput(k, `fc = FitImplicit({${pts}}, 2)`);
    const conic = findEl(k, GeoConic, 'fc');
    expect(conic).toBeDefined();
    expect(conic.isDefined()).toBe(true);
    expect(conic.getConicType()).toBe('circle');
    expect(conic.getRadius()).toBeCloseTo(2, 3);
  });
});
