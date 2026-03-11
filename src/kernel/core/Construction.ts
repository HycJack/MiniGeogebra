import { IKernel } from './Interfaces';
import { ConstructionElement } from './ConstructionElement';
import { AlgoElement } from '../algo/AlgoElement';
import { GeoElement } from '../geo/GeoElement';

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

  updateDependentAlgorithms(changedElement: GeoElement) {
    // 只更新依赖于changedElement的算法
    const dependentAlgos = this.getDependentAlgorithms(changedElement);
    
    // 按照构造顺序排序
    dependentAlgos.sort((a, b) => a.constIndex - b.constIndex);
    
    for (const algo of dependentAlgos) {
      algo.update();
    }
  }

  private getDependentAlgorithms(element: GeoElement): AlgoElement[] {
    const dependent = new Set<AlgoElement>();
    
    // 遍历所有算法，找出依赖于该元素的算法
    for (const algo of this.algoElements) {
      if (this.isDependentOn(algo, element)) {
        dependent.add(algo);
      }
    }
    
    return Array.from(dependent);
  }

  private isDependentOn(algo: AlgoElement, element: GeoElement): boolean {
    // 检查算法的输入是否包含该元素
    const inputs = algo.getInput();
    for (const input of inputs) {
      if (input === element) {
        return true;
      }
      // 递归检查：如果输入元素本身也是算法的输出，检查该算法是否依赖于element
      if (input.parentAlgo) {
        if (this.isDependentOn(input.parentAlgo, element)) {
          return true;
        }
      }
    }
    return false;
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
