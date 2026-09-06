import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoNumeric } from '../geo/GeoNumeric';
import { Scope } from '../algebra/ExpressionNode';
import { ExpressionNode } from '../algebra/ExpressionNode';
import { evaluate } from '../algebra/ExpressionEvaluator';

export class AlgoDependentFunction extends AlgoElement {
  private outputFunction: GeoFunction;

  constructor(
    kernel: IKernel,
    private expression: ExpressionNode,
    private variableName: string,
    private expressionText: string,
    private dependencies: GeoNumeric[],
  ) {
    super(kernel);
    this.outputFunction = new GeoFunction(kernel, expression, variableName, expressionText);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.dependencies;
    this.setOutput([this.outputFunction]);
  }

  compute(): void {
    const scope: Scope = new Map();
    this.dependencies.forEach((dependency, index) => {
      const name = dependency.label || `dep${index}`;
      scope.set(name, dependency.getValue());
    });
    this.outputFunction.setScope(scope);
    this.outputFunction.setDefined();
  }

  getOutput(): GeoFunction { return this.outputFunction; }

  getExpressionText(): string { return this.expressionText; }

  getVariableName(): string { return this.variableName; }

  /** 原始 AST，供 Derivative / Extremum 等命令做符号变换。 */
  getExpression(): ExpressionNode { return this.expression; }

  /** 该函数依赖的自由数值（如 a = 3 中的 a）。 */
  getDependencies(): GeoNumeric[] { return this.dependencies; }

  getCommandDescription(): string {
    return this.expressionText;
  }
}
