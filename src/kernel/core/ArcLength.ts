/**
 * 弧长参数化表（官方 PathNormalizer/PathMover 的等价物）：
 * 路径点动画按"参数线性步进"时，曲率大处视觉速度远高于平缓处（双曲线渐近线
 * 附近、抛物线远端尤甚）。本表把参数域采样成累积弧长，动画步进按弧长均匀，
 * 再反查参数——视觉速度恒定。
 */

export interface ArcLengthSampler {
  /** 参数域 [tMin, tMax]。 */
  tMin: number;
  tMax: number;
  /** 参数 → 采样点（z 可缺省按 0）；路径空洞（如双曲线空扇区）返回 null。 */
  pointAt(t: number): { x: number; y: number; z?: number } | null;
  /** 采样数（默认 360）。 */
  samples?: number;
}

export class ArcLengthTable {
  /** 采样参数与累积弧长（_ts[0]=tMin 对应 0，递增）。无效采样点不累积。 */
  private ts: number[] = [];
  private ss: number[] = [];
  /** 有效段区间（空洞被剔除）：动画反查只在有效段内进行。 */
  readonly total = 0;

  constructor(sampler: ArcLengthSampler) {
    const n = sampler.samples ?? 360;
    const width = sampler.tMax - sampler.tMin;
    let acc = 0;
    let prev: { x: number; y: number; z?: number } | null = null;
    let prevT = 0;
    for (let i = 0; i <= n; i++) {
      const t = sampler.tMin + (width * i) / n;
      const p = sampler.pointAt(t);
      if (p && prev) {
        acc += Math.hypot(p.x - prev.x, p.y - prev.y, (p.z ?? 0) - (prev.z ?? 0));
        this.ts.push(t);
        this.ss.push(acc);
      } else if (p && !prev) {
        // 段首（或空洞后的新段起点）
        this.ts.push(t);
        this.ss.push(acc);
      }
      if (p) {
        prev = p;
        prevT = t;
      } else {
        prev = null; // 空洞：断开累积
      }
    }
    (this as { total: number }).total = acc;
    void prevT;
  }

  /** 参数 → 弧长（正查线性插值；空洞之间返回洞前累积值）。 */
  arcLengthAt(t: number): number | null {
    if (this.ts.length < 2) return null;
    const tt = ((t - this.ts[0]) % (this.ts[this.ts.length - 1] - this.ts[0]) + (this.ts[this.ts.length - 1] - this.ts[0]))
      % (this.ts[this.ts.length - 1] - this.ts[0]) + this.ts[0];
    // 二分找 ts[i-1] <= tt <= ts[i]
    let lo = 0;
    let hi = this.ts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ts[mid] < tt) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const t0 = this.ts[i - 1];
    const t1 = this.ts[i];
    if (t1 <= t0) return this.ss[i - 1];
    const f = (tt - t0) / (t1 - t0);
    // 跨空洞（参数间距异常大）不插值，取洞前值
    const domainStepA = (this.ts[this.ts.length - 1] - this.ts[0]) / Math.max(1, this.ts.length - 1);
    if (Math.abs(t1 - t0) > domainStepA * 4) return this.ss[i - 1];
    return this.ss[i - 1] + f * (this.ss[i] - this.ss[i - 1]);
  }

  /** 弧长 → 参数（有效段内二分反查；空洞两侧不跨段插值）。 */
  tAtArcLength(s: number): number | null {
    if (this.ts.length < 2 || this.total <= 0) return null;
    // 归一到 [0, total)
    const wrapped = ((s % this.total) + this.total) % this.total;
    // 二分找 ss[i] <= wrapped < ss[i+1]
    let lo = 0;
    let hi = this.ss.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ss[mid] < wrapped) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const s0 = this.ss[i - 1];
    const s1 = this.ss[i];
    const t0 = this.ts[i - 1];
    const t1 = this.ts[i];
    if (s1 <= s0) return t1;
    const f = (wrapped - s0) / (s1 - s0);
    // 跨空洞的相邻条目（参数距离异常大）不插值，直接取右端
    if (Math.abs(t1 - t0) > (this.ts[1] - this.ts[0]) * 4) return t1;
    return t0 + f * (t1 - t0);
  }
}
