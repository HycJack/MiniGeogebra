import { IKernel, LimitedPath } from '../core/Interfaces';
import { GeoLine } from './GeoLine';
import { GeoPoint } from './GeoPoint';

export class GeoSegment extends GeoLine implements LimitedPath {
  constructor(
    kernel: IKernel,
    public startPoint: GeoPoint,
    public endPoint: GeoPoint,
  ) {
    const dx = endPoint.getX() - startPoint.getX();
    const dy = endPoint.getY() - startPoint.getY();
    const a = -dy;
    const b = dx;
    const c = -a * startPoint.getX() - b * startPoint.getY();
    super(kernel, a, b, c);
  }

  getClassName() { return 'GeoSegment'; }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    if (!super.isOnPath(PI, eps)) return false;
    const t = this.getParameterForPoint(PI);
    const len = Math.hypot(this.endPoint.getX() - this.startPoint.getX(), this.endPoint.getY() - this.startPoint.getY());
    const tEps = len > 0 ? eps / len : eps;
    return t >= -tEps && t <= 1 + tEps;
  }

  getMinParameter(): number { return 0; }
  getMaxParameter(): number { return 1; }

  private getParameterForPoint(PI: GeoPoint): number {
    const sx = this.startPoint.getX();
    const sy = this.startPoint.getY();
    const ex = this.endPoint.getX();
    const ey = this.endPoint.getY();

    const dx = ex - sx;
    const dy = ey - sy;
    const dot = (PI.getX() - sx) * dx + (PI.getY() - sy) * dy;
    const len2 = dx * dx + dy * dy;
    return dot / len2;
  }
}
