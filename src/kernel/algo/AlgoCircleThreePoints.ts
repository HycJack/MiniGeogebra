import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';

export class AlgoCircleThreePoints extends AlgoElement {
  private outputConic: GeoConic;

  constructor(
    kernel: IKernel,
    private p1: GeoPoint,
    private p2: GeoPoint,
    private p3: GeoPoint,
  ) {
    super(kernel);
    this.outputConic = new GeoConic(kernel, []);
    this.outputConic.label = kernel.getConstruction().getNextCircleLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2, this.p3];
    this.setOutput([this.outputConic]);
  }

  compute(): void {
    const x1 = this.p1.getX(), y1 = this.p1.getY();
    const x2 = this.p2.getX(), y2 = this.p2.getY();
    const x3 = this.p3.getX(), y3 = this.p3.getY();

    // 官方 AlgoCircleThreePoints.java:196-283 退化语义：
    //   A=B=C → 半径 0 点圆；恰两点重合/共线 → 无穷远圆心退化为直线（defined）。
    const dx12 = x2 - x1, dy12 = y2 - y1;
    const dx13 = x3 - x1, dy13 = y3 - y1;
    const d12 = Math.hypot(dx12, dy12);
    const d13 = Math.hypot(dx13, dy13);

    if (d12 === 0 && d13 === 0) {
      // 三点重合：点圆（半径 0）
      this.setCircle(x1, y1, 0);
      return;
    }

    // 共线判据用归一化叉积（相对量、尺度不变），替代此前绝对阈值 1e-9——
    // 边长 ~1e-5 的微小三角形叉积 ~1e-10 会被旧判据误判共线
    const cross = dx12 * dy13 - dx13 * dy12;
    const denom = d12 * d13;
    if (denom > 0 && Math.abs(cross) / denom < 1e-10) {
      // 共线/两点重合：退化为过两个互异点的直线
      this.setDegenerateLine(x1, y1, x2, y2, x3, y3, d12, d13);
      return;
    }

    // 三条中垂线选夹角最大（最良态）的一对求解（官方同款策略）。
    // 中垂线法向量 = 弦向量，常数项按各自弦的中点代入。
    const chords = [
      { nx: dx12, ny: dy12, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 },
      { nx: dx13, ny: dy13, mx: (x1 + x3) / 2, my: (y1 + y3) / 2 },
      { nx: x3 - x2, ny: y3 - y2, mx: (x2 + x3) / 2, my: (y2 + y3) / 2 },
    ];
    const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
    let best = pairs[0];
    let bestCond = -1;
    for (const [i, j] of pairs) {
      const cond = Math.abs(chords[i].nx * chords[j].ny - chords[j].nx * chords[i].ny);
      if (cond > bestCond) { bestCond = cond; best = [i, j]; }
    }
    const [i1, i2] = best;
    const n1 = chords[i1], n2 = chords[i2];

    const c1 = n1.nx * n1.mx + n1.ny * n1.my;
    const c2 = n2.nx * n2.mx + n2.ny * n2.my;

    const det = n1.nx * n2.ny - n2.nx * n1.ny;
    const cx = (n2.ny * c1 - n1.ny * c2) / det;
    const cy = (n1.nx * c2 - n2.nx * c1) / det;

    const r2 = (cx - x1) ** 2 + (cy - y1) ** 2;
    this.setCircle(cx, cy, Math.sqrt(Math.max(r2, 0)));
  }

  /** 写入圆方程 (x-cx)² + (y-cy)² = r²。 */
  private setCircle(cx: number, cy: number, r: number): void {
    this.outputConic.coeffs = [1, 0, 1, -2 * cx, -2 * cy, cx * cx + cy * cy - r * r];
    this.outputConic.setDefined();
  }

  /** 退化为过互异点对的直线（一对平行弦的"无穷远圆心"极限，官方语义 defined）。 */
  private setDegenerateLine(
    x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
    d12: number, d13: number,
  ): void {
    let px = x1, py = y1, qx = x2, qy = y2;
    if (d12 === 0) { px = x1; py = y1; qx = x3; qy = y3; }       // p1=p2 → 线 p1p3
    else if (d13 === 0) { px = x1; py = y1; qx = x2; qy = y2; }  // p1=p3 → 线 p1p2
    else { px = x1; py = y1; qx = x2; qy = y2; }                 // 三点互异共线 → 线 p1p2
    // 直线一般式：(qy-py)(x-px) - (qx-px)(y-py) = 0
    const a = qy - py;
    const b = -(qx - px);
    const c = -(a * px + b * py);
    this.outputConic.coeffs = [0, 0, 0, a, b, c];
    this.outputConic.setDefined();
  }

  getOutput(): GeoConic {
    return this.outputConic;
  }
}
