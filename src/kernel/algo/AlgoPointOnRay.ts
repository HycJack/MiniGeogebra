/**
 * 射线上的参数点：t ≥ 0（距原点的弧长，单位 = 世界坐标），
 * 点 = 原点 + t·单位方向。对标 AlgoPointOnPath 对 GeoRay 的覆盖——
 * 此前工具/命令都放不了射线上的点（AlgoPointOnLine 的参数锚点是直线截距点，
 * 不保证落在射线一侧）。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoRay } from '../geo/GeoRay';
import { GeoNumeric } from '../geo/GeoNumeric';
import { PathAnimator } from '../core/PathAnimation';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoPointOnRay extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(kernel: IKernel, private ray: GeoRay, private param: GeoNumeric) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.ray, this.param];
    this.setOutput([this.outputPoint]);
  }

  /** 匀速动画通道（L6-5：弧长归一，官方 PathNormalizer 语义）。 */
  advancePathAnimation(frameRate: number): boolean {
    return this.pathAnimator.advance(frameRate);
  }

  getOutput(): GeoPoint { return this.outputPoint; }

  private pathAnimator = new PathAnimator(() => this.param, () => (() => {
      const sx = this.ray.startPoint.getX(), sy = this.ray.startPoint.getY();
      const dx = this.ray.secondPoint.getX() - sx, dy = this.ray.secondPoint.getY() - sy;
      const len = Math.hypot(dx, dy) || 1;
      return {
        tMin: 0,
        tMax: 50,
        pointAt: (t: number) => ({ x: sx + (t * dx) / len, y: sy + (t * dy) / len }),
        key: () => `${sx},${sy},${this.ray.secondPoint.getX()},${this.ray.secondPoint.getY()}`,
      };
    })());

  compute(): void {
    const t = Math.max(0, this.param.getValue());
    const sx = this.ray.startPoint.getX(), sy = this.ray.startPoint.getY();
    const ex = this.ray.secondPoint.getX(), ey = this.ray.secondPoint.getY();
    const dx = ex - sx, dy = ey - sy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) {
      this.outputPoint.setUndefined();
      return;
    }
    this.outputPoint.setCoords(sx + (t * dx) / len, sy + (t * dy) / len, 1);
    this.outputPoint.setDefined();
  }

  /** 拖拽反解：目标点向射线方向的投影弧长，负值夹回 0。 */
  updateParameter(x: number, y: number): void {
    const sx = this.ray.startPoint.getX(), sy = this.ray.startPoint.getY();
    const ex = this.ray.secondPoint.getX(), ey = this.ray.secondPoint.getY();
    const dx = ex - sx, dy = ey - sy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) {
      this.param.setValue(0);
      return;
    }
    const t = ((x - sx) * dx + (y - sy) * dy) / len;
    this.param.setValue(Math.max(0, t));
  }
}
