import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';
import { GeoNumeric } from '../geo/GeoNumeric';

export class AlgoCirclePointRadius extends AlgoElement {
  private outputConic: GeoConic;
  private radiusValue: number;
  // 活半径：GeoNumeric（滑块）时注册为输入，拖滑块联动重算（对标 GeoGebra 的活依赖）
  private radiusNumeric: GeoNumeric | null;

  constructor(
    kernel: IKernel,
    private center: GeoPoint,
    radius: number | GeoNumeric,
  ) {
    super(kernel);
    this.radiusNumeric = radius instanceof GeoNumeric ? radius : null;
    this.radiusValue = radius instanceof GeoNumeric ? radius.getValue() : radius;
    this.outputConic = new GeoConic(kernel, []);
    this.outputConic.label = kernel.getConstruction().getNextCircleLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.radiusNumeric ? [this.center, this.radiusNumeric] : [this.center];
    this.setOutput([this.outputConic]);
  }

  compute(): void {
    const h = this.center.getX();
    const k = this.center.getY();
    const r = this.radiusNumeric ? this.radiusNumeric.getValue() : this.radiusValue;

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
    this.outputConic.setDefined();
  }

  /** 半径值（序列化 scalars 用：半径是构造器私有字段，不在 inputs 里）。 */
  getRadiusValue(): number {
    return this.radiusNumeric ? this.radiusNumeric.getValue() : this.radiusValue;
  }

  getOutput(): GeoConic {
    return this.outputConic;
  }
}
