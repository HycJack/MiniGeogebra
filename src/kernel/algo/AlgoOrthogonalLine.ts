import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';

export class AlgoOrthogonalLine extends AlgoElement {
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

    // Line: ax + by + c = 0. Normal (a, b). Direction (-b, a).
    // Orthogonal line has normal (-b, a).
    // -bx + ay + c' = 0
    // c' = - (-b*x0 + a*y0) = b*x0 - a*y0

    const newA = -b;
    const newB = a;
    const newC = b * x0 - a * y0;

    this.outputLine.a = newA;
    this.outputLine.b = newB;
    this.outputLine.c = newC;
  }

  getOutput(): GeoLine {
    return this.outputLine;
  }
}
