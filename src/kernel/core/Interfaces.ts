import { Construction } from './Construction';
import { ConstructionElement } from './ConstructionElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoVec3D } from './GeoVec3D';
import type { ViewOptions } from './Options';

export interface IKernel {
  notifyUpdate(element: ConstructionElement): void;
  /** 只通知视图刷新，不触发内核重算（动画循环每帧已自行增量重算依赖链）。 */
  notifyViewChanged(): void;
  getConstruction(): Construction;
  getAnimationManager(): any;
  /** 视图级选项（rounding / 角度单位 / 点捕捉）。 */
  getOptions(): ViewOptions;
  withBatchedUpdates<T>(fn: () => T): T;
  recomputeDependents(changedElement: ConstructionElement): void;
}

export interface IApplication {
  kernel: IKernel;
  updateView(): void;
}

export interface PathOrPoint {
  pointChanged(PI: GeoPoint): void;
  pathChanged(PI: GeoPoint): void;
  isOnPath(PI: GeoPoint, eps: number): boolean;
  getMinParameter(): number;
  getMaxParameter(): number;
  isClosedPath(): boolean;
  createPathMover(): PathMover;
}

export interface Path extends PathOrPoint {}

export interface PathMover {
  getCurrentPosition(p: GeoPoint): void;
  getNext(p: GeoPoint): boolean;
  hasNext(): boolean;
  resetStartParameter(): void;
  changeOrientation(): void;
}

export interface Region {
  pointChangedForRegion(P: GeoPoint): void;
  regionChanged(P: GeoPoint): void;
  isInRegion(P: GeoPoint): boolean;
  isInRegionXY(x0: number, y0: number): boolean;
}

export interface Transformable {
  translate(v: GeoVec3D): void;
  rotate(angle: number, center?: GeoPoint): void;
  dilate(r: number, center: GeoPoint): void;
  matrixTransform(a00: number, a01: number, a10: number, a11: number): void;
  mirror(point?: GeoPoint, line?: GeoLine): void;
}

export interface LimitedPath extends Path {
  allowOutlyingIntersections(): boolean;
  setAllowOutlyingIntersections(flag: boolean): void;
  isIntersectionPointIncident(P: GeoPoint, eps: number): boolean;
  keepsTypeOnGeometricTransform(): boolean;
  setKeepTypeOnGeometricTransform(flag: boolean): void;
}
