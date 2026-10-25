import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoNumeric } from '../geo/GeoNumeric';
import { buildUserFnMap } from './AlgoDependentNumeric';
import { Scope, ExpressionNode } from '../algebra/ExpressionNode';
import { expressionToString } from '../algebra/Differentiator';
import { evaluate } from '../algebra/ExpressionEvaluator';

export class AlgoDependentFunction extends AlgoElement {
  private outputFunction: GeoFunction;

  constructor(
    kernel: IKernel,
    private expression: ExpressionNode,
    private variableName: string,
    private expressionText: string,
    private dependencies: GeoNumeric[],
    private functionDependencies: GeoFunction[] = [],
  ) {
    super(kernel);
    this.outputFunction = new GeoFunction(kernel, expression, variableName, expressionText);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...this.dependencies, ...this.functionDependencies];
    this.setOutput([this.outputFunction]);
  }

  compute(): void {
    const scope: Scope = new Map();
    this.dependencies.forEach((dependency, index) => {
      const name = dependency.label || `dep${index}`;
      scope.set(name, dependency.getValue());
    });
    this.outputFunction.setScope(scope);
    this.outputFunction.setUserFunctions(buildUserFnMap(this.functionDependencies));
    this.outputFunction.setDefined();
  }

  getOutput(): GeoFunction { return this.outputFunction; }

  getExpressionText(): string { return this.expressionText; }
  // ---- moveFunction（对标 GeoGebra EuclidianController.moveFunction）----
  // 平移 = 表达式替换 x → (x − dx) 后整体 +dy；替换复合满足结合律，
  // 逐帧增量平移与一次平移到目标结果精确一致。

  /** 就地平移函数图像（拖拽用）。 */
  translateBy(dx: number, dy: number): void {
    const substitute = (node: ExpressionNode): ExpressionNode => {
      if (node.kind === 'variable' && node.name === this.variableName) {
        if (dx === 0) return node;
        return { kind: 'binary', op: '-', left: node, right: { kind: 'number', value: dx } };
      }
      if (node.kind === 'binary') return { ...node, left: substitute(node.left), right: substitute(node.right) };
      if (node.kind === 'unary') return { ...node, operand: substitute(node.operand) };
      if (node.kind === 'call') return { ...node, args: node.args.map(substitute) };
      return node;
    };
    const shifted = substitute(this.expression);
    const expression = dy === 0
      ? shifted
      : ({ kind: 'binary', op: '+', left: shifted, right: { kind: 'number', value: dy } } as ExpressionNode);
    // 文本按表达式树序列化（表达式内联替换后的准确形态）
    const text = `${this.getOutput().variableName}(${this.variableName}) = ${expressionToString(expression)}`;
    this.expression = expression;
    this.expressionText = text;
    this.getOutput().setExpressionDef(expression, text);
  }


  getVariableName(): string { return this.variableName; }

  /** 原始 AST，供 Derivative / Extremum 等命令做符号变换。 */
  getExpression(): ExpressionNode { return this.expression; }

  /** 该函数依赖的自由数值（如 a = 3 中的 a）。 */
  getDependencies(): GeoNumeric[] { return this.dependencies; }

  getCommandDescription(): string {
    return this.expressionText;
  }
}
