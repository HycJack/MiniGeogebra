import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoSegment } from '../geo/GeoSegment';
import { GeoConic } from '../geo/GeoConic';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoPolyLine } from '../geo/GeoPolyLine';
import { GeoVector } from '../geo/GeoVector';
import { GeoText } from '../geo/GeoText';
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
 * 判断单个几何元素是否与选择框相交
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
  if (el instanceof GeoPolygon) {
    const p = el as GeoPolygon;
    for (const v of p.vertices) {
      if (ptInRect(v, rect, eps)) return true;
    }
    if ((p as any).isInRegionXY && corners(rect).some(c => (p as any).isInRegionXY(c.x, c.y))) return true;
    return false;
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
