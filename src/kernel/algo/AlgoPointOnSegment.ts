import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoSegment } from '../geo/GeoSegment';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoPointOnSegment extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private segment: GeoSegment,
    private param: GeoNumeric
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.segment, this.param];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    const t = this.param.getValue();
    
    // t is between 0 and 1
    const sx = this.segment.startPoint.getX();
    const sy = this.segment.startPoint.getY();
    const ex = this.segment.endPoint.getX();
    const ey = this.segment.endPoint.getY();
    
    const x = sx + t * (ex - sx);
    const y = sy + t * (ey - sy);
    
    this.outputPoint.setCoords(x, y, 1);
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }

  updateParameter(x: number, y: number): void {
    const sx = this.segment.startPoint.getX();
    const sy = this.segment.startPoint.getY();
    const ex = this.segment.endPoint.getX();
    const ey = this.segment.endPoint.getY();
    
    const dx = ex - sx;
    const dy = ey - sy;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq < 1e-9) {
        this.param.setValue(0);
        return;
    }
    
    let t = ((x - sx) * dx + (y - sy) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // clamp to [0, 1]
    this.param.setValue(t);
  }
}
