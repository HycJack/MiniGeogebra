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
import { angleInArcWindow, arcSweep } from './GeoArc';
import { formatAngle } from '../core/Options';

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
    const s = formatAngle(this._startAngle, this.kernel.getOptions());
    const e = formatAngle(this._endAngle, this.kernel.getOptions());
    const typeName = this._partType === CONIC_PART_SECTOR ? '扇形' : this._partType === CONIC_PART_SEGMENT ? '弓形' : '弧';
    return `${this.label} : ${typeName} (角度 ${s}→${e}, r=${this.fmt(r)})`;
  }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const center = this.getCenter();
    const r = this.getRadius();
    const d = Math.hypot(PI.getX() - center.x, PI.getY() - center.y);
    if (Math.abs(d - r) > eps) return false;
    const a = Math.atan2(PI.getY() - center.y, PI.getX() - center.x);
    // 与渲染（Canvas anticlockwise）同一约定：ccw=true = 递减扫。
    // 此前这里的窗口按递增解释，与 drawConicPart/WebGL 画出的弧互补，
    // 命中、Intersect 过滤、PointOn 全部落在"看不见的一半"上。
    return angleInArcWindow(a, this._startAngle, this._endAngle, this._ccw, eps);
  }

  getMinParameter(): number { return this._startAngle; }
  getMaxParameter(): number { return this._endAngle; }

  createPathMover(): PathMover {
    return new ConicPartPathMover(this);
  }
}

class ConicPartPathMover implements PathMover {
  private t: number;
  private step: number;
  constructor(private part: GeoConicPart) {
    this.t = part.getStartAngle();
    // 沿扫向步进：ccw（递减扫）用负步长——此前恒正步进会把 ccw 弧走出扫窗
    this.step = part.isCounterClockwise() ? -0.05 : 0.05;
  }
  /** 当前步进方向（+1 递增 / −1 递减）上的终点角（数值连续，可跨 ±π）。 */
  private terminal(): number {
    const s = this.part.getStartAngle();
    const e = this.part.getEndAngle();
    const ccw = this.part.isCounterClockwise();
    const dir = Math.sign(this.step);
    // 扫窗在递增轴上：ccw=false → [s, e]；ccw=true → [e, s]
    let end: number;
    if (!ccw) end = dir > 0 ? e : s;
    else end = dir > 0 ? s : e;
    while (dir > 0 && end < this.t - 1e-12) end += 2 * Math.PI;
    while (dir < 0 && end > this.t + 1e-12) end -= 2 * Math.PI;
    return end;
  }
  getCurrentPosition(p: GeoPoint) {
    const c = this.part.getCenter();
    const r = this.part.getRadius();
    p.setCoords(c.x + r * Math.cos(this.t), c.y + r * Math.sin(this.t), 1);
  }
  getNext(p: GeoPoint): boolean {
    const end = this.terminal();
    const dir = Math.sign(this.step);
    const left = (end - this.t) * dir;
    if (left <= 1e-12) return false;
    // 最后一步精确落在终点，避免越出扫窗
    this.t = left <= Math.abs(this.step) ? end : this.t + this.step;
    this.getCurrentPosition(p);
    return true;
  }
  hasNext(): boolean {
    return (this.terminal() - this.t) * Math.sign(this.step) > 1e-12;
  }
  resetStartParameter(): void { this.t = this.part.getStartAngle(); }
  changeOrientation(): void { this.step *= -1; }
}

function circleCoeffs(h: number, k: number, r: number): number[] {
  return [1, 0, 1, -2 * h, -2 * k, h * h + k * k - r * r];
}
