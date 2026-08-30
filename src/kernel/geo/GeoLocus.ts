import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';

/**
 * 轨迹对象（数值型）——对标 GeoGebra `Locus[Q, P]`。
 * 由一系列采样点按顺序连接而成；segments 记录因"跳跃"而断开的折线段区间，
 * 避免把不连续的两段误连成一条穿越线。
 */
export class GeoLocus extends GeoElement {
  constructor(
    kernel: IKernel,
    public samples: Array<{ x: number; y: number }>,
    public segments: Array<{ start: number; end: number }>
  ) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName() { return 'GeoLocus'; }

  getSamples(): Array<{ x: number; y: number }> { return this.samples; }
  getSegments(): Array<{ start: number; end: number }> { return this.segments; }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} : 轨迹（${this.samples.length} 个采样点）`;
  }
}
