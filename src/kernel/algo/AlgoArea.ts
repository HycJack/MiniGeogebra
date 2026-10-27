import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoConic } from '../geo/GeoConic';
import { GeoConicPart, CONIC_PART_ARC, CONIC_PART_SEGMENT } from '../geo/GeoConicPart';
import { GeoNumeric } from '../geo/GeoNumeric';
import { analyzeConic } from '../geo/conicSolve';
import { arcSweep } from '../geo/GeoArc';

/**
 * 面积测量：多边形面积（鞋带公式）或圆的面积。
 * 输出为 GeoNumeric。
 */
export class AlgoArea extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(
    kernel: IKernel,
    private target: GeoElement, // GeoPolygon | GeoConic(circle)
  ) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.outputValue.label = 'Area';
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.target];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    let area: number;

    if (this.target instanceof GeoPolygon) {
      const v = this.target.vertices;
      if (v.length < 3) {
        this.outputValue.setUndefined();
        return;
      }
      let sum = 0;
      for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
        sum += v[j].getX() * v[i].getY() - v[i].getX() * v[j].getY();
      }
      area = Math.abs(sum) / 2;
    } else if (this.target instanceof GeoConicPart) {
      // 弧段/扇形（对标 AlgoAreaConic → GeoConicPartParameters.getArea）：
      // 扇形 = r²·extent/2；弓形 = r²(extent − sin extent)/2；弧无面积。
      // 此前落入 GeoConic 分支对一切圆锥算 πr²——90° 扇形得整圆面积（4 倍误差）。
      const part = this.target;
      const r = part.getRadius();
      const type = part.getPartType();
      if (r <= 0 || !Number.isFinite(r) || type === CONIC_PART_ARC) {
        this.outputValue.setUndefined();
        return;
      }
      const extent = arcSweep(part.getStartAngle(), part.getEndAngle(), part.isCounterClockwise());
      area = type === CONIC_PART_SEGMENT
        ? r * r * (extent - Math.sin(extent)) / 2
        : r * r * extent / 2;
    } else if (this.target instanceof GeoConic) {
      const c = this.target;
      const type = c.getConicType();
      if (type === 'circle') {
        const r = c.getRadius();
        if (r <= 0 || !Number.isFinite(r)) {
          this.outputValue.setUndefined();
          return;
        }
        area = Math.PI * r * r;
      } else if (type === 'ellipse') {
        // 椭圆 = πab（此前 getRadius 对非圆回落近似长半轴，丢了短半轴、2 倍误差）
        const canonical = analyzeConic(c.coeffs);
        if (!canonical || !canonical.a || !canonical.b) {
          this.outputValue.setUndefined();
          return;
        }
        area = Math.PI * canonical.a * canonical.b;
      } else {
        // 抛物线/双曲线/退化曲线无面积（此前近似半径兜底产出假有限值）
        this.outputValue.setUndefined();
        return;
      }
    } else {
      this.outputValue.setUndefined();
      return;
    }

    this.outputValue.setValue(area);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric {
    return this.outputValue;
  }
}
