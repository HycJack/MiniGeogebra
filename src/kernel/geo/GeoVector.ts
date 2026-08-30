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

  /** 代数描述：向量分量与模长 */
  getAlgebraDescription(): string {
    const dx = this.endX - this.startX;
    const dy = this.endY - this.startY;
    const len = Math.hypot(dx, dy);
    return `${this.label} = (${dx.toFixed(2)} | ${dy.toFixed(2)})，模长 ${len.toFixed(2)}`;
  }

  getVector(): GeoVec3D {
    return this.getCoords();
  }
}
