import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import type { AlgoDependentFunction } from './AlgoDependentFunction';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoNumeric } from '../geo/GeoNumeric';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';
import { differentiate, expressionToString } from '../algebra/Differentiator';

/**
 * 可微分函数定义的公共形状。
 * AlgoDependentFunction 与 AlgoDerivative 都实现它，因此 Derivative 可以嵌套：
 * `Derivative(Derivative(f))` 合法。
 */
export interface FunctionDefinition {
  getExpression(): ExpressionNode;
  getVariableName(): string;
  getDependencies(): GeoNumeric[];
}

/**
 * Derivative(f) 的构造算法。
 *
 * 输入是原始函数的数值依赖（而非原函数对象本身）：导数的 AST 结构在构造时固定，
 * 原函数的依赖数值变化只会改变它的求值作用域，不会改变导数表达式本身，
 * 因此把同一批依赖登记为 input，增量更新链路就能正确地把滑块变动传播到导函数上。
 */
export class AlgoDerivative extends AlgoElement {
  private outputFunction: GeoFunction;
  private derivativeExpression: ExpressionNode;

  constructor(
    kernel: IKernel,
    private source: AlgoDependentFunction,
  ) {
    super(kernel);
    this.derivativeExpression = differentiate(source.getExpression(), source.getVariableName());
    this.outputFunction = new GeoFunction(
      kernel,
      this.derivativeExpression,
      source.getVariableName(),
      expressionToString(this.derivativeExpression),
    );
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.source.getDependencies();
    this.setOutput([this.outputFunction]);
  }

  compute(): void {
    const scope: Scope = new Map();
    this.source.getDependencies().forEach((dependency, index) => {
      scope.set(dependency.label || `dep${index}`, dependency.getValue());
    });
    this.outputFunction.setScope(scope);
    this.outputFunction.setDefined();
  }

  getOutput(): GeoFunction { return this.outputFunction; }

  getExpression(): ExpressionNode { return this.derivativeExpression; }

  getVariableName(): string { return this.source.getVariableName(); }

  getDependencies(): GeoNumeric[] { return this.source.getDependencies(); }
}
