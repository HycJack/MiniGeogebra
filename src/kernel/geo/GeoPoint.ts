import { IKernel, PathMover } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoNumeric } from './GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoPoint extends GeoElement {
  constructor(kernel: IKernel, coords: GeoVec3D) {
    super(kernel, coords);
  }

  getClassName() { return 'GeoPoint'; }

  /**
   * 路径/区域上的约束点可动画（B7，对标 GeoGebra 路径点动画）：
   * 动画实际驱动 parentAlgo 的参数滑块（GeoNumeric），点随参数沿路径移动。
   * 自由点不可动画。
   */
  isAnimatable(): boolean {
    return this.parentAlgo?.getInput().some(i => i instanceof GeoNumeric) ?? false;
  }

  doAnimationStep(frameRate: number): boolean {
    const driver = this.parentAlgo?.getInput().find((i): i is GeoNumeric => i instanceof GeoNumeric);
    if (!driver) return false;
    return driver.doAnimationStep(frameRate);
  }

  // ---- P2-1: 默认样式（绘制层 fallback）----
  public get defaultStrokeColor(): string { return '#1d4ed8'; }

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
