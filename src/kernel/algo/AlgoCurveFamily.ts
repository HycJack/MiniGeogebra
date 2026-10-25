/**
 * 参数曲线相关的算法族 —— 对标 GeoGebra 的
 * AlgoCurveCartesian / AlgoPointOnPath / AlgoTangentFunctionNumber / AlgoTangentCurve3D /
 * AlgoCurvature / AlgoOsculatingCircle。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoConic } from '../geo/GeoConic';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoCurve } from '../geo/GeoCurve';
import { GeoVec3D } from '../core/GeoVec3D';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';
import { differentiate } from '../algebra/Differentiator';
import { evaluate } from '../algebra/ExpressionEvaluator';

const circleCoeffs = (h: number, k: number, r: number): number[] =>
  [1, 0, 1, -2 * h, -2 * k, h * h + k * k - r * r];

/**
 * Curve(x(t), y(t), t, a, b) 的算法壳：输入是表达式引用到的滑块，
 * 滑块变动时把新 scope 推给输出曲线。
 */
export class AlgoDependentCurve extends AlgoElement {
  private outputCurve: GeoCurve;

  constructor(
    kernel: IKernel,
    xExpr: ExpressionNode,
    yExpr: ExpressionNode,
    paramName: string,
    tMin: number,
    tMax: number,
    expressionTexts: { x: string; y: string },
    private dependencies: GeoNumeric[],
  ) {
    super(kernel);
    this.outputCurve = new GeoCurve(kernel, xExpr, yExpr, paramName, tMin, tMax, expressionTexts);
    this.setInputOutput();
    this.compute();
  }

  setInputOutput(): void {
    this.input = [...this.dependencies];
    this.setOutput([this.outputCurve]);
  }

  compute(): void {
    const scope: Scope = new Map();
    this.dependencies.forEach((dependency, index) => {
      scope.set(dependency.label || `dep${index}`, dependency.getValue());
    });
    this.outputCurve.setScope(scope);
    this.outputCurve.setDefined();
  }

  getOutput(): GeoCurve { return this.outputCurve; }

  getDependencies(): GeoNumeric[] { return this.dependencies; }

  getExpressionX(): ExpressionNode { return this.outputCurve.xExpr; }
  getExpressionY(): ExpressionNode { return this.outputCurve.yExpr; }
  getParameterName(): string { return this.outputCurve.paramName; }
  getRange(): [number, number] { return [this.outputCurve.tMin, this.outputCurve.tMax]; }
  getExpressionTexts(): { x: string; y: string } { return this.outputCurve.expressionTexts; }
}

/** 曲线上的约束点：参数 t 由滑块承载，拖拽时反解最近参数。 */
export class AlgoPointOnCurve extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(kernel: IKernel, private curve: GeoCurve, private param: GeoNumeric) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.curve, this.param];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  compute(): void {
    const p = this.curve.pointAt(this.param.getValue());
    if (p) {
      this.outputPoint.setCoords(p.x, p.y, 1);
      this.outputPoint.setDefined();
    } else {
      this.outputPoint.setUndefined();
    }
  }

  updateParameter(x: number, y: number): void {
    this.param.setValue(this.curve.nearestParameter(x, y));
  }
}

/** 函数 y=f(x) 在 x=a 处的切线。a 是固定数或滑块（滑块会联动）。 */
export class AlgoTangentFunctionNumber extends AlgoElement {
  private outputLine: GeoLine;
  private fPrime: ExpressionNode;
  private at: number | GeoNumeric | GeoPoint;

  constructor(kernel: IKernel, private fn: GeoFunction, at: number | GeoNumeric | GeoPoint) {
    super(kernel);
    this.at = at;
    this.fPrime = differentiate(fn.expression, fn.variableName);
    this.outputLine = new GeoLine(kernel, 1, 0, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = typeof this.at === 'number' ? [this.fn] : [this.fn, this.at];
    this.setOutput([this.outputLine]);
  }

  getOutput(): GeoLine { return this.outputLine; }

  getAtValue(): number | GeoNumeric | GeoPoint { return this.at; }

  compute(): void {
    this.outputLine.setUndefined();
    // 切点横坐标：常量 / 滑块 / 点（Tangent(P, f)——点移动时切线跟随）
    const a = typeof this.at === 'number' ? this.at
      : this.at instanceof GeoPoint ? this.at.getX()
      : this.at.getValue();
    const y = this.fn.evaluateAt(a);
    const scope = this.buildScope(a);
    const m = evaluateInto(this.fPrime, scope);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return;
    // 切线 y − y0 = m(x − a) → m·x − y + (y0 − m·a) = 0
    this.outputLine.a = m;
    this.outputLine.b = -1;
    this.outputLine.c = y - m * a;
    this.outputLine.setDefined();
  }

  private buildScope(a: number): Scope {
    const scope: Scope = new Map([[this.fn.variableName, a]]);
    const source = this.fn.parentAlgo;
    if (source instanceof AlgoElement) {
      const deps = (source as unknown as { getDependencies?: () => GeoNumeric[] }).getDependencies?.() ?? [];
      deps.forEach((d, i) => scope.set(d.label || `dep${i}`, d.getValue()));
    }
    return scope;
  }
}

/** 参数曲线在 t 处的切线。 */
export class AlgoTangentCurve extends AlgoElement {
  private outputLine: GeoLine;
  private at: number | GeoNumeric;

  constructor(kernel: IKernel, private curve: GeoCurve, at: number | GeoNumeric) {
    super(kernel);
    this.at = at;
    this.outputLine = new GeoLine(kernel, 1, 0, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = typeof this.at === 'number' ? [this.curve] : [this.curve, this.at];
    this.setOutput([this.outputLine]);
  }

  getOutput(): GeoLine { return this.outputLine; }

  getAtValue(): number | GeoNumeric { return this.at; }

  compute(): void {
    this.outputLine.setUndefined();
    const t = typeof this.at === 'number' ? this.at : this.at.getValue();
    const p = this.curve.pointAt(t);
    const dx = this.curve.derivativeX(t);
    const dy = this.curve.derivativeY(t);
    if (!p || !Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
    // 方向 (dx, dy)，法向 (dy, −dx)
    this.outputLine.a = dy;
    this.outputLine.b = -dx;
    this.outputLine.c = -(dy * p.x - dx * p.y);
    this.outputLine.setDefined();
  }
}

/**
 * 曲率：函数版 k = f''/(1+f'²)^{3/2}；曲线版 k = (x'y''−y'x'')/(x'²+y'²)^{3/2}（带符号）。
 */
export class AlgoCurvature extends AlgoElement {
  private outputNumeric: GeoNumeric;
  private fPrime: ExpressionNode | null = null;
  private fDoublePrime: ExpressionNode | null = null;
  private at: number | GeoNumeric;

  constructor(kernel: IKernel, private path: GeoFunction | GeoCurve, at: number | GeoNumeric) {
    super(kernel);
    this.at = at;
    if (path instanceof GeoFunction) {
      this.fPrime = differentiate(path.expression, path.variableName);
      this.fDoublePrime = differentiate(this.fPrime, path.variableName);
    }
    this.outputNumeric = new GeoNumeric(kernel, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = typeof this.at === 'number' ? [this.path] : [this.path, this.at];
    this.setOutput([this.outputNumeric]);
  }

  getOutput(): GeoNumeric { return this.outputNumeric; }

  getAtValue(): number | GeoNumeric { return this.at; }

  compute(): void {
    const a = typeof this.at === 'number' ? this.at : this.at.getValue();
    let k = NaN;

    if (this.path instanceof GeoFunction) {
      const scope: Scope = new Map([[this.path.variableName, a]]);
      const m = evaluateInto(this.fPrime!, scope);
      const m2 = evaluateInto(this.fDoublePrime!, scope);
      if (Number.isFinite(m) && Number.isFinite(m2)) {
        k = m2 / Math.pow(1 + m * m, 1.5);
      }
    } else {
      const dx = this.path.derivativeX(a);
      const dy = this.path.derivativeY(a);
      // 二阶导数值通过再次 differentiate 的表达式求值
      const ddx = secondDerivative(this.path.xExpr, this.path.paramName, a, this.pathScope());
      const ddy = secondDerivative(this.path.yExpr, this.path.paramName, a, this.pathScope());
      if ([dx, dy, ddx, ddy].every(Number.isFinite)) {
        k = (dx * ddy - dy * ddx) / Math.pow(dx * dx + dy * dy, 1.5);
      }
    }

    if (Number.isFinite(k)) {
      this.outputNumeric.setValue(k);
      this.outputNumeric.setDefined();
    } else {
      this.outputNumeric.setUndefined();
    }
  }

  private pathScope(): Scope {
    // 曲线的 scope 在 AlgoDependentCurve 维护；这里重建（依赖数值由 input 联动刷新）
    const source = this.path.parentAlgo;
    if (source instanceof AlgoDependentCurve) {
      const scope: Scope = new Map();
      source.getDependencies().forEach((d, i) => scope.set(d.label || `dep${i}`, d.getValue()));
      return scope;
    }
    return new Map();
  }
}

/** 密切圆：圆心 = 曲线点 + n̂/k，半径 = 1/|k|。 */
export class AlgoOsculatingCircle extends AlgoElement {
  private outputConic: GeoConic;
  private fPrime: ExpressionNode | null = null;
  private fDoublePrime: ExpressionNode | null = null;
  private at: number | GeoNumeric;

  constructor(kernel: IKernel, private path: GeoFunction | GeoCurve, at: number | GeoNumeric) {
    super(kernel);
    this.at = at;
    if (path instanceof GeoFunction) {
      this.fPrime = differentiate(path.expression, path.variableName);
      this.fDoublePrime = differentiate(this.fPrime, path.variableName);
    }
    this.outputConic = new GeoConic(kernel, [1, 0, 1, 0, 0, -1]);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = typeof this.at === 'number' ? [this.path] : [this.path, this.at];
    this.setOutput([this.outputConic]);
  }

  getOutput(): GeoConic { return this.outputConic; }

  getAtValue(): number | GeoNumeric { return this.at; }

  compute(): void {
    this.outputConic.setUndefined();
    const a = typeof this.at === 'number' ? this.at : this.at.getValue();
    let point: { x: number; y: number } | null = null;
    let k = NaN;
    let normal: { x: number; y: number } = { x: 0, y: 0 };

    if (this.path instanceof GeoFunction) {
      const y = this.path.evaluateAt(a);
      const scope: Scope = new Map([[this.path.variableName, a]]);
      const m = evaluateInto(this.fPrime!, scope);
      const m2 = evaluateInto(this.fDoublePrime!, scope);
      if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(m2) && m2 !== 0) {
        point = { x: a, y };
        k = m2 / Math.pow(1 + m * m, 1.5);
        const len = Math.hypot(-m, 1);
        normal = { x: -m / len, y: 1 / len };
      }
    } else {
      const p = this.path.pointAt(a);
      const dx = this.path.derivativeX(a);
      const dy = this.path.derivativeY(a);
      const scope: Scope = new Map();
      const source = this.path.parentAlgo;
      if (source instanceof AlgoDependentCurve) {
        source.getDependencies().forEach((d, i) => scope.set(d.label || `dep${i}`, d.getValue()));
      }
      const ddx = secondDerivative(this.path.xExpr, this.path.paramName, a, scope);
      const ddy = secondDerivative(this.path.yExpr, this.path.paramName, a, scope);
      if (p && [dx, dy, ddx, ddy].every(Number.isFinite) && (dx * ddy - dy * ddx) !== 0) {
        point = p;
        k = (dx * ddy - dy * ddx) / Math.pow(dx * dx + dy * dy, 1.5);
        const len = Math.hypot(-dy, dx);
        normal = { x: -dy / len, y: dx / len };
      }
    }

    if (!point || !Number.isFinite(k) || k === 0) return;
    const radius = Math.abs(1 / k);
    const center = { x: point.x + normal.x / k, y: point.y + normal.y / k };
    this.outputConic.coeffs = circleCoeffs(center.x, center.y, radius);
    this.outputConic.setDefined();
  }
}

/** 在 scope 上求表达式值（scope 已含参数）。 */
function evaluateInto(expr: ExpressionNode, scope: Scope): number {
  return evaluate(expr, scope);
}

/** 二阶导数值：differentiate 两次后求值。 */
function secondDerivative(
  expr: ExpressionNode,
  paramName: string,
  t: number,
  baseScope: Scope,
): number {
  const d1 = differentiate(expr, paramName);
  const d2 = differentiate(d1, paramName);
  const scope = new Map(baseScope);
  scope.set(paramName, t);
  return evaluate(d2, scope);
}
