import { IKernel } from './Interfaces';
import { ConstructionElement } from './ConstructionElement';
import { AlgoElement } from '../algo/AlgoElement';

export class Construction {
  private elements: ConstructionElement[] = [];
  private algoElements: AlgoElement[] = [];
  private stepCounter = 0;

  constructor(public kernel: IKernel) {}

  addElement(element: ConstructionElement, index?: number) {
    this.stepCounter++;
    element.construction = this;
    element.constIndex = this.stepCounter;

    if (index !== undefined) {
      this.elements.splice(index, 0, element);
    } else {
      this.elements.push(element);
    }

    if (element instanceof AlgoElement) {
      this.algoElements.push(element);
    }
  }

  removeElement(element: ConstructionElement) {
    const idx = this.elements.indexOf(element);
    if (idx >= 0) this.elements.splice(idx, 1);

    if (element instanceof AlgoElement) {
      const aIdx = this.algoElements.indexOf(element);
      if (aIdx >= 0) this.algoElements.splice(aIdx, 1);
    }
  }

  updateAllAlgorithms() {
    // A simple topological sort or just iterating in order if they are added correctly
    // Since we add algos in order, usually iterating is fine for simple cases.
    // For complex dependencies, we might need a proper sort based on constIndex.
    this.algoElements.sort((a, b) => a.constIndex - b.constIndex);
    
    for (const algo of this.algoElements) {
      algo.update();
    }
  }

  getElements(): ConstructionElement[] {
    return [...this.elements];
  }

  getElementById(id: string): ConstructionElement | undefined {
    return this.elements.find(e => e.id === id);
  }
  
  clear() {
      this.elements = [];
      this.algoElements = [];
      this.stepCounter = 0;
  }

  getNextPointLabel(additionalLabels?: Set<string>): string {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter(l => l));
    if (additionalLabels) {
      additionalLabels.forEach(l => existingLabels.add(l));
    }
    let index = 0;
    while (true) {
      let label = '';
      let num = Math.floor(index / 26);
      let charCode = 65 + (index % 26);
      label = String.fromCharCode(charCode);
      if (num > 0) {
        label += num;
      }
      if (!existingLabels.has(label)) {
        return label;
      }
      index++;
    }
  }

  getNextLineLabel(additionalLabels?: Set<string>): string {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter(l => l));
    if (additionalLabels) {
      additionalLabels.forEach(l => existingLabels.add(l));
    }
    let index = 1;
    while (true) {
      let label = `l${index}`;
      if (!existingLabels.has(label)) {
        return label;
      }
      index++;
    }
  }

  getNextCircleLabel(additionalLabels?: Set<string>): string {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter(l => l));
    if (additionalLabels) {
      additionalLabels.forEach(l => existingLabels.add(l));
    }
    let index = 1;
    while (true) {
      let label = `c${index}`;
      if (!existingLabels.has(label)) {
        return label;
      }
      index++;
    }
  }

  getNextPolygonLabel(additionalLabels?: Set<string>): string {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter(l => l));
    if (additionalLabels) {
      additionalLabels.forEach(l => existingLabels.add(l));
    }
    let index = 1;
    while (true) {
      let label = `poly${index}`;
      if (!existingLabels.has(label)) {
        return label;
      }
      index++;
    }
  }
}
