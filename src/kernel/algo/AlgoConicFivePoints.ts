import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';

export class AlgoConicFivePoints extends AlgoElement {
  private outputConic: GeoConic;

  constructor(kernel: IKernel, private pts: GeoPoint[]) {
    super(kernel);
    this.outputConic = new GeoConic(kernel, [1, 0, 1, 0, 0, -1]);
    this.outputConic.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...this.pts];
    this.setOutput([this.outputConic]);
  }

  compute(): void {
    if (this.pts.length < 5 || this.pts.some(p => !p.isDefined())) {
      this.outputConic.setUndefined();
      return;
    }
    const mat: number[][] = [];
    const rhs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const x = this.pts[i].getX(), y = this.pts[i].getY();
      mat.push([x * x, x * y, y * y, x, y]);
      rhs.push(-1);
    }
    const sol = solve5x5(mat, rhs);
    if (!sol) { this.outputConic.setUndefined(); return; }
    const [A, B, C, D, E] = sol;
    (this.outputConic as any).coeffs = [A, B, C, D, E, 1];
    this.outputConic.setDefined();
  }

  getOutput(): GeoConic { return this.outputConic; }
}

function solve5x5(mat: number[][], rhs: number[]): number[] | null {
  const n = 5;
  const aug: number[][] = mat.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) return null;
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= aug[i][j] * x[j];
    x[i] /= aug[i][i];
  }
  return x;
}
