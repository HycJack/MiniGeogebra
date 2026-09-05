import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRenderLoop } from '../hooks/useRenderLoop';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoArc } from '../kernel/geo/GeoArc';
import { GeoConicPart } from '../kernel/geo/GeoConicPart';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoPolyLine } from '../kernel/geo/GeoPolyLine';
import { GeoRay } from '../kernel/geo/GeoRay';
import { GeoConic } from '../kernel/geo/GeoConic';
import { elementIntersectsRect } from '../kernel/view/BoundingBoxHelper';
import { applySnap, SNAP_POINT_RADIUS, calculateGridStep } from '../kernel/core/Snap';
import { SvgRenderer } from '../kernel/view/SvgRenderer';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoSegmentTwoPoints } from '../kernel/algo/AlgoSegmentTwoPoints';
import { AlgoCirclePointRadius } from '../kernel/algo/AlgoCirclePointRadius';
import { AlgoMidpoint } from '../kernel/algo/AlgoMidpoint';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoLocus } from '../kernel/geo/GeoLocus';
import { AlgoPointOnConic } from '../kernel/algo/AlgoPointOnConic';
import { AlgoPointOnLine } from '../kernel/algo/AlgoPointOnLine';
import { AlgoPointOnSegment } from '../kernel/algo/AlgoPointOnSegment';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { IRenderer, TextItem } from '../kernel/view/IRenderer';
import { createRenderer } from '../kernel/view/WebGLRendererFallback';
import { serialize as serializeConstruction, deserialize as deserializeConstruction, downloadJSON } from '../kernel/persistence/ConstructionSerializer';
import { toolHandlers } from './tools/handlers';
import { drawGrid, drawPoint, drawLine, drawSegment, drawPolygon, drawConic, drawLocus, renderPreviews, drawVector, drawPolyLine, drawArc, drawConicPart, drawRay } from './drawHelpers';
import { useLanguage } from '../i18n/LanguageContext';
import { Undo2, Redo2, Globe, ZoomIn, ZoomOut, Home } from 'lucide-react';
import { ToolMode } from './tools/types';

import Toolbar from './Toolbar';
import SidePanel from './SidePanel';
import CanvasOverlay from './CanvasOverlay';
import Geometry3DView from './Geometry3DView';
import type { UIElement } from './CanvasOverlay';

/** 捕获所有独立点的坐标和数值型参数的值，用于 undo/redo 快照。 */
const captureState = (kernel: Kernel) => {
  const coords = new Map<string, { x: number; y: number; z: number }>();
  const numerics = new Map<string, number>();
  kernel.getConstruction().getElements().forEach(el => {
    if (el instanceof GeoPoint && el.isIndependent()) {
      coords.set(el.id, { x: el.getX(), y: el.getY(), z: el.getZ() });
    } else if (el instanceof GeoNumeric) {
      numerics.set(el.id, el.getValue());
    }
  });
  return { coords, numerics };
};

interface StateSnapshot {
  coords: Map<string, { x: number; y: number; z: number }>;
  numerics: Map<string, number>;
}

type Command =
  | { type: 'add'; elements: ConstructionElement[] }
  | { type: 'delete'; elements: ConstructionElement[] }
  | { type: 'move'; oldState: StateSnapshot; newState: StateSnapshot }
  | { type: 'style'; element: GeoElement; before: Record<string, unknown>; after: Record<string, unknown> }
  | { type: 'numeric'; element: GeoNumeric; oldValue: number; newValue: number }
  | { type: 'rename'; element: ConstructionElement; oldLabel: string; newLabel: string };

/** GeoGebra 默认视图常用的单位比例，初始图形坐标保持在 ±10 以内。 */
const DEFAULT_SCALE = 50;
const MIN_SCALE = 0.1;
const MAX_SCALE = 200;

// ─── 核心编排组件 ────────────────────────────────────────────────────

export const GeometryCanvas: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textOverlayRef = useRef<HTMLCanvasElement>(null);
  const [kernel] = useState(() => new Kernel());
  const [mode, setMode] = useState<ToolMode>('move');
  const [polygonPoints, setPolygonPoints] = useState<GeoPoint[]>([]);
  const [radius, setRadius] = useState<number>(50);
  const [selectedElements, setSelectedElements] = useState<GeoElement[]>([]);
  const [editingLabel, setEditingLabel] = useState('');

  const [overlayCanvasRef] = useState(React.createRef<HTMLCanvasElement>());
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStartScreen, setBoxStartScreen] = useState<{ x: number; y: number } | null>(null);
  const [boxEndScreen, setBoxEndScreen] = useState<{ x: number; y: number } | null>(null);

  // ─── 框选取消 ─────────────────────────────────────────────────────
  const cancelBoxSelect = useCallback(() => {
    setIsBoxSelecting(false); setBoxStartScreen(null); setBoxEndScreen(null);
    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx) { const w = overlayCanvasRef.current!.width, h = overlayCanvasRef.current!.height; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); }
  }, [overlayCanvasRef]);

  useEffect(() => {
    const pointsToDelete = [...polygonPoints];
    if (pointsToDelete.length > 0) {
      pointsToDelete.forEach(point => kernel.getConstruction().removeElement(point));
      kernel.getConstruction().updateAllAlgorithms();
      setRenderRev(r => r + 1);
    }
    setSelectedElements([]);
    setPolygonPoints([]);
    cancelBoxSelect();
  }, [mode, cancelBoxSelect]);

  useEffect(() => {
    if (selectedElements.length === 1) setEditingLabel(selectedElements[0].label);
    else setEditingLabel('');
  }, [selectedElements]);

  // ─── 画布 / 渲染器 ───────────────────────────────────────────────
  const [draggedElement, setDraggedElement] = useState<GeoElement | null>(null);
  const [renderRev, setRenderRev] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<GeoPoint | null>(null);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [renderer, setRenderer] = useState<IRenderer | null>(null);
  const [coord, setCoord] = useState<CoordinateSystem>(() => CoordinateSystem.centered(800, 600, DEFAULT_SCALE));
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
  const [showAxes, setShowAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [uiElements, setUIElements] = useState<UIElement[]>([]);
  const [editingUIElement, setEditingUIElement] = useState<string | null>(null);
  const [draggingUIElement, setDraggingUIElement] = useState<string | null>(null);
  const boxModifierDown = useRef(false);
  const toolState = useRef<any>({});
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToPoint, setSnapToPoint] = useState(true);
  const [panelTab, setPanelTab] = useState<'algebra' | 'properties'>('algebra');
  const undoStack = useRef<Command[]>([]);
  const redoStack = useRef<Command[]>([]);
  const [dragStartState, setDragStartState] = useState<StateSnapshot | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const addCommand = useCallback((cmd: Command) => {
    undoStack.current.push(cmd);
    redoStack.current = [];
    setRenderRev(r => r + 1);
  }, []);

  const notifyNumericChange = useCallback((numeric: GeoNumeric, oldValue: number, newValue: number) => {
    if (oldValue !== newValue) addCommand({ type: 'numeric', element: numeric, oldValue, newValue });
  }, [addCommand]);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => setEditingLabel(e.target.value);

  const recordRename = useCallback((element: ConstructionElement, newLabel: string) => {
    const oldLabel = (element as any).label || '';
    if (oldLabel !== newLabel) { (element as any).label = newLabel; addCommand({ type: 'rename', element, oldLabel, newLabel }); }
  }, [addCommand]);

  const handleLabelSubmit = useCallback(() => {
    if (selectedElements.length === 1) {
      if (editingLabel.trim() !== '') { recordRename(selectedElements[0], editingLabel.trim()); setRenderRev(r => r + 1); }
      else setEditingLabel(selectedElements[0].label);
    }
  }, [selectedElements, editingLabel, recordRename]);

  const snapshotStyle = useCallback((el: GeoElement): Record<string, unknown> => ({
    strokeColor: el.strokeColor, strokeWidth: el.strokeWidth, strokeDash: el.strokeDash ? [...el.strokeDash] : [],
    fillColor: el.fillColor, labelVisible: el.labelVisible, labelMode: el.labelMode,
  }), []);

  const applyStyleDirectly = useCallback((el: GeoElement, changes: Record<string, unknown>) => {
    if ('strokeColor' in changes) el.strokeColor = changes.strokeColor as string | null;
    if ('strokeWidth' in changes) el.strokeWidth = changes.strokeWidth as number | null;
    if ('strokeDash' in changes) el.strokeDash = changes.strokeDash ? [...(changes.strokeDash as number[])] : null;
    if ('fillColor' in changes) el.fillColor = changes.fillColor as string | null;
    if ('labelVisible' in changes) el.labelVisible = changes.labelVisible as boolean;
    if ('labelMode' in changes) el.labelMode = changes.labelMode as 'always' | 'mouse' | 'never';
  }, []);

  const recordStyleChange = useCallback((element: GeoElement, changes: Record<string, unknown>) => {
    applyStyleDirectly(element, changes);
    addCommand({ type: 'style', element, before: snapshotStyle(element), after: { ...changes } });
  }, [applyStyleDirectly, addCommand, snapshotStyle]);

  const deleteWithDependents = useCallback((els: ConstructionElement[]) => {
    if (els.length === 0) return;
    const construction = kernel.getConstruction();
    const cascade = new Set<ConstructionElement>();
    for (const el of els) { for (const c of construction.collectDeletionCascade(el)) cascade.add(c); construction.deleteElementWithDependents(el); }
    addCommand({ type: 'delete', elements: Array.from(cascade).sort((a, b) => a.constIndex - b.constIndex) });
    setSelectedElements([]);
    setRenderRev(r => r + 1);
  }, [kernel, addCommand]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 文件 I/O ─────────────────────────────────────────────────────
  const handleExport = useCallback(() => { try { downloadJSON('minigeogebra-construction.json', serializeConstruction(kernel, coord)); } catch (err) { console.error('[export failed]', err); alert('导出失败'); } }, [kernel, coord]);

  const downloadFile = useCallback((content: string, filename: string, type?: string) => {
    const blob = new Blob([content], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, []);

  const handleExportPNG = useCallback(() => { const c = canvasRef.current; if (!c) return; downloadFile(c.toDataURL('image/png'), `minigeogebra-${Date.now()}.png`, 'image/png'); }, [downloadFile]);

  const handleExportSVG = useCallback(() => {
    try { const svgR = new SvgRenderer(); const bounds = coord.visibleWorldBounds(); _renderToSvg(svgR, bounds); downloadFile(svgR.toSvgString(bounds), `minigeogebra-${Date.now()}.svg`, 'image/svg+xml'); }
    catch (err) { console.error('[svg export failed]', err); alert('SVG 导出失败'); }
  }, [coord, downloadFile]);

  const _renderToSvg = useCallback((renderer: IRenderer, bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
    const vw = (bounds.maxX - bounds.minX) * coord.xScale, vh = (bounds.maxY - bounds.minY) * coord.xScale;
    drawGrid(renderer, vw, vh, coord, showGrid, showAxes);
    const elements = kernel.getConstruction().getElements();
    elements.forEach(el => { if (el instanceof GeoPolygon) drawPolygon(renderer, el, false, coord.xScale); });
    elements.forEach(el => {
      if (el instanceof GeoConicPart) drawConicPart(renderer, el, false, coord.xScale);
      else if (el instanceof GeoArc) drawArc(renderer, el, false, coord.xScale);
      else if (el instanceof GeoConic) drawConic(renderer, el, false, coord.xScale);
    });
    elements.forEach(el => { if (el instanceof GeoLocus) drawLocus(renderer, el, false, coord.xScale); });
    elements.forEach(el => { if (el instanceof GeoPolyLine) drawPolyLine(renderer, el, false, coord.xScale); });
    elements.forEach(el => { if (el instanceof GeoVector) drawVector(renderer, el, false, coord.xScale); });
    elements.forEach(el => {
      if (el instanceof GeoSegment) drawSegment(renderer, el, false, coord.xScale);
      else if (el instanceof GeoRay) drawRay(renderer, el, false, bounds, coord.xScale);
      else if (el instanceof GeoLine && !(el instanceof GeoSegment)) drawLine(renderer, el, false, bounds, coord.xScale);
    });
    elements.forEach(el => { if (el instanceof GeoPoint) drawPoint(renderer, el, false, coord.xScale); });
  }, [kernel, coord, showGrid, showAxes]);

  const handleImportPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = typeof ev.target?.result === 'string' ? ev.target.result : ''; if (!text.trim()) return;
        const { coord: restored } = deserializeConstruction(kernel, text); if (restored) setCoord(restored);
        setSelectedElements([]); setPolygonPoints([]); setRenderRev(r => r + 1);
      } catch (err) { console.error('[import failed]', err); alert('导入失败'); }
      finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  }, [kernel]);

  // ─── 动画 ─────────────────────────────────────────────────────────
  const isAnimating = kernel.getAnimationManager().isRunning();
  const toggleAnimation = useCallback(() => { const am = kernel.getAnimationManager(); if (am.isRunning()) am.stopAnimation(); else am.startAnimation(); setRenderRev(r => r + 1); }, [kernel]);

  // ─── 初始化 / 画布尺寸 ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    setRenderer(createRenderer(canvas, true));
    return () => setRenderer(null);
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const width = containerRef.current.clientWidth, height = containerRef.current.clientHeight;
      setCanvasSize({ width: width * dpr, height: height * dpr });
      const canvas = canvasRef.current;
      if (canvas) { canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; }
      const textCanvas = textOverlayRef.current;
      if (textCanvas) { textCanvas.style.width = `${width}px`; textCanvas.style.height = `${height}px`; }
      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas) {
        overlayCanvas.width = width * dpr; overlayCanvas.height = height * dpr;
        overlayCanvas.style.width = `${width}px`; overlayCanvas.style.height = `${height}px`;
      }
      setCoord(c => c.setSize(width, height));
      setRenderRev(r => r + 1);
    };
    window.addEventListener('resize', updateSize); updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // ─── 键盘快捷键 ───────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          if (polygonPoints.length > 0) { polygonPoints.forEach(point => kernel.getConstruction().removeElement(point)); kernel.getConstruction().updateAllAlgorithms(); }
          setMode('move'); setSelectedElements([]); setPolygonPoints([]); cancelBoxSelect(); setRenderRev(r => r + 1);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElements.length > 0 && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); deleteWithDependents(selectedElements);
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); setSnapEnabled(prev => !prev); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [selectedElements, kernel, polygonPoints, deleteWithDependents]);

  // ─── Demo 初始化 ──────────────────────────────────────────────────
  useEffect(() => {
    const construction = kernel.getConstruction();
    if (construction.getElements().length === 0) {
      const p1 = new GeoPoint(kernel, new GeoVec3D(-6, -4, 1)); p1.label = 'A';
      const p2 = new GeoPoint(kernel, new GeoVec3D(4, -4, 1)); p2.label = 'B';
      const p3 = new GeoPoint(kernel, new GeoVec3D(-1, 4, 1)); p3.label = 'C';
      construction.addElement(p1); construction.addElement(p2); construction.addElement(p3);
      const seg = new AlgoSegmentTwoPoints(kernel, p1, p2); const segEl = seg.getOutput();
      segEl.label = construction.getNextLineLabel(); construction.addElement(seg); construction.addElement(segEl);
      const poly = new GeoPolygon(kernel, [p1, p2, p3]); poly.label = construction.getNextPolygonLabel(); construction.addElement(poly);
      const mid = new AlgoMidpoint(kernel, p1, p3); construction.addElement(mid); construction.addElement(mid.getOutput()); mid.update();
      const num = new GeoNumeric(kernel, 0); num.label = 't'; num.setAnimating(true); construction.addElement(num);
      const center = new GeoPoint(kernel, new GeoVec3D(5, -2, 1)); center.label = 'Center'; construction.addElement(center);
      const circle = new AlgoCirclePointRadius(kernel, center, 4); construction.addElement(circle); construction.addElement(circle.getOutput()); circle.update();
      const ptOnCircle = new AlgoPointOnConic(kernel, circle.getOutput(), num); construction.addElement(ptOnCircle); construction.addElement(ptOnCircle.getOutput()); ptOnCircle.update();
    }
    kernel.setUpdateCallback(() => setRenderRev(r => r + 1));
  }, [kernel]);

  // ─── 恢复状态（undo/redo） ────────────────────────────────────────
  const restoreState = useCallback((state: StateSnapshot) => {
    state.coords.forEach((c, id) => { const el = kernel.getConstruction().getElementById(id); if (el instanceof GeoPoint) el.setCoords(c.x, c.y, c.z); });
    state.numerics.forEach((val, id) => { const el = kernel.getConstruction().getElementById(id); if (el instanceof GeoNumeric) el.setValue(val); });
    kernel.getConstruction().updateAllAlgorithms();
  }, [kernel]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const cmd = undoStack.current.pop()!; redoStack.current.push(cmd);
    if (cmd.type === 'add') { [...cmd.elements].reverse().forEach(el => kernel.getConstruction().removeElement(el)); setSelectedElements(prev => prev.filter(e => !(cmd.elements as any[]).includes(e))); setPolygonPoints(prev => prev.filter(e => !(cmd.elements as any[]).includes(e))); }
    else if (cmd.type === 'delete') { [...cmd.elements].reverse().forEach(el => kernel.getConstruction().deleteElementWithDependents(el)); setSelectedElements([]); }
    else if (cmd.type === 'move') restoreState(cmd.oldState);
    else if (cmd.type === 'numeric') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el instanceof GeoNumeric) el.setValue(cmd.oldValue); }
    else if (cmd.type === 'rename') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el) el.label = cmd.oldLabel; }
    else if (cmd.type === 'style') applyStyleDirectly(cmd.element, cmd.after);
    kernel.getConstruction().updateAllAlgorithms(); setRenderRev(r => r + 1);
  }, [kernel, restoreState, applyStyleDirectly]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const cmd = redoStack.current.pop()!; undoStack.current.push(cmd);
    if (cmd.type === 'add') cmd.elements.forEach(el => kernel.getConstruction().addElement(el));
    else if (cmd.type === 'delete') cmd.elements.forEach(el => kernel.getConstruction().addElement(el));
    else if (cmd.type === 'move') restoreState(cmd.newState);
    else if (cmd.type === 'numeric') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el instanceof GeoNumeric) el.setValue(cmd.newValue); }
    else if (cmd.type === 'rename') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el) el.label = cmd.newLabel; }
    else if (cmd.type === 'style') applyStyleDirectly(cmd.element, cmd.before);
    kernel.getConstruction().updateAllAlgorithms(); setRenderRev(r => r + 1);
  }, [kernel, restoreState, applyStyleDirectly]);

  // ─── 渲染循环 ─────────────────────────────────────────────────────
  const { schedule } = useRenderLoop(() => {
    const canvas = canvasRef.current; if (!canvas || !renderer) return;
    if (view === '3d') return;
    renderer.viewportSize(canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    renderer.clearRect(0, 0, canvas.width, canvas.height);
    renderer.save(); renderer.scale(dpr, dpr); renderer.translate(coord.xZero, coord.yZero); renderer.scale(coord.xScale, coord.yScale);

    drawGrid(renderer, canvas.width / dpr, canvas.height / dpr, coord, showGrid, showAxes);

    const elements = kernel.getConstruction().getElements();
    elements.forEach(el => {
      if (el instanceof GeoPolygon) drawPolygon(renderer, el, selectedElements.includes(el), coord.xScale);
      else if (el instanceof GeoConicPart) drawConicPart(renderer, el, selectedElements.includes(el), coord.xScale);
      else if (el instanceof GeoArc) drawArc(renderer, el, selectedElements.includes(el), coord.xScale);
      else if (el instanceof GeoConic) drawConic(renderer, el, selectedElements.includes(el), coord.xScale);
      else if (el instanceof GeoLocus) drawLocus(renderer, el, selectedElements.includes(el), coord.xScale);
      else if (el instanceof GeoPolyLine) drawPolyLine(renderer, el, selectedElements.includes(el), coord.xScale);
      else if (el instanceof GeoVector) drawVector(renderer, el, selectedElements.includes(el), coord.xScale);
      else if (el instanceof GeoSegment) drawSegment(renderer, el, selectedElements.includes(el), coord.xScale);
      else if (el instanceof GeoRay) drawRay(renderer, el, selectedElements.includes(el), coord.visibleWorldBounds(), coord.xScale);
      else if (el instanceof GeoLine) drawLine(renderer, el, selectedElements.includes(el), coord.visibleWorldBounds(), coord.xScale);
    });
    elements.forEach(el => { if (el instanceof GeoPoint) drawPoint(renderer, el, selectedElements.includes(el), coord.xScale); });

    if (mode === 'polygon' && polygonPoints.length > 0) {
      renderer.strokeStyle = '#9ca3af'; renderer.lineWidth = 1 / coord.xScale;
      renderer.setLineDash([5 / coord.xScale, 5 / coord.xScale]);
      renderer.beginPath(); renderer.moveTo(polygonPoints[0].getX(), polygonPoints[0].getY());
      for (let i = 1; i < polygonPoints.length; i++) renderer.lineTo(polygonPoints[i].getX(), polygonPoints[i].getY());
      renderer.lineTo(mousePos.x, mousePos.y); renderer.stroke(); renderer.setLineDash([]);
    }

    renderPreviews(mode, selectedElements, mousePos, hoveredPoint, coord, renderer, radius, coord.visibleWorldBounds());

    renderer.frameCommit();

    // WebGL 文本通过 overlay Canvas2D 绘制
    const textCanvas = textOverlayRef.current;
    if (textCanvas && renderer.flushTextQueue) {
      const items = renderer.flushTextQueue();
      const ctx = textCanvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
        if (items.length > 0) {
          ctx.save(); ctx.scale(dpr, dpr); ctx.translate(coord.xZero, coord.yZero); ctx.scale(coord.xScale, coord.yScale);
          for (const item of items) {
            ctx.font = item.font; ctx.fillStyle = item.fillStyle; ctx.textBaseline = item.textBaseline; ctx.textAlign = item.textAlign;
            ctx.fillText(item.text, item.x, item.y);
          }
          ctx.restore();
        }
      }
    }

    renderer.restore();
  }, [view, renderRev, selectedElements, mousePos, mode, polygonPoints, radius, hoveredPoint, coord, showGrid, showAxes, renderer]);

  useEffect(() => { schedule(); }, [schedule]);

  // ─── 坐标 / 鼠标辅助 ─────────────────────────────────────────────
  const getScreenPos = (e: React.MouseEvent | React.WheelEvent) => { const rect = canvasRef.current!.getBoundingClientRect(); return { screenX: e.clientX - rect.left, screenY: e.clientY - rect.top }; };
  const getGridStep = () => calculateGridStep(coord.xScale);
  const getMousePos = (e: React.MouseEvent | React.WheelEvent, useSnap = false) => {
    const { screenX, screenY } = getScreenPos(e); const world = coord.screenToWorld(screenX, screenY);
    let { x, y } = world;
    if (useSnap && snapEnabled) { const snapRadius = SNAP_POINT_RADIUS / coord.xScale; const snapped = applySnap(x, y, snapRadius, snapToGrid, snapToPoint, kernel.getConstruction().getElements().filter(e => e instanceof GeoPoint) as GeoPoint[], getGridStep()); x = snapped.x; y = snapped.y; }
    return { screenX, screenY, x, y };
  };

  const zoom = useCallback((factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = rect.width / 2, sy = rect.height / 2;
    setCoord(prev => {
      let next = prev.zoom(factor, sx, sy);
      if (next.xScale < MIN_SCALE) next = prev.zoom(MIN_SCALE / prev.xScale, sx, sy);
      else if (next.xScale > MAX_SCALE) next = prev.zoom(MAX_SCALE / prev.xScale, sx, sy);
      return next;
    });
  }, []);

  // ─── 鼠标事件 ─────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    const { screenX, screenY, x, y } = getMousePos(e);
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) { setIsPanning(true); setLastPanPos({ x: screenX, y: screenY }); return; }
    const elementsBefore = kernel.getConstruction().getElements().length;
    const currentDragStartState = captureState(kernel); setDragStartState(currentDragStartState);
    setLastMousePos({ x, y });
    const ts = toolState.current;
    boxModifierDown.current = e.ctrlKey || e.metaKey; ts.boxModifierDown = e.ctrlKey || e.metaKey; ts.shiftKey = e.shiftKey;
    toolHandlers[mode]?.({
      kernel, construction: kernel.getConstruction(), coord, elements: kernel.getConstruction().getElements(),
      selectedElements, mode, mousePos: { x, y }, hoveredPoint: null, radius, polygonPoints, uiElements,
      setMode, setSelectedElements, setRenderRev, setPolygonPoints, addCommand, captureState,
      recordNumericChange: notifyNumericChange, recordRename: handleLabelSubmit, recordStyleChange,
      setBoxSelecting: setIsBoxSelecting, setBoxStartScreen, setBoxEndScreen,
      setDraggedElement, setUIElements, setEditingUIElement, toolState: ts,
    }, { x, y }, { x: screenX, y: screenY });
    ts.boxModifierDown = false; ts.shiftKey = false; boxModifierDown.current = false;
    const elementsAfter = kernel.getConstruction().getElements();
    if (elementsAfter.length > elementsBefore) addCommand({ type: 'add', elements: elementsAfter.slice(elementsBefore) });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { screenX, screenY, x, y } = getMousePos(e); setMousePos({ x, y });
    if (isPanning) { setCoord(prev => prev.panBy(screenX - lastPanPos.x, screenY - lastPanPos.y)); setLastPanPos({ x: screenX, y: screenY }); setRenderRev(r => r + 1); return; }
    if (draggingUIElement) { setUIElements(prev => prev.map(el => el.id === draggingUIElement ? { ...el, x, y } : el)); return; }
    const elements = kernel.getConstruction().getElements();
    const hovered = elements.slice().reverse().find(el => el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10 / coord.xScale) as GeoPoint | undefined;
    setHoveredPoint(hovered || null);
    if (isBoxSelecting && boxStartScreen) {
      setBoxEndScreen({ x: screenX, y: screenY });
      const ctx = overlayCanvasRef.current?.getContext('2d');
      if (ctx && overlayCanvasRef.current) {
        const oc = overlayCanvasRef.current; const w = oc.width, h = oc.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
        const dpr = window.devicePixelRatio || 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const sx = Math.min(boxStartScreen.x, screenX), sy = Math.min(boxStartScreen.y, screenY);
        const sw = Math.abs(screenX - boxStartScreen.x), sh = Math.abs(screenY - boxStartScreen.y);
        ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = '#3b82f6'; ctx.fillRect(sx, sy, sw, sh); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.strokeRect(sx, sy, sw, sh); ctx.restore();
      }
    }
    if (draggedElement) {
      if (draggedElement instanceof GeoPoint && draggedElement.isIndependent()) draggedElement.setCoords(x, y);
      else if (draggedElement instanceof GeoPoint && draggedElement.parentAlgo) { const algo = draggedElement.parentAlgo; if ((algo as any).updateParameter) { (algo as any).updateParameter(x, y); algo.update(); } }
      else if (draggedElement instanceof GeoPolygon || draggedElement instanceof GeoConic || draggedElement instanceof GeoSegment || draggedElement instanceof GeoLine) {
        const dx = x - lastMousePos.x, dy = y - lastMousePos.y;
        if (draggedElement instanceof GeoPolygon || draggedElement instanceof GeoConic) (draggedElement as any).translate(new GeoVec3D(dx, dy, 0));
        else if (draggedElement.parentAlgo) { draggedElement.parentAlgo.getInput().forEach(el => { if (el instanceof GeoPoint && el.isIndependent()) el.setCoords(el.getX() + dx, el.getY() + dy); }); draggedElement.parentAlgo.update(); }
        setLastMousePos({ x, y });
      }
      kernel.flushNow();
    }
  };

  const handleMouseUp = () => {
    if (isPanning) { setIsPanning(false); return; }
    if (draggingUIElement) { setDraggingUIElement(null); return; }
    if (isBoxSelecting) {
      if (!boxStartScreen || !boxEndScreen) { cancelBoxSelect(); return; }
      const dist = Math.hypot(boxEndScreen.x - boxStartScreen.x, boxEndScreen.y - boxStartScreen.y);
      if (dist < 4) { setSelectedElements([]); cancelBoxSelect(); return; }
      const p1 = coord.screenToWorld(boxStartScreen.x, boxStartScreen.y), p2 = coord.screenToWorld(boxEndScreen.x, boxEndScreen.y);
      const rect = { minX: Math.min(p1.x, p2.x), maxX: Math.max(p1.x, p2.x), minY: Math.min(p1.y, p2.y), maxY: Math.max(p1.y, p2.y) };
      const hitElements: GeoElement[] = [];
      for (const el of kernel.getConstruction().getElements()) { if (elementIntersectsRect(el, rect)) hitElements.push(el); }
      if (boxModifierDown.current) { const hitSet = new Set(hitElements); setSelectedElements(prev => prev.filter(e => !hitSet.has(e)).concat(hitElements)); } else setSelectedElements(hitElements);
      cancelBoxSelect(); return;
    }
    if (draggedElement && dragStartState) {
      const newState = captureState(kernel); let moved = false;
      newState.coords.forEach((newC, id) => { const oldC = dragStartState.coords.get(id); if (oldC && (oldC.x !== newC.x || oldC.y !== newC.y || oldC.z !== newC.z)) moved = true; });
      newState.numerics.forEach((newV, id) => { const oldV = dragStartState.numerics.get(id); if (oldV !== undefined && oldV !== newV) moved = true; });
      if (moved) addCommand({ type: 'move', oldState: dragStartState, newState });
    }
    setDraggedElement(null); setDragStartState(null);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    if (view === '3d') return;
    e.preventDefault(); if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect(), mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setCoord(prev => {
      let next = prev.zoom(factor, mouseX, mouseY);
      if (next.xScale < MIN_SCALE) next = prev.zoom(MIN_SCALE / prev.xScale, mouseX, mouseY);
      else if (next.xScale > MAX_SCALE) next = prev.zoom(MAX_SCALE / prev.xScale, mouseX, mouseY);
      return next;
    });
  }, [view]);

  useEffect(() => { const el = containerRef.current; if (!el) return; el.addEventListener('wheel', handleWheel, { passive: false }); return () => el.removeEventListener('wheel', handleWheel); }, [handleWheel]);
  const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

  // ─── 构建 Toolbar props ────────────────────────────────────────────
  const toolbarProps = {
    mode, setMode,
    showAxes, setShowAxes, showGrid, setShowGrid,
    view, setView,
    editingLabel, handleLabelChange, handleLabelSubmit,
    selectedElementsLength: selectedElements.length,
    radius, setRadius,
    handleExport, handleExportPNG, handleExportSVG, fileInputRef, handleImportPick,
    snapEnabled, setSnapEnabled, toggleAnimation, isAnimating,
    t,
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="h-12 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-lg">G</div>
            <h1 className="text-lg font-semibold text-gray-800 tracking-tight">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" onClick={undo} disabled={undoStack.current.length === 0} title={t('undo')}><Undo2 size={20} /></button>
          <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" onClick={redo} disabled={redoStack.current.length === 0} title={t('redo')}><Redo2 size={20} /></button>
          <div className="w-px h-6 bg-gray-200 mx-2"></div>
          <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-md">
            <Globe size={15} />
            <select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer">
              <option value="zh">中文</option><option value="en">English</option>
            </select>
          </div>
        </div>
      </header>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <Toolbar {...toolbarProps} />

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        <SidePanel kernel={kernel} panelTab={panelTab} setPanelTab={setPanelTab} selectedElements={selectedElements} coord={coord} recordStyleChange={recordStyleChange} notifyNumericChange={notifyNumericChange} t={t} />

        {/* Canvas Area */}
        <div className="flex-1 relative bg-white z-0" ref={containerRef}>
          <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-none z-[5]" style={{ touchAction: 'none', display: view === '3d' ? 'none' : undefined }} />
          <canvas ref={textOverlayRef} width={canvasSize.width} height={canvasSize.height} className="absolute inset-0 pointer-events-none z-[4]" style={{ touchAction: 'none', display: view === '3d' ? 'none' : undefined }} />
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className={`absolute top-0 left-0 ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
            style={{ touchAction: 'none', display: view === '3d' ? 'none' : undefined }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
          />

          {view === '3d' && (
            <Geometry3DView kernel={kernel} renderRev={renderRev} selectedElements={selectedElements} showGrid={showGrid} showAxes={showAxes} setShowGrid={setShowGrid} setShowAxes={setShowAxes} />
          )}

          {view === '2d' && (
            <CanvasOverlay uiElements={uiElements} setUIElements={setUIElements} editingUIElement={editingUIElement} setEditingUIElement={setEditingUIElement} draggingUIElement={draggingUIElement} setDraggingUIElement={setDraggingUIElement} coord={coord} />
          )}

          {/* Zoom Controls */}
          {view === '2d' && (
            <div className="absolute bottom-6 right-6 flex flex-col shadow-lg rounded-lg overflow-hidden border border-gray-200 bg-white">
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-100" onClick={() => zoom(1.2)} title={t('zoomIn')}><ZoomIn size={20} /></button>
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-100" onClick={() => zoom(1 / 1.2)} title={t('zoomOut')}><ZoomOut size={20} /></button>
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" onClick={() => { const dpr = window.devicePixelRatio || 1; setCoord(CoordinateSystem.centered(canvasSize.width / dpr, canvasSize.height / dpr, DEFAULT_SCALE)); }} title={t('resetView')}><Home size={20} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
