/**
 * 射线（Ray）—— 从原点出发经过第二点无限延伸。
 * 对标 GeoGebra「射线」工具。
 */

import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoPoint } from './GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoRay extends GeoElement {
  constructor(
    kernel: IKernel,
    public startPoint: GeoPoint,   // 原点
    public secondPoint: GeoPoint   // 方向点
  ) {
    super(kernel, new GeoVec3D(startPoint.getX(), startPoint.getY(), 1));
  }

  getClassName(): string { return 'GeoRay'; }

  public get defaultStrokeColor(): string { return '#000000'; }
  public get defaultLineWidth(): number { return 1; }

  getStartPoint(): GeoPoint { return this.startPoint; }
  getSecondPoint(): GeoPoint { return this.secondPoint; }

  /** 代数描述：射线 AB。 */
  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const a = this.startPoint.label || '?';
    const b = this.secondPoint.label || '?';
    return `${this.label} : 射线 ${a}${b}`;
  }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const x = PI.getX(), y = PI.getY();
    const dx = this.secondPoint.getX() - this.startPoint.getX();
    const dy = this.secondPoint.getY() - this.startPoint.getY();
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return false;
    const dot = (x - this.startPoint.getX()) * dx + (y - this.startPoint.getY()) * dy;
    if (dot < -eps) return false;
    const cross = dx * (y - this.startPoint.getY()) - dy * (x - this.startPoint.getX());
    return Math.abs(cross) < eps * Math.hypot(dx, dy);
  }

  getMinParameter(): number { return 0; }
  getMaxParameter(): number { return Infinity; }

  translate(v: GeoVec3D): void {
    this.startPoint.setCoords(this.startPoint.getX() + v.x, this.startPoint.getY() + v.y);
    this.secondPoint.setCoords(this.secondPoint.getX() + v.x, this.secondPoint.getY() + v.y);
    this.update();
  }
}
