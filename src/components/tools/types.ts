/**
 * 工具系统类型定义（GeoGebra 式工具模式）。
 *
 * 设计原则：工具只负责"创建/变换几何对象"，不负责视图状态管理；
 * 视图层（CanvasView）持有全局状态并将共享上下文注入工具。
 */

import { Kernel } from '../../kernel/core/Kernel';
import { Construction } from '../../kernel/core/Construction';
import { GeoPoint } from '../../kernel/geo/GeoPoint';
import { GeoLine } from '../../kernel/geo/GeoLine';
import { GeoSegment } from '../../kernel/geo/GeoSegment';
import { GeoConic } from '../../kernel/geo/GeoConic';
import { GeoPolygon } from '../../kernel/geo/GeoPolygon';
import { GeoElement } from '../../kernel/geo/GeoElement';
import { GeoNumeric } from '../../kernel/geo/GeoNumeric';
import { CoordinateSystem } from '../../kernel/core/CoordinateSystem';
import { ConstructionElement } from '../../kernel/core/ConstructionElement';
import type { Dispatch, SetStateAction } from 'react';

// -------------------------------------------------------------------
// 坐标约定
// -------------------------------------------------------------------
/** 世界坐标。 */
export interface WorldPoint { x: number; y: number; z?: number; }

/** 屏幕坐标（像素，以左上角为原点）。 */
export interface ScreenPoint { x: number; y: number; }

// -------------------------------------------------------------------
// 工具模式（与 GeometryCanvas 的 mode 字面量严格一致）
// -------------------------------------------------------------------
export type ToolMode =
  | 'move'
  | 'point'
  | 'line'
  | 'segment'
  | 'midpoint'
  | 'circle'
  | 'circle_center_point'
  | 'circle3'
  | 'intersect'
  | 'parallel'
  | 'orthogonal'
  | 'perpendicular_bisector'
  | 'angle_bisector'
  | 'polygon'
  | 'text'
  | 'slider'
  | 'button'
  | 'checkbox'
  | 'distance'
  | 'angle'
  | 'area'
  | 'tangent'
  | 'locus'
  // Phase 2：新增几何与变换工具
  | 'ray'
  | 'arc'
  | 'regular_polygon'
  | 'rotate'
  | 'dilate'
  | 'mirror';

// -------------------------------------------------------------------
// 工具上下文：视图把共享资源注入这里，避免事件处理器产生巨大的 props 树
// -------------------------------------------------------------------
export interface ToolContext {
  // --- 读（构造快照）----
  kernel: Kernel;
  construction: Construction;
  coord: CoordinateSystem;
  elements: readonly ConstructionElement[];
  selectedElements: GeoElement[];
  mode: ToolMode;
  mousePos: WorldPoint;
  hoveredPoint: GeoPoint | null;
  radius?: number;                // circle 模式半径
  polygonPoints?: GeoPoint[];      // polygon 模式顶点累积
  uiElements?: any[];              // UI 元素工具元素表
  // --- 状态写入（由 CanvasView 转发）----
  setMode: (m: ToolMode) => void;
  setSelectedElements: Dispatch<SetStateAction<GeoElement[]>>;
  setRenderRev: (fn: (r: number) => number) => void;
  setCoord?: (c: CoordinateSystem) => void;
  setPolygonPoints: Dispatch<SetStateAction<GeoPoint[]>>;
  // --- 撤销/重做 ----
  addCommand: (cmd: any) => void;
  captureState: (k: Kernel) => any;
  undo?: () => void;
  redo?: () => void;
  // --- 副作用 ----
  recordNumericChange?: (numeric: GeoNumeric, newValue: number) => void;
  recordRename?: (element: any, newLabel: string) => void;
  recordStyleChange?: (element: GeoElement, changes: Record<string, unknown>) => void;
  // ---- 框选状态（move 工具）----
  setBoxSelecting: (v: boolean) => void;
  setBoxStartScreen: (p: ScreenPoint | null) => void;
  setBoxEndScreen: (p: ScreenPoint | null) => void;
  // ---- 拖拽元素（move 工具）----
  setDraggedElement: (el: GeoElement | null) => void;
  // ---- UI 元素工具（由 GeometryCanvas 管理：text/slider/button/checkbox）----
  setUIElements?: Dispatch<SetStateAction<any>>;
  setEditingUIElement?: Dispatch<SetStateAction<string | null>>;
  // ---- 变换工具暂态（引用可变）----
  toolState: any;
}

// -------------------------------------------------------------------
// 工具执行结果
// -------------------------------------------------------------------
export interface ToolResult {
  clearSelection?: boolean;
  needRenderUpdate?: boolean;
}

/** 工具处理器的统一入口。鼠标按下/移动时由 CanvasView 调用。 */
export type PointerHandler = (ctx: ToolContext, point: WorldPoint, screen: ScreenPoint) => ToolResult | void;

// -------------------------------------------------------------------
// 几何元素类型守卫（Type Guard），集中替代分散的 instanceof 与 as any
// -------------------------------------------------------------------
export const isGeoPoint = (e: any): e is GeoPoint => e instanceof GeoPoint;
export const isGeoLine = (e: any): e is GeoLine => e instanceof GeoLine;
export const isGeoSegment = (e: any): e is GeoSegment => e instanceof GeoSegment;
export const isGeoConic = (e: any): e is GeoConic => e instanceof GeoConic;
export const isGeoPolygon = (e: any): e is GeoPolygon => e instanceof GeoPolygon;
export const isGeoNumeric = (e: any): e is GeoNumeric => e instanceof GeoNumeric;
