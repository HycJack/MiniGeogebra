import { IKernel, Path, PathMover } from '../core/Interfaces';
import { GeoElement } from './GeoElement';
import { GeoPoint } from './GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';

export class GeoPolyLine extends GeoElement implements Path {
  constructor(kernel: IKernel, public vertices: GeoPoint[]) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName() { return 'GeoPolyLine'; }

  public get defaultStrokeColor(): string { return '#000000'; }
  public get defaultLineWidth(): number { return 1; }

  getAlgebraDescription(): string {
    if (!this.isDefined() || this.vertices.length < 2) return `${this.label}（未定义）`;
    const labels = this.vertices.map(v => v.label || '?').join(', ');
    const len = this.getLength();
    return `${this.label} = 折线 [${labels}]（长度 ${len.toFixed(2)}）`;
  }

  getLength(): number {
    let len = 0;
    for (let i = 1; i < this.vertices.length; i++) {
      len += Math.hypot(
        this.vertices[i].getX() - this.vertices[i - 1].getX(),
        this.vertices[i].getY() - this.vertices[i - 1].getY()
      );
    }
    return len;
  }

  isOnPath(PI: GeoPoint, eps = 1e-6): boolean {
    for (let i = 1; i < this.vertices.length; i++) {
      const ax = this.vertices[i - 1].getX(), ay = this.vertices[i - 1].getY();
      const bx = this.vertices[i].getX(), by = this.vertices[i].getY();
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const t = ((PI.getX() - ax) * dx + (PI.getY() - ay) * dy) / len2;
      if (t < -eps || t > 1 + eps) continue;
      const cross = Math.abs(dx * (PI.getY() - ay) - dy * (PI.getX() - ax));
      if (cross < eps * Math.hypot(dx, dy)) return true;
    }
    return false;
  }

  getMinParameter(): number { return 0; }
  getMaxParameter(): number { return this.vertices.length - 1; }

  createPathMover(): PathMover {
    return new PolyLinePathMover(this);
  }

  translate(v: GeoVec3D): void {
    this.vertices.forEach(vert => {
      if (vert.isIndependent()) vert.setCoords(vert.getX() + v.x, vert.getY() + v.y);
    });
    this.update();
  }
}

class PolyLinePathMover implements PathMover {
  private segIdx = 0;
  private t = 0;
  private step = 0.05;
  constructor(private pl: GeoPolyLine) {}
  getCurrentPosition(p: GeoPoint) {
    const vs = this.pl.vertices;
    if (this.segIdx >= vs.length - 1) return;
    const a = vs[this.segIdx], b = vs[this.segIdx + 1];
    p.setCoords(a.getX() + this.t * (b.getX() - a.getX()), a.getY() + this.t * (b.getY() - a.getY()), 1);
  }
  getNext(p: GeoPoint): boolean {
    this.t += this.step;
    while (this.t > 1 && this.segIdx < this.pl.vertices.length - 2) { this.t -= 1; this.segIdx++; }
    if (this.segIdx >= this.pl.vertices.length - 1) return false;
    this.getCurrentPosition(p);
    return true;
  }
  hasNext(): boolean { return this.segIdx < this.pl.vertices.length - 2 || this.t < 1; }
  resetStartParameter(): void { this.segIdx = 0; this.t = 0; }
  changeOrientation(): void { this.step *= -1; }
}
