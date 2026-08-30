import { GeoPoint } from '../geo/GeoPoint';

export const SNAP_POINT_RADIUS = 10; // 吸附热区（像素，与点击热区对齐）

/** 吸附计算后的位置信息 */
export interface SnappedPosition {
  x: number;
  y: number;
  type?: 'grid' | 'point';
  point?: GeoPoint;
}

/** 
 * 计算当前缩放下的网格步长（单位：世界坐标）
 * 目标：网格线间隔约 50px（屏幕空间）
 */
export function calculateGridStep(scale: number): number {
  const targetStepScreen = 50; // px
  const targetStepWorld = targetStepScreen / scale;
  const magnitude = Math.pow(10, Math.floor(Math.log10(targetStepWorld)));
  const residual = targetStepWorld / magnitude;
  let step = magnitude;
  if (residual > 5) step = 10 * magnitude;
  else if (residual > 2) step = 5 * magnitude;
  else if (residual > 1) step = 2 * magnitude;
  return step;
}

/** 
 * 应用吸附：网格吸附 + 点到点吸附
 */
export function applySnap(
  x: number,
  y: number,
  radius: number,
  snapToGrid: boolean,
  snapToPoint: boolean,
  points: GeoPoint[] = [],
  gridStep?: number
): SnappedPosition {
  let best: { x: number; y: number; dist: number; type?: 'grid' | 'point'; point?: GeoPoint } | null = null;

  if (snapToGrid && gridStep !== undefined) {
    const gx = Math.round(x / gridStep) * gridStep;
    const gy = Math.round(y / gridStep) * gridStep;
    const d = Math.hypot(gx - x, gy - y);
    if (d < radius && (!best || d < best.dist)) {
      best = { x: gx, y: gy, dist: d, type: 'grid' };
    }
  }

  if (snapToPoint && points.length > 0) {
    for (const p of points) {
      if (!p.isDefined()) continue;
      const d = Math.hypot(p.getX() - x, p.getY() - y);
      if (d < radius && d < (best?.dist ?? Infinity)) {
        best = { x: p.getX(), y: p.getY(), dist: d, type: 'point', point: p };
        break;
      }
    }
  }

  if (best) {
    return {
      x: parseFloat(best.x.toFixed(8)),
      y: parseFloat(best.y.toFixed(8)),
      type: best.type,
      point: best.point,
    };
  }
  return { x, y };
}
