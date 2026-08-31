import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRenderLoop } from '../hooks/useRenderLoop';
import { Kernel } from '../kernel/core/Kernel';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoConic } from '../kernel/geo/GeoConic';
import { elementIntersectsRect } from '../kernel/view/BoundingBoxHelper';
import { applySnap, SNAP_POINT_RADIUS, calculateGridStep } from '../kernel/core/Snap';
import { SvgRenderer } from '../kernel/view/SvgRenderer';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { AlgoMidpoint } from '../kernel/algo/AlgoMidpoint';
import { AlgoLineTwoPoints } from '../kernel/algo/AlgoLineTwoPoints';
import { AlgoSegmentTwoPoints } from '../kernel/algo/AlgoSegmentTwoPoints';
import { AlgoCirclePointRadius } from '../kernel/algo/AlgoCirclePointRadius';
import { AlgoCircleCenterPoint } from '../kernel/algo/AlgoCircleCenterPoint';
import { AlgoCircleThreePoints } from '../kernel/algo/AlgoCircleThreePoints';
import { AlgoCircleCenter } from '../kernel/algo/AlgoCircleCenter';
import { AlgoIntersect } from '../kernel/algo/AlgoIntersect';
import { AlgoParallelLine } from '../kernel/algo/AlgoParallelLine';
import { AlgoOrthogonalLine } from '../kernel/algo/AlgoOrthogonalLine';
import { AlgoPerpendicularBisector } from '../kernel/algo/AlgoPerpendicularBisector';
import { AlgoDistance } from '../kernel/algo/AlgoDistance';
import { AlgoAngle } from '../kernel/algo/AlgoAngle';
import { AlgoArea } from '../kernel/algo/AlgoArea';
import { AlgoAngleBisector } from '../kernel/algo/AlgoAngleBisector';
import { AlgoTangent } from '../kernel/algo/AlgoTangent';
import { AlgoLocus } from '../kernel/algo/AlgoLocus';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoLocus } from '../kernel/geo/GeoLocus';

import { AlgoPointOnConic } from '../kernel/algo/AlgoPointOnConic';
import { AlgoPointOnLine } from '../kernel/algo/AlgoPointOnLine';
import { AlgoPointOnSegment } from '../kernel/algo/AlgoPointOnSegment';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { CoordinateSystem } from '../kernel/core/CoordinateSystem';
import { IRenderer } from '../kernel/view/IRenderer';
import { createRenderer } from '../kernel/view/WebGLRendererFallback';
import { serialize as serializeConstruction, deserialize as deserializeConstruction, downloadJSON } from '../kernel/persistence/ConstructionSerializer';
import { SliderControl } from './SliderControl';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  MousePointer2, CircleDot, Minus, TrendingUp, Circle, 
  CircleDashed, Target, X, Crosshair, Equal, Baseline, 
  SplitSquareVertical, Scissors, Hexagon, Undo2, Redo2, 
  Play, Pause, ZoomIn, ZoomOut, Home, Globe, Menu, ChevronDown,
  Grid3X3, Axis3D, ChevronUp, Type, Sliders, ToggleLeft, CheckSquare,
  Ruler,
  Triangle,
  Square,
  CornerDownRight,
  Download,
  Activity,
  Plus
} from 'lucide-react';

interface StateSnapshot {
  coords: Map<string, {x: number, y: number, z: number}>;
  numerics: Map<string, number>;
}

type Command =
  | { type: 'add', elements: ConstructionElement[] }
  | { type: 'delete', elements: ConstructionElement[] }
  | { type: 'move', oldState: StateSnapshot, newState: StateSnapshot }
  | { type: 'style', element: GeoElement, before: Record<string, unknown>, after: Record<string, unknown> }
  | { type: 'numeric', element: GeoNumeric, oldValue: number, newValue: number }
  | { type: 'rename', element: ConstructionElement, oldLabel: string, newLabel: string };

interface UIElement {
  id: string;
  type: 'text' | 'slider' | 'button' | 'checkbox';
  x: number;
  y: number;
  label?: string;
  value?: any;
  min?: number;
  max?: number;
  step?: number;
  checked?: boolean;
}

const captureState = (kernel: Kernel): StateSnapshot => {
  const coords = new Map();
  const numerics = new Map();
  kernel.getConstruction().getElements().forEach(el => {
    if (el instanceof GeoPoint && el.isIndependent()) {
      coords.set(el.id, { x: el.getX(), y: el.getY(), z: el.getZ() });
    } else if (el instanceof GeoNumeric) {
      numerics.set(el.id, el.getValue());
    }
  });
  return { coords, numerics };
};

export const GeometryCanvas: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kernel] = useState(() => new Kernel());
  const [mode, setMode] = useState<'move' | 'point' | 'line' | 'segment' | 'midpoint' | 'circle' | 'circle_center_point' | 'circle3' | 'intersect' | 'parallel' | 'orthogonal' | 'perpendicular_bisector' | 'angle_bisector' | 'polygon' | 'text' | 'slider' | 'button' | 'checkbox' | 'distance' | 'angle' | 'area' | 'tangent' | 'locus'>('move');
  const [polygonPoints, setPolygonPoints] = useState<GeoPoint[]>([]);
  const [radius, setRadius] = useState<number>(50);
  const [selectedElements, setSelectedElements] = useState<GeoElement[]>([]);
  const [editingLabel, setEditingLabel] = useState<string>('');

  useEffect(() => {
    // 删除多边形绘制过程中创建的点
    const pointsToDelete = [...polygonPoints];
    if (pointsToDelete.length > 0) {
      pointsToDelete.forEach(point => {
        kernel.getConstruction().removeElement(point);
      });
      kernel.getConstruction().updateAllAlgorithms();
      setRenderRev(r => r + 1);
    }
    
    setSelectedElements([]);
    setPolygonPoints([]);
    cancelBoxSelect();
  }, [mode]);

  useEffect(() => {
    if (selectedElements.length === 1) {
      setEditingLabel(selectedElements[0].label);
    } else {
      setEditingLabel('');
    }
  }, [selectedElements]);

  /** P1-3: 数值变化的撤销入口（拖动滑块时由 SliderControl 注入） */
  const notifyNumericChange = useCallback((numeric: GeoNumeric, newValue: number) => recordNumericChange(numeric, newValue), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRenderer(createRenderer(canvas, true));
    return () => setRenderer(null);
  }, []);

  /** P2: 清空框选状态并擦除选择框 */
  const cancelBoxSelect = useCallback(() => {
    setIsBoxSelecting(false);
    setBoxStartScreen(null);
    setBoxEndScreen(null);
    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      ctx.clearRect(0, 0, w, h);
    }
  }, []);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingLabel(e.target.value);
  };

  /** P1-3: 标签编辑提交时记录 rename 命令 */
  const handleLabelSubmit = () => {
    if (selectedElements.length === 1) {
      if (editingLabel.trim() !== '') {
        recordRename(selectedElements[0], editingLabel.trim());
        setRenderRev(r => r + 1);
      } else {
        setEditingLabel(selectedElements[0].label);
      }
    }
  };

  const [draggedElement, setDraggedElement] = useState<GeoElement | null>(null);
  const [renderRev, setRenderRev] = useState(0); // RAF 渲染节流信号
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<GeoPoint | null>(null);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [renderer, setRenderer] = useState<IRenderer | null>(null);
  const [overlayCanvasRef] = useState(React.createRef<HTMLCanvasElement>());
  
  const [coord, setCoord] = useState<CoordinateSystem>(() => CoordinateSystem.centered(800, 600, 1));
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
  
  const [showAxes, setShowAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showCircleMenu, setShowCircleMenu] = useState(false);
  const circleMenuRef = useRef<HTMLButtonElement>(null);
  const [circleMenuPosition, setCircleMenuPosition] = useState({ top: 0, left: 0 });
  
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const insertMenuRef = useRef<HTMLButtonElement>(null);
  const [insertMenuPosition, setInsertMenuPosition] = useState({ top: 0, left: 0 });
  
  const [uiElements, setUIElements] = useState<UIElement[]>([]);
  const [editingUIElement, setEditingUIElement] = useState<string | null>(null);
  const [draggingUIElement, setDraggingUIElement] = useState<string | null>(null);

  // --- P2: 多选 / 框选 ---
  const boxModifierDown = useRef(false);

  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStartScreen, setBoxStartScreen] = useState<{x: number; y: number} | null>(null);
  const [boxEndScreen, setBoxEndScreen] = useState<{x: number; y: number} | null>(null);

  // --- P2: 吸附（网格 / 点）---
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToPoint, setSnapToPoint] = useState(true);
  const [panelTab, setPanelTab] = useState<'algebra' | 'properties'>('algebra');

  const undoStack = useRef<Command[]>([]);
  const redoStack = useRef<Command[]>([]);
  const [dragStartState, setDragStartState] = useState<StateSnapshot | null>(null);

  const addCommand = (cmd: Command) => {
    undoStack.current.push(cmd);
    redoStack.current = [];
    setRenderRev(r => r + 1);
  };

  /** P1-3: 记录数值参数的变化 */
  const recordNumericChange = (numeric: GeoNumeric, newValue: number) => {
    const oldValue = numeric.getValue();
    if (oldValue !== newValue) {
      addCommand({ type: 'numeric', element: numeric, oldValue, newValue });
    }
  };

  /** P1-3: 记录重命名操作 */
  const recordRename = (element: ConstructionElement, newLabel: string) => {
    const oldLabel = ((element as any).label || '');
    if (oldLabel !== newLabel) {
      (element as any).label = newLabel;
      addCommand({ type: 'rename', element, oldLabel, newLabel });
    }
  };

  /** P2-1: 将样式字段快照为 plain object */
  const snapshotStyle = (el: GeoElement): Record<string, unknown> => ({
    strokeColor: el.strokeColor,
    strokeWidth: el.strokeWidth,
    strokeDash: el.strokeDash ? [...el.strokeDash] : [],
    fillColor: el.fillColor,
    labelVisible: el.labelVisible,
    labelMode: el.labelMode,
  });

  /** P2-1: 把变化直接写回元素（undo/redo 专用，不走 addCommand） */
  const applyStyleDirectly = (el: GeoElement, changes: Record<string, unknown>) => {
    if ('strokeColor' in changes) el.strokeColor = changes.strokeColor as string | null;
    if ('strokeWidth' in changes) el.strokeWidth = changes.strokeWidth as number | null;
    if ('strokeDash' in changes) el.strokeDash = changes.strokeDash ? [...(changes.strokeDash as number[])] : null;
    if ('fillColor' in changes) el.fillColor = changes.fillColor as string | null;
    if ('labelVisible' in changes) el.labelVisible = changes.labelVisible as boolean;
    if ('labelMode' in changes) el.labelMode = changes.labelMode as 'always' | 'mouse' | 'never';
  };

  /** P2-1: 记录样式修改命令（供 undo/redo）*/
  const recordStyleChange = (element: GeoElement, changes: Record<string, unknown>) => {
    applyStyleDirectly(element, changes);
    addCommand({ type: 'style', element, before: snapshotStyle(element), after: { ...changes } });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** P1-3: 删除元素及其全部依赖，并记录 'delete' 命令 */
  const deleteWithDependents = (els: ConstructionElement[]) => {
    if (els.length === 0) return;
    const construction = kernel.getConstruction();
    const cascade = new Set<ConstructionElement>();
    for (const el of els) {
      for (const c of construction.collectDeletionCascade(el)) cascade.add(c);
      construction.deleteElementWithDependents(el);
    }
    addCommand({ type: 'delete', elements: Array.from(cascade).sort((a, b) => a.constIndex - b.constIndex) });
    setSelectedElements([]);
    setRenderRev(r => r + 1);
  };

  const handleExport = () => {
    try {
      downloadJSON('minigeogebra-construction.json', serializeConstruction(kernel, coord));
    } catch (err) {
      console.error('[export failed]', err);
      alert('导出失败，请查看控制台');
    }
  };

  /** 下载任意文件 */
  const downloadFile = (content: string, filename: string, type?: string) => {
    const blob = new Blob([content], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** 导出为 PNG */
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadFile(canvas.toDataURL('image/png'), `minigeogebra-${Date.now()}.png`, 'image/png');
  };

  /** 导出为 SVG */
  const handleExportSVG = () => {
    try {
      const svgR = new SvgRenderer();
      const bounds = coord.visibleWorldBounds();
      _renderToSvg(svgR, bounds);
      const svgStr = svgR.toSvgString(bounds);
      downloadFile(svgStr, `minigeogebra-${Date.now()}.svg`, 'image/svg+xml');
    } catch (err) {
      console.error('[svg export failed]', err);
      alert('SVG 导出失败，请查看控制台');
    }
  };

  /** 把当前构造以世界坐标重绘到 SVG 后端 */
  const _renderToSvg = (renderer: IRenderer, bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
    const viewBoxW = (bounds.maxX - bounds.minX) * coord.xScale;
    const viewBoxH = (bounds.maxY - bounds.minY) * coord.xScale;
    drawGrid(renderer, viewBoxW, viewBoxH, coord, showGrid, showAxes);
    const elements = kernel.getConstruction().getElements();
    elements.forEach(el => { if (el instanceof GeoPolygon) drawPolygon(renderer, el, false, coord.xScale); });
    elements.forEach(el => { if (el instanceof GeoConic) drawConic(renderer, el, false, coord.xScale); });
    elements.forEach(el => { if (el instanceof GeoLocus) drawLocus(renderer, el, false, coord.xScale); });
    elements.forEach(el => {
      if (el instanceof GeoSegment) drawSegment(renderer, el, false, coord.xScale);
      else if (el instanceof GeoLine && !(el instanceof GeoSegment)) drawLine(renderer, el, false, coord, viewBoxW, viewBoxH);
    });
    elements.forEach(el => { if (el instanceof GeoPoint) drawPoint(renderer, el, false, coord.xScale); });
  };

  const handleImportPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = typeof ev.target?.result === 'string' ? ev.target.result : '';
        if (!text.trim()) return;
        const { coord: restored } = deserializeConstruction(kernel, text);
        if (restored) setCoord(restored);
        setSelectedElements([]);
        setPolygonPoints([]);
        setRenderRev(r => r + 1);
      } catch (err) {
        console.error('[import failed]', err);
        alert('导入失败：文件格式不正确');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const isAnimating = kernel.getAnimationManager().isRunning();

  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      setCanvasSize({
        width: width * dpr,
        height: height * dpr
      });

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      // 画布尺寸改变时，让可见世界范围保持稳定
      setCoord(c => c.setSize(width, height));
      setRenderRev(r => r + 1);
    };

    window.addEventListener('resize', updateSize);
    updateSize();

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.circle-menu-container')) {
        setShowCircleMenu(false);
      }
    };

    if (showCircleMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCircleMenu]);

  useEffect(() => {
    if (showCircleMenu && circleMenuRef.current) {
      const rect = circleMenuRef.current.getBoundingClientRect();
      setCircleMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [showCircleMenu]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.insert-menu-container')) {
        setShowInsertMenu(false);
      }
    };

    if (showInsertMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInsertMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          
          // 删除多边形绘制过程中创建的点
          if (polygonPoints.length > 0) {
            polygonPoints.forEach(point => {
              kernel.getConstruction().removeElement(point);
            });
            kernel.getConstruction().updateAllAlgorithms();
          }
          
          setMode('move');
          setSelectedElements([]);
          setPolygonPoints([]);
          cancelBoxSelect();
          setRenderRev(r => r + 1);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElements.length > 0 && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          deleteWithDependents(selectedElements);
        }
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setSnapEnabled(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElements, kernel, polygonPoints]);

  useEffect(() => {
    if (showInsertMenu && insertMenuRef.current) {
      const rect = insertMenuRef.current.getBoundingClientRect();
      setInsertMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [showInsertMenu]);

  useEffect(() => {
    // Initial setup for demo
    const construction = kernel.getConstruction();
    
    // Create some initial objects if empty
    if (construction.getElements().length === 0) {
      const p1 = new GeoPoint(kernel, new GeoVec3D(100, 100, 1));
      p1.label = "A";
      const p2 = new GeoPoint(kernel, new GeoVec3D(300, 100, 1));
      p2.label = "B";
      const p3 = new GeoPoint(kernel, new GeoVec3D(200, 300, 1));
      p3.label = "C";

      construction.addElement(p1);
      construction.addElement(p2);
      construction.addElement(p3);

      const segmentAlgo = new AlgoSegmentTwoPoints(kernel, p1, p2);
      const segment = segmentAlgo.getOutput();
      segment.label = kernel.getConstruction().getNextLineLabel();
      construction.addElement(segmentAlgo);
      construction.addElement(segment);

      const poly = new GeoPolygon(kernel, [p1, p2, p3]);
      poly.label = kernel.getConstruction().getNextPolygonLabel();
      construction.addElement(poly);

      const mid = new AlgoMidpoint(kernel, p1, p3);
      construction.addElement(mid);
      construction.addElement(mid.getOutput());
      mid.update(); // Ensure computed

      // Animation Demo Setup
      const num = new GeoNumeric(kernel, 0);
      num.label = "t";
      num.setAnimating(true);
      construction.addElement(num);

      const center = new GeoPoint(kernel, new GeoVec3D(500, 300, 1));
      center.label = "Center";
      construction.addElement(center);

      const circle = new AlgoCirclePointRadius(kernel, center, 100);
      construction.addElement(circle);
      construction.addElement(circle.getOutput());
      circle.update();

      const pointOnCircle = new AlgoPointOnConic(kernel, circle.getOutput(), num);
      construction.addElement(pointOnCircle);
      construction.addElement(pointOnCircle.getOutput());
      pointOnCircle.update();
    }

    kernel.setUpdateCallback(() => {
      setRenderRev(r => r + 1);
    });
  }, [kernel]);

  const toggleAnimation = () => {
    const am = kernel.getAnimationManager();
    if (am.isRunning()) {
      am.stopAnimation();
    } else {
      am.startAnimation();
    }
    setRenderRev(r => r + 1);
  };

  const { schedule } = useRenderLoop(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderer) return;
    renderer.viewportSize(canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;

    // Clear canvas
    renderer.clearRect(0, 0, canvas.width, canvas.height);

    renderer.save();
    renderer.scale(dpr, dpr);
    renderer.translate(coord.xZero, coord.yZero);
    renderer.scale(coord.xScale, coord.yScale);

    // Draw grid
    drawGrid(renderer, canvas.width / dpr, canvas.height / dpr, coord, showGrid, showAxes);

    // Draw elements
    const elements = kernel.getConstruction().getElements();
    
    // Draw polygons first (fill)
    elements.forEach(el => {
      if (el instanceof GeoPolygon) {
        drawPolygon(renderer, el, selectedElements.includes(el), coord.xScale);
      }
    });

    // Draw conics (circles)
    elements.forEach(el => {
      if (el instanceof GeoConic) {
        drawConic(renderer, el, selectedElements.includes(el), coord.xScale);
      }
    });

    // Draw locus curves
    elements.forEach(el => {
      if (el instanceof GeoLocus) {
        drawLocus(renderer, el, selectedElements.includes(el), coord.xScale);
      }
    });

    // Draw lines and segments
    elements.forEach(el => {
      if (el instanceof GeoSegment) {
        drawSegment(renderer, el, selectedElements.includes(el), coord.xScale);
      } else if (el instanceof GeoLine && !(el instanceof GeoSegment)) {
        drawLine(renderer, el, selectedElements.includes(el), coord);
      }
    });

    // Draw polygon being created
    if (mode === 'polygon' && polygonPoints.length > 0) {
        renderer.strokeStyle = '#9ca3af'; // gray-400
        renderer.lineWidth = 1 / coord.xScale;
        renderer.setLineDash([5 / coord.xScale, 5 / coord.xScale]);
        renderer.beginPath();
        renderer.moveTo(polygonPoints[0].getX(), polygonPoints[0].getY());
        for (let i = 1; i < polygonPoints.length; i++) {
            renderer.lineTo(polygonPoints[i].getX(), polygonPoints[i].getY());
        }
        // Draw line to mouse
        renderer.lineTo(mousePos.x, mousePos.y);
        renderer.stroke();
        renderer.setLineDash([]);
    }

    // Draw Previews
    renderer.save();
    renderer.strokeStyle = 'rgba(100, 100, 100, 0.5)';
    renderer.setLineDash([5 / coord.xScale, 5 / coord.xScale]);
    renderer.lineWidth = 1 / coord.xScale;
    
    const targetX = hoveredPoint ? hoveredPoint.getX() : mousePos.x;
    const targetY = hoveredPoint ? hoveredPoint.getY() : mousePos.y;

    if (mode === 'segment' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
        const p1 = selectedElements[0] as GeoPoint;
        renderer.beginPath();
        renderer.moveTo(p1.getX(), p1.getY());
        renderer.lineTo(targetX, targetY);
        renderer.stroke();
    } else if (mode === 'line' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
        const p1 = selectedElements[0] as GeoPoint;
        // Draw line through p1 and target
        const dx = targetX - p1.getX();
        const dy = targetY - p1.getY();
        if (Math.hypot(dx, dy) > 1 / coord.xScale) {
            renderer.beginPath();
            renderer.moveTo(p1.getX() - 10000 * dx, p1.getY() - 10000 * dy);
            renderer.lineTo(p1.getX() + 10000 * dx, p1.getY() + 10000 * dy);
            renderer.stroke();
        }
    } else if (mode === 'circle') {
        // Preview circle with radius
        renderer.beginPath();
        renderer.arc(targetX, targetY, radius, 0, 2 * Math.PI);
        renderer.stroke();
    } else if (mode === 'circle_center_point' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
        // Preview circle with center at selected point and radius to target
        const center = selectedElements[0] as GeoPoint;
        const r = Math.hypot(targetX - center.getX(), targetY - center.getY());
        renderer.beginPath();
        renderer.arc(center.getX(), center.getY(), r, 0, 2 * Math.PI);
        renderer.stroke();
    } else if (mode === 'circle3' && selectedElements.length === 2) {
        // Preview circle through two points and mouse position
        const [p1, p2] = selectedElements as GeoPoint[];
        const p3 = { x: targetX, y: targetY };
        
        // Calculate circumcenter from three points
        const ax = p1.getX(), ay = p1.getY();
        const bx = p2.getX(), by = p2.getY();
        const cx = p3.x, cy = p3.y;
        
        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(d) > 1e-10) {
            const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
            const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
            const r = Math.hypot(ux - ax, uy - ay);
            
            // Draw preview circle
            renderer.beginPath();
            renderer.arc(ux, uy, r, 0, 2 * Math.PI);
            renderer.stroke();
            
            // Draw preview center point
            renderer.beginPath();
            renderer.arc(ux, uy, 3 / coord.xScale, 0, 2 * Math.PI);
            renderer.fillStyle = 'rgba(100, 100, 100, 0.5)';
            renderer.fill();
        }
    } else if ((mode === 'parallel' || mode === 'orthogonal') && selectedElements.length === 1 && selectedElements[0] instanceof GeoLine) {
         // Preview line through mouse
         const l = selectedElements[0] as GeoLine;
         let a = l.a, b = l.b;
         if (mode === 'orthogonal') {
             const temp = a; a = -b; b = temp;
         }
         // Line through mouse(mx, my) with normal (a, b)
         // a(x - mx) + b(y - my) = 0 => ax + by = a*mx + b*my
         const c = -(a * targetX + b * targetY);
         
         const bounds = coord.visibleWorldBounds();
         const startX = bounds.minX;
         const endX = bounds.maxX;
         const startY = bounds.minY;
         const endY = bounds.maxY;

         // Draw this line
         if (Math.abs(b) > 1e-6) {
            const y1 = (-c - a * startX) / b;
            const y2 = (-c - a * endX) / b;
            renderer.beginPath();
            renderer.moveTo(startX, y1);
            renderer.lineTo(endX, y2);
            renderer.stroke();
         } else {
            const x = -c / a;
            renderer.beginPath();
            renderer.moveTo(x, startY);
            renderer.lineTo(x, endY);
            renderer.stroke();
         }
    } else if (mode === 'perpendicular_bisector' && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
        // Preview perpendicular bisector through midpoint
        const p1 = selectedElements[0] as GeoPoint;
        const mx = (p1.getX() + targetX) / 2;
        const my = (p1.getY() + targetY) / 2;
        
        // Vector from p1 to target
        const a = targetX - p1.getX();
        const b = targetY - p1.getY();
        
        // Line through M with normal (a, b)
        const c = -(a * mx + b * my);
        
        const bounds = coord.visibleWorldBounds();
        const startX = bounds.minX;
        const endX = bounds.maxX;
        const startY = bounds.minY;
        const endY = bounds.maxY;

        if (Math.abs(b) > 1e-6) {
            const y1 = (-c - a * startX) / b;
            const y2 = (-c - a * endX) / b;
            renderer.beginPath();
            renderer.moveTo(startX, y1);
            renderer.lineTo(endX, y2);
            renderer.stroke();
        } else {
            const x = -c / a;
            renderer.beginPath();
            renderer.moveTo(x, startY);
            renderer.lineTo(x, endY);
            renderer.stroke();
        }
        
        // Draw midpoint preview
        renderer.beginPath();
        renderer.arc(mx, my, 3 / coord.xScale, 0, 2 * Math.PI);
        renderer.fillStyle = 'rgba(100, 100, 100, 0.5)';
        renderer.fill();
    } else if (mode === 'angle_bisector' && selectedElements.length >= 1 && selectedElements.length < 3) {
        if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
            // Need two more points - just show line from first point to mouse
            const p1 = selectedElements[0] as GeoPoint;
            renderer.beginPath();
            renderer.moveTo(p1.getX(), p1.getY());
            renderer.lineTo(targetX, targetY);
            renderer.stroke();
        } else if (selectedElements.length === 2 && selectedElements[0] instanceof GeoPoint && selectedElements[1] instanceof GeoPoint) {
            // Have A and B, preview angle bisector with C at mouse position
            const [A, B] = selectedElements as GeoPoint[];
            const C = { x: targetX, y: targetY };
            
            const bx = B.getX();
            const by = B.getY();
            
            // Vector BA
            const bax = A.getX() - bx;
            const bay = A.getY() - by;
            const lenBA = Math.hypot(bax, bay);
            
            // Vector BC
            const bcx = C.x - bx;
            const bcy = C.y - by;
            const lenBC = Math.hypot(bcx, bcy);
            
            if (lenBA > 1e-9 && lenBC > 1e-9) {
                // Normalized vectors
                const uX = bax / lenBA;
                const uY = bay / lenBA;
                const vX = bcx / lenBC;
                const vY = bcy / lenBC;
                
                // Bisector direction vector w = u + v
                const wX = uX + vX;
                const wY = uY + vY;
                
                let nx, ny;
                
                if (Math.hypot(wX, wY) < 1e-9) {
                    nx = uX;
                    ny = uY;
                } else {
                    nx = -wY;
                    ny = wX;
                }
                
                const c = -(nx * bx + ny * by);
                
                const bounds = coord.visibleWorldBounds();
                const startX = bounds.minX;
                const endX = bounds.maxX;
                const startY = bounds.minY;
                const endY = bounds.maxY;
                
                if (Math.abs(ny) > 1e-6) {
                    const y1 = (-c - nx * startX) / ny;
                    const y2 = (-c - nx * endX) / ny;
                    renderer.beginPath();
                    renderer.moveTo(startX, y1);
                    renderer.lineTo(endX, y2);
                    renderer.stroke();
                } else {
                    const x = -c / nx;
                    renderer.beginPath();
                    renderer.moveTo(x, startY);
                    renderer.lineTo(x, endY);
                    renderer.stroke();
                }
            }
        }
    }
    
    renderer.restore();

    // Draw points last
    elements.forEach(el => {
      if (el instanceof GeoPoint) {
        drawPoint(renderer, el, selectedElements.includes(el), coord.xScale);
      }
    });

    renderer.restore(); // Restore the global transform

    renderer.frameCommit();

  }, [renderRev, selectedElements, mousePos, mode, polygonPoints, radius, hoveredPoint, coord, showGrid, showAxes, renderer]);

  useEffect(() => {
    schedule(); // 首帧立即绘制
  }, [schedule]);

  const drawConic = (renderer: IRenderer, c: GeoConic, selected: boolean, scale: number) => {
    if (!c.isDefined()) return;
    // Only circles for now
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
    
    // P2-1: 读取用户自定义颜色/线宽，未设置则回退到类型默认值
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
  };

  const drawGrid = (renderer: IRenderer, w: number, h: number, coord: CoordinateSystem, showGrid: boolean, showAxes: boolean) => {
    const startX = coord.screenToWorldX(0);
    const endX = coord.screenToWorldX(w);
    const startY = coord.screenToWorldY(0);
    const endY = coord.screenToWorldY(h);
    
    // Calculate a nice step size
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
    
    // Draw grid
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
    
    // Draw axes
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

      // Draw numbers
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
      
      // Origin
      renderer.textAlign = 'right';
      renderer.textBaseline = 'top';
      renderer.fillText('0', -4 / coord.xScale, 4 / coord.xScale);
    }
  };

  const drawPoint = (renderer: IRenderer, p: GeoPoint, selected: boolean, scale: number) => {
    if (!p.isDefined()) return;
    const x = p.getX();
    const y = p.getY();
    
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
    
    // P2-1: 本体色优先用用户设置（未设置：独立点蓝、派生点灰）
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
    
    const labelOffsetX = 15;
    const labelOffsetY = -15;
    const labelX = x + labelOffsetX;
    const labelY = y + labelOffsetY;
    
    renderer.fillStyle = selected ? '#1e40af' : '#1f2937';
    renderer.textBaseline = 'bottom';
    renderer.fillText(label, labelX, labelY);
  };

  const drawLine = (renderer: IRenderer, l: GeoLine, selected: boolean, coord: CoordinateSystem, wPx?: number, hPx?: number) => {
    if (!l.isDefined()) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const w = wPx ?? canvas.width / dpr;
    const h = hPx ?? canvas.height / dpr;
    
    const startX = coord.screenToWorldX(0);
    const endX = coord.screenToWorldX(w);
    const startY = coord.screenToWorldY(0);
    const endY = coord.screenToWorldY(h);

    // P2-1: 直线样式可从元素读取（默认 #000）
    const stroke = l.strokeColor ?? l.defaultStrokeColor;
    const baseWidth = l.strokeWidth ?? l.defaultLineWidth;
    renderer.strokeStyle = selected ? '#3b82f6' : stroke;
    renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / coord.xScale;
    renderer.beginPath();

    if (Math.abs(l.b) > 1e-6) {
      const y1 = (-l.c - l.a * startX) / l.b;
      const y2 = (-l.c - l.a * endX) / l.b;
      renderer.moveTo(startX, y1);
      renderer.lineTo(endX, y2);
    } else {
      const x = -l.c / l.a;
      renderer.moveTo(x, startY);
      renderer.lineTo(x, endY);
    }
    renderer.stroke();
  };

  const drawSegment = (renderer: IRenderer, s: GeoSegment, selected: boolean, scale: number) => {
    if (!s.isDefined()) return;
    // P2-1: 线段样式可从元素读取
    const stroke = s.strokeColor ?? s.defaultStrokeColor;
    const baseWidth = s.strokeWidth ?? s.defaultLineWidth;
    renderer.strokeStyle = selected ? '#3b82f6' : stroke;
    renderer.lineWidth = (selected ? baseWidth * 2 : baseWidth) / scale;
    renderer.beginPath();
    renderer.moveTo(s.startPoint.getX(), s.startPoint.getY());
    renderer.lineTo(s.endPoint.getX(), s.endPoint.getY());
    renderer.stroke();
  };

  const drawPolygon = (renderer: IRenderer, poly: GeoPolygon, selected: boolean, scale: number) => {
    if (!poly.isDefined()) return;
    if (poly.vertices.length < 3) return;
    // P2-1: 填充优先读 fillColor（未设置则用默认蓝半透明），描边读 strokeColor
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
  };

  const drawLocus = (renderer: IRenderer, locus: GeoLocus, selected: boolean, scale: number) => {
    if (!locus.isDefined()) return;
    const samples = locus.getSamples();
    const segments = locus.getSegments();
    if (samples.length < 2 || segments.length === 0) return;
    // P2-1: 轨迹颜色可从元素读取（默认 #8b5cf6）
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
  };

  /** P2: 获取鼠标原始屏幕坐标 */
  const getScreenPos = (e: React.MouseEvent | React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { screenX: e.clientX - rect.left, screenY: e.clientY - rect.top };
  };

  /** P2: 当前缩放对应的网格步长 */
  const getGridStep = () => calculateGridStep(coord.xScale);

  const getMousePos = (e: React.MouseEvent | React.WheelEvent, useSnap: boolean = false): { screenX: number; screenY: number; x: number; y: number } => {
    const { screenX, screenY } = getScreenPos(e);
    const world = coord.screenToWorld(screenX, screenY);
    let { x, y } = world;
    if (useSnap && snapEnabled) {
      const snapRadius = SNAP_POINT_RADIUS / coord.xScale;
      const snapped = applySnap(x, y, snapRadius, snapToGrid, snapToPoint,
        kernel.getConstruction().getElements().filter(e => e instanceof GeoPoint) as GeoPoint[], getGridStep());
      x = snapped.x;
      y = snapped.y;
    }
    return { screenX, screenY, x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { screenX, screenY, x, y } = getMousePos(e);
    
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setLastPanPos({ x: screenX, y: screenY });
      return;
    }
    
    const elementsBefore = kernel.getConstruction().getElements().length;
    const currentDragStartState = captureState(kernel);
    setDragStartState(currentDragStartState);
    
    setLastMousePos({ x, y });
    const elements = kernel.getConstruction().getElements();
    
    // Find clicked point
    // Reverse order to pick top-most
    const clickedPoint = elements.slice().reverse().find(el => 
      el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10 / coord.xScale
    ) as GeoPoint | undefined;

    if (mode === 'move') {
      // 命中测试：优先命中点，再命中其他几何对象
      let clickedObj: GeoElement | undefined;
      if (!clickedPoint) {
        clickedObj = elements.slice().reverse().find(el => {
            if (el instanceof GeoSegment) {
                return (el as any).isOnPath({ getX: () => x, getY: () => y }, 5 / coord.xScale);
            } else if (el instanceof GeoLine) {
                const len = Math.hypot(el.a, el.b);
                if (len === 0) return false;
                const d = Math.abs(el.a * x + el.b * y + el.c) / len;
                return d < 5 / coord.xScale;
            } else if (el instanceof GeoConic) {
                const r = el.getRadius();
                const center = el.getCenter();
                const d = Math.abs(Math.hypot(x - center.x, y - center.y) - r);
                return d < 5 / coord.xScale;
            } else if (el instanceof GeoPolygon) {
                return (el as any).isInRegionXY(x, y);
            }
            return false;
        }) as GeoElement | undefined;
      }

      if (clickedPoint) {
        if (e.ctrlKey || e.metaKey) {
          setSelectedElements(prev => prev.includes(clickedPoint) ? prev.filter(e => e !== clickedPoint) : [...prev, clickedPoint]);
          return;
        }
        setDraggedElement(clickedPoint);
        setSelectedElements([clickedPoint]);
      } else if (clickedObj) {
        if (e.ctrlKey || e.metaKey) {
          setSelectedElements(prev => prev.includes(clickedObj) ? prev.filter(e => e !== clickedObj) : [...prev, clickedObj]);
          return;
        }
        setDraggedElement(clickedObj);
        setSelectedElements([clickedObj]);
      } else if (e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // 空白处左键按住拖动 -> 启动框选
        boxModifierDown.current = false;
        setBoxStartScreen({ x: screenX, y: screenY });
        setIsBoxSelecting(true);
        return;
      } else {
        setSelectedElements([]);
      }
    } else if (mode === 'point') {
      const clickedObj = elements.slice().reverse().find(el => {
          if (el instanceof GeoSegment) {
              return (el as any).isOnPath({ getX: () => x, getY: () => y }, 5 / coord.xScale);
          } else if (el instanceof GeoLine) {
              const len = Math.hypot(el.a, el.b);
              if (len === 0) return false;
              const d = Math.abs(el.a * x + el.b * y + el.c) / len;
              return d < 5 / coord.xScale;
          } else if (el instanceof GeoConic) {
              const r = el.getRadius();
              const center = el.getCenter();
              const d = Math.abs(Math.hypot(x - center.x, y - center.y) - r);
              return d < 5 / coord.xScale;
          }
          return false;
      });

      if (clickedObj) {
          const param = new GeoNumeric(kernel, 0);
          param.label = `t_${elements.filter(e => e instanceof GeoNumeric).length + 1}`;
          param.setAnimating(true); // Allow it to be animated
          
          let algo;
          if (clickedObj instanceof GeoSegment) {
              param.intervalMin = 0;
              param.intervalMax = 1;
              algo = new AlgoPointOnSegment(kernel, clickedObj, param);
          } else if (clickedObj instanceof GeoLine) {
              param.intervalMin = -10; // Arbitrary range for line
              param.intervalMax = 10;
              algo = new AlgoPointOnLine(kernel, clickedObj, param);
          } else if (clickedObj instanceof GeoConic) {
              param.intervalMin = 0;
              param.intervalMax = 2 * Math.PI;
              algo = new AlgoPointOnConic(kernel, clickedObj, param);
          }
          
          kernel.getConstruction().addElement(param);
          if (algo) {
              algo.updateParameter(x, y);
              algo.compute();
              const p = algo.getOutput();
              p.label = kernel.getConstruction().getNextPointLabel();
              kernel.getConstruction().addElement(algo);
              kernel.getConstruction().addElement(p);
              kernel.notifyUpdate(p);
          }
      } else {
          const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
          p.label = kernel.getConstruction().getNextPointLabel();
          kernel.getConstruction().addElement(p);
          kernel.notifyUpdate(p); // Trigger refresh
      }
    } else if (mode === 'segment') {
      if (clickedPoint) {
        if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
          const p1 = selectedElements[0] as GeoPoint;
          const p2 = clickedPoint;
          if (p1 !== p2) {
             const segAlgo = new AlgoSegmentTwoPoints(kernel, p1, p2);
             kernel.getConstruction().addElement(segAlgo);
             kernel.getConstruction().addElement(segAlgo.getOutput());
             setSelectedElements([]);
             kernel.notifyUpdate(segAlgo);
          }
        } else {
          setSelectedElements([clickedPoint]);
        }
      } else {
          // Create new point if clicked on empty space
          const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
          p.label = kernel.getConstruction().getNextPointLabel();
          kernel.getConstruction().addElement(p);
          kernel.notifyUpdate(p);
          
          if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
              const p1 = selectedElements[0] as GeoPoint;
              const segAlgo = new AlgoSegmentTwoPoints(kernel, p1, p);
              kernel.getConstruction().addElement(segAlgo);
              kernel.getConstruction().addElement(segAlgo.getOutput());
              setSelectedElements([]);
              kernel.notifyUpdate(segAlgo);
          } else {
              setSelectedElements([p]);
          }
      }
    } else if (mode === 'midpoint') {
        if (clickedPoint) {
            if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                const p1 = selectedElements[0] as GeoPoint;
                const p2 = clickedPoint;
                const mid = new AlgoMidpoint(kernel, p1, p2);
                kernel.getConstruction().addElement(mid);
                kernel.getConstruction().addElement(mid.getOutput());
                mid.update();
                setSelectedElements([]);
                kernel.notifyUpdate(mid);
            } else {
                setSelectedElements([clickedPoint]);
            }
        }
    } else if (mode === 'line') {
        if (clickedPoint) {
            if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                const p1 = selectedElements[0] as GeoPoint;
                const p2 = clickedPoint;
                if (p1 !== p2) {
                    const line = new AlgoLineTwoPoints(kernel, p1, p2);
                    kernel.getConstruction().addElement(line);
                    kernel.getConstruction().addElement(line.getOutput());
                    line.update();
                    setSelectedElements([]);
                    kernel.notifyUpdate(line);
                }
            } else {
                setSelectedElements([clickedPoint]);
            }
        } else {
             // Create new point
             const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
             p.label = kernel.getConstruction().getNextPointLabel();
             kernel.getConstruction().addElement(p);
             kernel.notifyUpdate(p);
             
             if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                 const p1 = selectedElements[0] as GeoPoint;
                 const line = new AlgoLineTwoPoints(kernel, p1, p);
                 kernel.getConstruction().addElement(line);
                 kernel.getConstruction().addElement(line.getOutput());
                 line.update();
                 setSelectedElements([]);
                 kernel.notifyUpdate(line);
             } else {
                 setSelectedElements([p]);
             }
        }
    } else if (mode === 'circle') {
        // Center + Radius
        if (clickedPoint) {
            const circle = new AlgoCirclePointRadius(kernel, clickedPoint, radius);
            kernel.getConstruction().addElement(circle);
            kernel.getConstruction().addElement(circle.getOutput());
            circle.update();
            kernel.notifyUpdate(circle);
        } else {
            const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
            p.label = kernel.getConstruction().getNextPointLabel();
            kernel.getConstruction().addElement(p);
            kernel.notifyUpdate(p);
            
            const circle = new AlgoCirclePointRadius(kernel, p, radius);
            kernel.getConstruction().addElement(circle);
            kernel.getConstruction().addElement(circle.getOutput());
            circle.update();
            kernel.notifyUpdate(circle);
        }
    } else if (mode === 'circle_center_point') {
        // Center + Point on Circle
        if (clickedPoint) {
            if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                const center = selectedElements[0] as GeoPoint;
                const pointOnCircle = clickedPoint;
                if (center !== pointOnCircle) {
                    const circle = new AlgoCircleCenterPoint(kernel, center, pointOnCircle);
                    kernel.getConstruction().addElement(circle);
                    kernel.getConstruction().addElement(circle.getOutput());
                    circle.update();
                    setSelectedElements([]);
                    kernel.notifyUpdate(circle);
                }
            } else {
                setSelectedElements([clickedPoint]);
            }
        } else {
            // Create new point
            const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
            p.label = kernel.getConstruction().getNextPointLabel();
            kernel.getConstruction().addElement(p);
            kernel.notifyUpdate(p);
            
            if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
                const center = selectedElements[0] as GeoPoint;
                const circle = new AlgoCircleCenterPoint(kernel, center, p);
                kernel.getConstruction().addElement(circle);
                kernel.getConstruction().addElement(circle.getOutput());
                circle.update();
                setSelectedElements([]);
                kernel.notifyUpdate(circle);
            } else {
                setSelectedElements([p]);
            }
        }
    } else if (mode === 'circle3') {
        if (clickedPoint) {
            const currentSelected = [...selectedElements, clickedPoint];
            if (currentSelected.length === 3) {
                const [p1, p2, p3] = currentSelected as GeoPoint[];
                const circle = new AlgoCircleThreePoints(kernel, p1, p2, p3);
                kernel.getConstruction().addElement(circle);
                kernel.getConstruction().addElement(circle.getOutput());
                circle.update();
                
                // Create center point using algorithm
                const centerAlgo = new AlgoCircleCenter(kernel, circle.getOutput());
                kernel.getConstruction().addElement(centerAlgo);
                kernel.getConstruction().addElement(centerAlgo.getOutput());
                centerAlgo.update();
                
                setSelectedElements([]);
                kernel.notifyUpdate(circle);
            } else {
                setSelectedElements(currentSelected);
            }
        } else {
             const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
             p.label = kernel.getConstruction().getNextPointLabel();
             kernel.getConstruction().addElement(p);
             kernel.notifyUpdate(p);
             
             const currentSelected = [...selectedElements, p];
             if (currentSelected.length === 3) {
                const [p1, p2, p3] = currentSelected as GeoPoint[];
                const circle = new AlgoCircleThreePoints(kernel, p1, p2, p3);
                kernel.getConstruction().addElement(circle);
                kernel.getConstruction().addElement(circle.getOutput());
                circle.update();
                
                // Create center point using algorithm
                const centerAlgo = new AlgoCircleCenter(kernel, circle.getOutput());
                kernel.getConstruction().addElement(centerAlgo);
                kernel.getConstruction().addElement(centerAlgo.getOutput());
                centerAlgo.update();
                
                setSelectedElements([]);
                kernel.notifyUpdate(circle);
            } else {
                setSelectedElements(currentSelected);
            }
        }
    } else if (mode === 'intersect') {
        // Find clicked object (Line or Conic)
        // We need to hit test lines and conics
        const clickedObj = elements.slice().reverse().find(el => {
            if (el instanceof GeoSegment) {
                return (el as any).isOnPath({ getX: () => x, getY: () => y }, 5);
            } else if (el instanceof GeoLine) {
                // Distance to line
                const d = Math.abs(el.a * x + el.b * y + el.c) / Math.hypot(el.a, el.b);
                return d < 5;
            } else if (el instanceof GeoConic) {
                // Distance to circle edge
                const r = el.getRadius();
                const center = el.getCenter();
                const d = Math.abs(Math.hypot(x - center.x, y - center.y) - r);
                return d < 5;
            }
            return false;
        }) as GeoElement | undefined;

        if (clickedObj) {
            if (selectedElements.length === 1) {
                const obj1 = selectedElements[0];
                const obj2 = clickedObj;
                if (obj1 !== obj2) {
                    const intersect = new AlgoIntersect(kernel, obj1, obj2);
                    kernel.getConstruction().addElement(intersect);
                    intersect.getOutputPoints().forEach(p => kernel.getConstruction().addElement(p));
                    intersect.update();
                    setSelectedElements([]);
                    kernel.notifyUpdate(intersect);
                }
            } else {
                setSelectedElements([clickedObj]);
            }
        }
    } else if (mode === 'parallel' || mode === 'orthogonal') {
        // Select Point and Line
        const clickedObj = elements.slice().reverse().find(el => {
            if (el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10) return true;
            if (el instanceof GeoSegment) {
                 return (el as any).isOnPath({ getX: () => x, getY: () => y }, 5);
            } else if (el instanceof GeoLine) {
                 const d = Math.abs(el.a * x + el.b * y + el.c) / Math.hypot(el.a, el.b);
                 return d < 5;
            }
            return false;
        }) as GeoElement | undefined;

        if (clickedObj) {
            const currentSelected = [...selectedElements, clickedObj];
            // Check if we have one point and one line
            const point = currentSelected.find(e => e instanceof GeoPoint) as GeoPoint | undefined;
            const line = currentSelected.find(e => e instanceof GeoLine) as GeoLine | undefined;

            if (point && line) {
                if (mode === 'parallel') {
                    const algo = new AlgoParallelLine(kernel, point, line);
                    kernel.getConstruction().addElement(algo);
                    kernel.getConstruction().addElement(algo.getOutput());
                    algo.update();
                    kernel.notifyUpdate(algo);
                } else {
                    const algo = new AlgoOrthogonalLine(kernel, point, line);
                    kernel.getConstruction().addElement(algo);
                    kernel.getConstruction().addElement(algo.getOutput());
                    algo.update();
                    kernel.notifyUpdate(algo);
                }
                setSelectedElements([]);
            } else {
                setSelectedElements(currentSelected);
            }
        }
    } else if (mode === 'perpendicular_bisector') {
        // Select two points or one segment
        // First check for points
        if (clickedPoint) {
            const currentSelected = [...selectedElements, clickedPoint];
            if (currentSelected.length === 2 && currentSelected[0] instanceof GeoPoint && currentSelected[1] instanceof GeoPoint) {
                const [p1, p2] = currentSelected as GeoPoint[];
                const algo = new AlgoPerpendicularBisector(kernel, p1, p2);
                kernel.getConstruction().addElement(algo);
                kernel.getConstruction().addElement(algo.getOutput());
                algo.update();
                kernel.notifyUpdate(algo);
                setSelectedElements([]);
            } else {
                setSelectedElements(currentSelected);
            }
        } else {
             // Check for segment
             const clickedSegment = elements.slice().reverse().find(el => 
                el instanceof GeoSegment && (el as any).isOnPath({ getX: () => x, getY: () => y }, 5)
             ) as GeoSegment | undefined;
             
             if (clickedSegment) {
                 const algo = new AlgoPerpendicularBisector(kernel, clickedSegment.startPoint, clickedSegment.endPoint);
                 kernel.getConstruction().addElement(algo);
                 kernel.getConstruction().addElement(algo.getOutput());
                 algo.update();
                 kernel.notifyUpdate(algo);
                 setSelectedElements([]);
             }
        }
    } else if (mode === 'angle_bisector') {
        // Select 3 points
        if (clickedPoint) {
            const currentSelected = [...selectedElements, clickedPoint];
            if (currentSelected.length === 3) {
                const [A, B, C] = currentSelected as GeoPoint[];
                const algo = new AlgoAngleBisector(kernel, A, B, C);
                kernel.getConstruction().addElement(algo);
                kernel.getConstruction().addElement(algo.getOutput());
                algo.update();
                kernel.notifyUpdate(algo);
                setSelectedElements([]);
            } else {
                setSelectedElements(currentSelected);
            }
        }
      } else if (mode === 'distance') {
      if (clickedPoint) {
        if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
          const p1 = selectedElements[0] as GeoPoint;
          if (p1 !== clickedPoint) {
            const algo = new AlgoDistance(kernel, p1, clickedPoint);
            const c = kernel.getConstruction();
            algo.getOutput().label = `d${c.getElements().filter(e => e instanceof GeoNumeric).length + 1}`;
            c.addElement(algo);
            c.addElement(algo.getOutput());
            algo.compute();
            setSelectedElements([]);
            setRenderRev(r => r + 1);
          }
        } else {
          setSelectedElements([clickedPoint]);
        }
      }
    } else if (mode === 'angle') {
      if (clickedPoint) {
        if (selectedElements.length === 2 && selectedElements.every(e => e instanceof GeoPoint)) {
          const [p1, p2] = selectedElements as GeoPoint[];
          const algo = new AlgoAngle(kernel, p1, clickedPoint, p2);
          algo.getOutput().label = '∠';
          const c = kernel.getConstruction();
          c.addElement(algo);
          c.addElement(algo.getOutput());
          algo.compute();
          setSelectedElements([]);
          setRenderRev(r => r + 1);
        } else {
          setSelectedElements([...selectedElements, clickedPoint].slice(-3));
        }
      }
    } else if (mode === 'area') {
      // 选中一个现有多边形即可测量面积
      const target = elements.slice().reverse().find(el => el instanceof GeoPolygon) as GeoPolygon | undefined;
      if (target) {
        const algo = new AlgoArea(kernel, target);
        algo.getOutput().label = 'S';
        const c = kernel.getConstruction();
        c.addElement(algo);
        c.addElement(algo.getOutput());
        algo.compute();
        setSelectedElements([]);
        setRenderRev(r => r + 1);
      }
    } else if (mode === 'tangent') {
      if (clickedPoint) {
        const currentSelected = [...selectedElements, clickedPoint];
        if (currentSelected.length === 2 && currentSelected[0] instanceof GeoPoint) {
          const clickedCircle = elements.slice().reverse().find(el => el instanceof GeoConic) as GeoConic | undefined;
          if (clickedCircle) {
            const algo = new AlgoTangent(kernel, clickedCircle, currentSelected[0] as GeoPoint);
            kernel.getConstruction().addElement(algo);
            algo.getOutputLines().forEach(l => kernel.getConstruction().addElement(l));
            algo.getOutputPoints().forEach(p => kernel.getConstruction().addElement(p));
            algo.compute();
            setSelectedElements([]);
            setRenderRev(r => r + 1);
            return;
          }
        }
        setSelectedElements(currentSelected.slice(-2));
      }
    } else if (mode === 'locus') {
      if (clickedPoint) {
        const currentSelected = [...selectedElements, clickedPoint];
        if (currentSelected.length === 2) {
          const [tracer, driver] = currentSelected as GeoPoint[];
          const algo = new AlgoLocus(kernel, tracer, driver);
          kernel.getConstruction().addElement(algo);
          kernel.getConstruction().addElement(algo.getOutputLocus());
          algo.compute();
          setSelectedElements([]);
          setRenderRev(r => r + 1);
        } else {
          setSelectedElements(currentSelected);
        }
      }
    } else if (mode === 'polygon') {
        if (clickedPoint) {
            // If clicked start point, close polygon
            if (polygonPoints.length > 2 && clickedPoint === polygonPoints[0]) {
                const poly = new GeoPolygon(kernel, [...polygonPoints]);
                poly.label = kernel.getConstruction().getNextPolygonLabel();
                kernel.getConstruction().addElement(poly);
                
                // Also add segments
                for (let i = 0; i < polygonPoints.length; i++) {
                    const p1 = polygonPoints[i];
                    const p2 = polygonPoints[(i + 1) % polygonPoints.length];
                    // Check if segment exists? For now just create new ones or reuse logic
                    const segAlgo = new AlgoSegmentTwoPoints(kernel, p1, p2);
                    kernel.getConstruction().addElement(segAlgo);
                    kernel.getConstruction().addElement(segAlgo.getOutput());
                }
                
                kernel.notifyUpdate(poly);
                setPolygonPoints([]);
                setSelectedElements([]);
            } else {
                // Add point to polygon
                setPolygonPoints([...polygonPoints, clickedPoint]);
                setSelectedElements([...selectedElements, clickedPoint]);
            }
        } else {
            // Create new point
             const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
             p.label = kernel.getConstruction().getNextPointLabel();
             kernel.getConstruction().addElement(p);
             kernel.notifyUpdate(p);
             
             setPolygonPoints([...polygonPoints, p]);
             setSelectedElements([...selectedElements, p]);
        }
    } else if (mode === 'text' || mode === 'slider' || mode === 'button' || mode === 'checkbox') {
      const id = `ui_${Date.now()}`;
      const newUIElement: UIElement = {
        id,
        type: mode,
        x,
        y,
        label: mode === 'text' ? 'Text' : mode === 'slider' ? 'Slider' : mode === 'button' ? 'Button' : 'Checkbox',
        value: mode === 'slider' ? 50 : undefined,
        min: mode === 'slider' ? 0 : undefined,
        max: mode === 'slider' ? 100 : undefined,
        step: mode === 'slider' ? 1 : undefined,
        checked: mode === 'checkbox' ? false : undefined
      };
      setUIElements([...uiElements, newUIElement]);
      setEditingUIElement(id);
    }

    const elementsAfter = kernel.getConstruction().getElements();
    if (elementsAfter.length > elementsBefore) {
      const addedElements = elementsAfter.slice(elementsBefore);
      addCommand({ type: 'add', elements: addedElements });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { screenX, screenY, x, y } = getMousePos(e);
    setMousePos({ x, y });

    if (isPanning) {
      setCoord(prev => prev.panBy(screenX - lastPanPos.x, screenY - lastPanPos.y));
      setLastPanPos({ x: screenX, y: screenY });
      setRenderRev(r => r + 1);
      return;
    }

    if (draggingUIElement) {
      setUIElements(prev => prev.map(el => 
        el.id === draggingUIElement ? { ...el, x, y } : el
      ));
      return;
    }

    // Check for hover
    const elements = kernel.getConstruction().getElements();
    const hovered = elements.slice().reverse().find(el => 
      el instanceof GeoPoint && Math.hypot(el.getX() - x, el.getY() - y) < 10 / coord.xScale
    ) as GeoPoint | undefined;
    setHoveredPoint(hovered || null);

    // P2: 绘制框选矩形覆盖层
    if (isBoxSelecting && boxStartScreen) {
      setBoxEndScreen({ x: screenX, y: screenY });
      const ctx = overlayCanvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        const w = canvasRef.current.clientWidth;
        const h = canvasRef.current.clientHeight;
        ctx.clearRect(0, 0, w, h);
        const sx = Math.min(boxStartScreen.x, screenX);
        const sy = Math.min(boxStartScreen.y, screenY);
        const sw = Math.abs(screenX - boxStartScreen.x);
        const sh = Math.abs(screenY - boxStartScreen.y);
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.restore();
      }
    }

    if (draggedElement) {
      if (draggedElement instanceof GeoPoint && draggedElement.isIndependent()) {
        draggedElement.setCoords(x, y);
      } else if (draggedElement instanceof GeoPoint && draggedElement.parentAlgo) {
          const algo = draggedElement.parentAlgo;
          if ((algo as any).updateParameter) {
              (algo as any).updateParameter(x, y);
              algo.update();
          }
      } else if (draggedElement instanceof GeoPolygon || draggedElement instanceof GeoConic || draggedElement instanceof GeoSegment || draggedElement instanceof GeoLine) {
          const dx = x - lastMousePos.x;
          const dy = y - lastMousePos.y;
          
          if (draggedElement instanceof GeoPolygon || draggedElement instanceof GeoConic) {
              (draggedElement as any).translate(new GeoVec3D(dx, dy, 0));
          } else {
              // For lines and segments, move their parent points
              if (draggedElement.parentAlgo) {
                  draggedElement.parentAlgo.getInput().forEach(el => {
                      if (el instanceof GeoPoint && el.isIndependent()) {
                          el.setCoords(el.getX() + dx, el.getY() + dy);
                      }
                  });
                  draggedElement.parentAlgo.update();
              }
          }
          setLastMousePos({ x, y });
      }
      // 增量更新已随 setCoords 触发；flushNow 同步执行 pending，保证本帧可见性
      kernel.flushNow();
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    if (draggingUIElement) {
      setDraggingUIElement(null);
      return;
    }

    // P2: 框选完成
    if (isBoxSelecting) {
      if (!boxStartScreen || !boxEndScreen) {
        cancelBoxSelect();
        return;
      }
      const dist = Math.hypot(boxEndScreen.x - boxStartScreen.x, boxEndScreen.y - boxStartScreen.y);
      if (dist < 4) {
        // 短按：清除选择
        setSelectedElements([]);
        cancelBoxSelect();
        return;
      }
      // 转为世界坐标矩形
      const p1 = coord.screenToWorld(boxStartScreen.x, boxStartScreen.y);
      const p2 = coord.screenToWorld(boxEndScreen.x, boxEndScreen.y);
      const rect = {
        minX: Math.min(p1.x, p2.x),
        maxX: Math.max(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxY: Math.max(p1.y, p2.y),
      };
      const elements = kernel.getConstruction().getElements();
      const hitElements: GeoElement[] = [];
      for (const el of elements) {
        if (elementIntersectsRect(el, rect)) hitElements.push(el);
      }
      if (boxModifierDown.current) {
        const hitSet = new Set(hitElements);
        setSelectedElements(prev => prev.filter(e => !hitSet.has(e)).concat(hitElements));
      } else {
        setSelectedElements(hitElements);
      }
      cancelBoxSelect();
      return;
    }
    
    if (draggedElement && dragStartState) {
      const newState = captureState(kernel);
      let moved = false;
      newState.coords.forEach((newC, id) => {
        const oldC = dragStartState.coords.get(id);
        if (oldC && (oldC.x !== newC.x || oldC.y !== newC.y || oldC.z !== newC.z)) moved = true;
      });
      newState.numerics.forEach((newV, id) => {
        const oldV = dragStartState.numerics.get(id);
        if (oldV !== undefined && oldV !== newV) moved = true;
      });

      if (moved) {
        addCommand({ type: 'move', oldState: dragStartState, newState });
      }
    }
    
    setDraggedElement(null);
    setDragStartState(null);
  };

  const restoreState = (state: StateSnapshot) => {
    state.coords.forEach((coords, id) => {
      const el = kernel.getConstruction().getElementById(id);
      if (el instanceof GeoPoint) {
        el.setCoords(coords.x, coords.y, coords.z);
      }
    });
    state.numerics.forEach((val, id) => {
      const el = kernel.getConstruction().getElementById(id);
      if (el instanceof GeoNumeric) {
        el.setValue(val);
      }
    });
    kernel.getConstruction().updateAllAlgorithms();
  };

  const undo = () => {
    if (undoStack.current.length === 0) return;
    const cmd = undoStack.current.pop()!;
    redoStack.current.push(cmd);

    if (cmd.type === 'add') {
      const elements = [...cmd.elements].reverse();
      elements.forEach(el => kernel.getConstruction().removeElement(el));
      setSelectedElements(prev => prev.filter(e => !elements.includes(e as any)));
      setPolygonPoints(prev => prev.filter(e => !elements.includes(e as any)));
    } else if (cmd.type === 'delete') {
      [...cmd.elements].reverse().forEach(el => kernel.getConstruction().deleteElementWithDependents(el));
      setSelectedElements([]);
    } else if (cmd.type === 'move') {
      restoreState(cmd.oldState);
    } else if (cmd.type === 'numeric') {
      const el = kernel.getConstruction().getElementById(cmd.element.id);
      if (el instanceof GeoNumeric) el.setValue(cmd.oldValue);
    } else if (cmd.type === 'rename') {
      const el = kernel.getConstruction().getElementById(cmd.element.id);
      if (el) el.label = cmd.oldLabel;
    } else if (cmd.type === 'style') {
      applyStyleDirectly(cmd.element, cmd.after);
    }
    kernel.getConstruction().updateAllAlgorithms();
    setRenderRev(r => r + 1);
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;
    const cmd = redoStack.current.pop()!;
    undoStack.current.push(cmd);

    if (cmd.type === 'add') {
      cmd.elements.forEach(el => kernel.getConstruction().addElement(el));
    } else if (cmd.type === 'delete') {
      cmd.elements.forEach(el => kernel.getConstruction().addElement(el));
    } else if (cmd.type === 'move') {
      restoreState(cmd.newState);
    } else if (cmd.type === 'numeric') {
      const el = kernel.getConstruction().getElementById(cmd.element.id);
      if (el instanceof GeoNumeric) el.setValue(cmd.newValue);
    } else if (cmd.type === 'rename') {
      const el = kernel.getConstruction().getElementById(cmd.element.id);
      if (el) el.label = cmd.newLabel;
    } else if (cmd.type === 'style') {
      applyStyleDirectly(cmd.element, cmd.before);
    }
    kernel.getConstruction().updateAllAlgorithms();
    setRenderRev(r => r + 1);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setCoord(prev => {
      let next = prev.zoom(factor, mouseX, mouseY);
      if (next.xScale < 0.1) next = prev.zoom(0.1 / prev.xScale, mouseX, mouseY);
      else if (next.xScale > 10) next = prev.zoom(10 / prev.xScale, mouseX, mouseY);
      return next;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const zoom = (factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = rect.width / 2;
    const sy = rect.height / 2;
    setCoord(prev => {
      let next = prev.zoom(factor, sx, sy);
      if (next.xScale < 0.1) next = prev.zoom(0.1 / prev.xScale, sx, sy);
      else if (next.xScale > 10) next = prev.zoom(10 / prev.xScale, sx, sy);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            G
          </div>
          <h1 className="text-xl font-semibold text-gray-800 tracking-tight">{t('title')}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            onClick={undo}
            disabled={undoStack.current.length === 0}
            title={t('undo')}
          >
            <Undo2 size={20} />
          </button>
          <button 
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            onClick={redo}
            disabled={redoStack.current.length === 0}
            title={t('redo')}
          >
            <Redo2 size={20} />
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          
          <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-md">
            <Globe size={16} />
            <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
            >
                <option value="zh">中文</option>
                <option value="en">English</option>
            </select>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="h-14 bg-white border-b border-gray-200 px-2 flex items-center gap-1 overflow-x-auto shrink-0 z-30 shadow-sm">
        <ToolButton icon={<MousePointer2 size={22} />} label={t('move')} active={mode === 'move'} onClick={() => setMode('move')} />
        
        <ToolButton icon={<Circle size={22} fill="currentColor" />} label={t('point')} active={mode === 'point'} onClick={() => setMode('point')} />
        
        <ToolButton icon={<Minus size={22} />} label={t('segment')} active={mode === 'segment'} onClick={() => setMode('segment')} />
        <ToolButton icon={<TrendingUp size={22} />} label={t('line')} active={mode === 'line'} onClick={() => setMode('line')} />
        
        <div className="relative z-[100] circle-menu-container">
          <button
            ref={circleMenuRef}
            className={`p-2 rounded-lg flex items-center justify-center gap-1 min-w-[3rem] transition-all ${
              (mode === 'circle' || mode === 'circle_center_point' || mode === 'circle3')
                ? 'bg-blue-100 text-blue-700 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => setShowCircleMenu(!showCircleMenu)}
            title={t('circleTools')}
          >
            <CircleDot size={22} />
            {showCircleMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {showCircleMenu && (
            <div 
              className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] min-w-[180px]"
              style={{
                top: `${circleMenuPosition.top}px`,
                left: `${circleMenuPosition.left}px`
              }}>
              <button
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  mode === 'circle' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
                onClick={() => {
                  setMode('circle');
                  setShowCircleMenu(false);
                }}
              >
                <Circle size={18} />
                <span>{t('circleRadius')}</span>
              </button>
              <button
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  mode === 'circle_center_point' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
                onClick={() => {
                  setMode('circle_center_point');
                  setShowCircleMenu(false);
                }}
              >
                <CircleDashed size={18} />
                <span>{t('circleCenterPoint')}</span>
              </button>
              <button
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  mode === 'circle3' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
                onClick={() => {
                  setMode('circle3');
                  setShowCircleMenu(false);
                }}
              >
                <Target size={18} />
                <span>{t('circle3Points')}</span>
              </button>
            </div>
          )}
        </div>
        
        {mode === 'circle' && (
          <div className="flex items-center gap-1 px-2 border border-gray-200 rounded-md bg-gray-50">
            <span className="text-xs font-medium text-gray-500">R=</span>
            <input 
              type="number" 
              value={radius} 
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-12 px-1 py-0.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
              min="1"
            />
          </div>
        )}
        {/* <div className="w-px h-8 bg-gray-200 mx-1"></div> */}
        
        <ToolButton icon={<Hexagon size={22} />} label={t('polygon')} active={mode === 'polygon'} onClick={() => setMode('polygon')} />
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        
        <ToolButton icon={<CornerDownRight size={22} />} label={t('tangent')} active={mode === 'tangent'} onClick={() => setMode('tangent')} />
        <ToolButton icon={<Activity size={22} />} label={t('locus')} active={mode === 'locus'} onClick={() => setMode('locus')} />
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        
        <ToolButton icon={<X size={22} />} label={t('intersect')} active={mode === 'intersect'} onClick={() => setMode('intersect')} />
        <ToolButton icon={<Crosshair size={22} />} label={t('midpoint')} active={mode === 'midpoint'} onClick={() => setMode('midpoint')} />
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        
        <ToolButton icon={<Equal size={22} />} label={t('parallel')} active={mode === 'parallel'} onClick={() => setMode('parallel')} />
        <ToolButton icon={<Baseline size={22} />} label={t('orthogonal')} active={mode === 'orthogonal'} onClick={() => setMode('orthogonal')} />
        <ToolButton icon={<SplitSquareVertical size={22} />} label={t('perpendicularBisector')} active={mode === 'perpendicular_bisector'} onClick={() => setMode('perpendicular_bisector')} />
        <ToolButton icon={<Scissors size={22} />} label={t('angleBisector')} active={mode === 'angle_bisector'} onClick={() => setMode('angle_bisector')} />
        
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        <div className="flex items-center gap-2 px-2">
          <span className="text-sm font-medium text-gray-600">{t('label')}:</span>
          <input
            type="text"
            value={editingLabel}
            onChange={handleLabelChange}
            onBlur={handleLabelSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLabelSubmit(); }}
            disabled={selectedElements.length !== 1}
            placeholder={selectedElements.length === 1 ? '' : 'Select one object'}
            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
        
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        <div className="flex items-center gap-1">
          <button
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 min-w-[3rem] transition-all ${
              showAxes 
                ? 'bg-blue-100 text-blue-700 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => setShowAxes(!showAxes)}
            title={t('toggleAxes')}
          >
            <Axis3D size={22} />
          </button>
          <button
            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 min-w-[3rem] transition-all ${
              showGrid 
                ? 'bg-blue-100 text-blue-700 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => setShowGrid(!showGrid)}
            title={t('toggleGrid')}
          >
            <Grid3X3 size={22} />
          </button>
        </div>
        
        <div className="w-px h-8 bg-gray-200 mx-1"></div>
        
        <div className="relative z-[100] insert-menu-container">
          <button
            ref={insertMenuRef}
            className={`p-2 rounded-lg flex items-center justify-center gap-1 min-w-[3rem] transition-all ${
              showInsertMenu
                ? 'bg-blue-100 text-blue-700 shadow-inner' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => setShowInsertMenu(!showInsertMenu)}
            title={t('insertTools')}
          >
            <Plus size={22} />
            {showInsertMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {showInsertMenu && (
            <div 
              className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] min-w-[180px]"
              style={{
                top: `${insertMenuPosition.top}px`,
                left: `${insertMenuPosition.left}px`
              }}>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                onClick={() => {
                  setMode('text');
                  setShowInsertMenu(false);
                }}
              >
                <Type size={18} />
                <span>{t('insertText')}</span>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                onClick={() => {
                  setMode('slider');
                  setShowInsertMenu(false);
                }}
              >
                <Sliders size={18} />
                <span>{t('insertSlider')}</span>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                onClick={() => {
                  setMode('button');
                  setShowInsertMenu(false);
                }}
              >
                <ToggleLeft size={18} />
                <span>{t('insertButton')}</span>
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                onClick={() => {
                  setMode('checkbox');
                  setShowInsertMenu(false);
                }}
              >
                <CheckSquare size={18} />
                <span>{t('insertCheckbox')}</span>
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          className={`px-2 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 transition-colors ${
            mode === 'distance' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setMode(mode === 'distance' ? 'move' : 'distance')}
          title="两点距离">
          <Ruler size={18} /> 距离
        </button>
        <button
          className={`px-2 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 transition-colors ${
            mode === 'angle' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setMode(mode === 'angle' ? 'move' : 'angle')}
          title="三点夹角">
          <Triangle size={18} /> 角度
        </button>
        <button
          className={`px-2 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 transition-colors ${
            mode === 'area' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setMode(mode === 'area' ? 'move' : 'area')}
          title="多边形面积">
          <Square size={18} /> 面积
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          className="px-2 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          onClick={handleExport}
          title="导出为 JSON">
          导出
        </button>
        <button
          className="px-2 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          title="从 JSON 导入">
          导入
        </button>
        <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportPick} />

        <button
          className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
            snapEnabled ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}
          onClick={() => setSnapEnabled(!snapEnabled)}
          title={snapEnabled ? '关闭吸附（Alt+S）' : '开启吸附（Alt+S）'}>
          <Target size={14} />
          <span className="text-xs">吸附</span>
        </button>
        <button
          className="px-2 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 transition-colors text-gray-600 hover:bg-gray-100"
          onClick={handleExportPNG}
          title="导出当前画面为 PNG 图片">
          <Download size={16} />
          <span>导出 PNG</span>
        </button>
        <button
          className="px-2 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 transition-colors text-gray-600 hover:bg-gray-100"
          onClick={handleExportSVG}
          title="导出当前构造为 SVG 矢量图">
          <Download size={16} />
          <span>导出 SVG</span>
        </button>
        <div className="flex-1"></div>
        <button 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${isAnimating ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={toggleAnimation}
        >
            {isAnimating ? <Pause size={18} /> : <Play size={18} />}
            <span className="text-sm">{isAnimating ? t('pause') : t('play')}</span>
        </button>
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Sidebar - Algebra View / Properties */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
          <div className="flex items-stretch border-b border-gray-200 bg-gray-50">
            <button
              className={`px-3 py-2 text-sm font-medium flex-1 flex items-center justify-center gap-2 ${
                panelTab === 'algebra' ? 'bg-white border-b-2 border-blue-600 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setPanelTab('algebra')}>
              <Menu size={14} />
              <span>代数视图</span>
            </button>
            <button
              className={`px-3 py-2 text-sm font-medium flex-1 flex items-center justify-center gap-2 ${
                panelTab === 'properties' ? 'bg-white border-b-2 border-blue-600 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setPanelTab('properties')}>
              <Sliders size={14} />
              <span>属性</span>
            </button>
          </div>

          {panelTab === 'algebra' && (
            <>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {kernel.getConstruction().getElements().map(el => {
                    let typeName = el.getClassName();
                    if (typeName === 'GeoPoint') typeName = t('typePoint');
                    else if (typeName === 'GeoLine') typeName = t('typeLine');
                    else if (typeName === 'GeoSegment') typeName = t('typeSegment');
                    else if (typeName === 'GeoConic') typeName = t('typeCircle');
                    else if (typeName === 'GeoPolygon') typeName = t('typePolygon');
                    else if (typeName === 'GeoNumeric') typeName = t('typeNumeric');
                    else if (typeName === 'GeoLocus') typeName = t('typeLocus');

                    return (
                        <div key={el.id} className="group flex flex-col p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
                              <span className="font-semibold text-gray-800">{el.getNameDescription()}</span>
                            </div>
                            <div className="text-sm text-gray-500 ml-5 font-mono mt-0.5">
                                {'getAlgebraDescription' in el ? el.getAlgebraDescription() : typeName}
                            </div>
                        </div>
                    );
                })}
                {kernel.getConstruction().getElements().length === 0 && (
                  <div className="text-center text-gray-400 text-sm mt-10 p-4">
                    {t('emptyState')}
                  </div>
                )}
              </div>

              {/* Animations & Controls */}
              {kernel.getConstruction().getElements().filter(el => el instanceof GeoNumeric && el.isAnimatable()).length > 0 && (
                <div className="border-t border-gray-200 bg-gray-50 flex flex-col max-h-64">
                  <div className="p-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-700 text-sm">{t('animationsAndControls')}</h3>
                  </div>
                  <div className="p-2 overflow-y-auto space-y-2">
                      {kernel.getConstruction().getElements()
                          .filter(el => el instanceof GeoNumeric && el.isAnimatable())
                          .map(el => (
                              <SliderControl key={el.id} numeric={el as GeoNumeric} kernel={kernel} onNumericChange={notifyNumericChange} />
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {panelTab === 'properties' && (
            <div className="flex-1 overflow-y-auto p-3">
              {selectedElements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Menu size={32} className="mb-3 opacity-50" />
                  <span className="text-sm">请先在画布上选择一个对象查看/编辑属性</span>
                </div>
              ) : selectedElements.length === 1 ? (
                (() => {
                  const el = selectedElements[0];
                  const needsFill = el instanceof GeoPolygon || el instanceof GeoConic;
                  return (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                        <span className="text-base font-semibold text-gray-800">{el.getNameDescription()}</span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-mono">{el.getClassName()}</span>
                      </div>

                      {/* 轮廓颜色 */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600 block">轮廓颜色</label>
                        <div className="flex gap-2 items-center">
                          <input type="color"
                            value={el.strokeColor ?? '#000000'}
                            onChange={(e) => recordStyleChange(el, { strokeColor: e.target.value })}
                            className="w-9 h-9 rounded cursor-pointer border-0 p-0 overflow-hidden"
                          />
                          <input type="text"
                            value={el.strokeColor ?? '#000000'}
                            onChange={(e) => recordStyleChange(el, { strokeColor: e.target.value })}
                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* 线宽 */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600 block">线宽</label>
                        <input type="number" min="0" step="0.5" max="50"
                          value={el.strokeWidth ?? el.defaultLineWidth}
                          onChange={(e) => recordStyleChange(el, { strokeWidth: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* 线型 */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600 block">线型</label>
                        <button
                          onClick={() => recordStyleChange(el, { strokeDash: el.strokeDash ? null : [5 / coord.xScale, 5 / coord.xScale] })}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 flex justify-between items-center">
                          <span>{el.strokeDash && el.strokeDash.length ? '虚线' : '实线'}</span>
                          {el.strokeDash && el.strokeDash.length ? (
                            <span className="text-gray-500 font-mono">{String(el.strokeDash[0]).slice(0,3)} , {String(el.strokeDash[1]).slice(0,3)}</span>
                          ) : null}
                        </button>
                      </div>

                      {/* 填充颜色（多边形/圆） */}
                      {needsFill && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-600 block">填充颜色</label>
                          <div className="flex gap-2 items-center">
                            <input type="color"
                              value={el.fillColor ?? 'rgba(59, 130, 246, 0.2)'}
                              onChange={(e) => recordStyleChange(el, { fillColor: e.target.value })}
                              className="w-9 h-9 rounded cursor-pointer border-0 p-0 overflow-hidden"
                            />
                            <input type="text"
                              value={el.fillColor ?? 'rgba(59, 130, 246, 0.2)'}
                              onChange={(e) => recordStyleChange(el, { fillColor: e.target.value })}
                              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* 标签显隐 */}
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-700">显示标签</label>
                        <input type="checkbox"
                          checked={el.labelVisible}
                          onChange={(e) => recordStyleChange(el, { labelVisible: e.target.checked })}
                        />
                      </div>

                      {/* 标签显示时机 */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600 block">标签显示时机</label>
                        <select
                          value={el.labelMode}
                          onChange={(e) => recordStyleChange(el, { labelMode: e.target.value as any })}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="always">总是显示</option>
                          <option value="mouse">鼠标悬停或选中时</option>
                          <option value="never">从不显示</option>
                        </select>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-gray-700">
                    <span className="text-blue-600">{selectedElements.length}</span> 个对象被选中
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">统一轮廓颜色:</span>
                      <input type="color" value="#000000"
                        onChange={(e) => {
                          selectedElements.forEach((el) => recordStyleChange(el, { strokeColor: e.target.value }));
                        }}
                        className="w-7 h-7 rounded cursor-pointer border-0 p-0 overflow-hidden"
                      />
                    </div>
                    <button
                      onClick={() => {
                        selectedElements.forEach((el) => recordStyleChange(el, { strokeDash: null }));
                      }}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-50 hover:bg-gray-100">
                      全部设为实线
                    </button>
                    <div className="pt-2 text-xs text-gray-500">
                      多选时只能编辑共享样式；单个对象时还可编辑填充、标签等完整属性。
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-white z-0" ref={containerRef}>
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 pointer-events-none z-[5]"
            style={{ touchAction: 'none' }}
          />
          <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className={`absolute top-0 left-0 ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              style={{ touchAction: 'none' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={handleContextMenu}
          />
          
          {/* UI Elements */}
          {uiElements.map(element => {
            const screenX = element.x * coord.xScale + coord.xZero;
            const screenY = element.y * coord.yScale + coord.yZero;
            
            const handleUIDragStart = (e: React.MouseEvent) => {
              e.stopPropagation();
              setDraggingUIElement(element.id);
            };
            
            if (element.type === 'text') {
              return (
                <div
                  key={element.id}
                  className="absolute"
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {editingUIElement === element.id ? (
                    <input
                      type="text"
                      defaultValue={element.label}
                      autoFocus
                      onBlur={(e) => {
                        const updated = uiElements.map(el => 
                          el.id === element.id ? { ...el, label: e.target.value } : el
                        );
                        setUIElements(updated);
                        setEditingUIElement(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const updated = uiElements.map(el => 
                            el.id === element.id ? { ...el, label: (e.target as HTMLInputElement).value } : el
                          );
                          setUIElements(updated);
                          setEditingUIElement(null);
                        }
                      }}
                      className="px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none"
                    />
                  ) : (
                    <div 
                      className="px-3 py-2 bg-white border border-gray-300 rounded shadow-sm cursor-move hover:border-blue-400"
                      onDoubleClick={() => setEditingUIElement(element.id)}
                      onMouseDown={handleUIDragStart}
                    >
                      {element.label}
                    </div>
                  )}
                </div>
              );
            } else if (element.type === 'slider') {
              return (
                <div
                  key={element.id}
                  className="absolute bg-white border border-gray-300 rounded-lg shadow-sm p-3 cursor-move"
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onMouseDown={handleUIDragStart}
                >
                  <div className="text-sm font-medium mb-2">{element.label}</div>
                  <input
                    type="range"
                    min={element.min}
                    max={element.max}
                    step={element.step}
                    value={element.value}
                    onChange={(e) => {
                      e.stopPropagation();
                      const updated = uiElements.map(el => 
                        el.id === element.id ? { ...el, value: Number(e.target.value) } : el
                      );
                      setUIElements(updated);
                    }}
                    className="w-32"
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <div className="text-xs text-gray-600 mt-1 text-center">{element.value}</div>
                </div>
              );
            } else if (element.type === 'button') {
              return (
                <button
                  key={element.id}
                  className="absolute px-4 py-2 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 transition-colors cursor-move"
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onMouseDown={handleUIDragStart}
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(`Button "${element.label}" clicked!`);
                  }}
                >
                  {element.label}
                </button>
              );
            } else if (element.type === 'checkbox') {
              return (
                <label
                  key={element.id}
                  className="absolute flex items-center gap-2 bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 cursor-move hover:border-blue-400"
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onMouseDown={handleUIDragStart}
                >
                  <input
                    type="checkbox"
                    checked={element.checked}
                    onChange={(e) => {
                      e.stopPropagation();
                      const updated = uiElements.map(el => 
                        el.id === element.id ? { ...el, checked: e.target.checked } : el
                      );
                      setUIElements(updated);
                    }}
                    className="w-4 h-4"
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm">{element.label}</span>
                </label>
              );
            }
            return null;
          })}
          
          {/* Zoom Controls */}
          <div className="absolute bottom-6 right-6 flex flex-col shadow-lg rounded-lg overflow-hidden border border-gray-200 bg-white">
              <button 
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-100"
                  onClick={() => zoom(1.2)}
                  title={t('zoomIn')}
              >
                  <ZoomIn size={20} />
              </button>
              <button 
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors border-b border-gray-100"
                  onClick={() => zoom(1 / 1.2)}
                  title={t('zoomOut')}
              >
                  <ZoomOut size={20} />
              </button>
              <button 
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                  onClick={() => {
                    const dpr = window.devicePixelRatio || 1;
                    const width = canvasSize.width / dpr;
                    const height = canvasSize.height / dpr;
                    setCoord(CoordinateSystem.centered(width, height, 1));
                  }}
                  title={t('resetView')}
              >
                  <Home size={20} />
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for toolbar buttons
const ToolButton: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  
  React.useEffect(() => {
    if (showTooltip && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2
      });
    }
  }, [showTooltip]);
  
  return (
    <div className="relative z-[100]">
      <button
        ref={buttonRef}
        className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 min-w-[3rem] transition-all ${
          active 
            ? 'bg-blue-100 text-blue-700 shadow-inner' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {icon}
      </button>
      
      {showTooltip && (
        <div 
          className="fixed px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-lg whitespace-nowrap z-[9999] pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translate(-50%, -100%)'
          }}>
          {label}
          <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};
