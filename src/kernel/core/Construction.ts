import { IKernel } from './Interfaces';
import { ConstructionElement } from './ConstructionElement';
import { AlgoElement } from '../algo/AlgoElement';
import { GeoElement } from '../geo/GeoElement';

/**
 * Construction 承载几何构造的“代数依赖图”。
 * 本次改造重点补上两个 GeoGebra/JSXGraph 式的关键能力：
 *   1. deleteElementWithDependents — 删除一个元素时，自动级联删除所有依赖它的对象；
 *   2. getDependentAlgorithms / isDependentOn — 精确依赖分析，供增量更新使用。
 */
export class Construction {
  private elements: ConstructionElement[] = [];
  private algoElements: AlgoElement[] = [];
  private stepCounter = 0;

  // P1-1: 显式正向依赖图 element -> 直接依赖它的算法集合
  private forwardDeps = new Map<ConstructionElement, Set<AlgoElement>>();

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
      this.registerForwardDeps(element);
    }
  }

  /**
   * P1-1: 为构造器登记正向依赖边 —— input GeoElement -> 该算法。
   */
  registerForwardDeps(algo: AlgoElement): void {
    for (const input of algo.getInput()) {
      let set = this.forwardDeps.get(input);
      if (!set) {
        set = new Set();
        this.forwardDeps.set(input, set);
      }
      set.add(algo);
    }
  }

  /** P1-1: 清理被删除元素在正向依赖图中的所有记录 */
  unregisterForwardDeps(element: ConstructionElement): void {
    this.forwardDeps.delete(element);
    for (const [, set] of this.forwardDeps.entries()) {
      set.delete(element as AlgoElement);
      if (set.size === 0) this.forwardDeps.delete(element);
    }
  }

  removeElement(element: ConstructionElement) {
    const idx = this.elements.indexOf(element);
    if (idx >= 0) this.elements.splice(idx, 1);

    if (element instanceof AlgoElement) {
      const aIdx = this.algoElements.indexOf(element);
      if (aIdx >= 0) this.algoElements.splice(aIdx, 1);
    }
    this.unregisterForwardDeps(element);
  }

  updateAllAlgorithms() {
    // 全场整理：仅在初始化 / 反序列化导入后调用。正常运行时由增量更新接管。
    this.algoElements.sort((a, b) => a.constIndex - b.constIndex);
    for (const algo of this.algoElements) {
      algo.update();
    }
  }

  updateDependentAlgorithms(changedElement: GeoElement) {
    const dependentAlgos = this.getForwardDependentAlgorithms(changedElement);
    dependentAlgos.sort((a, b) => a.constIndex - b.constIndex);
    for (const algo of dependentAlgos) {
      algo.update();
    }
  }

  /**
   * P1-1: 基于显式正向图的增量查询（O(受影响边数)）。
   */
  getForwardDependentAlgorithms(element: ConstructionElement): AlgoElement[] {
    const dependent = new Set<AlgoElement>();
    const queue: ConstructionElement[] = [];

    if (element.isAlgoElement()) {
      (element as AlgoElement).getGeoElements().forEach(g => queue.push(g));
    } else {
      queue.push(element);
    }

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const algos = this.forwardDeps.get(cur);
      if (algos) {
        for (const algo of algos) {
          if (!dependent.has(algo)) {
            dependent.add(algo);
            algo.getGeoElements().forEach(g => queue.push(g));
          }
        }
      }
    }
    return Array.from(dependent);
  }

  /**
   * 找出所有“输入（直接或通过 parentAlgo 间接）依赖 element”的算法。
   * 已改为可接收任意 ConstructionElement（点/线/算法都可作为依赖分析目标）。
   */
  getDependentAlgorithms(element: ConstructionElement): AlgoElement[] {
    const dependent = new Set<AlgoElement>();
    for (const algo of this.algoElements) {
      if (this.isDependentOn(algo, element)) {
        dependent.add(algo);
      }
    }
    return Array.from(dependent);
  }

  /** 判断 algo 是否（直接/间接）依赖于 target */
  isDependentOn(algo: AlgoElement, target: ConstructionElement): boolean {
    const inputs = algo.getInput();
    for (const input of inputs) {
      if (input === target) return true;
      // 递归：若输入是某算法的输出，继续追溯
      if (input.parentAlgo && this.isDependentOn(input.parentAlgo, target)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 删除 target，并级联删除所有直接或间接依赖它的构造元素（含算法及其输出）。
   * 删除顺序按 constIndex 逆序，保证先删下游、再删上游。
   * 这是 GeoGebra removeObject() 的简化等价实现。
   */
  /**
   * 返回删除 target 时会被一并删除的元素集合（含 target 自身），但不实际删除。
   * 供视图层记录“可撤销快照”使用。
   */
  collectDeletionCascade(target: ConstructionElement): ConstructionElement[] {
    const toDelete = new Set<ConstructionElement>([target]);
    const queue: ConstructionElement[] = [target];

    const enqueue = (el: ConstructionElement) => {
      if (!toDelete.has(el)) {
        toDelete.add(el);
        queue.push(el);
      }
    };

    while (queue.length > 0) {
      const cur = queue.shift()!;

      // 1) 若 cur 是某算法的输出 → 该算法也失去存在意义
      if (cur instanceof GeoElement && cur.parentAlgo) {
        enqueue(cur.parentAlgo);
      }

      // 2) 收集所有依赖 cur 的算法及其全部输出（用正向图 O(k) 替代全量扫描）
      for (const algo of this.getForwardDependentAlgorithms(cur)) {
        if (!toDelete.has(algo)) {
          enqueue(algo);
          for (const out of algo.getGeoElements()) {
            enqueue(out);
          }
        }
      }

      // 3) 若 cur 本身是算法 → 其输出几何对象一并删除
      if (cur instanceof AlgoElement) {
        for (const out of cur.getGeoElements()) {
          enqueue(out);
        }
      }
    }

    return Array.from(toDelete);
  }

  /**
   * 删除 target，并级联删除所有直接或间接依赖它的构造元素。
   * 删除顺序按 constIndex 逆序，保证先删下游、再删上游。
   * 这是 GeoGebra removeObject() 的简化等价实现。
   */
  deleteElementWithDependents(target: ConstructionElement): void {
    const cascade = this.collectDeletionCascade(target);
    const sorted = Array.from(cascade).sort((a, b) => b.constIndex - a.constIndex);
    for (const el of sorted) {
      this.removeElement(el);
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
    this.forwardDeps.clear();
  }

  getNextPointLabel(additionalLabels?: Set<string>): string {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter(l => l));
    if (additionalLabels) {
      additionalLabels.forEach(l => existingLabels.add(l));
    }
    let index = 0;
    while (true) {
      let label = '';
      const num = Math.floor(index / 26);
      const charCode = 65 + (index % 26);
      label = String.fromCharCode(charCode);
      if (num > 0) label += num;
      if (!existingLabels.has(label)) return label;
      index++;
    }
  }

  getNextLineLabel(additionalLabels?: Set<string>): string {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter(l => l));
    if (additionalLabels) additionalLabels.forEach(l => existingLabels.add(l));
    let index = 1;
    while (true) {
      const label = `l${index}`;
      if (!existingLabels.has(label)) return label;
      index++;
    }
  }

  getNextCircleLabel(additionalLabels?: Set<string>): string {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter(l => l));
    if (additionalLabels) additionalLabels.forEach(l => existingLabels.add(l));
    let index = 1;
    while (true) {
      const label = `c${index}`;
      if (!existingLabels.has(label)) return label;
      index++;
    }
  }

  getNextPolygonLabel(additionalLabels?: Set<string>): string {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter(l => l));
    if (additionalLabels) additionalLabels.forEach(l => existingLabels.add(l));
    let index = 1;
    while (true) {
      const label = `poly${index}`;
      if (!existingLabels.has(label)) return label;
      index++;
    }
  }

  getNextNumericLabel(additionalLabels?: Set<string>): string {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter(l => l));
    if (additionalLabels) additionalLabels.forEach(l => existingLabels.add(l));
    let index = 1;
    while (true) {
      const label = `t${index}`;
      if (!existingLabels.has(label)) return label;
      index++;
    }
  }
}
