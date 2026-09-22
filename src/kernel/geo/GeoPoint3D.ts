import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';

/**
 * 3D 点 —— 对标 GeoGebra GeoPoint3D / GeoVec4D。
 * 以 (x, y, z, 1) 齐次坐标存储；坐标读写走 getX/getY/getZ（自动处理 w）。
 */
export class GeoPoint3D extends GeoElement {
  private coords3: Coords4;

  constructor(kernel: IKernel, coords?: Coords4) {
    super(kernel, new GeoVec3D(0, 0, 0));
    this.coords3 = coords ?? Coords4.origin();
  }

  getClassName(): string { return 'GeoPoint3D'; }

  get defaultStrokeColor(): string { return '#0ea5e9'; }
  get defaultLineWidth(): number { return 1; }

  getX(): number { return this.coords3.getX(); }
  getY(): number { return this.coords3.getY(); }
  getZ(): number { return this.coords3.getZ(); }

  getCoords3(): Coords4 { return this.coords3; }

  setCoords(x: number, y: number, z: number): void {
    this.coords3 = Coords4.fromPoint(x, y, z);
  }

  translate(v: { x: number; y: number; z: number }): void {
    this.setCoords(this.getX() + v.x, this.getY() + v.y, this.getZ() + v.z);
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} = (${fmt(this.getX())}, ${fmt(this.getY())}, ${fmt(this.getZ())})`;
  }
}

function fmt(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : String(v);
}
