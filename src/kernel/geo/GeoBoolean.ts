/**
 * 布尔对象（对标 GeoGebra GeoBoolean）——复选框工具的内核载体。
 *
 * - 独立元素，值为 true/false，可被序列化、入 undo 栈、出现在代数视图；
 * - 持有关联对象标签列表（GeoGebra checkbox 的"显示/隐藏对象"联动）：
 *   setValue 时按标签查找并同步其 visible。
 */

import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoBoolean extends GeoElement {
  private value: boolean;

  /** 关联对象标签（复选框显隐联动；删除对象后失效标签在 setValue 时自动忽略）。 */
  public linkedLabels: string[] = [];

  constructor(kernel: IKernel, value = false) {
    super(kernel, new GeoVec3D(0, 0, 0));
    this.value = value;
  }

  getClassName(): string { return 'GeoBoolean'; }

  getValue(): boolean { return this.value; }

  setValue(v: boolean): void {
    this.value = v;
    const cons = this.kernel.getConstruction();
    for (const label of this.linkedLabels) {
      const linked = cons.getElements().find(el => (el as GeoElement).label === label) as GeoElement | undefined;
      if (linked) linked.visible = v;
    }
    this.update();
  }

  getAlgebraDescription(): string {
    return `${this.label} = ${this.value}`;
  }
}
