/**
 * 圆弧构造算法 —— 圆心 + 起始终止点。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoArc } from '../geo/GeoArc';

export class AlgoArc extends AlgoElement {
  private result: GeoArc;

  constructor(kernel: IKernel, private center: GeoPoint, private pStart: GeoPoint, private pEnd: GeoPoint) {
    super(kernel);
    this.result = GeoArc.fromPoints(kernel, center, pStart, pEnd);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.center, this.pStart, this.pEnd];
    this.setOutput([this.result]);
  }

  getOutput(): GeoArc { return this.result; }

  compute(): void {
    if (!this.center.isDefined() || !this.pStart.isDefined() || !this.pEnd.isDefined()) {
      this.result.setUndefined();
      return;
    }
    const cx = this.center.getX(), cy = this.center.getY();
    const r = Math.hypot(this.pStart.getX() - cx, this.pStart.getY() - cy);
    if (r <= 0) {
      this.result.setUndefined();
      return;
    }
    // 圆心/端点移动后原地重算圆弧几何，保持输出对象身份。
    this.result.setGeometry(
      { x: cx, y: cy },
      r,
      Math.atan2(this.pStart.getY() - cy, this.pStart.getX() - cx),
      Math.atan2(this.pEnd.getY() - cy, this.pEnd.getX() - cx),
      false,
    );
    this.result.setDefined();
  }
}
