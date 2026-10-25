/**
 * C10：3D path/region 上的依附点 —— 对标 GeoGebra PointOn/PointIn 的 3D 分支。
 *
 * 与 2D 的 AlgoPointOnLine/AlgoPointOnConic/AlgoRegion 同构：
 *   - compute() 按参数把点放到 path 上；
 *   - updateParameter(x, y, z) 拖拽时把目标位置投影回 path/region；
 *   - 驱动参数为 GeoNumeric，GeoPoint3D 经 isAnimatable 可沿路径动画。
 *
 * 平面内坐标 (u, v) 走 GeoPlane3D 的 CoordSys-lite（origin + e1/e2 基）。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoLine3D } from '../geo/GeoLine3D';
import { GeoCircle3D } from '../geo/GeoCircle3D';
import { GeoConic3D } from '../geo/GeoConic3D';
import { GeoPolyline3D } from '../geo/GeoPolyline3D';
import { GeoPlane3D } from '../geo/GeoPlane3D';
import { GeoQuadric3D } from '../geo/GeoQuadric3D';
import { GeoNumeric } from '../geo/GeoNumeric';
import { Coords4 } from '../core/Coords4';

/** 直线/线段/射线上的参数点：param = 直线参数 t（有限限界夹回）。 */
export class AlgoPointOnLine3D extends AlgoElement {
  private outputPoint: GeoPoint3D;

  constructor(kernel: IKernel, private line: GeoLine3D, private param: GeoNumeric) {
    super(kernel);
    this.outputPoint = new GeoPoint3D(kernel, Coords4.origin());
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.line, this.param];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint3D { return this.outputPoint; }

  compute(): void {
    const t = this.clampT(this.param.getValue());
    const p = this.line.pointAt(t);
    this.outputPoint.setCoords(p.getX(), p.getY(), p.getZ());
    this.outputPoint.setDefined();
  }

  /** 拖拽：正交投影到线上求 t（离线点也有效），写回驱动滑块。 */
  updateParameter(x: number, y: number, z: number): void {
    // parameterOf 对不共线点返回 null，拖拽目标通常偏离线，须直接做投影
    const delta = Coords4.fromPoint(x, y, z).toPoint().sub(this.line.getOrigin());
    const t = delta.dot(this.line.getDirection());
    this.param.setValue(this.clampT(t));
  }

  private clampT(t: number): number {
    const limits = this.line.getLimits();
    if (limits) return Math.max(limits.tMin, Math.min(limits.tMax, t));
    return t;
  }
}

/** 3D 圆上的参数点：param = 圆心角弧度（与 2D AlgoPointOnConic 一致）。 */
export class AlgoPointOnCircle3D extends AlgoElement {
  private outputPoint: GeoPoint3D;

  constructor(kernel: IKernel, private circle: GeoCircle3D, private param: GeoNumeric) {
    super(kernel);
    this.outputPoint = new GeoPoint3D(kernel, Coords4.origin());
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.circle, this.param];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint3D { return this.outputPoint; }

  compute(): void {
    const p = this.circle.pointAt(this.param.getValue());
    this.outputPoint.setCoords(p.getX(), p.getY(), p.getZ());
    this.outputPoint.setDefined();
  }

  /** 拖拽：在与 pointAt 同一基下取相对圆心的极角。 */
  updateParameter(x: number, y: number, z: number): void {
    const center = this.circle.getCenter();
    const n = this.circle.getNormal();
    // 与 GeoCircle3D.pointAt 相同的 ref 规则，保证角度参数化一致
    const ref = Math.abs(n.getZ()) < 0.9 ? Coords4.fromDirection(0, 0, 1) : Coords4.fromDirection(1, 0, 0);
    let e1 = n.cross(ref);
    if (e1.norm() < 1e-12) e1 = n.cross(Coords4.fromDirection(1, 0, 0));
    e1 = e1.normalize();
    const e2 = n.cross(e1).normalize();
    const w = Coords4.fromPoint(x, y, z).toPoint().sub(center);
    this.param.setValue(Math.atan2(w.dot(e2), w.dot(e1)));
  }
}

/** 3D 圆锥曲线上的参数点：param 驱动 GeoConic3D.pointAt。 */
export class AlgoPointOnConic3D extends AlgoElement {
  private outputPoint: GeoPoint3D;

  constructor(kernel: IKernel, private conic: GeoConic3D, private param: GeoNumeric) {
    super(kernel);
    this.outputPoint = new GeoPoint3D(kernel, Coords4.origin());
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.conic, this.param];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint3D { return this.outputPoint; }

  compute(): void {
    const p = this.conic.pointAt(this.param.getValue());
    this.outputPoint.setCoords(p.getX(), p.getY(), p.getZ());
    this.outputPoint.setDefined();
  }

  /** 拖拽：椭圆用 atan2(v/b, u/a)；双曲线/抛物线用与 pointAt 同构的逆映射。 */
  updateParameter(x: number, y: number, z: number): void {
    const c = this.conic.getCenter();
    const w = Coords4.fromPoint(x, y, z).toPoint().sub(c);
    const u = w.dot(this.conic.getE1());
    const v = w.dot(this.conic.getE2());
    const kind = this.conic.getKind();
    if (kind === 'ellipse') {
      this.param.setValue(Math.atan2(v / this.conic.getB(), u / this.conic.getA()));
    } else if (kind === 'parabola') {
      // pointAt: (a t², 2a t) → t = v / (2a)，若 u 明显偏离则仍用该式就近
      this.param.setValue(v / (2 * this.conic.getA()));
    } else {
      // 双曲线：t ≈ acosh(|u|/a)·sign(v)；u < a 时退到 0
      const ratio = Math.abs(u) / this.conic.getA();
      const t = ratio >= 1 ? Math.acosh(Math.min(ratio, 1e6)) : 0;
      this.param.setValue(u < 0 ? -t : t);
    }
  }
}

/** 3D 折线上的参数点：param = 边索引 + 段内比例（与 2D AlgoPointOnPolyLine 一致）。 */
export class AlgoPointOnPolyline3D extends AlgoElement {
  private outputPoint: GeoPoint3D;

  constructor(kernel: IKernel, private polyline: GeoPolyline3D, private param: GeoNumeric) {
    super(kernel);
    this.outputPoint = new GeoPoint3D(kernel, Coords4.origin());
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.polyline, this.param];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint3D { return this.outputPoint; }

  compute(): void {
    const pts = this.polyline.points;
    if (pts.length < 2) {
      this.outputPoint.setUndefined();
      return;
    }
    const clamped = Math.max(0, Math.min(pts.length - 1, this.param.getValue()));
    const segment = Math.min(pts.length - 2, Math.floor(clamped));
    const t = clamped - segment;
    const a = pts[segment];
    const b = pts[segment + 1];
    this.outputPoint.setCoords(
      a.getX() + t * (b.getX() - a.getX()),
      a.getY() + t * (b.getY() - a.getY()),
      a.getZ() + t * (b.getZ() - a.getZ()),
    );
    this.outputPoint.setDefined();
  }

  /** 拖拽：各边垂足取最近，写回 边索引+比例。 */
  updateParameter(x: number, y: number, z: number): void {
    const pts = this.polyline.points;
    let bestDist = Number.POSITIVE_INFINITY;
    let bestParam = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const abx = b.getX() - a.getX();
      const aby = b.getY() - a.getY();
      const abz = b.getZ() - a.getZ();
      const len2 = abx * abx + aby * aby + abz * abz;
      let t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1,
        ((x - a.getX()) * abx + (y - a.getY()) * aby + (z - a.getZ()) * abz) / len2));
      const px = a.getX() + t * abx;
      const py = a.getY() + t * aby;
      const pz = a.getZ() + t * abz;
      const d = Math.hypot(px - x, py - y, pz - z);
      if (d < bestDist) {
        bestDist = d;
        bestParam = i - 1 + t;
      }
    }
    this.param.setValue(bestParam);
  }
}

/**
 * 平面（Region3D）内的点：param (u, v) 存面内坐标，
 * 平面形变时经 getPoint 重投影，点永不离开平面（无限区域无夹取边界）。
 */
export class AlgoPointInPlane3D extends AlgoElement {
  private outputPoint: GeoPoint3D;
  private lastU: number;
  private lastV: number;

  constructor(kernel: IKernel, private plane: GeoPlane3D, u = 0, v = 0) {
    super(kernel);
    this.lastU = u;
    this.lastV = v;
    const anchor = plane.getPoint(u, v);
    this.outputPoint = new GeoPoint3D(kernel, anchor);
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.plane];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint3D { return this.outputPoint; }

  compute(): void {
    const p = this.plane.getPoint(this.lastU, this.lastV);
    this.outputPoint.setCoords(p.getX(), p.getY(), p.getZ());
    this.outputPoint.setDefined();
  }

  /** 拖拽：投影到平面后换算面内坐标。 */
  updateParameter(x: number, y: number, z: number): void {
    const { u, v } = this.plane.getPlaneCoords(Coords4.fromPoint(x, y, z));
    this.lastU = u;
    this.lastV = v;
  }
}

/**
 * 球面上的点：双参数 (θ 方位角, φ 极角) 球坐标参数化，
 * 点 = 球心 + R·(sinφ·cosθ, sinφ·sinθ, cosφ)。
 * 拖拽 updateParameter 把目标位置向球面重投影（对标 AlgoPoint3DOnPath 对球面的覆盖）。
 * 动画只推进 θ（φ 固定）——纬线圈路径。
 */
export class AlgoPointOnSphere3D extends AlgoElement {
  private outputPoint: GeoPoint3D;

  constructor(kernel: IKernel, private sphere: GeoQuadric3D, private theta: GeoNumeric, private phi: GeoNumeric) {
    super(kernel);
    this.outputPoint = new GeoPoint3D(kernel, Coords4.origin());
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.sphere, this.theta, this.phi];
    this.setOutput([this.outputPoint]);
  }

  getOutput(): GeoPoint3D { return this.outputPoint; }

  compute(): void {
    const c = this.sphere.getBase().toPoint();
    const r = this.sphere.getParam();
    const theta = this.theta.getValue();
    const phi = this.phi.getValue();
    const sp = Math.sin(phi);
    this.outputPoint.setCoords(
      c.x + r * sp * Math.cos(theta),
      c.y + r * sp * Math.sin(theta),
      c.z + r * Math.cos(phi),
    );
    this.outputPoint.setDefined();
  }

  updateParameter(x: number, y: number, z: number): void {
    const c = this.sphere.getBase().toPoint();
    const dx = x - c.x, dy = y - c.y, dz = z - c.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-12) return;
    const phi = Math.acos(Math.max(-1, Math.min(1, dz / len)));
    let theta = Math.atan2(dy, dx);
    if (!Number.isFinite(theta)) theta = 0;
    this.phi.setValue(phi, false);
    this.theta.setValue(theta, false);
  }
}
