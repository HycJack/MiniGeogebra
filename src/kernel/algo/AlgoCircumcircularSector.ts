import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConicPart, CONIC_PART_SECTOR } from '../geo/GeoConicPart';
import { circumcircle } from './AlgoCircumcircularArc';

export class AlgoCircumcircularSector extends AlgoElement {
  private outputPart: GeoConicPart;

  constructor(kernel: IKernel, private p1: GeoPoint, private p2: GeoPoint, private p3: GeoPoint) {
    super(kernel);
    this.outputPart = this.build();
    this.outputPart.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  private build(): GeoConicPart {
    const { cx, cy, r } = circumcircle(this.p1, this.p2, this.p3);
    return new GeoConicPart(this.kernel, { x: cx, y: cy }, r, 0, 0, CONIC_PART_SECTOR, true);
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2, this.p3];
    this.setOutput([this.outputPart]);
  }

  compute(): void {
    if (!this.p1.isDefined() || !this.p2.isDefined() || !this.p3.isDefined()) {
      this.outputPart.setUndefined();
      return;
    }
    const { cx, cy, r } = circumcircle(this.p1, this.p2, this.p3);
    if (r <= 0 || !isFinite(r)) { this.outputPart.setUndefined(); return; }
    const sa = Math.atan2(this.p1.getY() - cy, this.p1.getX() - cx);
    const ea = Math.atan2(this.p3.getY() - cy, this.p3.getX() - cx);
    (this.outputPart as any).coeffs = [1, 0, 1, -2 * cx, -2 * cy, cx * cx + cy * cy - r * r];
    this.outputPart.setParameters(sa, ea, true);
    this.outputPart.setDefined();
  }

  getOutput(): GeoConicPart { return this.outputPart; }
}
