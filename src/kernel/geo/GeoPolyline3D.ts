import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';

/** 有序 3D 折线/多边形环（截面等算法输出用）。 */
export class GeoPolyline3D extends GeoElement {
  public points: Coords4[] = [];

  constructor(kernel: IKernel, points: Coords4[] = []) {
    super(kernel, new GeoVec3D(0, 0, 0));
    this.points = points.map(p => p.toPoint());
  }

  getClassName(): string { return 'GeoPolyline3D'; }

  get defaultStrokeColor(): string { return '#0891b2'; }
  get defaultLineWidth(): number { return 2; }

  setPoints(points: Coords4[]): void {
    this.points = points.map(p => p.toPoint());
  }

  isClosed(): boolean {
    return this.points.length > 2
      && this.points[0].distanceTo(this.points[this.points.length - 1]) < 1e-6;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} : ${this.points.length} 个顶点的 3D 折线`;
  }
}