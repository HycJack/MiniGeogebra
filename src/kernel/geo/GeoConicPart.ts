/**
 * 圆锥曲线片段（ConicPart）—— 圆弧 / 扇形 / 半圆 等。
 * 对标 GeoGebra GeoConicPart：type 区分 ARC / SECTOR / SEGMENT。
 *
 * 内部存储继承自 GeoConic（圆心 + 半径 + 系数），额外保存起止角与类型。
 */

import { IKernel, Path, PathMover } from '../core/Interfaces';
import { GeoConic } from './GeoConic';
import { GeoPoint } from './GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

/** 片段类型常量 */
export const CONIC_PART_ARC = 0;
export const CONIC_PART_SECTOR = 1;
export const CONIC_PART_SEGMENT = 2;

export type ConicPartType = typeof CONIC_PART_ARC | typeof CONIC_PART_SECTOR | typeof CONIC_PART_SEGMENT;

export class GeoConicPart extends GeoConic implements Path {
  private _startAngle: number;
  private _endAngle: number;
  private _ccw: boolean;
  private _partType: ConicPartType;

  constructor(
    kernel: IKernel,
    center: { x: number; y: number },
    radius: number,
    startAngle: number,
    endAngle: number,
    partType: ConicPartType = CONIC_PART_ARC,
    counterClockwise = false,
  ) {
    super(kernel, circleCoeffs(center.x, center.y, radius));
    this._startAngle = startAngle;
    this._endAngle = endAngle;
    this._partType = partType;
    this._ccw = counterClockwise;
  }

  /** 由三点（圆心 + 起弧点 + 终弧点）构造 */
  static fromPoints(
    kernel: IKernel,
    center: GeoPoint,
    pStart: GeoPoint,
    pEnd: GeoPoint,
    partType: ConicPartType = CONIC_PART_ARC,
    counterClockwise = false,
  ): GeoConicPart {
    const cx = center.getX(), cy = center.getY();
    const r = Math.hypot(pStart.getX() - cx, pStart.getY() - cy);
    const sa = Math.atan2(pStart.getY() - cy, pStart.getX() - cx);
    const ea = Math.atan2(pEnd.getY() - cy, pEnd.getX() - cx);
    return new GeoConicPart(kernel, { x: cx, y: cy }, r, sa, ea, partType, counterClockwise);
  }

  getClassName(): string { return 'GeoConicPart'; }

  public get defaultStrokeColor(): string { return '#000000'; }
  public get defaultLineWidth(): number { return 1; }
  public get defaultFillColor(): string | null {
    return this._partType === CONIC_PART_SECTOR ? 'rgba(59,130,246,0.15)' : null;
  }

  getStartAngle(): number { return this._startAngle; }
  getEndAngle(): number { return this._endAngle; }
  getPartType(): ConicPartType { return this._partType; }
  isCounterClockwise(): boolean { return this._ccw; }
  isSector(): boolean { return this._partType === CONIC_PART_SECTOR; }
  isArc(): boolean { return this._partType === CONIC_PART_ARC; }

  setParameters(startAngle: number, endAngle: number, ccw: boolean): void {
    this._startAngle = startAngle;
    this._endAngle = endAngle;
    this._ccw = ccw;
  }

  /** 代数描述 */
  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const { x: h, y: k } = this.getCenter();
    const r = this.getRadius();
    if (r <= 0) return `${this.label}（未定义）`;
    const s = (this._startAngle * 180 / Math.PI).toFixed(0);
    const e = (this._endAngle * 180 / Math.PI).toFixed(0);
    const typeName = this._partType === CONIC_PART_SECTOR ? '扇形' : this._partType === CONIC_PART_SEGMENT ? '弓形' : '弧';
    return `${this.label} : ${typeName} (角度 ${s}°→${e}°, r=${r.toFixed(2)})`;
  }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const center = this.getCenter();
    const r = this.getRadius();
    const d = Math.hypot(PI.getX() - center.x, PI.getY() - center.y);
    if (Math.abs(d - r) > eps) return false;
    const a = Math.atan2(PI.getY() - center.y, PI.getX() - center.x);
    return isAngleInRange(a, this._startAngle, this._endAngle, this._ccw, eps);
  }

  getMinParameter(): number { return this._startAngle; }
  getMaxParameter(): number { return this._endAngle; }

  createPathMover(): PathMover {
    return new ConicPartPathMover(this);
  }
}

class ConicPartPathMover implements PathMover {
  private t: number;
  private step = 0.05;
  constructor(private part: GeoConicPart) { this.t = part.getStartAngle(); }
  getCurrentPosition(p: GeoPoint) {
    const c = this.part.getCenter();
    const r = this.part.getRadius();
    p.setCoords(c.x + r * Math.cos(this.t), c.y + r * Math.sin(this.t), 1);
  }
  getNext(p: GeoPoint): boolean {
    if (this.t >= this.part.getEndAngle()) return false;
    this.t += this.step;
    this.getCurrentPosition(p);
    return true;
  }
  hasNext(): boolean { return this.t < this.part.getEndAngle(); }
  resetStartParameter(): void { this.t = this.part.getStartAngle(); }
  changeOrientation(): void { this.step *= -1; }
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

function isAngleInRange(a: number, start: number, end: number, ccw: boolean, eps: number): boolean {
  let s = start, e = end;
  if (ccw && e < s) e += 2 * Math.PI;
  if (!ccw && s < e) s += 2 * Math.PI;
  const na = normalizeAngle(a, Math.min(s, e));
  const ns = normalizeAngle(s, Math.min(s, e));
  const ne = normalizeAngle(e, Math.min(s, e));
  return na >= ns - eps && na <= ne + eps;
}
