import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoSegment } from '../geo/GeoSegment';
import { GeoConic } from '../geo/GeoConic';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoElement } from '../geo/GeoElement';

/** 轴对齐矩形（世界坐标） */
export interface Rect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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
