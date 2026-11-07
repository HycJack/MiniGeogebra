/**
 * FitPoly(P1, …, Pn, degree) —— 最小二乘多项式拟合（对标 GeoGebra CmdFitPoly）。
 *
 * 输入点全部注册为活依赖：移动任意点会自动重新拟合（GeoGebra 语义）。
 * 求解：先把 x 归一化到 t ∈ [−1,1]（中心化 + 半径缩放）再立法方程
 * (VᵀV)c = Vᵀy、部分主元高斯消元——幂基直接在原始 x 上病态
 * （x~1e4 起三次拟合残差放大 10 倍、四次完全灾难化，官方走 QR），
 * 归一化后把 t 基系数经二项式展开换回 x 基输出。
 * 数据点少于 degree+1 时自动降阶（保证方程组满秩）。
 * 输出 GeoFunction 的系数随依赖变化就地重建。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoFunction } from '../geo/GeoFunction';
import { ExpressionNode, polynomialAst, polynomialExpressionText } from '../algebra/Polynomial';

export class AlgoFitPoly extends AlgoElement {
  private outputFunction: GeoFunction;
  private points: GeoPoint[];
  private degree: number;

  constructor(kernel: IKernel, points: GeoPoint[], degree: number) {
    super(kernel);
    this.points = points;
    this.degree = Math.max(0, Math.round(degree));
    // 占位表达式；compute() 会按当前点位重建系数
    this.outputFunction = new GeoFunction(kernel, { kind: 'number', value: 0 }, 'x', '0');
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.points;
    this.setOutput([this.outputFunction]);
  }

  getOutput(): GeoFunction { return this.outputFunction; }

  getDegree(): number { return this.degree; }

  compute(): void {
    const m = this.points.length;
    if (m === 0) { this.outputFunction.setUndefined(); return; }
    // 数据点不足时降阶到 m-1（两点只能定一次式），避免法方程奇异
    const degree = Math.min(this.degree, m - 1);
    const size = degree + 1;

    // 归一化：t = (x − μ) / s，s 取最大绝对偏差（退化时回退 1）
    let mu = 0;
    for (const p of this.points) mu += p.getX();
    mu /= m;
    let s = 0;
    for (const p of this.points) s = Math.max(s, Math.abs(p.getX() - mu));
    if (!(s > 0) || !Number.isFinite(s)) s = 1;

    const ata: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    const atb: number[] = new Array(size).fill(0);
    for (const p of this.points) {
      const t = (p.getX() - mu) / s;
      const y = p.getY();
      let power = 1;
      const row: number[] = [];
      for (let j = 0; j < size; j++) {
        row.push(power);
        power *= t;
      }
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) ata[i][j] += row[i] * row[j];
        atb[i] += row[i] * y;
      }
    }

    const tCoeffs = solveLinear(ata, atb);
    if (!tCoeffs || tCoeffs.some(c => !Number.isFinite(c))) {
      this.outputFunction.setUndefined();
      return;
    }
    // t 基 → x 基：d_k·t^k = d_k·(x−μ)^k / s^k，按二项式展开合并
    const coeffs = new Array(size).fill(0);
    for (let k = 0; k < size; k++) {
      const scale = tCoeffs[k] / Math.pow(s, k);
      for (let j = 0; j <= k; j++) {
        coeffs[j] += scale * binomial(k, j) * Math.pow(-mu, k - j);
      }
    }
    this.outputFunction.setPolynomial(coeffs, 'x');
    this.outputFunction.setDefined();
  }
}

/** 二项式系数 C(k, j)。 */
function binomial(k: number, j: number): number {
  let r = 1;
  for (let i = 0; i < j; i++) r = r * (k - i) / (i + 1);
  return r;
}

/** 部分主元高斯消元解线性方程组；奇异返回 null。 */
export function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const aug = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivotRow][col])) pivotRow = r;
    }
    [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) return null;
    for (let j = col; j <= n; j++) aug[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (Math.abs(factor) < 1e-15) continue;
      for (let j = col; j <= n; j++) aug[r][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row[n]);
}
