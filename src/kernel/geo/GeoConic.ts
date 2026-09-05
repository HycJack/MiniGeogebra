import { IKernel, Path, PathMover } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { GeoPoint } from './GeoPoint';

export type ConicType = 'circle' | 'ellipse' | 'hyperbola' | 'parabola' | 'degenerate';

export class GeoConic extends GeoElement implements Path {
  // 一般二次曲线：A x² + B xy + C y² + D x + E y + F = 0
  constructor(kernel: IKernel, public coeffs: number[]) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName() { return 'GeoConic'; }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    const [A, B, C, D, E, F] = this.coeffs;

    if (this.isCircle()) {
      const { x: h, y: k } = this.getCenter();
      const r = this.getRadius();
      const hStr = Math.abs(h) < 1e-9 ? '' : h >= 0 ? `- ${h.toFixed(2)}` : `+ ${Math.abs(h).toFixed(2)}`;
      const kStr = Math.abs(k) < 1e-9 ? '' : k >= 0 ? `- ${k.toFixed(2)}` : `+ ${Math.abs(k).toFixed(2)}`;
      return `${this.label} : (x ${hStr})² + (y ${kStr})² = ${r.toFixed(2)}²`;
    }

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

  /** General conic center formula (works for all conics with finite center). */
  getCenter(): { x: number; y: number } {
    const [A, B, C, D, E] = this.coeffs;
    const denom = 4 * A * C - B * B;
    if (Math.abs(denom) < 1e-12) {
      // Parabola — no finite center. Use vertex as anchor.
      return this.getVertex();
    }
    return {
      x: (B * E - 2 * C * D) / denom,
      y: (B * D - 2 * A * E) / denom,
    };
  }

  /** Vertex of parabola (also used as ray origin for sampling). */
  getVertex(): { x: number; y: number } {
    const [A, B, C, D, E, F] = this.coeffs;
    // Axis-aligned parabola: y² + Dx + Ey + F = 0 (A=0, B=0, C≠0)
    if (Math.abs(A) < 1e-12 && Math.abs(B) < 1e-12 && Math.abs(C) > 1e-12 && Math.abs(D) > 1e-12) {
      const yv = -E / (2 * C);
      const xv = (E * E - 4 * C * F) / (4 * C * D);
      return { x: xv, y: yv };
    }
    // Axis-aligned parabola: x² + Dx + Ey + F = 0 (C=0, B=0, A≠0)
    if (Math.abs(C) < 1e-12 && Math.abs(B) < 1e-12 && Math.abs(A) > 1e-12 && Math.abs(E) > 1e-12) {
      const xv = -D / (2 * A);
      const yv = (D * D - 4 * A * F) / (4 * A * E);
      return { x: xv, y: yv };
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

  /** Get radius — only meaningful for circles. */
  getRadius(): number {
    const { x: h, y: k } = this.getCenter();
    const [A, B, C, D, E, F] = this.coeffs;
    if (this.isCircle()) {
      const Fc = A * h * h + C * k * k + D * h + E * k + F;
      const r2 = -Fc / A;
      return r2 > 0 ? Math.sqrt(r2) : 0;
    }
    return this.getApproxRadius();
  }

  /** Approximate semi-major axis for non-circular conics. */
  getApproxRadius(): number {
    const [A, B, C, D, E, F] = this.coeffs;
    const { x: h, y: k } = this.getCenter();
    const Fc = A * h * h + B * h * k + C * k * k + D * h + E * k + F;
    if (Math.abs(Fc) < 1e-12) return 1;
    const trace = A + C;
    const det = A * C - (B * B) / 4;
    const disc = Math.max(0, trace * trace / 4 - det);
    const sqrtDisc = Math.sqrt(disc);
    const lambda1 = trace / 2 + sqrtDisc;
    const lambda2 = trace / 2 - sqrtDisc;
    const a1 = Math.abs(lambda1) > 1e-12 ? Math.sqrt(Math.abs(-Fc / lambda1)) : 1e6;
    const a2 = Math.abs(lambda2) > 1e-12 ? Math.sqrt(Math.abs(-Fc / lambda2)) : 1e6;
    return Math.max(a1, a2);
  }

  isCircle(): boolean {
    const [A, B, C] = this.coeffs;
    return Math.abs(B) < 1e-9 && Math.abs(A - C) < 1e-9 && Math.abs(A) > 1e-9;
  }

  getConicType(): ConicType {
    const [A, B, C] = this.coeffs;
    if (this.isCircle()) return 'circle';
    const disc = B * B - 4 * A * C;
    if (Math.abs(disc) < 1e-9) return 'parabola';
    if (disc < 0) return 'ellipse';
    return 'hyperbola';
  }

  /**
   * Sample points along the conic.
   * For centered conics: ray-casting from center.
   * For parabolas: parametric sampling along the axis direction.
   */
  samplePoints(nSamples = 360): { x: number; y: number }[] {
    const type = this.getConicType();
    if (type === 'parabola') return this.sampleParabola(nSamples);
    return this.sampleCentered(nSamples);
  }

  /** Ray-cast sampling for circle/ellipse/hyperbola. */
  private sampleCentered(nSamples: number): { x: number; y: number }[] {
    const [A, B, C, D, E, F] = this.coeffs;
    const { x: h, y: k } = this.getCenter();
    const allPts: { x: number; y: number; angle: number }[] = [];

    for (let i = 0; i < nSamples; i++) {
      const theta = (2 * Math.PI * i) / nSamples;
      const dx = Math.cos(theta);
      const dy = Math.sin(theta);
      const a = A * dx * dx + B * dx * dy + C * dy * dy;
      const b = 2 * A * h * dx + B * (h * dy + k * dx) + 2 * C * k * dy + D * dx + E * dy;
      const cVal = A * h * h + B * h * k + C * k * k + D * h + E * k + F;

      if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) > 1e-12) {
          const t = -cVal / b;
          if (t > 0) allPts.push({ x: h + t * dx, y: k + t * dy, angle: theta });
        }
        continue;
      }

      const disc = b * b - 4 * a * cVal;
      if (disc < -1e-9) continue;
      const sqrtDisc = Math.sqrt(Math.max(0, disc));
      const t1 = (-b + sqrtDisc) / (2 * a);
      const t2 = (-b - sqrtDisc) / (2 * a);
      if (t1 > 1e-6) allPts.push({ x: h + t1 * dx, y: k + t1 * dy, angle: theta });
      if (t2 > 1e-6) allPts.push({ x: h + t2 * dx, y: k + t2 * dy, angle: theta });
    }

    allPts.sort((p, q) => p.angle - q.angle);
    return allPts;
  }

  /** Parametric sampling for parabolas. */
  private sampleParabola(nSamples: number): { x: number; y: number }[] {
    const [A, B, C, D, E, F] = this.coeffs;
    const pts: { x: number; y: number }[] = [];
    const vertex = this.getVertex();

    // y² + Dx + Ey + F = 0 → parametrize by y
    if (Math.abs(A) < 1e-12 && Math.abs(B) < 1e-12 && Math.abs(C) > 1e-12 && Math.abs(D) > 1e-12) {
      // x = -(Cy² + Ey + F) / D
      const yCenter = vertex.y;
      // Estimate range: pick a range that covers the visible curve well
      const scale = Math.max(1, Math.abs(vertex.x)) * 2 + 20;
      const yRange = Math.sqrt(Math.abs(scale * D / C));
      for (let i = 0; i <= nSamples; i++) {
        const y = yCenter + (i / nSamples - 0.5) * 2 * yRange;
        const x = -(C * y * y + E * y + F) / D;
        pts.push({ x, y });
      }
      return pts;
    }

    // x² + Dx + Ey + F = 0 → parametrize by x
    if (Math.abs(C) < 1e-12 && Math.abs(B) < 1e-12 && Math.abs(A) > 1e-12 && Math.abs(E) > 1e-12) {
      // y = -(Ax² + Dx + F) / E
      const xCenter = vertex.x;
      const scale = Math.max(1, Math.abs(vertex.y)) * 2 + 20;
      const xRange = Math.sqrt(Math.abs(scale * E / A));
      for (let i = 0; i <= nSamples; i++) {
        const x = xCenter + (i / nSamples - 0.5) * 2 * xRange;
        const y = -(A * x * x + D * x + F) / E;
        pts.push({ x, y });
      }
      return pts;
    }

    // Rotated parabola or degenerate — fallback to ray-cast from vertex
    return this.sampleCenteredFrom(vertex.x, vertex.y, nSamples);
  }

  private sampleCenteredFrom(h: number, k: number, nSamples: number): { x: number; y: number }[] {
    const [A, B, C, D, E, F] = this.coeffs;
    const allPts: { x: number; y: number; angle: number }[] = [];
    for (let i = 0; i < nSamples; i++) {
      const theta = (2 * Math.PI * i) / nSamples;
      const dx = Math.cos(theta);
      const dy = Math.sin(theta);
      const a = A * dx * dx + B * dx * dy + C * dy * dy;
      const b = 2 * A * h * dx + B * (h * dy + k * dx) + 2 * C * k * dy + D * dx + E * dy;
      const cVal = A * h * h + B * h * k + C * k * k + D * h + E * k + F;
      if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) > 1e-12) {
          const t = -cVal / b;
          if (t > 0) allPts.push({ x: h + t * dx, y: k + t * dy, angle: theta });
        }
        continue;
      }
      const disc = b * b - 4 * a * cVal;
      if (disc < -1e-9) continue;
      const sqrtDisc = Math.sqrt(Math.max(0, disc));
      const t1 = (-b + sqrtDisc) / (2 * a);
      const t2 = (-b - sqrtDisc) / (2 * a);
      if (t1 > 1e-6) allPts.push({ x: h + t1 * dx, y: k + t1 * dy, angle: theta });
      if (t2 > 1e-6) allPts.push({ x: h + t2 * dx, y: k + t2 * dy, angle: theta });
    }
    allPts.sort((p, q) => p.angle - q.angle);
    return allPts;
  }
}

class ConicPathMover implements PathMover {
  private idx = 0;
  private points: { x: number; y: number }[] = [];

  constructor(private conic: GeoConic) {
    this.points = conic.samplePoints(180);
  }

  getCurrentPosition(p: GeoPoint) {
    if (this.points.length === 0) {
      const c = this.conic.getCenter();
      p.setCoords(c.x, c.y, 1);
      return;
    }
    const pt = this.points[this.idx % this.points.length];
    p.setCoords(pt.x, pt.y, 1);
  }
  getNext(p: GeoPoint): boolean {
    if (this.idx >= this.points.length) return false;
    this.idx++;
    this.getCurrentPosition(p);
    return true;
  }
  hasNext(): boolean { return this.idx < this.points.length; }
  resetStartParameter(): void { this.idx = 0; }
  changeOrientation(): void { this.points.reverse(); }
}
