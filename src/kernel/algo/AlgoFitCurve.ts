/**
 * 拟合命令族（对标官方 CmdFitExp / CmdFitGrowth / CmdFitLog / CmdFitPow /
 * CmdFitLineX / CmdFitLineY）：可线性化模型经变换后最小二乘，
 * 输出 GeoFunction/GeoLine，输入点全部活依赖（移动点重新拟合）。
 *
 * 未做（需非线性最小二乘/谱估计，记入 backlog）：Fit(list, f) 通用拟合、
 * FitLogistic、FitSin、FitImplicit。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoFunction } from '../geo/GeoFunction';
import { ExpressionNode } from '../algebra/ExpressionNode';
import { solveLinear } from './AlgoFitPoly';
import { polynomialAst, polynomialExpressionText } from '../algebra/Polynomial';

// ---- AST 构建辅助（与 Polynomial.polynomialAst 同风格）----

const num = (v: number): ExpressionNode => ({ kind: 'number', value: v });
const va = (name: string): ExpressionNode => ({ kind: 'variable', name });
const mul = (l: ExpressionNode, r: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '*', left: l, right: r });
const add = (l: ExpressionNode, r: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '+', left: l, right: r });
const pow = (l: ExpressionNode, r: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '^', left: l, right: r });
const call = (name: string, arg: ExpressionNode): ExpressionNode => ({ kind: 'call', name, args: [arg] });

/** 一元线性回归 y = ax + b；返回 null 当有效样本 < 2 或 x 退化。 */
function linearRegression(pts: { x: number; y: number }[]): { a: number; b: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) {
    sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y;
  }
  const det = n * sxx - sx * sx;
  if (Math.abs(det) < 1e-12 * Math.max(1, Math.abs(sxx) + 1)) return null;
  const a = (n * sxy - sx * sy) / det;
  const b = (sy - a * sx) / n;
  return Number.isFinite(a) && Number.isFinite(b) ? { a, b } : null;
}

/** 提取点列表（全部有限坐标）。 */
const validPoints = (points: GeoPoint[]): { x: number; y: number }[] =>
  points.filter(p => p.isDefined())
    .map(p => ({ x: p.getX(), y: p.getY() }))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

/**
 * 可线性化拟合基类：子类给 (变换后的样本, 输出 AST 构建器, 表达式文本)。
 * 变换过滤掉的点不计入（如 FitExp 的 y≤0、FitPow 的 x≤0——官方同语义）。
 */
abstract class AlgoLinearizedFit extends AlgoElement {
  private outputFunction: GeoFunction;
  protected points: GeoPoint[];

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
    const regression = linearRegression(this.transformed(validPoints(this.points)));
    if (!regression) { this.outputFunction.setUndefined(); return; }
    const { ast, text } = this.buildAst(regression);
    this.outputFunction.setExpressionDef(ast, text);
    this.outputFunction.setDefined();
  }

  /** 变换后的 (u, v) 样本（u/v 为线性回归坐标）。 */
  protected abstract transformed(points: { x: number; y: number }[]): { x: number; y: number }[];
  /** 回归系数 (a=u 斜率, b=u 截距) → 输出函数 AST 与文本。 */
  protected abstract buildAst(reg: { a: number; b: number }): { ast: ExpressionNode; text: string };
}

// ---- 各模型 ----

/** FitExp(list)：y = a·e^(b x)（ln y = ln a + b x；y>0 的点参与）。 */
export class AlgoFitExp extends AlgoLinearizedFit {
  protected transformed(points: { x: number; y: number }[]) {
    return points.filter(p => p.y > 0).map(p => ({ x: p.x, y: Math.log(p.y) }));
  }
  protected buildAst(reg: { a: number; b: number }) {
    const a = Math.exp(reg.b);
    return {
      ast: mul(num(a), call('exp', mul(num(reg.a), va('x')))),
      text: `${a}*exp(${reg.a}x)`,
    };
  }
}

/** FitGrowth(list)：y = a·b^x（ln y = ln a + x·ln b；y>0）。 */
export class AlgoFitGrowth extends AlgoLinearizedFit {
  protected transformed(points: { x: number; y: number }[]) {
    return points.filter(p => p.y > 0).map(p => ({ x: p.x, y: Math.log(p.y) }));
  }
  protected buildAst(reg: { a: number; b: number }) {
    const a = Math.exp(reg.b);
    const b = Math.exp(reg.a);
    return {
      ast: mul(num(a), pow(num(b), va('x'))),
      text: `${a}*${b}^x`,
    };
  }
}

/** FitLog(list)：y = a + b·ln x（x>0）。 */
export class AlgoFitLog extends AlgoLinearizedFit {
  protected transformed(points: { x: number; y: number }[]) {
    return points.filter(p => p.x > 0).map(p => ({ x: Math.log(p.x), y: p.y }));
  }
  protected buildAst(reg: { a: number; b: number }) {
    return {
      ast: add(num(reg.b), mul(num(reg.a), call('ln', va('x')))),
      text: `${reg.b} + ${reg.a}ln(x)`,
    };
  }
}

/** FitPow(list)：y = a·x^b（ln y = ln a + b·ln x；x>0 且 y>0）。 */
export class AlgoFitPow extends AlgoLinearizedFit {
  protected transformed(points: { x: number; y: number }[]) {
    return points.filter(p => p.x > 0 && p.y > 0)
      .map(p => ({ x: Math.log(p.x), y: Math.log(p.y) }));
  }
  protected buildAst(reg: { a: number; b: number }) {
    const a = Math.exp(reg.b);
    return {
      ast: mul(num(a), pow(va('x'), num(reg.a))),
      text: `${a}x^${reg.a}`,
    };
  }
}

// ---- 直线拟合（官方输出 GeoLine）----

/** 普通最小二乘 y = ax + b → GeoLine(ax − y + b = 0 形：A = a, B = −1... 官方
 *  约定线系数 ax + by + c = 0，取 (−a, 1, −b)。 */
export abstract class AlgoFitLineBase extends AlgoElement {
  protected outputLine: GeoLine;
  protected points: GeoPoint[];

  constructor(kernel: IKernel, points: GeoPoint[]) {
    super(kernel);
    this.points = points;
    this.outputLine = new GeoLine(kernel, 0, 0, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.points;
    this.setOutput([this.outputLine]);
  }

  getOutput(): GeoLine { return this.outputLine; }

  compute(): void {
    const reg = linearRegression(this.select(validPoints(this.points)));
    if (!reg) { this.outputLine.setUndefined(); return; }
    this.applyRegression(reg);
    this.outputLine.setDefined();
  }

  /** 选择回归坐标（FitLineY: (x,y)；FitLineX: (y,x) 反向）。 */
  protected abstract select(pts: { x: number; y: number }[]): { x: number; y: number }[];
  /** 斜率截距 → 线系数。 */
  protected abstract applyRegression(reg: { a: number; b: number }): void;
}

/** FitLineY(list)（官方 FitLine 的显式名）：y 对 x 的最小二乘直线。 */
export class AlgoFitLineY extends AlgoFitLineBase {
  protected select(pts: { x: number; y: number }[]) { return pts; }
  protected applyRegression(reg: { a: number; b: number }): void {
    // y = a x + b → −a·x + y − b = 0
    this.outputLine.a = -reg.a;
    this.outputLine.b = 1;
    this.outputLine.c = -reg.b;
  }
}

/** FitLineX(list)：x 对 y 的最小二乘直线（反向回归）。 */
export class AlgoFitLineX extends AlgoFitLineBase {
  protected select(pts: { x: number; y: number }[]) {
    return pts.map(p => ({ x: p.y, y: p.x }));
  }
  protected applyRegression(reg: { a: number; b: number }): void {
    // x = a y + b → x − a·y − b = 0
    this.outputLine.a = 1;
    this.outputLine.b = -reg.a;
    this.outputLine.c = -reg.b;
  }
}

/** 序列化重建用的多项式文本兜底（保留导入引用）。 */
void polynomialAst;
void polynomialExpressionText;
