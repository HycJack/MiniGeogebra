import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';

export class AlgoCirclePointRadius extends AlgoElement {
  private outputConic: GeoConic;

  constructor(
    kernel: IKernel,
    private center: GeoPoint,
    private radius: number,
  ) {
    super(kernel);
    this.outputConic = new GeoConic(kernel, []);
    this.outputConic.label = kernel.getConstruction().getNextCircleLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.center];
    this.setOutput([this.outputConic]);
  }

  compute(): void {
    const h = this.center.getX();
    const k = this.center.getY();
    const r = this.radius;

    // (x-h)^2 + (y-k)^2 = r^2
    // x^2 - 2hx + h^2 + y^2 - 2ky + k^2 - r^2 = 0
    // A=1, B=0, C=1, D=-2h, E=-2k, F=h^2+k^2-r^2
    
    this.outputConic.coeffs = [
      1,          // A
      0,          // B
      1,          // C
      -2 * h,     // D
      -2 * k,     // E
      h * h + k * k - r * r // F
    ];
  }

  getOutput(): GeoConic {
    return this.outputConic;
  }
}
