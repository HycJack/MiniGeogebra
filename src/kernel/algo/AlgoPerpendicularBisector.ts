import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';

export class AlgoPerpendicularBisector extends AlgoElement {
  private outputLine: GeoLine;

  constructor(
    kernel: IKernel,
    private p1: GeoPoint,
    private p2: GeoPoint,
  ) {
    super(kernel);
    this.outputLine = new GeoLine(kernel, 0, 0, 0);
    this.outputLine.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2];
    this.setOutput([this.outputLine]);
  }

  compute(): void {
    const x1 = this.p1.getX();
    const y1 = this.p1.getY();
    const x2 = this.p2.getX();
    const y2 = this.p2.getY();

    // Midpoint
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    // Vector P1P2 = (x2-x1, y2-y1) is the normal vector to the bisector
    const a = x2 - x1;
    const b = y2 - y1;

    // Line through M with normal (a, b)
    // a(x - mx) + b(y - my) = 0
    // ax + by - (a*mx + b*my) = 0
    const c = -(a * mx + b * my);

    this.outputLine.a = a;
    this.outputLine.b = b;
    this.outputLine.c = c;
  }

  getOutput(): GeoLine {
    return this.outputLine;
  }
}
