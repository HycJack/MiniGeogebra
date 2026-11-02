/**
 * 函数分析命令的活算法壳——Integral / TaylorSeries / Slope(function)。
 * 此前三者在识别器里构造期算完返回自由数值/快照函数（parentAlgo=null），
 * f 变化（拖拽、重拟合、滑块驱动、重定义）后永远滞留旧值。
 * 对标官方 AlgoIntegralDefinite / AlgoTaylorSeriesFunction：f 注册为输入。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoNumeric } from '../geo/GeoNumeric';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';
import { differentiate, expressionToString } from '../algebra/Differentiator';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { integrate } from '../algebra/Numerics';

/** 数值或活数值参数取当前值。 */
function resolveArg(at: number | GeoNumeric): number {
  return typeof at === 'number' ? at : at.getValue();
}

/** 源函数的数值依赖求值 scope（派生函数的隐藏参数、滑块等）。 */
export function sourceFunctionScope(fn: GeoFunction): Scope {
  const scope: Scope = new Map();
  const pa = fn.parentAlgo;
  const deps = pa && typeof (pa as unknown as { getDependencies?: () => GeoNumeric[] }).getDependencies === 'function'
    ? (pa as unknown as { getDependencies: () => GeoNumeric[] }).getDependencies()
    : [];
  deps.forEach((d, i) => scope.set(d.label || `dep${i}`, d.getValue()));
  return scope;
}

/**
 * 定积分 ∫[a,b] f(x)dx。区间端点可以是滑块；发散/非有限输出 undefined
 * （官方 AlgoIntegralDefinite 语义）。
 */
export class AlgoIntegralDefinite extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(
    kernel: IKernel,
    private fn: GeoFunction,
    private a: number | GeoNumeric,
    private b: number | GeoNumeric,
  ) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    const nums = [this.a, this.b].filter((v): v is GeoNumeric => v instanceof GeoNumeric);
    this.input = [this.fn, ...nums];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const result = integrate(x => this.fn.evaluateAt(x), resolveArg(this.a), resolveArg(this.b));
    if (!Number.isFinite(result.value) || !result.converged) {
      this.outputValue.setUndefined();
      return;
    }
    this.outputValue.setValue(result.value);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }

  /** 端点原值（序列化判活引用用）。 */
  getA(): number | GeoNumeric { return this.a; }
  getB(): number | GeoNumeric { return this.b; }

  /** 序列化：数值端点快照（活 GeoNumeric 走 inputs）。 */
  getEndpointScalars(): number[] {
    return [resolveArg(this.a), resolveArg(this.b)];
  }
}

/**
 * 泰勒展开 T(x) = Σ f⁽ᵏ⁾(c)/k!·(x−c)ᵏ。展开点 c 可以是滑块；
 * f 表达式替换或 c 变化时重新展开（输出 GeoFunction 就地重建）。
 */
export class AlgoTaylorSeriesFunction extends AlgoElement {
  private outputFunction: GeoFunction;
  private lastSourceExpression: ExpressionNode | null = null;
  private lastCenter = NaN;
  private lastOrder = -1;

  constructor(
    kernel: IKernel,
    private fn: GeoFunction,
    private center: number | GeoNumeric,
    private order: number,
  ) {
    super(kernel);
    this.order = Math.max(0, Math.round(order));
    this.outputFunction = new GeoFunction(kernel, fn.expression, fn.variableName, '');
    this.setInputOutput();
  }

  setInputOutput(): void {
    const nums = this.center instanceof GeoNumeric ? [this.center] : [];
    this.input = [this.fn, ...nums];
    this.setOutput([this.outputFunction]);
  }

  compute(): void {
    // 每帧重展开：f 为 scope 驱动（表达式 AST 不变、仅滑块数值变）时
    // 引用比较无法感知系数变化——展开含 f 的依赖数值，必须随 compute 重算
    const center = resolveArg(this.center);
    this.lastSourceExpression = this.fn.expression;
    this.lastCenter = center;
    this.lastOrder = this.order;

    const factorial = (n: number): number => {
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    };
    const binomial = (n: number, k: number): number => {
      let r = 1;
      for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
      return r;
    };

    const baseScope = sourceFunctionScope(this.fn);
    const total: number[] = new Array(this.order + 1).fill(0);
    let expression = this.fn.expression;
    for (let k = 0; k <= this.order; k++) {
      const value = evaluate(expression, new Map([[this.fn.variableName, center], ...baseScope]));
      if (!Number.isFinite(value)) {
        this.outputFunction.setUndefined();
        return;
      }
      const coeff = value / factorial(k);
      for (let j = 0; j <= k; j++) {
        total[j] += coeff * binomial(k, j) * Math.pow(-center, k - j);
      }
      expression = differentiate(expression, this.fn.variableName);
    }
    const ast = coeffsToPolynomialAst(total, this.fn.variableName);
    this.outputFunction.setExpressionDef(ast, expressionToString(ast));
    this.outputFunction.setScope(sourceFunctionScope(this.fn));
    this.outputFunction.setDefined();
  }

  getOutput(): GeoFunction { return this.outputFunction; }

  getExpressionText(): string { return this.outputFunction.expressionText; }

  /** 展开中心原值（序列化判活引用用）。 */
  getCenterArg(): number | GeoNumeric { return this.center; }
  getOrder(): number { return this.order; }

  /** 序列化：数值展开中心与阶数。 */
  getSeriesScalars(): number[] {
    return [resolveArg(this.center), this.order];
  }
}

/** 升幂系数 → 多项式 AST（与识别器 polynomialToAst 同式，跳过近零项）。 */
function coeffsToPolynomialAst(coeffs: number[], variable: string): ExpressionNode {
  let node: ExpressionNode | null = null;
  for (let j = coeffs.length - 1; j >= 0; j--) {
    const c = coeffs[j];
    if (Math.abs(c) < 1e-12 && node !== null) continue;
    const term: ExpressionNode = j === 0
      ? { kind: 'number', value: c }
      : j === 1
        ? { kind: 'binary', op: '*', left: { kind: 'number', value: c }, right: { kind: 'variable', name: variable } }
        : {
            kind: 'binary', op: '*',
            left: { kind: 'number', value: c },
            right: { kind: 'binary', op: '^', left: { kind: 'variable', name: variable }, right: { kind: 'number', value: j } },
          };
    node = node === null ? term : { kind: 'binary', op: '+', left: node, right: term };
  }
  return node ?? { kind: 'number', value: 0 };
}

/**
 * Slope(function)：f 在 x=0 处的斜率 f'(0)（官方 CmdSlope 函数形式）。
 * f 表达式变化时重新微分——此前是自由数值快照。
 */
export class AlgoSlopeFunction extends AlgoElement {
  private outputValue: GeoNumeric;
  private lastSourceExpression: ExpressionNode | null = null;
  private derivativeAst: ExpressionNode | null = null;

  constructor(kernel: IKernel, private fn: GeoFunction) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.fn];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    if (this.lastSourceExpression !== this.fn.expression) {
      this.derivativeAst = differentiate(this.fn.expression, this.fn.variableName);
      this.lastSourceExpression = this.fn.expression;
    }
    const scope = new Map([[this.fn.variableName, 0], ...sourceFunctionScope(this.fn)]);
    const slope = evaluate(this.derivativeAst!, scope);
    if (!Number.isFinite(slope)) {
      this.outputValue.setUndefined();
      return;
    }
    this.outputValue.setValue(slope);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
}
