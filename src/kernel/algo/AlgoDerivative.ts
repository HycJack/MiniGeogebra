import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
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
 * Derivative(f[, n]) 的构造算法。
 *
 * 源函数对象**本身注册为输入**（对标官方 NoCASDerivativeCache 随源更新）：
 * 此前只登记源函数的数值依赖，f 的表达式被整体替换（拖拽 moveFunction、
 * FitPoly 重拟合、重定义）时导数 AST 是构造期冻结的快照——拖拽/undo 后
 * 导函数滞留旧值，且 f 的 forwardDeps 里没有本算法，重定义也不重建。
 * 现在 compute 时检测 fn.expression 引用变化即重新符号微分。
 */
export class AlgoDerivative extends AlgoElement implements FunctionDefinition {
  private outputFunction: GeoFunction;
  private sourceFn: GeoFunction;
  private order: number;
  private lastSourceExpression: ExpressionNode | null = null;

  constructor(kernel: IKernel, sourceFn: GeoFunction, order = 1) {
    super(kernel);
    this.sourceFn = sourceFn;
    this.order = Math.max(1, order);
    // 占位定义，compute() 首跑前 ensureDerivative() 会填真身
    this.outputFunction = new GeoFunction(kernel, sourceFn.expression, sourceFn.variableName, '');
    this.setInputOutput();
  }

  setInputOutput(): void {
    // 源函数 + 其数值依赖都注册：滑块走 scope 求值，表达式替换走重微分
    this.input = [this.sourceFn, ...this.numericDeps()];
    this.setOutput([this.outputFunction]);
  }

  /** 源函数的数值依赖（自由函数为空；嵌套 Derivative 取内层依赖）。 */
  private numericDeps(): GeoNumeric[] {
    const pa = this.sourceFn.parentAlgo;
    const deps = pa && typeof (pa as unknown as { getDependencies?: () => GeoNumeric[] }).getDependencies === 'function'
      ? (pa as unknown as { getDependencies: () => GeoNumeric[] }).getDependencies()
      : [];
    return deps.filter(d => d instanceof GeoNumeric);
  }

  /** 源表达式被替换（拖拽/拟合/重定义）时重新微分并就地更新输出。 */
  private ensureDerivative(): void {
    if (this.lastSourceExpression === this.sourceFn.expression) return;
    let expression = this.sourceFn.expression;
    for (let i = 0; i < this.order; i++) {
      expression = differentiate(expression, this.sourceFn.variableName);
    }
    this.outputFunction.setExpressionDef(expression, expressionToString(expression));
    this.lastSourceExpression = this.sourceFn.expression;
  }

  compute(): void {
    this.ensureDerivative();
    const scope: Scope = new Map();
    this.numericDeps().forEach((dependency, index) => {
      scope.set(dependency.label || `dep${index}`, dependency.getValue());
    });
    this.outputFunction.setScope(scope);
    this.outputFunction.setDefined();
  }

  getOutput(): GeoFunction { return this.outputFunction; }

  getExpression(): ExpressionNode { return this.outputFunction.expression; }

  getVariableName(): string { return this.sourceFn.variableName; }

  getDependencies(): GeoNumeric[] { return this.numericDeps(); }

  /** 序列化用：源函数与阶数。 */
  getSourceFunction(): GeoFunction { return this.sourceFn; }
  getOrder(): number { return this.order; }

  /** 嵌套 Derivative 的源（AlgoDerivative 输出）仍指回本算法。 */
  getSourceElement(): GeoElement { return this.sourceFn; }
}
