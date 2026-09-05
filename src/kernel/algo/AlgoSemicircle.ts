import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConicPart, CONIC_PART_ARC } from '../geo/GeoConicPart';

export class AlgoSemicircle extends AlgoElement {
  private outputPart: GeoConicPart;

  constructor(kernel: IKernel, private p1: GeoPoint, private p2: GeoPoint) {
    super(kernel);
    this.outputPart = this.build();
    this.outputPart.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  private build(): GeoConicPart {
    const mx = (this.p1.getX() + this.p2.getX()) / 2;
    const my = (this.p1.getY() + this.p2.getY()) / 2;
    const r = Math.hypot(this.p2.getX() - this.p1.getX(), this.p2.getY() - this.p1.getY()) / 2;
    const angle = Math.atan2(this.p2.getY() - this.p1.getY(), this.p2.getX() - this.p1.getX());
    return new GeoConicPart(this.kernel, { x: mx, y: my }, r, angle - Math.PI, angle, CONIC_PART_ARC, true);
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2];
    this.setOutput([this.outputPart]);
  }

  compute(): void {
    if (!this.p1.isDefined() || !this.p2.isDefined()) {
      this.outputPart.setUndefined();
      return;
    }
    const mx = (this.p1.getX() + this.p2.getX()) / 2;
    const my = (this.p1.getY() + this.p2.getY()) / 2;
    const r = Math.hypot(this.p2.getX() - this.p1.getX(), this.p2.getY() - this.p1.getY()) / 2;
    if (r <= 0) { this.outputPart.setUndefined(); return; }
    const angle = Math.atan2(this.p2.getY() - this.p1.getY(), this.p2.getX() - this.p1.getX());
    // Recreate coefficients
    const coeffs = [1, 0, 1, -2 * mx, -2 * my, mx * mx + my * my - r * r];
    (this.outputPart as any).coeffs = coeffs;
    this.outputPart.setParameters(angle - Math.PI, angle, true);
    this.outputPart.setDefined();
  }

  getOutput(): GeoConicPart { return this.outputPart; }
}
