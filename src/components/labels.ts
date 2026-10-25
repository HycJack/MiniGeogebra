/**
 * 标签锚点计算（绘制与命中测试共用的单一事实源）。
 *
 * GeoGebra 语义：每类对象有默认标签锚点，用户可拖动标签产生偏移
 * （labelOffsetX/Y 为**屏幕像素**，+x 向右、+y 向下），绘制与命中都走这里，
 * 保证"画在哪就能点哪"。
 */

import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoRay } from '../kernel/geo/GeoRay';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoPolyLine } from '../kernel/geo/GeoPolyLine';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoArc } from '../kernel/geo/GeoArc';
import { GeoConicPart } from '../kernel/geo/GeoConicPart';

export interface LabelAnchor {
  x: number;
  y: number;
  align: 'left' | 'center' | 'right';
  baseline: 'top' | 'middle' | 'bottom';
}

/** 可视区（世界坐标），与 drawHelpers.DrawBounds 同构。 */
export interface LabelBounds { minX: number; maxX: number; minY: number; maxY: number; }

/**
 * 直线在可视矩形内的两个端点（"可见弦"）。
 * 从 tools/hitTests 迁入：labels 不可反向 import hitTests（hitTests 依赖本模块）。
 */
export function lineWorldEndpoints(
  line: { a: number; b: number; c: number },
  bounds: LabelBounds,
): { p0: { x: number; y: number }; p1: { x: number; y: number } } | null {
  const { minX, maxX, minY, maxY } = bounds;
  const { a, b, c } = line;
  let p0: { x: number; y: number } | null = null;
  let p1: { x: number; y: number } | null = null;
  const tryP = (x: number, y: number) => {
    if (x >= minX - 1e-9 && x <= maxX + 1e-9 && y >= minY - 1e-9 && y <= maxY + 1e-9) {
      if (!p0) p0 = { x, y };
      else if (!p1) { p1 = { x, y }; return true; }
    }
    return false;
  };
  if (Math.abs(b) > 1e-12) {
    tryP(minX, (-c - a * minX) / b);
    tryP(maxX, (-c - a * maxX) / b);
  }
  if (Math.abs(a) > 1e-12) {
    tryP((-c - b * minY) / a, minY);
    tryP((-c - b * maxY) / a, maxY);
  }
  return p0 && p1 ? { p0, p1 } : null;
}

/**
 * 各类对象标签的默认锚点（不含用户偏移；px 为屏幕空间基准偏移）。
 * bounds：可视区（世界坐标）。直线标签取**视口内可见弦的中点**——否则"离原点最近的点"
 * 会让过原点的所有直线标签叠在一点、且视口平移后锚点落到屏幕外（P1-4）。
 * 直线整条在视口外时返回 null（不画标签、不参与标签命中）。
 */
export function getLabelAnchor(el: GeoElement, scale: number, bounds?: LabelBounds): LabelAnchor | null {
  const offset = (el: GeoElement, base: number) => ({
    dx: (base + el.labelOffsetX) / scale,
    // 屏幕向下 = 世界 y 减小
    dy: (base - el.labelOffsetY) / scale,
  });

  if (el instanceof GeoPoint) {
    const o = offset(el, 12);
    return { x: el.getX() + o.dx, y: el.getY() + o.dy, align: 'left', baseline: 'bottom' };
  }
  if (el instanceof GeoSegment) {
    const o = offset(el, 10);
    return {
      x: (el.startPoint.getX() + el.endPoint.getX()) / 2 + o.dx,
      y: (el.startPoint.getY() + el.endPoint.getY()) / 2 + o.dy,
      align: 'left', baseline: 'bottom',
    };
  }
  if (el instanceof GeoVector) {
    const o = offset(el, 10);
    return { x: (el.startX + el.endX) / 2 + o.dx, y: (el.startY + el.endY) / 2 + o.dy, align: 'left', baseline: 'bottom' };
  }
  if (el instanceof GeoPolyLine) {
    const vs = el.vertices;
    if (vs.length < 2) return null;
    const mid = vs[Math.floor(vs.length / 2)];
    const o = offset(el, 10);
    return { x: mid.getX() + o.dx, y: mid.getY() + o.dy, align: 'left', baseline: 'bottom' };
  }
  if (el instanceof GeoPolygon) {
    const vs = el.vertices;
    if (vs.length === 0) return null;
    const cx = vs.reduce((s, v) => s + v.getX(), 0) / vs.length;
    const cy = vs.reduce((s, v) => s + v.getY(), 0) / vs.length;
    const o = offset(el, 10);
    return { x: cx + o.dx, y: cy + o.dy, align: 'left', baseline: 'bottom' };
  }
  if (el instanceof GeoRay) {
    const sp = el.getStartPoint();
    const dp = el.getSecondPoint();
    const dx = dp.getX() - sp.getX(), dy = dp.getY() - sp.getY();
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) return null;
    const o = offset(el, 10);
    // 沿射线方向 30px 处放标签，避开起点已标注的点
    const t = 30 / scale;
    return { x: sp.getX() + (dx / len) * t + o.dx, y: sp.getY() + (dy / len) * t + o.dy, align: 'left', baseline: 'bottom' };
  }
  if (el instanceof GeoLine) {
    const len2 = el.a * el.a + el.b * el.b;
    if (len2 < 1e-12) return null;
    const o = offset(el, 10);
    // 有视口：取可见弦的中点（随视图平移/缩放跟随，绘制与命中传同一 bounds 保持一致）
    if (bounds) {
      const chord = lineWorldEndpoints(el, bounds);
      if (!chord) return null;
      return {
        x: (chord.p0.x + chord.p1.x) / 2 + o.dx,
        y: (chord.p0.y + chord.p1.y) / 2 + o.dy,
        align: 'left', baseline: 'bottom',
      };
    }
    // 无视口（兜底）：离原点最近的点
    return {
      x: -el.a * el.c / len2 + o.dx,
      y: -el.b * el.c / len2 + o.dy,
      align: 'left', baseline: 'bottom',
    };
  }
  if (el instanceof GeoConicPart || el instanceof GeoArc) {
    const c = (el as GeoConic).getCenter();
    const r = (el as GeoConic).getRadius();
    const o = offset(el, 10);
    return { x: c.x + r + o.dx, y: c.y + o.dy, align: 'left', baseline: 'bottom' };
  }
  if (el instanceof GeoConic) {
    const c = el.getCenter();
    const o = offset(el, 10);
    if (el.isCircle()) {
      return { x: c.x + el.getRadius() + o.dx, y: c.y + o.dy, align: 'left', baseline: 'bottom' };
    }
    return { x: c.x + o.dx, y: c.y + o.dy, align: 'left', baseline: 'bottom' };
  }
  // 函数/曲线/轨迹/文本等：标签由各自的绘制逻辑处理（视口相关），不参与拖动
  return null;
}

/** 标签是否参与绘制/拖动（与绘制层的显示条件一致：always 才显示）。 */
export function labelDrawable(el: GeoElement): boolean {
  return el.labelVisible && el.labelMode === 'always' && !!el.label;
}
