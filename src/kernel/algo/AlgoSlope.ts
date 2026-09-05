import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';

export class AlgoSlope extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(kernel: IKernel, private line: GeoLine) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.outputValue.label = 'm';
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.line];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    if (!this.line.isDefined()) {
      this.outputValue.setUndefined();
      return;
    }
    const { a, b } = this.line;
    if (Math.abs(b) < 1e-12) {
      this.outputValue.setValue(Infinity);
      return;
    }
    this.outputValue.setValue(-a / b);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
}
