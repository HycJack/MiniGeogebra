import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';

export class AlgoCompass extends AlgoElement {
  private outputConic: GeoConic;

  constructor(kernel: IKernel, private a: GeoPoint, private b: GeoPoint, private center: GeoPoint) {
    super(kernel);
    this.outputConic = new GeoConic(kernel, [1, 0, 1, 0, 0, -1]);
    this.outputConic.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.a, this.b, this.center];
    this.setOutput([this.outputConic]);
  }

  compute(): void {
    if (!this.a.isDefined() || !this.b.isDefined() || !this.center.isDefined()) {
      this.outputConic.setUndefined();
      return;
    }
    const r = Math.hypot(this.b.getX() - this.a.getX(), this.b.getY() - this.a.getY());
    if (r <= 0) { this.outputConic.setUndefined(); return; }
    const cx = this.center.getX(), cy = this.center.getY();
    (this.outputConic as any).coeffs = [1, 0, 1, -2 * cx, -2 * cy, cx * cx + cy * cy - r * r];
    this.outputConic.setDefined();
  }

  getOutput(): GeoConic { return this.outputConic; }
}
