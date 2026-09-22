/**
 * 列表对象（对标 GeoGebra GeoList 的轻量 v1）：
 * `{A, B, C}` 字面量与 `Root(f)` 等命令的多对象输出容器。
 *
 * v1 设计约定：
 *  - 子元素本身仍是构造中的独立成员（自由元素或算法输出），由主渲染/命中
 *    循环正常处理——GeoList 自身不重复绘制、不参与命中；
 *  - 代数视图与命令参数（FitPoly 等）经由 getChildren() 读取；
 *  - 子元素数量在创建时固定（GGB 的列表会动态重估，此处为已知简化，
 *    Root(f) 的每个根是独立派生点，根消失时该点位 undefined 而不是列表缩短）。
 */
import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoList extends GeoElement {
  private children: GeoElement[];

  constructor(kernel: IKernel, children: GeoElement[] = []) {
    super(kernel, new GeoVec3D(0, 0, 0));
    this.children = children;
  }

  getClassName(): string { return 'GeoList'; }

  getChildren(): GeoElement[] { return this.children; }

  setChildren(children: GeoElement[]): void {
    this.children = children;
  }

  isDefined(): boolean {
    return this.children.length > 0 && this.children.every(c => c.isDefined());
  }

  getAlgebraDescription(): string {
    const items = this.children.map(c => c.label || c.getAlgebraDescription()).join(', ');
    return `${this.label} = {${items}}`;
  }
}
