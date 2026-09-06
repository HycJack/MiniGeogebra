import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { parseExpression } from '../kernel/algebra/ExpressionParser';
import { AlgoPointOnFunction } from '../kernel/algo/AlgoPointOnFunction';
import { functionParameterAt, hitScreenObject, isPointOnFunction } from '../components/tools/hitTests';
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
