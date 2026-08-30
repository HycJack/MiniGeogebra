import { ConstructionElement } from '../core/ConstructionElement';
import { IKernel, Path, Region, Transformable, PathMover } from '../core/Interfaces';
import { GeoVec3D } from '../core/GeoVec3D';
import type { GeoPoint } from './GeoPoint';
import type { GeoLine } from './GeoLine';
import type { AlgoElement } from '../algo/AlgoElement';

/**
 * 几何对象基类。本次改造强化了描述体系（对标 GeoGebra 代数区 / JSXGraph 信息面板）：
 *   - getAlgebraDescription()    ：对象的“代数长相”（如直线 y = 2x + 1、圆 (x-1)²+(y+2)² = 9）；
 *   - getDefinitionDescription() ：构造定义（如 “A = Point(2, 3)”、“l = Line(A, B)”）；
 *   - getCommandDescription()    ：命令形式（委托给 parentAlgo）。
 * 默认实现：若对象由算法派生，则定义描述委托给 parentAlgo；自由对象标注为“自由”。
 * 各子类负责覆写 getAlgebraDescription 给出可读的解析表达式。
 */
export abstract class GeoElement extends ConstructionElement
  implements Path, Region, Transformable {

  protected isDefined_ = true;
  public label = '';
  protected coords: GeoVec3D;
  public parentAlgo: AlgoElement | null = null;
  protected animating: boolean = false;

  constructor(kernel: IKernel, coords: GeoVec3D) {
    super(kernel);
    this.coords = coords;
  }

  // ConstructionElement
  getMinConstructionIndex(): number { return this.constIndex; }
  getMaxConstructionIndex(): number { return this.constIndex; }
  isIndependent(): boolean { return this.parentAlgo === null; }
  isGeoElement(): boolean { return true; }
  isAlgoElement(): boolean { return false; }
  getGeoElements(): GeoElement[] { return [this]; }

  isAnimatable(): boolean { return false; }
  isAnimating(): boolean { return this.animating; }

  setAnimating(flag: boolean) {
    const oldValue = this.animating;
    this.animating = flag && this.isAnimatable();
    if (oldValue !== this.animating) {
      const am = this.kernel.getAnimationManager();
      if (this.animating) am.addAnimatedGeo(this);
      else am.removeAnimatedGeo(this);
    }
  }

  getNameDescription(): string { return this.label || `GeoElement_${this.id}`; }

  /** 命令形式：优先委托给构造该对象的算法 */
  getCommandDescription(): string {
    return this.parentAlgo ? this.parentAlgo.getCommandDescription() : '';
  }

  /** 构造定义：派生对象显示 “标签 = Algorithm(输入)”；自由对象显示 “标签（自由）” */
  getDefinitionDescription(): string {
    if (this.parentAlgo) {
      return `${this.label} = ${this.parentAlgo.getCommandDescription()}`;
    }
    return `${this.label}（自由点）`;
  }

  /** 代数描述：由各子类给出可读的解析式（点坐标、直线方程、圆方程…） */
  getAlgebraDescription(): string {
    return this.getClassName();
  }

  getXML(): string {
    return `<element id="${this.id}" label="${this.label}" type="${this.getClassName()}">
      ${this.coords.getXML()}
    </element>`;
  }
  getI2G(mode: number): string { return `// I2G for ${this.id}`; }

  update() {
    this.kernel.notifyUpdate(this);
  }

  setCoords(x: number, y: number, z: number = 1) {
    this.coords.set(x, y, z);
    this.isDefined_ = true;
    this.update();
  }

  getCoords(): GeoVec3D { return this.coords; }

  isDefined(): boolean { return this.isDefined_; }
  setUndefined() { this.isDefined_ = false; this.update(); }
  setDefined() { this.isDefined_ = true; this.update(); }

  abstract getClassName(): string;

  // Path
  pointChanged(_PI: GeoPoint): void { this.update(); }
  pathChanged(_PI: GeoPoint): void { this.update(); }
  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const dx = this.coords.x - PI.getCoords().x;
    const dy = this.coords.y - PI.getCoords().y;
    return Math.hypot(dx, dy) < eps;
  }
  getMinParameter(): number { return 0; }
  getMaxParameter(): number { return 1; }
  isClosedPath(): boolean { return false; }
  createPathMover(): PathMover {
    throw new Error('Not implemented');
  }

  // Region
  pointChangedForRegion(_P: GeoPoint): void { this.update(); }
  regionChanged(_P: GeoPoint): void { this.update(); }
  isInRegion(_P: GeoPoint): boolean { return false; }
  isInRegionXY(_x0: number, _y0: number): boolean { return false; }

  // Transformable
  translate(_v: GeoVec3D): void { this.update(); }
  rotate(_angle: number, _center?: GeoPoint): void { this.update(); }
  dilate(_r: number, _center: GeoPoint): void { this.update(); }
  matrixTransform(_a00: number, _a01: number, _a10: number, _a11: number): void { this.update(); }
  mirror(_point?: GeoPoint, _line?: GeoLine): void { this.update(); }
}
