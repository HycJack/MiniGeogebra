import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { parseExpression } from '../kernel/algebra/ExpressionParser';
import { AlgoPointOnFunction } from '../kernel/algo/AlgoPointOnFunction';
import { functionParameterAt, hitScreenObject, isPointOnFunction } from '../components/tools/hitTests';
import { createParameterPointOnFunction } from '../components/tools/createElements';
import { makeKernel } from './helpers';

/** Register a free function (no driving slider) in the construction. */
const addFunction = (kernel: Kernel, expressionText: string): GeoFunction => {
  const construction = kernel.getConstruction();
  const fn = new GeoFunction(kernel, parseExpression(expressionText), 'x', expressionText);
  fn.label = construction.getNextFunctionLabel();
  construction.addElement(fn);
  return fn;
};

const addPointOnFunction = (kernel: Kernel, expressionText: string, parameter: number) => {
  const construction = kernel.getConstruction();
  const fn = addFunction(kernel, expressionText);
  const param = new GeoNumeric(kernel, parameter);
  param.label = construction.getNextNumericLabel();
  construction.addElement(param);
  const algo = new AlgoPointOnFunction(kernel, fn, param);
  construction.addElement(algo);
  construction.addElement(algo.getOutput());
  algo.update();
  return { fn, param, algo, point: algo.getOutput() };
};

const BOUNDS = { minX: -10, maxX: 10, pixelWidth: 1600 };

describe('AlgoPointOnFunction', () => {
  it('places the point on the curve at the parameter value', () => {
    const kernel = makeKernel();
    const { point } = addPointOnFunction(kernel, 'x^2', 3);

    expect(point.isDefined()).toBe(true);
    expect(point.getX()).toBeCloseTo(3, 10);
    expect(point.getY()).toBeCloseTo(9, 10);
  });

  it('recomputes the output point when update() runs after the parameter changes', () => {
    const kernel = makeKernel();
    const { param, algo, point } = addPointOnFunction(kernel, 'x^2', 3);

    param.setValue(5);
    algo.update();

    expect(point.getX()).toBeCloseTo(5, 10);
    expect(point.getY()).toBeCloseTo(25, 10);
  });

  it('propagates updateParameter() through the kernel update pipeline', () => {
    const kernel = makeKernel();
    const { algo, param, point } = addPointOnFunction(kernel, 'x^2', 3);

    algo.updateParameter(2);
    kernel.flushNow();

    expect(param.getValue()).toBeCloseTo(2, 10);
    expect(point.getX()).toBeCloseTo(2, 10);
    expect(point.getY()).toBeCloseTo(4, 10);
  });

  it('marks the output point undefined outside the function domain, then restores it', () => {
    const kernel = makeKernel();
    const { param, algo, point } = addPointOnFunction(kernel, 'sqrt(x)', -1);

    expect(point.isDefined()).toBe(false);

    param.setValue(4);
    algo.update();

    expect(point.isDefined()).toBe(true);
    expect(point.getX()).toBeCloseTo(4, 10);
    expect(point.getY()).toBeCloseTo(2, 10);
  });

  it('wires the function and parameter as inputs and the point as output', () => {
    const kernel = makeKernel();
    const { fn, param, algo, point } = addPointOnFunction(kernel, '2x + 1', 3);

    expect(algo.getInput()).toEqual([fn, param]);
    expect(algo.getGeoElements()).toEqual([point]);
    expect(algo.isAlgoElement()).toBe(true);
    expect(algo.isIndependent()).toBe(false);
    expect(point).toBeInstanceOf(GeoPoint);
    expect(point.parentAlgo).toBe(algo);
    expect(point.isIndependent()).toBe(false);
  });
});

describe('isPointOnFunction', () => {
  it('accepts a point exactly on the curve', () => {
    const kernel = makeKernel();
    const fn = addFunction(kernel, 'x^2');

    expect(isPointOnFunction(fn, 3, 9, 0.1, BOUNDS)).toBe(true);
  });

  it('rejects a point away from the curve', () => {
    const kernel = makeKernel();
    const fn = addFunction(kernel, 'x^2');

    expect(isPointOnFunction(fn, 3, 12, 0.1, BOUNDS)).toBe(false);
    expect(isPointOnFunction(fn, 0, 5, 0.1, BOUNDS)).toBe(false);
  });

  it('lets the eps tolerance decide membership at the boundary', () => {
    const kernel = makeKernel();
    const fn = addFunction(kernel, 'x');

    // The polyline for y = x is exactly linear, so the distance is exactly 0.02.
    expect(isPointOnFunction(fn, 5, 5.02, 0.01, BOUNDS)).toBe(false);
    expect(isPointOnFunction(fn, 5, 5.02, 0.03, BOUNDS)).toBe(true);
  });
});

describe('functionParameterAt', () => {
  it('returns the closest parameter even for a distant query', () => {
    const kernel = makeKernel();
    const fn = addFunction(kernel, 'x^2');

    expect(functionParameterAt(fn, 3, 9, BOUNDS)).toBeCloseTo(3, 1);

    const far = functionParameterAt(fn, -5, 1000, BOUNDS);
    expect(Number.isFinite(far)).toBe(true);
    expect(far).toBeGreaterThanOrEqual(BOUNDS.minX - 1e-6);
    expect(far).toBeLessThanOrEqual(BOUNDS.maxX + 1e-6);
  });

  it('returns NaN when every sample is undefined', () => {
    const kernel = makeKernel();
    const fn = addFunction(kernel, 'sqrt(x)');

    const negativeBounds = { minX: -6, maxX: -1, pixelWidth: 1600 };
    expect(functionParameterAt(fn, -3, 0, negativeBounds)).toBeNaN();
  });
});

describe('hitScreenObject', () => {
  it('hits the function curve and ignores empty space', () => {
    const kernel = makeKernel();
    const fn = addFunction(kernel, 'x^2');
    const scale = 100;

    expect(hitScreenObject([fn], 3, 9, scale)).toBe(fn);
    expect(hitScreenObject([fn], -40, 1600, scale)).toBe(fn);
    expect(hitScreenObject([fn], 3, 9.5, scale)).toBeUndefined();
    expect(hitScreenObject([fn], -40, 0, scale)).toBeUndefined();
  });
});

/**
 * 契约锁定：hitScreenObject 的第三个参数是“每世界单位多少像素”（coord.xScale）。
 * 命中半径必须是以像素为单位的常量，不能随缩放漂移。
 *
 * handlers.ts 曾经错传 `OBJ_EPS / coord.xScale`（世界 eps），导致内部阈值变成
 * `5 / (5/xScale) = xScale` 世界单位，即 `xScale²` 像素——放大 50 倍后命中半径
 * 变成 5000 像素，整块画布都能“命中”任意一条线。以下用例就是那个 bug 的回归网。
 */
describe('hitScreenObject —— 命中半径随缩放保持恒定（像素常量）', () => {
  const SCALES = [1, 10, 100, 500];

  it.each(SCALES)('线：scale=%i 时 1px 偏移命中、6px 偏移落空', scale => {
    const kernel = makeKernel();
    const line = new GeoLine(kernel, 0, 1, 0); // y = 0
    const els = [line];

    expect(hitScreenObject(els, 0, 1 / scale, scale)).toBe(line);
    expect(hitScreenObject(els, 50, 1 / scale, scale)).toBe(line);
    expect(hitScreenObject(els, 0, 6 / scale, scale)).toBeUndefined();
  });

  it.each(SCALES)('点：scale=%i 时命中热区为 10px', scale => {
    const kernel = makeKernel();
    const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    // 只放点：不要同位置放线，否则会被线的 5px 热区抢先命中
    const els = [p];

    expect(hitScreenObject(els, 1 / scale, 0, scale)).toBe(p);
    expect(hitScreenObject(els, 9 / scale, 0, scale)).toBe(p);
    expect(hitScreenObject(els, 11 / scale, 0, scale)).toBeUndefined();
  });

  it('同一处点击在不同缩放下结论一致（5px 处始终落空）', () => {
    const kernel = makeKernel();
    const line = new GeoLine(kernel, 0, 1, 0);
    const els = [line];

    for (const scale of [2, 25, 250]) {
      expect(hitScreenObject(els, 0, 5.5 / scale, scale), `scale=${scale}`).toBeUndefined();
    }
  });
});

describe('createParameterPointOnFunction —— 参数带唯一标签', () => {
  it('生成的滑块有标签，避免代数视图出现无名数值', () => {
    const kernel = makeKernel();
    const fn = addFunction(kernel, 'x^2');

    const { param, point, algo } = createParameterPointOnFunction(kernel, fn, 3);

    expect(param.label).toBeDefined();
    expect(param.label.length).toBeGreaterThan(0);
    expect(param.getValue()).toBe(3);
    expect(algo).toBeInstanceOf(AlgoPointOnFunction);
    expect(point.parentAlgo).toBe(algo);
    // 点在曲线上：x=3 → y=9
    expect(point.getX()).toBeCloseTo(3, 6);
    expect(point.getY()).toBeCloseTo(9, 6);
  });

  it('连续两次创建的参数标签不重复', () => {
    const kernel = makeKernel();
    const fn = addFunction(kernel, 'x');

    const a = createParameterPointOnFunction(kernel, fn, 1);
    const b = createParameterPointOnFunction(kernel, fn, 2);

    expect(a.param.label).not.toBe(b.param.label);
  });

  it('三个元素都进了构造图，且拖动参数时下游能被增量更新找到', () => {
    const kernel = makeKernel();
    const fn = addFunction(kernel, 'x^2');

    const { param, point, algo } = createParameterPointOnFunction(kernel, fn, 2);
    const construction = kernel.getConstruction();

    expect(construction.getElements()).toContain(param);
    expect(construction.getElements()).toContain(point);
    // 拖动参数时，增量更新应能通过前向依赖图找到下游算法
    expect(construction.getForwardDependentAlgorithms(param)).toContain(algo);
  });
});
