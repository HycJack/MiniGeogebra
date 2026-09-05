import { IKernel } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { evaluate } from '../algebra/ExpressionEvaluator';
import { Scope } from '../algebra/ExpressionNode';
import { ExpressionNode } from '../algebra/ExpressionNode';

export class GeoFunction extends GeoElement {
  private scope: Scope = new Map();
  private samples: Array<{ x: number; y: number }> = [];
  private sampledRange: { minX: number; maxX: number; pixelWidth: number } | null = null;
  private samplesDirty = true;

  constructor(
    kernel: IKernel,
    public readonly expression: ExpressionNode,
    public readonly variableName: string,
    public readonly expressionText: string,
  ) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName(): string { return 'GeoFunction'; }

  get defaultStrokeColor(): string { return '#dc2626'; }
  get defaultLineWidth(): number { return 2; }

  setScope(scope: Scope): void {
    this.scope = scope;
    this.samplesDirty = true;
  }

  evaluateAt(x: number): number {
    const scope = new Map(this.scope);
    scope.set(this.variableName, x);
    return evaluate(this.expression, scope);
  }

  updateSamples(minX: number, maxX: number, pixelWidth: number): ReadonlyArray<{ x: number; y: number }> {
    if (
      !this.samplesDirty && this.sampledRange &&
      Math.abs(this.sampledRange.minX - minX) < 1e-9 &&
      Math.abs(this.sampledRange.maxX - maxX) < 1e-9 &&
      Math.abs(this.sampledRange.pixelWidth - pixelWidth) < 0.5
    ) return this.samples;

    const width = Math.max(0, maxX - minX);
    const count = Math.max(64, Math.min(1200, Math.ceil(pixelWidth / 2)));
    const step = width / count;
    this.samples = [];
    for (let i = 0; i <= count; i++) {
      const x = minX + step * i;
      const y = this.evaluateAt(x);
      this.samples.push({ x, y: Number.isFinite(y) && Math.abs(y) < 1e6 ? y : NaN });
    }
    this.sampledRange = { minX, maxX, pixelWidth };
    this.samplesDirty = false;
    return this.samples;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label}(${this.variableName}) = ${this.expressionText}`;
  }
}
