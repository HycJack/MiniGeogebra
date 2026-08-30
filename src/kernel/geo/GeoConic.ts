import { IKernel, Path, PathMover } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoPoint } from './GeoPoint';

export class GeoConic extends GeoElement implements Path {
  // 一般二次曲线：A x² + B xy + C y² + D x + E y + F = 0
  constructor(kernel: IKernel, public coeffs: number[]) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName() { return 'GeoConic'; }

  /**
   * 代数描述：
   *   - 圆：(x - h)² + (y - k)² = r²
   *   - 一般圆锥：给出系数式与类型猜测
   */
  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const [A, B, C, D, E, F] = this.coeffs;

    const isCircle = Math.abs(B) < 1e-9 && Math.abs(A - C) < 1e-9 && Math.abs(A) > 1e-9;
    if (isCircle) {
      const { x: h, y: k } = this.getCenter();
      const r = this.getRadius();
      const hStr = Math.abs(h) < 1e-9 ? '' : h >= 0 ? `- ${h.toFixed(2)}` : `+ ${Math.abs(h).toFixed(2)}`;
      const kStr = Math.abs(k) < 1e-9 ? '' : k >= 0 ? `- ${k.toFixed(2)}` : `+ ${Math.abs(k).toFixed(2)}`;
      return `${this.label} : (x ${hStr})² + (y ${kStr})² = ${r.toFixed(2)}²`;
    }

    // 一般式
    const parts: string[] = [];
    if (Math.abs(A) > 1e-9) parts.push(`${A.toFixed(2)}x²`);
    if (Math.abs(B) > 1e-9) parts.push(`${B.toFixed(2)}xy`);
    if (Math.abs(C) > 1e-9) parts.push(`${C.toFixed(2)}y²`);
    if (Math.abs(D) > 1e-9) parts.push(`${D.toFixed(2)}x`);
    if (Math.abs(E) > 1e-9) parts.push(`${E.toFixed(2)}y`);
    if (Math.abs(F) > 1e-9) parts.push(`${F.toFixed(2)}`);
    let expr = parts.join(' + ').replace(/\+ -/g, '- ');
    if (expr === '') expr = '0';
    return `${this.label} : ${expr} = 0`;
  }

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

  getCenter(): { x: number; y: number } {
    const [A, B, C, D, E, F] = this.coeffs;
    if (Math.abs(B) < 1e-9 && Math.abs(A - C) < 1e-9) {
      return { x: -D / (2 * A), y: -E / (2 * A) };
    }
    return { x: 0, y: 0 };
  }

  translate(v: GeoVec3D): void {
    const dx = v.x;
    const dy = v.y;
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
    const { x: h, y: k } = this.getCenter();
    const [A, B, C, D, E, F] = this.coeffs;
    if (Math.abs(A) < 1e-9) return 0;
    const r2 = h * h + k * k - F / A;
    return r2 > 0 ? Math.sqrt(r2) : 0;
  }
}

class ConicPathMover implements PathMover {
  private t = 0;

  constructor(private conic: GeoConic) {}

  getCurrentPosition(p: GeoPoint) {
    const center = this.conic.getCenter();
    const r = this.conic.getRadius();
    p.setCoords(center.x + r * Math.cos(this.t), center.y + r * Math.sin(this.t), 1);
  }
  getNext(p: GeoPoint): boolean {
    if (this.t >= 2 * Math.PI) return false;
    this.t += 0.1;
    this.getCurrentPosition(p);
    return true;
  }
  hasNext(): boolean { return this.t < 2 * Math.PI; }
  resetStartParameter(): void { this.t = 0; }
  changeOrientation(): void { /* no-op */ }
}
