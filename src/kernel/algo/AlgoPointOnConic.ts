import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoConic } from '../geo/GeoConic';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';

export class AlgoPointOnConic extends AlgoElement {
  private outputPoint: GeoPoint;

  constructor(
    kernel: IKernel,
    private conic: GeoConic,
    private param: GeoNumeric
  ) {
    super(kernel);
    this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    this.outputPoint.label = kernel.getConstruction().getNextPointLabel();
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.conic, this.param];
    this.setOutput([this.outputPoint]);
  }

  compute(): void {
    const t = normalizeAngle(this.param.getValue());
    const anchor = this.conic.getConicType() === 'parabola' ? this.conic.getVertex() : this.conic.getCenter();
    const hit = this.conic.pointAtAngle(t);

    if (!hit) {
      this.outputPoint.setUndefined();
      return;
    }
    this.outputPoint.setCoords(hit.x, hit.y, 1);
    this.outputPoint.setDefined();
  }

  getOutput(): GeoPoint {
    return this.outputPoint;
  }

  /**
   * 把鼠标位置投影到圆锥曲线上：取“锚点 → 鼠标”方向的极角作为参数。
   * 对圆/椭圆/双曲线/抛物线均成立（与 compute 的解析求解自洽）。
   */
  updateParameter(x: number, y: number): void {
    const anchor = this.conic.getConicType() === 'parabola' ? this.conic.getVertex() : this.conic.getCenter();
    const angle = Math.atan2(y - anchor.y, x - anchor.x);
    this.param.setValue(normalizeAngle(angle));
  }
}

/** 把角度归一化到 [0, 2π)，与参数区间 [0, 2π] 保持一致。 */
function normalizeAngle(t: number): number {
  if (!Number.isFinite(t)) return 0;
  const twoPi = 2 * Math.PI;
  return ((t % twoPi) + twoPi) % twoPi;
}
