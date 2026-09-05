import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoPolyLine } from '../geo/GeoPolyLine';

export class AlgoPolyLine extends AlgoElement {
  private outputPoly: GeoPolyLine;

  constructor(kernel: IKernel, private points: GeoPoint[]) {
    super(kernel);
    this.outputPoly = new GeoPolyLine(kernel, [...points]);
    this.outputPoly.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...this.points];
    this.setOutput([this.outputPoly]);
  }

  compute(): void {
    if (this.points.some(p => !p.isDefined())) {
      this.outputPoly.setUndefined();
      return;
    }
    this.outputPoly.vertices = [...this.points];
    this.outputPoly.setDefined();
  }

  getOutput(): GeoPolyLine { return this.outputPoly; }
}
