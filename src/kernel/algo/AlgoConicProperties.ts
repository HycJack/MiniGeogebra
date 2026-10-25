/**
 * 圆锥曲线解析属性算法族 —— 对标 GeoGebra 的
 * Focus / Vertex / Asymptote / Directrix / Axes / Eccentricity / Parameter / Radius / Polar 命令。
 *
 * 全部基于 conicSolve.analyzeConic 的标准形分析（特征分解 + 平移旋转），
 * 输入移动后随依赖链自动重算；不适用的输出（如椭圆的渐近线）置 undefined。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoConic } from '../geo/GeoConic';
import { GeoVec3D } from '../core/GeoVec3D';
import { analyzeConic, dualLine, isLineTangentToConic, CanonicalConic } from '../geo/conicSolve';

const dirAt = (angle: number) => ({ x: Math.cos(angle), y: Math.sin(angle) });

/**
 * 公共基类：单输入圆锥曲线，输出若干对象。
 * apply() 返回实际赋值的前 n 个输出个数；0 表示本类型不适用该属性（输出保持 undefined）。
 * 不能对全部输出整体 setDefined——圆的第二个焦点、抛物线的第二输出
 * 从未被赋值，整体置 defined 会把构造初值 (0,0) 洗成幻影对象。
 */
abstract class AlgoConicPropertyBase extends AlgoElement {
  protected conic: GeoConic;

  constructor(kernel: IKernel, conic: GeoConic) {
    super(kernel);
    this.conic = conic;
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.conic];
    this.setOutput(this.outputs());
  }

  protected abstract outputs(): GeoElement[];

  compute(): void {
    this.output.forEach(o => o.setUndefined());
    const canonical = analyzeConic(this.conic.coeffs);
    if (!canonical) return;
    const n = this.apply(canonical);
    for (let i = 0; i < n; i++) this.output[i].setDefined();
  }

  protected abstract apply(c: CanonicalConic): number;
}

/** 焦点：椭圆/双曲线 2 个，抛物线 1 个（第二个保持 undefined），圆 = 圆心。 */
export class AlgoConicFocus extends AlgoConicPropertyBase {
  constructor(kernel: IKernel, conic: GeoConic) {
    super(kernel, conic);
  }

  protected outputs(): GeoElement[] {
    return [new GeoPoint(this.kernel, new GeoVec3D(0, 0, 1)), new GeoPoint(this.kernel, new GeoVec3D(0, 0, 1))];
  }

  protected apply(c: CanonicalConic): number {
    const [f1, f2] = this.output as GeoPoint[];
    if (c.type === 'circle') {
      f1.setCoords(c.center!.x, c.center!.y, 1);
      return 1;
    }
    if (c.type === 'parabola') {
      const axis = dirAt(c.axisAngle!);
      f1.setCoords(c.vertex!.x + c.focalParameter! * axis.x, c.vertex!.y + c.focalParameter! * axis.y, 1);
      return 1;
    }
    const dir = dirAt(c.majorAngle!);
    // 半焦距：椭圆 c²=a²−b²；双曲线 c²=a²+b²（此前误用 |a²−b²|，双曲线焦点/离心率/准线全错）
    const c0 = c.type === 'hyperbola'
      ? Math.sqrt(c.a! * c.a! + c.b! * c.b!)
      : Math.sqrt(Math.abs(c.a! * c.a! - c.b! * c.b!));
    f1.setCoords(c.center!.x + c0 * dir.x, c.center!.y + c0 * dir.y, 1);
    f2.setCoords(c.center!.x - c0 * dir.x, c.center!.y - c0 * dir.y, 1);
    return 2;
  }
}

/** 顶点：椭圆/双曲线在长轴（实轴）两端，抛物线 1 个。 */
export class AlgoConicVertex extends AlgoConicPropertyBase {
  constructor(kernel: IKernel, conic: GeoConic) {
    super(kernel, conic);
  }

  protected outputs(): GeoElement[] {
    return [new GeoPoint(this.kernel, new GeoVec3D(0, 0, 1)), new GeoPoint(this.kernel, new GeoVec3D(0, 0, 1))];
  }

  protected apply(c: CanonicalConic): number {
    const [v1, v2] = this.output as GeoPoint[];
    if (c.type === 'parabola') {
      v1.setCoords(c.vertex!.x, c.vertex!.y, 1);
      return 1;
    }
    const dir = dirAt(c.majorAngle!);
    v1.setCoords(c.center!.x + c.a! * dir.x, c.center!.y + c.a! * dir.y, 1);
    v2.setCoords(c.center!.x - c.a! * dir.x, c.center!.y - c.a! * dir.y, 1);
    return 2;
  }
}

/** 渐近线：双曲线 2 条，其余无定义。 */
export class AlgoConicAsymptote extends AlgoConicPropertyBase {
  constructor(kernel: IKernel, conic: GeoConic) {
    super(kernel, conic);
  }

  protected outputs(): GeoElement[] {
    return [new GeoLine(this.kernel, 1, 0, 0), new GeoLine(this.kernel, 1, 0, 0)];
  }

  protected apply(c: CanonicalConic): number {
    if (c.type !== 'hyperbola') return 0;
    const t = dirAt(c.majorAngle!);           // 实轴方向
    const s = dirAt(c.majorAngle! + Math.PI / 2); // 共轭轴方向
    const [l1, l2] = this.output as GeoLine[];
    const setLine = (line: GeoLine, sign: number) => {
      // 过中心，方向 a·t̂ ± b·ŝ，法向 = 方向旋转 90°
      const dx = c.a! * t.x + sign * c.b! * s.x;
      const dy = c.a! * t.y + sign * c.b! * s.y;
      const n = Math.hypot(dx, dy);
      line.a = -dy / n;
      line.b = dx / n;
      line.c = -(line.a * c.center!.x + line.b * c.center!.y);
    };
    setLine(l1, +1);
    setLine(l2, -1);
    return 2;
  }
}

/** 准线：抛物线 1 条，椭圆/双曲线 2 条（圆无准线）。 */
export class AlgoConicDirectrix extends AlgoConicPropertyBase {
  constructor(kernel: IKernel, conic: GeoConic) {
    super(kernel, conic);
  }

  protected outputs(): GeoElement[] {
    return [new GeoLine(this.kernel, 1, 0, 0), new GeoLine(this.kernel, 1, 0, 0)];
  }

  protected apply(c: CanonicalConic): number {
    const [d1, d2] = this.output as GeoLine[];
    if (c.type === 'parabola') {
      const axis = dirAt(c.axisAngle!);
      const foot = { x: c.vertex!.x - c.focalParameter! * axis.x, y: c.vertex!.y - c.focalParameter! * axis.y };
      d1.a = axis.x;
      d1.b = axis.y;
      d1.c = -(axis.x * foot.x + axis.y * foot.y);
      return 1;
    }
    if (c.type === 'circle') return 0;
    const dir = dirAt(c.majorAngle!);
    const c0 = c.type === 'hyperbola'
      ? Math.sqrt(c.a! * c.a! + c.b! * c.b!)
      : Math.sqrt(Math.abs(c.a! * c.a! - c.b! * c.b!));
    const offset = c.a! * c.a! / c0; // a/e = a²/c0
    d1.a = dir.x;
    d1.b = dir.y;
    d1.c = -(dir.x * c.center!.x + dir.y * c.center!.y + offset);
    d2.a = dir.x;
    d2.b = dir.y;
    d2.c = -(dir.x * c.center!.x + dir.y * c.center!.y - offset);
    return 2;
  }
}

/** 对称轴：中心型 2 条（两条主轴），抛物线 1 条（对称轴）。 */
export class AlgoConicAxis extends AlgoConicPropertyBase {
  constructor(kernel: IKernel, conic: GeoConic) {
    super(kernel, conic);
  }

  protected outputs(): GeoElement[] {
    return [new GeoLine(this.kernel, 1, 0, 0), new GeoLine(this.kernel, 1, 0, 0)];
  }

  protected apply(c: CanonicalConic): number {
    const [a1, a2] = this.output as GeoLine[];
    if (c.type === 'parabola') {
      const axis = dirAt(c.axisAngle!);
      a1.a = axis.y;
      a1.b = -axis.x;
      a1.c = -(axis.y * c.vertex!.x - axis.x * c.vertex!.y);
      return 1;
    }
    const setThrough = (line: GeoLine, angle: number) => {
      const dir = dirAt(angle);
      line.a = dir.y;
      line.b = -dir.x;
      line.c = -(dir.y * c.center!.x - dir.x * c.center!.y);
    };
    setThrough(a1, c.theta);
    setThrough(a2, c.theta + Math.PI / 2);
    return 2;
  }
}

/** 离心率：圆 0、抛物线 1，椭圆/双曲线 c0/a。 */
export class AlgoConicEccentricity extends AlgoConicPropertyBase {
  constructor(kernel: IKernel, conic: GeoConic) {
    super(kernel, conic);
  }

  protected outputs(): GeoElement[] {
    return [new GeoNumeric(this.kernel, 0)];
  }

  protected apply(c: CanonicalConic): number {
    const num = this.output[0] as GeoNumeric;
    if (c.type === 'circle') { num.setValue(0); return 1; }
    if (c.type === 'parabola') { num.setValue(1); return 1; }
    const c0 = c.type === 'hyperbola'
      ? Math.sqrt(c.a! * c.a! + c.b! * c.b!)
      : Math.sqrt(Math.abs(c.a! * c.a! - c.b! * c.b!));
    num.setValue(c0 / c.a!);
    return 1;
  }
}

/** 半通径（Parameter）：抛物线的 |p|，椭圆/双曲线的 b²/a。 */
export class AlgoConicParameter extends AlgoConicPropertyBase {
  constructor(kernel: IKernel, conic: GeoConic) {
    super(kernel, conic);
  }

  protected outputs(): GeoElement[] {
    return [new GeoNumeric(this.kernel, 0)];
  }

  protected apply(c: CanonicalConic): number {
    const num = this.output[0] as GeoNumeric;
    // 抛物线的 parameter = |2f|（y²=2px 中的 p）；中心型 = b²/a
    num.setValue(c.type === 'parabola' ? Math.abs(2 * c.focalParameter!) : c.b! * c.b! / c.a!);
    return 1;
  }
}

/** 圆的半径（非圆置 undefined）。 */
export class AlgoConicRadius extends AlgoConicPropertyBase {
  constructor(kernel: IKernel, conic: GeoConic) {
    super(kernel, conic);
  }

  protected outputs(): GeoElement[] {
    return [new GeoNumeric(this.kernel, 0)];
  }

  protected apply(c: CanonicalConic): number {
    if (c.type !== 'circle') return 0;
    (this.output[0] as GeoNumeric).setValue(Math.sqrt(-c.fPrime / c.lambda1));
    return 1;
  }
}

/** 极线：点 p 关于圆锥曲线的对偶线（点在曲线上时即切线）。 */
export class AlgoPolarLine extends AlgoElement {
  private outputLine: GeoLine;
  private point: GeoPoint;
  private conic: GeoConic;

  constructor(kernel: IKernel, point: GeoPoint, conic: GeoConic) {
    super(kernel);
    this.point = point;
    this.conic = conic;
    this.outputLine = new GeoLine(kernel, 1, 0, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.point, this.conic];
    this.setOutput([this.outputLine]);
  }

  compute(): void {
    this.outputLine.setUndefined();
    const [a, b, c] = dualLine(this.conic.coeffs, this.point.getX(), this.point.getY());
    if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return; // 退化对偶线（点为圆心等）
    this.outputLine.a = a;
    this.outputLine.b = b;
    this.outputLine.c = c;
    this.outputLine.setDefined();
  }
}

/** 相切判断：直线与圆锥曲线的判别式为零（相对判据）。 */
export class AlgoIsTangent extends AlgoElement {
  private line: GeoLine;
  private conic: GeoConic;

  constructor(kernel: IKernel, line: GeoElement, conic: GeoElement) {
    super(kernel);
    this.line = line as GeoLine;
    this.conic = conic as GeoConic;
    this.setOutput([new GeoNumeric(kernel, 0)]);
  }

  setInputOutput(): void {
    this.input = [this.line, this.conic];
    this.setOutput([this.output[0]]);
  }

  compute(): void {
    const tangent = isLineTangentToConic(this.conic.coeffs, this.line.a, this.line.b, this.line.c);
    (this.output[0] as GeoNumeric).setValue(tangent ? 1 : 0);
  }
}
