/**
 * 纯绘制函数集合（GeoGebra / JSXGraph 式渲染管线）。
 *
 * 约定：所有坐标均为"世界坐标"；调用方在绘制开始前统一应用一次
 * 视图变换（scale(dpr) → translate(xZero,yZero) → scale(xScale,yScale)），
 * 因此本模块不依赖任何 canvasRef/state，可被 CanvasView / 导出逻辑 / 测试复用。
 */

import { IRenderer } from '../kernel/view/IRenderer';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoLocus } from '../kernel/geo/GeoLocus';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { WorldPoint } from './tools/types';
import { lineWorldEndpoints, lineFromTwoPoints } from './tools/hitTests';

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
    renderer.strokeStyle = '#e5e7eb';
    renderer.lineWidth = 1 / coord.xScale;
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
    renderer.strokeStyle = '#9ca3af';
    renderer.lineWidth = 2 / coord.xScale;
    if (0 >= startX && 0 <= endX) {
      renderer.beginPath();
      renderer.moveTo(0, startY);
      renderer.lineTo(0, endY);
      renderer.stroke();
    }
    if (0 >= startY && 0 <= endY) {
      renderer.beginPath();
      renderer.moveTo(startX, 0);
      renderer.lineTo(endX, 0);
      renderer.stroke();
    }

    renderer.fillStyle = '#6b7280';
    renderer.font = `${10 / coord.xScale}px sans-serif`;
    renderer.textAlign = 'center';
    renderer.textBaseline = 'top';
    for (let x = firstX; x <= endX; x += step) {
      if (Math.abs(x) > 1e-10) {
        renderer.fillText(parseFloat(x.toPrecision(4)).toString(), x, 4 / coord.xScale);
      }
    }
    renderer.textAlign = 'right';
    renderer.textBaseline = 'middle';
    for (let y = firstY; y <= endY; y += step) {
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
  if (!p.isDefined()) return;
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
  renderer.fillStyle = selected ? '#1e40af' : '#1f2937';
  renderer.textBaseline = 'bottom';
  renderer.fillText(label, x + 15, y - 15);
}

/** 直线（贯穿整个视野）。 */
export function drawLine(renderer: IRenderer, l: GeoLine, selected: boolean, bounds: DrawBounds, scale: number): void {
  if (!l.isDefined()) return;
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
  if (!s.isDefined()) return;
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
  if (!poly.isDefined()) return;
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

/** 圆（圆锥曲线）。 */
export function drawConic(renderer: IRenderer, c: GeoConic, selected: boolean, scale: number): void {
  if (!c.isDefined()) return;
  const center = c.getCenter();
  const r = c.getRadius();
  if (r <= 0) return;

  if (selected) {
    renderer.beginPath();
    renderer.arc(center.x, center.y, r + 4 / scale, 0, 2 * Math.PI);
    renderer.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    renderer.lineWidth = 6 / scale;
    renderer.stroke();
  }

  const stroke = c.strokeColor ?? c.defaultStrokeColor;
  const baseWidth = c.strokeWidth ?? c.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
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
}

/** 轨迹曲线（断段绘制）。 */
export function drawLocus(renderer: IRenderer, locus: GeoLocus, selected: boolean, scale: number): void {
  if (!locus.isDefined()) return;
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

// ---- Phase 2：射线 / 弧 / 正多边形的纯绘制 ----

/** 射线：从原点 P0 经过 P1 向外无限延伸（视口内截断），并在起点处画实心标记。 */
export function drawRay(renderer: IRenderer, ray: any, selected: boolean, scale: number, bounds: DrawBounds): void {
  if (!ray.isDefined()) return;
  const p0 = ray.getStartPoint();
  const p1 = ray.getSecondPoint();
  const stroke = ray.strokeColor ?? ray.defaultStrokeColor;
  const baseWidth = ray.strokeWidth ?? ray.defaultLineWidth;
  const w = (selected ? baseWidth * 2 : baseWidth) / scale;

  const { a, b, c } = lineFromTwoPoints(p0, p1);
  const dirs = lineWorldEndpoints(a, b, c, bounds);
  const dirVec = { x: p1.x - p0.x, y: p1.y - p0.y };
  const len2 = dirVec.x * dirVec.x + dirVec.y * dirVec.y;
  const pts: WorldPoint[] = [{ x: p0.x, y: p0.y }];
  if (dirs && len2 > 0) {
    const ts: number[] = [];
    [dirs.p0, dirs.p1].forEach(ep => {
      const t = ((ep.x - p0.x) * dirVec.x + (ep.y - p0.y) * dirVec.y) / len2;
      if (t >= 0) ts.push(t);
    });
    ts.sort((x, y) => x - y);
    if (ts.length > 0) pts.push({ x: p0.x + (dirVec.x / len2) * ts[ts.length - 1], y: p0.y + (dirVec.y / len2) * ts[ts.length - 1] });
  }
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = w;
  renderer.beginPath();
  renderer.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) renderer.lineTo(pts[i].x, pts[i].y);
  renderer.stroke();
  // 起点标记
  renderer.fillStyle = selected ? '#1e3a8a' : stroke;
  renderer.beginPath();
  renderer.arc(p0.x, p0.y, 4 / scale, 0, 2 * Math.PI);
  renderer.fill();
}

/** 圆弧：圆心+起止角的部分圆弧（fill 时为扇形）。 */
export function drawArc(renderer: IRenderer, arc: any, selected: boolean, scale: number): void {
  if (!arc.isDefined()) return;
  const cx = arc.getCenter().x, cy = arc.getCenter().y;
  const r = arc.getRadius();
  if (r <= 0) return;

  if (selected) {
    renderer.beginPath();
    renderer.arc(cx, cy, r + 4 / scale, 0, 2 * Math.PI);
    renderer.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    renderer.lineWidth = 6 / scale;
    renderer.stroke();
  }

  const stroke = arc.strokeColor ?? arc.defaultStrokeColor;
  const baseWidth = arc.strokeWidth ?? arc.defaultLineWidth;
  renderer.strokeStyle = selected ? '#3b82f6' : stroke;
  renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
  renderer.beginPath();
  renderer.arc(cx, cy, r, arc.getStartAngle(), arc.getEndAngle(), !!arc.isCounterClockwise());
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
  const isLine = (el: any): el is GeoLine => el instanceof GeoLine;

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
  renderer.restore();
}

// ---- Phase 2：测量数值在图形区标注 ----

/** 为距离/角度/面积测量在图形区生成标注标签。 */
export function drawMeasurementLabels(elements: readonly ConstructionElement[], renderer: IRenderer, scale: number, bounds: DrawBounds): void {
  const getAlgoOutputMap = (els: readonly ConstructionElement[]) => {
    const map = new Map<any, any>();
    for (const e of els) {
      const pe = (e as any).parentAlgo;
      if (pe) {
        const out = pe.getOutput?.();
        if (out && out !== e) map.set(out.id, pe);
      }
    }
    return map;
  };
  const algoMap = getAlgoOutputMap(elements);
  const eps = 5 / scale;

  for (const el of elements) {
    if (!(el instanceof GeoNumeric)) continue;
    const algo = algoMap.get(el.id);
    if (!algo) continue;
    const type = algo.getClassName?.() ?? '';
    const v = el.getValue();
    if (!Number.isFinite(v)) continue;
    if (!(type === 'AlgoDistance' || type === 'AlgoAngle' || type === 'AlgoArea')) continue;

    let anchor: WorldPoint | undefined;
    if (type === 'AlgoDistance') {
      const [a, b] = algo.getInput?.() ?? [];
      if (a instanceof GeoPoint && b instanceof GeoPoint) anchor = { x: (a.getX() + b.getX()) / 2, y: (a.getY() + b.getY()) / 2 };
      else if (a instanceof GeoLine && b instanceof GeoPoint) {
        const { a: A, b: B, c: C } = a as GeoLine;
        const d = A * A + B * B;
        anchor = { x: (B * (B * b.getX() - A * b.getY()) - A * C) / d, y: (A * (-B * b.getX() + A * b.getY()) - B * C) / d };
      }
    } else if (type === 'AlgoAngle') {
      const [_, p2] = algo.getInput?.() ?? [];
      if (p2 instanceof GeoPoint) anchor = { x: p2.getX(), y: p2.getY() };
    } else if (type === 'AlgoArea') {
      const [target] = algo.getInput?.() ?? [];
      if (target instanceof GeoPolygon && target.vertices.length >= 3) {
        let sx = 0, sy = 0;
        for (const v of target.vertices) { sx += v.getX(); sy += v.getY(); }
        anchor = { x: sx / target.vertices.length, y: sy / target.vertices.length };
      } else if (target instanceof GeoConic) {
        const { x, y } = (target as GeoConic).getCenter();
        anchor = { x, y };
      }
    }
    if (!anchor) continue;

    let label: string;
    if (type === 'AlgoDistance') label = parseFloat(v.toFixed(2)).toString();
    else if (type === 'AlgoAngle') label = `${parseFloat((v * 180 / Math.PI).toFixed(1))}\u00B0`;
    else label = parseFloat(v.toFixed(2)).toString();

    const off = 20 / scale;
    renderer.font = `${11 / scale}px sans-serif`;
    renderer.textBaseline = 'bottom';
    renderer.fillStyle = '#1f2937';
    renderer.fillText(label, anchor.x + off, anchor.y - off);
  }
}
