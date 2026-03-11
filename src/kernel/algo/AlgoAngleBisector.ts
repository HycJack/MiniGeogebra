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
  }

  getOutput(): GeoLine {
    return this.outputLine;
  }
}
