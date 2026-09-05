import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoConic } from '../geo/GeoConic';

export class AlgoParabola extends AlgoElement {
  private outputConic: GeoConic;

  constructor(kernel: IKernel, private focus: GeoPoint, private directrix: GeoLine) {
    super(kernel);
    this.outputConic = new GeoConic(kernel, [1, 0, 0, 0, 0, -1]);
    this.outputConic.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.focus, this.directrix];
    this.setOutput([this.outputConic]);
  }

  compute(): void {
    if (!this.focus.isDefined() || !this.directrix.isDefined()) {
      this.outputConic.setUndefined();
      return;
    }
    const fx = this.focus.getX(), fy = this.focus.getY();
    const { a: la, b: lb, c: lc } = this.directrix;
    const len = Math.hypot(la, lb);
    if (len < 1e-12) { this.outputConic.setUndefined(); return; }
    const pDist = Math.abs(la * fx + lb * fy + lc) / len;
    if (pDist < 1e-12) { this.outputConic.setUndefined(); return; }
    const na = la / len, nb = lb / len, nc = lc / len;
    const A = 1 - na * na;
    const B = -2 * na * nb;
    const C = 1 - nb * nb;
    const D = -2 * fx - 2 * nc * na;
    const E = -2 * fy - 2 * nc * nb;
    const F = fx * fx + fy * fy - nc * nc;
    (this.outputConic as any).coeffs = [A, B, C, D, E, F];
    this.outputConic.setDefined();
  }

  getOutput(): GeoConic { return this.outputConic; }
}
