/**
 * 圆弧（Arc）—— 圆的指定起止角区间；fill 时绘制为扇形。
 * 对标 GeoGebra「圆弧」工具（圆心+圆上两点 / 圆心+起始终止角）。
 */

import { IKernel } from '../core/Interfaces';
import { GeoConic } from './GeoConic';
import { formatAngle } from '../core/Options';
import { GeoPoint } from './GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

const TWO_PI = 2 * Math.PI;
const mod2pi = (t: number): number => ((t % TWO_PI) % TWO_PI + TWO_PI) % TWO_PI;

/**
 * 弧的扫角（沿扫向的弧度数，∈[0,2π)）。
 * 统一约定（与 Canvas ctx.arc 的 anticlockwise、WebGL arcLines 一致）：
 * ccw=true = 从 start **递减**方向扫到 end；ccw=false = 递增方向。
 * GeoGebra 内部恒正定向（extent=(end−start) mod 2π），对外行为等价——
 * 生产端负责选好 (start, end, ccw) 使扫窗落在目标弧上。
 */
export function arcSweep(start: number, end: number, ccw: boolean): number {
  return ccw ? mod2pi(start - end) : mod2pi(end - start);
}

/** 角度 a 是否落在弧的扫窗内（eps 为弧度容差）。 */
export function angleInArcWindow(a: number, start: number, end: number, ccw: boolean, eps = 1e-9): boolean {
  const rel = ccw ? mod2pi(start - a) : mod2pi(a - start);
  return rel <= arcSweep(start, end, ccw) + eps;
}

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

  /** 原地更新圆弧几何（供依赖重算使用），保持对象身份以便下游引用不失效。 */
  setGeometry(center: { x: number; y: number }, radius: number, startAngle: number, endAngle: number, counterClockwise: boolean): void {
    this.coeffs = circleCoeffs(center.x, center.y, radius);
    this._startAngle = startAngle;
    this._endAngle = endAngle;
    this._ccw = counterClockwise;
  }

  getCenter(): { x: number; y: number } { return super.getCenter(); }
  getRadius(): number { return super.getRadius(); }

  /** 代数描述：圆弧 (A,B) / 角区间表示。 */
  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const { x: h, y: k } = this.getCenter();
    const r = this.getRadius();
    if (r <= 0) return `${this.label}（未定义）`;
    // 角度按 angleUnit 显示（弧度模式不带 °，此前无视该选项），数值走 rounding
    const s = formatAngle(this._startAngle, this.kernel.getOptions());
    const e = formatAngle(this._endAngle, this.kernel.getOptions());
    return `${this.label} : 弧 (角度 ${s}→${e}, r=${this.fmt(r)})`;
  }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const center = this.getCenter();
    const r = this.getRadius();
    const d = Math.hypot(PI.getX() - center.x, PI.getY() - center.y);
    if (Math.abs(d - r) > eps) return false;
    const a = Math.atan2(PI.getY() - center.y, PI.getX() - center.x);
    // 弧 = 从 start 沿扫向到 end 的窗口（与 Canvas ctx.arc、WebGL arcLines 同一约定；
    // ccw=true = 递减扫，rel 沿扫向度量——此前 ccw 分支 rel 仍按递增度量，窗口取反）
    return angleInArcWindow(a, this._startAngle, this._endAngle, this._ccw, eps);
  }

  getMinParameter(): number { return this._startAngle; }
  getMaxParameter(): number { return this._endAngle; }

  createPathMover(): any { return null; }
}

function circleCoeffs(h: number, k: number, r: number): number[] {
  return [1, 0, 1, -2 * h, -2 * k, h * h + k * k - r * r];
}
