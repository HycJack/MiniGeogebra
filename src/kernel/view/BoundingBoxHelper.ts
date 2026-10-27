import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoSegment } from '../geo/GeoSegment';
import { GeoRay } from '../geo/GeoRay';
import { GeoConic } from '../geo/GeoConic';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoPolyLine } from '../geo/GeoPolyLine';
import { GeoVector } from '../geo/GeoVector';
import { GeoText } from '../geo/GeoText';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoCurve } from '../geo/GeoCurve';
import { GeoLocus } from '../geo/GeoLocus';
import { GeoInequality } from '../geo/GeoInequality';
import { GeoElement } from '../geo/GeoElement';

/** 轴对齐矩形（世界坐标） */
export interface Rect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * 单个元素的有限包围盒（zoom-to-fit 用）。
 * 直线/函数曲线/轨迹等"无限"对象返回 null，不参与"显示全部对象"的取景。
 */
export function getElementBounds(el: GeoElement): Rect | null {
  const unionPt = (x: number, y: number, r: Rect | null): Rect =>
    r ? { minX: Math.min(r.minX, x), maxX: Math.max(r.maxX, x), minY: Math.min(r.minY, y), maxY: Math.max(r.maxY, y) }
      : { minX: x, maxX: x, minY: y, maxY: y };

  let rect: Rect | null = null;
  if (el instanceof GeoPoint) {
    rect = unionPt(el.getX(), el.getY(), rect);
  } else if (el instanceof GeoSegment) {
    rect = unionPt(el.startPoint.getX(), el.startPoint.getY(), rect);
    rect = unionPt(el.endPoint.getX(), el.endPoint.getY(), rect);
  } else if (el instanceof GeoPolyLine) {
    for (const v of el.vertices) rect = unionPt(v.getX(), v.getY(), rect);
  } else if (el instanceof GeoPolygon) {
    for (const v of el.vertices) rect = unionPt(v.getX(), v.getY(), rect);
  } else if (el instanceof GeoVector) {
    rect = unionPt(el.startX, el.startY, rect);
    rect = unionPt(el.endX, el.endY, rect);
  } else if (el instanceof GeoConic && el.isDefined()) {
    const c = el.getCenter();
    const r = el.getApproxRadius();
    if (Number.isFinite(r) && r > 0) {
      rect = { minX: c.x - r, maxX: c.x + r, minY: c.y - r, maxY: c.y + r };
    }
  } else if (el instanceof GeoText) {
    rect = unionPt(el.x, el.y, rect);
  } else if (typeof (el as any).contours !== 'undefined') {
    const contours = (el as unknown as { contours: { x: number; y: number }[][] }).contours;
    for (const contour of contours) {
      for (const p of contour) rect = unionPt(p.x, p.y, rect);
    }
  }
  return rect;
}

/**
 * 判断单个几何元素是否与选择框相交。
 * 类型覆盖对标官方 drawable 的 isInRectangle：此前只有 6 类，射线/向量/折线/
 * 函数/曲线/文本/轨迹/不等式全部框不中（框住整条函数曲线松手选集为空）。
 */
export function elementIntersectsRect(el: GeoElement, rect: Rect, eps: number = 5): boolean {
  if (el instanceof GeoPoint) {
    return (
      rect.minX - eps <= el.getX() &&
      el.getX() <= rect.maxX + eps &&
      rect.minY - eps <= el.getY() &&
      el.getY() <= rect.maxY + eps
    );
  }
  if (el instanceof GeoSegment) {
    const s = el as GeoSegment;
    if (ptInRect(s.startPoint, rect, eps) || ptInRect(s.endPoint, rect, eps)) return true;
    return segmentIntersectsRect(s.startPoint, s.endPoint, rect, eps);
  }
  if (el instanceof GeoRay) {
    // 射线：起点 + 沿方向的足够长线段与矩形求交
    const r = el as GeoRay;
    const dx = r.secondPoint.getX() - r.startPoint.getX();
    const dy = r.secondPoint.getY() - r.startPoint.getY();
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) return ptInRect(r.startPoint, rect, eps);
    const far = 1e5;
    return ptInRect(r.startPoint, rect, eps) ||
      segmentXYIntersectsRect(
        { x: r.startPoint.getX(), y: r.startPoint.getY() },
        { x: r.startPoint.getX() + (dx / len) * far, y: r.startPoint.getY() + (dy / len) * far },
        rect, eps);
  }
  if (el instanceof GeoVector) {
    const v = el as GeoVector;
    if (ptInRect({ x: v.startX, y: v.startY }, rect, eps) || ptInRect({ x: v.endX, y: v.endY }, rect, eps)) return true;
    return segmentXYIntersectsRect({ x: v.startX, y: v.startY }, { x: v.endX, y: v.endY }, rect, eps);
  }
  if (el instanceof GeoPolyLine) {
    const poly = el as GeoPolyLine;
    for (const v of poly.vertices) {
      if (ptInRect(v, rect, eps)) return true;
    }
    const vs = poly.vertices;
    for (let i = 0; i + 1 < vs.length; i++) {
      if (segmentIntersectsRect(vs[i], vs[i + 1], rect, eps)) return true;
    }
    return false;
  }
  if (el instanceof GeoLine) {
    const l = el as GeoLine;
    let minDist = Infinity;
    for (const corner of corners(rect)) {
      const len = Math.hypot(l.a, l.b);
      if (len === 0) continue;
      const d = Math.abs(l.a * corner.x + l.b * corner.y + l.c) / len;
      minDist = Math.min(minDist, d);
    }
    return minDist <= eps;
  }
  if (el instanceof GeoConic) {
    const c = el as GeoConic;
    if (!c.isDefined()) return false;
    const center = c.getCenter();
    const r = c.getRadius();
    if (r <= 0) return false;
    if (ptInRect(center, rect, eps)) return true;
    const dx = Math.max(rect.minX - center.x, 0, center.x - rect.maxX);
    const dy = Math.max(rect.minY - center.y, 0, center.y - rect.maxY);
    return Math.hypot(dx, dy) <= r + eps;
  }
  // 函数/参数曲线/轨迹：采样折线与矩形求交（无限对象不取 bbox，逐段判定）
  if (el instanceof GeoFunction || el instanceof GeoCurve || el instanceof GeoLocus) {
    const samples = (el as GeoFunction | GeoCurve | GeoLocus).getSamples?.() ?? [];
    const pts = samples.map((s: { x: number; y: number } | { getX(): number; getY(): number }) =>
      'getX' in s ? { x: (s as any).getX(), y: (s as any).getY() } : { x: (s as any).x, y: (s as any).y });
    for (const p of pts) {
      if (ptInRect(p as { x: number; y: number }, rect, eps)) return true;
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      if (segmentXYIntersectsRect(pts[i] as { x: number; y: number }, pts[i + 1] as { x: number; y: number }, rect, eps)) return true;
    }
    return false;
  }
  if (el instanceof GeoText) {
    // 与 hitTests 同一 14px 字号估算
    const w = el.text.length * 9;
    const h = 16;
    const m = eps;
    return el.x - m <= rect.maxX && el.x + w + m >= rect.minX &&
           el.y - h - m <= rect.maxY && el.y + h + m >= rect.minY;
  }
  if (el instanceof GeoPolygon) {
    const p = el as GeoPolygon;
    for (const v of p.vertices) {
      if (ptInRect(v, rect, eps)) return true;
    }
    if ((p as any).isInRegionXY && corners(rect).some(c => (p as any).isInRegionXY(c.x, c.y))) return true;
    return false;
  }
  if (el instanceof GeoInequality) {
    // 无界区域无 bbox：矩形角点 + 中心任一落在区域内即相交
    if (!el.isDefined()) return false;
    const cx = (rect.minX + rect.maxX) / 2, cy = (rect.minY + rect.maxY) / 2;
    return corners(rect).some(c => el.isInRegionXY(c.x, c.y)) || el.isInRegionXY(cx, cy);
  }
  // GeoBooleanRegion 等带 isInRegionXY 的区域对象
  if (typeof (el as any).isInRegionXY === 'function' && typeof (el as any).contours !== 'undefined') {
    if (corners(rect).some(c => (el as any).isInRegionXY(c.x, c.y))) return true;
    const contours = (el as unknown as { contours: { x: number; y: number }[][] }).contours;
    for (const contour of contours) {
      for (const p of contour) {
        if (ptInRect(p, rect, eps)) return true;
      }
    }
    return false;
  }
  return false;
}

/** 坐标版线段与矩形求交（无 GeoPoint 端点的对象用）。 */
function segmentXYIntersectsRect(
  p1: { x: number; y: number }, p2: { x: number; y: number }, rect: Rect, eps: number): boolean {
  const edges: [{ x: number; y: number }, { x: number; y: number }][] = [
    [{ x: rect.minX, y: rect.minY }, { x: rect.maxX, y: rect.minY }],
    [{ x: rect.maxX, y: rect.minY }, { x: rect.maxX, y: rect.maxY }],
    [{ x: rect.maxX, y: rect.maxY }, { x: rect.minX, y: rect.maxY }],
    [{ x: rect.minX, y: rect.maxY }, { x: rect.minX, y: rect.minY }],
  ];
  for (const edge of edges) {
    if (linesIntersect(p1, p2, edge[0], edge[1], eps)) return true;
  }
  return false;
}

function ptInRect(p: { getX: () => number; getY: () => number } | { x: number; y: number }, rect: Rect, eps: number): boolean {
  const px = 'getX' in p ? (p as any).getX() : (p as any).x;
  const py = 'getY' in p ? (p as any).getY() : (p as any).y;
  return rect.minX - eps <= px && px <= rect.maxX + eps &&
         rect.minY - eps <= py && py <= rect.maxY + eps;
}

function corners(rect: Rect): { x: number; y: number }[] {
  return [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];
}

/** 线段与轴对齐矩形任意边是否相交 */
function segmentIntersectsRect(p1: GeoPoint, p2: GeoPoint, rect: Rect, eps: number): boolean {
  const edges: [{ x: number; y: number }, { x: number; y: number }][] = [
    [{ x: rect.minX, y: rect.minY }, { x: rect.maxX, y: rect.minY }],
    [{ x: rect.maxX, y: rect.minY }, { x: rect.maxX, y: rect.maxY }],
    [{ x: rect.maxX, y: rect.maxY }, { x: rect.minX, y: rect.maxY }],
    [{ x: rect.minX, y: rect.maxY }, { x: rect.minX, y: rect.minY }],
  ];
  for (const edge of edges) {
    if (linesIntersect(
      { x: p1.getX(), y: p1.getY() }, { x: p2.getX(), y: p2.getY() },
      edge[0], edge[1], eps)) return true;
  }
  return false;
}

/** 两线段是否相交（含端点，允许 eps 容差） */
function linesIntersect(a: { x: number; y: number }, b: { x: number; y: number },
                       c: { x: number; y: number }, d: { x: number; y: number }, eps: number): boolean {
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(den) < 1e-12) return false;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / den;
  return t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps;
}
