import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoCircleCenter extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private circle: GeoConic,
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.circle];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    if (!this.circle.isDefined()) {
      this.outputPoint.setUndefined();
      return;
    }
    
    const center = this.circle.getCenter();
    this.outputPoint.setCoords(center.x, center.y);
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }
}
