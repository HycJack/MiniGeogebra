import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoLocus } from '../geo/GeoLocus';

/**
 * 数值轨迹算法 ——对标 GeoGebra `Locus[Tracer, Driver]`。
 *
 * 输入：driver（由"参数化路径约束"产生的动点，如圆上点/线段上点，或**数值滑块**）、tracer（依赖 driver 的派生点）
 * 过程：找到 driver 背后的参数滑块 param（t ∈ [tMin, tMax]），均匀采样 N=120 份，
 *       再对相邻距离异常大的区间二分加密（曲率大处补点，官方 PathMover 自适应）；
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
  private readonly maxSamples = 600;
  /** 数值滑块驱动（官方 Locus(Q, a) 形式）：driver 本身就是参数。 */
  private numericDriver: GeoNumeric | null = null;

  constructor(kernel: IKernel, private tracer: GeoPoint, private driver: GeoPoint | GeoNumeric) {
    super(kernel);
    if (driver instanceof GeoNumeric) this.numericDriver = driver;
    this.outputLocus = new GeoLocus(kernel, [], []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.driver, this.tracer];
    this.setOutput([this.outputLocus]);
  }

  /** 滑块驱动形式取参数本体（识别器 assignNextLabel 等使用）。 */
  getDriverElement(): GeoPoint | GeoNumeric { return this.driver; }

  compute(): void {
    this.outputLocus.setUndefined();
    this.outputLocus.samples = [];
    this.outputLocus.segments = [];

    if (this.numericDriver) {
      if (!this.tracer.isDefined()) return;
      this.computeWithParam(this.numericDriver, null);
      return;
    }

    if (!this.driver.isDefined() || !this.tracer.isDefined()) {
      return;
    }

    const source = this.getDriverParameterSource();
    if (!source) {
      // driver 没有可调参数（例如自由点），无法生成轨迹
      return;
    }

    this.computeWithParam(source.param, source.algo);
  }

  /** 参数扫描主体（点驱动与滑块驱动共用）。 */
  private computeWithParam(param: GeoNumeric, algo: AlgoElement | null): void {
    const tMin = typeof param.intervalMin === 'number' ? param.intervalMin : 0;
    const tMax = typeof param.intervalMax === 'number' ? param.intervalMax : 2 * Math.PI;
    if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) {
      return;
    }

    const originalT = param.getValue();
    // {t, x, y} 有序列表：自适应加密往里插值
    const samples: Array<{ t: number; x: number; y: number }> = [];
    const sampleAt = (t: number): { x: number; y: number } => {
      param.setValue(t);
      if (algo) {
        algo.compute();                                // 重算约束算法 -> driver 位置更新
        this.kernel.recomputeDependents(this.driver as GeoPoint);
      } else {
        this.kernel.recomputeDependents(param);        // 滑块驱动：直接重算 tracer 链
      }
      return this.tracer.isDefined()
        ? { x: this.tracer.getX(), y: this.tracer.getY() }
        : { x: NaN, y: NaN };
    };

    this.kernel.withBatchedUpdates(() => {
      for (let i = 0; i < this.samplesPerPeriod; i++) {
        const t = tMin + (i / (this.samplesPerPeriod - 1)) * (tMax - tMin);
        const p = sampleAt(t);
        samples.push({ t, x: p.x, y: p.y });
      }

      // 自适应加密（官方 PathMover 曲率自适应）：相邻距离 > 2.5×中位数的区间
      // 二分补点，最多补到 maxSamples、3 轮——尖点/渐近线附近不再折线化
      for (let round = 0; round < 3; round++) {
        const validDists = samples.filter(s => Number.isFinite(s.x))
          .map((s, i, arr) => i > 0 ? Math.hypot(s.x - arr[i - 1].x, s.y - arr[i - 1].y) : Infinity)
          .filter(d => Number.isFinite(d));
        if (validDists.length === 0 || samples.length >= this.maxSamples) break;
        validDists.sort((a, b) => a - b);
        const median = validDists[Math.floor(validDists.length / 2)] || 1;
        const inserts: Array<{ index: number; t: number }> = [];
        for (let i = 1; i < samples.length && samples.length + inserts.length < this.maxSamples; i++) {
          const a = samples[i - 1];
          const b = samples[i];
          if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) continue;
          if (Math.hypot(b.x - a.x, b.y - a.y) > median * this.jumpFactor) {
            inserts.push({ index: i, t: (a.t + b.t) / 2 });
          }
        }
        if (inserts.length === 0) break;
        // 逆序插入保持下标有效
        for (let k = inserts.length - 1; k >= 0; k--) {
          const { index, t } = inserts[k];
          const p = sampleAt(t);
          samples.splice(index, 0, { t, x: p.x, y: p.y });
        }
      }

      // 恢复 driver 原位：回拨 param 并重新计算整条链
      param.setValue(originalT);
      if (algo) {
        algo.compute();
        this.kernel.recomputeDependents(this.driver as GeoPoint);
      } else {
        this.kernel.recomputeDependents(param);
      }
    });

    if (samples.length < 2) {
      return;
    }

    // 剔除无效样本（保持序）
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
