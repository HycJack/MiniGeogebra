import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConicPart, CONIC_PART_SECTOR } from '../geo/GeoConicPart';

export class AlgoCircularSector extends AlgoElement {
  private outputPart: GeoConicPart;

  constructor(kernel: IKernel, private center: GeoPoint, private pStart: GeoPoint, private pEnd: GeoPoint) {
    super(kernel);
    this.outputPart = GeoConicPart.fromPoints(kernel, center, pStart, pEnd, CONIC_PART_SECTOR, true);
    this.outputPart.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.center, this.pStart, this.pEnd];
    this.setOutput([this.outputPart]);
  }

  compute(): void {
    if (!this.center.isDefined() || !this.pStart.isDefined() || !this.pEnd.isDefined()) {
      this.outputPart.setUndefined();
      return;
    }
    const cx = this.center.getX(), cy = this.center.getY();
    const r = Math.hypot(this.pStart.getX() - cx, this.pStart.getY() - cy);
    if (r <= 0) { this.outputPart.setUndefined(); return; }
    const sa = Math.atan2(this.pStart.getY() - cy, this.pStart.getX() - cx);
    const ea = Math.atan2(this.pEnd.getY() - cy, this.pEnd.getX() - cx);
    const coeffs = [1, 0, 1, -2 * cx, -2 * cy, cx * cx + cy * cy - r * r];
    (this.outputPart as any).coeffs = coeffs;
    this.outputPart.setParameters(sa, ea, true);
    this.outputPart.setDefined();
  }

  getOutput(): GeoConicPart { return this.outputPart; }
}
