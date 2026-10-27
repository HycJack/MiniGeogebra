import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';

/**
 * 角度测量：∠P1P2P3（顶点为 P2），结果以弧度计，范围 [0, π]。
 * 输出为 GeoNumeric。
 */
export class AlgoAngle extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(
    kernel: IKernel,
    private p1: GeoPoint,
    private p2: GeoPoint,   // 顶点
    private p3: GeoPoint,
  ) {
    super(kernel);
    // 标签由调用方统一分配（识别器 assignNextLabel / 工具层），不再硬编码 'α'
    this.outputValue = new GeoNumeric(kernel, 0);
    // 角度量标记：代数视图按 angleUnit 显示（Options 三件套）
    this.outputValue.isAngle = true;
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2, this.p3];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const v1x = this.p1.getX() - this.p2.getX();
    const v1y = this.p1.getY() - this.p2.getY();
    const v2x = this.p3.getX() - this.p2.getX();
    const v2y = this.p3.getY() - this.p2.getY();

    const dot = v1x * v2x + v1y * v2y;
    const n1 = Math.hypot(v1x, v1y);
    const n2 = Math.hypot(v2x, v2y);

    if (n1 === 0 || n2 === 0) {
      this.outputValue.setUndefined();
      return;
    }

    let cos = dot / (n1 * n2);
    // 数值稳定：截断到 [-1, 1]
    if (cos > 1) cos = 1;
    if (cos < -1) cos = -1;

    const angle = Math.acos(cos); // [0, π]
    this.outputValue.setValue(angle);
    this.outputValue.setDefined();
  }

  /** 以度为单位取值（UI 友好） */
  getDegrees(): number {
    return this.outputValue.getValue() * 180 / Math.PI;
  }

  getOutput(): GeoNumeric {
    return this.outputValue;
  }
}

/**
 * 有向角：从射线 P2→P1 到射线 P2→P3 的**逆时针**角，范围 [0, 2π)。
 * 对标 GeoGebra Angle 工具的"逆时针"方向变体（AlgoAnglePoints 的
 * orientation 参数）：cross/dot 的 atan2 给出带符号角，负值加 2π 归一。
 */
export class AlgoAngleOriented extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(
    kernel: IKernel,
    private p1: GeoPoint,
    private p2: GeoPoint,   // 顶点
    private p3: GeoPoint,
  ) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.outputValue.isAngle = true;
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2, this.p3];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const v1x = this.p1.getX() - this.p2.getX();
    const v1y = this.p1.getY() - this.p2.getY();
    const v2x = this.p3.getX() - this.p2.getX();
    const v2y = this.p3.getY() - this.p2.getY();
    const n1 = Math.hypot(v1x, v1y);
    const n2 = Math.hypot(v2x, v2y);
    if (n1 === 0 || n2 === 0) {
      this.outputValue.setUndefined();
      return;
    }
    const cross = v1x * v2y - v1y * v2x;
    const dot = v1x * v2x + v1y * v2y;
    let angle = Math.atan2(cross, dot); // (−π, π]
    if (angle < 0) angle += 2 * Math.PI; // → [0, 2π) 逆时针
    this.outputValue.setValue(angle);
    this.outputValue.setDefined();
  }

  getDegrees(): number {
    return this.outputValue.getValue() * 180 / Math.PI;
  }

  getOutput(): GeoNumeric {
    return this.outputValue;
  }
}


/**
 * 两线角（对标 AlgoAngleLines）：angle = atan2(det(n1,n2), n1·n2)，
 * n 为直线系数 ax+by+c 的法向量；atan2 对向量长度缩放不变，无需归一化。
 * 结果为有向角，归一化到 [0, 2π)。线段/射线（GeoLine 子类）同样适用。
 */
export class AlgoAngleTwoLines extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(kernel: IKernel, private l1: GeoLine, private l2: GeoLine) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.outputValue.isAngle = true;
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.l1, this.l2];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const len1 = Math.hypot(this.l1.a, this.l1.b);
    const len2 = Math.hypot(this.l2.a, this.l2.b);
    if (len1 < 1e-12 || len2 < 1e-12) {
      this.outputValue.setUndefined();
      return;
    }
    // |v||w|·sinθ = det(v,w)，|v||w|·cosθ = v·w（v/w 为法向量）
    const det = this.l1.a * this.l2.b - this.l1.b * this.l2.a;
    const prod = this.l1.a * this.l2.a + this.l1.b * this.l2.b;
    let value = Math.atan2(det, prod);
    if (value < 0) value += 2 * Math.PI;
    this.outputValue.setValue(value);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
}

/**
 * 两点角（对标 CmdAngle.process2 的 Angle(P, Q)）：位置向量 (P−O) 与 (Q−O)
 * 的夹角，[0, π]。任一点与原点重合时输出 undefined（零向量无方向）。
 */
export class AlgoAngleTwoPoints extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(kernel: IKernel, private p1: GeoPoint, private p2: GeoPoint) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.outputValue.isAngle = true;
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.p1, this.p2];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const n1 = Math.hypot(this.p1.getX(), this.p1.getY());
    const n2 = Math.hypot(this.p2.getX(), this.p2.getY());
    if (n1 < 1e-12 || n2 < 1e-12) {
      this.outputValue.setUndefined();
      return;
    }
    const dot = this.p1.getX() * this.p2.getX() + this.p1.getY() * this.p2.getY();
    let cos = dot / (n1 * n2);
    if (cos > 1) cos = 1;
    if (cos < -1) cos = -1;
    this.outputValue.setValue(Math.acos(cos));
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
}
