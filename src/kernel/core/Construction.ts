import { IKernel } from './Interfaces';
import { ConstructionElement } from './ConstructionElement';
import { AlgoElement } from '../algo/AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { collectAlgoExtras, rebuildAlgorithm, SerializedAlgorithm } from '../persistence/ConstructionSerializer';

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
  // 反向索引：algo -> 它登记过的输入集合。退订按索引只清自己的边，
  // 否则 unregisterForwardDeps 全 Map 扫描，删除级联退化为 O(N²)
  private algoInputs = new Map<AlgoElement, Set<ConstructionElement>>();

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
    this.unregisterAlgoEdges(algo); // 防重复登记留下旧边
    const inputs = new Set<ConstructionElement>();
    for (const input of algo.getInput()) {
      inputs.add(input);
      let set = this.forwardDeps.get(input);
      if (!set) {
        set = new Set();
        this.forwardDeps.set(input, set);
      }
      set.add(algo);
    }
    this.algoInputs.set(algo, inputs);
  }

  /** 清掉某算法登记的全部正向边（按反向索引，O(输入数)）。 */
  private unregisterAlgoEdges(algo: AlgoElement): void {
    const inputs = this.algoInputs.get(algo);
    if (!inputs) return;
    for (const input of inputs) {
      const set = this.forwardDeps.get(input);
      if (set) {
        set.delete(algo);
        if (set.size === 0) this.forwardDeps.delete(input);
      }
    }
    this.algoInputs.delete(algo);
  }

  /** P1-1: 清理被删除元素在正向依赖图中的所有记录 */
  unregisterForwardDeps(element: ConstructionElement): void {
    this.forwardDeps.delete(element);
    if (element instanceof AlgoElement) this.unregisterAlgoEdges(element);
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

  /**
   * 判断 algo 是否（直接/间接）依赖于 target。
   * visited 集合既剪掉钻石依赖的重复子树，也保证依赖图出现环时立即终止
   * 而非无限递归栈溢出（对应 GeoGebra 的 cycle 检测）。
   */
  isDependentOn(algo: AlgoElement, target: ConstructionElement): boolean {
    return this.traceDependency(algo, target, new Set());
  }

  private traceDependency(
    algo: AlgoElement,
    target: ConstructionElement,
    visited: Set<AlgoElement>,
  ): boolean {
    // 已在本次遍历中出现过：要么是真环，要么是已判定为“不依赖 target”的菱形分支，
    // 两种情况都可直接返回 false，不会漏报真实依赖。
    if (visited.has(algo)) return false;
    visited.add(algo);

    for (const input of algo.getInput()) {
      if (input === target) return true;
      // 递归：若输入是某算法的输出，继续追溯
      if (input.parentAlgo && this.traceDependency(input.parentAlgo, target, visited)) {
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

  /**
   * 重定义（对标 GeoGebra Construction.replace）：用 newGeo 换下 oldGeo——
   * 保标签、保依赖者（直接依赖算法的输入改接 newGeo 并重登记正向边）、
   * 保留原 constIndex 与数组位置（拓扑序不破坏）。
   * newAlgo：newGeo 若是新建算法的输出，随本方法登记（追加到构造末尾，
   * 调用方需在其后手动 newAlgo.update() + updateDependentAlgorithms(newGeo) 补一次定向重算，
   * 因为全量 pass 中旧依赖者的 constIndex 小于新算法，会先于新算法执行）。
   * oldGeo 原则上不能有 parentAlgo（依赖对象的替换由调用方先移除其算法——
   * 单输出算法场景见 redefineElement 流程）。
   */
  replaceElement(oldGeo: GeoElement, newGeo: GeoElement, newAlgo?: AlgoElement): void {
    // 直接持有 oldGeo 输入的算法：改接 newGeo 并重登记正向边
    const direct = this.getForwardDependentAlgorithms(oldGeo).filter(algo => algo.getInput().includes(oldGeo));
    for (const algo of direct) {
      algo.replaceInput(oldGeo, newGeo);
      this.unregisterAlgoEdges(algo);
      this.registerForwardDeps(algo);
    }
    const idx = this.elements.indexOf(oldGeo);
    const keepIndex = oldGeo.constIndex;
    this.removeElement(oldGeo);
    newGeo.label = oldGeo.label;
    if (idx >= 0) this.elements.splice(idx, 0, newGeo);
    else this.elements.push(newGeo);
    newGeo.construction = this;
    newGeo.constIndex = keepIndex;
    if (newAlgo) {
      newAlgo.construction = this;
      newAlgo.constIndex = this.stepCounter + 0.5; // 排在新对象之后、下一元素之前
      this.stepCounter = Math.ceil(newAlgo.constIndex);
      this.algoElements.push(newAlgo);
      this.registerForwardDeps(newAlgo);
    }
  }

  /**
   * 重定义的**构造段重建**（对标 GeoGebra 硬重定义路径 isGettingXMLForReplace）：
   * 算法把输入缓存在子类私有字段，仅换 input 数组无法让 compute 读到新对象，
   * 因此把 oldGeo 的全部传递依赖算法按 (类型, 输入, scalars/expressionText) 捕获后移除，
   * 经序列化器的 rebuildAlgorithm 工厂在 newGeo 之上原样重建（标签保留、按旧 constIndex
   * 解析输入引用）。newGeo 的定义若引用 oldGeo 本身属循环定义，调用方须先校验。
   */
  rebuildReplace(oldGeo: GeoElement, newGeo: GeoElement, newAlgo?: AlgoElement): void {
    const depAlgos = this.getForwardDependentAlgorithms(oldGeo)
      .sort((a, b) => a.constIndex - b.constIndex);

    // 捕获：SerializedAlgorithm 形态（inputs/outputIndices 用旧 constIndex，
    // 重建时经 index 映射回新对象——与反序列化同一套机制）
    const depOutputs = new Set<GeoElement>();
    for (const algo of depAlgos) algo.getGeoElements().forEach(o => depOutputs.add(o));
    const index = new Map<number, GeoElement>([[oldGeo.constIndex, newGeo]]);
    for (const algo of depAlgos) {
      for (const i of algo.getInput()) {
        if (i !== oldGeo && !depOutputs.has(i)) index.set(i.constIndex, i as GeoElement);
      }
    }
    const captured: SerializedAlgorithm[] = depAlgos.map(algo => ({
      type: algo.getClassName(),
      constIndex: algo.constIndex,
      inputs: algo.getInput().map(i => i.constIndex),
      outputLabels: algo.getGeoElements().map(o => o.label),
      outputIndices: algo.getGeoElements().map(o => o.constIndex),
      ...collectAlgoExtras(algo),
    }));

    // 逆序移除依赖算法及其输出；oldGeo 的依赖者随之清空
    for (let i = depAlgos.length - 1; i >= 0; i--) {
      for (const out of depAlgos[i].getGeoElements()) this.removeElement(out);
      this.removeElement(depAlgos[i]);
    }
    // 替换 oldGeo → newGeo（已无依赖者，保标签/位置/constIndex；newAlgo 一并登记）
    this.replaceElement(oldGeo, newGeo, newAlgo);
    // 依原拓扑序重建依赖算法（表达式类经 parseAlgebraInput、其余经 createAlgo）
    for (const sa of captured) {
      rebuildAlgorithm(this.kernel as Parameters<typeof rebuildAlgorithm>[0], this, index, sa);
    }
    this.updateAllAlgorithms();
  }

  /** 移除算法但保留其全部输出（重定义时换掉旧定义算法用；边随 unregister 清理）。 */
  removeAlgoKeepOutputs(algo: AlgoElement): void {
    const idx = this.elements.indexOf(algo);
    if (idx >= 0) this.elements.splice(idx, 1);
    const aIdx = this.algoElements.indexOf(algo);
    if (aIdx >= 0) this.algoElements.splice(aIdx, 1);
    this.unregisterForwardDeps(algo);
    if (algo.getGeoElements().length > 0) {
      for (const out of algo.getGeoElements()) out.parentAlgo = null;
    }
  }

  getElementById(id: string): ConstructionElement | undefined {
    return this.elements.find(e => e.id === id);
  }

  clear() {
    this.elements = [];
    this.algoElements = [];
    this.stepCounter = 0;
    this.forwardDeps.clear();
    this.algoInputs.clear();
  }

  // ------------------------------------------------------------------
  // 自动标签（对标 GeoGebra LabelType 字符表 + LabelManager 下标循环）
  // 序列：每类对象一张字符表，用尽后加 "_n" 后缀（A → … → Z → A_1 → B_1 → …）。
  // 点表跳过 X/Y（官方保留这两个字母给坐标轴变量）。
  // ------------------------------------------------------------------
  private static POINT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWZ'.split('');
  private static LINE_LETTERS = ['f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'a', 'b', 'c', 'd', 'e'];
  private static CONIC_LETTERS = ['c', 'd', 'e', 'f', 'g', 'h', 'k', 'p', 'q', 'r', 's', 't'];
  private static NUMERIC_LETTERS = 'abcdefghijklmnopqrstuvw'.split('');
  private static VECTOR_LETTERS = ['u', 'v', 'w', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  // 希腊小写（无 π）：角度默认标签
  private static ANGLE_LETTERS = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'];

  private collectLabels(additionalLabels?: Set<string>): Set<string> {
    const existingLabels = new Set(this.elements.map(e => (e as any).label).filter((l: string) => l));
    if (additionalLabels) additionalLabels.forEach(l => existingLabels.add(l));
    return existingLabels;
  }

  /** 从字符表取第一个可用标签；一轮用尽后加 "_n" 后缀继续。 */
  private nextLabelFrom(letters: string[], existing: Set<string>): string {
    for (let index = 0; ; index++) {
      const suffix = Math.floor(index / letters.length);
      const base = letters[index % letters.length];
      const label = suffix === 0 ? base : `${base}_${suffix}`;
      if (!existing.has(label)) return label;
    }
  }

  getNextPointLabel(additionalLabels?: Set<string>): string {
    return this.nextLabelFrom(Construction.POINT_LETTERS, this.collectLabels(additionalLabels));
  }

  getNextLineLabel(additionalLabels?: Set<string>): string {
    return this.nextLabelFrom(Construction.LINE_LETTERS, this.collectLabels(additionalLabels));
  }

  getNextCircleLabel(additionalLabels?: Set<string>): string {
    return this.nextLabelFrom(Construction.CONIC_LETTERS, this.collectLabels(additionalLabels));
  }

  getNextPolygonLabel(additionalLabels?: Set<string>): string {
    const existingLabels = this.collectLabels(additionalLabels);
    let index = 1;
    while (true) {
      const label = `poly${index}`;
      if (!existingLabels.has(label)) return label;
      index++;
    }
  }

  getNextNumericLabel(additionalLabels?: Set<string>): string {
    return this.nextLabelFrom(Construction.NUMERIC_LETTERS, this.collectLabels(additionalLabels));
  }

  getNextVectorLabel(additionalLabels?: Set<string>): string {
    return this.nextLabelFrom(Construction.VECTOR_LETTERS, this.collectLabels(additionalLabels));
  }

  getNextAngleLabel(additionalLabels?: Set<string>): string {
    return this.nextLabelFrom(Construction.ANGLE_LETTERS, this.collectLabels(additionalLabels));
  }

  getNextFunctionLabel(additionalLabels?: Set<string>): string {
    const existingLabels = this.collectLabels(additionalLabels);
    const labels = ['f', 'g', 'h', 'p', 'q', 'r', 's', 't'];
    let index = 0;
    while (true) {
      const suffix = Math.floor(index / labels.length);
      const label = suffix === 0
        ? labels[index % labels.length]
        : `${labels[index % labels.length]}_${suffix}`;
      if (!existingLabels.has(label)) return label;
      index++;
    }
  }
}
