import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoLocus3D } from '../geo/GeoLocus3D';

/**
 * C5：3D 空间轨迹 —— 对标 GeoGebra `AlgoLocusND`。
 * 与 2D `AlgoLocus` 同构：沿 driver 背后的参数滑块均匀采样，
 * 干算依赖链记录 tracer 的 (x, y, z)，跳跃处断段。
 *
 * driver 必须是 path/region 上的约束点（parentAlgo 含 GeoNumeric）。
 */
export class AlgoLocus3D extends AlgoElement {
  private outputLocus: GeoLocus3D;
  private readonly samplesPerPeriod = 120;
  private readonly jumpFactor = 2.5;

  constructor(kernel: IKernel, private tracer: GeoPoint3D, private driver: GeoPoint3D) {
    super(kernel);
    this.outputLocus = new GeoLocus3D(kernel, [], []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.driver, this.tracer];
    this.setOutput([this.outputLocus]);
  }

  getOutputLocus(): GeoLocus3D { return this.outputLocus; }

  compute(): void {
    this.outputLocus.setUndefined();
    this.outputLocus.samples = [];
    this.outputLocus.segments = [];

    if (!this.driver.isDefined() || !this.tracer.isDefined()) return;

    const source = this.getDriverParameterSource();
    if (!source) return; // 自由点无参数，无法生成轨迹

    const { algo, param } = source;
    const tMin = typeof param.intervalMin === 'number' ? param.intervalMin : 0;
    const tMax = typeof param.intervalMax === 'number' ? param.intervalMax : 2 * Math.PI;
    if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) return;

    const originalT = param.getValue();
    const samples: Array<{ x: number; y: number; z: number }> = [];

    this.kernel.withBatchedUpdates(() => {
      for (let i = 0; i < this.samplesPerPeriod; i++) {
        const t = tMin + (i / (this.samplesPerPeriod - 1)) * (tMax - tMin);
        param.setValue(t);
        algo.compute();
        this.kernel.recomputeDependents(this.driver);
        if (this.tracer.isDefined()) {
          samples.push({ x: this.tracer.getX(), y: this.tracer.getY(), z: this.tracer.getZ() });
        } else {
          samples.push({ x: NaN, y: NaN, z: NaN });
        }
      }
      param.setValue(originalT);
      algo.compute();
      this.kernel.recomputeDependents(this.driver);
    });

    const valid = samples.filter(s => Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z));
    if (valid.length < 2) return;

    const stepEst = this.estimateStep(valid);
    const segments: Array<{ start: number; end: number }> = [];
    let segStart = 0;
    for (let i = 1; i < valid.length; i++) {
      const a = valid[i - 1];
      const b = valid[i];
      const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
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

  /** 沿 driver 的 parentAlgo 链找到含 GeoNumeric 的路径约束算法。 */
  private getDriverParameterSource(): { algo: AlgoElement; param: GeoNumeric } | null {
    let algo: AlgoElement | null = this.driver.parentAlgo;
    const seen = new Set<AlgoElement>();
    while (algo && !seen.has(algo)) {
      seen.add(algo);
      for (const inp of algo.getInput()) {
        if (inp instanceof GeoNumeric) return { algo, param: inp };
      }
      algo = algo.parentAlgo;
    }
    return null;
  }

  private estimateStep(pts: Array<{ x: number; y: number; z: number }>): number {
    const dists: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      dists.push(Math.hypot(
        pts[i].x - pts[i - 1].x,
        pts[i].y - pts[i - 1].y,
        pts[i].z - pts[i - 1].z,
      ));
    }
    if (dists.length === 0) return 1;
    dists.sort((a, b) => a - b);
    return dists[Math.floor(dists.length / 2)] || 1;
  }
}
