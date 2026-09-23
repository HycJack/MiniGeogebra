import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoLine } from '../geo/GeoLine';
import { GeoConic } from '../geo/GeoConic';
import {
  applyTransformed, buildTransformed, shearStretchMatrix, circleCoeffs,
} from './AlgoRotate';

type ShearStretchOp = 'shear' | 'stretch';

/**
 * Shear / Stretch：按直线轴做仿射变换。
 * axis 为 GeoLine 时注册为输入（活轴，移动轴联动重算）；
 * 为 [a, b, c] 三点式系数时冻结（工具层两点画轴/序列化还原）。
 * 轴退化（|n|≈0）：构造期抛错（调用方 all-or-nothing 回滚），运行期置 undefined。
 */
export class AlgoShearStretch extends AlgoElement {
  private result: GeoElement;
  private source: GeoElement;
  private a: number;
  private b: number;
  private c: number;
  private axisLine: GeoLine | null;

  constructor(
    kernel: IKernel,
    source: GeoElement,
    axis: GeoLine | [number, number, number],
    private factor: number,
    private op: ShearStretchOp,
  ) {
    super(kernel);
    this.source = source;
    if (Array.isArray(axis)) {
      this.a = axis[0]; this.b = axis[1]; this.c = axis[2];
      this.axisLine = null;
    } else {
      this.axisLine = axis;
      this.a = axis.a; this.b = axis.b; this.c = axis.c;
    }
    // 构造期校验轴：退化轴直接抛错，让工具层保持当前步骤
    const matrix = shearStretchMatrix(this.a, this.b, this.c, factor, this.op);
    this.result = buildTransformed(kernel, source, this.op, { matrix });
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.axisLine ? [this.source, this.axisLine] : [this.source];
    this.setOutput([this.result]);
  }

  getOutput(): GeoElement { return this.result; }

  getFactor(): number { return this.factor; }
  getOp(): ShearStretchOp { return this.op; }
  /** 当前轴系数（序列化 scalars 用；活轴时为当前快照）。 */
  getAxis(): [number, number, number] { return [this.a, this.b, this.c]; }

  compute(): void {
    if (this.axisLine) {
      this.a = this.axisLine.a;
      this.b = this.axisLine.b;
      this.c = this.axisLine.c;
    }
    try {
      const matrix = shearStretchMatrix(this.a, this.b, this.c, this.factor, this.op);
      applyTransformed(this.result, this.source, this.op, { matrix });
      this.result.setDefined();
    } catch {
      // 活轴被改成退化直线时输出未定义，而非抛错打断更新管线
      this.result.setUndefined();
    }
  }
}

/** 反演圆参数：活圆（GeoConic）或冻结的圆心+半径。 */
export type InvertCircle = GeoConic | { center: { x: number; y: number }; radius: number };

/**
 * 圆反演。circle 为 GeoConic 时注册为输入（移动/缩放圆联动）。
 * 仅支持点与圆作为源：过反演中心的圆像为直线（构造期由 buildTransformed 决定类型）；
 * 活更新时若像的类型无法就地表示（圆移过中心等），置 undefined。
 */
export class AlgoInvert extends AlgoElement {
  private result: GeoElement;
  private source: GeoElement;
  private center: { x: number; y: number };
  private radius: number;
  private circleEl: GeoConic | null;

  constructor(kernel: IKernel, source: GeoElement, circle: InvertCircle) {
    super(kernel);
    this.source = source;
    if (circle instanceof GeoConic) {
      this.circleEl = circle;
      this.center = circle.getCenter();
      this.radius = circle.getRadius();
    } else {
      this.circleEl = null;
      this.center = circle.center;
      this.radius = circle.radius;
    }
    this.result = buildTransformed(kernel, source, 'invert', {
      center: this.center, radius: this.radius,
    });
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.circleEl ? [this.source, this.circleEl] : [this.source];
    this.setOutput([this.result]);
  }

  getOutput(): GeoElement { return this.result; }

  /** 序列化：活圆走 inputs[1]，冻结走 scalars [cx, cy, r]。 */
  getCircleCoords(): [number, number, number] { return [this.center.x, this.center.y, this.radius]; }
  isLiveCircle(): boolean { return this.circleEl !== null; }

  compute(): void {
    if (this.circleEl) {
      if (!this.circleEl.isCircle()) {
        this.result.setUndefined();
        return;
      }
      this.center = this.circleEl.getCenter();
      this.radius = this.circleEl.getRadius();
    }

    // 圆源的反演像类型随「是否过反演中心」在 圆/直线 间切换，无法就地换型时置 undefined
    if (this.source instanceof GeoConic && this.source.isCircle()) {
      const c = this.source.getCenter();
      const r = this.source.getRadius();
      const dx = c.x - this.center.x;
      const dy = c.y - this.center.y;
      const d2 = dx * dx + dy * dy;
      const through = Math.abs(d2 - r * r) < 1e-9;
      if (this.result instanceof GeoLine) {
        if (!through) { this.result.setUndefined(); return; }
        this.result.a = dx;
        this.result.b = dy;
        this.result.c = -(this.radius * this.radius) / 2;
        this.result.setDefined();
        return;
      }
      if (this.result instanceof GeoConic) {
        if (through || r <= 0) { this.result.setUndefined(); return; }
        const k = (this.radius * this.radius) / (d2 - r * r);
        const imageCenter = { x: this.center.x + dx * k, y: this.center.y + dy * k };
        const imageRadius = (this.radius * this.radius) * r / Math.abs(d2 - r * r);
        const coeffs = circleCoeffs(imageCenter.x, imageCenter.y, imageRadius);
        for (let i = 0; i < 6; i++) this.result.coeffs[i] = coeffs[i];
        this.result.setDefined();
        return;
      }
    }

    applyTransformed(this.result, this.source, 'invert', {
      center: this.center, radius: this.radius,
    });
    this.result.setDefined();
  }
}
