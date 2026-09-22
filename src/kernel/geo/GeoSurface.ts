import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';

/** 参数曲面采样点。 */
export interface SurfaceSample { u: number; v: number; x: number; y: number; z: number }

/**
 * 参数曲面 —— 对标 GeoGebra GeoSurfaceCartesian3D：P(u,v) = (x(u,v), y(u,v), z(u,v))。
 * 提供解析求值与网格采样（渲染/截面用）。
 */
export class GeoSurface extends GeoElement {
  private scope: Scope = new Map();

  constructor(
    kernel: IKernel,
    public readonly xExpr: ExpressionNode,
    public readonly yExpr: ExpressionNode,
    public readonly zExpr: ExpressionNode,
    public readonly paramU: string,
    public readonly uMin: number,
    public readonly uMax: number,
    public readonly paramV: string,
    public readonly vMin: number,
    public readonly vMax: number,
    public readonly expressionTexts: { x: string; y: string; z: string } = { x: '', y: '', z: '' },
  ) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName(): string { return 'GeoSurface'; }

  get defaultStrokeColor(): string { return '#f59e0b'; }
  get defaultLineWidth(): number { return 1; }
  get defaultFillColor(): string { return 'rgba(245, 158, 11, 0.14)'; }

  setScope(scope: Scope): void {
    this.scope = scope;
  }

  private evalExpr(expr: ExpressionNode, u: number, v: number): number {
    const scope = new Map(this.scope);
    scope.set(this.paramU, u);
    scope.set(this.paramV, v);
    return evaluate(expr, scope);
  }

  evaluatePoint(u: number, v: number): { x: number; y: number; z: number } | null {
    const x = this.evalExpr(this.xExpr, u, v);
    const y = this.evalExpr(this.yExpr, u, v);
    const z = this.evalExpr(this.zExpr, u, v);
    return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
  }

  /** 均匀网格采样（跳过无定义点）。 */
  sampleGrid(uCount: number, vCount: number): SurfaceSample[] {
    const samples: SurfaceSample[] = [];
    for (let i = 0; i <= uCount; i++) {
      for (let j = 0; j <= vCount; j++) {
        const u = this.uMin + (this.uMax - this.uMin) * i / uCount;
        const v = this.vMin + (this.vMax - this.vMin) * j / vCount;
        const p = this.evaluatePoint(u, v);
        if (p) samples.push({ u, v, ...p });
      }
    }
    return samples;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} : Surface(${this.expressionTexts.x}, ${this.expressionTexts.y}, ${this.expressionTexts.z}, ${this.paramU}, …, ${this.paramV}, …)`;
  }
}
