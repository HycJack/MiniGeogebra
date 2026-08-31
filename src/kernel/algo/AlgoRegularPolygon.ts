/**
 * 正多边形构造算法 —— 中心 + 半径 + 边数。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoRegularPolygon } from '../geo/GeoRegularPolygon';

export class AlgoRegularPolygon extends AlgoElement {
  private result: GeoRegularPolygon;

  constructor(kernel: IKernel, center: any, radiusOrPoint: number | any, nSides: number) {
    super(kernel);
    const cx = center instanceof Object ? center.x : center.getX();
    const cy = center instanceof Object ? center.y : center.getY();
    const r = typeof radiusOrPoint === 'number' ? radiusOrPoint : Math.hypot(radiusOrPoint.getX() - cx, radiusOrPoint.getY() - cy);
    this.result = new GeoRegularPolygon(kernel, { x: cx, y: cy }, r, Math.max(3, Math.floor(nSides)));
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.result];
    this.setOutput([this.result]);
  }

  getOutput(): GeoRegularPolygon { return this.result; }

  compute(): void {
    if (this.result.getRadius() <= 0 || this.result.getSides() < 3) {
      this.result.setUndefined();
      return;
    }
    this.result.setDefined();
  }
}
