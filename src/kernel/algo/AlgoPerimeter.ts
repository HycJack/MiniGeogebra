import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoNumeric } from '../geo/GeoNumeric';

/**
 * 周长测量（对标 GeoGebra CmdPerimeter / Length(Polygon)）：
 * 顶点依次相连（末边闭合）的距离和，输出 GeoNumeric，输入活依赖。
 */
export class AlgoPerimeter extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(kernel: IKernel, private polygon: GeoPolygon) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.polygon];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const v = this.polygon.vertices;
    if (v.length < 2 || !this.polygon.isDefined()) {
      this.outputValue.setUndefined();
      return;
    }
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
      const a = v[i];
      const b = v[(i + 1) % v.length];
      sum += Math.hypot(b.getX() - a.getX(), b.getY() - a.getY());
    }
    // 顶点坐标含 NaN/∞（上游 undefined 传播被逐点映射绕过时）按未定义处理，
    // 不输出 "NaN" 的已定义数值
    if (!Number.isFinite(sum)) {
      this.outputValue.setUndefined();
      return;
    }
    this.outputValue.setValue(sum);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
}
