import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConicPart, CONIC_PART_ARC } from '../geo/GeoConicPart';

/**
 * 圆弧（三点在弧上）—— 给定圆上三点，生成过三点的圆弧。
 */
export class AlgoCircumcircularArc extends AlgoElement {
  private outputPart: GeoConicPart;

  constructor(kernel: IKernel, private p1: GeoPoint, private p2: GeoPoint, private p3: GeoPoint) {
    super(kernel);
    this.outputPart = this.build();
    this.outputPart.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  private build(): GeoConicPart {
    const { cx, cy, r } = circumcircle(this.p1, this.p2, this.p3);
    const sa = Math.atan2(this.p1.getY() - cy, this.p1.getX() - cx);
    const ea = Math.atan2(this.p3.getY() - cy, this.p3.getX() - cx);
    return new GeoConicPart(this.kernel, { x: cx, y: cy }, r, sa, ea, CONIC_PART_ARC, true);
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2, this.p3];
    this.setOutput([this.outputPart]);
  }

  compute(): void {
    if (!this.p1.isDefined() || !this.p2.isDefined() || !this.p3.isDefined()) {
      this.outputPart.setUndefined();
      return;
    }
    const { cx, cy, r } = circumcircle(this.p1, this.p2, this.p3);
    if (r <= 0 || !isFinite(r)) { this.outputPart.setUndefined(); return; }
    const sa = Math.atan2(this.p1.getY() - cy, this.p1.getX() - cx);
    const ea = Math.atan2(this.p3.getY() - cy, this.p3.getX() - cx);
    const coeffs = [1, 0, 1, -2 * cx, -2 * cy, cx * cx + cy * cy - r * r];
    (this.outputPart as any).coeffs = coeffs;
    this.outputPart.setParameters(sa, ea, true);
    this.outputPart.setDefined();
  }

  getOutput(): GeoConicPart { return this.outputPart; }
}

function circumcircle(p1: GeoPoint, p2: GeoPoint, p3: GeoPoint): { cx: number; cy: number; r: number } {
  const ax = p1.getX(), ay = p1.getY();
  const bx = p2.getX(), by = p2.getY();
  const cx_ = p3.getX(), cy_ = p3.getY();
  const d = 2 * (ax * (by - cy_) + bx * (cy_ - ay) + cx_ * (ay - by));
  if (Math.abs(d) < 1e-12) return { cx: 0, cy: 0, r: 0 };
  const ux = ((ax * ax + ay * ay) * (by - cy_) + (bx * bx + by * by) * (cy_ - ay) + (cx_ * cx_ + cy_ * cy_) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx_ - bx) + (bx * bx + by * by) * (ax - cx_) + (cx_ * cx_ + cy_ * cy_) * (bx - ax)) / d;
  return { cx: ux, cy: uy, r: Math.hypot(ux - ax, uy - ay) };
}
