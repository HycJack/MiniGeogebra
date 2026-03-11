import { IKernel, Path, LimitedPath, PathMover } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoPoint } from './GeoPoint';

export class GeoLine extends GeoElement implements Path, LimitedPath {
  constructor(
    kernel: IKernel,
    public a: number,
    public b: number,
    public c: number,
  ) {
    super(kernel, new GeoVec3D(a, b, c));
  }

  getClassName() { return 'GeoLine'; }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const x = PI.getX(), y = PI.getY();
    const len = Math.hypot(this.a, this.b);
    if (len === 0) return false;
    return Math.abs(this.a * x + this.b * y + this.c) / len < eps;
  }

  getMinParameter(): number { return -Infinity; }
  getMaxParameter(): number { return Infinity; }

  createPathMover(): PathMover {
    return new LinePathMover(this);
  }

  // LimitedPath
  allowOutlyingIntersections(): boolean { return false; }
  setAllowOutlyingIntersections(_flag: boolean): void {}
  isIntersectionPointIncident(P: GeoPoint, eps: number): boolean {
    return this.isOnPath(P, eps);
  }
  keepsTypeOnGeometricTransform(): boolean { return true; }
  setKeepTypeOnGeometricTransform(_flag: boolean): void {}

  translate(v: GeoVec3D): void {
    this.c -= this.a * v.x + this.b * v.y;
    this.update();
  }
}

class LinePathMover implements PathMover {
  private t = 0;
  private step = 0.1;
  private maxT = 100;

  constructor(private line: GeoLine) {}

  getCurrentPosition(_p: GeoPoint) {/* 省略具体参数化 */}
  getNext(p: GeoPoint): boolean {
    if (this.t >= this.maxT) return false;
    this.t += this.step;
    this.getCurrentPosition(p);
    return true;
  }
  hasNext(): boolean { return this.t < this.maxT; }
  resetStartParameter(): void { this.t = 0; }
  changeOrientation(): void { this.step *= -1; }
}
