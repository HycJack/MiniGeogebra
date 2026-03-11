import { ConstructionElement } from '../core/ConstructionElement';
import { IKernel, Path, Region, Transformable, PathMover } from '../core/Interfaces';
import { GeoVec3D } from '../core/GeoVec3D';
import type { GeoPoint } from './GeoPoint';
import type { GeoLine } from './GeoLine';
import type { AlgoElement } from '../algo/AlgoElement';

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
      if (this.animating) {
        am.addAnimatedGeo(this);
      } else {
        am.removeAnimatedGeo(this);
      }
    }
  }

  getNameDescription(): string { return this.label || `GeoElement_${this.id}`; }
  getAlgebraDescription(): string { return 'GeoElement'; }
  getDefinitionDescription(): string { return 'GeoElement'; }
  getCommandDescription(): string { return ''; }

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
