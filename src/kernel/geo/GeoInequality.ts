import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';

export type InequalityOp = '<' | '<=' | '>' | '>=';

/** 二元不等式区域：lhs op rhs，其中 lhs/rhs 是 x、y 的表达式（对标 GeoGebra 不等式对象）。 */
export class GeoInequality extends GeoElement {
  private scope: Scope = new Map();

  constructor(
    kernel: IKernel,
    public readonly lhs: ExpressionNode,
    public readonly rhs: ExpressionNode,
    public readonly op: InequalityOp,
    public readonly expressionText: string,
  ) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName(): string { return 'GeoInequality'; }

  get defaultStrokeColor(): string { return '#7c3aed'; }
  get defaultFillColor(): string { return 'rgba(124, 58, 237, 0.18)'; }
  get defaultLineWidth(): number { return 1; }

  setScope(scope: Scope): void {
    this.scope = scope;
  }

  /** g(x, y) = lhs − rhs；区域 = { g op 0 }。 */
  evaluateDiff(x: number, y: number): number {
    const scope = new Map(this.scope);
    scope.set('x', x);
    scope.set('y', y);
    return evaluate(this.lhs, scope) - evaluate(this.rhs, scope);
  }

  satisfied(x: number, y: number): boolean {
    const g = this.evaluateDiff(x, y);
    if (!Number.isFinite(g)) return false;
    switch (this.op) {
      case '<': return g < 0;
      case '<=': return g <= 0;
      case '>': return g > 0;
      case '>=': return g >= 0;
    }
  }

  /** 边界 g=0 是否属于区域（非严格不等式）。 */
  includesBoundary(): boolean {
    return this.op === '<=' || this.op === '>=';
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} : ${this.expressionText}`;
  }
}
