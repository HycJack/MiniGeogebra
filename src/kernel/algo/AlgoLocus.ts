import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoLocus } from '../geo/GeoLocus';

/**
 * 数值轨迹算法 ——对标 GeoGebra `Locus[Tracer, Driver]`。
 *
 * 输入：driver（由"参数化路径约束"产生的动点，如圆上点/线段上点）、tracer（依赖 driver 的派生点）
 * 过程：找到 driver 背后的参数滑块 param（t ∈ [tMin, tMax]），均匀采样 N=120 份；
 *       每份把 param 设为采样值并干算依赖链，记录 tracer 当前位置；
 *       最后把 param 与 driver 恢复到原位。全程在批处理中进行，避免闪烁。
 * 输出：[GeoLocus 曲线]（相邻采样点距离突变的"跳跃"处会自动断开）。
 *
 * 适用情形：driver 是"圆上点 / 线段上点 / 直线上点"等受参数约束的点。
 * 自由点没有可调参数，不能作为驱动点。
 */
export class AlgoLocus extends AlgoElement {
  private outputLocus: GeoLocus;
  private readonly samplesPerPeriod = 120;
  private readonly jumpFactor = 2.5;

  constructor(kernel: IKernel, private tracer: GeoPoint, private driver: GeoPoint) {
    super(kernel);
    this.outputLocus = new GeoLocus(kernel, [], []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.driver, this.tracer];
    this.setOutput([this.outputLocus]);
  }

  compute(): void {
    this.outputLocus.setUndefined();
    this.outputLocus.samples = [];
    this.outputLocus.segments = [];

    if (!this.driver.isDefined() || !this.tracer.isDefined()) {
      return;
    }

    const source = this.getDriverParameterSource();
    if (!source) {
      // driver 没有可调参数（例如自由点），无法生成轨迹
      return;
    }

    const { algo, param } = source;
    const tMin = typeof param.intervalMin === 'number' ? param.intervalMin : 0;
    const tMax = typeof param.intervalMax === 'number' ? param.intervalMax : 2 * Math.PI;
    if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) {
      return;
    }

    const originalT = param.getValue();
    const samples: Array<{ x: number; y: number }> = [];

    this.kernel.withBatchedUpdates(() => {
      for (let i = 0; i < this.samplesPerPeriod; i++) {
        const t = tMin + (i / (this.samplesPerPeriod - 1)) * (tMax - tMin);
        param.setValue(t);
        algo.compute();                       // 重算约束算法 -> driver 位置更新
        this.kernel.recomputeDependents(this.driver); // 重算依赖链 -> tracer 位置更新
        if (this.tracer.isDefined()) {
          samples.push({ x: this.tracer.getX(), y: this.tracer.getY() });
        } else {
          samples.push({ x: NaN, y: NaN });
        }
      }
      // 恢复 driver 原位：回拨 param 并重新计算整条链
      param.setValue(originalT);
      algo.compute();
      this.kernel.recomputeDependents(this.driver);
    });

    if (samples.length < 2) {
      return;
    }

    // 剔除无效样本
    const valid = samples.filter(s => Number.isFinite(s.x) && Number.isFinite(s.y));
    if (valid.length < 2) {
      return;
    }

    const stepEst = this.estimateStep(valid);
    const segments: Array<{ start: number; end: number }> = [];
    let segStart = 0;
    for (let i = 1; i < valid.length; i++) {
      const dist = Math.hypot(valid[i].x - valid[i - 1].x, valid[i].y - valid[i - 1].y);
      if (dist > stepEst * this.jumpFactor) {
        segments.push({ start: segStart, end: i - 1 });
        segStart = i;
      }
    }
    segments.push({ start: segStart, end: valid.length - 1 });

    this.outputLocus.samples = valid;
    this.outputLocus.segments = segments;
    this.outputLocus.setDefined();
  }

  /** 沿 driver 的 parentAlgo 链向上追溯，找到提供参数的"路径约束算法"。 */
  private getDriverParameterSource(): { algo: AlgoElement; param: GeoNumeric } | null {
    let algo: AlgoElement | null = this.driver.parentAlgo;
    const seen = new Set<AlgoElement>();
    while (algo && !seen.has(algo)) {
      seen.add(algo);
      for (const inp of algo.getInput()) {
        if (inp instanceof GeoNumeric) {
          return { algo, param: inp };
        }
      }
      algo = algo.parentAlgo;
    }
    return null;
  }

  /** 估计相邻采样点的典型距离（中位数），用于判断"跳跃" */
  private estimateStep(pts: Array<{ x: number; y: number }>): number {
    const dists: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      dists.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    if (dists.length === 0) return 1;
    dists.sort((a, b) => a - b);
    const mid = Math.floor(dists.length / 2);
    return dists[mid] || 1;
  }

  getOutputLocus(): GeoLocus {
    return this.outputLocus;
  }
}
