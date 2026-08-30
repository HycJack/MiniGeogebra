import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';

/**
 * 角度测量：∠P1P2P3（顶点为 P2），结果以弧度计，范围 [0, π]。
 * 输出为 GeoNumeric。
 */
export class AlgoAngle extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(
    kernel: IKernel,
    private p1: GeoPoint,
    private p2: GeoPoint,   // 顶点
    private p3: GeoPoint,
  ) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.outputValue.label = 'α';
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2, this.p3];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const v1x = this.p1.getX() - this.p2.getX();
    const v1y = this.p1.getY() - this.p2.getY();
    const v2x = this.p3.getX() - this.p2.getX();
    const v2y = this.p3.getY() - this.p2.getY();

    const dot = v1x * v2x + v1y * v2y;
    const n1 = Math.hypot(v1x, v1y);
    const n2 = Math.hypot(v2x, v2y);

    if (n1 === 0 || n2 === 0) {
      this.outputValue.setUndefined();
      return;
    }

    let cos = dot / (n1 * n2);
    // 数值稳定：截断到 [-1, 1]
    if (cos > 1) cos = 1;
    if (cos < -1) cos = -1;

    const angle = Math.acos(cos); // [0, π]
    this.outputValue.setValue(angle);
    this.outputValue.setDefined();
  }

  /** 以度为单位取值（UI 友好） */
  getDegrees(): number {
    return this.outputValue.getValue() * 180 / Math.PI;
  }

  getOutput(): GeoNumeric {
    return this.outputValue;
  }
}
