/**
 * 工具处理器集合（GeoGebra 式工具模式）。
 *
 * 每个 mode 的创建逻辑在此集中实现；几何对象构造委托给 algorithms，
 * 状态变更通过 ToolContext 中的 mutators 转发。视图层（GeometryCanvas）只负责：
 *   - 坐标换算、命中测试委托给 hitPoint()/hitObject()；
 *   - 命令记录（add/move）委托给 addCommand。
 */

import { Kernel } from '../../kernel/core/Kernel';
import { Construction } from '../../kernel/core/Construction';
import { CoordinateSystem } from '../../kernel/core/CoordinateSystem';
import { ConstructionElement } from '../../kernel/core/ConstructionElement';
import { GeoPoint } from '../../kernel/geo/GeoPoint';
import { GeoLine } from '../../kernel/geo/GeoLine';
import { GeoSegment } from '../../kernel/geo/GeoSegment';
import { GeoPolygon } from '../../kernel/geo/GeoPolygon';
import { GeoConic } from '../../kernel/geo/GeoConic';
import { GeoLocus } from '../../kernel/geo/GeoLocus';
import { GeoFunction } from '../../kernel/geo/GeoFunction';
import { GeoVec3D } from '../../kernel/core/GeoVec3D';
import { WorldPoint, ScreenPoint, ToolContext, ToolResult, ToolMode } from './types';
import { hitScreenPoint, hitScreenObject, hitCircle, functionParameterAt, lineFromTwoPoints } from './hitTests';
import {
  createLabeledPoint, addPoint, createParameterPointOnPath, createParameterPointOnFunction,
  nextDistanceLabel, nextAngleLabel, nextAreaLabel,
} from './createElements';
import {
  AlgoLineTwoPoints, AlgoSegmentTwoPoints, AlgoMidpoint, AlgoCirclePointRadius,
  AlgoCircleCenterPoint, AlgoCircleThreePoints, AlgoIntersect, AlgoParallelLine,
  AlgoOrthogonalLine, AlgoPerpendicularBisector, AlgoAngleBisector, AlgoTangent,
  AlgoLocus, AlgoDistance, AlgoAngle, AlgoArea, AlgoArc,
  AlgoRegularPolygonEdge, AlgoCircleCenter,
  AlgoRotate, AlgoDilate, AlgoMirror, AlgoTranslate, AlgoShearStretch, AlgoInvert,
  buildTransformed,
} from '../../kernel/algo';
import { AlgoElement } from '../../kernel/algo/AlgoElement';
import { GeoNumeric } from '../../kernel/geo/GeoNumeric';
import { AlgoRayTwoPoints } from '../../kernel/algo/AlgoRayTwoPoints';
import {
  AlgoVector, AlgoPolyLine, AlgoSemicircle, AlgoCircularSector,
  AlgoCircumcircularArc, AlgoCircumcircularSector, AlgoSlope, AlgoEllipse, AlgoHyperbola,
  AlgoParabola, AlgoConicFivePoints, AlgoCompass,
} from '../../kernel/algo';
import { GeoConicPart } from '../../kernel/geo/GeoConicPart';
import { GeoArc } from '../../kernel/geo/GeoArc';
import { GeoCurve } from '../../kernel/geo/GeoCurve';
import { GeoVector } from '../../kernel/geo/GeoVector';
import { GeoPolyLine } from '../../kernel/geo/GeoPolyLine';
import { GeoRay } from '../../kernel/geo/GeoRay';
import { GeoElement } from '../../kernel/geo/GeoElement';
import { GeoBoolean } from '../../kernel/geo/GeoBoolean';

// ---- 命中热区 ----
const POINT_EPS = 10;   // 点热区（像素）
const OBJ_EPS = 5;      // 线/曲线热区（像素）

/** 工具模式调度表（不含 UI 元素工具：text/slider/button/checkbox，由 GeometryCanvas 单独处理）。 */
const TOOL_MODE_LIST: readonly ToolMode[] = [
  'select', 'move', 'point', 'line', 'segment', 'midpoint', 'circle', 'circle_center_point',
  'circle3', 'intersect', 'parallel', 'orthogonal', 'perpendicular_bisector',
  'angle_bisector', 'polygon',
  'distance', 'angle', 'area', 'tangent', 'locus',
  // Phase 2：新增几何与变换工具
  'ray', 'arc', 'regular_polygon', 'rotate', 'dilate', 'mirror', 'shear', 'stretch',
  // Phase 3：2D 功能扩展
  'vector', 'polyline', 'semicircle', 'sector', 'circumcircular_arc', 'circumcircular_sector',
  'slope', 'ellipse', 'hyperbola', 'parabola', 'conic5', 'compass',
  'point_on_object', 'segment_fixed', 'vector_from_point', 'angle_fixed',
  'mirror_line', 'mirror_point', 'mirror_circle', 'translate_vector',
  'pan', 'zoom_in', 'zoom_out', 'show_hide', 'show_hide_label', 'delete',
  'text', 'slider', 'button', 'checkbox',
] as const;

/** 统一的鼠标按下处理器 —— GeometryCanvas 按当前 mode 分派调用。 */
export const handlePointerDown = (
  ctx: ToolContext,
  point: WorldPoint,
  screen: ScreenPoint
): ToolResult | void => {
  const { kernel, construction, coord, elements, selectedElements, radius, setSelectedElements, setRenderRev, setPolygonPoints, setBoxSelecting, setBoxStartScreen, setDraggedElement, setUIElements, setEditingUIElement, recordStyleChange, t } = ctx;
  const EPS = 1e-9;

  // ----- 工具专用辅助闭包 -----
  // 隐藏对象不参与普通命中，但 show/hide 工具仍可用 hitAny* 找到它。
  const visibleElements = elements.filter(el => (el as GeoElement).isEffectivelyVisible?.() !== false);
  const hitPoint = () => hitScreenPoint(visibleElements, point.x, point.y, POINT_EPS / coord.xScale);
  // hitScreenObject 的第三个参数是“每世界单位多少像素”（即 coord.xScale），
  // 内部自持像素热区；不能传世界 eps（OBJ_EPS / xScale），否则命中半径随 xScale² 漂移。
  const hitObject = () => hitScreenObject(visibleElements, point.x, point.y, coord.xScale);
  const hitAnyPoint = () => hitScreenPoint(elements, point.x, point.y, POINT_EPS / coord.xScale);
  const hitAnyObject = () => hitScreenObject(elements, point.x, point.y, coord.xScale);

  const notifyUpdate = (obj: any) => {
    const algo = obj?.parentAlgo ?? obj;
    if (algo) kernel.notifyUpdate(algo);
    else kernel.notifyUpdate(obj);
  };

  /** 按类型给尚未分配标签的输出补标签（Algo 构造器未必给标签）。 */
  const assignOutputLabel = (out: GeoElement) => {
    if (out.label) return;
    const cons = kernel.getConstruction();
    if (out instanceof GeoPoint) out.label = cons.getNextPointLabel();
    else if (out instanceof GeoConic) out.label = cons.getNextCircleLabel();
    else if (out instanceof GeoLine) out.label = cons.getNextLineLabel();
    else if (out instanceof GeoVector) out.label = cons.getNextVectorLabel();
    else if (out instanceof GeoPolygon) out.label = cons.getNextPolygonLabel();
    else if (out instanceof GeoNumeric) out.label = cons.getNextNumericLabel();
    else if (out instanceof GeoFunction) out.label = cons.getNextFunctionLabel();
  };

  /**
   * 统一登记算法：algo + 全部输出入 construction，补标签，同步 update 后通知视图。
   * 此前只 addElement(algo) 却漏注册输出（也未 compute），命中/序列化会丢对象。
   */
  const addAlgoAndNotify = (algo: AlgoElement) => {
    const cons = kernel.getConstruction();
    const present = cons.getElements();
    if (!present.includes(algo)) cons.addElement(algo);
    for (const out of algo.getGeoElements()) {
      assignOutputLabel(out);
      if (!cons.getElements().includes(out)) cons.addElement(out);
    }
    algo.update();
    kernel.notifyUpdate(algo);
  };

  /** buildTransformed 对这些类型会原样返回输入（输出别名源对象）——不建 Algo。 */
  const isTransformable = (el: GeoElement): boolean =>
    el instanceof GeoPoint || el instanceof GeoSegment || el instanceof GeoLine ||
    el instanceof GeoRay || el instanceof GeoConic || el instanceof GeoPolygon ||
    el instanceof GeoPolyLine || el instanceof GeoLocus || el instanceof GeoNumeric;

  const selOne = (p: GeoPoint) => { setSelectedElements([p]); setRenderRev(r => r + 1); };
  const clearSel = () => { setSelectedElements([]); setRenderRev(r => r + 1); };

  /** 变换输入的参考点（拖拽语义用）：点取自身，圆锥曲线取中心，其余取点击位置。 */
  const inputRef = (el: GeoElement, pt: WorldPoint): { x: number; y: number } => {
    if (el instanceof GeoPoint) return { x: el.getX(), y: el.getY() };
    if (el instanceof GeoConic) { const c = el.getCenter(); return { x: c.x, y: c.y }; }
    return { x: pt.x, y: pt.y };
  };

  /** 把预选对象映射为变换输入（rotate/dilate/mirror 等共用）。 */
  const selectionToInputs = (): { el: GeoElement; ref: { x: number; y: number } }[] =>
    selectedElements.map(el => ({ el, ref: inputRef(el, point) }));

  /** 变换工具共用的输入收集：优先使用当前选择，其次点击命中；空白点击返回 null（忽略）。 */
  const collectTransformInputs = (): { el: GeoElement; ref?: { x: number; y: number } }[] | null => {
    if (ts.inputs?.length) return ts.inputs;
    if (selectedElements.length > 0) {
      ts.inputs = selectedElements.map(el => ({ el, ref: inputRef(el, point) }));
      clearSel();
      return ts.inputs;
    }
    // 空白点击不再新建游离点（GeoGebra 行为：变换对象必须命中已有对象）
    const el = hitObject() ?? hitPoint();
    if (!el) return null;
    ts.inputs = [{ el, ref: inputRef(el, point) }];
    return ts.inputs as { el: GeoElement; ref?: { x: number; y: number } }[];
  };

  /** 在空白处创建一个带唯一标签的自由点。 */
  const emptyClickNewPoint = (): GeoPoint => emptyClickNewPointAt(point.x, point.y);

  /** 在指定世界坐标创建带标签自由点（推迟创建路径用，评审 U3）。 */
  const emptyClickNewPointAt = (x: number, y: number): GeoPoint => {
    const p = createLabeledPoint(kernel, x, y);
    kernel.getConstruction().addElement(p);
    kernel.notifyUpdate(p);
    return p;
  };

  /** 点击命中路径对象（线/圆/曲线）时创建"对象上的点"（GeoGebra 构造吸附语义）。 */
  const hitPathNewPoint = (): GeoPoint | null => {
    const obj = hitObject();
    if (obj instanceof GeoSegment || obj instanceof GeoLine || obj instanceof GeoRay || obj instanceof GeoArc || obj instanceof GeoCurve || obj instanceof GeoConic || obj instanceof GeoPolyLine) {
      const created = createParameterPointOnPath(kernel, obj, point.x, point.y);
      if (created) {
        notifyUpdate(created.point);
        return created.point;
      }
    }
    return null;
  };

  /** 两点构造辅助（直线/线段/射线）：支持"先点一点 → 再点终点"和"空白点两点"两种流程。 */
  const twoPointBuild = (algoCtor: new (k: Kernel, a: GeoPoint, b: GeoPoint) => any) => {
    // 空白点击一律新建点：第一击建 P1 并选中，第二击若因"已有选区"被吞，
    // 两点工具就无法在空白处两次点击完成最基本流程
    let picked = hitPoint() ?? emptyClickNewPoint();
    if (!picked) return;
    if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
      const p1 = selectedElements[0];
      if (p1 !== picked) {
        const algo = new algoCtor(kernel, p1, picked);
        kernel.getConstruction().addElement(algo);
        kernel.getConstruction().addElement(algo.getOutput());
        algo.update();
        clearSel();
        kernel.notifyUpdate(algo);
      }
    } else {
      selOne(picked);
    }
  };

  /** 圆弧构造：顺序点击圆心 -> 起弧点 -> 终弧点。 */
  const buildArc = (picks: (GeoPoint | null)[]) => {
    const [c, s, e] = picks;
    if (c && s && e && c !== s && s !== e && c !== e) {
      try {
        const arcAlgo = new AlgoArc(kernel, c, s, e);
        addAlgoAndNotify(arcAlgo);
        setRenderRev(r => r + 1);
      } catch { /* 三点共线等退化情形不生成弧 */ }
    }
    (ctx.toolState.current as any).arcPicks = [];
  };

  const ts = ctx.toolState.current;
  const multi = (ts?.boxModifierDown ?? false);   // Ctrl/Cmd 键 -> 框选取反
  const shifty = (ts?.shiftKey ?? false);          // Shift 键 -> 平移/取消选择
  const alt = (ts?.altKey ?? false);               // Alt 键 -> Move 工具下强制框选

  const mode: ToolMode = ctx.mode;

  // checkbox 第二阶段（对标 GeoGebra checkbox 工具）：创建复选框后逐个点击对象
  // 建立显隐联动；点击空白处结束关联。
  if (ts?.checkboxBoolean && mode === 'checkbox') {
    const target = hitAnyObject();
    if (target && target !== ts.checkboxBoolean) {
      const bool = ts.checkboxBoolean as GeoBoolean;
      const el = target as GeoElement;
      // 联动按标签引用：无标签对象先补一个，否则点击被静默忽略、用户以为已关联
      if (!el.label) {
        el.label = el instanceof GeoPoint
          ? construction.getNextPointLabel()
          : construction.getNextLineLabel();
      }
      if (!bool.linkedLabels.includes(el.label)) bool.linkedLabels.push(el.label);
      setRenderRev(r => r + 1);
    } else if (!target) {
      ts.checkboxBoolean = null;
      setRenderRev(r => r + 1);
    }
    return;
  }

  switch (mode) {

    // ============================================================
    // 基础交互
    // ============================================================
    case 'move':
    case 'select': {
      const pHit = hitPoint();
      const oHit = hitObject();
      if (pHit) {
        if (multi) {
          setSelectedElements(prev => prev.includes(pHit) ? prev.filter(e => e !== pHit) : [...prev, pHit]);
          setRenderRev(r => r + 1);
        } else {
          setDraggedElement(pHit);
          setSelectedElements([pHit]);
        }
      } else if (oHit) {
        if (multi) {
          setSelectedElements(prev => prev.includes(oHit) ? prev.filter(e => e !== oHit) : [...prev, oHit]);
          setRenderRev(r => r + 1);
        } else {
          setDraggedElement(oHit);
          setSelectedElements([oHit]);
        }
      } else if (!multi && (alt || mode === 'select')) {
        // 空白处左键按下 -> 框选（GeoGebra：Move 工具需按 Alt；Select 工具直接框选；
        // Move 不按 Alt 的空白拖拽由 GeometryCanvas 截获为平移视图）
        setBoxSelecting(true);
        setBoxStartScreen(screen);
      } else {
        setSelectedElements([]);
        setRenderRev(r => r + 1);
      }
      break;
    }

    // ============================================================
    // 基本几何对象
    // ============================================================
    case 'point':
    case 'point_on_object': {
      const obj = hitObject();
      if (
        obj instanceof GeoSegment || obj instanceof GeoLine || obj instanceof GeoRay ||
        obj instanceof GeoArc || obj instanceof GeoCurve ||
        obj instanceof GeoConic || obj instanceof GeoPolyLine || obj instanceof GeoFunction
      ) {
        if (obj instanceof GeoFunction) {
          const bounds = coord.visibleWorldBounds();
          const x = functionParameterAt(obj, point.x, point.y, {
            minX: bounds.minX,
            maxX: bounds.maxX,
            pixelWidth: 1600,
          });
          if (!Number.isFinite(x)) break;
          const created = createParameterPointOnFunction(kernel, obj, x, { min: bounds.minX, max: bounds.maxX });
          setSelectedElements([created.point]);
          setRenderRev(r => r + 1);
          break;
        }
        const created = createParameterPointOnPath(kernel, obj, point.x, point.y);
        if (created) {
          notifyUpdate(created.point);
          setSelectedElements([created.point]);
          setRenderRev(r => r + 1);
        }
      } else if (mode === 'point') {
        // 空白点击仅"点"工具创建自由点；"对象上的点"工具在空白处无动作
        //（GeoGebra 语义：该工具只能落在对象上）
        emptyClickNewPoint();
      }
      break;
    }

    case 'line':
      twoPointBuild(AlgoLineTwoPoints);
      break;

    case 'segment':
      twoPointBuild(AlgoSegmentTwoPoints);
      break;

    case 'midpoint': {
      const pHit = hitPoint();
      if (pHit && selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
        const m = new AlgoMidpoint(kernel, selectedElements[0], pHit);
        kernel.getConstruction().addElement(m);
        kernel.getConstruction().addElement(m.getOutput());
        m.update();
        clearSel();
        kernel.notifyUpdate(m);
      } else if (pHit) {
        selOne(pHit);
      }
      break;
    }

    case 'circle': {
      // 对标 GeoGebra 的"圆 (圆心和半径)"：先点圆心，画布内输入框输入半径。
      // 圆心点的创建**推迟到确认回调**（评审 U3/U4）：取消 = 什么都不曾创建，
      // mousedown 的元素差分也不会把孤儿点记进 undo。
      const centerHit = hitPoint();
      const centerPos = { x: point.x, y: point.y };
      ctx.requestValue?.(t('circleRadiusValuePrompt'), '3', (raw) => {
        if (raw === null) return;
        const r = Number(raw);
        if (!isFinite(r) || r <= 0) return;
        const center = centerHit ?? emptyClickNewPointAt(centerPos.x, centerPos.y);
        const circle = new AlgoCirclePointRadius(kernel, center, r);
        addAlgoAndNotify(circle);
      });
      break;
    }

    case 'circle_center_point': {
      const pHit = hitPoint();
      if (pHit) {
        if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
          const center = selectedElements[0];
          if (center !== pHit) {
            const circle = new AlgoCircleCenterPoint(kernel, center, pHit);
            kernel.getConstruction().addElement(circle);
            kernel.getConstruction().addElement(circle.getOutput());
            circle.update();
            clearSel();
            kernel.notifyUpdate(circle);
          }
        } else {
          selOne(pHit);
        }
      } else {
        const p = emptyClickNewPoint();
        if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
          const center = selectedElements[0];
          const circle = new AlgoCircleCenterPoint(kernel, center, p);
          kernel.getConstruction().addElement(circle);
          kernel.getConstruction().addElement(circle.getOutput());
          circle.update();
          clearSel();
          kernel.notifyUpdate(circle);
        } else {
          selOne(p);
        }
      }
      break;
    }

    case 'circle3': {
      const picks: (GeoPoint | null)[] = [...((ts.arcPicks as any) ?? [])];
      // 吸附优先级：已有点 → 路径对象上的依赖点 → 空白新建自由点
      const clicked = hitPoint() ?? hitPathNewPoint() ?? emptyClickNewPoint();
      // 重复拾取同一点会导致退化圆（undefined），忽略重复点击
      if (picks.some(p => p === clicked)) break;
      picks.push(clicked);
      if (picks.length === 3) {
        const [p1, p2, p3] = picks as GeoPoint[];
        const circle = new AlgoCircleThreePoints(kernel, p1, p2, p3);
        kernel.getConstruction().addElement(circle);
        kernel.getConstruction().addElement(circle.getOutput());
        circle.update();
        const centerAlgo = new AlgoCircleCenter(kernel, circle.getOutput());
        kernel.getConstruction().addElement(centerAlgo);
        kernel.getConstruction().addElement(centerAlgo.getOutput());
        centerAlgo.update();
        clearSel();
        kernel.notifyUpdate(circle);
        (ts.arcPicks as any) = [];
      } else {
        (ts.arcPicks as any) = picks;
        setRenderRev(r => r + 1);
      }
      break;
    }

    case 'intersect': {
      const obj = hitObject();
      if (obj) {
        if (selectedElements.length === 1) {
          const other = selectedElements[0];
          if (other !== obj) {
            const inter = new AlgoIntersect(kernel, other, obj);
            kernel.getConstruction().addElement(inter);
            inter.getOutputPoints().forEach(p => kernel.getConstruction().addElement(p));
            inter.update();
            clearSel();
            kernel.notifyUpdate(inter);
          }
        } else {
          selOne(obj as GeoPoint);
        }
      }
      break;
    }

    case 'parallel':
    case 'orthogonal': {
      const obj = hitObject();
      if (obj) {
        const current = [...selectedElements, obj];
        const point = current.find(e => e instanceof GeoPoint) as GeoPoint | undefined;
        const line = current.find(e => e instanceof GeoLine || e instanceof GeoSegment) as GeoLine | undefined;
        if (point && line) {
          const algo = mode === 'parallel'
            ? new AlgoParallelLine(kernel, point, line as GeoLine)
            : new AlgoOrthogonalLine(kernel, point, line as GeoLine);
          kernel.getConstruction().addElement(algo);
          kernel.getConstruction().addElement(algo.getOutput());
          algo.update();
          clearSel();
          kernel.notifyUpdate(algo);
        } else {
          setSelectedElements(current);
          setRenderRev(r => r + 1);
        }
      }
      break;
    }

    case 'perpendicular_bisector': {
      const pHit = hitPoint();
      if (pHit) {
        const current = [...selectedElements, pHit];
        if (current.length === 2 && current[0] instanceof GeoPoint && current[1] instanceof GeoPoint) {
          const [p1, p2] = current as GeoPoint[];
          const bis = new AlgoPerpendicularBisector(kernel, p1, p2);
          kernel.getConstruction().addElement(bis);
          kernel.getConstruction().addElement(bis.getOutput());
          bis.update();
          clearSel();
          kernel.notifyUpdate(bis);
        } else {
          setSelectedElements(current);
          setRenderRev(r => r + 1);
        }
      }
      break;
    }

    case 'angle_bisector': {
      const pHit = hitPoint();
      if (pHit) {
        const current = [...selectedElements, pHit];
        if (current.length === 3) {
          const [A, B, C] = current as GeoPoint[];
          const bis = new AlgoAngleBisector(kernel, A, B, C);
          kernel.getConstruction().addElement(bis);
          kernel.getConstruction().addElement(bis.getOutput());
          bis.update();
          clearSel();
          kernel.notifyUpdate(bis);
        } else {
          setSelectedElements(current);
          setRenderRev(r => r + 1);
        }
      }
      break;
    }

    case 'polygon': {
      const pHit = hitPoint();
      const pts = ctx.polygonPoints ?? [];
      if (pHit) {
        if (pts.length > 2 && pHit === pts[0]) {
          const poly = new GeoPolygon(kernel, [...pts]);
          poly.label = construction.getNextPolygonLabel();
          kernel.getConstruction().addElement(poly);
          for (let i = 0; i < pts.length; i++) {
            const seg = new AlgoSegmentTwoPoints(kernel, pts[i], pts[(i + 1) % pts.length]);
            kernel.getConstruction().addElement(seg);
            kernel.getConstruction().addElement(seg.getOutput());
          }
          kernel.notifyUpdate(poly);
          // 顶点已归属多边形：清掉"本工具新建"记录，之后 Escape 不得回收它们
          ctx.polygonCreatedPoints?.splice(0);
          setPolygonPoints([]);
          clearSel();
        } else {
          setPolygonPoints([...pts, pHit]);
          setSelectedElements([...selectedElements, pHit]);
          setRenderRev(r => r + 1);
        }
      } else {
        const p = emptyClickNewPoint();
        // 记录为本工具新建：中途退出时只回收这类点，命中的既有点不能动
        ctx.polygonCreatedPoints?.push(p);
        setPolygonPoints([...pts, p]);
        setSelectedElements([...selectedElements, p]);
        setRenderRev(r => r + 1);
      }
      break;
    }

    // ============================================================
    // 测量工具
    // ============================================================
    case 'distance': {
      const pHit = hitPoint();
      if (pHit) {
        if (selectedElements.length === 1 && selectedElements[0] instanceof GeoPoint) {
          const p1 = selectedElements[0];
          if (p1 !== pHit) {
            const d = new AlgoDistance(kernel, p1, pHit);
            d.getOutput().label = nextDistanceLabel(construction);
            kernel.getConstruction().addElement(d);
            kernel.getConstruction().addElement(d.getOutput());
            d.compute();
            clearSel();
            setRenderRev(r => r + 1);
          }
        } else {
          setSelectedElements([pHit]);
        }
      }
      break;
    }

    case 'angle': {
      const pHit = hitPoint();
      if (pHit) {
        if (selectedElements.length === 2 && selectedElements.every(e => e instanceof GeoPoint)) {
          const [p1, p2] = selectedElements as GeoPoint[];
          // GeoGebra 语义 ∠P1P2P3：第二击是顶点（AlgoAngle 的第 2 参数）
          const ang = new AlgoAngle(kernel, p1, p2, pHit);
          ang.getOutput().label = nextAngleLabel(construction);
          kernel.getConstruction().addElement(ang);
          kernel.getConstruction().addElement(ang.getOutput());
          ang.compute();
          clearSel();
          setRenderRev(r => r + 1);
        } else {
          setSelectedElements([...selectedElements, pHit].slice(-3));
          setRenderRev(r => r + 1);
        }
      }
      break;
    }

    case 'area': {
      // 修复：此前点击任意位置（包括空白）都会测"构造中最后一个多边形"，
      // 无法指定目标。改为必须点中某个多边形。
      const target = hitObject();
      if (target instanceof GeoPolygon) {
        const ar = new AlgoArea(kernel, target);
        ar.getOutput().label = nextAreaLabel(construction);
        kernel.getConstruction().addElement(ar);
        kernel.getConstruction().addElement(ar.getOutput());
        ar.compute();
        clearSel();
        setRenderRev(r => r + 1);
      }
      break;
    }

    case 'tangent': {
      // GeoGebra 语义：依次点一个点与一条圆锥曲线（顺序任意）。
      // 此前两击都必须命中点、曲线取"构造中最新的一条"，多点一线时必然选错目标。
      const conicHit = (() => { const el = hitObject(); return el instanceof GeoConic ? el : null; })();
      const pHit = hitPoint();
      const buildTangent = (conic: GeoConic, pt: GeoPoint) => {
        const tan = new AlgoTangent(kernel, conic, pt);
        kernel.getConstruction().addElement(tan);
        tan.getOutputLines().forEach(l => kernel.getConstruction().addElement(l));
        tan.getOutputPoints().forEach(p => kernel.getConstruction().addElement(p));
        tan.compute();
        clearSel();
        setRenderRev(r => r + 1);
      };
      if (conicHit) {
        const pt = selectedElements.find(e => e instanceof GeoPoint) as GeoPoint | undefined;
        if (pt) buildTangent(conicHit, pt);
        else { setSelectedElements([conicHit]); setRenderRev(r => r + 1); }
        break;
      }
      if (pHit) {
        const conic = selectedElements.find(e => e instanceof GeoConic) as GeoConic | undefined;
        if (conic) buildTangent(conic, pHit);
        else { setSelectedElements([pHit]); setRenderRev(r => r + 1); }
      }
      break;
    }

    case 'locus': {
      const pHit = hitPoint();
      if (pHit) {
        const current = [...selectedElements, pHit];
        if (current.length === 2 && current.every(e => e instanceof GeoPoint)) {
          const [tracer, driver] = current as GeoPoint[];
          const locus = new AlgoLocus(kernel, tracer, driver);
          kernel.getConstruction().addElement(locus);
          kernel.getConstruction().addElement(locus.getOutputLocus());
          locus.compute();
          clearSel();
          setRenderRev(r => r + 1);
        } else {
          setSelectedElements(current);
          setRenderRev(r => r + 1);
        }
      }
      break;
    }

    // ============================================================
    // Phase 2：新增几何与变换工具
    // ============================================================
    case 'ray':
      twoPointBuild(AlgoRayTwoPoints);
      break;

    case 'arc': {
      const picks = [...((ts.arcPicks as any) ?? [])];
      // 吸附优先级与 circle3 一致；重复拾取同一点忽略（三点共点必退化）
      const picked = hitPoint() ?? hitPathNewPoint() ?? emptyClickNewPoint();
      if (picks.some(p => p === picked)) break;
      picks.push(picked);
      if (picks.length >= 3) buildArc(picks.slice(0, 3));
      else {
        (ts.arcPicks as any) = picks;
        setRenderRev(r => r + 1);
      }
      break;
    }

    case 'regular_polygon': {
      // GeoGebra 交互：两次点击定义第一条边的两个端点，弹窗输入边数 n，
      // 多边形在屏幕上呈逆时针展开。此前实现是"中心+半径"模型且边数硬编码 6。
      if (!ts.regPolyStart) {
        const clicked = hitPoint() ?? emptyClickNewPoint();
        ts.regPolyStart = clicked;
        selOne(clicked);
        break;
      }
      const start = ts.regPolyStart;
      const startHit = hitPoint();
      // 第二个顶点推迟到确认回调创建（评审 U3：取消不留孤儿点）
      const secondPos = { x: point.x, y: point.y };
      if (startHit) {
        if (startHit === start) { ts.regPolyStart = null; break; }
      }
      // 边数改画布内输入（替代 window.prompt）
      ctx.requestValue?.(t('regularPolygonSidesPrompt'), '6', (raw) => {
        if (raw === null) {
          ts.regPolyStart = null; clearSel(); setRenderRev(r => r + 1); return;
        }
        const nSides = Number(raw);
        if (!isFinite(nSides) || nSides < 3) { ts.regPolyStart = null; clearSel(); setRenderRev(r => r + 1); return; }
        const clicked = startHit ?? emptyClickNewPointAt(secondPos.x, secondPos.y);
        const polyAlgo = new AlgoRegularPolygonEdge(kernel, start, clicked, Math.floor(nSides));
        addAlgoAndNotify(polyAlgo);
        // 边 segment（GeoGebra 同样为每条边输出一条线段）
        const verts = polyAlgo.getOutput().vertices;
        for (let i = 0; i < verts.length; i++) {
          const seg = new AlgoSegmentTwoPoints(kernel, verts[i], verts[(i + 1) % verts.length]);
          addAlgoAndNotify(seg);
        }
        clearSel();
        ts.regPolyStart = null;
        setRenderRev(r => r + 1);
      });
      break;
    }

    case 'rotate':
    case 'dilate': {
      const op = mode === 'rotate' ? 'rotate' : 'dilate';
      // 步骤 1（对象）：预选优先（GeoGebra 工作流），否则点击命中任意对象；
      // 空白点击忽略——此前 emptyClickNewPoint 会在点击处生成游离点并被旋转，
      // 而用户真正想变换的线/圆却选不中。
      if ((ts.inputs?.length ?? 0) === 0) {
        if (selectedElements.length > 0) {
          ts.inputs = selectionToInputs();
          clearSel();
          setRenderRev(r => r + 1);
          return;
        }
        const obj = hitObject() ?? hitPoint();
        if (!obj) return;
        ts.inputs = [{ el: obj, ref: inputRef(obj, point) }];
        setSelectedElements([]);
        setRenderRev(r => r + 1);
        return;
      }
      // 步骤 2（中心 + 数值）：命中已有点为活中心；随后弹窗输入角度/比例
      //（GeoGebra：正值 = 屏幕逆时针）。不再用第三次点击的几何位置推参数。
      if (!ts.center) {
        const centerHit = hitPoint();
        ts.center = centerHit
          ? { x: centerHit.getX(), y: centerHit.getY(), el: centerHit }
          : { x: point.x, y: point.y };
        // 角度/比例改画布内输入（替代 window.prompt）；回调里完成构造
        ctx.requestValue?.(
          t(op === 'rotate' ? 'rotateAnglePrompt' : 'dilateFactorPrompt'),
          op === 'rotate' ? '45' : '2',
          (raw) => {
            if (raw === null) { ts.inputs = []; ts.center = null; return; }
            const value = Number(raw);
            if (!isFinite(value)) { ts.inputs = []; ts.center = null; return; }
            // 活中心：命中已有点时把 GeoPoint 注册为输入，移动中心联动重算
            const centerArg: GeoPoint | { x: number; y: number } =
              (ts.center as any).el ?? { x: ts.center.x, y: ts.center.y };
            for (const { el } of ts.inputs as { el: GeoElement }[]) {
              if (!isTransformable(el)) continue;
              const algo = op === 'rotate'
                ? new AlgoRotate(kernel, el, centerArg, (value * Math.PI) / 180)
                : new AlgoDilate(kernel, el, centerArg, value);
              addAlgoAndNotify(algo);
            }
            clearSel();
            setRenderRev(r => r + 1);
            ts.inputs = []; ts.center = null;
          },
        );
      }
      return;
    }

    case 'mirror':
    case 'shear':
    case 'stretch': {
      if (mode !== 'mirror') {
        if (ts.inputs?.length) {
          if (!ts.transformRef) {
            const axisObject = hitObject();
            if (axisObject instanceof GeoLine) {
              ts.transformRef = {
                kind: 'line',
                axis: { a: axisObject.a, b: axisObject.b, c: axisObject.c },
                line: axisObject,
              };
            } else if (!ts.refStart) {
              ts.refStart = { x: point.x, y: point.y };
            } else {
              ts.transformRef = { kind: 'line', axis: lineFromTwoPoints(ts.refStart, { x: point.x, y: point.y }) };
            }
            if (!ts.transformRef) return;
          }

          // 系数改画布内输入（替代 window.prompt）
          ctx.requestValue?.(t(mode === 'shear' ? 'shearFactorPrompt' : 'stretchFactorPrompt'), '1', (raw) => {
            if (raw === null) return;
            const factor = Number(raw);
            if (!isFinite(factor)) return;

            // all-or-nothing：任一输入不支持或轴退化则整批不入 construction（步骤状态保留）
            try {
              const axisRef = ts.transformRef as { axis: { a: number; b: number; c: number }; line?: GeoLine };
              const algos = (ts.inputs as { el: GeoElement }[])
                .filter(({ el }) => isTransformable(el))
                .map(({ el }) => new AlgoShearStretch(
                  kernel, el,
                  axisRef.line ?? [axisRef.axis.a, axisRef.axis.b, axisRef.axis.c],
                  factor, mode === 'shear' ? 'shear' : 'stretch',
                ));
              algos.forEach(algo => addAlgoAndNotify(algo));
              clearSel();
              setRenderRev(r => r + 1);
              ts.inputs = []; ts.transformRef = null; ts.refStart = null;
            } catch {
              // Degenerate axes stay in the current step so the user can pick another line.
            }
          });
          return;
        }

        if (selectedElements.length > 0) {
          ts.inputs = selectedElements.map(el => {
            let ref: { x: number; y: number };
            if (el instanceof GeoPoint) ref = { x: el.getX(), y: el.getY() };
            else if (el instanceof GeoConic) { const c = el.getCenter(); ref = { x: c.x, y: c.y }; }
            else ref = { x: point.x, y: point.y };
            return { el, ref };
          });
          clearSel();
          return;
        }

        // 空白点击忽略（GeoGebra 行为）：此前会新建游离点当源对象
        const source = hitObject() ?? hitPoint();
        if (!source) return;
        ts.inputs = [{
          el: source,
          ref: source instanceof GeoPoint ? { x: source.getX(), y: source.getY() } : { x: point.x, y: point.y },
        }];
        clearSel();
        return;
      }

      if ((!ts.inputs || ts.inputs.length === 0) && selectedElements.length === 0) {
        // 空白点击忽略：mirror 源对象必须命中已有对象/点
        const obj = hitObject() ?? hitPoint();
        if (!obj) return;
        ts.inputs = [{ el: obj, ref: inputRef(obj, point) }];
        setSelectedElements([]);
        setRenderRev(r => r + 1);
        return;
      }
      if ((ts.inputs?.length ?? 0) === 0) {
        ts.inputs = selectionToInputs();
        setSelectedElements([]);
        setRenderRev(r => r + 1);
        return;
      }
      const obj = hitObject();
      if (!ts.axis) {
        if (obj instanceof GeoLine) {
          // 活镜轴：命中已有直线时保留引用，移动轴联动重算
          ts.axis = { a: obj.a, b: obj.b, c: obj.c, line: obj };
        } else if (!ts.axisStart) {
          ts.axisStart = { x: point.x, y: point.y };
          return;
        } else {
          // 两点画轴：冻结系数（旧逻辑 axisStart 被首分支覆盖，两点轴不可用）
          ts.axis = lineFromTwoPoints(ts.axisStart, { x: point.x, y: point.y });
          ts.axisStart = null;
        }
      }
      for (const { el } of ts.inputs) {
        if (!isTransformable(el)) continue;
        addAlgoAndNotify(new AlgoMirror(
          kernel, el, ts.axis.a, ts.axis.b, ts.axis.c,
          (ts.axis as any).line as GeoLine | undefined,
        ));
      }
      clearSel();
      setRenderRev(r => r + 1);
      ts.inputs = []; ts.axis = null; ts.axisStart = null;
      return;
    }

    case 'mirror_line':
    case 'mirror_point':
    case 'mirror_circle':
    case 'translate_vector': {
      if (mode === 'mirror_line') {
        if (!ts.transformRef) {
          const axisObject = hitObject();
          if (axisObject instanceof GeoLine) {
            ts.transformRef = {
              kind: 'line',
              axis: { a: axisObject.a, b: axisObject.b, c: axisObject.c },
              line: axisObject,
            };
            // 输入已预选/已点击（GeoGebra"先对象后镜像线"顺序）→ 本击直接执行
            if (ts.inputs?.length || selectedElements.length > 0) {
              // 落到下方公共执行段
            } else {
              return;
            }
          } else if (axisObject) {
            // 非线对象先到（GeoGebra 顺序：先点源对象）→ 记为输入，等镜像线
            if ((ts.inputs?.length ?? 0) === 0) {
              ts.inputs = [{ el: axisObject, ref: inputRef(axisObject, point) }];
            }
            return;
          } else if (!ts.refStart) {
            ts.refStart = { x: point.x, y: point.y };
            return;
          } else {
            // 两点画轴：完成 ref 后冻结系数，下次 click 执行（旧代码此分支不可达）
            ts.transformRef = { kind: 'line', axis: lineFromTwoPoints(ts.refStart, { x: point.x, y: point.y }) };
            ts.refStart = null;
            // 若对象已先选好，本击直接执行（落入下方公共执行段）
            if (!(ts.inputs?.length)) return;
          }
        }
        const inputs = collectTransformInputs();
        if (!inputs) return; // 空白点击：忽略，保留当前步骤状态
        const ref = ts.transformRef as { axis: { a: number; b: number; c: number }; line?: GeoLine };
        for (const { el } of inputs) {
          if (!isTransformable(el)) continue;
          addAlgoAndNotify(new AlgoMirror(
            kernel, el, ref.axis.a, ref.axis.b, ref.axis.c, ref.line,
          ));
        }
      } else if (mode === 'mirror_point') {
        if (!ts.transformRef) {
          // 任意顺序：先点中心点（参数优先，兼容旧流程）或先点非点源对象（GeoGebra 顺序）
          const pt = hitPoint();
          if (pt) {
            // 活中心点：注册为 AlgoDilate 输入，移动中心联动镜像
            ts.transformRef = { kind: 'point', centerPoint: pt };
            if (ts.inputs?.length || selectedElements.length > 0) {
              // 已有源对象 → 本击直接执行（落入公共执行段）
            } else {
              return;
            }
          } else {
            const obj = hitObject();
            if (!obj) return; // 空白点击忽略（此前会新建游离点当中心）
            if ((ts.inputs?.length ?? 0) === 0) {
              ts.inputs = [{ el: obj, ref: inputRef(obj, point) }];
            }
            return;
          }
        }
        const inputs = collectTransformInputs();
        if (!inputs) return; // 空白点击：忽略，保留当前步骤状态
        const centerPoint = ts.transformRef.centerPoint as GeoPoint;
        for (const { el } of inputs) {
          if (!isTransformable(el)) continue;
          addAlgoAndNotify(new AlgoDilate(kernel, el, centerPoint, -1));
        }
      } else if (mode === 'mirror_circle') {
        if (!ts.transformRef) {
          // 任意顺序：先点反演圆（参数优先）或先点非圆源对象（GeoGebra 顺序）
          const circle = hitCircle(visibleElements, point.x, point.y, OBJ_EPS / coord.xScale);
          if (circle) {
            // 活反演圆：注册为 AlgoInvert 输入，移动/缩放圆联动反演
            ts.transformRef = { kind: 'circle', circle };
            if (ts.inputs?.length || selectedElements.length > 0) {
              // 已有源对象 → 本击直接执行
            } else {
              return;
            }
          } else {
            const obj = hitObject() ?? hitPoint();
            if (!obj) return; // 未命中任何对象：提示无效（此前静默 return）
            if ((ts.inputs?.length ?? 0) === 0) {
              ts.inputs = [{ el: obj, ref: inputRef(obj, point) }];
            }
            return;
          }
        }
        const inputs = collectTransformInputs();
        if (!inputs) return; // 空白点击：忽略，保留当前步骤状态
        const circle = ts.transformRef.circle as GeoConic;
        for (const { el } of inputs) {
          if (!isTransformable(el)) continue;
          try {
            addAlgoAndNotify(new AlgoInvert(kernel, el, circle));
          } catch { /* 非圆圆锥曲线的反演像无法表示：跳过该对象 */ }
        }
      } else {
        if (!ts.transformRef) {
          const obj = hitObject();
          if (!(obj instanceof GeoVector)) {
            // 非向量对象先到（GeoGebra 顺序：先点源对象）→ 记为输入，等平移向量
            if (obj && (ts.inputs?.length ?? 0) === 0) {
              ts.inputs = [{ el: obj, ref: inputRef(obj, point) }];
            }
            return;
          }
          // 活平移向量：注册为 AlgoTranslate 输入。必须 return——
          // 此前落入同一次 click 的 collectTransformInputs，命中刚选中的向量本身
          // （GeoVector 不可变换被跳过）后整个状态被清空，工具永远无法完成平移。
          ts.transformRef = { kind: 'vector', vectorEl: obj };
          if (ts.inputs?.length || selectedElements.length > 0) {
            // 已有源对象 → 本击直接执行
          } else {
            return;
          }
        }
        const inputs = collectTransformInputs();
        if (!inputs) return; // 空白点击：忽略，保留当前步骤状态
        const vectorEl = ts.transformRef.vectorEl as GeoVector;
        for (const { el } of inputs) {
          if (!isTransformable(el)) continue;
          addAlgoAndNotify(new AlgoTranslate(kernel, el, vectorEl));
        }
      }
      clearSel();
      setRenderRev(r => r + 1);
      ts.inputs = []; ts.transformRef = null; ts.refStart = null;
      return;
    }

    case 'segment_fixed': {
      if (!ts.fixedStart) {
        const startHit = hitPoint();
        const startPos = { x: point.x, y: point.y };
        // 长度画布内输入；起点推迟到确认回调创建（评审 U3：取消不留孤儿点）
        ctx.requestValue?.(t('fixedLengthPrompt'), '5', (raw) => {
          if (raw === null) return;
          const length = Number(raw);
          if (!isFinite(length) || length <= 0) return;
          ts.fixedStart = startHit ?? emptyClickNewPointAt(startPos.x, startPos.y);
          ts.fixedLength = length;
          setRenderRev(r => r + 1);
        });
        return;
      }
      const dx = point.x - ts.fixedStart.getX();
      const dy = point.y - ts.fixedStart.getY();
      const d = Math.hypot(dx, dy) || 1;
      const end = new GeoPoint(kernel, new GeoVec3D(
        ts.fixedStart.getX() + dx / d * ts.fixedLength,
        ts.fixedStart.getY() + dy / d * ts.fixedLength,
        1,
      ));
      end.label = construction.getNextPointLabel();
      const seg = new AlgoSegmentTwoPoints(kernel, ts.fixedStart, end);
      kernel.getConstruction().addElement(end);
      kernel.getConstruction().addElement(seg);
      kernel.getConstruction().addElement(seg.getOutput());
      seg.update();
      clearSel();
      kernel.notifyUpdate(seg);
      ts.fixedStart = null; ts.fixedLength = null;
      break;
    }

    case 'angle_fixed': {
      if (!ts.angleVertex) {
        const vertexHit = hitPoint();
        const vertexPos = { x: point.x, y: point.y };
        // 角度画布内输入；顶点推迟到确认回调创建（评审 U3：取消不留孤儿点）
        ctx.requestValue?.(t('fixedAnglePrompt'), '60', (raw) => {
          if (raw === null) return;
          const degrees = Number(raw);
          if (!isFinite(degrees)) return;
          ts.angleVertex = vertexHit ?? emptyClickNewPointAt(vertexPos.x, vertexPos.y);
          ts.angleDegrees = degrees;
          setRenderRev(r => r + 1);
        });
        return;
      }
      const first = hitPoint() ?? emptyClickNewPoint();
      const angle = ts.angleDegrees * Math.PI / 180;
      const vx = first.getX() - ts.angleVertex.getX();
      const vy = first.getY() - ts.angleVertex.getY();
      const rx = vx * Math.cos(angle) - vy * Math.sin(angle);
      const ry = vx * Math.sin(angle) + vy * Math.cos(angle);
      const second = new GeoPoint(kernel, new GeoVec3D(ts.angleVertex.getX() + rx, ts.angleVertex.getY() + ry, 1));
      second.label = construction.getNextPointLabel();
      const ray = new GeoRay(kernel, ts.angleVertex, second);
      ray.label = construction.getNextLineLabel();
      kernel.getConstruction().addElement(second);
      kernel.getConstruction().addElement(ray);
      kernel.notifyUpdate(ray);
      clearSel();
      setRenderRev(r => r + 1);
      ts.angleVertex = null; ts.angleDegrees = null;
      break;
    }

    case 'vector_from_point':
      twoPointBuild(AlgoVector);
      break;

    case 'show_hide': {
      const obj = hitAnyObject();
      if (obj) recordStyleChange(obj, { visible: obj.visible === false });
      break;
    }

    case 'show_hide_label': {
      const obj = hitAnyObject();
      if (obj) recordStyleChange(obj, { labelVisible: !obj.labelVisible });
      break;
    }

    case 'delete': {
      const obj = hitAnyObject();
      if (obj) ctx.deleteElements?.([obj]);
      break;
    }

    // ============================================================
    // UI 元素工具（text / slider / button / checkbox）
    // ============================================================
    case 'text':
    case 'slider':
    case 'button':
    case 'checkbox':
    case 'inputbox': {
      const id = `ui_${Date.now()}`;
      let newUIElement: any = {
        id,
        type: mode,
        x: point.x,
        y: point.y,
        label: mode === 'text' ? 'Text' : mode === 'slider' ? 'Slider' : mode === 'button' ? 'Button' : 'Checkbox',
        value: mode === 'slider' ? 50 : undefined,
        min: mode === 'slider' ? 0 : undefined,
        max: mode === 'slider' ? 100 : undefined,
        step: mode === 'slider' ? 1 : undefined,
        checked: mode === 'checkbox' ? false : undefined,
      };
      // 画布滑块绑定一个**内核 GeoNumeric**（对标 GeoGebra 的 Slider 工具）：
      // 拖动画布滑块 = 改内核数值，依赖它的对象实时联动，代数视图同步可见。
      if (mode === 'slider') {
        const numeric = new GeoNumeric(kernel, 50);
        numeric.intervalMin = 0;
        numeric.intervalMax = 100;
        const construction = kernel.getConstruction();
        numeric.label = construction.getNextNumericLabel();
        construction.addElement(numeric);
        construction.updateDependentAlgorithms(numeric);
        newUIElement.numericLabel = numeric.label;
        setRenderRev?.(r => r + 1);
      }
      // 输入框绑定**最近的自由数值**（对标官方 InputBox：输入即改绑定值）；
      // 无自由数值时创建一个 a=1 兜底
      if (mode === 'inputbox') {
        const construction = kernel.getConstruction();
        const target = [...construction.getElements()].reverse().find(
          el => el instanceof GeoNumeric && el.isIndependent()) as GeoNumeric | undefined;
        let bound = target;
        if (!bound) {
          bound = new GeoNumeric(kernel, 1);
          bound.label = construction.getNextNumericLabel();
          construction.addElement(bound);
        }
        newUIElement.numericLabel = bound.label;
        newUIElement.label = bound.label;
        setRenderRev?.(r => r + 1);
      }
      // 复选框绑定**内核 GeoBoolean**（此前只是 React state，刷新即丢）：
      // 勾选状态入内核/undo/序列化；创建后进入"点击对象建立显隐联动"阶段。
      if (mode === 'checkbox') {
        const boolean = new GeoBoolean(kernel, false);
        const construction = kernel.getConstruction();
        boolean.label = construction.getNextNumericLabel();
        construction.addElement(boolean);
        kernel.notifyUpdate(boolean);
        newUIElement.booleanLabel = boolean.label;
        ts.checkboxBoolean = boolean;
        setRenderRev?.(r => r + 1);
      }
      setUIElements?.([...(ctx.uiElements ?? []), newUIElement]);
      setEditingUIElement?.(id);
      break;
    }

    // ============================================================
    // Phase 3：2D 功能扩展
    // ============================================================
    case 'vector':
      twoPointBuild(AlgoVector as any);
      break;

    case 'polyline': {
      const pHit = hitPoint() ?? emptyClickNewPoint();
      const pts = (ts.polylinePts as GeoPoint[]) ?? [];
      if (pts.length > 1 && pHit === pts[0]) {
        const pl = new AlgoPolyLine(kernel, [...pts]);
        addAlgoAndNotify(pl);
        (ts.polylinePts as any) = [];
        clearSel();
        setRenderRev(r => r + 1);
      } else {
        (ts.polylinePts as any) = [...pts, pHit];
        setRenderRev(r => r + 1);
      }
      break;
    }

    case 'semicircle':
      twoPointBuild(AlgoSemicircle as any);
      break;

    case 'sector': {
      const picks = [...((ts.sectorPicks as any) ?? [])];
      const picked = hitPoint();
      picks.push(picked ?? emptyClickNewPoint());
      if (picks.length >= 3) {
        const [c, s, e] = picks.slice(0, 3) as GeoPoint[];
        const algo = new AlgoCircularSector(kernel, c, s, e);
        addAlgoAndNotify(algo);
        (ts.sectorPicks as any) = [];
        clearSel();
        setRenderRev(r => r + 1);
      } else {
        (ts.sectorPicks as any) = picks;
        setRenderRev(r => r + 1);
      }
      break;
    }

    case 'circumcircular_arc':
    case 'circumcircular_sector': {
      const picks = [...((ts.circArcPicks as any) ?? [])];
      const picked = hitPoint();
      picks.push(picked ?? emptyClickNewPoint());
      if (picks.length >= 3) {
        const [a, b, c] = picks.slice(0, 3) as GeoPoint[];
        const algo = mode === 'circumcircular_arc'
          ? new AlgoCircumcircularArc(kernel, a, b, c)
          : new AlgoCircumcircularSector(kernel, a, b, c);
        addAlgoAndNotify(algo);
        (ts.circArcPicks as any) = [];
        clearSel();
        setRenderRev(r => r + 1);
      } else {
        (ts.circArcPicks as any) = picks;
        setRenderRev(r => r + 1);
      }
      break;
    }

    case 'slope': {
      const obj = hitObject();
      if (obj instanceof GeoLine) {
        const algo = new AlgoSlope(kernel, obj);
        algo.getOutput().label = kernel.getConstruction().getNextNumericLabel();
        kernel.getConstruction().addElement(algo);
        kernel.getConstruction().addElement(algo.getOutput());
        algo.compute();
        clearSel();
        setRenderRev(r => r + 1);
      }
      break;
    }

    case 'ellipse':
    case 'hyperbola':
    case 'parabola': {
      // 抛物线 2 步交互：第 1 击焦点（空白可新建）；第 2 击准线——
      // 命中直线则该线为准线，否则取该处水平线为准线。
      // 此前第二击强制新建游离点，"命中直线为准线"分支成了死代码，
      // 且对竖直/斜准线必然给出错误结果。
      if (mode === 'parabola') {
        if (selectedElements.length >= 1 && selectedElements[0] instanceof GeoPoint) {
          const focus = selectedElements[0];
          const el = hitObject();
          const directrix = el instanceof GeoLine ? el : new GeoLine(kernel, 0, 1, -point.y);
          const algo = new AlgoParabola(kernel, focus, directrix);
          addAlgoAndNotify(algo);
          clearSel();
          setRenderRev(r => r + 1);
          break;
        }
        const pFocus = hitPoint() ?? emptyClickNewPoint();
        if (pFocus) { setSelectedElements([pFocus]); setRenderRev(r => r + 1); }
        break;
      }
      // 椭圆/双曲线：三击——焦点1、焦点2、曲线上一点（空白可新建）
      const pHit = hitPoint() ?? emptyClickNewPoint();
      if (pHit) {
        const current = [...selectedElements, pHit];
        if (current.length === 3 && current.every(e => e instanceof GeoPoint)) {
          const [f1, f2, p] = current as GeoPoint[];
          const algo = mode === 'ellipse'
            ? new AlgoEllipse(kernel, f1, f2, p)
            : new AlgoHyperbola(kernel, f1, f2, p);
          addAlgoAndNotify(algo);
          clearSel();
          setRenderRev(r => r + 1);
        } else {
          setSelectedElements(current);
          setRenderRev(r => r + 1);
        }
      }
      break;
    }

    case 'conic5': {
      const pHit = hitPoint();
      if (pHit) {
        const current = [...selectedElements, pHit];
        if (current.length === 5 && current.every(e => e instanceof GeoPoint)) {
          const algo = new AlgoConicFivePoints(kernel, current as GeoPoint[]);
          addAlgoAndNotify(algo);
          clearSel();
          setRenderRev(r => r + 1);
        } else {
          setSelectedElements(current);
          setRenderRev(r => r + 1);
        }
      }
      break;
    }

    case 'compass': {
      const pHit = hitPoint();
      if (pHit) {
        const current = [...selectedElements, pHit];
        if (current.length === 3 && current.every(e => e instanceof GeoPoint)) {
          const [a, b, c] = current as GeoPoint[];
          const algo = new AlgoCompass(kernel, a, b, c);
          addAlgoAndNotify(algo);
          clearSel();
          setRenderRev(r => r + 1);
        } else {
          setSelectedElements(current);
          setRenderRev(r => r + 1);
        }
      }
      break;
    }

    default:
      break;
  }
};

export const clearToolState = (ts: any) => {
  ts.inputs = []; ts.center = null; ts.transformRef = null; ts.refStart = null;
  ts.centerIsPoint = false; ts.axis = null; ts.axisStart = null;
  ts.regPolyStart = null; (ts.arcPicks as any) = [];
  ts.fixedStart = null; ts.fixedLength = null;
  ts.angleVertex = null; ts.angleDegrees = null;
  ts.polylinePts = []; ts.sectorPicks = []; ts.circArcPicks = [];
  ts.checkboxBoolean = null;
};

export const toolHandlers: Record<ToolMode, (ctx: ToolContext, point: WorldPoint, screen: ScreenPoint) => ToolResult | void> = {} as unknown as any;
TOOL_MODE_LIST.forEach(m => { toolHandlers[m] = handlePointerDown; });
