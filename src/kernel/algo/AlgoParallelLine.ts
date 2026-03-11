import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';

export class AlgoParallelLine extends AlgoElement {
  private outputLine: GeoLine;

  constructor(
    kernel: IKernel,
    private point: GeoPoint,
    private line: GeoLine,
  ) {
    super(kernel);
    this.outputLine = new GeoLine(kernel, 0, 0, 0);
    this.outputLine.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.point, this.line];
    this.setOutput([this.outputLine]);
  }

  compute(): void {
    const x0 = this.point.getX();
    const y0 = this.point.getY();
    const a = this.line.a;
    const b = this.line.b;

    // Parallel line has same normal vector (a, b)
    // ax + by + c' = 0
    // c' = - (a*x0 + b*y0)
    const c = -(a * x0 + b * y0);

    this.outputLine.a = a;
    this.outputLine.b = b;
    this.outputLine.c = c;
  }

  getOutput(): GeoLine {
    return this.outputLine;
  }
}
