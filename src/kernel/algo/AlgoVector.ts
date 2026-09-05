import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoVector } from '../geo/GeoVector';

export class AlgoVector extends AlgoElement {
  private outputVec: GeoVector;

  constructor(kernel: IKernel, private p1: GeoPoint, private p2: GeoPoint) {
    super(kernel);
    this.outputVec = new GeoVector(kernel, p1.getX(), p1.getY(), p2.getX(), p2.getY());
    this.outputVec.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2];
    this.setOutput([this.outputVec]);
  }

  compute(): void {
    if (!this.p1.isDefined() || !this.p2.isDefined()) {
      this.outputVec.setUndefined();
      return;
    }
    this.outputVec.startX = this.p1.getX();
    this.outputVec.startY = this.p1.getY();
    this.outputVec.endX = this.p2.getX();
    this.outputVec.endY = this.p2.getY();
    this.outputVec.setCoords(this.outputVec.endX - this.outputVec.startX, this.outputVec.endY - this.outputVec.startY, 1);
    this.outputVec.setDefined();
  }

  getOutput(): GeoVector { return this.outputVec; }
}
