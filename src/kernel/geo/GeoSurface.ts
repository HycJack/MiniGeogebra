import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';

/** 参数曲面采样点。 */
export interface SurfaceSample { u: number; v: number; x: number; y: number; z: number }

/** 自定义求值器（旋转面等不便写成表达式 AST 的曲面）。 */
export type SurfaceEvaluator = (u: number, v: number) => { x: number; y: number; z: number } | null;

/**
 * 参数曲面 —— 对标 GeoGebra GeoSurfaceCartesian3D：P(u,v) = (x(u,v), y(u,v), z(u,v))。
 * 提供解析求值与网格采样（渲染/截面用）。
 * 旋转面走 setCustomEvaluator（表达式为占位零，evaluatePoint 优先走自定义路径）。
 */
export class GeoSurface extends GeoElement {
  private scope: Scope = new Map();
  private customEval: SurfaceEvaluator | null = null;

  constructor(
    kernel: IKernel,
    public readonly xExpr: ExpressionNode,
    public readonly yExpr: ExpressionNode,
    public readonly zExpr: ExpressionNode,
    public readonly paramU: string,
    public uMin: number,
    public uMax: number,
    public readonly paramV: string,
    public vMin: number,
    public vMax: number,
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

  /** 旋转面等非表达式曲面：设置后 evaluatePoint/sampleGrid 走该求值器。 */
  setCustomEvaluator(fn: SurfaceEvaluator | null): void {
    this.customEval = fn;
  }

  setIntervals(uMin: number, uMax: number, vMin: number, vMax: number): void {
    this.uMin = uMin;
    this.uMax = uMax;
    this.vMin = vMin;
    this.vMax = vMax;
  }

  private evalExpr(expr: ExpressionNode, u: number, v: number): number {
    const scope = new Map(this.scope);
    scope.set(this.paramU, u);
    scope.set(this.paramV, v);
    return evaluate(expr, scope);
  }

  evaluatePoint(u: number, v: number): { x: number; y: number; z: number } | null {
    if (this.customEval) return this.customEval(u, v);
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
