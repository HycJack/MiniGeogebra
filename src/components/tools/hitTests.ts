/**
 * 几何命中测试（Typed）——替代原 GeometryCanvas 中大量 `as any` 的硬编码检测。
 *
 * eps 单位：世界坐标。调用方把像素级阈值先换算为 `5 / coord.xScale` 传入即可。
 */

import { ConstructionElement } from '../../kernel/core/ConstructionElement';
import { GeoPoint } from '../../kernel/geo/GeoPoint';
import { GeoLine } from '../../kernel/geo/GeoLine';
import { GeoSegment } from '../../kernel/geo/GeoSegment';
import { GeoConic } from '../../kernel/geo/GeoConic';
import { GeoPolygon } from '../../kernel/geo/GeoPolygon';
import { GeoConicPart } from '../../kernel/geo/GeoConicPart';
import { GeoArc } from '../../kernel/geo/GeoArc';
import { GeoVector } from '../../kernel/geo/GeoVector';
import { GeoPolyLine } from '../../kernel/geo/GeoPolyLine';
import { GeoRay } from '../../kernel/geo/GeoRay';
import { GeoElement } from '../../kernel/geo/GeoElement';
import { WorldPoint } from './types';

/** 点命中：返回最顶层（逆序第一个命中）的点。 */
export function hitScreenPoint(els: readonly ConstructionElement[], x: number, y: number, eps: number): GeoPoint | undefined {
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < eps) {
      return el as GeoPoint;
    }
  }
  return undefined;
}

/** 通用对象命中：点优先；其次线段、直线、圆、多边形。 */
export function hitScreenObject(els: readonly ConstructionElement[], x: number, y: number, scale: number): GeoElement | undefined {
  // 1. 优先命中点（吸附热区）
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10 / scale) {
      return el;
    }
  }
  // 2. 命中其他几何对象
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el instanceof GeoConicPart || el instanceof GeoArc) {
      const r = (el as GeoConic).getRadius();
      const center = (el as GeoConic).getCenter();
      const d = Math.abs(Math.hypot(x - center.x, y - center.y) - r);
      if (d < 5 / scale) return el;
    } else if (el instanceof GeoVector) {
      const v = el as GeoVector;
      const dx = v.endX - v.startX, dy = v.endY - v.startY;
      const len2 = dx * dx + dy * dy;
      if (len2 > 0) {
        const t = Math.max(0, Math.min(1, ((x - v.startX) * dx + (y - v.startY) * dy) / len2));
        const px = v.startX + t * dx, py = v.startY + t * dy;
        if (Math.hypot(x - px, y - py) < 5 / scale) return el;
      }
    } else if (el instanceof GeoPolyLine) {
      if ((el as GeoPolyLine).isOnPath({ getX: () => x, getY: () => y } as any, 5 / scale)) return el;
    } else if (el instanceof GeoSegment) {
      if ((el as any).isOnPath({ getX: () => x, getY: () => y }, 5 / scale)) return el;
    } else if (el instanceof GeoRay) {
      if ((el as GeoRay).isOnPath({ getX: () => x, getY: () => y } as any, 5 / scale)) return el;
    } else if (el instanceof GeoLine) {
      const len = Math.hypot(el.a, el.b);
      if (len === 0) continue;
      const d = Math.abs(el.a * x + el.b * y + el.c) / len;
      if (d < 5 / scale) return el;
    } else if (el instanceof GeoConic) {
      const r = el.getRadius();
      const center = el.getCenter();
      const d = Math.abs(Math.hypot(x - center.x, y - center.y) - r);
      if (d < 5 / scale) return el;
    } else if (el instanceof GeoPolygon) {
      if ((el as any).isInRegionXY(x, y)) return el;
    }
  }
  return undefined;
}

// ---- 单一类型精准命中（用于工具构造阶段，只关心非点对象） ----
export function hitSegment(els: readonly ConstructionElement[], x: number, y: number, eps: number): GeoSegment | undefined {
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el instanceof GeoSegment && (el as any).isOnPath({ getX: () => x, getY: () => y }, eps)) {
      return el as GeoSegment;
    }
  }
  return undefined;
}

export function hitLine(els: readonly ConstructionElement[], x: number, y: number, eps: number): GeoLine | undefined {
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el instanceof GeoLine && !(el instanceof GeoSegment)) {
      const len = Math.hypot(el.a, el.b);
      if (len === 0) continue;
      const d = Math.abs(el.a * x + el.b * y + el.c) / len;
      if (d < eps) return el as GeoLine;
    }
  }
  return undefined;
}

export function hitCircle(els: readonly ConstructionElement[], x: number, y: number, eps: number): GeoConic | undefined {
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el instanceof GeoConic) {
      const r = el.getRadius();
      const center = el.getCenter();
      const d = Math.abs(Math.hypot(x - center.x, y - center.y) - r);
      if (d < eps) return el as GeoConic;
    }
  }
  return undefined;
}

export function hitPolygon(els: readonly ConstructionElement[], x: number, y: number): GeoPolygon | undefined {
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el instanceof GeoPolygon && (el as any).isInRegionXY(x, y)) {
      return el as GeoPolygon;
    }
  }
  return undefined;
}

/** 直线在世界边界内的两个端点（用于预览线）。 */
export function lineWorldEndpoints(a: number, b: number, c: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }): { p0: WorldPoint; p1: WorldPoint } | null {
  const { minX, maxX, minY, maxY } = bounds;
  let p0: WorldPoint | null = null, p1: WorldPoint | null = null;
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

/** 以两点定直线 Ax+By+C=0：A=y1-y0, B=x0-x1, C=-Ax0-By0 */
export function lineFromTwoPoints(p0: { x: number; y: number }, p1: { x: number; y: number }): { a: number; b: number; c: number } {
  const a = p0.y - p1.y;
  const b = p1.x - p0.x;
  const c = -a * p0.x - b * p0.y;
  return { a, b, c };
}
