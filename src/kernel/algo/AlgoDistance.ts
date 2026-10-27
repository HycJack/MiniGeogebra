import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoSegment } from '../geo/GeoSegment';
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
    } else if (this.b && this.a instanceof GeoLine && this.b instanceof GeoLine) {
      // 平行线距（对标 CmdDistance 的 Distance(l1, l2)）：非平行时无定义
      const det = this.a.a * this.b.b - this.b.a * this.a.b;
      const mag = Math.max(Math.abs(this.a.a), Math.abs(this.a.b), Math.abs(this.b.a), Math.abs(this.b.b), 1);
      if (Math.abs(det) >= 1e-12 * mag * mag) {
        this.outputValue.setUndefined();
        return;
      }
      // 两平行线 ax+by+c=0 与 a'x+b'y+c'=0 同法向时：在 l1 上取一点到 l2 的距离
      const { a: A, b: B, c: C } = this.b;
      const len = Math.hypot(A, B);
      if (len === 0) {
        this.outputValue.setUndefined();
        return;
      }
      // 取 l1 上任一点（系数非零分量处反解）
      let px = 0, py = 0;
      if (Math.abs(this.a.b) > 1e-12) py = -this.a.c / this.a.b;
      else if (Math.abs(this.a.a) > 1e-12) px = -this.a.c / this.a.a;
      d = Math.abs(A * px + B * py + C) / len;
    } else if (this.b && this.a instanceof GeoPoint && this.b instanceof GeoLine) {
      d = pointLineDistance(this.a, this.b);
      if (!Number.isFinite(d)) {
        this.outputValue.setUndefined();
        return;
      }
    } else if (this.b && this.a instanceof GeoLine && this.b instanceof GeoPoint) {
      d = pointLineDistance(this.b, this.a);
      if (!Number.isFinite(d)) {
        this.outputValue.setUndefined();
        return;
      }
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

/** 点到"线"距离。线段（GeoSegment）垂足出段时取最近端点（官方 CmdDistance 语义）——
 *  此前一律按无限直线算，延长线侧结果偏小。退化输入返回 NaN。 */
function pointLineDistance(p: GeoPoint, line: GeoLine): number {
  if (line instanceof GeoSegment) {
    const ax = line.startPoint.getX(), ay = line.startPoint.getY();
    const bx = line.endPoint.getX(), by = line.endPoint.getY();
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-18) return NaN;
    const t = Math.max(0, Math.min(1, ((p.getX() - ax) * dx + (p.getY() - ay) * dy) / len2));
    return Math.hypot(p.getX() - (ax + t * dx), p.getY() - (ay + t * dy));
  }
  const { a: A, b: B, c: C } = line;
  const len = Math.hypot(A, B);
  if (len === 0) return NaN;
  return Math.abs(A * p.getX() + B * p.getY() + C) / len;
}
