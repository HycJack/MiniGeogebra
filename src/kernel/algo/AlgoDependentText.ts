/**
 * 动态文本（对标 GeoGebra AlgoDependentText）：`"面积 = " + a` 一类的
 * 字符串 + 数值混合表达式，随数值依赖实时刷新。
 * 文本求值走 evaluateToText（'+' 在含字符串时为连接，数值按 2 位小数格式化）。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoText } from '../geo/GeoText';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoPoint } from '../geo/GeoPoint';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';
import { evaluateToText } from '../algebra/ExpressionEvaluator';

export class AlgoDependentText extends AlgoElement {
  private outputText: GeoText;

  constructor(
    kernel: IKernel,
    private expression: ExpressionNode,
    private dependencies: GeoNumeric[],
    private expressionText: string,
    private anchor?: GeoPoint,
    private dx = 0,
    private dy = 0,
  ) {
    super(kernel);
    const initial = evaluateToText(expression, new Map());
    const ax = anchor ? anchor.getX() + dx : dx;
    const ay = anchor ? anchor.getY() + dy : dy;
    this.outputText = new GeoText(kernel, initial, ax, ay);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.anchor ? [this.anchor, ...this.dependencies] : [...this.dependencies];
    this.setOutput([this.outputText]);
  }

  getOutput(): GeoText { return this.outputText; }

  getExpressionText(): string { return this.expressionText; }

  getOffset(): [number, number] { return [this.dx, this.dy]; }

  compute(): void {
    if (this.anchor) {
      this.outputText.setPosition(this.anchor.getX() + this.dx, this.anchor.getY() + this.dy);
    }
    const scope: Scope = new Map();
    this.dependencies.forEach((d, i) => scope.set(d.label || `dep${i}`, d.getValue()));
    this.outputText.text = evaluateToText(this.expression, scope);
    this.outputText.setDefined();
  }
}
