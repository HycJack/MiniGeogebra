/**
 * 圆弧上的参数点：参数 = 极角（弧的起止角区间内），
 * 点 = 圆心 + 半径·(cosθ, sinθ)。对标 GeoGebra 的 Point(<Arc>)。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoArc } from '../geo/GeoArc';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoPointOnArc extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(kernel: IKernel, private arc: GeoArc, private param: GeoNumeric) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.arc, this.param];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  compute(): void {
    if (!this.arc.isDefined()) {
      this.outputPoint.setUndefined();
      return;
    }
    const t = this.param.getValue();
    const c = this.arc.getCenter();
    const r = this.arc.getRadius();
    this.outputPoint.setCoords(
      c.x + r * Math.cos(t),
      c.y + r * Math.sin(t),
      1,
    );
    this.outputPoint.setDefined();
  }

  /** 拖拽反解：目标点相对圆心的极角，夹到弧的起止角区间内。 */
  updateParameter(x: number, y: number): void {
    const c = this.arc.getCenter();
    let theta = Math.atan2(y - c.y, x - c.x);
    const start = this.arc.getStartAngle();
    let end = this.arc.getEndAngle();
    const ccw = this.arc.isCounterClockwise();
    // 把 theta 归一到 [start, start+2π) 再夹取（考虑方向）
    while (theta < start) theta += 2 * Math.PI;
    while (theta >= start + 2 * Math.PI) theta -= 2 * Math.PI;
    if (ccw) {
      while (theta > end) end += 2 * Math.PI;
      if (theta > end) theta = start;
    } else {
      while (theta < end) end -= 2 * Math.PI;
      if (theta < end) theta = start;
    }
    this.param.setValue(theta, false);
  }
}
