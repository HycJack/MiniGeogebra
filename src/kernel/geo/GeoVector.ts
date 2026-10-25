import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoVector extends GeoElement {
  constructor(
    kernel: IKernel,
    public startX: number,
    public startY: number,
    public endX: number,
    public endY: number,
  ) {
    super(kernel, new GeoVec3D(endX - startX, endY - startY, 1));
  }

  getClassName() { return 'GeoVector'; }

  /** 整体平移（分量向量拖拽用）：起点终点同步位移，方向分量不变。 */
  translate(v: GeoVec3D): void {
    this.startX += v.x;
    this.startY += v.y;
    this.endX += v.x;
    this.endY += v.y;
    this.coords.set(this.endX - this.startX, this.endY - this.startY, 1);
    this.update();
  }

  /** 代数描述：向量分量与模长 */
  getAlgebraDescription(): string {
    const dx = this.endX - this.startX;
    const dy = this.endY - this.startY;
    const len = Math.hypot(dx, dy);
    return `${this.label} = (${this.fmt(dx)} | ${this.fmt(dy)})，模长 ${this.fmt(len)}`;
  }

  getVector(): GeoVec3D {
    return this.getCoords();
  }
}
