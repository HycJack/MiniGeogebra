import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoConic } from '../geo/GeoConic';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoIntersect extends AlgoElement {
  private outputPoints: GeoPoint[] = [];

  constructor(
    kernel: IKernel,
    private obj1: GeoElement,
    private obj2: GeoElement,
  ) {
    super(kernel);
    // Determine max number of intersection points
    let count = 0;
    if (obj1 instanceof GeoLine && obj2 instanceof GeoLine) count = 1;
    else if (obj1 instanceof GeoLine && obj2 instanceof GeoConic) count = 2;
    else if (obj1 instanceof GeoConic && obj2 instanceof GeoLine) count = 2;
    else if (obj1 instanceof GeoConic && obj2 instanceof GeoConic) count = 2; // Simplified, actually up to 4 for general conics, but 2 for circles

    const usedLabels = new Set<string>();
    for (let i = 0; i < count; i++) {
      const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
      const label = kernel.getConstruction().getNextPointLabel(usedLabels);
      usedLabels.add(label);
      p.label = label;
      this.outputPoints.push(p);
    }
    
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.obj1, this.obj2];
    this.setOutput(this.outputPoints);
  }

  compute(): void {
    // Reset points to undefined initially
    this.outputPoints.forEach(p => p.setUndefined());

    if (!this.obj1.isDefined() || !this.obj2.isDefined()) {
      return;
    }

    if (this.obj1 instanceof GeoLine && this.obj2 instanceof GeoLine) {
      this.intersectLineLine(this.obj1, this.obj2);
    } else if (this.obj1 instanceof GeoLine && this.obj2 instanceof GeoConic) {
      this.intersectLineConic(this.obj1, this.obj2);
    } else if (this.obj1 instanceof GeoConic && this.obj2 instanceof GeoLine) {
      this.intersectLineConic(this.obj2, this.obj1);
    } else if (this.obj1 instanceof GeoConic && this.obj2 instanceof GeoConic) {
      this.intersectConicConic(this.obj1, this.obj2);
    }
  }

  private intersectLineLine(l1: GeoLine, l2: GeoLine) {
    const det = l1.a * l2.b - l2.a * l1.b;
    if (Math.abs(det) < 1e-9) return; // Parallel

    const x = (l1.b * l2.c - l2.b * l1.c) / det;
    const y = (l1.c * l2.a - l2.c * l1.a) / det;
    
    const p = this.outputPoints[0];
    p.setCoords(x, y, 1);

    // Check if it's on the segments
    if (l1.getClassName() === 'GeoSegment' && !(l1 as any).isOnPath(p)) {
      p.setUndefined();
    }
    if (l2.getClassName() === 'GeoSegment' && !(l2 as any).isOnPath(p)) {
      p.setUndefined();
    }
  }

  private intersectLineConic(line: GeoLine, conic: GeoConic) {
    // Line: ax + by + c = 0
    // Conic: Ax^2 + Bxy + Cy^2 + Dx + Ey + F = 0
    
    // If b != 0, y = -(ax+c)/b. Substitute into conic.
    // If b == 0, x = -c/a. Substitute.
    
    const [A, B, C, D, E, F] = conic.coeffs;
    const { a, b, c } = line;
    
    let roots: {x: number, y: number}[] = [];

    if (Math.abs(b) > 1e-9) {
      // y = p x + q
      const p = -a / b;
      const q = -c / b;
      
      // A x^2 + B x (px+q) + C (px+q)^2 + D x + E (px+q) + F = 0
      // x^2 (A + Bp + Cp^2) + x (Bq + 2Cpq + D + Ep) + (Cq^2 + Eq + F) = 0
      
      const qa = A + B*p + C*p*p;
      const qb = B*q + 2*C*p*q + D + E*p;
      const qc = C*q*q + E*q + F;
      
      roots = this.solveQuadratic(qa, qb, qc).map(x => ({ x, y: p*x + q }));
    } else {
      // Vertical line x = -c/a
      const x = -c / a;
      // A x^2 + B x y + C y^2 + D x + E y + F = 0
      // C y^2 + y (Bx + E) + (Ax^2 + Dx + F) = 0
      
      const qa = C;
      const qb = B*x + E;
      const qc = A*x*x + D*x + F;
      
      roots = this.solveQuadratic(qa, qb, qc).map(y => ({ x, y }));
    }

    roots.forEach((pt, i) => {
      if (i < this.outputPoints.length) {
        const p = this.outputPoints[i];
        p.setCoords(pt.x, pt.y, 1);
        if (line.getClassName() === 'GeoSegment' && !(line as any).isOnPath(p)) {
          p.setUndefined();
        }
      }
    });
  }

  private intersectConicConic(c1: GeoConic, c2: GeoConic) {
    // Simplified for circles: subtract equations to get radical axis (line)
    // Then intersect line with c1.
    // Only works if A=C=1 and B=0 for both (circles).
    // General conic intersection is quartic, too complex for this snippet.
    // Assuming circles for now.
    
    const [A1, B1, C1, D1, E1, F1] = c1.coeffs;
    const [A2, B2, C2, D2, E2, F2] = c2.coeffs;
    
    // Check if circles
    if (Math.abs(B1) > 1e-9 || Math.abs(B2) > 1e-9) return; // Not handled
    
    // Normalize if A != 1
    // Assume A=C.
    
    // Radical axis: (D1/A1 - D2/A2)x + (E1/A1 - E2/A2)y + (F1/A1 - F2/A2) = 0
    // Let's assume A1=A2=1 for simplicity as our algorithms produce that.
    
    const a = D1 - D2;
    const b = E1 - E2;
    const c = F1 - F2;
    
    if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) return; // Concentric or same
    
    // Create a temporary line for radical axis
    const radicalLine = new GeoLine(this.kernel, a, b, c);
    this.intersectLineConic(radicalLine, c1);
  }

  private solveQuadratic(a: number, b: number, c: number): number[] {
    if (Math.abs(a) < 1e-9) {
      if (Math.abs(b) < 1e-9) return [];
      return [-c / b];
    }
    const delta = b*b - 4*a*c;
    if (delta < 0) return [];
    if (Math.abs(delta) < 1e-9) return [-b / (2*a)];
    const sqrtDelta = Math.sqrt(delta);
    return [(-b - sqrtDelta) / (2*a), (-b + sqrtDelta) / (2*a)];
  }

  getOutputPoints(): GeoPoint[] {
    return this.outputPoints;
  }
}
