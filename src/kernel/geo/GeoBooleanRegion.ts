/**
 * 布尔运算结果区域（union / difference / intersection 产物）——
 * 对标 GeoGebra 多边形布尔运算的输出几何。
 *
 * 与 GeoPolygon 不同：结果轮廓数量/顶点数在重算时可变，
 * 不能绑定固定 GeoPoint 列表，故直接存坐标轮廓（与 GeoLocus 的
 * samples 同一思路）。渲染/命中/面积均基于 contours。
 */
import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoPoint } from './GeoPoint';
import { pointInPolygon, signedArea, V2 } from './polygonBoolean';

export class GeoBooleanRegion extends GeoElement {
  /** 逆时针闭合轮廓列表（每条轮廓不重复末点）。 */
  public contours: V2[][] = [];

  constructor(kernel: IKernel) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName(): string { return 'GeoBooleanRegion'; }

  get defaultStrokeColor(): string { return '#3b82f6'; }
  get defaultLineWidth(): number { return 1; }
  get defaultFillColor(): string { return 'rgba(59, 130, 246, 0.25)'; }

  setContours(contours: V2[][]): void {
    this.contours = contours;
    if (contours.length === 0 || contours.every(c => c.length < 3)) {
      this.setUndefined();
    } else {
      this.setDefined();
    }
  }

  override isDefined(): boolean {
    return this.isDefined_ && this.contours.some(c => c.length >= 3);
  }

  /** 总面积（多轮廓绝对面积之和）。 */
  getArea(): number {
    return this.contours.reduce((s, c) => s + Math.abs(signedArea(c)), 0);
  }

  /** 点是否在任一轮廓内（简化：轮廓均逆时针、无洞假设下 OR）。 */
  isInRegion(P: GeoPoint): boolean {
    const p = { x: P.getX(), y: P.getY() };
    return this.contours.some(c => c.length >= 3 && pointInPolygon(p, c));
  }

  isInRegionXY(x0: number, y0: number): boolean {
    return this.contours.some(c => c.length >= 3 && pointInPolygon({ x: x0, y: y0 }, c));
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label}（${this.contours.length} 个轮廓，面积 ${this.fmt(this.getArea())}）`;
  }
}
