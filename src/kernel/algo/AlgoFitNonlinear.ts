/**
 * 非线性拟合命令族（对标官方 AlgoFit / AlgoFitSin / AlgoFitLogistic）：
 * Levenberg–Marquardt 数值最小二乘。
 *   Fit(list, f)：自由参数 = f 表达式中既非主变量、也非已定义标签的变量，
 *     初值全 1（官方同语义），LM 迭代后输出参数代入的 GeoFunction；
 *   FitSin(list)：a·sin(bx+c)+d——周期图估计 b、相位 atan2 估计 c 后 LM 精修；
 *   FitLogistic(list)：a/(1+b·e^(−kx))——端点启发初值后 LM 精修。
 * 数值雅可比（中心差分），λ 自适应（残差升则 ×10 退步重来、降则 /3）。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoFunction } from '../geo/GeoFunction';
import { ExpressionNode } from '../algebra/ExpressionNode';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { collectVariables } from '../algebra/ExpressionNode';
import { expressionToString } from '../algebra/Differentiator';
import { solveLinear } from './AlgoFitPoly';

const num = (v: number): ExpressionNode => ({ kind: 'number', value: v });
const va = (name: string): ExpressionNode => ({ kind: 'variable', name });
const mul = (l: ExpressionNode, r: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '*', left: l, right: r });
const add = (l: ExpressionNode, r: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '+', left: l, right: r });
const call = (name: string, arg: ExpressionNode): ExpressionNode => ({ kind: 'call', name, args: [arg] });

type Sample = { x: number; y: number };

/** 模型：给定参数 θ 与 x → y。 */
type Model = (theta: number[], x: number) => number;

/**
 * Levenberg–Marquardt 数值最小二乘。
 * 返回最优参数；不收敛（发散/奇异）返回 null。
 */
function levenbergMarquardt(
  samples: Sample[],
  model: Model,
  theta0: number[],
  iterations = 100,
): number[] | null {
  const m = samples.length;
  const k = theta0.length;
  if (m < k) return null;
  let theta = [...theta0];
  const residual = (t: number[]): number[] =>
    samples.map(s => model(t, s.x) - s.y);
  const cost = (t: number[]): number => {
    const r = residual(t);
    let sum = 0;
    for (const v of r) sum += v * v;
    return sum;
  };
  let lambda = 1e-3;
  let current = cost(theta);
  if (!Number.isFinite(current)) return null;

  for (let iter = 0; iter < iterations; iter++) {
    const r = residual(theta);
    // 数值雅可比（中心差分）
    const J: number[][] = [];
    for (let i = 0; i < m; i++) {
      const row: number[] = [];
      for (let j = 0; j < k; j++) {
        const h = Math.max(1e-7, Math.abs(theta[j]) * 1e-6);
        const tp = [...theta]; tp[j] += h;
        const tm = [...theta]; tm[j] -= h;
        row.push((model(tp, samples[i].x) - model(tm, samples[i].x)) / (2 * h));
      }
      J.push(row);
    }
    // (JᵀJ + λ·diag)·Δ = −Jᵀr
    const jtj: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
    const diag: number[] = new Array(k).fill(0);
    const jtr: number[] = new Array(k).fill(0);
    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        let sum = 0;
        for (let i = 0; i < m; i++) sum += J[i][a] * J[i][b];
        jtj[a][b] = sum;
      }
      diag[a] = jtj[a][a];
      let sum2 = 0;
      for (let i = 0; i < m; i++) sum2 += J[i][a] * r[i];
      jtr[a] = -sum2;
    }
    // 标准 Marquardt 阻尼 λ·diag(JᵀJ)（量纲自适应；对角为零时退回 λ·I）——
    // 此前死代码 `lambda * Math.max(...) * 0` 实际是 Levenberg 原始 λ·I，
    // 参数量纲差异大时（FitSin a~1 / b~100）各方向阻尼失衡
    for (let a = 0; a < k; a++) {
      jtj[a][a] += lambda * (diag[a] > 1e-12 ? diag[a] : 1);
    }
    const delta = solveLinear(jtj, jtr);
    if (!delta || delta.some(d => !Number.isFinite(d))) {
      lambda *= 10;
      if (lambda > 1e10) return null;
      continue;
    }
    const candidate = theta.map((t, i) => t + delta[i]);
    if (candidate.some(c => !Number.isFinite(c))) { lambda *= 10; continue; }
    const candidateCost = cost(candidate);
    if (!Number.isFinite(candidateCost)) { lambda *= 10; continue; }
    if (candidateCost < current) {
      const improvement = current - candidateCost;
      theta = candidate;
      current = candidateCost;
      lambda = Math.max(lambda / 3, 1e-12);
      if (improvement < 1e-14 * Math.max(1, current)) break; // 收敛
    } else {
      lambda *= 10;
      if (lambda > 1e10) return null; // 不收敛：不把劣解当结果输出
    }
  }
  return theta;
}

/** AST 变量→数值替换（Fit 输出参数代入）。 */
function substituteNumbers(node: ExpressionNode, map: Map<string, number>): ExpressionNode {
  switch (node.kind) {
    case 'number': return { kind: 'number', value: node.value };
    case 'variable': {
      const v = map.get(node.name);
      return v !== undefined ? { kind: 'number', value: v } : { kind: 'variable', name: node.name };
    }
    case 'call': return { kind: 'call', name: node.name, args: node.args.map(a => substituteNumbers(a, map)) };
    case 'unary': return { kind: 'unary', op: node.op, operand: substituteNumbers(node.operand, map) };
    case 'binary': return { kind: 'binary', op: node.op, left: substituteNumbers(node.left, map), right: substituteNumbers(node.right, map) };
  }
}

// ---------------------------------------------------------------------------

/** Fit(list, f)：通用非线性最小二乘（自由参数自动发现）。 */
export class AlgoFitGeneral extends AlgoElement {
  private outputFunction: GeoFunction;
  private points: GeoPoint[];

  constructor(kernel: IKernel, points: GeoPoint[], private model: GeoFunction, private mainVariable: string) {
    super(kernel);
    this.points = points;
    this.outputFunction = new GeoFunction(kernel, { kind: 'number', value: 0 }, 'x', '0');
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...this.points, this.model];
    this.setOutput([this.outputFunction]);
  }

  getOutput(): GeoFunction { return this.outputFunction; }

  compute(): void {
    const samples = this.points
      .filter(p => p.isDefined())
      .map(p => ({ x: p.getX(), y: p.getY() }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    // 自由参数 = 作用域绑定的自由数值（官方语义：f(x)=a x^b 的 a/b 自动创建为
    // 自由数后即为拟合参数；主变量 x 除外）
    const variables = [...collectVariables(this.model.expression)]
      .filter(v => v !== this.mainVariable);
    const bound = new Set([...this.model.getScopeShallow().keys()]);
    const params = variables.filter(v => bound.has(v));
    if (params.length === 0 || samples.length < params.length) {
      this.outputFunction.setUndefined();
      return;
    }
    const userFns = this.model.getUserFunctions() ?? undefined;
    const model: Model = (theta, x) => {
      const scope = new Map<string, number>();
      for (const [k, v] of this.model.getScopeShallow()) scope.set(k, v);
      scope.set(this.mainVariable, x);
      params.forEach((p, i) => scope.set(p, theta[i]));
      return evaluate(this.model.expression, scope, userFns ?? undefined);
    };
    // 官方 FitRealFunction：自由参数（滑块）当前值作 LM 初值——拖动滑块重跑拟合
    const scopeMap = this.model.getScopeShallow();
    const theta0 = params.map(p => {
      const v = scopeMap.get(p);
      return v !== undefined && Number.isFinite(v) && v !== 0 ? v : 1;
    });
    const theta = levenbergMarquardt(samples, model, theta0);
    if (!theta) { this.outputFunction.setUndefined(); return; }
    const subst = new Map(params.map((p, i) => [p, theta[i]]));
    const ast = substituteNumbers(this.model.expression, subst);
    this.outputFunction.setExpressionDef(ast, expressionToString(ast));
    this.outputFunction.setDefined();
  }
}

/** FitSin(list)：a·sin(bx+c)+d（周期图初值 + LM 精修）。 */
export class AlgoFitSin extends AlgoElement {
  private outputFunction: GeoFunction;
  private points: GeoPoint[];

  constructor(kernel: IKernel, points: GeoPoint[]) {
    super(kernel);
    this.points = points;
    this.outputFunction = new GeoFunction(kernel, { kind: 'number', value: 0 }, 'x', '0');
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.points;
    this.setOutput([this.outputFunction]);
  }

  getOutput(): GeoFunction { return this.outputFunction; }

  compute(): void {
    const samples = this.points
      .filter(p => p.isDefined())
      .map(p => ({ x: p.getX(), y: p.getY() }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (samples.length < 4) { this.outputFunction.setUndefined(); return; }
    samples.sort((p, q) => p.x - q.x); // 周期图/跨度假定按 x 升序（乱序列表此前直接 undefined）

    // 初值：d = 均值、a = 振幅、b = 周期图峰值频率、c = 相位
    let sy = 0;
    for (const s of samples) sy += s.y;
    const d0 = sy / samples.length;
    let a0 = 0;
    for (const s of samples) a0 = Math.max(a0, Math.abs(s.y - d0));
    if (a0 < 1e-12) { this.outputFunction.setUndefined(); return; }
    const span = samples[samples.length - 1].x - samples[0].x;
    if (span <= 0) { this.outputFunction.setUndefined(); return; }
    let bestB = 1;
    let bestMag = -1;
    let bestPhase = 0;
    const steps = 400;
    const bMax = Math.max(Math.PI, (Math.PI * samples.length) / Math.max(span, 1e-9));
    for (let i = 1; i <= steps; i++) {
      const b = (bMax * i) / steps;
      // a·sin(bx+c) = a·sin c·cos bx + a·cos c·sin bx：拟合 cos/sin 系数
      // (C, S) = (Σz·cos bx, Σz·sin bx)，则 a·cos c = C·K、a·sin c = S·K → c = atan2(S, C)
      let cc = 0, ss = 0;
      for (const s of samples) {
        const z = s.y - d0;
        cc += z * Math.cos(b * s.x);
        ss += z * Math.sin(b * s.x);
      }
      const mag = Math.hypot(cc, ss);
      if (mag > bestMag) { bestMag = mag; bestB = b; bestPhase = Math.atan2(ss, cc); }
    }
    const model: Model = (t, x) => t[0] * Math.sin(t[1] * x + t[2]) + t[3];
    const theta = levenbergMarquardt(samples, model, [a0, bestB, bestPhase, d0]);
    if (!theta) { this.outputFunction.setUndefined(); return; }
    const [a, b, c, d] = theta;
    const ast: ExpressionNode = {
      kind: 'binary', op: '+',
      left: mul(num(a), call('sin', add(mul(num(b), va('x')), num(c)))),
      right: num(d),
    };
    this.outputFunction.setExpressionDef(ast, expressionToString(ast));
    this.outputFunction.setDefined();
  }
}

/** FitLogistic(list)：a/(1+b·e^(−kx))（端点启发初值 + LM 精修）。 */
export class AlgoFitLogistic extends AlgoElement {
  private outputFunction: GeoFunction;
  private points: GeoPoint[];

  constructor(kernel: IKernel, points: GeoPoint[]) {
    super(kernel);
    this.points = points;
    this.outputFunction = new GeoFunction(kernel, { kind: 'number', value: 0 }, 'x', '0');
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.points;
    this.setOutput([this.outputFunction]);
  }

  getOutput(): GeoFunction { return this.outputFunction; }

  compute(): void {
    const samples = this.points
      .filter(p => p.isDefined())
      .map(p => ({ x: p.getX(), y: p.getY() }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (samples.length < 3) { this.outputFunction.setUndefined(); return; }
    samples.sort((p, q) => p.x - q.x);

    const yValues = samples.map(s => s.y);
    const a0 = Math.max(...yValues) * 1.05;
    const first = samples[0];
    const b0 = Math.abs(first.y) > 1e-12 && Math.sign(a0) === Math.sign(first.y)
      ? Math.abs(a0 / first.y - 1) : 1;
    // k：用首末两点斜率启发
    const last = samples[samples.length - 1];
    // 由 a/y − 1 = b·e^(−kx) → k = −Δln(a/y−1)/Δx（此前少一个负号，初值形状反向）
    const k0 = Math.abs(last.x - first.x) > 1e-12
      ? -Math.log(Math.max(1e-9, Math.abs(a0 / Math.max(1e-9, Math.abs(last.y)) - 1)) / Math.max(1e-9, b0)) / (last.x - first.x)
      : 1;
    const model: Model = (t, x) => t[0] / (1 + t[1] * Math.exp(-t[2] * x));
    const theta = levenbergMarquardt(samples, model, [a0, Math.max(1e-9, b0), Number.isFinite(k0) ? k0 : 1]);
    if (!theta) { this.outputFunction.setUndefined(); return; }
    const [a, b, k] = theta;
    const ast: ExpressionNode = {
      kind: 'binary', op: '/',
      left: num(a),
      right: add(num(1), mul(num(b), call('exp', mul(num(-k), va('x'))))),
    };
    this.outputFunction.setExpressionDef(ast, expressionToString(ast));
    this.outputFunction.setDefined();
  }
}
