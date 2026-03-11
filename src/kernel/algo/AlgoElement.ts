import { ConstructionElement } from '../core/ConstructionElement';
import { IKernel } from '../core/Interfaces';
import { GeoElement } from '../geo/GeoElement';

export abstract class AlgoElement extends ConstructionElement {
  protected input: GeoElement[] = [];
  protected output: GeoElement[] = [];

  constructor(kernel: IKernel) {
    super(kernel);
  }

  getInput(): GeoElement[] {
    return this.input;
  }

  abstract setInputOutput(): void;
  abstract compute(): void;

  getMinConstructionIndex(): number {
    const indices = this.input.map(i => i.constIndex).concat(this.constIndex);
    return Math.min(...indices);
  }

  getMaxConstructionIndex(): number {
    const indices = this.output.map(o => o.constIndex).concat(this.constIndex);
    return Math.max(...indices);
  }

  isIndependent(): boolean { return this.input.length === 0; }
  isGeoElement(): boolean { return false; }
  isAlgoElement(): boolean { return true; }
  getGeoElements(): GeoElement[] { return this.output; }

  getNameDescription(): string { return this.getClassName(); }
  getAlgebraDescription(): string { return this.getCommandDescription(); }
  getDefinitionDescription(): string { return this.getCommandDescription(); }
  getCommandDescription(): string {
    return `${this.getClassName()}(${this.input.map(i => i.getNameDescription()).join(',')})`;
  }

  getXML(): string {
    return `<algorithm id="${this.id}" type="${this.getClassName()}">
      ${this.input.map(i => `<input ref="${i.id}" />`).join('')}
      ${this.output.map(o => `<output ref="${o.id}" />`).join('')}
    </algorithm>`;
  }
  getI2G(mode: number): string { return `// I2G for ${this.id}`; }

  protected setOutput(outputs: GeoElement[]) {
    this.output = outputs;
    this.output.forEach(o => o.parentAlgo = this);
  }

  update(): void {
    // Usually input is updated by Geometry, so we just compute
    this.compute();
    this.output.forEach(o => o.update());
  }

  getClassName(): string { return this.constructor.name; }
}
