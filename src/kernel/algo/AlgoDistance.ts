import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';

/**
 * 距离测量：两点之间的距离（也可求点到直线的垂直距离）。
 * 输出为一个 GeoNumeric，可在代数视图显示，也可作为滑块那样的动态数值参与后续构造。
 */
export class AlgoDistance extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(
    kernel: IKernel,
    private a: GeoElement,   // GeoPoint | GeoLine
    private b?: GeoElement,  // GeoPoint（两点距离）；若省略则为“点到直线距离”，a 当作直线
  ) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.outputValue.label = kernel.getConstruction().getNextLineLabel(); // 复用 l1… 命名，后面会改成 d1
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.b ? [this.a, this.b] : [this.a];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    let d: number;

    if (this.b && this.a instanceof GeoPoint && this.b instanceof GeoPoint) {
      // 两点距离
      const dx = this.a.getX() - this.b.getX();
      const dy = this.a.getY() - this.b.getY();
      d = Math.hypot(dx, dy);
    } else if (!this.b && this.a instanceof GeoLine) {
      // 暂未处理单直线情形；由 update() 的 undefined guard 兜底
      this.outputValue.setUndefined();
      return;
    } else if (this.b && this.a instanceof GeoPoint && this.b instanceof GeoLine) {
      // 点到直线距离
      const { a: A, b: B, c: C } = this.b;
      const len = Math.hypot(A, B);
      if (len === 0) {
        this.outputValue.setUndefined();
        return;
      }
      d = Math.abs(A * this.a.getX() + B * this.a.getY() + C) / len;
    } else if (this.b && this.a instanceof GeoLine && this.b instanceof GeoPoint) {
      const { a: A, b: B, c: C } = this.a;
      const len = Math.hypot(A, B);
      if (len === 0) {
        this.outputValue.setUndefined();
        return;
      }
      d = Math.abs(A * this.b.getX() + B * this.b.getY() + C) / len;
    } else {
      this.outputValue.setUndefined();
      return;
    }

    this.outputValue.setValue(d);
    this.outputValue.setDefined();
  }

  getValue(): number {
    return this.outputValue.getValue();
  }

  getOutput(): GeoNumeric {
    return this.outputValue;
  }
}
