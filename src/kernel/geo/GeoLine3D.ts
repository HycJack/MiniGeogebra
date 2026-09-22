import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';

/** 3D 直线/射线/线段 —— 对标 GeoGebra GeoCoordSys1D 族：origin + 方向 + 参数限界。 */
export class GeoLine3D extends GeoElement {
  /** 起点（w=1）与单位方向（w=0）。 */
  private origin: Coords4;
  private direction: Coords4;
  /** undefined = 无界直线；有限区间 = 线段/射线。 */
  private limits: { tMin: number; tMax: number } | null = null;

  constructor(kernel: IKernel, origin?: Coords4, direction?: Coords4) {
    super(kernel, new GeoVec3D(0, 0, 0));
    this.origin = origin ?? Coords4.origin();
    this.direction = direction ?? Coords4.fromDirection(1, 0, 0);
  }

  getClassName(): string { return 'GeoLine3D'; }

  get defaultStrokeColor(): string { return '#f59e0b'; }
  get defaultLineWidth(): number { return 2; }

  setGeometry(origin: Coords4, direction: Coords4, limits?: { tMin: number; tMax: number }): void {
    this.origin = origin;
    this.direction = direction.normalize();
    this.limits = limits ?? null;
  }

  setLimits(tMin: number, tMax: number): void {
    this.limits = { tMin, tMax };
  }

  getOrigin(): Coords4 { return this.origin; }
  getDirection(): Coords4 { return this.direction; }
  getLimits(): { tMin: number; tMax: number } | null { return this.limits; }

  /** 参数点 origin + t·direction（t 在限界内或直线时任意）。 */
  pointAt(t: number): Coords4 {
    return this.origin.add(this.direction.scale(t));
  }

  /** 求参数 t（origin + t·direction 与该点重合）；不共线返回 null。 */
  parameterOf(point: Coords4): number | null {
    const delta = point.toPoint().sub(this.origin);
    const d = this.direction;
    const t = delta.dot(d);
    const residual = delta.sub(d.scale(t)).norm();
    if (residual > 1e-7 * Math.max(1, delta.norm())) return null;
    return t;
  }

  contains(point: Coords4): boolean {
    if (this.limits) {
      const t = this.parameterOf(point);
      if (t === null) return false;
      return t >= this.limits.tMin - 1e-9 && t <= this.limits.tMax + 1e-9;
    }
    return this.parameterOf(point) !== null;
  }

  isParallelTo(other: GeoLine3D): boolean {
    return Math.abs(this.direction.cross(other.direction).norm()) < 1e-9;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const kind = this.limits
      ? (this.limits.tMin >= -1e-9 && this.limits.tMax >= 1 ? '线段' : '射线')
      : '直线';
    return `${this.label} : ${kind} (${this.origin.toString()} + t·(${this.direction.x}, ${this.direction.y}, ${this.direction.z}))`;
  }
}
