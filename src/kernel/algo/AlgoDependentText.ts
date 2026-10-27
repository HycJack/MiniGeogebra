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
import { formatNumber } from '../core/Options';
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

  /** 拖拽偏移（对标官方 MoveMode.TEXT）：锚定文本改相对锚点的偏移，
   *  compute 随锚点重算位置；自由文本输出 position 不受影响。 */
  setOffset(dx: number, dy: number): void {
    this.dx = dx;
    this.dy = dy;
  }

  getOffset(): [number, number] { return [this.dx, this.dy]; }

  compute(): void {
    if (this.anchor) {
      this.outputText.setPosition(this.anchor.getX() + this.dx, this.anchor.getY() + this.dy);
    }
    const scope: Scope = new Map();
    this.dependencies.forEach((d, i) => scope.set(d.label || `dep${i}`, d.getValue()));
    // 数值格式化走内核 rounding 选项（此前硬编码 toFixed(2)，rounding=5 时文本仍 2 位）
    this.outputText.text = evaluateToText(this.expression, scope, undefined,
      (v) => formatNumber(v, this.kernel.getOptions()));
    this.outputText.setDefined();
  }
}
