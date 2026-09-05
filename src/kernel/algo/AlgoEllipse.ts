import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';

export class AlgoEllipse extends AlgoElement {
  private outputConic: GeoConic;

  constructor(kernel: IKernel, private f1: GeoPoint, private f2: GeoPoint, private p: GeoPoint) {
    super(kernel);
    this.outputConic = new GeoConic(kernel, [1, 0, 1, 0, 0, -1]);
    this.outputConic.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.f1, this.f2, this.p];
    this.setOutput([this.outputConic]);
  }

  compute(): void {
    if (!this.f1.isDefined() || !this.f2.isDefined() || !this.p.isDefined()) {
      this.outputConic.setUndefined();
      return;
    }
    const f1x = this.f1.getX(), f1y = this.f1.getY();
    const f2x = this.f2.getX(), f2y = this.f2.getY();
    const px = this.p.getX(), py = this.p.getY();
    const d1 = Math.hypot(px - f1x, py - f1y);
    const d2 = Math.hypot(px - f2x, py - f2y);
    const sumDist = d1 + d2;
    if (sumDist < 1e-12) { this.outputConic.setUndefined(); return; }
    const a = sumDist / 2;
    const cx = (f1x + f2x) / 2, cy = (f1y + f2y) / 2;
    const c = Math.hypot(f2x - f1x, f2y - f1y) / 2;
    if (a <= c) { this.outputConic.setUndefined(); return; }
    const b2 = a * a - c * c;
    const theta = Math.atan2(f2y - f1y, f2x - f1x);
    const ct = Math.cos(theta), st = Math.sin(theta);
    const A = (ct * ct) / (a * a) + (st * st) / b2;
    const B = 2 * ct * st * (1 / (a * a) - 1 / b2);
    const C = (st * st) / (a * a) + (ct * ct) / b2;
    const D = -2 * A * cx - B * cy;
    const E = -B * cx - 2 * C * cy;
    const F = A * cx * cx + B * cx * cy + C * cy * cy - 1;
    (this.outputConic as any).coeffs = [A, B, C, D, E, F];
    this.outputConic.setDefined();
  }

  getOutput(): GeoConic { return this.outputConic; }
}
