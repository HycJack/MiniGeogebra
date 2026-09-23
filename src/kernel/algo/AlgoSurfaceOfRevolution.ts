/**
 * 旋转面 —— 对标 GeoGebra AlgoSurfaceOfRevolution。
 *
 * 命令：Surface(path, angleDeg[, axis])
 *   - path：GeoFunction（y=f(x)，参数 u=x）或 GeoCurve（x(t),y(t)，参数 u=t）
 *   - angle：总旋转角（度），可为活 GeoNumeric 滑块
 *   - axis：可选 3D 轴线；缺省为 x 轴
 *
 * 参数化：P(u) 落在 z=0 平面，绕轴按 Rodrigues 公式旋到角 v ∈ [0, θ]。
 * GeoGebra 内部把 angle 直接当 v 上限且用 cos/sin(v)——其入口数值约定为度；
 * Mini 与 Rotate3D 一致：入口度、内部转弧度。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoCurve } from '../geo/GeoCurve';
import { GeoLine3D } from '../geo/GeoLine3D';
import { GeoSurface } from '../geo/GeoSurface';

/** GeoFunction 无固定定义域时的默认采样区间（对齐常见视窗）。 */
const DEFAULT_FUNCTION_U: [number, number] = [-10, 10];

const ZERO_EXPR = { kind: 'number' as const, value: 0 };

type Vec3 = { x: number; y: number; z: number };

/** Rodrigues 旋转：把 p 绕过 origin、方向为 unitAxis 的轴转 theta 弧度。 */
function rotateAroundAxis(p: Vec3, origin: Vec3, unitAxis: Vec3, theta: number): Vec3 {
  const vx = p.x - origin.x, vy = p.y - origin.y, vz = p.z - origin.z;
  const c = Math.cos(theta), s = Math.sin(theta);
  const cx = unitAxis.y * vz - unitAxis.z * vy;
  const cy = unitAxis.z * vx - unitAxis.x * vz;
  const cz = unitAxis.x * vy - unitAxis.y * vx;
  const d = unitAxis.x * vx + unitAxis.y * vy + unitAxis.z * vz;
  const k = 1 - c;
  return {
    x: origin.x + vx * c + cx * s + unitAxis.x * d * k,
    y: origin.y + vy * c + cy * s + unitAxis.y * d * k,
    z: origin.z + vz * c + cz * s + unitAxis.z * d * k,
  };
}

export class AlgoSurfaceOfRevolution extends AlgoElement {
  private outputSurface: GeoSurface;

  constructor(
    kernel: IKernel,
    private path: GeoFunction | GeoCurve,
    private angle: GeoNumeric | number,
    private axis: GeoLine3D | null = null,
  ) {
    super(kernel);
    const [u0, u1] = this.pathRange();
    const theta = this.angleRad();
    this.outputSurface = new GeoSurface(
      kernel, ZERO_EXPR, ZERO_EXPR, ZERO_EXPR,
      path instanceof GeoCurve ? path.paramName : path.variableName, u0, u1,
      'v', 0, theta,
      { x: '', y: '', z: '' },
    );
    this.setInputOutput();
    this.compute();
  }

  private pathRange(): [number, number] {
    if (this.path instanceof GeoCurve) return [this.path.tMin, this.path.tMax];
    return [...DEFAULT_FUNCTION_U];
  }

  /** 入口角为度；活滑块每次读最新值。 */
  private angleRad(): number {
    const deg = this.angle instanceof GeoNumeric ? this.angle.getValue() : this.angle;
    return deg * Math.PI / 180;
  }

  setInputOutput(): void {
    const inputs: GeoElement[] = [this.path];
    if (this.angle instanceof GeoNumeric) inputs.push(this.angle);
    if (this.axis) inputs.push(this.axis);
    this.input = inputs;
    this.setOutput([this.outputSurface]);
  }

  compute(): void {
    if (!this.path.isDefined()) {
      this.outputSurface.setUndefined();
      return;
    }
    const theta = this.angleRad();
    if (!Number.isFinite(theta) || theta === 0) {
      this.outputSurface.setUndefined();
      return;
    }

    const [u0, u1] = this.pathRange();
    if (!(u1 > u0)) {
      this.outputSurface.setUndefined();
      return;
    }

    const path = this.path;
    const axis = this.axis;
    // 轴缺省为 x 轴；活轴线在求值时读最新几何
    const originOf = (): Vec3 => {
      if (!axis) return { x: 0, y: 0, z: 0 };
      const o = axis.getOrigin();
      return { x: o.getX(), y: o.getY(), z: o.getZ() };
    };
    const dirOf = (): Vec3 | null => {
      if (!axis) return { x: 1, y: 0, z: 0 };
      const d = axis.getDirection();
      const n = Math.hypot(d.x, d.y, d.z);
      if (n < 1e-14) return null;
      return { x: d.x / n, y: d.y / n, z: d.z / n };
    };

    const pointOnPath = (u: number): Vec3 | null => {
      if (path instanceof GeoFunction) {
        const y = path.evaluateAt(u);
        if (!Number.isFinite(y)) return null;
        return { x: u, y, z: 0 };
      }
      const p = path.pointAt(u);
      if (!p) return null;
      return { x: p.x, y: p.y, z: 0 };
    };

    this.outputSurface.setCustomEvaluator((u, v) => {
      const p = pointOnPath(u);
      if (!p) return null;
      const o = originOf();
      const d = dirOf();
      if (!d) return null;
      return rotateAroundAxis(p, o, d, v);
    });
    this.outputSurface.setIntervals(u0, u1, 0, theta);
    this.outputSurface.setDefined();
  }

  getOutput(): GeoSurface { return this.outputSurface; }
  getPath(): GeoFunction | GeoCurve { return this.path; }
  getAxis(): GeoLine3D | null { return this.axis; }

  /** 序列化用命令文本（活角度写标签、冻结写数值）。 */
  getCommandText(): string {
    const pathLabel = this.path.label;
    const angleText = this.angle instanceof GeoNumeric ? this.angle.label : String(this.angle);
    const axisPart = this.axis ? `, ${this.axis.label}` : '';
    return `Surface(${pathLabel}, ${angleText}${axisPart})`;
  }
}
