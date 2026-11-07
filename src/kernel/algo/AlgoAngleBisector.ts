import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';

export class AlgoAngleBisector extends AlgoElement {
  private outputLine: GeoLine;

  constructor(
    kernel: IKernel,
    private A: GeoPoint,
    private B: GeoPoint, // Vertex
    private C: GeoPoint,
  ) {
    super(kernel);
    this.outputLine = new GeoLine(kernel, 0, 0, 0);
    this.outputLine.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.A, this.B, this.C];
    this.setOutput([this.outputLine]);
  }

  compute(): void {
    const bx = this.B.getX();
    const by = this.B.getY();

    // Vector BA
    const bax = this.A.getX() - bx;
    const bay = this.A.getY() - by;
    const lenBA = Math.hypot(bax, bay);

    // Vector BC
    const bcx = this.C.getX() - bx;
    const bcy = this.C.getY() - by;
    const lenBC = Math.hypot(bcx, bcy);

    if (lenBA < 1e-9 || lenBC < 1e-9) {
      // Undefined if points coincide
      this.outputLine.setUndefined();
      return;
    }

    // Normalized vectors
    const uX = bax / lenBA;
    const uY = bay / lenBA;
    const vX = bcx / lenBC;
    const vY = bcy / lenBC;

    // Bisector direction vector w = u + v
    const wX = uX + vX;
    const wY = uY + vY;

    // If w is zero (180 degree angle), bisector is perpendicular to BA
    // Normal vector is BA itself (or u)
    let nx, ny;

    if (Math.hypot(wX, wY) < 1e-9) {
       nx = uX;
       ny = uY;
    } else {
       // Normal to w is (-wY, wX)
       nx = -wY;
       ny = wX;
    }

    // Line through B with normal (nx, ny)
    // nx(x - bx) + ny(y - by) = 0
    const c = -(nx * bx + ny * by);

    this.outputLine.a = nx;
    this.outputLine.b = ny;
    this.outputLine.c = c;
    this.outputLine.setDefined();
  }

  getOutput(): GeoLine {
    return this.outputLine;
  }
}

/**
 * 两线角平分线（官方 CmdAngularBisector 两直线分支）：输出两条互相垂直的
 * 平分线。方向 = 归一化法向量之和/差：n = n1/|n1| ± n2/|n2|，过两线交点
 * （平行时无交点 → undefined）。
 */
export class AlgoAngleBisectorLines extends AlgoElement {
  private outputLines: GeoLine[];

  constructor(
    kernel: IKernel,
    private l1: GeoLine,
    private l2: GeoLine,
  ) {
    super(kernel);
    this.outputLines = [new GeoLine(kernel, 0, 0, 0), new GeoLine(kernel, 0, 0, 0)];
    for (const l of this.outputLines) {
      l.label = kernel.getConstruction().getNextLineLabel();
    }
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.l1, this.l2];
    this.setOutput(this.outputLines);
  }

  compute(): void {
    const len1 = Math.hypot(this.l1.a, this.l1.b);
    const len2 = Math.hypot(this.l2.a, this.l2.b);
    const det = this.l1.a * this.l2.b - this.l1.b * this.l2.a;
    if (len1 < 1e-12 || len2 < 1e-12 || Math.abs(det) < 1e-9 * len1 * len2) {
      // 平行线无角平分线（官方同语义 undefined）
      this.outputLines.forEach(l => l.setUndefined());
      return;
    }
    const n1x = this.l1.a / len1, n1y = this.l1.b / len1;
    const n2x = this.l2.a / len2, n2y = this.l2.b / len2;
    // 交点：克拉默解 n1·X = -c1、n2·X = -c2
    const x = (this.l2.c * this.l1.b - this.l1.c * this.l2.b) / det;
    const y = (this.l1.c * this.l2.a - this.l2.c * this.l1.a) / det;
    const dirs = [
      { a: n1x + n2x, b: n1y + n2y },
      { a: n1x - n2x, b: n1y - n2y },
    ];
    this.outputLines.forEach((l, i) => {
      const { a, b } = dirs[i];
      if (Math.hypot(a, b) < 1e-12) { l.setUndefined(); return; }
      l.a = a;
      l.b = b;
      l.c = -(a * x + b * y);
      l.setDefined();
    });
  }

  getOutputLines(): GeoLine[] { return this.outputLines; }
}
