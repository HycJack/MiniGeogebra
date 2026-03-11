import { IKernel, Region } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoPoint } from './GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoPolygon extends GeoElement implements Region {
  constructor(kernel: IKernel, public vertices: GeoPoint[]) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName() { return 'GeoPolygon'; }

  isInRegion(P: GeoPoint): boolean {
    let inside = false;
    const x = P.getX();
    const y = P.getY();

    for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
      const xi = this.vertices[i].getX();
      const yi = this.vertices[i].getY();
      const xj = this.vertices[j].getX();
      const yj = this.vertices[j].getY();

      const intersect =
        (yi > y) !== (yj > y) &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  isInRegionXY(x0: number, y0: number): boolean {
    // We need a temporary point to check if it's in region
    // But creating a new GeoPoint requires kernel and might register it.
    // For now, we can just use a dummy object if we refactor isInRegion to take coordinates.
    // Or just create a temporary point without adding to construction.
    // Since we don't have a way to create unmanaged GeoPoint easily without kernel,
    // we will just implement logic directly or assume we can create one.
    // Actually, GeoPoint constructor calls super which calls ConstructionElement constructor which assigns ID.
    // It doesn't add to Construction automatically unless we call construction.add().
    // So it is safe to create a temporary point.
    return this.isInRegion(new GeoPoint(this.kernel, new GeoVec3D(x0, y0, 1)));
  }

  translate(v: GeoVec3D): void {
    const dx = v.x;
    const dy = v.y;
    this.vertices.forEach(vert => {
      if (vert.isIndependent()) {
        vert.setCoords(vert.getX() + dx, vert.getY() + dy);
      }
    });
    this.update();
  }
}
