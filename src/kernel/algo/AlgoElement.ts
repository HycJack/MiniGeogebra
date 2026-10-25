import { ConstructionElement } from '../core/ConstructionElement';
import { IKernel } from '../core/Interfaces';
import { GeoElement } from '../geo/GeoElement';

/**
 * 算法（构造步骤）的抽象基类：一个 Algo 绑定若干输入几何元素与若干输出几何元素。
 *
 * 本次改造在 update() 顶层加入统一的 undefined 传播 guard：
 *   任一输入“未定义”（如两平行线无交点、三点共线无圆）时，
 *   所有输出自动置为 undefined，下游依赖链也随之置空——不再拿陈旧值继续算。
 * 这与 GeoGebra 的 “undef” 语义对齐。
 */
export abstract class AlgoElement extends ConstructionElement {
  protected input: GeoElement[] = [];
  protected output: GeoElement[] = [];
  public parentAlgo: AlgoElement | null = null;

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

  /**
   * 重定义支持：把输入中的 oldEl 原位替换为 newEl（依赖者改接新对象）。
   * 正向依赖边的重登记由 Construction.replaceElement 统一处理；更新也由
   * 调用方编排（先新对象、后依赖链）。
   */
  replaceInput(oldEl: GeoElement, newEl: GeoElement): void {
    this.input = this.input.map(i => (i === oldEl ? newEl : i));
  }
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

  /**
   * 标准更新管线：
   *   1. 若任一输入未定义 → 输出全部置 undefined，停止传播；
   *   2. 否则 compute() 重算几何量；
   *   3. 通知每个输出 element 继续向下通知其依赖（输出一般是派生点/线）。
   * 子类若需要在“输入未定义”时保留特殊行为，可覆盖此方法。
   *
   * 重入保护：compute() 内部若通过 recomputeDependents 等路径再次触发自身
   * （如 AlgoLocus 把 driver 注册为输入又主动重算 driver 的依赖链），
   * 直接忽略本次重入，避免无限递归栈溢出。
   */
  private updating = false;

  update(): void {
    if (this.updating) return;
    this.updating = true;
    try {
      if (this.input.some(i => !i.isDefined())) {
        this.output.forEach(o => o.setUndefined());
        return;
      }
      this.compute();
      this.output.forEach(o => o.update());
    } finally {
      this.updating = false;
    }
  }

  getClassName(): string { return this.constructor.name; }
}
