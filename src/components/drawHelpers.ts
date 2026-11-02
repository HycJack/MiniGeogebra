/**
 * 纯绘制函数集合（GeoGebra / JSXGraph 式渲染管线）。
 *
 * 约定：所有坐标均为"世界坐标"；调用方在绘制开始前统一应用一次
 * 视图变换（scale(dpr) → translate(xZero,yZero) → scale(xScale,yScale)），
 * 因此本模块不依赖任何 canvasRef/state，可被 CanvasView / 导出逻辑 / 测试复用。
 */

import { IRenderer } from '../kernel/view/IRenderer';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { calculateGridStep } from '../kernel/core/Snap';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { sliderGeomScreen } from './sliderDrawable';
import { GeoLocus } from '../kernel/geo/GeoLocus';
import { GeoText } from '../kernel/geo/GeoText';
import { GeoArc } from '../kernel/geo/GeoArc';
import { GeoConicPart } from '../kernel/geo/GeoConicPart';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoPolyLine } from '../kernel/geo/GeoPolyLine';
import { GeoRay } from '../kernel/geo/GeoRay';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoCurve } from '../kernel/geo/GeoCurve';
import { GeoInequality } from '../kernel/geo/GeoInequality';
import { GeoBooleanRegion } from '../kernel/geo/GeoBooleanRegion';
import { GeoElement } from '../kernel/geo/GeoElement';
import { formatNumber } from '../kernel/core/Options';
import { WorldPoint } from './tools/types';
import { getLabelAnchor, labelDrawable } from './labels';

export interface DrawBounds { minX: number; maxX: number; minY: number; maxY: number; }

// ---- 基础绘图 ----

/** 坐标轴 + 网格。 */
/**
 * 轴刻度文本：按 max(rounding, 步长所需小数位) 显示——rounding 是"数值显示"
 * 选项，挪用于刻度时必须保证**相邻刻度可分辨**（rounding=1 且步长 0.01 时
 * 0.11/0.12 曾都渲染成 "0.1"，评审 U9）；被舍入成 0 的非零值回退 4 位有效数字。
 */
function axisLabelText(v: number, decimals: number): string {
  const formatted = formatNumber(v, { rounding: decimals });
  if (formatted === '0' && Math.abs(v) > 1e-12) return parseFloat(v.toPrecision(4)).toString();
  return formatted;
}

export function drawGrid(renderer: IRenderer, wScreen: number, hScreen: number, coord: CoordinateSystem, showGrid: boolean, showAxes: boolean, rounding = 2): void {
  const startX = coord.screenToWorldX(0);
  const endX = coord.screenToWorldX(wScreen);
  // y-up：屏幕顶部是世界 y 最大值；统一为 min/max 使循环方向无关
  const startY = Math.min(coord.screenToWorldY(0), coord.screenToWorldY(hScreen));
  const endY = Math.max(coord.screenToWorldY(0), coord.screenToWorldY(hScreen));

  // 网格步长唯一实现在 Snap.calculateGridStep（吸附与画线共用；此前两份拷贝，
  // 任何一边调参吸附点就会偏离网格线）
  const step = calculateGridStep(coord.xScale);

  const firstX = Math.floor(startX / step) * step;
  const firstY = Math.floor(startY / step) * step;

  // 刻度标签小数位：至少能分辨相邻两格（0.5→1 位、0.01→3 位），且不低于 rounding
  const stepDecimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + 1);
  const labelDecimals = Math.max(rounding, stepDecimals);

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
    // 轴正端内缩一个箭头长度（arrowLen 已是世界单位）：箭头完整落在视区内，
    // 不贴画布边缘——工具栏紧贴画布上缘，轴顶到边会在视觉上被压住。
    if (xInView) {
      const yTip = endY - arrowLen;
      renderer.beginPath();
      renderer.moveTo(0, startY);
      renderer.lineTo(0, yTip);
      renderer.stroke();
      // Y 轴正方向箭头：世界 y 向上为正，正端是 endY（视区上端，世界最大值），
      // 箭头画在正端、翼向 −y 张开（尖端朝上）。startY/endY 现为 min/max 语义。
      renderer.beginPath();
      renderer.moveTo(-arrowHalf, yTip - arrowLen);
      renderer.lineTo(0, yTip);
      renderer.lineTo(arrowHalf, yTip - arrowLen);
      renderer.stroke();
    }
    if (yInView) {
      const xTip = endX - arrowLen;
      renderer.beginPath();
      renderer.moveTo(startX, 0);
      renderer.lineTo(xTip, 0);
      renderer.stroke();
      // X 轴正方向箭头（向右）
      renderer.beginPath();
      renderer.moveTo(xTip - arrowLen, -arrowHalf);
      renderer.lineTo(xTip, 0);
      renderer.lineTo(xTip - arrowLen, arrowHalf);
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
        renderer.fillText(axisLabelText(x, labelDecimals), x, -4 / coord.xScale);
      }
    }
    renderer.textAlign = 'right';
    renderer.textBaseline = 'middle';
    const yLabelEvery = Math.max(1, Math.ceil(20 / (step * coord.yScale)));
    for (let y = firstY, labelIndex = 0; y <= endY; y += step, labelIndex++) {
      if (labelIndex % yLabelEvery !== 0) continue;
      if (Math.abs(y) > 1e-10) {
        renderer.fillText(axisLabelText(y, labelDecimals), -4 / coord.xScale, y);
      }
    }
    renderer.textAlign = 'right';
    renderer.textBaseline = 'top';
    renderer.fillText('0', -4 / coord.xScale, -4 / coord.xScale);
  }
}

/**
 * 对象标签：锚点/偏移由 labels.ts 统一给出，selected 时用高亮色。
 * 各 draw* 函数在绘制完几何本体后调用。
 */
export function drawLabel(renderer: IRenderer, el: GeoElement, selected: boolean, scale: number, bounds?: DrawBounds): void {
  if (!labelDrawable(el) || !el.isEffectivelyVisible()) return;
  const anchor = getLabelAnchor(el, scale, bounds);
  if (!anchor) return;
  // save/restore：font/textAlign/baseline/fillStyle 不外泄（评审 U-M4），
  // 否则 drawPolygon 等依赖调用前 fillStyle 的不变式只是碰巧成立
  renderer.save();
  renderer.font = `bold ${14 / scale}px sans-serif`;
  renderer.textAlign = anchor.align;
  renderer.textBaseline = anchor.baseline;
  renderer.fillStyle = selected ? '#1e40af' : '#1f2937';
  renderer.fillText(el.label, anchor.x, anchor.y);
  renderer.restore();
}

/** 点。 */
export function drawPoint(renderer: IRenderer, p: GeoPoint, selected: boolean, scale: number): void {
  if (!p.isDefined() || !p.isEffectivelyVisible()) return;
  const x = p.getX(), y = p.getY();
  // 点尺寸（像素）：比 GeoGebra 默认略大，投屏/高 DPI 下更醒目
  const baseRadius = selected ? 10 : 8;
  const pointRadius = baseRadius / scale;

  if (selected) {
    renderer.beginPath();
    renderer.arc(x, y, (baseRadius + 5) / scale, 0, 2 * Math.PI);
    renderer.strokeStyle = '#3b82f6';
    renderer.lineWidth = 2 / scale;
    renderer.stroke();
    renderer.beginPath();
    renderer.arc(x, y, (baseRadius + 10) / scale, 0, 2 * Math.PI);
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

  drawLabel(renderer, p, selected, scale);
}

/** 直线（贯穿整个视野）。 */
export function drawLine(renderer: IRenderer, l: GeoLine, selected: boolean, bounds: DrawBounds, scale: number): void {
  if (!l.isDefined() || !l.isEffectivelyVisible()) return;
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
  drawLabel(renderer, l, selected, scale, bounds);
}

/** 线段。 */
export function drawSegment(renderer: IRenderer, s: GeoSegment, selected: boolean, scale: number): void {
  if (!s.isDefined() || !s.isEffectivelyVisible()) return;
  const stroke = s.strokeColor ?? s.defaultStrokeColor;
  const baseWidth = s.strokeWidth ?? s.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  renderer.moveTo(s.startPoint.getX(), s.startPoint.getY());
  renderer.lineTo(s.endPoint.getX(), s.endPoint.getY());
  renderer.stroke();
  drawLabel(renderer, s, selected, scale);
}

/** 多边形（填充+描边）。 */
export function drawPolygon(renderer: IRenderer, poly: GeoPolygon, selected: boolean, scale: number): void {
  if (!poly.isDefined() || !poly.isEffectivelyVisible()) return;
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
  drawLabel(renderer, poly, selected, scale);
}

/** 圆锥曲线（圆 / 椭圆 / 双曲线 / 抛物线）。 */
export function drawConic(renderer: IRenderer, c: GeoConic, selected: boolean, scale: number, bounds?: DrawBounds): void {
  if (!c.isDefined() || !c.isEffectivelyVisible()) return;

  const stroke = c.strokeColor ?? c.defaultStrokeColor;
  const baseWidth = c.strokeWidth ?? c.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;

  // 退化为单一直线的圆锥曲线（如三点圆共线，官方退化语义 defined）：
  // 二次块为零、有线性项 → 按贯穿视野的直线绘制（曲线采样分支对退化型返回空）。
  const [cA, cB, cC, cD, cE, cF] = c.coeffs;
  const quadMag = Math.max(Math.abs(cA), Math.abs(cB), Math.abs(cC));
  const linMag = Math.max(Math.abs(cD), Math.abs(cE));
  if (quadMag < 1e-12 * Math.max(linMag, 1e-30) && linMag > 1e-12 && bounds) {
    renderer.beginPath();
    if (Math.abs(cE) > 1e-12) {
      const y1 = (-cF - cD * bounds.minX) / cE;
      const y2 = (-cF - cD * bounds.maxX) / cE;
      renderer.moveTo(bounds.minX, y1);
      renderer.lineTo(bounds.maxX, y2);
    } else {
      const x = -cF / cD;
      renderer.moveTo(x, bounds.minY);
      renderer.lineTo(x, bounds.maxY);
    }
    renderer.stroke();
    drawLabel(renderer, c, selected, scale);
    return;
  }

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

    drawLabel(renderer, c, selected, scale);
    return;
  }

  // General conic path: sample points along the curve
  const pts = c.samplePoints(360);
  if (pts.length < 2) return;

  // 双曲线采样含 NaN 断点（两支之间的空扇区），遇断点需 moveTo 重起路径。
  const strokePolyline = (points: { x: number; y: number }[]) => {
    renderer.beginPath();
    let started = false;
    for (const p of points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { started = false; continue; }
      if (!started) { renderer.moveTo(p.x, p.y); started = true; }
      else renderer.lineTo(p.x, p.y);
    }
    renderer.stroke();
  };

  if (selected) {
    renderer.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    renderer.lineWidth = 6 / scale;
    strokePolyline(pts);
    renderer.strokeStyle = '#3b82f6';
    renderer.lineWidth = baseWidth * 2 / scale;
  }

  strokePolyline(pts);

  drawLabel(renderer, c, selected, scale);
}

/** 轨迹曲线（断段绘制）。 */
export function drawLocus(renderer: IRenderer, locus: GeoLocus, selected: boolean, scale: number): void {
  if (!locus.isDefined() || !locus.isEffectivelyVisible()) return;
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
  drawLabel(renderer, locus, selected, scale);
}

/** 多边形布尔结果区域（可变轮廓填充 + 描边）。 */
export function drawBooleanRegion(renderer: IRenderer, region: GeoBooleanRegion, selected: boolean, scale: number): void {
  if (!region.isDefined() || !region.isEffectivelyVisible()) return;
  const fill = selected ? 'rgba(59, 130, 246, 0.35)' : (region.fillColor ?? region.defaultFillColor ?? 'rgba(59, 130, 246, 0.25)');
  const stroke = selected ? '#3b82f6' : (region.strokeColor ?? region.defaultStrokeColor);
  for (const contour of region.contours) {
    if (contour.length < 3) continue;
    renderer.beginPath();
    renderer.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) renderer.lineTo(contour[i].x, contour[i].y);
    renderer.closePath();
    renderer.fillStyle = fill;
    renderer.fill();
    renderer.strokeStyle = stroke;
    renderer.lineWidth = (selected ? 3 : 2) / scale;
    renderer.stroke();
  }
  // 标签放在首个轮廓形心
  if (region.contours.length > 0 && region.contours[0].length >= 3) {
    const c = region.contours[0];
    const cx = c.reduce((s, p) => s + p.x, 0) / c.length;
    const cy = c.reduce((s, p) => s + p.y, 0) / c.length;
    renderer.save();
    renderer.font = `bold ${14 / scale}px sans-serif`;
    renderer.fillStyle = selected ? '#1e40af' : '#1f2937';
    renderer.textAlign = 'left';
    renderer.textBaseline = 'bottom';
    if (region.label) renderer.fillText(region.label, cx + 10 / scale, cy + 10 / scale);
    renderer.restore();
  }
}

/** 显式函数曲线（输入栏 / 代数视图创建）。 */
export function drawText(
  renderer: IRenderer, el: GeoText, selected: boolean, scale: number,
): void {
  if (!el.isDefined() || !el.isEffectivelyVisible()) return;
  renderer.save();
  renderer.font = `${14 / scale}px sans-serif`;
  renderer.fillStyle = selected ? '#2563eb' : (el.strokeColor || '#111827');
  renderer.fillText(el.text, el.x, el.y);
  renderer.restore();
}

export function drawFunction(
  renderer: IRenderer, fn: GeoFunction, selected: boolean,
  bounds: DrawBounds, scale: number, pixelWidth: number,
): void {
  if (!fn.isDefined() || !fn.isEffectivelyVisible()) return;
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

  // 标签走统一 drawLabel（锚点 = 可视段中点，可命中/可拖），此前仅选中时
  // 固定画在视口左上角
  drawLabel(renderer, fn, selected, scale, bounds);
}

/** 参数曲线：自适应采样后描边，无定义处断开。 */
export function drawCurve(
  renderer: IRenderer,
  curve: GeoCurve,
  selected: boolean,
  bounds: DrawBounds,
  scale: number,
  pixelWidth: number,
): void {
  if (!curve.isDefined() || !curve.isEffectivelyVisible()) return;
  const viewHeight = Math.abs(bounds.maxY - bounds.minY) || 20;
  const samples = curve.updateSamples(pixelWidth, viewHeight);
  if (samples.length < 2) return;
  const stroke = curve.strokeColor ?? curve.defaultStrokeColor;
  const baseWidth = curve.strokeWidth ?? curve.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;

  let drawing = false;
  renderer.beginPath();
  for (const sample of samples) {
    if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y)) {
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

  // 标签走统一 drawLabel（锚点 = 可视段中点），此前仅选中时固定视口左上
  drawLabel(renderer, curve, selected, scale, bounds);
}

/** 向量（带箭头的线段）。 */
export function drawVector(renderer: IRenderer, v: GeoVector, selected: boolean, scale: number): void {
  if (!v.isDefined() || !v.isEffectivelyVisible()) return;
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
  drawLabel(renderer, v, selected, scale);
}

/** 折线。 */
export function drawPolyLine(renderer: IRenderer, pl: GeoPolyLine, selected: boolean, scale: number): void {
  if (!pl.isDefined() || !pl.isEffectivelyVisible() || pl.vertices.length < 2) return;
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
  drawLabel(renderer, pl, selected, scale);
}

/** 圆弧（GeoArc 和 GeoConicPart ARC 类型）。 */
export function drawArc(renderer: IRenderer, arc: GeoArc, selected: boolean, scale: number): void {
  if (!arc.isDefined() || !arc.isEffectivelyVisible()) return;
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
  drawLabel(renderer, arc, selected, scale);
}

/** 圆锥曲线片段（扇形 / 弓形 / 弧）。 */
export function drawConicPart(renderer: IRenderer, cp: GeoConicPart, selected: boolean, scale: number): void {
  if (!cp.isDefined() || !cp.isEffectivelyVisible()) return;
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
  } else if (cp.getPartType() === 2 && (cp.fillColor ?? cp.defaultFillColor)) {
    // 弓形填充（官方 DrawConicPart 对 OPEN 弧 fill 出弦封闭区）——此前只有扇形有填充
    renderer.fillStyle = cp.fillColor ?? cp.defaultFillColor!;
    renderer.beginPath();
    renderer.arc(center.x, center.y, r, sa, ea, ccw);
    renderer.closePath();
    renderer.fill();
  }

  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  if (cp.isSector()) {
    // 扇形描边连带两条半径（官方 PIE closure 一起 stroke）
    renderer.moveTo(center.x, center.y);
    renderer.lineTo(center.x + r * Math.cos(sa), center.y + r * Math.sin(sa));
  }
  renderer.arc(center.x, center.y, r, sa, ea, ccw);
  if (cp.isSector()) {
    renderer.closePath();
  } else if (cp.getPartType() !== 2) {
    // 弧不描弦；弓形另描弦（官方 OPEN 弧 stroke 不含弦，segment 弦是几何边界）
    renderer.stroke();
    renderer.beginPath();
  }
  renderer.stroke();

  if (cp.getPartType() === 2) { // SEGMENT
    renderer.beginPath();
    renderer.moveTo(center.x + r * Math.cos(sa), center.y + r * Math.sin(sa));
    renderer.lineTo(center.x + r * Math.cos(ea), center.y + r * Math.sin(ea));
    renderer.stroke();
  }
  drawLabel(renderer, cp, selected, scale);
}

/** 射线：延伸到视口外（官方 DrawRay 按视口尺度算端点）——固定 10000 世界
 *  单位在深缩放下画面中间截断。 */
export function drawRay(renderer: IRenderer, ray: GeoRay, selected: boolean, bounds: DrawBounds, scale: number): void {
  if (!ray.isDefined() || !ray.isEffectivelyVisible()) return;
  const sp = ray.getStartPoint();
  const dp = ray.getSecondPoint();
  const dx = dp.getX() - sp.getX(), dy = dp.getY() - sp.getY();
  if (Math.hypot(dx, dy) < 1e-12) return;
  const stroke = ray.strokeColor ?? ray.defaultStrokeColor;
  const baseWidth = ray.strokeWidth ?? ray.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  const extent = (bounds.maxX - bounds.minX) + (bounds.maxY - bounds.minY);
  renderer.beginPath();
  renderer.moveTo(sp.getX(), sp.getY());
  renderer.lineTo(sp.getX() + extent * dx, sp.getY() + extent * dy);
  renderer.stroke();
  drawLabel(renderer, ray, selected, scale);
}

// ---- 绘制预览（工具构造中，未提交前的临时效果）----

/** 根据当前模式渲染构造预览（预览线、预览圆、预览多边形等）。 */
export function renderPreviews(mode: string, selectedElements: readonly GeoElement[], mousePos: WorldPoint, hoveredPoint: GeoPoint | null, coord: CoordinateSystem, renderer: IRenderer, bounds?: DrawBounds, pathHit?: GeoElement | null): void {
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
        // 预览方向 = normalize(BA + BC)，与 AlgoAngleBisector 的最终构造一致
        //（此前画的是垂直于第一臂的方向，指示完全错误）
        let nx = uX + vX, ny = uY + vY;
        const wLen = Math.hypot(nx, ny);
        if (wLen < 1e-9) { nx = -uY; ny = uX; } // 180° 平角：与构造同样的垂直回退
        else { nx /= wLen; ny /= wLen; }
        renderer.beginPath();
        renderer.moveTo(B.getX(), B.getY());
        renderer.lineTo(B.getX() + nx * 10000, B.getY() + ny * 10000);
        renderer.stroke();
      }
    }
  }
  // 幽灵点预览（对标官方 previewable point）：点类工具 hover 在路径上时
    // 画出约束落点（线族线性投影 / 圆心向径投影），与随后 PointOn 的实际落点一致
    if ((mode === 'point' || mode === 'point_on_object') && pathHit && !hoveredPoint) {
      let gx: number | null = null;
      let gy: number | null = null;
      if (pathHit instanceof GeoSegment || pathHit instanceof GeoLine || pathHit instanceof GeoRay) {
        let ax: number, ay: number, dx: number, dy: number;
        if (pathHit instanceof GeoRay) {
          ax = pathHit.startPoint.getX(); ay = pathHit.startPoint.getY();
          dx = pathHit.secondPoint.getX() - ax; dy = pathHit.secondPoint.getY() - ay;
        } else {
          const l = pathHit as GeoLine;
          if (Math.abs(l.b) > 1e-9) { ax = 0; ay = -l.c / l.b; } else { ax = -l.c / l.a; ay = 0; }
          dx = -l.b; dy = l.a;
        }
        const len2 = dx * dx + dy * dy;
        if (len2 > 1e-12) {
          let t = ((mousePos.x - ax) * dx + (mousePos.y - ay) * dy) / len2;
          if (pathHit instanceof GeoSegment) t = Math.max(0, Math.min(1, t));
          if (pathHit instanceof GeoRay) t = Math.max(0, t);
          gx = ax + t * dx; gy = ay + t * dy;
        }
      } else if (pathHit instanceof GeoConic && pathHit.isCircle()) {
        const c = pathHit.getCenter();
        const r = pathHit.getRadius();
        const ddx = mousePos.x - c.x, ddy = mousePos.y - c.y;
        const len = Math.hypot(ddx, ddy);
        if (len > 1e-12) { gx = c.x + (r * ddx) / len; gy = c.y + (r * ddy) / len; }
      }
      if (gx !== null && gy !== null) {
        renderer.beginPath();
        renderer.arc(gx, gy, 4.5 / coord.xScale, 0, 2 * Math.PI);
        renderer.strokeStyle = 'rgba(59, 130, 246, 0.9)';
        renderer.lineWidth = 2 / coord.xScale;
        renderer.setLineDash([]);
        renderer.stroke();
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



/** 二元不等式区域：逐行扫描线填充；边界按形态渲染——g 与 x/y 无关时画
 *  水平/垂直直线（此前 y>c 类完全不画），一般情形逐行精化点近邻连成折线
 *  （此前是逐行竖向短线，呈阶梯状）。 */
export function drawInequality(
  renderer: IRenderer,
  ineq: GeoInequality,
  bounds: DrawBounds,
  scale: number,
  selected = false,
): void {
  if (!ineq.isDefined() || !ineq.isEffectivelyVisible()) return;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0) return;

  const cols = Math.max(24, Math.min(240, Math.ceil(width * scale / 2)));
  const rows = Math.max(24, Math.min(240, Math.ceil(height * scale / 2)));
  const dx = width / cols;
  const dy = height / rows;

  const stroke = selected ? '#3b82f6' : (ineq.strokeColor ?? ineq.defaultStrokeColor);
  const fill = ineq.fillColor ?? ineq.defaultFillColor ?? 'rgba(124, 58, 237, 0.18)';

  // 第一遍：收集每一行满足条件的区间（边界处二分精化）
  const spans: Array<{ y: number; x0: number; x1: number }> = [];
  const boundaryPts: Array<{ x: number; y: number }> = [];

  for (let r = 0; r < rows; r++) {
    const y = bounds.minY + (r + 0.5) * dy;
    const satisfiedAt = (c: number): boolean => ineq.satisfied(bounds.minX + (c + 0.5) * dx, y);

    const intervals: Array<{ a: number; b: number }> = [];
    let start = -1;
    for (let c = 0; c < cols; c++) {
      if (satisfiedAt(c) && start === -1) start = c;
      else if (!satisfiedAt(c) && start !== -1) {
        intervals.push({ a: start, b: c - 1 });
        start = -1;
      }
    }
    if (start !== -1) intervals.push({ a: start, b: cols - 1 });

    for (const { a, b } of intervals) {
      const xa = bounds.minX + a * dx;
      const xb = bounds.minX + (b + 1) * dx;
      const x0 = refineBoundary(ineq, xa, y, dx / 2, 0) ?? xa;
      const x1 = refineBoundary(ineq, xb, y, dx / 2, 0) ?? xb;
      spans.push({ y, x0, x1 });
      if (x0 > bounds.minX + 1e-9) boundaryPts.push({ x: x0, y });
      if (x1 < bounds.maxX - 1e-9) boundaryPts.push({ x: x1, y });
    }
  }

  if (spans.length === 0) return;

  // 填充：所有区间矩形合成一个路径一次填充
  renderer.fillStyle = fill;
  renderer.beginPath();
  for (const span of spans) {
    renderer.moveTo(span.x0, span.y - dy / 2);
    renderer.lineTo(span.x1, span.y - dy / 2);
    renderer.lineTo(span.x1, span.y + dy / 2);
    renderer.lineTo(span.x0, span.y + dy / 2);
    renderer.closePath();
  }
  renderer.fill();

  // 边界轮廓：严格不等式虚线，非严格实线
  const strokeBoundary = (): void => {
    renderer.strokeStyle = stroke;
    renderer.lineWidth = (ineq.strokeWidth ?? ineq.defaultLineWidth) / scale;
    if (!ineq.includesBoundary()) renderer.setLineDash([4 / scale, 4 / scale]);
  };

  if (ineq.boundaryIndependentOf('x')) {
    // g 只依赖 y：边界是水平线 y=c（可多条，如 y²<4）
    const roots = rootsAlongAxis(ineq, 'y', rows, bounds, (bounds.minX + bounds.maxX) / 2);
    strokeBoundary();
    renderer.beginPath();
    for (const y0 of roots) {
      renderer.moveTo(bounds.minX, y0);
      renderer.lineTo(bounds.maxX, y0);
    }
    renderer.stroke();
    renderer.setLineDash([]);
  } else if (ineq.boundaryIndependentOf('y')) {
    // g 只依赖 x：边界是垂直线 x=c（可多条）
    const roots = rootsAlongAxis(ineq, 'x', cols, bounds, (bounds.minY + bounds.maxY) / 2);
    strokeBoundary();
    renderer.beginPath();
    for (const x0 of roots) {
      renderer.moveTo(x0, bounds.minY);
      renderer.lineTo(x0, bounds.maxY);
    }
    renderer.stroke();
    renderer.setLineDash([]);
  } else if (boundaryPts.length >= 2) {
    // 一般情形：逐行精化点近邻连成折线（半径 3·max(dx,dy) 内取最近未用点）
    strokeBoundary();
    const radius2 = Math.pow(3 * Math.max(dx, dy), 2);
    const used = new Array(boundaryPts.length).fill(false);
    renderer.beginPath();
    for (let i = 0; i < boundaryPts.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      let cur = boundaryPts[i];
      renderer.moveTo(cur.x, cur.y);
      while (true) {
        let best = -1;
        let bestD2 = radius2;
        for (let j = 0; j < boundaryPts.length; j++) {
          if (used[j]) continue;
          const ddx = boundaryPts[j].x - cur.x;
          const ddy = boundaryPts[j].y - cur.y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < bestD2) { bestD2 = d2; best = j; }
        }
        if (best === -1) break;
        used[best] = true;
        cur = boundaryPts[best];
        renderer.lineTo(cur.x, cur.y);
      }
    }
    renderer.stroke();
    renderer.setLineDash([]);
  }

  drawLabel(renderer, ineq, selected, scale, bounds);
}

/** 沿单一坐标轴扫描 g 的符号变化并二分求根（最多 8 个）；fixed 为另一轴的取值。 */
function rootsAlongAxis(
  ineq: GeoInequality,
  axis: 'x' | 'y',
  steps: number,
  bounds: DrawBounds,
  fixed: number,
): number[] {
  const lo = axis === 'x' ? bounds.minX : bounds.minY;
  const hi = axis === 'x' ? bounds.maxX : bounds.maxY;
  const at = (t: number): number => (axis === 'x' ? ineq.evaluateDiff(t, fixed) : ineq.evaluateDiff(fixed, t));
  const step = (hi - lo) / steps;
  const roots: number[] = [];
  let prevT = lo;
  let prevF = at(lo);
  for (let s = 1; s <= steps && roots.length < 8; s++) {
    const t = lo + s * step;
    const f = at(t);
    if (Number.isFinite(prevF) && Number.isFinite(f) && prevF === 0) {
      roots.push(prevT);
    } else if (Number.isFinite(prevF) && Number.isFinite(f) && (prevF < 0) !== (f < 0)) {
      // 二分精化
      let a = prevT, b = t;
      for (let k = 0; k < 24; k++) {
        const m = (a + b) / 2;
        const fm = at(m);
        if (!Number.isFinite(fm) || (at(a) < 0) !== (fm < 0)) b = m; else a = m;
      }
      roots.push((a + b) / 2);
    }
    prevT = t; prevF = f;
  }
  return roots;
}

/** 从粗网格边界沿 x 向二分精化 g(x,y)=0 的位置；g 两侧同号时返回 null。 */
function refineBoundary(
  ineq: GeoInequality,
  x: number,
  y: number,
  halfStep: number,
  depth: number,
): number | null {
  if (depth >= 8 || halfStep < 1e-7) return x;
  const gLeft = ineq.evaluateDiff(x - halfStep, y);
  const gRight = ineq.evaluateDiff(x + halfStep, y);
  if (!Number.isFinite(gLeft) || !Number.isFinite(gRight)) return null;
  if (gLeft === 0) return x - halfStep;
  if (gRight === 0) return x + halfStep;
  if (gLeft * gRight > 0) return null;
  const mid = x + (gLeft / (gLeft - gRight)) * 2 * halfStep;
  const gMid = ineq.evaluateDiff(mid, y);
  if (!Number.isFinite(gMid)) return x;
  if (Math.abs(gMid) < 1e-9) return mid;
  return refineBoundary(ineq, mid, y, Math.abs(mid - x) / 2, depth + 1);
}

/**
 * 角度弧标记（官方 DrawAngle）：角度数值（isAngle）在顶点处画浅填充扇形 + 细弧。
 * 支持三点角（顶点 P2）、两点角（顶点为原点）、两线角（顶点为交点）；
 * 扫向统一为 [0,2π) 逆时针（与 AlgoAngle 的 atan2 语义一致）。
 * 此前角度测量值在画布上零呈现（H2-12 后半句）。
 */
export function drawAngleMarker(renderer: IRenderer, num: GeoNumeric, scale: number): void {
  if (!num.isAngle || !num.isDefined() || !num.isEffectivelyVisible()) return;
  const algo = num.parentAlgo;
  if (!algo) return;
  const angle = num.getValue();
  if (!Number.isFinite(angle) || angle <= 1e-9) return;
  const cls = algo.getClassName();
  let vx = 0, vy = 0, a0 = 0;
  if (cls === 'AlgoAngle' || cls === 'AlgoAngleOriented') {
    const [p1, p2, p3] = algo.getInput() as GeoPoint[];
    if (!p1?.isDefined() || !p2?.isDefined() || !p3?.isDefined()) return;
    vx = p2.getX(); vy = p2.getY();
    a0 = Math.atan2(p1.getY() - vy, p1.getX() - vx);
  } else if (cls === 'AlgoAngleTwoPoints') {
    const [p1, p2] = algo.getInput() as GeoPoint[];
    if (!p1?.isDefined() || !p2?.isDefined()) return;
    a0 = Math.atan2(p1.getY(), p1.getX());
  } else if (cls === 'AlgoAngleTwoLines') {
    const [l1, l2] = algo.getInput() as GeoLine[];
    if (!l1?.isDefined() || !l2?.isDefined()) return;
    const det = l1.a * l2.b - l2.a * l1.b;
    if (Math.abs(det) < 1e-12) return; // 平行线无交点（无顶点）
    vx = (l1.b * l2.c - l2.b * l1.c) / det;
    vy = (l2.a * l1.c - l1.a * l2.c) / det;
    a0 = Math.atan2(l1.b, l1.a); // 法向方向为角的始边
  } else {
    return;
  }
  const r = 18 / scale;
  const stroke = num.strokeColor ?? num.defaultStrokeColor;
  renderer.save();
  // 浅填充扇形（顶点 → 弧）
  renderer.beginPath();
  renderer.moveTo(vx, vy);
  renderer.arc(vx, vy, r, a0, a0 + angle, false);
  renderer.closePath();
  renderer.fillStyle = num.fillColor ?? 'rgba(124, 58, 237, 0.18)';
  renderer.fill();
  // 细弧
  renderer.beginPath();
  renderer.arc(vx, vy, r, a0, a0 + angle, false);
  renderer.strokeStyle = stroke;
  renderer.lineWidth = 1.5 / scale;
  renderer.stroke();
  renderer.restore();
}

/**
 * 画布滑条（对标官方 DrawSlider）：轨道线 + 圆形滑块 + `a = 值` 标签。
 * 滑条位置是屏幕绝对坐标——在世界变换内按 当前往返换算 绘制，
 * 平移/缩放后滑条仍锚定在原屏幕位置（官方 absolute screen loc 语义）。
 * 垂直滑条轨道向上延伸（官方 sy − w）。
 */
export function drawSliderDrawable(renderer: IRenderer, num: GeoNumeric, selected: boolean, coord: CoordinateSystem): void {
  if (!num.isDefined() || !num.isEffectivelyVisible() || !num.sliderVisible) return;
  const g = sliderGeomScreen(num);
  // 屏幕 px → 世界坐标（xZero/yZero 为世界原点的屏幕位置）
  const toW = (px: number, py: number) => ({
    x: (px - coord.xZero) / coord.xScale,
    y: (coord.yZero - py) / coord.yScale,
  });
  const start = toW(g.sx, g.sy);
  const end = toW(g.ex, g.ey);
  const knob = toW(g.kx, g.ky);
  const blob = num.sliderBlobSize / coord.xScale;
  const color = num.strokeColor ?? num.defaultStrokeColor;

  // 轨道（官方视觉：细浅色线；thickness=10 只是命中热区宽度）
  renderer.save();
  renderer.strokeStyle = withAlpha(color, 0.45);
  renderer.lineWidth = 2 / coord.xScale;
  renderer.beginPath();
  renderer.moveTo(start.x, start.y);
  renderer.lineTo(end.x, end.y);
  renderer.stroke();

  // 滑块外环（官方 circleOuter：selColor 浅色填充）
  renderer.beginPath();
  renderer.arc(knob.x, knob.y, blob + 3 / coord.xScale, 0, 2 * Math.PI);
  renderer.fillStyle = selected ? 'rgba(59,130,246,0.45)' : 'rgba(191,219,254,0.9)';
  renderer.fill();

  // 滑块本体（官方：objectColor 填充 + NEUTRAL_900 深色描边）
  renderer.beginPath();
  renderer.arc(knob.x, knob.y, blob, 0, 2 * Math.PI);
  renderer.fillStyle = color;
  renderer.fill();
  renderer.strokeStyle = '#374151';
  renderer.lineWidth = 1 / coord.xScale;
  renderer.stroke();
  renderer.restore();

  // `a = 值` 标签（官方 LABEL_NAME_VALUE：水平滑条在滑块上方，垂直在右侧）
  if (num.labelVisible && num.label) {
    const labelScreen = g.horizontal
      ? { x: g.kx + 4, y: g.ky - num.sliderBlobSize - 8 }
      : { x: g.kx + num.sliderBlobSize + 8, y: g.ky + 4 };
    const labelW = toW(labelScreen.x, labelScreen.y);
    renderer.save();
    renderer.font = `bold ${14 / coord.xScale}px sans-serif`;
    renderer.fillStyle = selected ? '#1e40af' : '#1f2937';
    renderer.textAlign = 'left';
    renderer.textBaseline = 'bottom';
    renderer.fillText(`${num.label} = ${num.formatValue()}`, labelW.x, labelW.y);
    renderer.restore();
  }
}

/** 十六进制/rgba 颜色字符串叠加透明度（IRenderer 无 globalAlpha 通道）。 */
function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const r = parseInt(hex[1].slice(0, 2), 16);
    const g = parseInt(hex[1].slice(2, 4), 16);
    const b = parseInt(hex[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(color.trim());
  if (rgba) {
    const parts = rgba[1].split(',').map(p => p.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  return color;
}
