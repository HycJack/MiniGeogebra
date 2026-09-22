/**
 * 正多边形构造算法 —— 中心 + 半径 + 边数。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoRegularPolygon } from '../geo/GeoRegularPolygon';

export class AlgoRegularPolygon extends AlgoElement {
  private result: GeoRegularPolygon;
  private centerPoint: any;
  private radius: number;

  constructor(kernel: IKernel, center: any, radiusOrPoint: number | any, nSides: number) {
    super(kernel);
    const cx = center instanceof Object ? center.x : center.getX();
    const cy = center instanceof Object ? center.y : center.getY();
    const r = typeof radiusOrPoint === 'number' ? radiusOrPoint : Math.hypot(radiusOrPoint.getX() - cx, radiusOrPoint.getY() - cy);
    // 记住中心点引用（半径为构造期常数），中心点移动时 compute() 原地重算。
    this.centerPoint = center instanceof Object ? null : center;
    this.radius = r;
    this.result = new GeoRegularPolygon(kernel, { x: cx, y: cy }, r, Math.max(3, Math.floor(nSides)));
    this.setInputOutput();
  }

  setInputOutput(): void {
    // 之前的实现把自己的输出注册成自己的输入（自环），且不含中心点，
    // 导致中心点移动后多边形永不重算。
    this.input = this.centerPoint ? [this.centerPoint] : [];
    this.setOutput([this.result]);
  }

  getOutput(): GeoRegularPolygon { return this.result; }

  getRadiusValue(): number { return this.radius; }
  getSidesValue(): number { return this.result.getSides(); }

  compute(): void {
    if (this.result.getRadius() <= 0 || this.result.getSides() < 3) {
      this.result.setUndefined();
      return;
    }
    if (this.centerPoint) {
      this.result.setGeometry(
        { x: this.centerPoint.getX(), y: this.centerPoint.getY() },
        this.radius,
      );
    }
    this.result.setDefined();
  }
}
