import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';
import { renameVariableInAst, astUsesVariable } from '../algebra/renameVariable';
import { expressionToString } from '../algebra/Differentiator';

export type InequalityOp = '<' | '<=' | '>' | '>=';

/** 二元不等式区域：lhs op rhs，其中 lhs/rhs 是 x、y 的表达式（对标 GeoGebra 不等式对象）。 */
export class GeoInequality extends GeoElement {
  private scope: Scope = new Map();

  constructor(
    kernel: IKernel,
    public lhs: ExpressionNode,
    public rhs: ExpressionNode,
    public readonly op: InequalityOp,
    public expressionText: string,
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

  isInRegionXY(x: number, y: number): boolean { return this.satisfied(x, y); }

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

  /** 重命名级联：lhs/rhs AST 与文本中的旧数值名替换为新名。 */
  renameVariable(from: string, to: string): void {
    if (from === to) return;
    if (!astUsesVariable(this.lhs, from) && !astUsesVariable(this.rhs, from)) return;
    this.lhs = renameVariableInAst(this.lhs, from, to);
    this.rhs = renameVariableInAst(this.rhs, from, to);
    // 保留 "lhs op rhs" 原形态（此前序列化重建按 lhs−rhs 会丢不等号）
    this.expressionText = `${expressionToString(this.lhs)} ${this.op} ${expressionToString(this.rhs)}`;
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
