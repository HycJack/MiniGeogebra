import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoVector } from '../geo/GeoVector';
import { applyTransformed, buildTransformed } from './AlgoRotate';

/**
 * 平移算法。vector 可以是：
 *  - 活 GeoVector（注册为输入，向量端点/依赖变化时联动重算）；
 *  - 冻结的 {x, y} 分量（仅序列化 scalars 还原）。
 * 输出标签由调用方（addAlgoAndNotify / assignOutputLabels）按类型补，不再硬编码点标签。
 */
export class AlgoTranslate extends AlgoElement {
  private outputGeo: GeoElement;

  constructor(
    kernel: IKernel,
    private inputGeo: GeoElement,
    private vector: GeoVector | { x: number; y: number },
  ) {
    super(kernel);
    this.outputGeo = buildTransformed(kernel, inputGeo, 'translate', { vector: this.getVectorCoords() });
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.vector instanceof GeoVector
      ? [this.inputGeo, this.vector]
      : [this.inputGeo];
    this.setOutput([this.outputGeo]);
  }

  getOutput(): GeoElement { return this.outputGeo; }

  getVectorCoords(): { x: number; y: number } {
    return this.vector instanceof GeoVector
      ? { x: this.vector.endX - this.vector.startX, y: this.vector.endY - this.vector.startY }
      : this.vector;
  }

  /** 序列化：活向量走 inputs[1]，冻结分量走 scalars。 */
  isLiveVector(): boolean { return this.vector instanceof GeoVector; }

  compute(): void {
    applyTransformed(this.outputGeo, this.inputGeo, 'translate', { vector: this.getVectorCoords() });
    this.outputGeo.setDefined();
  }
}
