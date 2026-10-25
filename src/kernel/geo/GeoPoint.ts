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
   * 判定按 PointOnX / PointInX 算法家族收紧——此前"输入含 GeoNumeric"的启发式
   * 会把 Rotate(点, 角度滑块) 的输出点也判成可动画（官方语义是动画角度本身，
   * 不是旋转结果点）。自由点与一般变换点不可动画。
   */
  isAnimatable(): boolean {
    const name = this.parentAlgo?.getClassName() ?? '';
    return name.startsWith('AlgoPointOn') || name.startsWith('AlgoPointIn');
  }

  doAnimationStep(frameRate: number): boolean {
    if (!this.isAnimatable()) return false;
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
    return `${this.label} = (${this.fmt(this.getX())} | ${this.fmt(this.getY())})`;
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
