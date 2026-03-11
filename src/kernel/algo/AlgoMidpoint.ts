import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoMidpoint extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private p1: GeoPoint,
    private p2: GeoPoint,
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    const x = (this.p1.getX() + this.p2.getX()) / 2;
    const y = (this.p1.getY() + this.p2.getY()) / 2;
    this.outputPoint.setCoords(x, y);
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }
}
