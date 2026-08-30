import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoConic } from '../geo/GeoConic';
import { GeoNumeric } from '../geo/GeoNumeric';

/**
 * 面积测量：多边形面积（鞋带公式）或圆的面积。
 * 输出为 GeoNumeric。
 */
export class AlgoArea extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(
    kernel: IKernel,
    private target: GeoElement, // GeoPolygon | GeoConic(circle)
  ) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.outputValue.label = 'Area';
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.target];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    let area: number;

    if (this.target instanceof GeoPolygon) {
      const v = this.target.vertices;
      if (v.length < 3) {
        this.outputValue.setUndefined();
        return;
      }
      let sum = 0;
      for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
        sum += v[j].getX() * v[i].getY() - v[i].getX() * v[j].getY();
      }
      area = Math.abs(sum) / 2;
    } else if (this.target instanceof GeoConic) {
      const r = this.target.getRadius();
      if (r <= 0 || !Number.isFinite(r)) {
        this.outputValue.setUndefined();
        return;
      }
      area = Math.PI * r * r;
    } else {
      this.outputValue.setUndefined();
      return;
    }

    this.outputValue.setValue(area);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric {
    return this.outputValue;
  }
}
