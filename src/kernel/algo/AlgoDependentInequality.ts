/**
 * 二元不等式区域的算法壳 —— 对标 GeoGebra 的 AlgoDependentFunction 对不等式的作用：
 * 滑块变动时把新 scope 推给 GeoInequality。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoInequality, InequalityOp } from '../geo/GeoInequality';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';

export class AlgoDependentInequality extends AlgoElement {
  private outputInequality: GeoInequality;

  constructor(
    kernel: IKernel,
    lhs: ExpressionNode,
    rhs: ExpressionNode,
    op: InequalityOp,
    expressionText: string,
    private dependencies: GeoNumeric[],
  ) {
    super(kernel);
    this.outputInequality = new GeoInequality(kernel, lhs, rhs, op, expressionText);
    this.setInputOutput();
    this.compute();
  }

  setInputOutput(): void {
    this.input = [...this.dependencies];
    this.setOutput([this.outputInequality]);
  }

  compute(): void {
    const scope: Scope = new Map();
    this.dependencies.forEach((dependency, index) => {
      scope.set(dependency.label || `dep${index}`, dependency.getValue());
    });
    this.outputInequality.setScope(scope);
    this.outputInequality.setDefined();
  }

  getOutput(): GeoInequality { return this.outputInequality; }

  getExpressionText(): string { return this.outputInequality.expressionText; }
  getDependencies(): GeoNumeric[] { return this.dependencies; }
}
