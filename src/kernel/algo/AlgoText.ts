/**
 * 锚定文本：`Text("内容", P)` —— 文本跟随点 P 移动（活依赖，对标
 * GeoGebra Text(<Object>, <Point>) 的锚定语义）。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoText } from '../geo/GeoText';

export class AlgoText extends AlgoElement {
  private outputText: GeoText;

  constructor(kernel: IKernel, private anchor: GeoPoint, text: string, private dx = 0, private dy = 0) {
    super(kernel);
    this.outputText = new GeoText(kernel, text, anchor.getX() + dx, anchor.getY() + dy);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.anchor];
    this.setOutput([this.outputText]);
  }

  getOutput(): GeoText { return this.outputText; }

  getOffset(): [number, number] { return [this.dx, this.dy]; }

  compute(): void {
    this.outputText.setPosition(this.anchor.getX() + this.dx, this.anchor.getY() + this.dy);
    this.outputText.setDefined();
  }
}
