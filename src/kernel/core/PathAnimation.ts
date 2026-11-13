/**
 * 路径点匀速动画器（官方 PathNormalizer/PathMover 的状态机剥离，L6-5）：
 * 2D 弧长表是 3 维安全的（z 缺省 0），任意 PointOn* 算法提供采样器即得
 * "视觉速度恒定"的动画——此前只有圆锥曲线接入，线段/函数等仍参数线性步进。
 *
 * 状态机对齐 GeoNumeric：OSCILLATING 两端反弹、INCREASING/DECREASING 环绕、
 * INCREASING_ONCE 到端停、RANDOM 走参数滑块原通道（随机跳值无需匀速）。
 */

import { GeoNumeric, AnimationType } from '../geo/GeoNumeric';
import { AnimationManager } from './AnimationManager';
import { ArcLengthTable } from './ArcLength';

export interface PathSampler3D {
  tMin: number;
  tMax: number;
  /** 参数 → 采样点（z 可缺省，按 0 处理）；路径空洞返回 null（空扇区反弹）。 */
  pointAt(t: number): { x: number; y: number; z?: number } | null;
  /** 失效签名：载体变形（端点拖动/系数变化）时弧长表重建。 */
  key(): string;
}

const dist3 = (a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): number =>
  Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0));

export class PathAnimator {
  private table: ArcLengthTable | null = null;
  private tableKey = '';
  private arcPos = 0;
  private animDir: 1 | -1 = 1;
  private lastValidT: number | null = null;

  constructor(
    /** 惰性取参数滑块：类字段初始化早于构造器参数属性赋值，不能存引用。 */
    private readonly getParam: () => GeoNumeric,
    private readonly getSampler: () => PathSampler3D | null,
  ) {}

  /** 弧长表（载体签名失效重建）。 */
  private getTable(): { table: ArcLengthTable; sampler: PathSampler3D } | null {
    const sampler = this.getSampler();
    if (!sampler) return null;
    const key = sampler.key();
    if (this.table && key === this.tableKey) return { table: this.table, sampler };
    const table = new ArcLengthTable({
      tMin: sampler.tMin,
      tMax: sampler.tMax,
      pointAt: t => sampler.pointAt(t),
    });
    if (table.total <= 1e-9) return null;
    this.table = table;
    this.tableKey = key;
    this.arcPos = table.arcLengthAt(this.getParam().getValue()) ?? 0;
    return { table, sampler };
  }

  /** 外部改值同步：参数被拖拽/输入栏改写时弧长游标跟回。 */
  private syncIfExternallyChanged(table: ArcLengthTable, sampler: PathSampler3D): void {
    const raw = this.getParam().getValue();
    if (this.lastValidT === null || !Number.isFinite(raw)) return;
    // 最小角差式比较（把参数域当环）：裸差在跨域边界会假阳性
    const width = sampler.tMax - sampler.tMin;
    let diff = raw - this.lastValidT;
    if (width > 0) {
      diff = ((diff % width) + width) % width;
      if (diff > width / 2) diff = width - diff;
    }
    if (Math.abs(diff) > 1e-9) {
      this.arcPos = table.arcLengthAt(this.lastValidT) ?? this.arcPos;
    }
  }

  /**
   * 匀速推进一帧。返回 true 表示已处理（GeoPoint.doAnimationStep 停止下探）。
   * 空洞（采样 null）→ 反弹回最后有效参数；回写前校验其仍有效（载体变形后
   * 旧参数也可能失效——无条件 setValue 会触发 compute→flush 死循环）。
   */
  advance(frameRate: number): boolean {
    const type = this.getParam().animationType;
    if (type === AnimationType.RANDOM || !this.getParam().isAnimating()) {
      return this.getParam().doAnimationStep(frameRate);
    }
    const got = this.getTable();
    if (!got) return this.getParam().doAnimationStep(frameRate);
    const { table, sampler } = got;
    this.syncIfExternallyChanged(table, sampler);

    const speed = Math.abs(this.getParam().animationSpeed) || 1;
    const ds = (table.total * speed) / (AnimationManager.STANDARD_ANIMATION_TIME * frameRate) * this.animDir;
    this.arcPos += ds;

    switch (type) {
      case AnimationType.OSCILLATING:
        if (this.arcPos >= table.total) { this.arcPos = table.total; this.animDir = -1; }
        else if (this.arcPos <= 0) { this.arcPos = 0; this.animDir = 1; }
        break;
      case AnimationType.INCREASING_ONCE:
        if (this.arcPos >= table.total) {
          this.arcPos = table.total;
          this.getParam().setAnimating(false);
        }
        break;
      default:
        break; // INCREASING/DECREASING：tAtArcLength 内部环绕
    }

    const newT = table.tAtArcLength(this.arcPos);
    if (newT === null) return false;
    if (!sampler.pointAt(newT)) {
      this.animDir = this.animDir === 1 ? -1 : 1;
      if (this.lastValidT !== null && sampler.pointAt(this.lastValidT)) {
        this.getParam().setValue(this.lastValidT);
        this.arcPos = table.arcLengthAt(this.lastValidT) ?? this.arcPos;
      }
      return true;
    }
    this.lastValidT = newT;
    this.getParam().setValue(newT);
    return true;
  }
}
