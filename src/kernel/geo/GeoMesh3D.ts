/**
 * 3D 三角/多边形网格 —— OFF 导入产物。
 *
 * 顶点 + 面索引的轻量表示（不走 A3-4 多面体拓扑）；渲染层按 faces
 * 生成填充与线框。自由独立元素，序列化直接存坐标与索引。
 */
import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';

export class GeoMesh3D extends GeoElement {
  public vertices: Coords4[] = [];
  /** 每个面为顶点下标数组（长度 ≥3，可为三角/四边/任意多边形）。 */
  public faces: number[][] = [];
  /** 可选面颜色（与 faces 等长时按面着色）。 */
  public faceColors: string[] | null = null;

  constructor(kernel: IKernel) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName(): string { return 'GeoMesh3D'; }

  get defaultStrokeColor(): string { return '#64748b'; }
  get defaultLineWidth(): number { return 1; }
  get defaultFillColor(): string { return 'rgba(100, 116, 139, 0.22)'; }

  setMesh(vertices: Coords4[], faces: number[][]): void {
    this.vertices = vertices.map(p => p.toPoint());
    this.faces = faces;
    if (vertices.length === 0 || faces.length === 0) this.setUndefined();
    else this.setDefined();
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} : 网格（${this.vertices.length} 顶点, ${this.faces.length} 面）`;
  }
}
