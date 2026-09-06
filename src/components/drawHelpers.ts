/**
 * 纯绘制函数集合（GeoGebra / JSXGraph 式渲染管线）。
 *
 * 约定：所有坐标均为"世界坐标"；调用方在绘制开始前统一应用一次
 * 视图变换（scale(dpr) → translate(xZero,yZero) → scale(xScale,yScale)），
 * 因此本模块不依赖任何 canvasRef/state，可被 CanvasView / 导出逻辑 / 测试复用。
 */

import { IRenderer } from '../kernel/view/IRenderer';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoLocus } from '../kernel/geo/GeoLocus';
import { GeoArc } from '../kernel/geo/GeoArc';
import { GeoConicPart } from '../kernel/geo/GeoConicPart';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoPolyLine } from '../kernel/geo/GeoPolyLine';
import { GeoRay } from '../kernel/geo/GeoRay';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoElement } from '../kernel/geo/GeoElement';
import { WorldPoint } from './tools/types';

export interface DrawBounds { minX: number; maxX: number; minY: number; maxY: number; }

// ---- 基础绘图 ----

/** 坐标轴 + 网格。 */
export function drawGrid(renderer: IRenderer, wScreen: number, hScreen: number, coord: CoordinateSystem, showGrid: boolean, showAxes: boolean): void {
  const startX = coord.screenToWorldX(0);
  const endX = coord.screenToWorldX(wScreen);
  const startY = coord.screenToWorldY(0);
  const endY = coord.screenToWorldY(hScreen);

  const targetStepScreen = 50;
  const targetStepWorld = targetStepScreen / coord.xScale;
  const magnitude = Math.pow(10, Math.floor(Math.log10(targetStepWorld)));
  const residual = targetStepWorld / magnitude;
  let step = magnitude;
  if (residual > 5) step = 10 * magnitude;
  else if (residual > 2) step = 5 * magnitude;
  else if (residual > 1) step = 2 * magnitude;

  const firstX = Math.floor(startX / step) * step;
  const firstY = Math.floor(startY / step) * step;

  if (showGrid) {
    // 次级网格（细分主格 5 份，色更淡）
    const minorStep = step / 5;
    const minorFirstX = Math.floor(startX / minorStep) * minorStep;
    const minorFirstY = Math.floor(startY / minorStep) * minorStep;
    renderer.strokeStyle = 'rgba(180, 179, 186, 0.24)';
    renderer.lineWidth = 1 / coord.xScale;
    for (let x = minorFirstX; x <= endX; x += minorStep) {
      if (Math.abs(x / step - Math.round(x / step)) < 1e-9) continue;
      renderer.beginPath();
      renderer.moveTo(x, startY);
      renderer.lineTo(x, endY);
      renderer.stroke();
    }
    for (let y = minorFirstY; y <= endY; y += minorStep) {
      if (Math.abs(y / step - Math.round(y / step)) < 1e-9) continue;
      renderer.beginPath();
      renderer.moveTo(startX, y);
      renderer.lineTo(endX, y);
      renderer.stroke();
    }
    // 主网格
    renderer.strokeStyle = '#b4b3ba';
    for (let x = firstX; x <= endX; x += step) {
      renderer.beginPath();
      renderer.moveTo(x, startY);
      renderer.lineTo(x, endY);
      renderer.stroke();
    }
    for (let y = firstY; y <= endY; y += step) {
      renderer.beginPath();
      renderer.moveTo(startX, y);
      renderer.lineTo(endX, y);
      renderer.stroke();
    }
  }

  if (showAxes) {
    renderer.strokeStyle = '#1c1c1f';
    renderer.lineWidth = 2 / coord.xScale;
    const tickLength = 5 / coord.xScale;
    const arrowLen = 8 / coord.xScale;
    const arrowHalf = 3.5 / coord.xScale;
    const xInView = 0 >= startX && 0 <= endX;
    const yInView = 0 >= startY && 0 <= endY;
    if (xInView) {
      renderer.beginPath();
      renderer.moveTo(0, startY);
      renderer.lineTo(0, endY);
      renderer.stroke();
      // Y 轴正方向箭头（向下）
      renderer.beginPath();
      renderer.moveTo(-arrowHalf, endY - arrowLen);
      renderer.lineTo(0, endY);
      renderer.lineTo(arrowHalf, endY - arrowLen);
      renderer.stroke();
    }
    if (yInView) {
      renderer.beginPath();
      renderer.moveTo(startX, 0);
      renderer.lineTo(endX, 0);
      renderer.stroke();
      // X 轴正方向箭头（向右）
      renderer.beginPath();
      renderer.moveTo(endX - arrowLen, -arrowHalf);
      renderer.lineTo(endX, 0);
      renderer.lineTo(endX - arrowLen, arrowHalf);
      renderer.stroke();
    }

    // 主刻度短线（GeoGebra 风格：X 轴纵向短线，Y 轴横向短线）
    renderer.lineWidth = 1 / coord.xScale;
    for (let x = firstX; x <= endX + 1e-9; x += step) {
      if (!xInView || Math.abs(x) < 1e-10) continue;
      renderer.beginPath();
      renderer.moveTo(x, -tickLength / 2);
      renderer.lineTo(x, tickLength / 2);
      renderer.stroke();
    }
    for (let y = firstY; y <= endY + 1e-9; y += step) {
      if (!yInView || Math.abs(y) < 1e-10) continue;
      renderer.beginPath();
      renderer.moveTo(-tickLength / 2, y);
      renderer.lineTo(tickLength / 2, y);
      renderer.stroke();
    }

    // 次级刻度：比主刻度更短，跟主/次网格保持同一节奏
    const minorTickStep = step / 5;
    const minorTickLength = 3 / coord.xScale;
    for (let x = Math.floor(startX / minorTickStep) * minorTickStep; x <= endX + 1e-9; x += minorTickStep) {
      if (!xInView || Math.abs(x) < 1e-10 || Math.abs(x / step - Math.round(x / step)) < 1e-9) continue;
      renderer.beginPath();
      renderer.moveTo(x, -minorTickLength / 2);
      renderer.lineTo(x, minorTickLength / 2);
      renderer.stroke();
    }
    for (let y = Math.floor(startY / minorTickStep) * minorTickStep; y <= endY + 1e-9; y += minorTickStep) {
      if (!yInView || Math.abs(y) < 1e-10 || Math.abs(y / step - Math.round(y / step)) < 1e-9) continue;
      renderer.beginPath();
      renderer.moveTo(-minorTickLength / 2, y);
      renderer.lineTo(minorTickLength / 2, y);
      renderer.stroke();
    }

    renderer.fillStyle = '#1c1c1f';
    renderer.font = `${12 / coord.xScale}px sans-serif`;
    renderer.textAlign = 'center';
    renderer.textBaseline = 'top';
    const xLabelEvery = Math.max(1, Math.ceil(28 / (step * coord.xScale)));
    for (let x = firstX, labelIndex = 0; x <= endX; x += step, labelIndex++) {
      if (labelIndex % xLabelEvery !== 0) continue;
      if (Math.abs(x) > 1e-10) {
        renderer.fillText(parseFloat(x.toPrecision(4)).toString(), x, 4 / coord.xScale);
      }
    }
    renderer.textAlign = 'right';
    renderer.textBaseline = 'middle';
    const yLabelEvery = Math.max(1, Math.ceil(20 / (step * coord.yScale)));
    for (let y = firstY, labelIndex = 0; y <= endY; y += step, labelIndex++) {
      if (labelIndex % yLabelEvery !== 0) continue;
      if (Math.abs(y) > 1e-10) {
        renderer.fillText(parseFloat(y.toPrecision(4)).toString(), -4 / coord.xScale, y);
      }
    }
    renderer.textAlign = 'right';
    renderer.textBaseline = 'top';
    renderer.fillText('0', -4 / coord.xScale, 4 / coord.xScale);
  }
}

/** 点。 */
export function drawPoint(renderer: IRenderer, p: GeoPoint, selected: boolean, scale: number): void {
  if (!p.isDefined() || p.visible === false) return;
  const x = p.getX(), y = p.getY();
  const baseRadius = selected ? 8 : 6;
  const pointRadius = baseRadius / scale;

  if (selected) {
    renderer.beginPath();
    renderer.arc(x, y, (baseRadius + 4) / scale, 0, 2 * Math.PI);
    renderer.strokeStyle = '#3b82f6';
    renderer.lineWidth = 2 / scale;
    renderer.stroke();
    renderer.beginPath();
    renderer.arc(x, y, (baseRadius + 8) / scale, 0, 2 * Math.PI);
    renderer.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    renderer.lineWidth = 3 / scale;
    renderer.stroke();
  }

  renderer.beginPath();
  renderer.arc(x, y, pointRadius, 0, 2 * Math.PI);
  renderer.fillStyle = p.strokeColor ?? (p.isIndependent() ? '#1d4ed8' : '#6b7280');
  renderer.fill();

  const ptStroke = selected ? '#1e3a8a' : '#374151';
  const ptWidth = (p.strokeWidth ?? p.defaultLineWidth) / scale;
  renderer.strokeStyle = ptStroke;
  renderer.lineWidth = selected ? ptWidth * 2 : ptWidth;
  renderer.stroke();

  if (!p.labelVisible || p.labelMode !== 'always') return;
  const label = p.label || p.id;
  renderer.font = `bold ${14 / scale}px sans-serif`;
  renderer.textAlign = 'left';
  renderer.fillStyle = selected ? '#1e40af' : '#1f2937';
  renderer.textBaseline = 'bottom';
  // Label offsets are screen-space: convert them back to world units because
  // the whole 2D canvas is already transformed by the current view scale.
  const labelOffset = (baseRadius + (selected ? 8 : 4)) / scale;
  renderer.fillText(label, x + labelOffset, y - labelOffset);
}

/** 直线（贯穿整个视野）。 */
export function drawLine(renderer: IRenderer, l: GeoLine, selected: boolean, bounds: DrawBounds, scale: number): void {
  if (!l.isDefined() || l.visible === false) return;
  const stroke = l.strokeColor ?? l.defaultStrokeColor;
  const baseWidth = l.strokeWidth ?? l.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  const eps = 1e-6;
  if (Math.abs(l.b) > eps) {
    const y1 = (-l.c - l.a * bounds.minX) / l.b;
    const y2 = (-l.c - l.a * bounds.maxX) / l.b;
    renderer.moveTo(bounds.minX, y1);
    renderer.lineTo(bounds.maxX, y2);
  } else {
    const x = -l.c / l.a;
    renderer.moveTo(x, bounds.minY);
    renderer.lineTo(x, bounds.maxY);
  }
  renderer.stroke();
}

/** 线段。 */
export function drawSegment(renderer: IRenderer, s: GeoSegment, selected: boolean, scale: number): void {
  if (!s.isDefined() || s.visible === false) return;
  const stroke = s.strokeColor ?? s.defaultStrokeColor;
  const baseWidth = s.strokeWidth ?? s.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  renderer.moveTo(s.startPoint.getX(), s.startPoint.getY());
  renderer.lineTo(s.endPoint.getX(), s.endPoint.getY());
  renderer.stroke();
}

/** 多边形（填充+描边）。 */
export function drawPolygon(renderer: IRenderer, poly: GeoPolygon, selected: boolean, scale: number): void {
  if (!poly.isDefined() || poly.visible === false) return;
  if (poly.vertices.length < 3) return;
  const fill = poly.fillColor ?? poly.defaultFillColor ?? (selected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.2)');
  const stroke = poly.strokeColor ?? poly.defaultStrokeColor;
  const baseWidth = poly.strokeWidth ?? poly.defaultLineWidth;
  renderer.fillStyle = fill;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  renderer.moveTo(poly.vertices[0].getX(), poly.vertices[0].getY());
  for (let i = 1; i < poly.vertices.length; i++) {
    renderer.lineTo(poly.vertices[i].getX(), poly.vertices[i].getY());
  }
  renderer.closePath();
  renderer.fill();
  renderer.stroke();
}

/** 圆锥曲线（圆 / 椭圆 / 双曲线 / 抛物线）。 */
export function drawConic(renderer: IRenderer, c: GeoConic, selected: boolean, scale: number): void {
  if (!c.isDefined() || c.visible === false) return;

  const stroke = c.strokeColor ?? c.defaultStrokeColor;
  const baseWidth = c.strokeWidth ?? c.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;

  if (c.isCircle()) {
    // Fast path for circles: use arc()
    const center = c.getCenter();
    const r = c.getRadius();
    if (r <= 0) return;

    if (selected) {
      renderer.beginPath();
      renderer.arc(center.x, center.y, r + 4 / scale, 0, 2 * Math.PI);
      renderer.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      renderer.lineWidth = 6 / scale;
      renderer.stroke();
      renderer.strokeStyle = '#3b82f6';
      renderer.lineWidth = baseWidth * 2 / scale;
    }

    renderer.beginPath();
    renderer.arc(center.x, center.y, r, 0, 2 * Math.PI);
    renderer.stroke();

    if (selected && c.labelVisible && c.labelMode === 'always') {
      const label = c.label || c.id;
      renderer.font = `bold ${14 / scale}px sans-serif`;
      renderer.fillStyle = '#1e40af';
      renderer.textBaseline = 'bottom';
      renderer.fillText(label, center.x + r + 10 / scale, center.y);
    }
    return;
  }

  // General conic path: sample points along the curve
  const pts = c.samplePoints(360);
  if (pts.length < 2) return;

  if (selected) {
    renderer.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    renderer.lineWidth = 6 / scale;
    renderer.beginPath();
    renderer.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) renderer.lineTo(pts[i].x, pts[i].y);
    renderer.stroke();
    renderer.strokeStyle = '#3b82f6';
    renderer.lineWidth = baseWidth * 2 / scale;
  }

  renderer.beginPath();
  renderer.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) renderer.lineTo(pts[i].x, pts[i].y);
  renderer.stroke();

  if (selected && c.labelVisible && c.labelMode === 'always') {
    const label = c.label || c.id;
    const center = c.getCenter();
    renderer.font = `bold ${14 / scale}px sans-serif`;
    renderer.fillStyle = '#1e40af';
    renderer.textBaseline = 'bottom';
    renderer.fillText(label, center.x + 10 / scale, center.y);
  }
}

/** 轨迹曲线（断段绘制）。 */
export function drawLocus(renderer: IRenderer, locus: GeoLocus, selected: boolean, scale: number): void {
  if (!locus.isDefined() || locus.visible === false) return;
  const samples = locus.getSamples();
  const segments = locus.getSegments();
  if (samples.length < 2 || segments.length === 0) return;
  const stroke = locus.strokeColor ?? locus.defaultStrokeColor;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? 3 : 2) / scale;
  for (const seg of segments) {
    if (seg.end - seg.start < 1) continue;
    renderer.beginPath();
    renderer.moveTo(samples[seg.start].x, samples[seg.start].y);
    for (let i = seg.start + 1; i <= seg.end; i++) {
      renderer.lineTo(samples[i].x, samples[i].y);
    }
    renderer.stroke();
  }
}

/** 显式函数曲线（输入栏 / 代数视图创建）。 */
export function drawFunction(
  renderer: IRenderer, fn: GeoFunction, selected: boolean,
  bounds: DrawBounds, scale: number, pixelWidth: number,
): void {
  if (!fn.isDefined() || fn.visible === false) return;
  // 把可视 y 范围传给自适应采样器：采样密度、细分容差与渐近线判据
  // 都以「一个屏幕高度有多少世界单位」为基准，而不是固定默认视高。
  const samples = fn.updateSamples(bounds.minX, bounds.maxX, pixelWidth, bounds);
  if (samples.length < 2) return;
  const stroke = fn.strokeColor ?? fn.defaultStrokeColor;
  const baseWidth = fn.strokeWidth ?? fn.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;

  let drawing = false;
  renderer.beginPath();
  for (const sample of samples) {
    if (!Number.isFinite(sample.y)) {
      drawing = false;
      continue;
    }
    if (!drawing) {
      renderer.moveTo(sample.x, sample.y);
      drawing = true;
    } else {
      renderer.lineTo(sample.x, sample.y);
    }
  }
  renderer.stroke();

  if (selected && fn.labelVisible && fn.labelMode === 'always') {
    renderer.fillStyle = '#1e40af';
    renderer.font = `bold ${14 / scale}px sans-serif`;
    renderer.textAlign = 'left';
    renderer.textBaseline = 'bottom';
    renderer.fillText(fn.label || fn.id, bounds.minX + 10 / scale, bounds.minY + 20 / scale);
  }
}

/** 向量（带箭头的线段）。 */
export function drawVector(renderer: IRenderer, v: GeoVector, selected: boolean, scale: number): void {
  if (!v.isDefined() || v.visible === false) return;
  const sx = v.startX, sy = v.startY, ex = v.endX, ey = v.endY;
  const stroke = v.strokeColor ?? v.defaultStrokeColor;
  const baseWidth = v.strokeWidth ?? v.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  renderer.moveTo(sx, sy);
  renderer.lineTo(ex, ey);
  renderer.stroke();
  // 箭头
  const angle = Math.atan2(ey - sy, ex - sx);
  const headLen = 12 / scale;
  const a1 = angle + Math.PI - Math.PI / 6;
  const a2 = angle + Math.PI + Math.PI / 6;
  renderer.beginPath();
  renderer.moveTo(ex, ey);
  renderer.lineTo(ex + headLen * Math.cos(a1), ey + headLen * Math.sin(a1));
  renderer.moveTo(ex, ey);
  renderer.lineTo(ex + headLen * Math.cos(a2), ey + headLen * Math.sin(a2));
  renderer.stroke();
}

/** 折线。 */
export function drawPolyLine(renderer: IRenderer, pl: GeoPolyLine, selected: boolean, scale: number): void {
  if (!pl.isDefined() || pl.visible === false || pl.vertices.length < 2) return;
  const stroke = pl.strokeColor ?? pl.defaultStrokeColor;
  const baseWidth = pl.strokeWidth ?? pl.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  renderer.moveTo(pl.vertices[0].getX(), pl.vertices[0].getY());
  for (let i = 1; i < pl.vertices.length; i++) {
    renderer.lineTo(pl.vertices[i].getX(), pl.vertices[i].getY());
  }
  renderer.stroke();
}

/** 圆弧（GeoArc 和 GeoConicPart ARC 类型）。 */
export function drawArc(renderer: IRenderer, arc: GeoArc, selected: boolean, scale: number): void {
  if (!arc.isDefined() || arc.visible === false) return;
  const center = arc.getCenter();
  const r = arc.getRadius();
  if (r <= 0) return;
  const stroke = arc.strokeColor ?? arc.defaultStrokeColor;
  const baseWidth = arc.strokeWidth ?? arc.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  renderer.arc(center.x, center.y, r, arc.getStartAngle(), arc.getEndAngle(), arc.isCounterClockwise());
  renderer.stroke();
}

/** 圆锥曲线片段（扇形 / 弓形 / 弧）。 */
export function drawConicPart(renderer: IRenderer, cp: GeoConicPart, selected: boolean, scale: number): void {
  if (!cp.isDefined() || cp.visible === false) return;
  const center = cp.getCenter();
  const r = cp.getRadius();
  if (r <= 0) return;
  const stroke = cp.strokeColor ?? cp.defaultStrokeColor;
  const baseWidth = cp.strokeWidth ?? cp.defaultLineWidth;
  const sa = cp.getStartAngle(), ea = cp.getEndAngle(), ccw = cp.isCounterClockwise();

  if (cp.isSector()) {
    renderer.fillStyle = cp.fillColor ?? cp.defaultFillColor ?? 'rgba(59,130,246,0.15)';
    renderer.beginPath();
    renderer.moveTo(center.x, center.y);
    renderer.arc(center.x, center.y, r, sa, ea, ccw);
    renderer.closePath();
    renderer.fill();
  }

  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  renderer.arc(center.x, center.y, r, sa, ea, ccw);
  renderer.stroke();

  if (cp.getPartType() === 2) { // SEGMENT
    renderer.beginPath();
    renderer.moveTo(center.x + r * Math.cos(sa), center.y + r * Math.sin(sa));
    renderer.lineTo(center.x + r * Math.cos(ea), center.y + r * Math.sin(ea));
    renderer.stroke();
  }
}

/** 射线。 */
export function drawRay(renderer: IRenderer, ray: GeoRay, selected: boolean, bounds: DrawBounds, scale: number): void {
  if (!ray.isDefined() || ray.visible === false) return;
  const sp = ray.getStartPoint();
  const dp = ray.getSecondPoint();
  const dx = dp.getX() - sp.getX(), dy = dp.getY() - sp.getY();
  if (Math.hypot(dx, dy) < 1e-12) return;
  const stroke = ray.strokeColor ?? ray.defaultStrokeColor;
  const baseWidth = ray.strokeWidth ?? ray.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  renderer.moveTo(sp.getX(), sp.getY());
  renderer.lineTo(sp.getX() + 10000 * dx, sp.getY() + 10000 * dy);
  renderer.stroke();
}

// ---- 绘制预览（工具构造中，未提交前的临时效果）----

/** 根据当前模式渲染构造预览（预览线、预览圆、预览多边形等）。 */
export function renderPreviews(mode: string, selectedElements: readonly GeoElement[], mousePos: WorldPoint, hoveredPoint: GeoPoint | null, coord: CoordinateSystem, renderer: IRenderer, radius?: number, bounds?: DrawBounds): void {
  if (!bounds) return;
  const { minX, maxX, minY, maxY } = bounds;
  const targetX = hoveredPoint ? hoveredPoint.getX() : mousePos.x;
  const targetY = hoveredPoint ? hoveredPoint.getY() : mousePos.y;
  renderer.save();
  renderer.strokeStyle = 'rgba(100, 100, 100, 0.5)';
  renderer.setLineDash([5 / coord.xScale, 5 / coord.xScale]);
  renderer.lineWidth = 1 / coord.xScale;

  const isPoint = (el: any): el is GeoPoint => el instanceof GeoPoint;

  if (mode === 'segment' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
    const p1 = selectedElements[0] as GeoPoint;
    renderer.beginPath();
    renderer.moveTo(p1.getX(), p1.getY());
    renderer.lineTo(targetX, targetY);
    renderer.stroke();
  } else if (mode === 'line' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
    const p1 = selectedElements[0] as GeoPoint;
    const dx = targetX - p1.getX(), dy = targetY - p1.getY();
    if (Math.hypot(dx, dy) > 1 / coord.xScale) {
      renderer.beginPath();
      renderer.moveTo(p1.getX() - 10000 * dx, p1.getY() - 10000 * dy);
      renderer.lineTo(p1.getX() + 10000 * dx, p1.getY() + 10000 * dy);
      renderer.stroke();
    }
  } else if (mode === 'circle') {
    renderer.beginPath();
    renderer.arc(targetX, targetY, radius ?? 50, 0, 2 * Math.PI);
    renderer.stroke();
  } else if (mode === 'circle_center_point' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
    const center = selectedElements[0] as GeoPoint;
    const r = Math.hypot(targetX - center.getX(), targetY - center.getY());
    renderer.beginPath();
    renderer.arc(center.getX(), center.getY(), r, 0, 2 * Math.PI);
    renderer.stroke();
  } else if (mode === 'circle3' && selectedElements.length === 2) {
    const [p1, p2] = selectedElements as GeoPoint[];
    const p3 = { x: targetX, y: targetY };
    const ax = p1.getX(), ay = p1.getY(), bx = p2.getX(), by = p2.getY();
    const cx = p3.x, cy = p3.y;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) > 1e-10) {
      const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
      const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
      const r = Math.hypot(ux - ax, uy - ay);
      renderer.beginPath();
      renderer.arc(ux, uy, r, 0, 2 * Math.PI);
      renderer.stroke();
      renderer.beginPath();
      renderer.arc(ux, uy, 3 / coord.xScale, 0, 2 * Math.PI);
      renderer.fillStyle = 'rgba(100, 100, 100, 0.5)';
      renderer.fill();
    }
  } else if ((mode === 'parallel' || mode === 'orthogonal') && selectedElements.length === 1 && selectedElements[0] instanceof GeoLine) {
    const l = selectedElements[0] as GeoLine;
    let a = l.a, b = l.b;
    if (mode === 'orthogonal') { const t = a; a = -b; b = t; }
    const cVal = -(a * targetX + b * targetY);
    if (Math.abs(b) > 1e-6) {
      const y1 = (-cVal - a * minX) / b, y2 = (-cVal - a * maxX) / b;
      renderer.beginPath();
      renderer.moveTo(minX, y1);
      renderer.lineTo(maxX, y2);
      renderer.stroke();
    } else {
      const x = -cVal / a;
      renderer.beginPath();
      renderer.moveTo(x, minY);
      renderer.lineTo(x, maxY);
      renderer.stroke();
    }
  } else if (mode === 'perpendicular_bisector' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
    const p1 = selectedElements[0] as GeoPoint;
    const mx = (p1.getX() + targetX) / 2, my = (p1.getY() + targetY) / 2;
    const a = targetX - p1.getX(), b = targetY - p1.getY();
    const cVal = -(a * mx + b * my);
    if (Math.abs(b) > 1e-6) {
      const y1 = (-cVal - a * minX) / b, y2 = (-cVal - a * maxX) / b;
      renderer.beginPath();
      renderer.moveTo(minX, y1);
      renderer.lineTo(maxX, y2);
      renderer.stroke();
    } else {
      const x = -cVal / a;
      renderer.beginPath();
      renderer.moveTo(x, minY);
      renderer.lineTo(x, maxY);
      renderer.stroke();
    }
    renderer.beginPath();
    renderer.arc(mx, my, 3 / coord.xScale, 0, 2 * Math.PI);
    renderer.fillStyle = 'rgba(100, 100, 100, 0.5)';
    renderer.fill();
  } else if (mode === 'angle_bisector' && selectedElements.length >= 1 && selectedElements.length < 3) {
    if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
      const p1 = selectedElements[0] as GeoPoint;
      renderer.beginPath();
      renderer.moveTo(p1.getX(), p1.getY());
      renderer.lineTo(targetX, targetY);
      renderer.stroke();
    } else if (selectedElements.length === 2 && isPoint(selectedElements[0]) && isPoint(selectedElements[1])) {
      const [A, B] = selectedElements as GeoPoint[];
      const Cx = targetX, Cy = targetY;
      const bax = A.getX() - B.getX(), bay = A.getY() - B.getY();
      const lenBA = Math.hypot(bax, bay);
      const bcx = Cx - B.getX(), bcy = Cy - B.getY();
      const lenBC = Math.hypot(bcx, bcy);
      if (lenBA > 1e-9 && lenBC > 1e-9) {
        const uX = bax / lenBA, uY = bay / lenBA, vX = bcx / lenBC, vY = bcy / lenBC;
        let nx = -uY, ny = uX;
        renderer.beginPath();
        renderer.moveTo(B.getX(), B.getY());
        renderer.lineTo(B.getX() + nx * 10000, B.getY() + ny * 10000);
        renderer.stroke();
      }
    }
  }
  renderer.setLineDash([]);
  renderer.restore();
}

/**
 * 在函数曲线上画一个 hover 吸附点标记。
 * 世界坐标（与所有其它 draw* 函数一致），scale 用于反算线宽。
 * 颜色默认高对比蓝，带一圈白色描边便于在暗/亮背景都可辨识。
 */
export function drawHoverMarker(
  renderer: IRenderer,
  coord: CoordinateSystem,
  worldX: number,
  worldY: number,
  color: string = '#3b82f6',
): void {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;
  const scale = coord.xScale;
  const r = 5 / scale;
  renderer.beginPath();
  renderer.arc(worldX, worldY, r, 0, 2 * Math.PI);
  renderer.fillStyle = color;
  renderer.fill();
  renderer.lineWidth = 2 / scale;
  renderer.strokeStyle = '#ffffff';
  renderer.stroke();
}
