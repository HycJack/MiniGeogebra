/**
 * 圆锥曲线周长 / 弧长测量（对标 CmdLength 的 AlgoArcLength 与 CmdPerimeter/
 * CmdCircumference 的 AlgoPerimeter conic 分支）。此前全仓库无任何弧长计算。
 *
 * 语义（官方 GeoConicPartParameters / AlgoAreaConic 对应量）：
 *   圆        → 2πr
 *   椭圆      → Ramanujan 近似 π[3(a+b) − √((3a+b)(a+3b))]（高精度闭式）
 *   弧 (ARC)  → r·extent（Length(arc) / Perimeter(arc) 同值）
 *   扇形      → r·extent + 2r（弧长 + 两条半径）
 *   弓形      → r·extent + 弦长（弧长 + 底边）
 *   其他      → undefined
 * 输入为活引用：弧/圆随端点/半径拖动联动重算。
 */
import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoConic } from '../geo/GeoConic';
import { GeoConicPart, CONIC_PART_ARC, CONIC_PART_SECTOR } from '../geo/GeoConicPart';
import { GeoNumeric } from '../geo/GeoNumeric';
import { analyzeConic } from '../geo/conicSolve';
import { arcSweep } from '../geo/GeoArc';

export class AlgoConicPerimeter extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(
    kernel: IKernel,
    private target: GeoConic,
    /** true = Length 语义（弧/弓形只算弧长/弧长+弦）；false = Perimeter 语义 */
    private asLength = false,
  ) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, 0);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.target];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const part = this.target instanceof GeoConicPart ? this.target : null;
    const type = this.target.getConicType();

    // 弧段（GeoConicPart）：extent 由起止角与扫向导出。
    // Length 一律取弧长 r·extent（官方 AlgoArcLength）；
    // Perimeter：弧=弧长、扇形=弧长+2r、弓形=弧长+弦。
    if (part) {
      const r = part.getRadius();
      if (r <= 0 || !Number.isFinite(r)) {
        this.outputValue.setUndefined();
        return;
      }
      const extent = arcSweep(part.getStartAngle(), part.getEndAngle(), part.isCounterClockwise());
      const arcLen = r * extent;
      if (!this.asLength && part.isSector()) {
        this.outputValue.setValue(arcLen + 2 * r);
      } else if (!this.asLength && part.getPartType() === 2) {
        // 弓形：弧长 + 底边弦长
        const chord = 2 * r * Math.sin(extent / 2);
        this.outputValue.setValue(arcLen + chord);
      } else {
        this.outputValue.setValue(arcLen);
      }
      this.outputValue.setDefined();
      return;
    }

    if (type === 'circle') {
      const r = this.target.getRadius();
      if (r <= 0 || !Number.isFinite(r)) {
        this.outputValue.setUndefined();
        return;
      }
      this.outputValue.setValue(2 * Math.PI * r);
      this.outputValue.setDefined();
      return;
    }
    if (type === 'ellipse') {
      const canonical = analyzeConic(this.target.coeffs);
      if (!canonical || !canonical.a || !canonical.b) {
        this.outputValue.setUndefined();
        return;
      }
      const a = canonical.a, b = canonical.b;
      // Ramanujan 近似（官方 commons-math 椭圆周长同为闭式近似族）
      const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
      this.outputValue.setValue(perimeter);
      this.outputValue.setDefined();
      return;
    }
    this.outputValue.setUndefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }

  /** Length 语义标记（序列化 roundtrip 用）。 */
  getAsLength(): boolean { return this.asLength; }
}
