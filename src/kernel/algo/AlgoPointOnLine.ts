import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoPointOnLine extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private line: GeoLine,
    private param: GeoNumeric
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.line, this.param];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    const t = this.param.getValue();
    
    // Find a point on the line
    let px = 0, py = 0;
    if (Math.abs(this.line.b) > 1e-9) {
        px = 0;
        py = -this.line.c / this.line.b;
    } else {
        px = -this.line.c / this.line.a;
        py = 0;
    }
    
    // Direction vector
    const dx = -this.line.b;
    const dy = this.line.a;
    
    // Normalize direction vector
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    
    const x = px + t * ux;
    const y = py + t * uy;
    
    this.outputPoint.setCoords(x, y, 1);
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }

  updateParameter(x: number, y: number): void {
    // Find closest point on line to (x, y)
    // Line equation: ax + by + c = 0
    // Direction vector: (dx, dy) = (-b, a)
    // Base point: (px, py)
    let px = 0, py = 0;
    if (Math.abs(this.line.b) > 1e-9) {
        px = 0;
        py = -this.line.c / this.line.b;
    } else {
        px = -this.line.c / this.line.a;
        py = 0;
    }
    
    const dx = -this.line.b;
    const dy = this.line.a;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    
    // Project (x - px, y - py) onto (ux, uy)
    const t = (x - px) * ux + (y - py) * uy;
    this.param.setValue(t);
  }
}
