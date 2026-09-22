/**
 * 多面体展开图 —— 对标 GeoGebra AlgoPolyhedronNet。
 *
 * 把棱锥/棱柱的侧面沿底面棱"绕轴旋转"展开到底面所在平面：
 * 顶点绕棱旋转到与底面法向垂直（落入底面），侧面因此摊平在底面上。
 * 展开后所有面共面（底面所在的 3D 平面），面积守恒。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoVec3D } from '../core/GeoVec3D';
import { Coords4 } from '../core/Coords4';
import { GeoPolyhedron3D } from './AlgoPolyhedron3D';

/** 展开图：共面的面集合（顶点环）。 */
export class GeoNet3D extends GeoElement {
  public faces: Coords4[][] = [];
  public sourceKind: 'prism' | 'pyramid' = 'pyramid';

  constructor(kernel: IKernel) {
    super(kernel, new GeoVec3D(0, 0, 0));
  }

  getClassName(): string { return 'GeoNet3D'; }

  get defaultStrokeColor(): string { return '#f97316'; }
  get defaultLineWidth(): number { return 1; }
  get defaultFillColor(): string { return 'rgba(249, 115, 22, 0.15)'; }

  setFaces(faces: Coords4[][], sourceKind: 'prism' | 'pyramid'): void {
    this.faces = faces.map(f => f.map(p => p.toPoint()));
    this.sourceKind = sourceKind;
  }

  /** 总面积（= 多面体表面积，验证展开不改变面积）。 */
  area(): number {
    let sum = 0;
    for (const face of this.faces) {
      if (face.length < 3) continue;
      let acc = Coords4.fromDirection(0, 0, 0);
      for (let i = 0, j = face.length - 1; i < face.length; j = i++) {
        acc = acc.add(face[i].asDirection().cross(face[j].asDirection()));
      }
      sum += acc.norm() / 2;
    }
    return sum;
  }

  /** 展开平面是否为 z=0（简单判断共面性用）。 */
  isCoplanar(): boolean {
    if (this.faces.length === 0) return true;
    const n0 = this.faces[0].length >= 3
      ? this.faces[0][1].sub(this.faces[0][0]).asDirection().cross(this.faces[0][2].sub(this.faces[0][0]).asDirection()).normalize()
      : Coords4.fromDirection(0, 0, 1);
    const p0 = this.faces[0][0];
    for (const face of this.faces) {
      for (const p of face) {
        if (Math.abs(n0.dot(p.sub(p0))) > 1e-6) return false;
      }
    }
    return true;
  }

  getAlgebraDescription(): string {
    if (!this.isDefined()) return `${this.label}（未定义）`;
    return `${this.label} : ${this.sourceKind === 'prism' ? '棱柱' : '棱锥'}展开图（${this.faces.length} 个面, 面积 ${fmt(this.area())}）`;
  }
}

function fmt(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : String(v);
}

/** 绕单位轴 direction（过点 origin）旋转向量 v。 */
function rotateVector(v: Coords4, axis: Coords4, angle: number): Coords4 {
  const a = axis.scale(v.dot(axis));
  const b = v.sub(a);
  if (b.norm() < 1e-12) return v;
  const c = axis.cross(b);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return a.add(b.scale(cos)).add(c.scale(sin));
}

/**
 * 把一组点绕棱 AB 旋转到平面（法向 n0、朝向 centroid 外侧）内。
 * 整组点共用同一次旋转（刚体），因此面内距离与角度全部保持。
 * 展开后 P' 与 A、B 的距离保持不变（|P'A| = |PA|, |P'B| = |PB|）。
 */
function unfoldRigidAroundEdge(
  points: Coords4[],
  A: Coords4,
  B: Coords4,
  n0: Coords4,
  centroid: Coords4,
): Coords4[] {
  const u = B.sub(A).normalize();
  // 取第一个不在棱上的点确定旋转角
  let angle = 0;
  let found = false;
  for (const P of points) {
    const w = P.sub(A);
    const wPar = u.scale(w.dot(u));
    const wPerp = w.sub(wPar);
    if (wPerp.norm() < 1e-12) continue;
    // 底面内垂直于棱的方向（朝向底面外侧）
    let m = n0.cross(u);
    if (m.norm() < 1e-12) m = Coords4.fromDirection(-u.y, u.x, 0).normalize();
    if ((centroid.sub(A)).dot(m) < 0) m = m.scale(-1);
    const target = m.scale(wPerp.norm());
    const crossDot = wPerp.cross(target).dot(u);
    const cos = Math.max(-1, Math.min(1, wPerp.dot(target) / (wPerp.norm() * target.norm())));
    angle = Math.acos(cos) * (crossDot < 0 ? -1 : 1);
    found = true;
    break;
  }
  if (!found) return points;
  return points.map(P => {
    const w = P.sub(A);
    return A.add(rotateVector(w, u, angle));
  });
}

/** 棱锥/棱柱展开图。 */
export class AlgoPolyhedronNet extends AlgoElement {
  private outputNet: GeoNet3D;

  constructor(kernel: IKernel, private polyhedron: GeoPolyhedron3D) {
    super(kernel);
    this.outputNet = new GeoNet3D(kernel);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.polyhedron];
    this.setOutput([this.outputNet]);
  }

  getOutput(): GeoNet3D { return this.outputNet; }

  compute(): void {
    this.outputNet.setUndefined();
    const poly = this.polyhedron;
    if (poly.vertices.length < 4) return;
    const n = poly.baseCount();
    const base = poly.vertices.slice(0, n);
    const normal = poly.baseNormal();
    const centroid = Coords4.fromPoint(
      base.reduce((s, p) => s + p.getX(), 0) / n,
      base.reduce((s, p) => s + p.getY(), 0) / n,
      base.reduce((s, p) => s + p.getZ(), 0) / n,
    );
    const faces: Coords4[][] = [base];

    if (poly.kind === 'pyramid') {
      const apex = poly.vertices[n];
      for (let i = 0; i < n; i++) {
        const A = base[i];
        const B = base[(i + 1) % n];
        const [unfolded] = unfoldRigidAroundEdge([apex], A, B, normal, centroid);
        faces.push([A, B, unfolded]);
      }
    } else {
      const top = poly.vertices.slice(n);
      let lastTopEdgeU: [Coords4, Coords4] | null = null;
      // 每个侧面绕各自底面棱展开（顶边随刚体旋转）
      for (let i = 0; i < n; i++) {
        const A = base[i];
        const B = base[(i + 1) % n];
        const [AtU, BtU] = unfoldRigidAroundEdge([top[i], top[(i + 1) % n]], A, B, normal, centroid);
        faces.push([A, B, BtU, AtU]);
        if (i === n - 1) lastTopEdgeU = [AtU, BtU];
      }
      // 顶面（正棱柱时 ∥ 底面）沿最后一条侧面展开后的共享边平移摊平：
      // 顶面顶点正对着底面顶点，旋转等价于平移。
      if (lastTopEdgeU) {
        const t = lastTopEdgeU[0].sub(top[n - 1]);
        faces.push(top.map(v => v.add(t)));
      }
    }

    this.outputNet.setFaces(faces, poly.kind);
    this.outputNet.setDefined();
  }
}
