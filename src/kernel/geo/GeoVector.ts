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

  getVector(): GeoVec3D {
    return this.getCoords();
  }
}
