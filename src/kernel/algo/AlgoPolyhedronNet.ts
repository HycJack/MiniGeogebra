/**
 * 多面体展开图 —— 对标 GeoGebra AlgoPolyhedronNet。
 *
 * 把棱锥/棱柱的侧面沿底面棱"绕轴旋转"展开到底面所在平面：
 * 顶点绕棱旋转到与底面法向垂直（落入底面），侧面因此摊平在底面上。
 * 展开后所有面共面（底面所在的 3D 平面），面积守恒。
 *
 * C8 补齐 GeoGebra 的两点能力：
 *   1. 展开因子 v∈[0,1] —— 旋转角按 f 缩放，实现折叠↔展开动画；
 *      越界（f<0 或 f>1）与 GeoGebra 一致置 undefined。
 *   2. 展开到 xOy 平面的独立对象 —— 结果刚体映射到底面→z=0，
 *      并为每个面输出 GeoPolygon（构造元素，可在 2D 视图/代数区单独选中）。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoNumeric } from '../geo/GeoNumeric';
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
 * f∈[0,1] 为展开因子：只转 fullAngle·f，f=0 保持闭合，f=1 完全摊平。
 */
function unfoldRigidAroundEdge(
  points: Coords4[],
  A: Coords4,
  B: Coords4,
  n0: Coords4,
  centroid: Coords4,
  f = 1,
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
  const partial = angle * f;
  return points.map(P => {
    const w = P.sub(A);
    return A.add(rotateVector(w, u, partial));
  });
}

/**
 * 把展开结果刚体映射到 xOy 平面：底面法向转到 +z，底面点落到 z=0。
 * 已经水平且在 z=0 上的底面近似为恒等（仅减 centroid.z）。
 */
function mapFacesToXOy(
  faces: Coords4[][],
  normal: Coords4,
  centroid: Coords4,
): Coords4[][] {
  const n = normal.normalize();
  const target = Coords4.fromDirection(0, 0, 1);
  const dot = Math.max(-1, Math.min(1, n.dot(target)));
  let axis: Coords4 | null = null;
  let angle = 0;
  if (dot < 1 - 1e-12) {
    if (dot > -1 + 1e-12) {
      axis = n.cross(target).normalize();
      angle = Math.acos(dot);
    } else {
      // 法向朝 -z：绕 x 转 π
      axis = Coords4.fromDirection(1, 0, 0);
      angle = Math.PI;
    }
  }
  const zOff = centroid.getZ();
  return faces.map(face => face.map(p => {
    let q = p;
    if (axis) {
      const d = p.sub(centroid);
      q = centroid.add(rotateVector(d, axis, angle));
    }
    return Coords4.fromPoint(q.getX(), q.getY(), q.getZ() - zOff);
  }));
}

/** 棱锥/棱柱展开图。 */
export class AlgoPolyhedronNet extends AlgoElement {
  private outputNet: GeoNet3D;
  private facePolys: GeoPolygon[] = [];
  /** 底面边数：构造期冻结，供反序列化在 polyhedron.compute 之前重建面输出。 */
  private baseN: number;

  constructor(
    kernel: IKernel,
    private polyhedron: GeoPolyhedron3D,
    private v?: number | GeoNumeric,
    savedBaseN?: number,
  ) {
    super(kernel);
    this.outputNet = new GeoNet3D(kernel);
    this.baseN = savedBaseN ?? Math.max(0, polyhedron.baseCount());
    this.createFacePolygons();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.polyhedron];
    if (this.v instanceof GeoElement) this.input.push(this.v);
    this.setOutput([this.outputNet, ...this.facePolys]);
  }

  getOutput(): GeoNet3D { return this.outputNet; }
  getFacePolygons(): GeoPolygon[] { return this.facePolys; }
  getBaseN(): number { return this.baseN; }
  getFactorInput(): number | GeoNumeric | undefined { return this.v; }

  /** 当前展开因子（GeoNumeric 取实时值；缺省 1 = 完全展开）。 */
  getFactorValue(): number {
    if (this.v instanceof GeoNumeric) return this.v.getValue();
    if (typeof this.v === 'number') return this.v;
    return 1;
  }

  private createFacePolygons(): void {
    const n = this.baseN;
    if (n < 3) return;
    const mk = (size: number): GeoPolygon => {
      const pts = Array.from({ length: size }, () => {
        const p = new GeoPoint(this.kernel, new GeoVec3D(0, 0, 1));
        p.labelVisible = false;
        return p;
      });
      return new GeoPolygon(this.kernel, pts);
    };
    this.facePolys.push(mk(n)); // 底面
    if (this.polyhedron.kind === 'pyramid') {
      for (let i = 0; i < n; i++) this.facePolys.push(mk(3));
    } else {
      for (let i = 0; i < n; i++) this.facePolys.push(mk(4));
      this.facePolys.push(mk(n)); // 顶面
    }
  }

  compute(): void {
    const f = this.getFactorValue();
    if (!Number.isFinite(f) || f < 0 || f > 1) {
      this.outputNet.setUndefined();
      for (const poly of this.facePolys) poly.setUndefined();
      return;
    }
    this.outputNet.setUndefined();
    const poly = this.polyhedron;
    if (poly.vertices.length < 4) {
      for (const fp of this.facePolys) fp.setUndefined();
      return;
    }
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
        const [unfolded] = unfoldRigidAroundEdge([apex], A, B, normal, centroid, f);
        faces.push([A, B, unfolded]);
      }
    } else {
      const top = poly.vertices.slice(n);
      let lastTopEdgeU: [Coords4, Coords4] | null = null;
      // 每个侧面绕各自底面棱展开（顶边随刚体旋转）；f 缩放旋转角
      for (let i = 0; i < n; i++) {
        const A = base[i];
        const B = base[(i + 1) % n];
        const [AtU, BtU] = unfoldRigidAroundEdge([top[i], top[(i + 1) % n]], A, B, normal, centroid, f);
        faces.push([A, B, BtU, AtU]);
        if (i === n - 1) lastTopEdgeU = [AtU, BtU];
      }
      // 顶面（正棱柱时 ∥ 底面）沿最后一条侧面展开后的共享边平移摊平：
      // 顶面顶点正对着底面顶点，旋转等价于平移。
      // f=0 时 lastTopEdgeU 即原始顶棱，t=0，顶面保持闭合位置。
      if (lastTopEdgeU) {
        const t = lastTopEdgeU[0].sub(top[n - 1]);
        faces.push(top.map(v => v.add(t)));
      }
    }

    // C8：刚体映射到底面 → z=0（xOy 平面），再作为 Net 与独立多边形输出
    const mapped = mapFacesToXOy(faces, normal, centroid);
    this.outputNet.setFaces(mapped, poly.kind);
    this.outputNet.setDefined();
    this.syncFacePolygons(mapped);
  }

  /** 把映射后的面写回独立 GeoPolygon 输出（x,y 取自 xOy 映射结果）。 */
  private syncFacePolygons(faces: Coords4[][]): void {
    // 面数与预建输出不一致（理论上仅 polyhedron 拓扑变化）时按可对齐部分更新
    const count = Math.min(faces.length, this.facePolys.length);
    for (let i = 0; i < this.facePolys.length; i++) {
      const poly = this.facePolys[i];
      if (i >= count || faces[i].length < 3 || faces[i].length !== poly.vertices.length) {
        poly.setUndefined();
        continue;
      }
      for (let j = 0; j < poly.vertices.length; j++) {
        const p = faces[i][j];
        poly.vertices[j].setCoords(p.getX(), p.getY(), 1);
      }
      poly.setDefined();
    }
  }
}
