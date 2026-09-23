/**
 * 一般二次曲面的方程算法壳 —— 对标 GeoGebra AlgoDependentQuadric3D。
 * 滑块变动时按 scope 重提 10 系数并 setMatrix + classify。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoQuadric3D } from '../geo/GeoQuadric3D';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';
import { extractQuadricCoeffs } from '../algebra/quadricCoeffs';
import { flatMatrixFromPolyCoeffs } from '../geo/quadricClassify';

export class AlgoDependentQuadric3D extends AlgoElement {
  private outputQuadric: GeoQuadric3D;

  constructor(
    kernel: IKernel,
    private lhs: ExpressionNode,
    private rhs: ExpressionNode,
    private expressionText: string,
    private dependencies: GeoNumeric[],
  ) {
    super(kernel);
    this.outputQuadric = new GeoQuadric3D(kernel, 'general');
    this.setInputOutput();
    this.compute();
  }

  setInputOutput(): void {
    this.input = [...this.dependencies];
    this.setOutput([this.outputQuadric]);
  }

  compute(): void {
    const scope: Scope = new Map();
    this.dependencies.forEach((dependency, index) => {
      scope.set(dependency.label || `dep${index}`, dependency.getValue());
    });
    const coeffs = extractQuadricCoeffs(this.lhs, this.rhs, scope);
    if (!coeffs) {
      this.outputQuadric.setUndefined();
      return;
    }
    this.outputQuadric.setMatrix(flatMatrixFromPolyCoeffs(
      coeffs[0], coeffs[1], coeffs[2], coeffs[3],
      coeffs[4], coeffs[5], coeffs[6],
      coeffs[7], coeffs[8], coeffs[9],
    ));
    this.outputQuadric.setDefined();
  }

  getOutput(): GeoQuadric3D { return this.outputQuadric; }
  getExpressionText(): string { return this.expressionText; }
  getDependencies(): GeoNumeric[] { return this.dependencies; }
}
