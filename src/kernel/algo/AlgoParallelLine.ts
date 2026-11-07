import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoVector } from '../geo/GeoVector';

export class AlgoParallelLine extends AlgoElement {
  private outputLine: GeoLine;

  constructor(
    kernel: IKernel,
    private point: GeoPoint,
    /** 方向载体：直线（用系数 a,b）或向量（用首尾端点，官方 parallel() 认向量，:2456-2508） */
    private line: GeoLine | GeoVector,
  ) {
    super(kernel);
    this.outputLine = new GeoLine(kernel, 0, 0, 0);
    this.outputLine.label = kernel.getConstruction().getNextLineLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.point, this.line];
    this.setOutput([this.outputLine]);
  }

  /** 方向法向量 (a,b)：直线取系数；向量取 (dy, -dx) 并归一化到线系数习惯。 */
  private normalAB(): { a: number; b: number } {
    if (this.line instanceof GeoVector) {
      return { a: this.line.endY - this.line.startY, b: -(this.line.endX - this.line.startX) };
    }
    return { a: this.line.a, b: this.line.b };
  }

  compute(): void {
    const x0 = this.point.getX();
    const y0 = this.point.getY();
    const { a, b } = this.normalAB();

    // Parallel line has same normal vector (a, b)
    // ax + by + c' = 0
    // c' = - (a*x0 + b*y0)
    const c = -(a * x0 + b * y0);

    this.outputLine.a = a;
    this.outputLine.b = b;
    this.outputLine.c = c;
    this.outputLine.setDefined();
  }

  getOutput(): GeoLine {
    return this.outputLine;
  }
}
