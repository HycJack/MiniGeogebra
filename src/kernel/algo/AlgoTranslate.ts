import { IKernel, Transformable } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoVector } from '../geo/GeoVector';

export class AlgoTranslate extends AlgoElement {
  constructor(
    kernel: IKernel,
    private inputGeo: GeoElement, // GeoElement implements Transformable
    private vector: GeoVector,
  ) {
    super(kernel);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.inputGeo, this.vector];
    // In a real system, we would create a new GeoElement as output.
    // For simplicity, we modify the input in place or assume inputGeo is the output if it's a transformation of itself?
    // Usually, Translate(A, v) creates A'.
    // Here, let's assume we are modifying the inputGeo in place for this "mini" version, 
    // OR we should clone it.
    // The user's design said: "simplify: copy input to output, actually should clone".
    // Since we don't have clone() on GeoElement, we will just use inputGeo as output 
    // BUT this means the original object is moved. 
    // If we want to create a NEW object, we need a factory or clone method.
    // Let's stick to the user's design: "output = [this.inputGeo]".
    this.setOutput([this.inputGeo]);
  }

  compute(): void {
    this.inputGeo.translate(this.vector.getVector());
  }
}
