import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoConic } from '../geo/GeoConic';
import { GeoVec3D } from '../core/GeoVec3D';

/**
 * 过定点作已知圆的切线 ——对标 GeoGebra `Tangent[Point, Circle]`。
 *
 * 输入：conic（圆，非一般圆锥）、pointP（圆外或圆上的点）
 * 输出：[切线 l1, 切线 l2, 切点 T1, 切点 T2]
 *   - 点在圆内：无实切线，全部置为 undefined；
 *   - 点在圆上：退化为一条切线（两输出重合为一个有效对），与尺规作图语义一致。
 *
 * 几何推导（标准结果）：
 *   d^2 = |P - C|^2；切点弦中点 M = C + (r^2/d^2)(P - C)；
 *   半弦长 h = r*sqrt(d^2-r^2)/d；垂直单位向量 v = (-(py-cy), px-cx)/d；
 *   切点 T = M +/- h*v。由相似三角形 ~ 保证 |CT|=r 且 CT ⟂ PT。
 */
export class AlgoTangent extends AlgoElement {
  private readonly outputLines: GeoLine[] = [];
  private readonly outputPoints: GeoPoint[] = [];

  constructor(kernel: IKernel, private conic: GeoConic, private pointP: GeoPoint) {
    super(kernel);
    const usedLabelsL = new Set<string>();
    const usedLabelsP = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const l = new GeoLine(kernel, 0, 0, 0);
      l.label = kernel.getConstruction().getNextLineLabel(usedLabelsL);
      this.outputLines.push(l);
      const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
      p.label = kernel.getConstruction().getNextPointLabel(usedLabelsP);
      this.outputPoints.push(p);
    }
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.conic, this.pointP];
    this.setOutput([...this.outputLines, ...this.outputPoints]);
  }

  compute(): void {
    this.outputLines.forEach(l => l.setUndefined());
    this.outputPoints.forEach(p => p.setUndefined());

    if (!this.conic.isDefined() || !this.pointP.isDefined()) {
      return;
    }

    const [A, B, C, D, E, F] = this.conic.coeffs;
    // 仅处理"圆"：B=0 且 A=C≠0
    if (Math.abs(B) > 1e-9 || Math.abs(A - C) > 1e-9 || Math.abs(A) < 1e-9) {
      return;
    }

    const cx = -D / (2 * A);
    const cy = -E / (2 * A);
    const r2 = cx * cx + cy * cy - F / A;
    if (r2 <= 0) return;
    const r = Math.sqrt(r2);

    const px = this.pointP.getX();
    const py = this.pointP.getY();
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2);

    if (d < r - 1e-9) {
      return; // 点在圆内，无实切线
    }

    // 切点弦中点 M = C + (r^2/d^2)(P - C)
    const factor = r2 / d2;
    const mx = cx + factor * dx;
    const my = cy + factor * dy;

    // 半弦长 h = r*sqrt(d^2 - r^2)/d ；点在圆上时 h -> 0（退化）
    const h = d <= 1e-12 ? 0 : (r * Math.sqrt(Math.max(0, d2 - r2))) / d;

    // 垂直单位向量 v = (-dy/d, dx/d)
    const vx = -dy / d;
    const vy = dx / d;

    const t1x = mx + h * vx;
    const t1y = my + h * vy;
    const t2x = mx - h * vx;
    const t2y = my - h * vy;

    const degenerate = h < 1e-9;

    const setLineThrough = (l: GeoLine, x1: number, y1: number, x2: number, y2: number) => {
      const a = y1 - y2;
      const b = x2 - x1;
      const c = -(a * x1 + b * y1);
      l.a = a; l.b = b; l.c = c;
      l.setDefined();
    };

    setLineThrough(this.outputLines[0], px, py, t1x, t1y);
    this.outputPoints[0].setCoords(t1x, t1y, 1);

    if (!degenerate) {
      setLineThrough(this.outputLines[1], px, py, t2x, t2y);
      this.outputPoints[1].setCoords(t2x, t2y, 1);
    }
  }

  getOutputLines(): GeoLine[] {
    return this.outputLines;
  }

  getOutputPoints(): GeoPoint[] {
    return this.outputPoints;
  }
}
