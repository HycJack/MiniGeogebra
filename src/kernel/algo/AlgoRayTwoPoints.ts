/**
 * 射线构造算法 —— 两点定射线。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoRay } from '../geo/GeoRay';

export class AlgoRayTwoPoints extends AlgoElement {
  private result: GeoRay;

  constructor(kernel: IKernel, private a: GeoPoint, private b: GeoPoint) {
    super(kernel);
    this.result = new GeoRay(kernel, a, b);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.a, this.b];
    this.setOutput([this.result]);
  }

  getOutput(): GeoRay { return this.result; }

  compute(): void {
    if (!this.a.isDefined() || !this.b.isDefined()) {
      this.result.setUndefined();
      return;
    }
    const dx = this.b.getX() - this.a.getX();
    const dy = this.b.getY() - this.a.getY();
    if (Math.hypot(dx, dy) < 1e-9) {
      this.result.setUndefined();
      return;
    }
    this.result.setDefined();
  }
}
