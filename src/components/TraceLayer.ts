/**
 * 轨迹层（对标 GeoGebra Trace）：对象移动时在画布上留下残影。
 *
 * 设计：每帧对开启 trace 的对象计算"位置签名"，签名变化才追加一次 stamp
 * （屏幕坐标），stamp 列表按对象分组保存、有上限；视图平移/缩放时整体清空
 * （GeoGebra 同款行为）。重绘由 GeometryCanvas 在渲染循环末尾调用。
 *
 * 本模块不依赖 DOM/React：stamps 是纯数据，便于单测。
 */

import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';

/** 单条轨迹残影（屏幕坐标）。 */
export interface TraceStamp {
  kind: 'point' | 'line' | 'circle' | 'polygon';
  /** point: [sx, sy]；line: [sx1, sy1, sx2, sy2]；circle: [sx, sy, sr]；polygon: [sx, sy, …] */
  data: number[];
  color: string;
}

/** 每个对象保留的最大残影数（约等于最近 N 次位置变化）。 */
export const MAX_STAMPS_PER_ELEMENT = 150;

const p = (v: number): number => Math.round(v * 100) / 100;

/** 位置签名：变化才追加深影；不可追踪类型返回 null。 */
export function elementTraceSignature(el: GeoElement): string | null {
  if (el instanceof GeoPoint) return `p:${p(el.getX())},${p(el.getY())}`;
  if (el instanceof GeoSegment) {
    return `s:${p(el.startPoint.getX())},${p(el.startPoint.getY())},${p(el.endPoint.getX())},${p(el.endPoint.getY())}`;
  }
  if (el instanceof GeoVector) {
    return `v:${p(el.startX)},${p(el.startY)},${p(el.endX)},${p(el.endY)}`;
  }
  if (el instanceof GeoPolygon) {
    return `g:${el.vertices.map(v => `${p(v.getX())},${p(v.getY())}`).join(';')}`;
  }
  if (el instanceof GeoConic && el.isCircle()) {
    const c = el.getCenter();
    return `c:${p(c.x)},${p(c.y)},${p(el.getRadius())}`;
  }
  return null;
}

/** 世界坐标 → 屏幕坐标的 stamp 数据；不可追踪返回 null。 */
export function elementTraceStamps(el: GeoElement, coord: CoordinateSystem): TraceStamp[] | null {
  const sx = (wx: number) => coord.xZero + wx * coord.xScale;
  const sy = (wy: number) => coord.yZero - wy * coord.yScale;
  const color = el.strokeColor ?? el.defaultStrokeColor;

  if (el instanceof GeoPoint) {
    return [{ kind: 'point', data: [sx(el.getX()), sy(el.getY())], color }];
  }
  if (el instanceof GeoSegment) {
    return [{
      kind: 'line',
      data: [sx(el.startPoint.getX()), sy(el.startPoint.getY()), sx(el.endPoint.getX()), sy(el.endPoint.getY())],
      color,
    }];
  }
  if (el instanceof GeoVector) {
    return [{ kind: 'line', data: [sx(el.startX), sy(el.startY), sx(el.endX), sy(el.endY)], color }];
  }
  if (el instanceof GeoPolygon) {
    const flat = el.vertices.flatMap(v => [sx(v.getX()), sy(v.getY())]);
    return flat.length >= 6 ? [{ kind: 'polygon', data: flat, color }] : null;
  }
  if (el instanceof GeoConic && el.isCircle()) {
    const c = el.getCenter();
    return [{ kind: 'circle', data: [sx(c.x), sy(c.y), el.getRadius() * coord.xScale], color }];
  }
  return null;
}

/**
 * 轨迹记录器：按元素 id 保存 stamp 列表；update 追加新残影。
 */
export class TraceRecorder {
  private records = new Map<string, TraceStamp[]>();
  private signatures = new Map<string, string>();

  /** 帧驱动：签名变化才追加深影，返回是否产生了新 stamp。 */
  update(els: readonly GeoElement[], coord: CoordinateSystem): boolean {
    let changed = false;
    for (const el of els) {
      if (!el.trace || el.visible === false) continue;
      const sig = elementTraceSignature(el);
      if (sig === null) continue;
      if (this.signatures.get(el.id) === sig) continue;
      this.signatures.set(el.id, sig);
      if (!el.isDefined()) continue;
      const stamps = elementTraceStamps(el, coord);
      if (!stamps) continue;
      const list = this.records.get(el.id) ?? [];
      list.push(...stamps);
      while (list.length > MAX_STAMPS_PER_ELEMENT) list.shift();
      this.records.set(el.id, list);
      changed = true;
    }
    return changed;
  }

  /** 视口变化时整体清空（GeoGebra 同款：平移/缩放后旧轨迹失去意义）。 */
  clear(): void {
    if (this.records.size === 0 && this.signatures.size === 0) return;
    this.records.clear();
    this.signatures.clear();
  }

  remove(id: string): void {
    this.records.delete(id);
    this.signatures.delete(id);
  }

  /** 清理已不存在于构造中的元素（删除后残影消失）。 */
  prune(aliveIds: Set<string>): boolean {
    let removed = false;
    for (const id of [...this.records.keys()]) {
      if (!aliveIds.has(id)) { this.records.delete(id); this.signatures.delete(id); removed = true; }
    }
    return removed;
  }

  /** 仅读取（重绘用）：按对象分组的 stamp 列表；visible=false 的对象残影也隐藏。 */
  getStamps(visibilityOf: (id: string) => boolean): TraceStamp[] {
    const out: TraceStamp[] = [];
    for (const [id, list] of this.records) {
      if (!visibilityOf(id)) continue;
      out.push(...list);
    }
    return out;
  }
}

/** 把 stamps 画到 2D 上下文（半透明细线，残影质感）。 */
export function drawTraceStamps(ctx: CanvasRenderingContext2D, stamps: readonly TraceStamp[]): void {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  for (const stamp of stamps) {
    ctx.strokeStyle = stamp.color;
    ctx.fillStyle = stamp.color;
    if (stamp.kind === 'point') {
      ctx.beginPath();
      ctx.arc(stamp.data[0], stamp.data[1], 3.5, 0, 2 * Math.PI);
      ctx.fill();
    } else if (stamp.kind === 'line') {
      ctx.beginPath();
      ctx.moveTo(stamp.data[0], stamp.data[1]);
      ctx.lineTo(stamp.data[2], stamp.data[3]);
      ctx.stroke();
    } else if (stamp.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(stamp.data[0], stamp.data[1], stamp.data[2], 0, 2 * Math.PI);
      ctx.stroke();
    } else if (stamp.kind === 'polygon') {
      ctx.beginPath();
      ctx.moveTo(stamp.data[0], stamp.data[1]);
      for (let i = 2; i < stamp.data.length; i += 2) ctx.lineTo(stamp.data[i], stamp.data[i + 1]);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}
