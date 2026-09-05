import { IKernel, Transformable } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoVector } from '../geo/GeoVector';
import { buildTransformed } from './AlgoRotate';

export class AlgoTranslate extends AlgoElement {
  private outputGeo: GeoElement;

  constructor(
    kernel: IKernel,
    private inputGeo: GeoElement, // GeoElement implements Transformable
    private vector: GeoVector,
  ) {
    super(kernel);
    this.outputGeo = buildTransformed(kernel, inputGeo, 'translate', { vector: this.vector.getCoords() });
    // 输出可能是点/线/圆等；这里只用于构造后重命名，类型前缀不关键。
    this.outputGeo.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.inputGeo, this.vector];
    this.setOutput([this.outputGeo]);
  }

  compute(): void {
    this.outputGeo.setDefined();
  }
}
