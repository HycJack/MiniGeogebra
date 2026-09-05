import { describe, expect, it } from 'vitest';
import { evaluate } from '../kernel/algebra/ExpressionEvaluator';
import { parseExpression } from '../kernel/algebra/ExpressionParser';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { AlgoDependentFunction } from '../kernel/algo/AlgoDependentFunction';
import { AlgoDependentNumeric } from '../kernel/algo/AlgoDependentNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { makeKernel } from './helpers';

const addToConstruction = (
  kernel: ReturnType<typeof makeKernel>,
  elements: ReturnType<typeof parseAlgebraInput>,
) => {
  const construction = kernel.getConstruction();
  elements.forEach(element => construction.addElement(element));
  construction.updateAllAlgorithms();
  return elements;
};

describe('expression parser and evaluator', () => {
  it('parses precedence, unary minus, and implicit multiplication', () => {
    const scope = new Map([['x', 2]]);
    expect(evaluate(parseExpression('2x + 3(x + 1)^2'), scope)).toBe(31);
    expect(evaluate(parseExpression('-3x^2'), scope)).toBe(-12);
    expect(evaluate(parseExpression('abs(sin(0))'), scope)).toBe(0);
  });

  it('returns NaN for undefined arithmetic and unknown variables', () => {
    expect(evaluate(parseExpression('1/0'), new Map())).toBeNaN();
    expect(evaluate(parseExpression('sqrt(-4)'), new Map())).toBeNaN();
    expect(evaluate(parseExpression('x'), new Map())).toBeNaN();
  });

  it('rejects trailing text', () => {
    expect(() => parseExpression('2x)')).toThrow();
  });
});

describe('algebra input recognition', () => {
  it('creates named, bare, and y-form functions', () => {
    const kernel = makeKernel();
    const construction = kernel.getConstruction();
    addToConstruction(kernel, parseAlgebraInput(kernel, 'f(x) = x^2 + 3x - 1'));
    addToConstruction(kernel, parseAlgebraInput(kernel, '2x + 3'));
    addToConstruction(kernel, parseAlgebraInput(kernel, 'y = x - 1'));

    const functions = construction.getElements().filter((el): el is GeoFunction => el instanceof GeoFunction);
    expect(functions.map(fn => fn.label)).toEqual(['f', 'g', 'h']);
    expect(functions[0].evaluateAt(2)).toBe(9);
    expect(functions[1].evaluateAt(2)).toBe(7);
    expect(functions[2].evaluateAt(2)).toBe(1);
    expect(functions[0].getAlgebraDescription()).toBe('f(x) = x^2 + 3x - 1');
  });

  it('creates literal and dependent numbers with labels', () => {
    const kernel = makeKernel();
    const construction = kernel.getConstruction();
    addToConstruction(kernel, parseAlgebraInput(kernel, 'a = 3'));
    addToConstruction(kernel, parseAlgebraInput(kernel, 'b = a + 4'));

    const numbers = construction.getElements().filter((el): el is GeoNumeric => el instanceof GeoNumeric);
    expect(numbers.map(number => [number.label, number.getValue()])).toEqual([['a', 3], ['b', 7]]);
    expect(construction.getElements().some(el => el instanceof AlgoDependentNumeric)).toBe(true);
  });

  it('propagates slider updates to dependent functions', () => {
    const kernel = makeKernel();
    addToConstruction(kernel, parseAlgebraInput(kernel, 'a = 2'));
    const elements = addToConstruction(kernel, parseAlgebraInput(kernel, 'f(x) = a*x'));
    const numeric = kernel.getConstruction().getElements()
      .find((el): el is GeoNumeric => el instanceof GeoNumeric && el.label === 'a')!;
    const fn = elements.find((el): el is GeoFunction => el instanceof GeoFunction)!;

    expect(fn.evaluateAt(3)).toBe(6);
    numeric.setValue(5);
    kernel.flushNow();
    expect(fn.evaluateAt(3)).toBe(15);
  });

  it('breaks curves at undefined samples and rejects invalid input', () => {
    const kernel = makeKernel();
    const fn = addToConstruction(kernel, parseAlgebraInput(kernel, 'f(x) = 1/(x-2)'))
      .find((el): el is GeoFunction => el instanceof GeoFunction)!;
    const samples = fn.updateSamples(0, 4, 100);
    expect(samples[0].y).toBeCloseTo(-0.5, 8);
    expect(samples.some(sample => Number.isNaN(sample.y))).toBe(true);
    expect(samples[samples.length - 1].y).toBeCloseTo(0.5, 8);

    expect(() => parseAlgebraInput(kernel, 'f(x) = 1/(x-2)')).toThrow('already exists');
    expect(() => parseAlgebraInput(kernel, '= 5')).toThrow();
  });

  it('keeps dependency links as algorithm objects', () => {
    const kernel = makeKernel();
    const elements = addToConstruction(kernel, parseAlgebraInput(kernel, 'f(x) = x*x'));
    expect(elements[0]).toBeInstanceOf(AlgoDependentFunction);
    expect(elements[1]).toBeInstanceOf(GeoFunction);
    expect((elements[1] as GeoFunction).parentAlgo).toBe(elements[0]);
  });
});
