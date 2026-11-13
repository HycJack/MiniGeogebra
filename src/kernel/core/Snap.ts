import { GeoPoint } from '../geo/GeoPoint';

export const SNAP_POINT_RADIUS = 12; // 吸附热区（像素，与点击热区对齐；点渲染半径 8px + 余量）

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
  gridStep?: number,
  /** 网格吸附阈值（世界单位）。缺省与点吸附共用 radius（像素换算）。
   *  官方按格距比例判定（EuclidianController.java:4111-4230）：AUTOMATIC
   *  用 0.125×格距、ON_GRID 恒吸最近格点——两者都随格距缩放而非屏幕像素。 */
  gridRadius?: number,
): SnappedPosition {
  const gridEps = gridRadius ?? radius;
  let best: { x: number; y: number; dist: number; type?: 'grid' | 'point'; point?: GeoPoint } | null = null;

  // 官方优先级（EuclidianController.java:4111-4145）：sticky 点**先于**网格——
  // 点热区内有点即吸点，网格只兜底；此前纯比距离会让格交点抢走更近的点
  if (snapToPoint && points.length > 0) {
    // 取**最近**点：此前命中第一个优于当前 best 的点就 break，
    // 吸附结果取决于构造顺序（A 距 3 先出现、B 距 1 后出现时会吸到 A）。
    // 只吸**独立**点（对标官方 sticky points）：吸到路径点/交点等派生对象
    // 会让拖拽产生用户没打算要的坐标耦合
    for (const p of points) {
      if (!p.isDefined() || !p.isIndependent()) continue;
      const d = Math.hypot(p.getX() - x, p.getY() - y);
      if (d < radius && d < (best?.dist ?? Infinity)) {
        best = { x: p.getX(), y: p.getY(), dist: d, type: 'point', point: p };
      }
    }
  }

  if (snapToGrid && gridStep !== undefined && !best) {
    const gx = Math.round(x / gridStep) * gridStep;
    const gy = Math.round(y / gridStep) * gridStep;
    const d = Math.hypot(gx - x, gy - y);
    if (d < gridEps) {
      best = { x: gx, y: gy, dist: d, type: 'grid' };
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
