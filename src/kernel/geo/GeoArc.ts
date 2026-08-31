/**
 * 圆弧（Arc）—— 圆的指定起止角区间；fill 时绘制为扇形。
 * 对标 GeoGebra「圆弧」工具（圆心+圆上两点 / 圆心+起始终止角）。
 */

import { IKernel } from '../core/Interfaces';
import { GeoConic } from './GeoConic';
import { GeoPoint } from './GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoArc extends GeoConic {
  private _startAngle: number;
  private _endAngle: number;
  private _ccw: boolean;      // true = 逆时针

  constructor(
    kernel: IKernel,
    center: { x: number; y: number },
    radius: number,
    startAngle: number,
    endAngle: number,
    counterClockwise = false
  ) {
    super(kernel, circleCoeffs(center.x, center.y, radius));
    this._startAngle = startAngle;
    this._endAngle = endAngle;
    this._ccw = counterClockwise;
  }

  static fromPoints(kernel: IKernel, center: GeoPoint, pStart: GeoPoint, pEnd: GeoPoint, counterClockwise = false): GeoArc {
    const cx = center.getX(), cy = center.getY();
    const r = Math.hypot(pStart.getX() - cx, pStart.getY() - cy);
    const sa = Math.atan2(pStart.getY() - cy, pStart.getX() - cx);
    const ea = Math.atan2(pEnd.getY() - cy, pEnd.getX() - cx);
    return new GeoArc(kernel, { x: cx, y: cy }, r, sa, ea, counterClockwise);
  }

  getClassName(): string { return 'GeoArc'; }

  public get defaultStrokeColor(): string { return '#000000'; }
  public get defaultLineWidth(): number { return 1; }
  public get defaultFillColor(): string | null { return null; }

  getStartAngle(): number { return this._startAngle; }
  getEndAngle(): number { return this._endAngle; }
  isCounterClockwise(): boolean { return this._ccw; }

  getCenter(): { x: number; y: number } { return super.getCenter(); }
  getRadius(): number { return super.getRadius(); }

  /** 代数描述：圆弧 (A,B) / 角区间表示。 */
  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const { x: h, y: k } = this.getCenter();
    const r = this.getRadius();
    if (r <= 0) return `${this.label}（未定义）`;
    const s = (this._startAngle * 180 / Math.PI).toFixed(0).replace(/\.0$/, '');
    const e = (this._endAngle * 180 / Math.PI).toFixed(0).replace(/\.0$/, '');
    return `${this.label} : 弧 (角度 ${s}°→${e}°, r=${r.toFixed(2)})`;
  }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const center = this.getCenter();
    const r = this.getRadius();
    const d = Math.hypot(PI.getX() - center.x, PI.getY() - center.y);
    if (Math.abs(d - r) > eps) return false;
    const a = Math.atan2(PI.getY() - center.y, PI.getX() - center.x);
    let start = this._startAngle, end = this._endAngle;
    if (end < start) { [start, end] = [end, start]; }
    const normA = normalizeAngle(a, start);
    const nS = normalizeAngle(start, start);
    const nE = normalizeAngle(end, start);
    return normA >= nS - eps && normA <= nE + eps;
  }

  getMinParameter(): number { return this._startAngle; }
  getMaxParameter(): number { return this._endAngle; }

  createPathMover(): any { return null; }
}

function circleCoeffs(h: number, k: number, r: number): number[] {
  return [1, 0, 1, -2 * h, -2 * k, h * h + k * k - r * r];
}

function normalizeAngle(a: number, base: number): number {
  let t = a - base;
  while (t < 0) t += 2 * Math.PI;
  while (t >= 2 * Math.PI) t -= 2 * Math.PI;
  return t;
}
