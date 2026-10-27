import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoNumeric } from '../geo/GeoNumeric';
import { Scope } from '../algebra/ExpressionNode';
import { ExpressionNode } from '../algebra/ExpressionNode';
import { evaluate, UserFunctionView } from '../algebra/ExpressionEvaluator';
import { renameVariableInAst, astUsesVariable } from '../algebra/renameVariable';
import { expressionToString } from '../algebra/Differentiator';
import { GeoFunction } from '../geo/GeoFunction';

export class AlgoDependentNumeric extends AlgoElement {
  private outputNumeric: GeoNumeric;
  private expressionText: string;

  constructor(
    kernel: IKernel,
    private expression: ExpressionNode,
    private dependencies: GeoNumeric[],
    expressionText = '',
    private functionDependencies: GeoFunction[] = [],
  ) {
    super(kernel);
    this.expressionText = expressionText;
    this.outputNumeric = new GeoNumeric(kernel, NaN);
    this.outputNumeric.intervalMin = -10;
    this.outputNumeric.intervalMax = 10;
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...this.dependencies, ...this.functionDependencies];
    this.setOutput([this.outputNumeric]);
  }

  compute(): void {
    const scope: Scope = new Map();
    this.dependencies.forEach((dependency, index) => scope.set(dependency.label || `dep${index}`, dependency.getValue()));
    const value = evaluate(this.expression, scope, buildUserFnMap(this.functionDependencies));
    this.outputNumeric.setValue(value, false);
    this.outputNumeric.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputNumeric; }

  getExpressionText(): string { return this.expressionText; }

  /** 重命名级联：表达式 AST 与文本中的旧数值名替换为新名（文本按新 AST
   *  重新序列化，与 translateBy 同一约定——序列化重建的一致性优先于词法形态）。 */
  renameDependency(from: string, to: string): void {
    if (from === to) return;
    if (!astUsesVariable(this.expression, from)) return;
    this.expression = renameVariableInAst(this.expression, from, to);
    if (this.expressionText) this.expressionText = expressionToString(this.expression);
  }
}

/** GeoFunction[] → 求值器用户函数表（按标签索引）。 */
export function buildUserFnMap(fns: GeoFunction[]): Map<string, UserFunctionView> {
  const map = new Map<string, UserFunctionView>();
  for (const fn of fns) {
    if (fn.label) map.set(fn.label, { expression: fn.expression, variableName: fn.variableName });
  }
  return map;
}
