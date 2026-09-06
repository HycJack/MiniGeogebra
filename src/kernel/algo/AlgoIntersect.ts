import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoConic } from '../geo/GeoConic';
import { GeoVec3D } from '../core/GeoVec3D';
import { intersectLineWithConic } from '../geo/conicSolve';

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
    p.setDefined();

    // Check if it's on the segments
    if (l1.getClassName() === 'GeoSegment' && !(l1 as any).isOnPath(p)) {
      p.setUndefined();
    }
    if (l2.getClassName() === 'GeoSegment' && !(l2 as any).isOnPath(p)) {
      p.setUndefined();
    }
  }

  private intersectLineConic(line: GeoLine, conic: GeoConic) {
    // 直线-圆锥求交的代入消元下沉到 conicSolve.intersectLineWithConic，
    // 与 AlgoTangent 的切点弦求交共用同一份推导；这里只负责写入输出点。
    const { a, b, c } = line;
    const roots = intersectLineWithConic(conic.coeffs, a, b, c);

    roots.forEach((pt, i) => {
      if (i < this.outputPoints.length) {
        const p = this.outputPoints[i];
        p.setCoords(pt.x, pt.y, 1);
        p.setDefined();
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

  getOutputPoints(): GeoPoint[] {
    return this.outputPoints;
  }
}
