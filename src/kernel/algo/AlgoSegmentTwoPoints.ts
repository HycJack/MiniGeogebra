import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoSegment } from '../geo/GeoSegment';

export class AlgoSegmentTwoPoints extends AlgoElement {
  private outputSegment: GeoSegment;

  constructor(
    kernel: IKernel,
    private p1: GeoPoint,
    private p2: GeoPoint,
  ) {
    super(kernel);
    this.outputSegment = new GeoSegment(kernel, p1, p2);
    this.outputSegment.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2];
    this.setOutput([this.outputSegment]);
  }

  compute(): void {
    if (!this.p1.isDefined() || !this.p2.isDefined()) {
      this.outputSegment.setUndefined();
      return;
    }

    const dx = this.p2.getX() - this.p1.getX();
    const dy = this.p2.getY() - this.p1.getY();
    const a = -dy;
    const b = dx;
    const c = -a * this.p1.getX() - b * this.p1.getY();

    this.outputSegment.a = a;
    this.outputSegment.b = b;
    this.outputSegment.c = c;
    this.outputSegment.setDefined();
  }

  getOutput(): GeoSegment {
    return this.outputSegment;
  }
}
