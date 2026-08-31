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
    const r = Math.hypot(this.pStart.getX() - this.center.getX(), this.pStart.getY() - this.center.getY());
    if (r <= 0) {
      this.result.setUndefined();
      return;
    }
    this.result.setDefined();
  }
}
