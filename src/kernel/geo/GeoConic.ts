import { IKernel, Path, PathMover } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoPoint } from './GeoPoint';

export class GeoConic extends GeoElement implements Path {
  constructor(kernel: IKernel, public coeffs: number[]) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName() { return 'GeoConic'; }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    const x = PI.getX();
    const y = PI.getY();
    const [a, b, c, d, e, f] = this.coeffs;
    const val = a * x * x + b * x * y + c * y * y + d * x + e * y + f;
    return Math.abs(val) < eps;
  }

  getMinParameter(): number { return 0; }
  getMaxParameter(): number { return 2 * Math.PI; }

  createPathMover(): PathMover {
    return new ConicPathMover(this);
  }

  getCenter(): {x: number, y: number} {
    // For circle: x = -D/2A, y = -E/2A
    // Assuming A=C=1, B=0
    const [A, B, C, D, E, F] = this.coeffs;
    if (Math.abs(B) < 1e-9 && Math.abs(A - C) < 1e-9) {
      return { x: -D / (2 * A), y: -E / (2 * A) };
    }
    return { x: 0, y: 0 }; // Not implemented for general conic
  }

  translate(v: GeoVec3D): void {
    const dx = v.x;
    const dy = v.y;
    // Try to move parent points
    if (this.parentAlgo) {
      this.parentAlgo.getInput().forEach(el => {
        if (el instanceof GeoPoint && el.isIndependent()) {
          el.setCoords(el.getX() + dx, el.getY() + dy);
        }
      });
      this.parentAlgo.update();
    }
    this.update();
  }
  
  getRadius(): number {
    // r^2 = h^2 + k^2 - F/A
    const { x: h, y: k } = this.getCenter();
    const [A, B, C, D, E, F] = this.coeffs;
    const r2 = h * h + k * k - F / A;
    return r2 > 0 ? Math.sqrt(r2) : 0;
  }
}


class ConicPathMover implements PathMover {
  private t = 0;
  constructor(private conic: GeoConic) {}

  getCurrentPosition(_p: GeoPoint): void {/* 略 */}
  getNext(p: GeoPoint): boolean {
    this.t += 0.1;
    if (this.t > 2 * Math.PI) return false;
    this.getCurrentPosition(p);
    return true;
  }
  hasNext(): boolean { return this.t < 2 * Math.PI; }
  resetStartParameter(): void { this.t = 0; }
  changeOrientation(): void {/* 略 */}
}
