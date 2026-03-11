import { IKernel } from './Interfaces';
import type { Construction } from './Construction';
import { GeoElement } from '../geo/GeoElement';

export abstract class ConstructionElement {
  private static idCounter = 0;

  public id: string;
  public constIndex = -1;
  public construction: Construction | null = null;

  constructor(public kernel: IKernel) {
    this.id = `CE_${++ConstructionElement.idCounter}`;
  }

  abstract getMinConstructionIndex(): number;
  abstract getMaxConstructionIndex(): number;

  abstract isIndependent(): boolean;
  abstract isGeoElement(): boolean;
  abstract isAlgoElement(): boolean;

  abstract getGeoElements(): GeoElement[];

  abstract getNameDescription(): string;
  abstract getAlgebraDescription(): string;
  abstract getDefinitionDescription(): string;
  abstract getCommandDescription(): string;

  abstract getXML(): string;
  abstract getI2G(mode: number): string;

  abstract update(): void;
}
