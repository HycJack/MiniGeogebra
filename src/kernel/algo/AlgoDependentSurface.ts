/**
 * Surface(x(u,v), y(u,v), z(u,v), u, u0, u1, v, v0, v1) 的算法壳。
 * 输入为表达式引用到的滑块；滑块变动时刷新 scope。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoSurface } from '../geo/GeoSurface';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';

export class AlgoDependentSurface extends AlgoElement {
  private outputSurface: GeoSurface;

  constructor(
    kernel: IKernel,
    xExpr: ExpressionNode,
    yExpr: ExpressionNode,
    zExpr: ExpressionNode,
    paramU: string,
    uMin: number,
    uMax: number,
    paramV: string,
    vMin: number,
    vMax: number,
    expressionTexts: { x: string; y: string; z: string },
    private dependencies: GeoNumeric[],
  ) {
    super(kernel);
    this.outputSurface = new GeoSurface(
      kernel, xExpr, yExpr, zExpr, paramU, uMin, uMax, paramV, vMin, vMax, expressionTexts);
    this.setInputOutput();
    this.compute();
  }

  setInputOutput(): void {
    this.input = [...this.dependencies];
    this.setOutput([this.outputSurface]);
  }

  compute(): void {
    const scope: Scope = new Map();
    this.dependencies.forEach((dependency, index) => {
      scope.set(dependency.label || `dep${index}`, dependency.getValue());
    });
    this.outputSurface.setScope(scope);
    this.outputSurface.setDefined();
  }

  getOutput(): GeoSurface { return this.outputSurface; }
  getDependencies(): GeoNumeric[] { return this.dependencies; }

  /** 重建命令文本（序列化用）。 */
  getCommandText(): string {
    const s = this.outputSurface;
    return `Surface(${s.expressionTexts.x}, ${s.expressionTexts.y}, ${s.expressionTexts.z}, ` +
      `${s.paramU}, ${s.uMin}, ${s.uMax}, ${s.paramV}, ${s.vMin}, ${s.vMax})`;
  }
}
