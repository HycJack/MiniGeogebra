import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoNumeric } from '../geo/GeoNumeric';
import { Scope } from '../algebra/ExpressionNode';
import { ExpressionNode } from '../algebra/ExpressionNode';
import { evaluate } from '../algebra/ExpressionEvaluator';

export class AlgoDependentNumeric extends AlgoElement {
  private outputNumeric: GeoNumeric;

  constructor(kernel: IKernel, private expression: ExpressionNode, private dependencies: GeoNumeric[]) {
    super(kernel);
    this.outputNumeric = new GeoNumeric(kernel, NaN);
    this.outputNumeric.intervalMin = -10;
    this.outputNumeric.intervalMax = 10;
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.dependencies;
    this.setOutput([this.outputNumeric]);
  }

  compute(): void {
    const scope: Scope = new Map();
    this.dependencies.forEach((dependency, index) => scope.set(dependency.label || `dep${index}`, dependency.getValue()));
    const value = evaluate(this.expression, scope);
    this.outputNumeric.setValue(value, false);
    this.outputNumeric.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputNumeric; }
}
