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
    // 五点定圆锥：解 [x², xy, y², x, y, 1]·[A,B,C,D,E,F]ᵀ = 0 的零空间。
    // 不能固定 F=1 —— 过原点的圆锥曲线 F=0，固定归一化会把存在的曲线误判为无解。
    const mat: number[][] = [];
    for (let i = 0; i < 5; i++) {
      const x = this.pts[i].getX(), y = this.pts[i].getY();
      mat.push([x * x, x * y, y * y, x, y, 1]);
    }
    const sol = nullspaceOfRank5(mat);
    if (!sol) { this.outputConic.setUndefined(); return; }
    this.outputConic.coeffs = sol;
    this.outputConic.setDefined();
  }

  getOutput(): GeoConic { return this.outputConic; }
}

/**
 * 对 5×6 矩阵做高斯消元求一维零空间。
 * 秩恰为 5 时返回零空间向量（已做尺度归一化）；秩 < 5（退化构造，如多点共线）
 * 或消元失败时返回 null。
 */
function nullspaceOfRank5(mat: number[][]): number[] | null {
  const rows = 5, cols = 6;
  const aug = mat.map(row => [...row]);
  const pivotCols: number[] = [];
  let row = 0;
  for (let col = 0; col < cols && row < rows; col++) {
    let maxRow = row;
    for (let r = row + 1; r < rows; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
    }
    if (Math.abs(aug[maxRow][col]) < 1e-10) continue;
    [aug[row], aug[maxRow]] = [aug[maxRow], aug[row]];
    const pivot = aug[row][col];
    for (let j = 0; j < cols; j++) aug[row][j] /= pivot;
    for (let r = 0; r < rows; r++) {
      if (r === row) continue;
      const factor = aug[r][col];
      if (Math.abs(factor) < 1e-15) continue;
      for (let j = 0; j < cols; j++) aug[r][j] -= factor * aug[row][j];
    }
    pivotCols.push(col);
    row++;
  }
  if (pivotCols.length !== rows) return null; // 秩不足：退化构造
  const freeCols = [];
  for (let col = 0; col < cols; col++) {
    if (!pivotCols.includes(col)) freeCols.push(col);
  }
  if (freeCols.length !== 1) return null;
  const free = freeCols[0];
  const v = new Array(cols).fill(0);
  v[free] = 1;
  pivotCols.forEach((pc, i) => {
    v[pc] = -aug[i][free];
  });
  // 归一化到 |v|=1，避免系数整体尺度随输入漂移。
  const norm = Math.hypot(...v);
  if (!Number.isFinite(norm) || norm < 1e-12) return null;
  return v.map(c => c / norm);
}
