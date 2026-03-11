import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoPointOnConic extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private conic: GeoConic,
    private param: GeoNumeric
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.conic, this.param];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    const center = this.conic.getCenter();
    const r = this.conic.getRadius();
    const t = this.param.getValue();
    
    const x = center.x + r * Math.cos(t);
    const y = center.y + r * Math.sin(t);
    
    this.outputPoint.setCoords(x, y, 1);
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }

  updateParameter(x: number, y: number): void {
    const center = this.conic.getCenter();
    const angle = Math.atan2(y - center.y, x - center.x);
    // Normalize angle to [0, 2pi]
    const t = angle < 0 ? angle + 2 * Math.PI : angle;
    this.param.setValue(t);
  }
}
