import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';

export class AlgoLineTwoPoints extends AlgoElement {
  private outputLine: GeoLine;

  constructor(
    kernel: IKernel,
    private p1: GeoPoint,
    private p2: GeoPoint,
  ) {
    super(kernel);
    // Initialize with dummy values, will be computed immediately
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

    const dx = x2 - x1;
    const dy = y2 - y1;

    // ax + by + c = 0
    // Normal vector (-dy, dx) -> (a, b)
    // a = -dy = y1 - y2
    // b = dx = x2 - x1
    const a = y1 - y2;
    const b = x2 - x1;
    const c = -a * x1 - b * y1;

    this.outputLine.a = a;
    this.outputLine.b = b;
    this.outputLine.c = c;
  }

  getOutput(): GeoLine {
    return this.outputLine;
  }
}
