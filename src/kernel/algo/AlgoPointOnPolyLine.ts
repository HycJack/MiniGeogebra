import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoPolyLine } from '../geo/GeoPolyLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';

/** A point constrained to a polyline. The numeric parameter is the edge index. */
export class AlgoPointOnPolyLine extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private polyLine: GeoPolyLine,
    private param: GeoNumeric
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.polyLine, this.param];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    const clamped = Math.max(
      0,
      Math.min(this.polyLine.vertices.length - 1, this.param.getValue())
    );
    const segment = Math.min(
      this.polyLine.vertices.length - 2,
      Math.floor(clamped)
    );
    const t = clamped - segment;
    const a = this.polyLine.vertices[segment];
    const b = this.polyLine.vertices[segment + 1];

    this.outputPoint.setCoords(
      a.getX() + t * (b.getX() - a.getX()),
      a.getY() + t * (b.getY() - a.getY()),
      1
    );
    this.outputPoint.setDefined();
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }

  updateParameter(x: number, y: number): void {
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestParameter = 0;

    for (let i = 1; i < this.polyLine.vertices.length; i++) {
      const a = this.polyLine.vertices[i - 1];
      const b = this.polyLine.vertices[i];
      const dx = b.getX() - a.getX();
      const dy = b.getY() - a.getY();
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared < 1e-12 ? 0 : Math.max(
        0,
        Math.min(1, ((x - a.getX()) * dx + (y - a.getY()) * dy) / lengthSquared)
      );
      const distance = Math.hypot(
        x - (a.getX() + t * dx),
        y - (a.getY() + t * dy)
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestParameter = i - 1 + t;
      }
    }

    this.param.setValue(bestParameter);
  }
}
