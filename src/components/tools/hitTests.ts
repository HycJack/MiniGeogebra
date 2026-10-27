/**
 * 几何命中测试（Typed）——替代原 GeometryCanvas 中大量 `as any` 的硬编码检测。
 *
 * 两种阈值约定，切勿混用：
 *   - 接 `eps` 的函数（hitScreenPoint / hitSegment / hitLine / hitCircle /
 *     isPointOnFunction）：eps 单位是**世界坐标**。调用方把像素级阈值先换算为
 *     `pixelEps / coord.xScale` 传入。
 *   - hitScreenObject 接的 `scale`：**每世界单位多少像素**（即 `coord.xScale`）。
 *     它内部自持像素热区（点 10px、线/曲线 5px），调用方**不能**再传世界 eps，
 *     否则命中半径会随 xScale² 漂移（缩放后成倍偏离）。
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
import { GeoFunction } from '../../kernel/geo/GeoFunction';
import { GeoCurve } from '../../kernel/geo/GeoCurve';
import { GeoText } from '../../kernel/geo/GeoText';
import { GeoLocus } from '../../kernel/geo/GeoLocus';
import { GeoInequality } from '../../kernel/geo/GeoInequality';
import { angleInArcWindow } from '../../kernel/geo/GeoArc';

/** 点到轨迹采样折线的最短距离（跳过断段区间）。 */
export function locusDistanceTo(locus: GeoLocus, x: number, y: number): number {
  const samples = locus.getSamples();
  const segments = locus.getSegments();
  let best = Infinity;
  const span = (a: { x: number; y: number }, b: { x: number; y: number }): number => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
  };
  for (const seg of segments) {
    for (let i = seg.start; i < seg.end; i++) {
      const a = samples[i], b = samples[i + 1];
      if (!a || !b) continue;
      best = Math.min(best, span(a, b));
    }
  }
  // 无断段记录时按整体折线（Locator 兼容旧 Locus 构造）
  if (segments.length === 0) {
    for (let i = 0; i + 1 < samples.length; i++) best = Math.min(best, span(samples[i], samples[i + 1]));
  }
  return best;
}
import { WorldPoint } from './types';
import { getLabelAnchor, labelDrawable, type LabelBounds } from '../labels';

/**
 * 命中遍历顺序（图层感知，对标 GeoGebra layer）：
 *   layer 高的先命中；同层内后绘制（数组靠后）的先命中。
 */
function hitOrder(els: readonly ConstructionElement[]): number[] {
  const idx = els.map((_, i) => i);
  idx.sort((a, b) => {
    const la = (els[a] as GeoElement).layer ?? 0;
    const lb = (els[b] as GeoElement).layer ?? 0;
    if (la !== lb) return lb - la;
    return b - a;
  });
  return idx;
}

/**
 * 标签命中：与绘制共用锚点（labels.ts，含同一线可视弦中点）。
 * 热区 = **实际字形框**（14px 字号，从锚点向右上伸展；评审 U5）：
 * 12px 圆会压在线段中点/多边形形心等几何体上，抢在对象命中之前。
 * bounds 必须与绘制侧一致，否则直线标签"画在哪"和"点在哪"会分离。
 */
export function hitLabel(els: readonly ConstructionElement[], x: number, y: number, scale: number, bounds?: LabelBounds): GeoElement | undefined {
  for (const i of hitOrder(els)) {
    const el = els[i];
    if (!(el instanceof GeoElement) || !el.isEffectivelyVisible()) continue;
    if (!labelDrawable(el)) continue;
    const anchor = getLabelAnchor(el, scale, bounds);
    if (!anchor) continue;
    const textW = (el.label.length * 9 + 4) / scale;   // 14px bold 平均字宽 ≈ 9px
    const textH = 16 / scale;
    const margin = 2 / scale;
    if (x >= anchor.x - margin && x <= anchor.x + textW + margin &&
        y >= anchor.y - margin && y <= anchor.y + textH + margin) {
      return el;
    }
  }
  return undefined;
}

/** 点命中：返回最顶层（图层优先，其次后绘制）的点。 */
export function hitScreenPoint(els: readonly ConstructionElement[], x: number, y: number, eps: number): GeoPoint | undefined {
  for (const i of hitOrder(els)) {
    const el = els[i];
    if (el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < eps) {
      return el as GeoPoint;
    }
  }
  return undefined;
}

/** 圆锥曲线的点到曲线距离估计：|Q|/|∇Q|（隐函数一阶近似，对椭圆/双曲线/抛物线一致有效）。 */
function conicDistanceTo(c: GeoConic, x: number, y: number): number {
  const [A, B, C, D, E, F] = c.coeffs;
  const q = A * x * x + B * x * y + C * y * y + D * x + E * y + F;
  if (c.isCircle()) {
    // 圆走精确几何距离
    const center = c.getCenter();
    return Math.abs(Math.hypot(x - center.x, y - center.y) - c.getRadius());
  }
  const gx = 2 * A * x + B * y + D;
  const gy = B * x + 2 * C * y + E;
  const g = Math.hypot(gx, gy);
  // 梯度退化（远离曲线/近无穷远分支）时退回近似半径法
  if (g < 1e-12) return Math.abs(Math.hypot(x - c.getCenter().x, y - c.getCenter().y) - c.getApproxRadius());
  return Math.abs(q) / g;
}

/** 在函数采样折线上判断 (x, y) 是否足够接近曲线。 */
export function isPointOnFunction(
  fn: GeoFunction,
  x: number,
  y: number,
  eps: number,
  bounds?: { minX: number; maxX: number; pixelWidth: number },
): boolean {
  const minX = bounds?.minX ?? Math.min(-100, x - 100);
  const maxX = bounds?.maxX ?? Math.max(100, x + 100);
  const pixelWidth = bounds?.pixelWidth ?? 1600;
  const samples = fn.updateSamples(minX, maxX, pixelWidth);
  for (let i = 0; i < samples.length - 1; i++) {
    const ax = samples[i].x;
    const ay = samples[i].y;
    const bx = samples[i + 1].x;
    const by = samples[i + 1].y;
    if (!Number.isFinite(ay) || !Number.isFinite(by)) continue;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= eps) return true;
  }
  return false;
}

/** 参数曲线命中：采样段到点的最近距离 ≤ eps。 */
export function isPointOnCurve(
  curve: GeoCurve,
  x: number,
  y: number,
  eps: number,
): boolean {
  const samples = curve.updateSamples(1600);
  for (let i = 0; i < samples.length - 1; i++) {
    const ax = samples[i].x;
    const ay = samples[i].y;
    const bx = samples[i + 1].x;
    const by = samples[i + 1].y;
    if (!Number.isFinite(ay) || !Number.isFinite(by)) continue;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= eps) return true;
  }
  return false;
}

/** 求函数曲线上离 (x, y) 最近的参数 x；无有效采样时返回 NaN。 */
export function functionParameterAt(
  fn: GeoFunction,
  x: number,
  y: number,
  bounds: { minX: number; maxX: number; pixelWidth: number },
): number {
  const samples = fn.updateSamples(bounds.minX, bounds.maxX, bounds.pixelWidth);
  let bestX = NaN;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < samples.length - 1; i++) {
    const ax = samples[i].x;
    const ay = samples[i].y;
    const bx = samples[i + 1].x;
    const by = samples[i + 1].y;
    if (!Number.isFinite(ay) || !Number.isFinite(by)) continue;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const distance = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestX = ax + t * (bx - ax);
    }
  }
  return bestDistance === Number.POSITIVE_INFINITY ? NaN : bestX;
}

/** 通用对象命中：点优先；其次线段、直线、圆、多边形。两轮均按图层排序。 */
export function hitScreenObject(els: readonly ConstructionElement[], x: number, y: number, scale: number): GeoElement | undefined {
  // 1. 优先命中点（吸附热区）
  for (const i of hitOrder(els)) {
    const el = els[i];
    if (el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10 / scale) {
      return el;
    }
  }
  // 2. 命中其他几何对象
  for (const i of hitOrder(els)) {
    const el = els[i];
    if (el instanceof GeoConicPart || el instanceof GeoArc) {
      const r = (el as GeoConic).getRadius();
      const center = (el as GeoConic).getCenter();
      const dist = Math.hypot(x - center.x, y - center.y);
      const d = Math.abs(dist - r);
      // 角窗命中（此前只测整圆环带，点半圆的另一半也会命中、
      // 且环带会截胡叠在上面但不属于弧的线段）。角容差按像素换算。
      const ang = Math.atan2(y - center.y, x - center.x);
      const angEps = 5 / scale / Math.max(r, 1e-9);
      const inWindow = angleInArcWindow(
        ang, el.getStartAngle(), el.getEndAngle(), el.isCounterClockwise(), angEps,
      );
      if (!inWindow) continue;
      // 扇形：填充区域整体可命中（对标官方 DrawConicPart 的 ON_FILLING）
      if (el instanceof GeoConicPart && el.isSector() && dist <= r + 5 / scale) return el;
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
      const d = conicDistanceTo(el, x, y);
      if (d < 5 / scale) return el;
    } else if (el instanceof GeoFunction) {
      if (isPointOnFunction(el, x, y, 5 / scale)) return el;
    } else if (el instanceof GeoCurve) {
      if (isPointOnCurve(el, x, y, 5 / scale)) return el;
    } else if (el instanceof GeoLocus) {
      // 轨迹命中（此前零命中：画布上选不中、删不掉，只能去侧栏）——
      // 按采样折线的段距离判定，segments 断段区间之外的跳跃段不参与
      const eps = 5 / scale;
      if (locusDistanceTo(el, x, y) < eps) return el;
    } else if (el instanceof GeoInequality) {
      // 不等式区域命中（此前只画不选）：内部点直接命中，对标官方 region 分支
      if (el.isDefined() && el.isInRegionXY(x, y)) return el;
    } else if (el instanceof GeoPolygon) {
      if ((el as any).isInRegionXY(x, y)) return el;
    } else if (el instanceof GeoText) {
      // 文本此前无任何命中路径：画布上点不中、选不中、删不掉。
      // 热区按 14px 字号估算的包围盒（上下各留余量，规避基线方向差异）。
      const w = (el.text.length * 9 + 4) / scale;
      const h = 16 / scale;
      const m = 2 / scale;
      if (x >= el.x - m && x <= el.x + w + m && y >= el.y - h - m && y <= el.y + h + m) return el;
    } else if (el instanceof GeoElement && (el as any).isInRegionXY && typeof (el as any).contours !== 'undefined') {
      // GeoBooleanRegion 等轮廓区域：点内命中
      if ((el as any).isInRegionXY(x, y)) return el;
    }
  }
  return undefined;
}

// ---- 单一类型精准命中（用于工具构造阶段，只关心非点对象）。遍历按图层序
//（hitOrder：layer 高者先），与主入口一致——此前尾向遍历忽略 layer，
// mirror_circle 等工具会选中低层的重叠对象。 ----
export function hitSegment(els: readonly ConstructionElement[], x: number, y: number, eps: number): GeoSegment | undefined {
  for (const i of hitOrder(els)) {
    const el = els[i];
    if (el instanceof GeoSegment && (el as any).isOnPath({ getX: () => x, getY: () => y }, eps)) {
      return el as GeoSegment;
    }
  }
  return undefined;
}

export function hitLine(els: readonly ConstructionElement[], x: number, y: number, eps: number): GeoLine | undefined {
  for (const i of hitOrder(els)) {
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
  for (const i of hitOrder(els)) {
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
  for (const i of hitOrder(els)) {
    const el = els[i];
    if (el instanceof GeoPolygon && (el as any).isInRegionXY(x, y)) {
      return el as GeoPolygon;
    }
  }
  return undefined;
}

/** 区域命中（点工具建区域点用）：多边形/圆锥内部（对标官方 chooseGeo 的 region 分支）。 */
export function hitRegion(els: readonly ConstructionElement[], x: number, y: number): GeoElement | undefined {
  for (const i of hitOrder(els)) {
    const el = els[i];
    if (el instanceof GeoPolygon && (el as GeoPolygon).isInRegionXY(x, y)) return el;
    if (el instanceof GeoConic && !(el instanceof GeoArc) && !(el instanceof GeoConicPart) &&
        el.isDefined() && el.isInRegionXY(x, y)) return el;
  }
  return undefined;
}

// lineWorldEndpoints 迁至 labels.ts（labels 不可反向依赖 hitTests，见该文件注释）。
export { lineWorldEndpoints } from '../labels';


/** 以两点定直线 Ax+By+C=0：A=y1-y0, B=x0-x1, C=-Ax0-By0 */
export function lineFromTwoPoints(p0: { x: number; y: number }, p1: { x: number; y: number }): { a: number; b: number; c: number } {
  const a = p0.y - p1.y;
  const b = p1.x - p0.x;
  const c = -a * p0.x - b * p0.y;
  return { a, b, c };
}
