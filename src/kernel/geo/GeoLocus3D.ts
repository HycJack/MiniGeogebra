import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';

/**
 * 3D 轨迹 —— 对标 GeoGebra `AlgoLocusND` 的输出 GeoLocus（ND 维采样）。
 * samples 为 (x, y, z) 序列；segments 记录因"跳跃"断开的折线区间。
 */
export class GeoLocus3D extends GeoElement {
  constructor(
    kernel: IKernel,
    public samples: Array<{ x: number; y: number; z: number }>,
    public segments: Array<{ start: number; end: number }>
  ) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName() { return 'GeoLocus3D'; }

  public get defaultStrokeColor(): string { return '#a855f7'; }

  getSamples(): Array<{ x: number; y: number; z: number }> { return this.samples; }
  getSegments(): Array<{ start: number; end: number }> { return this.segments; }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} : 3D 轨迹（${this.samples.length} 个采样点）`;
  }
}
