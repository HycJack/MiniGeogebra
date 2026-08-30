import { IKernel, PathMover } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoPoint extends GeoElement {
  constructor(kernel: IKernel, coords: GeoVec3D) {
    super(kernel, coords);
  }

  getClassName() { return 'GeoPoint'; }

  getX(): number { return this.coords.x / this.coords.z; }
  getY(): number { return this.coords.y / this.coords.z; }
  getZ(): number { return this.coords.z; }

  /** 代数描述：坐标形式 (x, y)，保留 2 位小数 */
  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} = (${this.getX().toFixed(2)} | ${this.getY().toFixed(2)})`;
  }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const dx = this.getX() - PI.getX();
    const dy = this.getY() - PI.getY();
    return Math.hypot(dx, dy) < eps;
  }

  createPathMover(): PathMover {
    return new PointPathMover(this);
  }
}

class PointPathMover implements PathMover {
  constructor(private point: GeoPoint) {}

  getCurrentPosition(p: GeoPoint) {
    p.setCoords(this.point.getX(), this.point.getY(), this.point.getZ());
  }
  getNext(p: GeoPoint): boolean { this.getCurrentPosition(p); return false; }
  hasNext(): boolean { return false; }
  resetStartParameter(): void {}
  changeOrientation(): void {}
}
