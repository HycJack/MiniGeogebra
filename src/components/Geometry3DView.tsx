/**
 * Geometry3DView —— 3D 视图模式。
 *
 * 使用独立 WebGL2 渲染后端（WebGL3DRenderer）把当前构造投影到透视三维空间。
 * 参考 GeoGebra 3D 界面，集成：
 *   - 3D 专用工具栏（投影模式 / 标准视图 / 坐标轴平面 / 网格 / 旋转动画）
 *   - 导航方块（右上角）
 *   - 坐标轴标签（X, Y, Z 绘制在 2D overlay 上）
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WebGL3DRenderer, Scene3D, V3, Line3, Fill3, Point3, ProjectionMode, StandardView, Plane3 } from '../kernel/view/WebGL3DRenderer';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoArc } from '../kernel/geo/GeoArc';
import { GeoLocus } from '../kernel/geo/GeoLocus';
import { useLanguage } from '../i18n/LanguageContext';
import NavigationCube from './NavigationCube';
import Geometry3DToolbar from './Geometry3DToolbar';

interface Props {
  kernel: Kernel;
  renderRev: number;
  selectedElements: GeoElement[];
  showGrid: boolean;
  showAxes: boolean;
  setShowGrid: (v: boolean | ((p: boolean) => boolean)) => void;
  setShowAxes: (v: boolean | ((p: boolean) => boolean)) => void;
}

interface Bounds2 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface LineStyle {
  color: string;
  width: number;
  dash?: number[];
}

/** 世界坐标 → 3D 坐标（构造面 z=0，世界 y 向下对应三维 −Y）。 */
const to3 = (x: number, y: number, z = 0): V3 => ({ x, y: -y, z });

/** 坐标轴刻度数字格式化（避免浮点尾差）。 */
function fmtNum(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v) >= 1000) return v.toExponential(0);
  return parseFloat(v.toPrecision(6)).toString();
}

/** 依据构造元素估算场景包围盒（带留白）。 */
function computeBounds(elements: readonly ConstructionElement[]): Bounds2 {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const el of elements) {
    if (el instanceof GeoPoint) {
      if (el.isDefined()) add(el.getX(), el.getY());
    } else if (el instanceof GeoSegment) {
      if (el.isDefined()) { add(el.startPoint.getX(), el.startPoint.getY()); add(el.endPoint.getX(), el.endPoint.getY()); }
    } else if (el instanceof GeoPolygon) {
      for (const v of el.vertices) add(v.getX(), v.getY());
    } else if (el instanceof GeoConic) {
      if (el.isDefined()) {
        const c = el.getCenter();
        const r = el.getRadius();
        if (r > 0) { add(c.x - r, c.y - r); add(c.x + r, c.y + r); }
      }
    } else if (el instanceof GeoLocus) {
      for (const s of el.getSamples()) add(s.x, s.y);
    }
  }
  if (!Number.isFinite(minX)) return { minX: -500, maxX: 500, minY: -350, maxY: 350 };
  const pad = Math.max((maxX - minX) * 0.15, (maxY - minY) * 0.15, 60);
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
}

/** 元素样式。 */
function styleOf(el: GeoElement, selected: boolean): LineStyle {
  const base = el.strokeWidth ?? el.defaultLineWidth;
  return {
    color: selected ? '#3b82f6' : (el.strokeColor ?? el.defaultStrokeColor),
    width: selected ? base * 2 : base,
    dash: el.strokeDash ? [...el.strokeDash] : undefined,
  };
}

function estimatePxPerUnit(renderer: WebGL3DRenderer): number {
  const t = renderer.target;
  const p0 = renderer.projectToScreen(t);
  const p1 = renderer.projectToScreen({ x: t.x + 1, y: t.y, z: t.z });
  if (!p0 || !p1) return 1;
  const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  return d > 1e-6 ? d : 1;
}

function pushSegment(lines: Line3[], ax: number, ay: number, bx: number, by: number, style: LineStyle, pxPerUnit: number): void {
  if (Math.hypot(bx - ax, by - ay) < 1e-9) return;
  lines.push({
    a: to3(ax, ay), b: to3(bx, by),
    color: style.color,
    widthPx: style.width,
    dash: style.dash ? [...style.dash] : undefined,
  });
}

function pushPolyline(lines: Line3[], pts: V3[], style: LineStyle, pxPerUnit: number): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < 1e-9) continue;
    lines.push({ a, b, color: style.color, widthPx: style.width, dash: style.dash ? [...style.dash] : undefined });
  }
}

function circlePolyline(renderer: WebGL3DRenderer, cx: number, cy: number, r: number, a0: number, a1: number): V3[] {
  if (r <= 0) return [];
  const p0 = renderer.projectToScreen(to3(cx, cy));
  const p1 = renderer.projectToScreen(to3(cx + r, cy));
  const sweep = Math.abs(a1 - a0);
  let steps = 48;
  if (p0 && p1) {
    const dpx = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const full = Math.max(16, Math.min(960, Math.ceil((2 * Math.PI * dpx) / 3)));
    steps = Math.max(8, Math.round((full * sweep) / (2 * Math.PI)));
  }
  const pts: V3[] = [];
  for (let i = 0; i <= steps; i++) {
    const ang = a0 + (a1 - a0) * (i / steps);
    pts.push(to3(cx + r * Math.cos(ang), cy + r * Math.sin(ang)));
  }
  return pts;
}

function arcRange(arc: GeoArc): { a0: number; a1: number } {
  let a0 = arc.getStartAngle();
  let a1 = arc.getEndAngle();
  if (arc.isCounterClockwise()) {
    if (a1 <= a0) a1 += 2 * Math.PI;
  } else if (a1 >= a0) {
    a1 -= 2 * Math.PI;
  }
  return { a0, a1 };
}

function clipInfiniteLine(l: GeoLine, b: Bounds2): { x1: number; y1: number; x2: number; y2: number } | null {
  const eps = 1e-6;
  if (Math.abs(l.b) > eps) {
    return { x1: b.minX, y1: (-l.c - l.a * b.minX) / l.b, x2: b.maxX, y2: (-l.c - l.a * b.maxX) / l.b };
  }
  if (Math.abs(l.a) < eps) return null;
  const x = -l.c / l.a;
  return { x1: x, y1: b.minY, x2: x, y2: b.maxY };
}

function faceFacingUp(verts: V3[]): V3[] {
  if (verts.length < 3) return verts;
  const v0 = verts[0], v1 = verts[1], v2 = verts[2];
  const crossZ = (v1.x - v0.x) * (v2.y - v0.y) - (v1.y - v0.y) * (v2.x - v0.x);
  return crossZ > 0 ? verts.slice().reverse() : verts;
}

function isVisibleFace(verts: V3[], renderer: WebGL3DRenderer): boolean {
  if (verts.length < 3) return false;
  const eye = renderer.getEye();
  let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const a = verts[j], b = verts[i];
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
    cx += b.x; cy += b.y; cz += b.z;
  }
  const n = verts.length;
  cx /= n; cy /= n; cz /= n;
  return nx * (eye.x - cx) + ny * (eye.y - cy) + nz * (eye.z - cz) > 0;
}

function buildScene(
  kernel: Kernel,
  selected: readonly GeoElement[],
  showGrid: boolean,
  showAxes: boolean,
  axesPlaneMode: number,
  showXY: boolean,
  showXZ: boolean,
  showYZ: boolean,
  renderer: WebGL3DRenderer,
): Scene3D {
  const elements = kernel.getConstruction().getElements();
  const bounds = computeBounds(elements);
  const viewBounds = renderer.getViewBoundsXY();
  const selSet = new Set(selected);
  const lines: Line3[] = [];
  const fills: Fill3[] = [];
  const points: Point3[] = [];
  const pxPerUnit = estimatePxPerUnit(renderer);

  for (const el of elements) {
    if (!(el instanceof GeoElement) || !el.isDefined()) continue;
    if (el instanceof GeoSegment) {
      const st = styleOf(el, selSet.has(el));
      pushSegment(lines, el.startPoint.getX(), el.startPoint.getY(), el.endPoint.getX(), el.endPoint.getY(), st, pxPerUnit);
    } else if (el instanceof GeoLine) {
      const clipped = clipInfiniteLine(el, bounds);
      if (clipped) {
        const st = styleOf(el, selSet.has(el));
        pushSegment(lines, clipped.x1, clipped.y1, clipped.x2, clipped.y2, st, pxPerUnit);
      }
    } else if (el instanceof GeoArc) {
      const { a0, a1 } = arcRange(el);
      const st = styleOf(el, selSet.has(el));
      const pts = circlePolyline(renderer, el.getCenter().x, el.getCenter().y, el.getRadius(), a0, a1);
      pushPolyline(lines, pts, st, pxPerUnit);
    } else if (el instanceof GeoConic) {
      const c = el.getCenter();
      const r = el.getRadius();
      if (r <= 0) continue;
      const st = styleOf(el, selSet.has(el));
      const pts = circlePolyline(renderer, c.x, c.y, r, 0, 2 * Math.PI);
      pushPolyline(lines, pts, st, pxPerUnit);
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoPolygon) || !el.isDefined() || el.vertices.length < 3) continue;
    const verts = faceFacingUp(el.vertices.map(v => to3(v.getX(), v.getY())));
    if (isVisibleFace(verts, renderer)) {
      fills.push({ verts, color: el.fillColor ?? el.defaultFillColor ?? 'rgba(59, 130, 246, 0.2)' });
    }
    const st = styleOf(el, selSet.has(el));
    for (let i = 0; i < el.vertices.length; i++) {
      const a = el.vertices[i];
      const b = el.vertices[(i + 1) % el.vertices.length];
      pushSegment(lines, a.getX(), a.getY(), b.getX(), b.getY(), st, pxPerUnit);
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoLocus) || !el.isDefined()) continue;
    const samples = el.getSamples();
    const st = styleOf(el, selSet.has(el));
    for (const seg of el.getSegments()) {
      for (let i = seg.start; i < seg.end && i < samples.length - 1; i++) {
        pushSegment(lines, samples[i].x, samples[i].y, samples[i + 1].x, samples[i + 1].y, st, pxPerUnit);
      }
    }
  }

  for (const el of elements) {
    if (!(el instanceof GeoPoint) || !el.isDefined()) continue;
    const sel = selSet.has(el);
    const color = el.strokeColor ?? el.defaultStrokeColor;
    points.push({
      pos: to3(el.getX(), el.getY()),
      color,
      radiusPx: sel ? 8 : 6,
      ring: sel ? { color: 'rgba(59, 130, 246, 0.35)', radiusPx: 14 } : undefined,
      label: el.labelVisible && el.labelMode === 'always' ? el.label || el.id : undefined,
    });
  }

  // 三坐标平面显示配置（GeoGebra 3D：XY 底部 / XZ / YZ 侧立，各自独立控制填充板）。
  const planes: Plane3[] = [];
  const plateXY = axesPlaneMode >= 2 && showXY;
  const plateXZ = axesPlaneMode >= 2 && showXZ;
  const plateYZ = axesPlaneMode >= 2 && showYZ;
  planes.push({ axis: 'xy', grid: showGrid && (axesPlaneMode === 3 || plateXY), plate: plateXY });
  planes.push({ axis: 'xz', grid: showGrid && plateXZ, plate: plateXZ });
  planes.push({ axis: 'yz', grid: showGrid && plateYZ, plate: plateYZ });

  return { gridBounds: viewBounds, contentBounds: bounds, showGrid, showAxes, planes, lines, fills, points };
}

function elementAnchor(el: GeoElement): V3 | null {
  if (el instanceof GeoSegment) {
    return to3((el.startPoint.getX() + el.endPoint.getX()) / 2, (el.startPoint.getY() + el.endPoint.getY()) / 2);
  }
  if (el instanceof GeoPolygon) {
    if (el.vertices.length === 0) return null;
    let sx = 0, sy = 0;
    for (const v of el.vertices) { sx += v.getX(); sy += v.getY(); }
    return to3(sx / el.vertices.length, sy / el.vertices.length);
  }
  if (el instanceof GeoConic) {
    const c = el.getCenter();
    return to3(c.x, c.y);
  }
  return null;
}

function drawLabels(scene: Scene3D, renderer: WebGL3DRenderer, canvas: HTMLCanvasElement, dpr: number, selected: readonly GeoElement[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fontPx = Math.round(14 * dpr);
  const off = 14 * dpr;

  // 坐标轴标签
  if (scene.showAxes) {
    const axisLabels = renderer.getAxisLabelPositions(scene.gridBounds);
    for (const al of axisLabels) {
      ctx.font = `bold ${Math.round(13 * dpr)}px sans-serif`;
      ctx.fillStyle = al.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(al.label, al.x + 12 * dpr, al.y - 12 * dpr);
    }
    // 轴刻度数字（X / Y / Z 轴，正负两侧，间隔=主网格步长）
    const b = scene.gridBounds;
    const step = renderer.getGridStep(scene.gridBounds);
      ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
    ctx.textBaseline = 'middle';
    const xMin = Math.min(0, b.minX);
    const xMax = Math.max(0, b.maxX);
    const yMin = Math.min(0, b.minY);
    const yMax = Math.max(0, b.maxY);
    const zMax = renderer.zExtent(b);
    const zMin = -zMax;
    for (let x = Math.ceil(xMin / step) * step; x <= xMax + 1e-9; x += step) {
      const sp = renderer.projectToScreen({ x, y: 0, z: 0 });
      if (!sp) continue;
      ctx.fillStyle = '#1c1c1f';
      ctx.textAlign = 'center';
      ctx.fillText(fmtNum(x), sp.x, sp.y + 14 * dpr);
    }
    for (let y = Math.ceil(yMin / step) * step; y <= yMax + 1e-9; y += step) {
      const sp = renderer.projectToScreen({ x: 0, y: -y, z: 0 });
      if (!sp) continue;
      ctx.fillStyle = '#1c1c1f';
      ctx.textAlign = 'right';
      ctx.fillText(fmtNum(y), sp.x - 14 * dpr, sp.y);
    }
    for (let z = Math.ceil(zMin / step) * step; z <= zMax + 1e-9; z += step) {
      const sp = renderer.projectToScreen({ x: 0, y: 0, z });
      if (!sp) continue;
      ctx.fillStyle = '#1c1c1f';
      ctx.textAlign = 'right';
      ctx.fillText(fmtNum(z), sp.x - 14 * dpr, sp.y);
    }
  }

  // 点标签
  for (const p of scene.points) {
    if (!p.label) continue;
    const sp = renderer.projectToScreen(p.pos);
    if (!sp) continue;
    ctx.font = `600 ${fontPx}px sans-serif`;
    ctx.fillStyle = '#1f2937';
    ctx.textBaseline = 'bottom';
    ctx.fillText(p.label, sp.x + off, sp.y - off);
  }

  // 选中元素标签
  for (const el of selected) {
    if (!el.labelVisible || el.labelMode !== 'always' || !el.label) continue;
    const anchor = elementAnchor(el);
    if (!anchor) continue;
    const sp = renderer.projectToScreen(anchor);
    if (!sp) continue;
    ctx.font = `600 ${fontPx}px sans-serif`;
    ctx.fillStyle = '#1e40af';
    ctx.textBaseline = 'bottom';
    ctx.fillText(el.label, sp.x + off, sp.y - off);
  }
}

export const Geometry3DView: React.FC<Props> = ({ kernel, renderRev, selectedElements, showGrid, showAxes, setShowGrid, setShowAxes }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGL3DRenderer | null>(null);
  const dprRef = useRef(1);
  const fittedRef = useRef(false);
  const lastPointsRef = useRef<V3[]>([]);
  const dragRef = useRef<{ mode: 'none' | 'orbit' | 'pan'; lastX: number; lastY: number }>({ mode: 'none', lastX: 0, lastY: 0 });
  const { t } = useLanguage();

  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('perspective');
  const [axesPlaneMode, setAxesPlaneMode] = useState(3); // 坐标轴+平面
  const [planeXY, setPlaneXY] = useState(true);
  const [planeXZ] = useState(false);
  const [planeYZ] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const rotationFrameRef = useRef<number>(0);

  const propsRef = useRef({ renderRev, selectedElements, showGrid, showAxes, axesPlaneMode, planeXY, planeXZ, planeYZ });
  propsRef.current = { renderRev, selectedElements, showGrid, showAxes, axesPlaneMode, planeXY, planeXZ, planeYZ };

  const draw = useCallback(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    const labels = labelRef.current;
    if (!renderer || !canvas || !labels) return;
    const { showGrid: sg, showAxes: sa, selectedElements: sel, axesPlaneMode: apm, planeXY: pxy, planeXZ: pxz, planeYZ: pyz } = propsRef.current;
    const scene = buildScene(kernel, sel, sg, sa, apm, pxy, pxz, pyz, renderer);
    if (!fittedRef.current) {
      renderer.fitScene(scene);
      fittedRef.current = true;
    }
    lastPointsRef.current = scene.points.map(p => p.pos);
    renderer.render(scene);
    drawLabels(scene, renderer, labels, dprRef.current, sel);
  }, [kernel]);

  const syncSize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const cssW = el.clientWidth || 1;
    const cssH = el.clientHeight || 1;
    const canvas = canvasRef.current;
    const labels = labelRef.current;
    if (canvas) {
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      rendererRef.current?.resize(cssW * dpr, cssH * dpr);
    }
    if (labels) {
      labels.width = cssW * dpr;
      labels.height = cssH * dpr;
      labels.style.width = `${cssW}px`;
      labels.style.height = `${cssH}px`;
    }
    draw();
  }, [draw]);

  // 初始化 WebGL2 渲染器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new WebGL3DRenderer(canvas);
    rendererRef.current = renderer;
    fittedRef.current = false;
    syncSize();
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [syncSize]);

  // 尺寸同步
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncSize]);

  // 构造 / 选中 / 网格开关变化时重绘
  useEffect(() => {
    draw();
  }, [draw, renderRev, selectedElements, showGrid, showAxes, planeXY]);

  // 投影模式变化
  useEffect(() => {
    rendererRef.current?.setProjectionMode(projectionMode);
    draw();
  }, [projectionMode, draw]);

  // 坐标轴平面模式变化
  useEffect(() => {
    const axes = axesPlaneMode === 1 || axesPlaneMode === 3;
    const plane = axesPlaneMode >= 2;
    setShowAxes(axes);
    setShowGrid(plane);
  }, [axesPlaneMode, setShowAxes, setShowGrid]);

  // 旋转动画
  useEffect(() => {
    if (rotationSpeed === 0) {
      if (rotationFrameRef.current) {
        cancelAnimationFrame(rotationFrameRef.current);
        rotationFrameRef.current = 0;
      }
      return;
    }
    let lastTime = 0;
    const animate = (time: number) => {
      if (lastTime === 0) lastTime = time;
      const dt = time - lastTime;
      lastTime = time;
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.yaw += (rotationSpeed * 0.001 * dt);
        draw();
      }
      rotationFrameRef.current = requestAnimationFrame(animate);
    };
    rotationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (rotationFrameRef.current) cancelAnimationFrame(rotationFrameRef.current);
    };
  }, [rotationSpeed, draw]);

  // 标准视图切换
  const handleSetView = useCallback((view: StandardView) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setStandardView(view);
    draw();
  }, [draw]);

  // wheel 事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      draw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [draw]);

  const hitTestPoint = (clientX: number, clientY: number): boolean => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return false;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * dprRef.current;
    const y = (clientY - rect.top) * dprRef.current;
    const hitR = 12 * dprRef.current;
    for (const pos of lastPointsRef.current) {
      const sp = renderer.projectToScreen(pos);
      if (sp && Math.hypot(sp.x - x, sp.y - y) < hitR) return true;
    }
    return false;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    canvas.style.cursor = 'grabbing';
    if (e.button === 1 || e.shiftKey) {
      dragRef.current = { mode: 'pan', lastX: e.clientX, lastY: e.clientY };
    } else if (e.button === 0) {
      dragRef.current = {
        mode: hitTestPoint(e.clientX, e.clientY) ? 'none' : 'orbit',
        lastX: e.clientX,
        lastY: e.clientY,
      };
    }
    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'none') return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (drag.mode === 'orbit') renderer.orbit(dx, dy);
    else renderer.pan(dx, dy);
    draw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.mode = 'none';
    e.currentTarget.style.cursor = 'grab';
  };

  const handleDoubleClick = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.fitScene({ gridBounds: computeBounds(kernel.getConstruction().getElements()) });
    draw();
  };

  // 当前相机朝向（用于导航方块）
  const orientation = rendererRef.current?.getOrientation() ?? { yaw: 0, pitch: 0.6 };

  return (
    <div ref={containerRef} className="absolute inset-0 z-[3] bg-white overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full"
        style={{ touchAction: 'none', cursor: 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      <canvas ref={labelRef} className="absolute inset-0 pointer-events-none" />

      {/* ── 左上角标识 ── */}
      <div className="absolute top-3 left-4 flex items-center gap-2 pointer-events-none">
        <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">3D</span>
        <span className="text-xs text-gray-500">{t('view3D')}</span>
      </div>

      {/* ── 右上角：导航方块 ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto">
        <NavigationCube yaw={orientation.yaw} pitch={orientation.pitch} onSetView={handleSetView} />
      </div>

      {/* ── 右侧：3D 工具栏 ── */}
      <Geometry3DToolbar
        projectionMode={projectionMode}
        setProjectionMode={setProjectionMode}
        onSetView={handleSetView}
        showAxes={showAxes}
        setShowAxes={setShowAxes}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        axesPlaneMode={axesPlaneMode}
        setAxesPlaneMode={setAxesPlaneMode}
        planeXY={planeXY}
        setPlaneXY={setPlaneXY}
        rotationSpeed={rotationSpeed}
        setRotationSpeed={setRotationSpeed}
        t={t}
      />

      {/* ── 底部提示 ── */}
      <div className="absolute bottom-3 left-4 pointer-events-none text-xs text-gray-400 bg-white/70 px-2 py-1 rounded">
        {t('view3dHint')}
      </div>
    </div>
  );
};

export default Geometry3DView;
