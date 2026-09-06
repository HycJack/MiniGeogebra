import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoPointOnFunction extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private fn: GeoFunction,
    private param: GeoNumeric,
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.fn, this.param];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    const x = this.param.getValue();
    const y = this.fn.evaluateAt(x);
    if (Number.isFinite(y)) {
      this.outputPoint.setCoords(x, y, 1);
      this.outputPoint.setDefined();
    } else {
      this.outputPoint.setUndefined();
    }
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }

  updateParameter(x: number): void {
    this.param.setValue(x);
  }
}
