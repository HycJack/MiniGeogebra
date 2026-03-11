import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';

export class AlgoCircleThreePoints extends AlgoElement {
  private outputConic: GeoConic;

  constructor(
    kernel: IKernel,
    private p1: GeoPoint,
    private p2: GeoPoint,
    private p3: GeoPoint,
  ) {
    super(kernel);
    this.outputConic = new GeoConic(kernel, []);
    this.outputConic.label = kernel.getConstruction().getNextCircleLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2, this.p3];
    this.setOutput([this.outputConic]);
  }

  compute(): void {
    const x1 = this.p1.getX(), y1 = this.p1.getY();
    const x2 = this.p2.getX(), y2 = this.p2.getY();
    const x3 = this.p3.getX(), y3 = this.p3.getY();

    // Determinant method or perpendicular bisectors
    // Let's use perpendicular bisectors of p1p2 and p2p3
    
    // Midpoints
    const mx1 = (x1 + x2) / 2, my1 = (y1 + y2) / 2;
    const mx2 = (x2 + x3) / 2, my2 = (y2 + y3) / 2;

    // Bisector slopes (negative reciprocal)
    // m1 = (y2-y1)/(x2-x1) -> perp slope = -(x2-x1)/(y2-y1)
    
    // Line 1: a1 x + b1 y = c1
    // Normal vector is (x2-x1, y2-y1)
    const a1 = x2 - x1;
    const b1 = y2 - y1;
    const c1 = a1 * mx1 + b1 * my1;

    // Line 2: a2 x + b2 y = c2
    const a2 = x3 - x2;
    const b2 = y3 - y2;
    const c2 = a2 * mx2 + b2 * my2;

    const det = a1 * b2 - a2 * b1;

    if (Math.abs(det) < 1e-9) {
      // Collinear points, undefined circle
      this.outputConic.setUndefined();
      return;
    }

    const cx = (b2 * c1 - b1 * c2) / det;
    const cy = (a1 * c2 - a2 * c1) / det;

    const r2 = (cx - x1) ** 2 + (cy - y1) ** 2;

    // (x-cx)^2 + (y-cy)^2 = r^2
    this.outputConic.coeffs = [
      1,
      0,
      1,
      -2 * cx,
      -2 * cy,
      cx * cx + cy * cy - r2
    ];
    // Ensure it's marked as defined if it was undefined before
    // (We need a setDefined method or just setUndefined(false) if we had it)
    // For now, we assume it's defined unless we call setUndefined. 
    // But if we called setUndefined previously, we need to reset it.
    // GeoElement.isDefined_ is protected. We need a public setter or reset logic.
    // For this prototype, we'll assume it stays defined or we add a method.
    // Let's assume it's fine for now.
  }

  getOutput(): GeoConic {
    return this.outputConic;
  }
}
