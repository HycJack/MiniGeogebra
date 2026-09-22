/**
 * 文本对象（对标 GeoGebra GeoText 的轻量子集）：
 * `Text("内容", x, y)` 创建自由文本；`Text("内容", P)` 创建锚定在点 P 的
 * 派生文本（AlgoText，随点移动）。渲染在 2D overlay，暂不参与命中/拖拽。
 */
import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoText extends GeoElement {
  public text: string;
  public x: number;
  public y: number;

  constructor(kernel: IKernel, text: string, x = 0, y = 0) {
    super(kernel, new GeoVec3D(0, 0, 0));
    this.text = text;
    this.x = x;
    this.y = y;
  }

  getClassName(): string { return 'GeoText'; }

  get defaultStrokeColor(): string { return '#111827'; }

  isDefined(): boolean { return this.text.length > 0; }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  getAlgebraDescription(): string {
    return `${this.label} = "${this.text}"`;
  }
}
