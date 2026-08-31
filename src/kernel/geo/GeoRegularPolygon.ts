/**
 * 正多边形（Regular Polygon）—— 由中心、半径与边数确定。
 * 对标 GeoGebra「正多边形」工具。内部以顶点数组表示，可直接复用多边形渲染/面积逻辑。
 */

import { IKernel } from '../core/Interfaces';
import { GeoPolygon } from './GeoPolygon';
import { GeoPoint } from './GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

/** 计算正多边形的顶点数组（每个点都关联 kernel 且为自由点，因此可被平移）。 */
function computeVertices(kernel: IKernel, center: { x: number; y: number }, radius: number, n: number): GeoPoint[] {
  const vs: GeoPoint[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
    const x = center.x + radius * Math.cos(ang);
    const y = center.y + radius * Math.sin(ang);
    const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
    p.label = '';
    vs.push(p);
  }
  return vs;
}

export class GeoRegularPolygon extends GeoPolygon {
  private _center: { x: number; y: number };
  private _radius: number;
  private _nSides: number;

  constructor(kernel: IKernel, center: { x: number; y: number }, radius: number, nSides: number) {
    super(kernel, computeVertices(kernel, center, radius, Math.max(3, Math.floor(nSides))));
    this._center = center;
    this._radius = radius;
    this._nSides = this.vertices.length;
  }

  static fromCenterSidePoint(kernel: IKernel, center: GeoPoint, sidePoint: GeoPoint, nSides: number): GeoRegularPolygon {
    const cx = center.getX(), cy = center.getY();
    const r = Math.hypot(sidePoint.getX() - cx, sidePoint.getY() - cy);
    return new GeoRegularPolygon(kernel, { x: cx, y: cy }, r, nSides);
  }

  getClassName(): string { return 'GeoRegularPolygon'; }

  public get defaultStrokeColor(): string { return '#3b82f6'; }
  public get defaultLineWidth(): number { return 1; }
  public get defaultFillColor(): string { return 'rgba(59, 130, 246, 0.2)'; }

  getCenter(): { x: number; y: number } { return this._center; }
  getRadius(): number { return this._radius; }
  getSides(): number { return this._nSides; }

  /** 代数描述：正 N 边形。 */
  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} = 正${this._nSides}边形（r=${this._radius.toFixed(2)}, 周长 ${this.getPerimeter().toFixed(2)}, 面积 ${this.getArea().toFixed(2)})`;
  }

  /** 正多边形面积：S = n·r²·tan(π/n)。 */
  getArea(): number {
    const n = this._nSides;
    if (n < 3 || this._radius <= 0) return 0;
    return (n * this._radius * this._radius * Math.tan(Math.PI / n)) / 4;
  }
}
