import { describe, expect, it } from 'vitest';
import { parseExpression } from '../kernel/algebra/ExpressionParser';
import { evaluate } from '../kernel/algebra/ExpressionEvaluator';
import { differentiate, expressionToString } from '../kernel/algebra/Differentiator';

/** 对 `text` 关于 `variable` 求导，并在 x = value 处求值。 */
const derivativeAt = (text: string, value: number, variable = 'x', extra = new Map<string, number>()): number =>
  evaluate(differentiate(parseExpression(text), variable), new Map([...extra, [variable, value]]));

/** 中心差分参考值，用于交叉验证符号微分结果。 */
const centralDifference = (f: (x: number) => number, x: number, h = 1e-6): number =>
  (f(x + h) - f(x - h)) / (2 * h);

describe('differentiate: basic rules', () => {
  it('differentiates a constant to zero', () => {
    // 用 toBeCloseTo 而非 toBe：`d(-7)` 会经 simplify 产生 num(-0)，
    // 而 Object.is(-0, 0) 为 false
    expect(derivativeAt('5', 3)).toBeCloseTo(0, 10);
    expect(derivativeAt('-7', 3)).toBeCloseTo(0, 10);
  });

  it('differentiates a monomial with the power rule', () => {
    // d/dx x^5 = 5x^4
    expect(derivativeAt('x^5', 2)).toBeCloseTo(5 * 16, 8);
    // d/dx x^3 = 3x^2 —— 指数为常数时必须走退化式 3x^2，而不是通用式
    // x^3*(3/x)（后者在 x = 0 处为 0 * NaN = NaN）
    expect(derivativeAt('x^3', -2)).toBeCloseTo(12, 8);
    expect(derivativeAt('x^3', 0)).toBeCloseTo(0, 8);
    expect(derivativeAt('x^2 + 3x - 1', 0)).toBeCloseTo(3, 8);
  });

  it('differentiates a polynomial term by term', () => {
    // d/dx (3x^2 + 2x - 1) = 6x + 2
    expect(derivativeAt('3x^2 + 2x - 1', 3)).toBeCloseTo(20, 8);
  });

  it('applies the product rule', () => {
    // d/dx [(2x+1)(x-3)] = 2(x-3) + (2x+1)
    const symbolic = derivativeAt('(2x+1)*(x-3)', 2);
    const numeric = centralDifference(x => (2 * x + 1) * (x - 3), 2);
    expect(symbolic).toBeCloseTo(numeric, 6);
    expect(symbolic).toBeCloseTo(3, 8);
  });

  it('applies the quotient rule', () => {
    // d/dx [(x+1)/(x-2)] = -3 / (x-2)^2
    const symbolic = derivativeAt('(x+1)/(x-2)', 3);
    const numeric = centralDifference(x => (x + 1) / (x - 2), 3);
    expect(symbolic).toBeCloseTo(numeric, 6);
    expect(symbolic).toBeCloseTo(-3, 8);
  });

  it('treats other variables as constants', () => {
    // d/dx (a*x^2) = 2*a*x，a 视为常数
    expect(derivativeAt('a*x^2', 3, 'x', new Map([['a', 5]]))).toBeCloseTo(30, 8);
    // 对 a 求导时 x 是常数
    expect(derivativeAt('a*x^2', 5, 'a', new Map([['x', 3]]))).toBeCloseTo(9, 8);
  });

  it('matches central differences across many shapes', () => {
    const cases: Array<[string, number]> = [
      ['x^4 - 2x^2 + x', 1.7],
      ['(x+1)*(x-2)*(x+3)', -0.4],
      ['x^2/(x+1)', 2],
      ['1/x', 1],
    ];
    for (const [text, x] of cases) {
      const f = (t: number) => evaluate(parseExpression(text), new Map([['x', t]]));
      expect(derivativeAt(text, x)).toBeCloseTo(centralDifference(f, x), 4);
    }
  });
});

describe('differentiate: built-in functions and chain rule', () => {
  it('differentiates trigonometric functions', () => {
    expect(derivativeAt('sin(x)', 0)).toBeCloseTo(1, 8);
    expect(derivativeAt('cos(x)', 0)).toBeCloseTo(0, 8);
    expect(derivativeAt('cos(x)', Math.PI / 2)).toBeCloseTo(-1, 8);
    expect(derivativeAt('tan(x)', 0)).toBeCloseTo(1, 8);
  });

  it('differentiates exp and the two logarithms', () => {
    expect(derivativeAt('exp(x)', 0)).toBeCloseTo(1, 8);
    expect(derivativeAt('exp(x)', 1)).toBeCloseTo(Math.E, 8);
    expect(derivativeAt('ln(x)', 1)).toBeCloseTo(1, 8);
    // 本引擎 log 是以 10 为底，d/dx log10(x) = 1 / (x * ln 10)
    expect(derivativeAt('log(x)', 1)).toBeCloseTo(1 / Math.LN10, 8);
    expect(derivativeAt('log(x)', 10)).toBeCloseTo(1 / (10 * Math.LN10), 8);
  });

  it('differentiates sqrt and abs with the correct sign', () => {
    expect(derivativeAt('sqrt(x)', 4)).toBeCloseTo(0.25, 8);
    expect(derivativeAt('sqrt(x)', 16)).toBeCloseTo(0.125, 8);
    expect(derivativeAt('abs(x)', 2)).toBeCloseTo(1, 8);
    expect(derivativeAt('abs(x)', -2)).toBeCloseTo(-1, 8);
  });

  it('applies the chain rule to nested arguments', () => {
    // d/dx sin(x^2) = 2x * cos(x^2)
    expect(derivativeAt('sin(x^2)', 1)).toBeCloseTo(2 * Math.cos(1), 8);
    expect(derivativeAt('sin(x^2)', 2)).toBeCloseTo(4 * Math.cos(4), 8);
    // d/dx sin(2x) = 2cos(2x)
    expect(derivativeAt('sin(2x)', 0)).toBeCloseTo(2, 8);
    // d/dx exp(sin(x)) = cos(x) * exp(sin(x))
    expect(derivativeAt('exp(sin(x))', 0)).toBeCloseTo(1, 8);
    expect(derivativeAt('exp(sin(x))', 1)).toBeCloseTo(Math.cos(1) * Math.exp(Math.sin(1)), 8);
    // d/dx sqrt(x^2 + 1) = x / sqrt(x^2+1)
    expect(derivativeAt('sqrt(x^2 + 1)', 2)).toBeCloseTo(2 / Math.sqrt(5), 8);
  });

  it('differentiates multi-argument functions to zero', () => {
    for (const text of ['min(x, 2)', 'max(x, 2)', 'floor(x)', 'ceil(x)', 'round(x)']) {
      expect(derivativeAt(text, 1.5)).toBe(0);
    }
  });
});

describe('expressionToString', () => {
  it('round-trips through the parser to an equivalent expression', () => {
    const cases = ['x^2 + 3x - 1', '2x', 'sin(x^2)', '(2x+1)*(x-3)', '(x+1)/(x-2)', 'exp(sin(x))'];
    for (const text of cases) {
      const original = parseExpression(text);
      const rendered = expressionToString(original);
      const reparsed = parseExpression(rendered);
      for (const value of [-1.5, 0, 0.5, 2.25]) {
        const a = evaluate(original, new Map([['x', value]]));
        const b = evaluate(reparsed, new Map([['x', value]]));
        if (Number.isFinite(a)) expect(b).toBeCloseTo(a, 8);
      }
    }
  });

  it('renders readable implicit multiplication and avoids "1 + -x"', () => {
    const implicit = expressionToString(parseExpression('2x'));
    expect(implicit).toBe('2x');

    const noDoubleSign = expressionToString(parseExpression('1 + -x'));
    expect(noDoubleSign).not.toContain('+ -');
    // 折叠后应与原式等价
    expect(evaluate(parseExpression(noDoubleSign), new Map<string, number>([['x', 3]]))).toBeCloseTo(-2, 8);
  });

  it('adds parentheses according to precedence', () => {
    const text = expressionToString(parseExpression('(x+1)*(x-2)'));
    expect(text).toContain('(');
    expect(evaluate(parseExpression(text), new Map<string, number>([['x', 3]]))).toBeCloseTo(4, 8);
  });
});
