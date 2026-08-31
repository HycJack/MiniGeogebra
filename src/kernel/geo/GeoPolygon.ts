import { IKernel, Region } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoPoint } from './GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoPolygon extends GeoElement implements Region {
  constructor(kernel: IKernel, public vertices: GeoPoint[]) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName() { return 'GeoPolygon'; }

  // ---- P2-1: 默认样式（绘制层 fallback）----
  public get defaultStrokeColor(): string { return '#3b82f6'; }
  public get defaultLineWidth(): number { return 1; }
  public get defaultFillColor(): string { return 'rgba(59, 130, 246, 0.2)'; }

  /** 代数描述：顶点序列 + 周长 + 面积 */
  getAlgebraDescription(): string {
    if (!this.isDefined() || this.vertices.length === 0) return `${this.label}（未定义）`;
    const labels = this.vertices.map(v => v.label || '?').join(', ');
    const perim = this.getPerimeter();
    const area = this.getArea();
    return `${this.label} = [${labels}]（周长 ${perim.toFixed(2)}，面积 ${area.toFixed(2)}）`;
  }

  protected getPerimeter(): number {
    let p = 0;
    for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
      p += Math.hypot(
        this.vertices[i].getX() - this.vertices[j].getX(),
        this.vertices[i].getY() - this.vertices[j].getY()
      );
    }
    return p;
  }

  protected getArea(): number {
    let sum = 0;
    for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
      sum += this.vertices[j].getX() * this.vertices[i].getY()
           - this.vertices[i].getX() * this.vertices[j].getY();
    }
    return Math.abs(sum) / 2;
  }

  isInRegion(P: GeoPoint): boolean {
    let inside = false;
    const x = P.getX();
    const y = P.getY();
    for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
      const xi = this.vertices[i].getX();
      const yi = this.vertices[i].getY();
      const xj = this.vertices[j].getX();
      const yj = this.vertices[j].getY();
      const intersect =
        (yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  isInRegionXY(x0: number, y0: number): boolean {
    return this.isInRegion(new GeoPoint(this.kernel, new GeoVec3D(x0, y0, 1)));
  }

  translate(v: GeoVec3D): void {
    const dx = v.x;
    const dy = v.y;
    this.vertices.forEach(vert => {
      if (vert.isIndependent()) {
        vert.setCoords(vert.getX() + dx, vert.getY() + dy);
      }
    });
    this.update();
  }
}
