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
import { GeoConicPart } from '../geo/GeoConicPart';
import { GeoVec3D } from '../core/GeoVec3D';

/** 弧类载体：GeoArc 与 GeoConicPart 的圆几何/角窗接口同构。 */
export type ArcCarrier = GeoArc | GeoConicPart;

export class AlgoPointOnArc extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(kernel: IKernel, private arc: ArcCarrier, private param: GeoNumeric) {
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

  /** 拖拽反解：目标点相对圆心的极角，夹到弧的实际扫窗内。 */
  updateParameter(x: number, y: number): void {
    const c = this.arc.getCenter();
    let theta = Math.atan2(y - c.y, x - c.x);
    const start = this.arc.getStartAngle();
    const end = this.arc.getEndAngle();
    const ccw = this.arc.isCounterClockwise();
    // 与 GeoArc.isOnPath / 渲染同一约定：弧 = 从 start 沿扫向扫到 end 的窗口。
    // 此前 ccw=false 分支没有上界夹取，拖拽可以把参数点甩到弧外。
    const TWO_PI = 2 * Math.PI;
    const sweep = ccw
      ? ((start - end) % TWO_PI + TWO_PI) % TWO_PI
      : ((end - start) % TWO_PI + TWO_PI) % TWO_PI;
    let rel = ((theta - start) % TWO_PI + TWO_PI) % TWO_PI;
    if (rel > sweep) {
      // 超出扫窗：夹到较近的一端（起点或终点方向）
      const toStart = Math.min(rel, TWO_PI - rel);
      const toEnd = Math.abs(rel - sweep);
      rel = toStart <= toEnd ? 0 : sweep;
    }
    this.param.setValue(start + (ccw ? -rel : rel), false);
  }
}
