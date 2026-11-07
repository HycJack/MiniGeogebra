import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoVector } from '../geo/GeoVector';

export class AlgoOrthogonalLine extends AlgoElement {
  private outputLine: GeoLine;

  constructor(
    kernel: IKernel,
    private point: GeoPoint,
    /** 方向载体：直线或向量（官方 orthogonal() 与 parallel() 同构，:2533-2585） */
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

  /** 方向法向量 (a,b)：直线取系数；向量取 (dy, -dx)。 */
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

    // Line: ax + by + c = 0. Normal (a, b). Direction (-b, a).
    // Orthogonal line has normal (-b, a).
    // -bx + ay + c' = 0
    // c' = - (-b*x0 + a*y0) = b*x0 - a*y0

    const newA = -b;
    const newB = a;
    const newC = b * x0 - a * y0;

    this.outputLine.a = newA;
    this.outputLine.b = newB;
    this.outputLine.c = newC;
    this.outputLine.setDefined();
  }

  getOutput(): GeoLine {
    return this.outputLine;
  }
}
