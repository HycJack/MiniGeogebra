import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRenderLoop } from '../hooks/useRenderLoop';
import { Kernel } from '../kernel/core/Kernel';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { AlgoElement } from '../kernel/algo/AlgoElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoPoint3D } from '../kernel/geo/GeoPoint3D';
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
import { GeoBooleanRegion } from '../kernel/geo/GeoBooleanRegion';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoCurve } from '../kernel/geo/GeoCurve';
import { GeoInequality } from '../kernel/geo/GeoInequality';
import { GeoText } from '../kernel/geo/GeoText';
import { GeoBoolean } from '../kernel/geo/GeoBoolean';
import { AlgoPointOnConic } from '../kernel/algo/AlgoPointOnConic';
import { AlgoPointOnLine } from '../kernel/algo/AlgoPointOnLine';
import { AlgoPointOnSegment } from '../kernel/algo/AlgoPointOnSegment';
import { AlgoDependentFunction } from '../kernel/algo/AlgoDependentFunction';
import { AlgoDependentNumeric } from '../kernel/algo/AlgoDependentNumeric';
import { AlgoDependentInequality } from '../kernel/algo/AlgoDependentInequality';
import { captureMoveState, restoreMoveState, moveStateChanged, type MoveSnapshot } from '../kernel/core/MoveSnapshot';
import { renameVariableInAst, astUsesVariable } from '../kernel/algebra/renameVariable';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { IRenderer, TextItem } from '../kernel/view/IRenderer';
import { createRenderer } from '../kernel/view/WebGLRendererFallback';
import { serialize as serializeConstruction, deserialize as deserializeConstruction, downloadJSON } from '../kernel/persistence/ConstructionSerializer';
import { importOFF } from '../kernel/io/OffParser';
import { toolHandlers, clearToolState } from './tools/handlers';
import { drawGrid, drawPoint, drawLine, drawSegment, drawPolygon, drawConic, drawLocus, drawBooleanRegion, drawFunction, renderPreviews, drawVector, drawPolyLine, drawArc, drawConicPart, drawRay, drawHoverMarker, drawCurve, drawInequality, drawText, drawAngleMarker, drawSliderDrawable } from './drawHelpers';
import { sliderHitAt, sliderValueAtMouse } from './sliderDrawable';
import { useLanguage } from '../i18n/LanguageContext';
import { Undo2, Redo2, Globe, ZoomIn, ZoomOut, Home, Maximize, ListOrdered, Trash2, Eye, EyeOff, Tag, MousePointerClick, Play, Pause, Lock, LockOpen, Waypoints, ChevronsUp, ChevronsDown, Copy, Pencil, Eraser } from 'lucide-react';
import { ToolMode } from './tools/types';

// 切换到这些工具时保留选区（先选对象 → 再选变换工具的 GeoGebra 工作流）
const TRANSFORM_MODES = new Set<ToolMode>([
  'rotate', 'dilate', 'mirror', 'shear', 'stretch',
  'mirror_line', 'mirror_point', 'mirror_circle', 'translate_vector',
]);
import { hitScreenObject, hitScreenPoint, hitLabel, isPointOnFunction, functionParameterAt } from './tools/hitTests';
import { getElementBounds } from '../kernel/view/BoundingBoxHelper';
import { TraceRecorder, drawTraceStamps } from './TraceLayer';
import ConstructionNavBar from './ConstructionNavBar';
import CanvasValueInput, { type ValueRequest } from './CanvasValueInput';
import { resolveViewKey, formatHover } from './view/keyboardShortcuts';
import { HoverTooltip } from './HoverTooltip';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import { ToolHintBar } from './ToolHintBar';

import Toolbar from './Toolbar';
import SidePanel from './SidePanel';

import CanvasOverlay from './CanvasOverlay';
import type { UIElement } from './CanvasOverlay';
import Geometry3DView from './Geometry3DView';
import { snapshotView3D, offerView3D } from './view3DState';

type Command =
  | { type: 'add'; elements: ConstructionElement[] }
  | { type: 'delete'; elements: ConstructionElement[] }
  | { type: 'move'; oldState: MoveSnapshot; newState: MoveSnapshot }
  | { type: 'style'; element: GeoElement; before: Record<string, unknown>; after: Record<string, unknown> }
  | { type: 'numeric'; element: GeoNumeric; oldValue: number; newValue: number }
  | { type: 'boolean'; element: GeoBoolean; oldValue: boolean; newValue: boolean }
  | { type: 'rename'; element: ConstructionElement; oldLabel: string; newLabel: string }
  | { type: 'uiMove'; id: string; from: { x: number; y: number }; to: { x: number; y: number } };

/** GeoGebra 默认视图常用的单位比例，初始图形坐标保持在 ±10 以内。 */
const DEFAULT_SCALE = 50;
const MIN_SCALE = 0.1;
// 深zoom 上限：网格步长 = 50px / scale，scale=5e4 时主网格到 0.001 级别
// （用户要求支持 0.001 网格）。MIN_SCALE=0.1 保持不变（缩小方向无此需求）。
const MAX_SCALE = 50000;

// ─── 核心编排组件 ────────────────────────────────────────────────────

export const GeometryCanvas: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textOverlayRef = useRef<HTMLCanvasElement>(null);
  const [kernel] = useState(() => new Kernel());
  const [mode, setMode] = useState<ToolMode>('move');
  const [polygonPoints, setPolygonPoints] = useState<GeoPoint[]>([]);
  // polygon 工具本次会话新建的顶点（区别于命中的用户既有点），退出工具时回收
  const polygonCreatedPointsRef = useRef<GeoPoint[]>([]);
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
    clearToolState(toolState.current);
    // 只回收 polygon 工具本会话新建的点；用户既有的点（命中后作为顶点的）不能删
    const createdPoints = polygonCreatedPointsRef.current;
    if (createdPoints.length > 0) {
      createdPoints.forEach(point => kernel.getConstruction().removeElement(point));
      createdPoints.length = 0;
      kernel.getConstruction().updateAllAlgorithms();
      setRenderRev(r => r + 1);
    }
    // GeoGebra 工作流：先选中对象再激活变换工具，选区会直接进入变换流程。
    // 切换到变换类工具时不清选区（此前无条件清空，预选分支成了死代码）。
    if (!TRANSFORM_MODES.has(mode)) {
      setSelectedElements([]);
    }
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
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panFromEmptyClick = useRef(false);
  const [showAxes, setShowAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [uiElements, setUIElements] = useState<UIElement[]>([]);
  // UI 元素镜像（slider/checkbox 绑定的内核对象参与 undo）：同步写入，
  // 供 handleMouseDown 做前后差分、undo/redo 按命令回放增删
  const uiElementsRef = useRef<UIElement[]>([]);
  const setUIElementsTracked = useCallback((action: React.SetStateAction<UIElement[]>) => {
    const next = typeof action === 'function' ? (action as (prev: UIElement[]) => UIElement[])(uiElementsRef.current) : action;
    uiElementsRef.current = next;
    setUIElements(next);
  }, []);
  const [editingUIElement, setEditingUIElement] = useState<string | null>(null);
  const [draggingUIElement, setDraggingUIElement] = useState<string | null>(null);
  const boxModifierDown = useRef(false);
  const toolState = useRef<any>({});
  // 抓取偏移（对标官方 initOffsetFrom）：拖自由点时记录点与光标的差，
  // move 时按差移动——否则点边缘按下（热区 10px）第一帧就跳到光标处
  const dragGrabOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  // 吸附细节由 Options.pointCapturing 三态接管（automatic/snap_grid/off）；
  // 对已有点的吸附始终开启（ snapping 到网格由 capturing 决定）。
  const snapToPoint = true;
  const [panelTab, setPanelTab] = useState<'algebra' | 'properties'>('algebra');
  const undoStack = useRef<Command[]>([]);
  const redoStack = useRef<Command[]>([]);
  const [dragStartState, setDragStartState] = useState<MoveSnapshot | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  // ── 函数 hover 状态：屏幕位置 + 曲线上的吸附点（用于 tooltip + marker）──
  const [functionHover, setFunctionHover] = useState<{ label: string; screenX: number; screenY: number; worldX: number; worldY: number; value: number } | null>(null);
  const hoverRAF = useRef<number | null>(null);
  const pendingHover = useRef<{ screenX: number; screenY: number; worldX: number; worldY: number } | null>(null);
  // ── 右键菜单 ──
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  // ── 画布内数值输入（去 prompt 化）：工具处理器把"继续构造"闭包挂到这里 ──
  const [valueRequest, setValueRequest] = useState<ValueRequest | null>(null);
  const valueRequestSnapshot = useRef<ConstructionElement[] | null>(null);
  // 浮层是 fixed portal：必须存**视口坐标**（clientX/Y），画布局部坐标会被
  // SidePanel/Toolbar 的页面偏移平移（评审 U13）。
  const lastClientPosRef = useRef({ x: 0, y: 0 });
  // ── 标签拖拽（GeoGebra MoveMode.LABEL）──
  const [draggingLabel, setDraggingLabel] = useState<GeoElement | null>(null);
  const [labelDragStart, setLabelDragStart] = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  // ── 构造步骤导航（constIndex ≤ step 的对象才可见/可选；null = 未启用）──
  const [navBarVisible, setNavBarVisible] = useState(false);
  const [navStep, setNavStep] = useState<number | null>(null);
  const [navPlaying, setNavPlaying] = useState(false);
  // ── 轨迹层（TraceLayer：签名变化追加深影）──
  const traceCanvasRef = useRef<HTMLCanvasElement>(null);
  const [traceRecorder] = useState(() => new TraceRecorder());
  const traceCoordKeyRef = useRef('');

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
    if (oldLabel === newLabel) return;
    // 查重上提到统一入口（评审 U7）：此前右键菜单自查、工具栏内联输入不查，
    // 能造出重复标签
    const clash = kernel.getConstruction().getElements()
      .some(el => el !== element && (el as { label?: string }).label === newLabel);
    if (clash) { alert(t('ctxRenameDuplicate')); return; }
    (element as { label?: string }).label = newLabel;
    // 级联重写按标签解析的消费方：复选框联动（评审 U7：重命名被联动对象
    // 会静默弄断 checkbox）。serializer 的 outputLabels 是保存时现读的，无此问题。
    kernel.getConstruction().getElements().forEach(el => {
      if (el instanceof GeoBoolean && el.linkedLabels.includes(oldLabel)) {
        el.linkedLabels = el.linkedLabels.map(l => (l === oldLabel ? newLabel : l));
      }
    });
    rewriteExpressions(oldLabel, newLabel);
    kernel.getConstruction().updateAllAlgorithms();
    addCommand({ type: 'rename', element, oldLabel, newLabel });
  }, [addCommand, kernel, t]);

  const handleLabelSubmit = useCallback(() => {
    if (selectedElements.length === 1) {
      if (editingLabel.trim() !== '') { recordRename(selectedElements[0], editingLabel.trim()); setRenderRev(r => r + 1); }
      else setEditingLabel(selectedElements[0].label);
    }
  }, [selectedElements, editingLabel, recordRename]);

  const handleAlgebraElementsCreated = useCallback((elements: ConstructionElement[]) => {
    if (elements.length === 0) return; // Slider(a) 重定义等分支返回空数组，不入哑命令
    const construction = kernel.getConstruction();
    elements.forEach(element => construction.addElement(element));
    construction.updateAllAlgorithms();
    addCommand({ type: 'add', elements });
    setSelectedElements(elements.filter((element): element is GeoElement => element instanceof GeoElement));
    setRenderRev(value => value + 1);
  }, [kernel, addCommand]);

  const snapshotStyle = useCallback((el: GeoElement): Record<string, unknown> => ({
    strokeColor: el.strokeColor, strokeWidth: el.strokeWidth, strokeDash: el.strokeDash ? [...el.strokeDash] : [],
    fillColor: el.fillColor, labelVisible: el.labelVisible, labelMode: el.labelMode, visible: el.visible,
    labelOffsetX: el.labelOffsetX, labelOffsetY: el.labelOffsetY,
    isFixed: el.isFixed, trace: el.trace, layer: el.layer,
  }), []);

  const applyStyleDirectly = useCallback((el: GeoElement, changes: Record<string, unknown>) => {
    if ('strokeColor' in changes) el.strokeColor = changes.strokeColor as string | null;
    if ('strokeWidth' in changes) el.strokeWidth = changes.strokeWidth as number | null;
    if ('strokeDash' in changes) el.strokeDash = changes.strokeDash ? [...(changes.strokeDash as number[])] : null;
    if ('fillColor' in changes) el.fillColor = changes.fillColor as string | null;
    if ('labelVisible' in changes) el.labelVisible = changes.labelVisible as boolean;
    if ('labelMode' in changes) el.labelMode = changes.labelMode as 'always' | 'mouse' | 'never';
    if ('visible' in changes) el.visible = changes.visible as boolean;
    if ('labelOffsetX' in changes) el.labelOffsetX = changes.labelOffsetX as number;
    if ('labelOffsetY' in changes) el.labelOffsetY = changes.labelOffsetY as number;
    if ('isFixed' in changes) el.isFixed = changes.isFixed as boolean;
    if ('trace' in changes) el.trace = changes.trace as boolean;
    if ('layer' in changes) el.layer = changes.layer as number;
    if ('sliderX' in changes && el instanceof GeoNumeric) el.sliderX = changes.sliderX as number;
    if ('sliderY' in changes && el instanceof GeoNumeric) el.sliderY = changes.sliderY as number;
    if ('intervalMin' in changes && el instanceof GeoNumeric) el.intervalMin = changes.intervalMin as number;
    if ('intervalMax' in changes && el instanceof GeoNumeric) el.intervalMax = changes.intervalMax as number;
    if ('animationIncrement' in changes && el instanceof GeoNumeric) el.animationIncrement = Math.max(0, changes.animationIncrement as number);
    if ('sliderWidthPx' in changes && el instanceof GeoNumeric) el.sliderWidthPx = Math.max(20, changes.sliderWidthPx as number);
    if ('sliderHorizontal' in changes && el instanceof GeoNumeric) el.sliderHorizontal = changes.sliderHorizontal as boolean;
    if ('sliderVisible' in changes && el instanceof GeoNumeric) el.sliderVisible = changes.sliderVisible as boolean;
  }, []);

  const recordStyleChange = useCallback((element: GeoElement, changes: Record<string, unknown>) => {
    const before = snapshotStyle(element);
    applyStyleDirectly(element, changes);
    const after = snapshotStyle(element);
    addCommand({ type: 'style', element, before, after });
  }, [applyStyleDirectly, addCommand, snapshotStyle]);

  // ─── 画布内数值输入（去 prompt 化）────────────────────────────────
  // 工具处理器在需要数值时调用 requestValue，把"继续构造"的闭包交给浮层；
  // 关闭时对构造做前后差分，把异步新建的元素补进 undo 栈。
  const requestValue = useCallback((title: string, defaultValue: string, onSubmit: (raw: string | null) => void) => {
    valueRequestSnapshot.current = kernel.getConstruction().getElements();
    const pos = lastClientPosRef.current;
    setValueRequest({ kind: 'number', title, defaultValue, screenX: pos.x, screenY: pos.y, onSubmit });
  }, [kernel]);

  /** 请求画布内文本输入（重命名用）。 */
  const requestTextValue = useCallback((title: string, defaultValue: string, onSubmit: (raw: string | null) => void) => {
    const pos = lastClientPosRef.current;
    setValueRequest({ kind: 'text', title, defaultValue, screenX: pos.x, screenY: pos.y, onSubmit });
  }, []);

  /** 显示全部对象（GeoGebra zoomToFit）：取有限对象的并集包围盒取景。 */
  const zoomToFit = useCallback(() => {
    const geoList = kernel.getConstruction().getElements()
      .filter((el): el is GeoElement => el instanceof GeoElement && el.isEffectivelyVisible());
    let rect: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
    for (const el of geoList) {
      const b = getElementBounds(el);
      if (!b) continue;
      rect = rect
        ? { minX: Math.min(rect.minX, b.minX), maxX: Math.max(rect.maxX, b.maxX), minY: Math.min(rect.minY, b.minY), maxY: Math.max(rect.maxY, b.maxY) }
        : b;
    }
    if (!rect) return;
    const rectEl = containerRef.current?.getBoundingClientRect();
    const w = rectEl?.width ?? 800, h = rectEl?.height ?? 600;
    let bw = rect.maxX - rect.minX, bh = rect.maxY - rect.minY;
    if (bw < 1e-9) bw = 4;
    if (bh < 1e-9) bh = 4;
    const margin = 0.5;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(w / (bw * (1 + margin)), h / (bh * (1 + margin)))));
    const cx = (rect.minX + rect.maxX) / 2, cy = (rect.minY + rect.maxY) / 2;
    setCoord(new CoordinateSystem(w, h, w / 2 - cx * scale, h / 2 + cy * scale, scale, scale));
    setRenderRev(r => r + 1);
  }, [kernel]);

  // ─── 构造步骤导航 ────────────────────────────────────────────────
  const toggleNavBar = useCallback(() => {
    setNavBarVisible(v => {
      const next = !v;
      if (next) {
        const geoList = kernel.getConstruction().getElements().filter(el => el instanceof GeoElement);
        setNavStep(geoList.length > 0 ? Math.max(...geoList.map(el => el.constIndex)) : 0);
      } else {
        setNavPlaying(false);
        setNavStep(null);
      }
      return next;
    });
  }, [kernel]);

  /** 轨迹重绘（渲染循环与右键关闭轨迹共用）。 */
  const redrawTrace = useCallback(() => {
    const traceCanvas = traceCanvasRef.current;
    if (!traceCanvas) return;
    const ctx2d = traceCanvas.getContext('2d');
    if (!ctx2d) return;
    const dpr = window.devicePixelRatio || 1;
    const all = kernel.getConstruction().getElements();
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, traceCanvas.width, traceCanvas.height);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTraceStamps(ctx2d, traceRecorder.getStamps(id => all.find(e => e.id === id)?.visible !== false));
  }, [kernel, traceRecorder]);

  const handleValueClosed = useCallback(() => {
    setValueRequest(null);
    const before = valueRequestSnapshot.current;
    valueRequestSnapshot.current = null;
    if (!before) return;
    const after = kernel.getConstruction().getElements();
    const added = after.filter(el => !before.includes(el));
    if (added.length > 0) addCommand({ type: 'add', elements: added });
    setRenderRev(r => r + 1);
  }, [kernel, addCommand]);

  /** 复选框勾选 → 内核 GeoBoolean 取值（入 undo 栈）。 */
  const handleBooleanToggle = useCallback((element: { booleanLabel?: string }, next: boolean) => {
    if (!element.booleanLabel) return;
    const target = kernel.getConstruction().getElements()
      .find(e => e instanceof GeoBoolean && (e as GeoBoolean).label === element.booleanLabel) as GeoBoolean | undefined;
    if (!target) return;
    addCommand({ type: 'boolean', element: target, oldValue: target.getValue(), newValue: next });
    target.setValue(next);
    setRenderRev(r => r + 1);
  }, [kernel, addCommand]);

  const deleteWithDependents = useCallback((els: ConstructionElement[]) => {
    if (els.length === 0) return;
    const construction = kernel.getConstruction();
    const cascade = new Set<ConstructionElement>();
    for (const el of els) { for (const c of construction.collectDeletionCascade(el)) cascade.add(c); construction.deleteElementWithDependents(el); }
    // 被删除的对象若在动画列表里会留下僵尸 RAF 循环（每帧推进已删对象并重渲染），
    // 级联集合里的每个成员都退订动画
    const am = kernel.getAnimationManager();
    for (const el of cascade) {
      if (el instanceof GeoElement && el.isAnimating()) el.setAnimating(false);
    }
    // 绑定到被删对象的画布 UI 元素（slider/checkbox）随命令入栈，撤销时同步恢复
    const labels = new Set(Array.from(cascade).map(el => (el as { label?: string }).label).filter(Boolean) as string[]);
    const boundUI = uiElementsRef.current.filter(u =>
      (u.booleanLabel && labels.has(u.booleanLabel)) || (u.numericLabel && labels.has(u.numericLabel)));
    addCommand({ type: 'delete', elements: Array.from(cascade).sort((a, b) => a.constIndex - b.constIndex), uiElements: boundUI });
    if (boundUI.length > 0) {
      const boundIds = new Set(boundUI.map(u => u.id));
      setUIElementsTracked(prev => prev.filter(u => !boundIds.has(u.id)));
    }
    setSelectedElements([]);
    setRenderRev(r => r + 1);
  }, [kernel, addCommand, setUIElementsTracked]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 文件 I/O ─────────────────────────────────────────────────────
const handleExport = useCallback(() => {
    try {
      // UI 元素一并落盘（v4.3）：widget 位置与内核绑定
      const widgets = uiElementsRef.current.map(u => ({
        id: u.id, type: u.type, x: u.x, y: u.y,
        label: u.label, numericLabel: u.numericLabel, booleanLabel: u.booleanLabel,
        script: u.script,
      }));
      // v4.6：2D 网格/轴显隐与 3D 视图状态一并落盘（官方 euclidianView3D 块）
      downloadJSON('minigeogebra-construction.json', serializeConstruction(kernel, coord, widgets, { grid: showGrid, axes: showAxes }, (() => {
        const s3 = snapshotView3D();
        return s3 ?? undefined;
      })()));
    } catch (err) { console.error('[export failed]', err); alert(t('exportFailed')); }
  }, [kernel, coord, showGrid, showAxes]);

  const downloadFile = useCallback((content: string, filename: string, type?: string) => {
    const blob = new Blob([content], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, []);

  const handleExportPNG = useCallback(() => { const c = canvasRef.current; if (!c) return; downloadFile(c.toDataURL('image/png'), `minigeogebra-${Date.now()}.png`, 'image/png'); }, [downloadFile]);

  const handleExportSVG = useCallback(() => {
    try { const svgR = new SvgRenderer(); const bounds = coord.visibleWorldBounds(); _renderToSvg(svgR, bounds); downloadFile(svgR.toSvgString(bounds), `minigeogebra-${Date.now()}.svg`, 'image/svg+xml'); }
    catch (err) { console.error('[svg export failed]', err); alert(t('exportSvgFailed')); }
  }, [coord, downloadFile]);

  const _renderToSvg = useCallback((renderer: IRenderer, bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
    const vw = (bounds.maxX - bounds.minX) * coord.xScale, vh = (bounds.maxY - bounds.minY) * coord.xScale;
    drawGrid(renderer, vw, vh, coord, showGrid, showAxes, kernel.getOptions().rounding);
    const elements = kernel.getConstruction().getElements().filter((el): el is GeoElement => el instanceof GeoElement && el.isEffectivelyVisible());
    elements.forEach(el => { if (el instanceof GeoPolygon) drawPolygon(renderer, el, false, coord.xScale); });
    elements.forEach(el => {
      if (el instanceof GeoConicPart) drawConicPart(renderer, el, false, coord.xScale);
      else if (el instanceof GeoArc) drawArc(renderer, el, false, coord.xScale);
      else if (el instanceof GeoConic) drawConic(renderer, el, false, coord.xScale, bounds);
    });
    elements.forEach(el => { if (el instanceof GeoLocus) drawLocus(renderer, el, false, coord.xScale); });
    elements.forEach(el => { if (el instanceof GeoFunction) drawFunction(renderer, el, false, bounds, coord.xScale, (bounds.maxX - bounds.minX) * coord.xScale); });
    elements.forEach(el => { if (el instanceof GeoCurve) drawCurve(renderer, el, false, bounds, coord.xScale, (bounds.maxX - bounds.minX) * coord.xScale); });
    elements.forEach(el => { if (el instanceof GeoInequality) drawInequality(renderer, el, bounds, coord.xScale); });
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
        // C11：OFF 网格导入（按扩展名或 OFF 头判定）
        const isOff = /\.off$/i.test(file.name) || /^\s*OFF\b/i.test(text);
        if (isOff && !/^\s*\{/.test(text)) {
          importOFF(kernel, text);
        } else {
          const { coord: restored, uiWidgets, viewFlags, view3D } = deserializeConstruction(kernel, text);
          if (restored) setCoord(restored);
          // v4.6：恢复 2D 网格/轴显隐与 3D 视图状态（3D 视图挂载时消费）
          if (viewFlags) { setShowGrid(viewFlags.grid); setShowAxes(viewFlags.axes); }
          if (view3D) offerView3D(view3D);
          // v4.3：恢复画布 UI 元素（内核绑定对象已由反序列化重建）
          if (uiWidgets?.length) {
            const effCoord = restored ?? coord;
            // 滑条不再是 HTML widget：旧存档的 slider widget 迁移为内核
            // GeoNumeric 的滑条字段（sliderVisible + 屏幕绝对位置）
            uiWidgets.filter(w => w.type === 'slider' && w.numericLabel).forEach(w => {
              const num = kernel.getConstruction().getElements().find(
                el => el instanceof GeoNumeric && (el as GeoNumeric).label === w.numericLabel) as GeoNumeric | undefined;
              if (num) {
                num.sliderVisible = true;
                num.sliderX = w.x * effCoord.xScale + effCoord.xZero;
                num.sliderY = effCoord.yZero - w.y * effCoord.yScale;
                num.sliderWidthPx = 200;
                num.sliderHorizontal = true;
              }
            });
            const restoredWidgets = uiWidgets
              .filter(w => w.type !== 'slider')
              .filter(w => w.type !== 'checkbox' || uiElementsRef.current.every(p => p.booleanLabel !== w.booleanLabel))
              .filter(w => w.type !== 'inputbox' || uiElementsRef.current.every(p => p.numericLabel !== w.numericLabel))
              .map(w => ({ ...w, value: 0 }) as UIElement);
            setUIElementsTracked(prev => [...prev, ...restoredWidgets]);
          }
        }
        setSelectedElements([]); setPolygonPoints([]); setRenderRev(r => r + 1);
      } catch (err) { console.error('[import failed]', err); alert('导入失败'); }
      finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  }, [kernel]);

  // ─── 动画 ─────────────────────────────────────────────────────────
  const isAnimating = kernel.getAnimationManager().isRunning();
  const toggleAnimation = useCallback(() => { const am = kernel.getAnimationManager(); if (am.isRunning()) am.stopAnimation(); else am.startAnimation(); setRenderRev(r => r + 1); }, [kernel]);

  // ─── 导航自动播放 ─────────────────────────────────────────────────
  const navTotal = (() => {
    const geoList = kernel.getConstruction().getElements().filter(el => el instanceof GeoElement);
    return geoList.length > 0 ? Math.max(...geoList.map(el => el.constIndex)) : 0;
  })();

  useEffect(() => {
    if (!navPlaying) return;
    const timer = window.setInterval(() => {
      setNavStep(prev => {
        const next = (prev ?? 0) + 1;
        if (next >= navTotal) { setNavPlaying(false); return navTotal; }
        return next;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [navPlaying, navTotal]);

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
      const traceCanvas = traceCanvasRef.current;
      if (traceCanvas) {
        traceCanvas.width = width * dpr; traceCanvas.height = height * dpr;
        traceCanvas.style.width = `${width}px`; traceCanvas.style.height = `${height}px`;
      }
      setCoord(c => c.setSize(width, height));
      setRenderRev(r => r + 1);
    };
    window.addEventListener('resize', updateSize); updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);


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
    // 卸载清理：停掉 RAF 动画循环与 hover 节流帧，解除内核回调，
    // 避免对已卸载组件继续 setRenderRev / setFunctionHover
    return () => {
      kernel.getAnimationManager().stopAnimation();
      if (hoverRAF.current !== null) cancelAnimationFrame(hoverRAF.current);
      kernel.setUpdateCallback(null);
    };
  }, [kernel]);

  // ─── 恢复状态（undo/redo） ────────────────────────────────────────
  const restoreState = useCallback((state: MoveSnapshot) => {
    // 批处理 + 全场重算后丢弃增量队列：setCoords/setValue 每次都会入队，
    // 不清理的话批末/微任务会把刚全场重算过的依赖链再增量跑一遍
    kernel.withBatchedUpdates(() => {
      restoreMoveState(kernel, state);
      kernel.getConstruction().updateAllAlgorithms();
      kernel.clearPendingUpdates();
    });
  }, [kernel]);

  // 重命名的联动改写（仅 undo/redo 回放用，不再入命令栈）：复选框按标签
  // 引用对象，撤销/重做重命名时必须同步反向/正向改写 linkedLabels
  const rewriteLinkedLabels = useCallback((fromLabel: string, toLabel: string) => {
    kernel.getConstruction().getElements().forEach(el => {
      if (el instanceof GeoBoolean && el.linkedLabels.includes(fromLabel)) {
        el.linkedLabels = el.linkedLabels.map(l => (l === fromLabel ? toLabel : l));
      }
    });
  }, [kernel]);

  // 重命名的表达式级联（官方 kernel 统一重写 dependent 定义）：依赖数值的表达式
  // AST（派生数值/函数/不等式 + 条件显隐/动态颜色）按新名改写——否则 `b = a + 1`
  // 里 a 改名后 AST 仍是旧名、scope 按新 label 取值 → NaN 断链。依赖对象引用不变。
  const rewriteExpressions = useCallback((fromLabel: string, toLabel: string) => {
    kernel.getConstruction().getElements().forEach(el => {
      if (el instanceof AlgoDependentFunction || el instanceof AlgoDependentNumeric) {
        (el as AlgoDependentFunction | AlgoDependentNumeric).renameDependency(fromLabel, toLabel);
      } else if (el instanceof AlgoDependentInequality) {
        (el.getOutput() as GeoInequality).renameVariable(fromLabel, toLabel);
      } else if (el instanceof GeoElement) {
        if (el.visibleCondition && astUsesVariable(el.visibleCondition.ast, fromLabel)) {
          el.visibleCondition = { ...el.visibleCondition, ast: renameVariableInAst(el.visibleCondition.ast, fromLabel, toLabel) };
        }
        if (el.dynamicColor) {
          const d = el.dynamicColor;
          const patch: Partial<typeof d> = {};
          if (astUsesVariable(d.r, fromLabel)) patch.r = renameVariableInAst(d.r, fromLabel, toLabel);
          if (astUsesVariable(d.g, fromLabel)) patch.g = renameVariableInAst(d.g, fromLabel, toLabel);
          if (astUsesVariable(d.b, fromLabel)) patch.b = renameVariableInAst(d.b, fromLabel, toLabel);
          if (d.a && astUsesVariable(d.a, fromLabel)) patch.a = renameVariableInAst(d.a, fromLabel, toLabel);
          if (Object.keys(patch).length > 0) el.dynamicColor = { ...d, ...patch } as typeof d;
        }
      }
    });
  }, [kernel]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const cmd = undoStack.current.pop()!; redoStack.current.push(cmd);
    if (cmd.type === 'add') { [...cmd.elements].reverse().forEach(el => kernel.getConstruction().removeElement(el)); setSelectedElements(prev => prev.filter(e => !(cmd.elements as any[]).includes(e))); setPolygonPoints(prev => prev.filter(e => !(cmd.elements as any[]).includes(e))); if (cmd.uiElements?.length) { const ids = new Set<string>(cmd.uiElements.map((u: any) => u.id)); setUIElementsTracked(prev => prev.filter(u => !ids.has(u.id))); } }
    else if (cmd.type === 'delete') { cmd.elements.slice().sort((a, b) => a.constIndex - b.constIndex).forEach(el => kernel.getConstruction().addElement(el)); setSelectedElements([]); if (cmd.uiElements?.length) setUIElementsTracked(prev => [...prev, ...cmd.uiElements.filter((u: any) => !prev.some(p => p.id === u.id))]); }
    else if (cmd.type === 'move') restoreState(cmd.oldState);
    else if (cmd.type === 'numeric') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el instanceof GeoNumeric) el.setValue(cmd.oldValue); }
    else if (cmd.type === 'boolean') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el instanceof GeoBoolean) el.setValue(cmd.oldValue); }
    else if (cmd.type === 'rename') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el) el.label = cmd.oldLabel; rewriteLinkedLabels(cmd.newLabel, cmd.oldLabel); rewriteExpressions(cmd.newLabel, cmd.oldLabel); }
    else if (cmd.type === 'style') applyStyleDirectly(cmd.element, cmd.before);
    else if (cmd.type === 'uiMove') setUIElementsTracked(prev => prev.map(u => u.id === cmd.id ? { ...u, x: cmd.from.x, y: cmd.from.y } : u));
    kernel.getConstruction().updateAllAlgorithms(); setRenderRev(r => r + 1);
  }, [kernel, restoreState, applyStyleDirectly, rewriteLinkedLabels, rewriteExpressions, setUIElementsTracked]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const cmd = redoStack.current.pop()!; undoStack.current.push(cmd);
    if (cmd.type === 'add') { cmd.elements.forEach(el => kernel.getConstruction().addElement(el)); if (cmd.uiElements?.length) setUIElementsTracked(prev => [...prev, ...cmd.uiElements.filter((u: any) => !prev.some(p => p.id === u.id))]); }
    // 重做删除 = 再次删除（按 constIndex 逆序移除）。此前误用 addElement，
    // 删除 → 撤销 → 重做 会把同一批元素重复加回构造
    else if (cmd.type === 'delete') { [...cmd.elements].sort((a, b) => b.constIndex - a.constIndex).forEach(el => kernel.getConstruction().removeElement(el)); if (cmd.uiElements?.length) { const ids = new Set<string>(cmd.uiElements.map((u: any) => u.id)); setUIElementsTracked(prev => prev.filter(u => !ids.has(u.id))); } }
    else if (cmd.type === 'move') restoreState(cmd.newState);
    else if (cmd.type === 'numeric') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el instanceof GeoNumeric) el.setValue(cmd.newValue); }
    else if (cmd.type === 'boolean') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el instanceof GeoBoolean) el.setValue(cmd.newValue); }
    else if (cmd.type === 'rename') { const el = kernel.getConstruction().getElementById(cmd.element.id); if (el) el.label = cmd.newLabel; rewriteLinkedLabels(cmd.oldLabel, cmd.newLabel); rewriteExpressions(cmd.oldLabel, cmd.newLabel); }
    else if (cmd.type === 'style') applyStyleDirectly(cmd.element, cmd.after);
    else if (cmd.type === 'uiMove') setUIElementsTracked(prev => prev.map(u => u.id === cmd.id ? { ...u, x: cmd.to.x, y: cmd.to.y } : u));
    kernel.getConstruction().updateAllAlgorithms(); setRenderRev(r => r + 1);
  }, [kernel, restoreState, applyStyleDirectly, rewriteLinkedLabels, rewriteExpressions, setUIElementsTracked]);

  // ─── 画布 widget 拖拽（window 级监听）──
  // widget 是画布的兄弟绝对定位层：mousedown 在 widget 上被 stopPropagation，
  // canvas 的 onMouseMove/onMouseUp 收不到后续事件——只有 window 监听能跟手，
  // 且 mouseup 落在 widget 上也能收尾（此前拖一下就粘滞、位置移动也不入 undo）。
  const uiDragStartRef = useRef<{ id: string; from: { x: number; y: number }; moved: boolean } | null>(null);
  const uiDragJustEndedRef = useRef(false);
  useEffect(() => {
    if (!draggingUIElement) return;
    const startEl = uiElementsRef.current.find(u => u.id === draggingUIElement);
    if (startEl) uiDragStartRef.current = { id: startEl.id, from: { x: startEl.x, y: startEl.y }, moved: false };
    uiDragJustEndedRef.current = false;
    const onMove = (e: MouseEvent) => {
      const container = containerRef.current; if (!container) return;
      const rect = container.getBoundingClientRect();
      const wx = (e.clientX - rect.left - coord.xZero) / coord.xScale;
      const wy = (coord.yZero - (e.clientY - rect.top)) / coord.yScale;
      if (uiDragStartRef.current) uiDragStartRef.current.moved = true;
      setUIElementsTracked(prev => prev.map(el => el.id === draggingUIElement ? { ...el, x: wx, y: wy } : el));
    };
    const onUp = () => {
      const start = uiDragStartRef.current;
      if (start?.moved) {
        const el = uiElementsRef.current.find(u => u.id === start.id);
        if (el && (Math.abs(el.x - start.from.x) > 1e-9 || Math.abs(el.y - start.from.y) > 1e-9)) {
          addCommand({ type: 'uiMove', id: start.id, from: start.from, to: { x: el.x, y: el.y } });
        }
      }
      // 仅真实拖动过才抑制随后的 click（防拖完按钮误触发脚本）；普通点击不抑制
      uiDragJustEndedRef.current = start?.moved === true;
      uiDragStartRef.current = null;
      setDraggingUIElement(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggingUIElement, coord, addCommand, setUIElementsTracked, setDraggingUIElement]);

  // ─── widget 改值入 undo（滑块拖动 / 输入框提交，与 SidePanel 同一命令通道）──
  const handleUIValueCommit = useCallback((element: { numericLabel?: string }, oldValue: number, newValue: number) => {
    if (!element.numericLabel || oldValue === newValue) return;
    const numeric = kernel.getConstruction().getElements().find(
      el => el instanceof GeoNumeric && (el as GeoNumeric).label === element.numericLabel) as GeoNumeric | undefined;
    if (!numeric) return;
    notifyNumericChange(numeric, oldValue, newValue);
    numeric.setValue(newValue);
    kernel.notifyUpdate(numeric);
  }, [kernel, notifyNumericChange]);

  // ─── 键盘快捷键 ───────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          // 同 mode effect：只回收 polygon 工具新建的点，不碰用户既有点
          if (polygonCreatedPointsRef.current.length > 0) {
            polygonCreatedPointsRef.current.forEach(point => kernel.getConstruction().removeElement(point));
            polygonCreatedPointsRef.current.length = 0;
            kernel.getConstruction().updateAllAlgorithms();
          }
          setMode('move'); setSelectedElements([]); setPolygonPoints([]); cancelBoxSelect(); setRenderRev(r => r + 1);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElements.length > 0 && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); deleteWithDependents(selectedElements);
      } else if (e.altKey && (e.key === 's' || e.key === 'S') && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); setSnapEnabled(prev => !prev); }
      // GeoGebra 快捷键：Ctrl+Z 撤销、Ctrl+Shift+Z / Ctrl+Y 重做
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')
        && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); undo();
      } else if ((e.ctrlKey || e.metaKey) && ((e.key === 'y' || e.key === 'Y') || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))
        && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); redo();
      }
      // GeoGebra 快捷键：Ctrl+G/H 显隐对象，Ctrl+Shift+G/H 显隐标签
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G' || e.key === 'h' || e.key === 'H')
        && selectedElements.length > 0 && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        const show = e.key.toLowerCase() === 'g';
        selectedElements.forEach(el => recordStyleChange(el, e.shiftKey ? { labelVisible: show } : { visible: show }));
        setRenderRev(r => r + 1);
      }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [selectedElements, kernel, polygonPoints, deleteWithDependents, recordStyleChange, undo, redo]);

  // ─── 渲染循环 ─────────────────────────────────────────────────────
  const { schedule } = useRenderLoop(() => {
    const canvas = canvasRef.current; if (!canvas || !renderer) return;
    if (view === '3d') return;
    renderer.viewportSize(canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    renderer.clearRect(0, 0, canvas.width, canvas.height);
    // 世界 y 向上为正：渲染变换 y 取负（文本由 fillText 瓶颈点屏幕化，不会镜像）
    renderer.save(); renderer.scale(dpr, dpr); renderer.translate(coord.xZero, coord.yZero); renderer.scale(coord.xScale, -coord.yScale);

    drawGrid(renderer, canvas.width / dpr, canvas.height / dpr, coord, showGrid, showAxes, kernel.getOptions().rounding);

    // 导航中只显示 constIndex ≤ navStep 的对象；图层稳定排序（同层保持构造序）
    const elements = kernel.getConstruction().getElements()
      .filter(el => navStep === null || el.constIndex <= navStep);
    const drawOrder = elements.map((el, i) => ({ el, i }))
      .sort((a, b) => (a.el.layer - b.el.layer) || (a.i - b.i))
      .map(({ el }) => el);
    const selectedSet = new Set(selectedElements);
    // 线型（dash）此前只在 SVG 导出/3D 生效，2D 主画布 17 个 draw 函数全没接——
    // 统一在分派点按屏幕像素（存值 / xScale）施加，绘制完复位
    const drawWithStyle = (el: GeoElement, draw: () => void) => {
      if (el.strokeDash && el.strokeDash.length) {
        renderer.setLineDash(el.strokeDash.map(d => d / coord.xScale));
      }
      draw();
      renderer.setLineDash([]);
    };
    drawOrder.forEach(el => {
      const sel = selectedSet.has(el);
      if (el instanceof GeoPolygon) drawWithStyle(el, () => drawPolygon(renderer, el, sel, coord.xScale));
      else if (el instanceof GeoConicPart) drawWithStyle(el, () => drawConicPart(renderer, el, sel, coord.xScale));
      else if (el instanceof GeoArc) drawWithStyle(el, () => drawArc(renderer, el, sel, coord.xScale));
      else if (el instanceof GeoConic) drawWithStyle(el, () => drawConic(renderer, el, sel, coord.xScale, coord.visibleWorldBounds()));
      else if (el instanceof GeoLocus) drawWithStyle(el, () => drawLocus(renderer, el, sel, coord.xScale));
      else if (el instanceof GeoBooleanRegion) drawWithStyle(el, () => drawBooleanRegion(renderer, el, sel, coord.xScale));
      else if (el instanceof GeoFunction) drawWithStyle(el, () => drawFunction(renderer, el, sel, coord.visibleWorldBounds(), coord.xScale, canvas.width / dpr));
      else if (el instanceof GeoCurve) drawWithStyle(el, () => drawCurve(renderer, el, sel, coord.visibleWorldBounds(), coord.xScale, canvas.width / dpr));
      else if (el instanceof GeoInequality) drawWithStyle(el, () => drawInequality(renderer, el, coord.visibleWorldBounds(), coord.xScale, sel));
      else if (el instanceof GeoText) drawWithStyle(el, () => drawText(renderer, el, sel, coord.xScale));
      else if (el instanceof GeoPolyLine) drawWithStyle(el, () => drawPolyLine(renderer, el, sel, coord.xScale));
      else if (el instanceof GeoVector) drawWithStyle(el, () => drawVector(renderer, el, sel, coord.xScale));
      else if (el instanceof GeoSegment) drawWithStyle(el, () => drawSegment(renderer, el, sel, coord.xScale));
      else if (el instanceof GeoRay) drawWithStyle(el, () => drawRay(renderer, el, sel, coord.visibleWorldBounds(), coord.xScale));
      else if (el instanceof GeoLine) drawWithStyle(el, () => drawLine(renderer, el, sel, coord.visibleWorldBounds(), coord.xScale));
      else if (el instanceof GeoNumeric && el.isAngle) drawAngleMarker(renderer, el, coord.xScale);
      else if (el instanceof GeoNumeric && el.sliderVisible) drawSliderDrawable(renderer, el, sel, coord);
    });
    drawOrder.forEach(el => { if (el instanceof GeoPoint) drawPoint(renderer, el, selectedSet.has(el), coord.xScale); });

    if (mode === 'polygon' && polygonPoints.length > 0) {
      renderer.strokeStyle = '#9ca3af'; renderer.lineWidth = 1 / coord.xScale;
      renderer.setLineDash([5 / coord.xScale, 5 / coord.xScale]);
      renderer.beginPath(); renderer.moveTo(polygonPoints[0].getX(), polygonPoints[0].getY());
      for (let i = 1; i < polygonPoints.length; i++) renderer.lineTo(polygonPoints[i].getX(), polygonPoints[i].getY());
      renderer.lineTo(mousePos.x, mousePos.y); renderer.stroke(); renderer.setLineDash([]);
    }

    // 幽灵点：点类工具 hover 命中路径对象时传入（与 handlers 的命中过滤一致）
    const ghostPath = (mode === 'point' || mode === 'point_on_object')
      ? hitScreenObject(
          kernel.getConstruction().getElements().filter((el): el is GeoElement => el instanceof GeoElement && el.isEffectivelyVisible() && (navStep === null || el.constIndex <= navStep)),
          mousePos.x, mousePos.y, coord.xScale,
        )
      : null;
    renderPreviews(mode, selectedElements, mousePos, hoveredPoint, coord, renderer, coord.visibleWorldBounds(), ghostPath);

    // 函数 hover 吸附点（在预览之上，避免被 preview 线段遮挡）
    if (functionHover) {
      drawHoverMarker(renderer, coord, functionHover.worldX, functionHover.worldY, '#3b82f6');
    }

    renderer.frameCommit();

    // ── 轨迹层（TraceLayer）：签名变化追加深影；视口变化/删除对象后重绘 ──
    if (traceCanvasRef.current) {
      const coordKey = `${coord.xZero},${coord.yZero},${coord.xScale}`;
      let needsRedraw = false;
      if (traceCoordKeyRef.current !== coordKey) { traceCoordKeyRef.current = coordKey; traceRecorder.clear(); needsRedraw = true; }
      const allElements = kernel.getConstruction().getElements();
      if (traceRecorder.prune(new Set(allElements.map(el => el.id)))) needsRedraw = true;
      if (traceRecorder.update(allElements, coord)) needsRedraw = true;
      if (needsRedraw) redrawTrace();
    }

    // WebGL 文本通过 overlay Canvas2D 绘制
    const textCanvas = textOverlayRef.current;
    if (textCanvas && renderer.flushTextQueue) {
      const items = renderer.flushTextQueue();
      const ctx = textCanvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
        if (items.length > 0) {
          // 文本 overlay 不随世界变换翻转：WebGLRendererFallback.fillText 入队时
          // 已把世界 y 取反，这里保持正 y 缩放即可得到正确位置与正立文字
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
  }, [view, renderRev, selectedElements, mousePos, mode, polygonPoints, hoveredPoint, coord, showGrid, showAxes, renderer, functionHover, kernel, navStep, traceRecorder, redrawTrace]);

  useEffect(() => { schedule(); }, [schedule]);

  // ─── 坐标 / 鼠标辅助 ─────────────────────────────────────────────
  const getScreenPos = (e: React.MouseEvent | React.WheelEvent) => { const rect = canvasRef.current!.getBoundingClientRect(); return { screenX: e.clientX - rect.left, screenY: e.clientY - rect.top }; };
  const getGridStep = () => calculateGridStep(coord.xScale);
  /**
   * 点捕捉三态（对标 GeoGebra Options→Point Capturing）：
   *   off        不吸附；
   *   automatic  吸附已有点始终生效，网格吸附只在按下（创建）时生效；
   *   snap_grid  网格 + 已有点始终吸附。
   */
  const getMousePos = (e: React.MouseEvent | React.WheelEvent, useSnap = false, phase: 'down' | 'move' = 'down') => {
    const { screenX, screenY } = getScreenPos(e); const world = coord.screenToWorld(screenX, screenY);
    let { x, y } = world;
    if (useSnap && snapEnabled) {
      const capturing = kernel.getOptions().pointCapturing;
      if (capturing !== 'off') {
        const snapRadius = SNAP_POINT_RADIUS / coord.xScale;
        const gridSnap = capturing === 'snap_grid' || (capturing === 'automatic' && phase === 'down');
        const snapped = applySnap(x, y, snapRadius, gridSnap, snapToPoint, kernel.getConstruction().getElements().filter(el => el instanceof GeoPoint) as GeoPoint[], getGridStep());
        x = snapped.x; y = snapped.y;
      }
    }
    return { screenX, screenY, x, y };
  };

  const zoom = useCallback((factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // 官方 getZoomPoint：优先以鼠标所在处为缩放焦点，鼠标在画布外才回退中心
    const lx = lastClientPosRef.current.x - rect.left;
    const ly = lastClientPosRef.current.y - rect.top;
    const inCanvas = lx >= 0 && ly >= 0 && lx <= rect.width && ly <= rect.height;
    const sx = inCanvas ? lx : rect.width / 2;
    const sy = inCanvas ? ly : rect.height / 2;
    setCoord(prev => {
      let next = prev.zoom(factor, sx, sy);
      if (next.xScale < MIN_SCALE) next = prev.zoom(MIN_SCALE / prev.xScale, sx, sy);
      else if (next.xScale > MAX_SCALE) next = prev.zoom(MAX_SCALE / prev.xScale, sx, sy);
      return next;
    });
  }, []);

  // ─── 鼠标事件 ─────────────────────────────────────────────────────
  // ── 右键拖动平移后抑制 contextmenu（官方 handleContextMenu 判定位移）──
  const rightDownPosRef = useRef<{ x: number; y: number } | null>(null);
  // ── 多选整体拖动（E1-3）+ Shift 轴向约束（E1-4）的拖拽起点快照 ──
  const multiDragRef = useRef<{ primary0: { x: number; y: number }; items: { el: GeoPoint; x0: number; y0: number }[] } | null>(null);
  // ── 画布滑条拖拽（官方 MoveMode.NUMERIC / MoveMode.SLIDER）──
  const sliderValueDragRef = useRef<{ num: GeoNumeric; oldValue: number } | null>(null);
  const sliderMoveRef = useRef<{ num: GeoNumeric; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const { screenX, screenY, x, y } = getMousePos(e, true);
    lastClientPosRef.current = { x: e.clientX, y: e.clientY };
    // 数值输入浮层打开时点击画布 = 取消输入并**消费本次点击**（评审 U4：
    // 若继续下落，circle/segment_fixed 等单步工具会立刻重新弹框、孤儿点成倍增加）。
    // 想重来再点一次即可；Esc 同样取消。
    if (valueRequest) {
      const req = valueRequest;
      valueRequestSnapshot.current = null;
      setValueRequest(null);
      req.onSubmit(null);
      return;
    }
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) { setIsPanning(true); setLastPanPos({ x: screenX, y: screenY }); rightDownPosRef.current = { x: screenX, y: screenY }; return; }
    if (mode === 'pan') { setIsPanning(true); setLastPanPos({ x: screenX, y: screenY }); return; }
    // 官方缩放工具单击因子 1.5（EuclidianView.java:172 MODE_ZOOM_FACTOR）
    if (mode === 'zoom_in') { zoom(1.5); return; }
    if (mode === 'zoom_out') { zoom(1 / 1.5); return; }
    // 标签拖拽优先于对象命中（GeoGebra：labels > objects）；隐藏对象与导航未到的对象不可命中
    if ((mode === 'move' || mode === 'select') && e.button === 0) {
      const labelHit = hitLabel(kernel.getConstruction().getElements().filter((el): el is GeoElement => el instanceof GeoElement && el.isEffectivelyVisible() && (navStep === null || el.constIndex <= navStep)), x, y, coord.xScale, coord.visibleWorldBounds());
      if (labelHit) {
        setDraggingLabel(labelHit);
        setLabelDragStart({ sx: screenX, sy: screenY, ox: labelHit.labelOffsetX, oy: labelHit.labelOffsetY });
        setSelectedElements([labelHit]);
        setRenderRev(r => r + 1);
        return;
      }
      // 画布滑条（官方：blob 命中 → 拖值；轨道命中 → 移位；命中即选中）
      const sliderNums = kernel.getConstruction().getElements().filter((el): el is GeoNumeric =>
        el instanceof GeoNumeric && el.sliderVisible && el.isEffectivelyVisible() && (navStep === null || el.constIndex <= navStep));
      for (const num of sliderNums.slice().reverse()) {
        const hit = sliderHitAt(num, screenX, screenY);
        if (!hit) continue;
        setSelectedElements([num]);
        if (hit === 'knob') {
          // 单击即贴合到点击位置（官方 moveNumeric 的"just a click"直更新）
          sliderValueDragRef.current = { num, oldValue: num.getValue() };
          num.setValue(sliderValueAtMouse(num, screenX, screenY));
          kernel.notifyUpdate(num);
        } else {
          sliderMoveRef.current = { num, startX: screenX, startY: screenY, origX: num.sliderX, origY: num.sliderY, moved: false };
        }
        setRenderRev(r => r + 1);
        return;
      }
    }
    // GeoGebra Move 语义：空白拖拽 = 平移视图（Alt = 框选；Ctrl+空白交给 handlers 清选区）
    if (mode === 'move' && e.button === 0 && !e.altKey) {
      // 隐藏对象/导航未到的对象不拦平移：点在"看不见的点"上应表现为空白拖拽
      const els = kernel.getConstruction().getElements().filter((el): el is GeoElement => el instanceof GeoElement && el.isEffectivelyVisible() && (navStep === null || el.constIndex <= navStep));
      const ptHit = hitScreenPoint(els, x, y, SNAP_POINT_RADIUS / coord.xScale);
      const objHit = ptHit ? undefined : hitScreenObject(els, x, y, coord.xScale);
      if (!ptHit && !objHit && !e.ctrlKey && !e.metaKey) {
        setIsPanning(true);
        setLastPanPos({ x: screenX, y: screenY });
        panStartRef.current = { x: screenX, y: screenY };
        panFromEmptyClick.current = true;
        return;
      }
    }
    const elementsBefore = kernel.getConstruction().getElements().length;
    const uiIdsBefore = new Set(uiElementsRef.current.map(u => u.id));
    const currentDragStartState = captureMoveState(kernel); setDragStartState(currentDragStartState);
    setLastMousePos({ x, y });
    const ts = toolState.current;
    boxModifierDown.current = e.ctrlKey || e.metaKey; ts.boxModifierDown = e.ctrlKey || e.metaKey; ts.shiftKey = e.shiftKey; ts.altKey = e.altKey;
    toolHandlers[mode]?.({
      kernel, construction: kernel.getConstruction(), coord,
      elements: kernel.getConstruction().getElements().filter(el => navStep === null || el.constIndex <= navStep),
      selectedElements, mode, mousePos: { x, y }, hoveredPoint: null, polygonPoints, polygonCreatedPoints: polygonCreatedPointsRef.current, uiElements,
      setMode, setSelectedElements, setRenderRev, setPolygonPoints, addCommand, captureState: captureMoveState,
      recordNumericChange: notifyNumericChange, recordRename: handleLabelSubmit, recordStyleChange, deleteElements: deleteWithDependents, t,
      setBoxSelecting: setIsBoxSelecting, setBoxStartScreen, setBoxEndScreen, requestValue,
      // handlers 端按 ref 语义读取 ctx.toolState.current（测试同样以 { current: ts } 传参）；
      // 此前误传裸对象 toolState.current，导致所有 ts.xxx 状态分支（圆3点/圆弧/正多边形/变换）崩溃。
      setDraggedElement, setUIElements: setUIElementsTracked, setEditingUIElement, toolState: toolState,
    }, { x, y }, { x: screenX, y: screenY });
    ts.boxModifierDown = false; ts.shiftKey = false; ts.altKey = false; boxModifierDown.current = false;
    const elementsAfter = kernel.getConstruction().getElements();
    if (elementsAfter.length > elementsBefore || uiElementsRef.current.length > uiIdsBefore.size) {
      // 本次点击新建的 UI 元素（滑块/复选框）随命令入栈，撤销时同步移除
      const addedUI = uiElementsRef.current.filter(u => !uiIdsBefore.has(u.id));
      addCommand({ type: 'add', elements: elementsAfter.slice(elementsBefore), uiElements: addedUI });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { screenX, screenY, x, y } = getMousePos(e, true, 'move'); setMousePos({ x, y });
    lastClientPosRef.current = { x: e.clientX, y: e.clientY };
    if (isPanning) { setCoord(prev => prev.panBy(screenX - lastPanPos.x, screenY - lastPanPos.y)); setLastPanPos({ x: screenX, y: screenY }); setRenderRev(r => r + 1); return; }
    // 画布滑条拖值/移位（官方 moveNumeric / moveSlider）
    if (sliderValueDragRef.current) {
      const { num } = sliderValueDragRef.current;
      const v = sliderValueAtMouse(num, screenX, screenY);
      if (v !== num.getValue()) {
        num.setValue(v);
        kernel.notifyUpdate(num);
      }
      setRenderRev(r => r + 1);
      return;
    }
    if (sliderMoveRef.current) {
      const ref = sliderMoveRef.current;
      ref.num.sliderX = ref.origX + (screenX - ref.startX);
      ref.num.sliderY = ref.origY + (screenY - ref.startY);
      if (Math.abs(screenX - ref.startX) > 2 || Math.abs(screenY - ref.startY) > 2) ref.moved = true;
      setRenderRev(r => r + 1);
      return;
    }
    // widget 拖拽走 window 级监听（见 uiDragStartRef effect），此处不再处理
    // 标签拖拽：偏移按屏幕像素累计（+x 右 / +y 下），绘制与命中共享 labels.ts 锚点
    if (draggingLabel && labelDragStart) {
      draggingLabel.labelOffsetX = labelDragStart.ox + (screenX - labelDragStart.sx);
      draggingLabel.labelOffsetY = labelDragStart.oy + (screenY - labelDragStart.sy);
      setRenderRev(r => r + 1);
      return;
    }
    const elements = kernel.getConstruction().getElements().filter((el): el is GeoElement => el instanceof GeoElement && el.isEffectivelyVisible() && (navStep === null || el.constIndex <= navStep));
    const hovered = elements.slice().reverse().find(el => el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10 / coord.xScale) as GeoPoint | undefined;
    setHoveredPoint(hovered || null);
    // 函数曲线 hover 数值提示：用 rAF 节流避免过频采样
    pendingHover.current = { screenX, screenY, worldX: x, worldY: y };
    if (hoverRAF.current === null) {
      hoverRAF.current = requestAnimationFrame(() => {
        hoverRAF.current = null;
        const pending = pendingHover.current; if (!pending) return;
        const dpr = window.devicePixelRatio || 1;
        const bounds = coord.visibleWorldBounds();
        const eps = 10 / coord.xScale;
        const functions = kernel.getConstruction().getElements().filter(el => el instanceof GeoFunction && el.isEffectivelyVisible()) as GeoFunction[];
        let bestFn: GeoFunction | null = null;
        let bestDist = Infinity;
        for (const fn of functions) {
          if (isPointOnFunction(fn, pending.worldX, pending.worldY, eps, bounds)) {
            const px = functionParameterAt(fn, pending.worldX, pending.worldY, { minX: bounds.minX, maxX: bounds.maxX, pixelWidth: Math.max(800, Math.round((bounds.maxX - bounds.minX) * coord.xScale / 2)) });
            const py = Number.isFinite(px) ? fn.evaluateAt(px) : NaN;
            const d = Math.hypot(pending.worldX - px, pending.worldY - py);
            if (d < bestDist) { bestDist = d; bestFn = fn; }
          }
        }
        if (bestFn) {
          const px = functionParameterAt(bestFn, pending.worldX, pending.worldY, { minX: bounds.minX, maxX: bounds.maxX, pixelWidth: Math.max(800, Math.round((bounds.maxX - bounds.minX) * coord.xScale / 2)) });
          const py = Number.isFinite(px) ? bestFn.evaluateAt(px) : NaN;
          setFunctionHover({ label: bestFn.label || 'y', screenX: pending.screenX, screenY: pending.screenY, worldX: px, worldY: py, value: py });
        } else {
          setFunctionHover(null);
        }
      });
    }
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
    if (draggedElement && !(draggedElement as GeoElement).isFixed) {
      if (draggedElement instanceof GeoPoint && draggedElement.isIndependent()) {
        // 首帧记录抓取偏移（此刻点尚未移动，差值 = 按下时的偏移）
        if (!dragGrabOffsetRef.current) {
          dragGrabOffsetRef.current = { x: draggedElement.getX() - x, y: draggedElement.getY() - y };
        }
        if (!multiDragRef.current) {
          // E1-3：多选拖动快照——选中集里其余可移动自由点随主点同位移；
          // E1-4 的轴向约束也以该起点为基准
          const others = selectedElements
            .filter((el): el is GeoPoint => el instanceof GeoPoint && el !== draggedElement && el.isIndependent() && !el.isFixed)
            .map(el => ({ el, x0: el.getX(), y0: el.getY() }));
          multiDragRef.current = {
            primary0: { x: draggedElement.getX() + dragGrabOffsetRef.current.x, y: draggedElement.getY() + dragGrabOffsetRef.current.y },
            items: others,
          };
        }
        let tx = x + dragGrabOffsetRef.current.x;
        let ty = y + dragGrabOffsetRef.current.y;
        const ref = multiDragRef.current;
        if (e.shiftKey && ref) {
          // E1-4：Shift 锁主轴（以拖拽起点为基准，位移大者胜出）
          const ddx = tx - ref.primary0.x, ddy = ty - ref.primary0.y;
          if (Math.abs(ddx) >= Math.abs(ddy)) ty = ref.primary0.y; else tx = ref.primary0.x;
        }
        const delta = ref ? { x: tx - ref.primary0.x, y: ty - ref.primary0.y } : { x: 0, y: 0 };
        draggedElement.setCoords(tx, ty);
        for (const item of ref?.items ?? []) {
          item.el.setCoords(item.x0 + delta.x, item.y0 + delta.y);
        }
      }
      else if (draggedElement instanceof GeoPoint && draggedElement.parentAlgo) {
        const algo = draggedElement.parentAlgo;
        if ((algo as any).updateParameter) {
          (algo as any).updateParameter(x, y);
          algo.update();
          // 输出点不是独立元素，其 setCoords 不会进 pendingUpdates；
          // 不走隐藏参数的约束算法（如 PointIn(region)）必须在这里手动重算下游，
          // 否则拖拽时挂在该点上的对象（中点、面积等）全部不动
          kernel.recomputeDependents(draggedElement);
        }
      }
      else if (
        draggedElement instanceof GeoPolygon || draggedElement instanceof GeoConic ||
        draggedElement instanceof GeoSegment || draggedElement instanceof GeoLine ||
        draggedElement instanceof GeoRay || draggedElement instanceof GeoVector ||
        draggedElement instanceof GeoFunction || draggedElement instanceof GeoText
      ) {
        const dx = x - lastMousePos.x, dy = y - lastMousePos.y;
        if (draggedElement instanceof GeoPolygon || draggedElement instanceof GeoConic) {
          (draggedElement as GeoPolygon | GeoConic).translate(new GeoVec3D(dx, dy, 0));
        } else if (draggedElement instanceof GeoText) {
          // 官方 MoveMode.TEXT：锚定文本拖拽改相对锚点偏移，自由文本改绝对位置
          const algo = draggedElement.parentAlgo;
          if (algo?.getClassName() === 'AlgoDependentText' && (algo as unknown as { anchor?: unknown }).anchor) {
            const setOff = algo as unknown as { getOffset(): [number, number]; setOffset(dx: number, dy: number): void };
            const [ox, oy] = setOff.getOffset();
            setOff.setOffset(ox + dx, oy + dy);
            algo.update();
            kernel.recomputeDependents(draggedElement);
          } else {
            draggedElement.setPosition(draggedElement.x + dx, draggedElement.y + dy);
          }
        } else if (draggedElement instanceof GeoFunction && draggedElement.parentAlgo?.getClassName() === 'AlgoDependentFunction') {
          // 官方 moveFunction：平移函数图像 = 表达式替换 x→(x−dx) 后 +dy
          //（替换复合满足结合律，逐帧增量与一次到位精确一致）。
          // 必须置于 parentAlgo 通用分支之前——函数的 parentAlgo 输入无自由点，
          // 通用分支对它是 no-op（此前此分支因外层守卫漏掉 GeoFunction 而不可达）。
          (draggedElement.parentAlgo as unknown as { translateBy(dx: number, dy: number): void }).translateBy(dx, dy);
          draggedElement.parentAlgo.update();
          kernel.recomputeDependents(draggedElement);
        } else if (draggedElement.parentAlgo) {
          // 依赖对象 = 官方 hasMoveableInputPoints 语义：搬其全部自由输入点
          draggedElement.parentAlgo.getInput().forEach(el => { if (el instanceof GeoPoint && el.isIndependent()) el.setCoords(el.getX() + dx, el.getY() + dy); }); draggedElement.parentAlgo.update();
        } else if (draggedElement instanceof GeoVector) {
          (draggedElement as GeoVector).translate(new GeoVec3D(dx, dy, 0));
        } else {
          // 独立直线（方程输入创建，无 parentAlgo）：平移方程
          (draggedElement as GeoLine).translate(new GeoVec3D(dx, dy, 0));
        }
        setLastMousePos({ x, y });
      }
      kernel.flushNow();
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      // Move 工具空白"点击"（几乎无位移）= 清选区（GeoGebra 语义：拖拽平移、单击取消选择）
      if (panFromEmptyClick.current && panStartRef.current) {
        const moved = Math.hypot(lastPanPos.x - panStartRef.current.x, lastPanPos.y - panStartRef.current.y);
        if (moved < 4) { setSelectedElements([]); setRenderRev(r => r + 1); }
      }
      panFromEmptyClick.current = false;
      panStartRef.current = null;
      return;
    }
    if (draggingUIElement) { setDraggingUIElement(null); return; }
    // 滑条拖拽收尾：值变化走 numeric 命令、位置变化走 style 命令（均可撤销）
    if (sliderValueDragRef.current) {
      const { num, oldValue } = sliderValueDragRef.current;
      sliderValueDragRef.current = null;
      notifyNumericChange(num, oldValue, num.getValue());
      return;
    }
    if (sliderMoveRef.current) {
      const ref = sliderMoveRef.current;
      sliderMoveRef.current = null;
      if (ref.moved) {
        addCommand({
          type: 'style', element: ref.num,
          before: { sliderX: ref.origX, sliderY: ref.origY },
          after: { sliderX: ref.num.sliderX, sliderY: ref.num.sliderY },
        });
      }
      return;
    }
    if (draggingLabel) {
      if (labelDragStart) {
        const moved = draggingLabel.labelOffsetX !== labelDragStart.ox || draggingLabel.labelOffsetY !== labelDragStart.oy;
        if (moved) {
          addCommand({
            type: 'style', element: draggingLabel,
            before: { labelOffsetX: labelDragStart.ox, labelOffsetY: labelDragStart.oy },
            after: { labelOffsetX: draggingLabel.labelOffsetX, labelOffsetY: draggingLabel.labelOffsetY },
          });
        }
      }
      setDraggingLabel(null); setLabelDragStart(null);
      return;
    }
    if (isBoxSelecting) {
      if (!boxStartScreen || !boxEndScreen) { cancelBoxSelect(); return; }
      const dist = Math.hypot(boxEndScreen.x - boxStartScreen.x, boxEndScreen.y - boxStartScreen.y);
      if (dist < 4) { setSelectedElements([]); cancelBoxSelect(); return; }
      const p1 = coord.screenToWorld(boxStartScreen.x, boxStartScreen.y), p2 = coord.screenToWorld(boxEndScreen.x, boxEndScreen.y);
      const rect = { minX: Math.min(p1.x, p2.x), maxX: Math.max(p1.x, p2.x), minY: Math.min(p1.y, p2.y), maxY: Math.max(p1.y, p2.y) };
      const hitElements: GeoElement[] = [];
      // 容差 eps 按像素换算成世界单位（默认 5 是世界单位，缩放下框选会抓到矩形外很远的对象）
      const marqueeEps = 5 / coord.xScale;
      for (const el of kernel.getConstruction().getElements()) {
        // getElements() 混含算法对象，isEffectivelyVisible 仅 GeoElement 有——无守卫则框选松手即 TypeError
        if (!(el instanceof GeoElement) || !el.isEffectivelyVisible()) continue;
        if (navStep !== null && el.constIndex > navStep) continue;
        if (elementIntersectsRect(el, rect, marqueeEps)) hitElements.push(el);
      }
      // Ctrl/Cmd + 框选 = 成员取反（toggle）：在框内的选中者取消，框内的未选者加入
      if (boxModifierDown.current) {
        const hitSet = new Set(hitElements);
        setSelectedElements(prev => {
          const next = new Set(prev);
          for (const el of hitElements) {
            if (next.has(el)) next.delete(el); else next.add(el);
          }
          return Array.from(next);
        });
      } else setSelectedElements(hitElements);
      cancelBoxSelect(); return;
    }
    if (draggedElement && dragStartState) {
      const newState = captureMoveState(kernel);
      if (moveStateChanged(dragStartState, newState)) {
        addCommand({ type: 'move', oldState: dragStartState, newState });
      }
    }
    setDraggedElement(null); setDragStartState(null); dragGrabOffsetRef.current = null; multiDragRef.current = null;
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
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    lastClientPosRef.current = { x: e.clientX, y: e.clientY };
    // 右键拖动平移后抑制菜单（官方 handleContextMenu 判定位移 > 阈值）
    const rect0 = canvasRef.current?.getBoundingClientRect();
    if (rightDownPosRef.current && rect0) {
      const moved = Math.hypot((e.clientX - rect0.left) - rightDownPosRef.current.x, (e.clientY - rect0.top) - rightDownPosRef.current.y);
      rightDownPosRef.current = null;
      if (moved > 6) return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = coord.screenToWorld(screenX, screenY);
    // 隐藏对象/导航未到的对象不弹菜单
    const els = kernel.getConstruction().getElements().filter((el): el is GeoElement => el instanceof GeoElement && el.isEffectivelyVisible() && (navStep === null || el.constIndex <= navStep));
    // 与左键一致：先查对象，再查标签命中（此前右键点标签直接落空白分支）
    const hit = hitScreenObject(els, world.x, world.y, coord.xScale)
      ?? hitLabel(els, world.x, world.y, coord.xScale, coord.visibleWorldBounds());
    if (!hit) {
      // 空白右键：有轨迹残影时提供清除入口（对标 GeoGebra「重新绘制所有对象」）
      const hasTraces = kernel.getConstruction().getElements().some(el => el.trace && traceRecorder.getStamps(() => true).length > 0);
      if (hasTraces) {
        setContextMenuState({
          x: screenX, y: screenY,
          items: [{
            id: 'clearTraces',
            label: t('ctxClearTraces'),
            icon: Eraser,
            onClick: () => { traceRecorder.clear(); setRenderRev(r => r + 1); },
          }],
        });
      } else setContextMenuState(null);
      return;
    }

    const items = [] as import('./ContextMenu').ContextMenuItem[];
    items.push({ id: 'delete', label: t('ctxDelete'), icon: Trash2, onClick: () => deleteWithDependents([hit]) });
    // 重定义（对标 GeoGebra ContextMenuGeoElement → Redefine）：画布内输入新定义式，
    // 代数输入的同一条重定义路径（rebuildReplace）在此复用
    // Attach/Detach（对标官方 MODE_ATTACH_DETACH 的右键路径）：附着 = 重定义为
    // PointOn（位置经 updateParameter 保持），脱离 = 重定义为同坐标自由点——
    // 两者都走 rebuildReplace，依赖者保留
    if (hit instanceof GeoPoint && hit.isIndependent()) {
      const worldHere = coord.screenToWorld(screenX, screenY);
      const pathEl = hitScreenObject(els.filter(el => el !== hit && el instanceof GeoElement && ((el as GeoElement).isOnPath?.(hit as GeoPoint, 8 / coord.xScale) || false)) as GeoElement[], worldHere.x, worldHere.y, coord.xScale)
        ?? els.find(el => el instanceof GeoElement && el !== hit && el.visible !== false && (el as GeoElement).isOnPath?.(hit as GeoPoint, 8 / coord.xScale)) as GeoElement | undefined;
      const carrier = pathEl ?? null;
      if (carrier && carrier.label) {
        items.push({
          id: 'attach',
          label: t('ctxAttach'),
          icon: Pencil,
          onClick: () => {
            try {
              const elements = parseAlgebraInput(kernel, `${hit.label} = PointOn(${carrier.label})`);
              // 位置保持：附着后把参数解到原坐标
              const algo = elements.find(el => el instanceof AlgoElement && 'updateParameter' in el) as unknown as { updateParameter(x: number, y: number): void; update(): void } | undefined;
              const pt = elements.find(el => el instanceof GeoPoint && (el as GeoPoint).label === hit.label) as GeoPoint | undefined;
              if (algo && pt) { algo.updateParameter(hit.getX(), hit.getY()); algo.update(); kernel.recomputeDependents(pt); }
              setRenderRev(r => r + 1);
            } catch (err) { alert(err instanceof Error ? err.message : String(err)); }
          },
        });
      }
    }
    if (hit instanceof GeoPoint && !hit.isIndependent() && hit.parentAlgo?.getClassName().startsWith('AlgoPointOn')) {
      items.push({
        id: 'detach',
        label: t('ctxDetach'),
        icon: Pencil,
        onClick: () => {
          try {
            const elements = parseAlgebraInput(kernel, `${hit.label} = (${hit.getX()}, ${hit.getY()})`);
            handleAlgebraElementsCreated(elements);
            setRenderRev(r => r + 1);
          } catch (err) { alert(err instanceof Error ? err.message : String(err)); }
        },
      });
    }
    items.push({
      id: 'redefine',
      label: t('ctxRedefine'),
      icon: Pencil,
      onClick: () => {
        setContextMenuState(null);
        const label = hit.label ?? '';
        const hint = hit instanceof GeoFunction ? `${label}(x) = ` : `${label} = `;
        requestTextValue(t('ctxRedefine'), hint, (raw) => {
          if (!raw || !raw.trim()) return;
          try {
            const elements = parseAlgebraInput(kernel, raw.trim());
            handleAlgebraElementsCreated(elements);
            setRenderRev(r => r + 1);
          } catch (err) {
            alert(err instanceof Error ? err.message : String(err));
          }
        });
      },
    });
    items.push({ id: 'visibility', label: t('ctxToggleVisible'), icon: hit.visible === false ? EyeOff : Eye, onClick: () => recordStyleChange(hit, { visible: hit.visible === false }) });
    items.push({ id: 'label', label: t('ctxToggleLabel'), icon: Tag, onClick: () => recordStyleChange(hit, { labelVisible: !hit.labelVisible }) });
    // ── 元能力右键项（对标 GeoGebra ContextMenuGeoElement）──
    items.push({
      id: 'fix', label: hit.isFixed ? t('ctxUnfixObject') : t('ctxFixObject'),
      icon: hit.isFixed ? Lock : LockOpen,
      onClick: () => { recordStyleChange(hit, { isFixed: !hit.isFixed }); setRenderRev(r => r + 1); },
    });
    items.push({
      id: 'trace', label: hit.trace ? t('ctxTraceOff') : t('ctxTraceOn'),
      icon: Waypoints,
      onClick: () => {
        const turningOff = hit.trace;
        recordStyleChange(hit, { trace: !hit.trace });
        if (turningOff) { traceRecorder.remove(hit.id); redrawTrace(); }
        setRenderRev(r => r + 1);
      },
    });
    items.push({
      id: 'layerUp', label: t('ctxLayerUp'), icon: ChevronsUp,
      onClick: () => { if (hit.layer < 9) { recordStyleChange(hit, { layer: hit.layer + 1 }); setRenderRev(r => r + 1); } },
    });
    items.push({
      id: 'layerDown', label: t('ctxLayerDown'), icon: ChevronsDown,
      onClick: () => { if (hit.layer > 0) { recordStyleChange(hit, { layer: hit.layer - 1 }); setRenderRev(r => r + 1); } },
    });
    // 复制对象（仅自由点/数值；派生对象无独立定义可复制）
    if (hit.isIndependent() && (hit instanceof GeoPoint || hit instanceof GeoNumeric)) {
      items.push({
        id: 'duplicate', label: t('ctxDuplicate'), icon: Copy,
        onClick: () => {
          const cons = kernel.getConstruction();
          if (hit instanceof GeoPoint) {
            const dup = new GeoPoint(kernel, new GeoVec3D(hit.getX(), hit.getY(), 1));
            dup.label = cons.getNextPointLabel();
            cons.addElement(dup);
            kernel.notifyUpdate(dup);
            addCommand({ type: 'add', elements: [dup] });
          } else {
            const dup = new GeoNumeric(kernel, hit.getValue());
            dup.intervalMin = hit.intervalMin;
            dup.intervalMax = hit.intervalMax;
            dup.label = cons.getNextNumericLabel();
            cons.addElement(dup);
            cons.updateDependentAlgorithms(dup);
            addCommand({ type: 'add', elements: [dup] });
          }
          setRenderRev(r => r + 1);
        },
      });
    }
    items.push({ id: 'rename', label: t('ctxRename'), icon: Tag, onClick: () => {
      // 重命名改画布内输入（替代 window.prompt）；查重统一在 recordRename
      requestTextValue(t('ctxRenamePrompt'), (hit as any).label || '', (raw) => {
        if (raw === null) return;
        const newName = raw.trim();
        if (!newName) { alert(t('ctxRenameEmpty')); return; }
        recordRename(hit, newName); setRenderRev(r => r + 1);
      });
    } });
    if (hit instanceof GeoFunction) {
      items.push({ id: 'pointOnCurve', label: t('ctxCreatePointOnCurve'), icon: MousePointerClick, onClick: () => setMode('point_on_object') });
    }
    if ((hit instanceof GeoNumeric || hit instanceof GeoPoint) && hit.isAnimatable()) {
      items.push({ id: 'animation', label: t('play'), icon: hit.isAnimating() ? Pause : Play, onClick: () => {
        const am = kernel.getAnimationManager();
        if (hit.isAnimating()) { hit.setAnimating(false); }
        else { hit.setAnimating(true); am.addAnimatedGeo(hit); am.startAnimation(); }
        setRenderRev(r => r + 1);
      } });
    }
    setContextMenuState({ x: e.clientX, y: e.clientY, items });
  };

  // ── 键盘缩放 / 平移（画布容器获得焦点后生效）─────────────────
  const handleCanvasKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    // 不要拦截输入框、或已被上层处理的 Escape/Delete/Enter
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    // E1-5（官方 handleArrowKeyMovement）：有选中对象时方向键微移对象而非平移视图
    //（Shift=1、Ctrl=0.01、默认 0.1 世界单位）
    if (e.key.startsWith('Arrow') && selectedElements.length > 0) {
      const movable = selectedElements.filter((el): el is GeoPoint =>
        el instanceof GeoPoint && el.isIndependent() && !el.isFixed);
      // 选中的是画布滑条 → 方向键按 increment 微调值（官方滑条键盘语义）
      const sliderNums = selectedElements.filter((el): el is GeoNumeric =>
        el instanceof GeoNumeric && el.sliderVisible);
      if (movable.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : (e.ctrlKey || e.metaKey) ? 0.01 : 0.1;
        const delta = e.key === 'ArrowLeft' ? [-step, 0]
          : e.key === 'ArrowRight' ? [step, 0]
          : e.key === 'ArrowUp' ? [0, step]
          : [0, -step];
        const before = captureMoveState(kernel);
        movable.forEach(p => p.setCoords(p.getX() + delta[0], p.getY() + delta[1]));
        kernel.flushNow();
        addCommand({ type: 'move', oldState: before, newState: captureMoveState(kernel) });
        setRenderRev(r => r + 1);
        return;
      }
      if (sliderNums.length > 0) {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1;
        const step = e.shiftKey ? 10 : 1;
        for (const num of sliderNums) {
          const oldValue = num.getValue();
          num.setValue(num.valueAtParam(num.paramOfValue() + dir * step * num.animationIncrement / Math.max(num.intervalMax - num.intervalMin, 1e-9)));
          notifyNumericChange(num, oldValue, num.getValue());
        }
        setRenderRev(r => r + 1);
        return;
      }
    }
    const res = resolveViewKey(e.key);
    if (res.kind === 'none') return;
    e.preventDefault();
    if (res.kind === 'zoom' && res.factor) zoom(res.factor);
    else if (res.kind === 'pan' && (res.dx || res.dy)) setCoord(prev => prev.panBy(res.dx || 0, res.dy || 0));
    else if (res.kind === 'reset') {
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width ?? canvasSize.width;
      const h = rect?.height ?? canvasSize.height;
      setCoord(CoordinateSystem.centered(w, h, DEFAULT_SCALE));
    }
  };

  // ─── 构建 Toolbar props ────────────────────────────────────────────
  const toolbarProps = {
    mode, setMode,
    showAxes, setShowAxes, showGrid, setShowGrid,
    view, setView,
    editingLabel, handleLabelChange, handleLabelSubmit,
    selectedElementsLength: selectedElements.length,
    options: kernel.getOptions(),
    updateOptions: (patch: Parameters<ReturnType<Kernel['getOptions']>['set']>[0]) => { kernel.getOptions().set(patch); setRenderRev(r => r + 1); },
    handleExport, handleExportPNG, handleExportSVG, fileInputRef, handleImportPick,
    snapEnabled, setSnapEnabled, toggleAnimation, isAnimating,
    navBarVisible, toggleNavBar,
    language, setLanguage, undo, redo,
    undoCount: undoStack.current.length, redoCount: redoStack.current.length,
    t,
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      {/* ── Toolbar ───────────────────────────────────────────── */}
      <Toolbar {...toolbarProps} />

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        <SidePanel kernel={kernel} panelTab={panelTab} setPanelTab={setPanelTab} selectedElements={selectedElements} coord={coord} recordStyleChange={recordStyleChange} notifyNumericChange={notifyNumericChange} renderRev={renderRev} t={t} onAlgebraElementsCreated={handleAlgebraElementsCreated} onDeleteElement={deleteWithDependents} />

        {/* Canvas Area */}
        <div
          className="flex-1 relative bg-white z-0 outline-none"
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleCanvasKeyDown}
          onMouseDown={e => { if (!e.currentTarget.contains(document.activeElement)) e.currentTarget.focus(); }}
        >
          <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-none z-[5]" style={{ touchAction: 'none', display: view === '3d' ? 'none' : undefined }} />
          <canvas ref={textOverlayRef} width={canvasSize.width} height={canvasSize.height} className="absolute inset-0 pointer-events-none z-[4]" style={{ touchAction: 'none', display: view === '3d' ? 'none' : undefined }} />
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className={`absolute top-0 left-0 ${
              isPanning ? 'cursor-grabbing'
                : mode === 'pan' ? 'cursor-grab'
                : mode === 'zoom_in' ? 'cursor-zoom-in'
                : mode === 'zoom_out' ? 'cursor-zoom-out'
                : 'cursor-crosshair'
            }`}
            style={{ touchAction: 'none', display: view === '3d' ? 'none' : undefined }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
          />

          {/* 轨迹层：trace 对象的残影（主画布之上、文本层之下，pointer-events 关闭） */}
          <canvas ref={traceCanvasRef} className="absolute inset-0 pointer-events-none z-[3]" style={{ touchAction: 'none', display: view === '3d' ? 'none' : undefined }} />

          {view === '3d' && (
            <Geometry3DView kernel={kernel} renderRev={renderRev} selectedElements={selectedElements} setSelectedElements={setSelectedElements} addCommand={addCommand} captureState={captureMoveState} showGrid={showGrid} showAxes={showAxes} setShowGrid={setShowGrid} setShowAxes={setShowAxes} />
          )}

          {view === '2d' && (
            <CanvasOverlay uiElements={uiElements} setUIElements={setUIElementsTracked} editingUIElement={editingUIElement} setEditingUIElement={setEditingUIElement} draggingUIElement={draggingUIElement} setDraggingUIElement={setDraggingUIElement} coord={coord} kernel={kernel} onBooleanToggle={handleBooleanToggle} onValueCommit={handleUIValueCommit} isDragClick={() => uiDragJustEndedRef.current} />
          )}

          {/* 画布内数值/文本输入浮层（去 prompt 化） */}
          {valueRequest && (
            <CanvasValueInput request={valueRequest} onClose={handleValueClosed} ignorePointerDownRef={containerRef} t={t} />
          )}

          {/* Hover tooltip for function curves */}
          {view === '2d' && functionHover && (
            <HoverTooltip
              data={{
                label: functionHover.label,
                x: functionHover.worldX,
                y: functionHover.value,
                screenX: functionHover.screenX,
                screenY: functionHover.screenY,
                text: formatHover(functionHover.label, functionHover.worldX, functionHover.value),
              }}
            />
          )}

          {/* Zoom Controls */}
          {view === '2d' && (
            <div className="absolute bottom-8 right-6 flex flex-col shadow-lg rounded-lg overflow-hidden border border-gray-200 bg-white">
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-100" onClick={() => zoom(1.2)} title={t('zoomIn')}><ZoomIn size={20} /></button>
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-100" onClick={() => zoom(1 / 1.2)} title={t('zoomOut')}><ZoomOut size={20} /></button>
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-100" onClick={zoomToFit} title={t('zoomToFit')}><Maximize size={20} /></button>
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors" onClick={() => { const rect = containerRef.current?.getBoundingClientRect(); setCoord(CoordinateSystem.centered(rect?.width ?? canvasSize.width, rect?.height ?? canvasSize.height, DEFAULT_SCALE)); }} title={t('resetView')}><Home size={20} /></button>
            </div>
          )}

          {/* 构造步骤导航条 */}
          {view === '2d' && navBarVisible && (
            <ConstructionNavBar
              step={navStep ?? navTotal}
              total={navTotal}
              playing={navPlaying}
              onStep={step => setNavStep(step)}
              onTogglePlay={() => setNavPlaying(p => !p)}
              onClose={toggleNavBar}
              t={t}
            />
          )}

          {/* Tool hint bar */}
          {view === '2d' && <ToolHintBar mode={mode} />}
        </div>
      </div>

      {/* Right-click context menu (fixed at viewport coordinates) */}
      <ContextMenu state={contextMenuState} onClose={() => setContextMenuState(null)} />
    </div>
  );
};
