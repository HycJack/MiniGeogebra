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
import { GeoNumeric } from '../../kernel/geo/GeoNumeric';
import { GeoLocus } from '../../kernel/geo/GeoLocus';
import { GeoFunction } from '../../kernel/geo/GeoFunction';
import { GeoVec3D } from '../../kernel/core/GeoVec3D';
import { WorldPoint, ScreenPoint, ToolContext, ToolResult, ToolMode } from './types';
import { hitScreenPoint, hitScreenObject, hitCircle, functionParameterAt, lineFromTwoPoints } from './hitTests';
import {
  createLabeledPoint, addPoint, createParameterPointOnPath,
  nextDistanceLabel, nextAngleLabel, nextAreaLabel,
} from './createElements';
import {
  AlgoLineTwoPoints, AlgoSegmentTwoPoints, AlgoMidpoint, AlgoCirclePointRadius,
  AlgoCircleCenterPoint, AlgoCircleThreePoints, AlgoIntersect, AlgoParallelLine,
  AlgoOrthogonalLine, AlgoPerpendicularBisector, AlgoAngleBisector, AlgoTangent,
  AlgoLocus, AlgoDistance, AlgoAngle, AlgoArea, AlgoArc,
  AlgoRegularPolygon, AlgoCircleCenter,
  buildTransformed,
} from '../../kernel/algo';
import { shearStretchMatrix } from '../../kernel/algo/AlgoRotate';
import { AlgoRayTwoPoints } from '../../kernel/algo/AlgoRayTwoPoints';
import {
  AlgoVector, AlgoPolyLine, AlgoSemicircle, AlgoCircularSector,
  AlgoCircumcircularArc, AlgoCircumcircularSector, AlgoSlope, AlgoEllipse, AlgoHyperbola,
  AlgoParabola, AlgoConicFivePoints, AlgoCompass,
} from '../../kernel/algo';
import { GeoConicPart } from '../../kernel/geo/GeoConicPart';
import { GeoArc } from '../../kernel/geo/GeoArc';
import { GeoVector } from '../../kernel/geo/GeoVector';
import { GeoPolyLine } from '../../kernel/geo/GeoPolyLine';
import { GeoRay } from '../../kernel/geo/GeoRay';
import { GeoElement } from '../../kernel/geo/GeoElement';
import { AlgoPointOnFunction } from '../../kernel/algo/AlgoPointOnFunction';

// ---- 命中热区 ----
const POINT_EPS = 10;   // 点热区（像素）
const OBJ_EPS = 5;      // 线/曲线热区（世界单位像素当量）

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
  const visibleElements = elements.filter(el => (el as GeoElement).visible !== false);
  const hitPoint = () => hitScreenPoint(visibleElements, point.x, point.y, POINT_EPS / coord.xScale);
  const hitObject = () => hitScreenObject(visibleElements, point.x, point.y, OBJ_EPS / coord.xScale);
  const hitAnyPoint = () => hitScreenPoint(elements, point.x, point.y, POINT_EPS / coord.xScale);
  const hitAnyObject = () => hitScreenObject(elements, point.x, point.y, OBJ_EPS / coord.xScale);

  const notifyUpdate = (obj: any) => {
    const algo = obj?.parentAlgo ?? obj;
    if (algo) kernel.notifyUpdate(algo);
    else kernel.notifyUpdate(obj);
  };

  const addAlgoAndNotify = (algo: any) => {
    kernel.getConstruction().addElement(algo);
    const out = algo.getOutput();
    if (Array.isArray(out)) out.forEach(notifyUpdate);
    else if (out) notifyUpdate(out);
  };

  const selOne = (p: GeoPoint) => { setSelectedElements([p]); setRenderRev(r => r + 1); };
  const clearSel = () => { setSelectedElements([]); setRenderRev(r => r + 1); };

  /** 变换工具共用的输入收集：优先使用当前选择，否则点击/新建一个对象。 */
  const collectTransformInputs = () => {
    if (ts.inputs?.length) return ts.inputs;
    if (selectedElements.length > 0) {
      ts.inputs = selectedElements.map(el => {
        let ref: { x: number; y: number };
        if (el instanceof GeoPoint) ref = { x: el.getX(), y: el.getY() };
        else if (el instanceof GeoConic) { const c = el.getCenter(); ref = { x: c.x, y: c.y }; }
        else ref = { x: point.x, y: point.y };
        return { el, ref };
      });
      clearSel();
    } else {
      const el = hitObject() ?? hitPoint() ?? emptyClickNewPoint();
      ts.inputs = [{ el, ref: el instanceof GeoPoint ? { x: el.getX(), y: el.getY() } : { x: point.x, y: point.y } }];
    }
    return ts.inputs as { el: GeoElement; ref?: { x: number; y: number } }[];
  };

  /** 在空白处创建一个带唯一标签的自由点。 */
  const emptyClickNewPoint = (): GeoPoint => {
    const p = createLabeledPoint(kernel, point.x, point.y);
    kernel.getConstruction().addElement(p);
    kernel.notifyUpdate(p);
    return p;
  };

  /** 两点构造辅助（直线/线段/射线）：支持"先点一点 → 再点终点"和"空白点两点"两种流程。 */
  const twoPointBuild = (algoCtor: new (k: Kernel, a: GeoPoint, b: GeoPoint) => any) => {
    let picked = hitPoint();
    if (!picked && selectedElements.length === 0) picked = emptyClickNewPoint();
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

  const mode: ToolMode = ctx.mode;

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
      } else if (!multi && !shifty) {
        // 空白处左键按下 -> 启动框选
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
        obj instanceof GeoSegment || obj instanceof GeoLine ||
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
          const param = new GeoNumeric(kernel, x);
          construction.addElement(param);
          const created = new AlgoPointOnFunction(kernel, obj, param);
          construction.addElement(created);
          construction.addElement(created.getOutput());
          created.update();
          notifyUpdate(created.getOutput());
          setSelectedElements([created.getOutput()]);
          setRenderRev(r => r + 1);
          break;
        }
        const created = createParameterPointOnPath(kernel, obj, point.x, point.y);
        if (created) {
          notifyUpdate(created.point);
          setSelectedElements([created.point]);
          setRenderRev(r => r + 1);
        }
      } else {
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
      const p = hitPoint() ?? emptyClickNewPoint();
      const circle = new AlgoCirclePointRadius(kernel, p, radius ?? 50);
      addAlgoAndNotify(circle);
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
      const clicked = hitPoint();
      if (clicked) picks.push(clicked);
      else picks.push(emptyClickNewPoint());
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
          setPolygonPoints([]);
          clearSel();
        } else {
          setPolygonPoints([...pts, pHit]);
          setSelectedElements([...selectedElements, pHit]);
          setRenderRev(r => r + 1);
        }
      } else {
        const p = emptyClickNewPoint();
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
          const ang = new AlgoAngle(kernel, p1, pHit, p2);
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
      const target = elements.slice().reverse().find(el => el instanceof GeoPolygon) as GeoPolygon | undefined;
      if (target) {
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
      const pHit = hitPoint();
      if (pHit) {
        const current = [...selectedElements, pHit];
        if (current.length === 2 && current[0] instanceof GeoPoint) {
          const clickedPoint = current[0];
          const circle = elements.slice().reverse().find(el => el instanceof GeoConic) as GeoConic | undefined;
          if (circle) {
            const tan = new AlgoTangent(kernel, circle, clickedPoint);
            kernel.getConstruction().addElement(tan);
            tan.getOutputLines().forEach(l => kernel.getConstruction().addElement(l));
            tan.getOutputPoints().forEach(p => kernel.getConstruction().addElement(p));
            tan.compute();
            clearSel();
            setRenderRev(r => r + 1);
            return;
          }
        }
        setSelectedElements(current.slice(-2));
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
      const picked = hitPoint();
      picks.push(picked ?? emptyClickNewPoint());
      if (picks.length >= 3) buildArc(picks.slice(0, 3));
      else {
        (ts.arcPicks as any) = picks;
        setRenderRev(r => r + 1);
      }
      break;
    }

    case 'regular_polygon': {
      const clicked = hitPoint() ?? emptyClickNewPoint();
      if (!ts.regPolyCenter) {
        ts.regPolyCenter = clicked;
        selOne(clicked);
      } else {
        const center = ts.regPolyCenter;
        if (center === clicked) { ts.regPolyCenter = null; break; }
        const r = Math.hypot(clicked.getX() - center.getX(), clicked.getY() - center.getY());
        if (r <= EPS) { ts.regPolyCenter = null; break; }
        const polyAlgo = new AlgoRegularPolygon(kernel, center, r, 6);
        addAlgoAndNotify(polyAlgo);
        clearSel();
        ts.regPolyCenter = null;
        setRenderRev(r => r + 1);
      }
      break;
    }

    case 'rotate':
    case 'dilate': {
      const op = mode === 'rotate' ? 'rotate' : 'dilate';
      if ((!ts.inputs || ts.inputs.length === 0) && selectedElements.length === 0) {
        ts.inputs = [{ el: hitPoint() ?? emptyClickNewPoint(), ref: { x: point.x, y: point.y } }];
        setSelectedElements([]);
        setRenderRev(r => r + 1);
        return;
      }
      if ((ts.inputs?.length ?? 0) === 0) {
        ts.inputs = selectedElements.map(el => {
          let ref: { x: number; y: number };
          if (el instanceof GeoPoint) ref = { x: el.getX(), y: el.getY() };
          else if (el instanceof GeoConic) { const c = el.getCenter(); ref = { x: c.x, y: c.y }; }
          else ref = { x: point.x, y: point.y };
          return { el, ref };
        });
        setSelectedElements([]);
        setRenderRev(r => r + 1);
        return;
      }
      if (!ts.center) {
        ts.center = { x: point.x, y: point.y };
        return;
      }
      const P2 = { x: point.x, y: point.y };
      const inputs = ts.inputs;
      let angle = 0, ratio = 1;
      if (op === 'rotate') {
        angle = Math.atan2(P2.y - ts.center.y, P2.x - ts.center.x) -
                Math.atan2(inputs[0].ref!.y - ts.center.y, inputs[0].ref!.x - ts.center.x);
      } else {
        ratio = Math.hypot(P2.x - ts.center.x, P2.y - ts.center.y) /
                Math.hypot(inputs[0].ref!.x - ts.center.x, inputs[0].ref!.y - ts.center.y);
      }
      const outs: ConstructionElement[] = [];
      for (const { el } of inputs) outs.push(buildTransformed(kernel, el, op, { center: ts.center, angle, ratio }));
      outs.forEach(o => { kernel.getConstruction().addElement(o); notifyUpdate(o); });
      clearSel();
      setRenderRev(r => r + 1);
      ts.inputs = []; ts.center = null;
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
              ts.transformRef = { kind: 'line', axis: { a: axisObject.a, b: axisObject.b, c: axisObject.c } };
            } else if (!ts.refStart) {
              ts.refStart = { x: point.x, y: point.y };
            } else {
              ts.transformRef = { kind: 'line', axis: lineFromTwoPoints(ts.refStart, { x: point.x, y: point.y }) };
            }
            if (!ts.transformRef) return;
          }

          const raw = window.prompt(t(mode === 'shear' ? 'shearFactorPrompt' : 'stretchFactorPrompt'), '1');
          if (raw === null) return;
          const factor = Number(raw);
          if (!isFinite(factor)) return;

          try {
            const matrix = shearStretchMatrix(
              ts.transformRef.axis.a, ts.transformRef.axis.b, ts.transformRef.axis.c,
              factor, mode,
            );
            const outs: ConstructionElement[] = [];
            for (const { el } of ts.inputs) outs.push(buildTransformed(kernel, el, mode, { matrix }));
            outs.forEach(out => { kernel.getConstruction().addElement(out); notifyUpdate(out); });
            clearSel();
            setRenderRev(r => r + 1);
            ts.inputs = []; ts.transformRef = null; ts.refStart = null;
          } catch {
            // Degenerate axes stay in the current step so the user can pick another line.
          }
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

        const source = hitObject() ?? hitPoint() ?? emptyClickNewPoint();
        ts.inputs = [{
          el: source,
          ref: source instanceof GeoPoint ? { x: source.getX(), y: source.getY() } : { x: point.x, y: point.y },
        }];
        clearSel();
        return;
      }

      if ((!ts.inputs || ts.inputs.length === 0) && selectedElements.length === 0) {
        ts.inputs = [{ el: hitPoint() ?? emptyClickNewPoint(), ref: { x: point.x, y: point.y } }];
        setSelectedElements([]);
        setRenderRev(r => r + 1);
        return;
      }
      if ((ts.inputs?.length ?? 0) === 0) {
        ts.inputs = selectedElements.map(el => {
          let ref: { x: number; y: number };
          if (el instanceof GeoPoint) ref = { x: el.getX(), y: el.getY() };
          else if (el instanceof GeoConic) { const c = el.getCenter(); ref = { x: c.x, y: c.y }; }
          else ref = { x: point.x, y: point.y };
          return { el, ref };
        });
        setSelectedElements([]);
        setRenderRev(r => r + 1);
        return;
      }
      const obj = hitObject();
      if (!ts.axis) {
        if (obj instanceof GeoLine) ts.axis = { a: obj.a, b: obj.b, c: obj.c };
        else ts.axisStart = { x: point.x, y: point.y };
        return;
      }
      if (ts.axisStart) {
        ts.axis = lineFromTwoPoints(ts.axisStart, { x: point.x, y: point.y });
        ts.axisStart = null;
        return;
      }
      const outs: ConstructionElement[] = [];
      for (const { el } of ts.inputs) outs.push(buildTransformed(kernel, el, 'mirror', ts.axis));
      outs.forEach(o => { kernel.getConstruction().addElement(o); notifyUpdate(o); });
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
            ts.transformRef = { kind: 'line', axis: { a: axisObject.a, b: axisObject.b, c: axisObject.c } };
            return;
          }
          ts.refStart = { x: point.x, y: point.y };
          return;
        }
        if (ts.refStart && !ts.transformRef) {
          ts.transformRef = { kind: 'line', axis: lineFromTwoPoints(ts.refStart, { x: point.x, y: point.y }) };
        }
        ts.refStart = null;
        const inputs = collectTransformInputs();
        for (const { el } of inputs) {
          const out = buildTransformed(kernel, el, 'mirror', ts.transformRef.axis);
          kernel.getConstruction().addElement(out);
          notifyUpdate(out);
        }
      } else if (mode === 'mirror_point') {
        if (!ts.transformRef) {
          const centerPoint = hitPoint() ?? emptyClickNewPoint();
          ts.transformRef = { kind: 'point', center: { x: centerPoint.getX(), y: centerPoint.getY() } };
          return;
        }
        const inputs = collectTransformInputs();
        for (const { el } of inputs) {
          const out = buildTransformed(kernel, el, 'dilate', {
            center: ts.transformRef.center,
            ratio: -1,
          });
          kernel.getConstruction().addElement(out);
          notifyUpdate(out);
        }
      } else if (mode === 'mirror_circle') {
        if (!ts.transformRef) {
          const circle = hitCircle(visibleElements, point.x, point.y, OBJ_EPS / coord.xScale);
          if (!circle) return;
          const center = circle.getCenter();
          ts.transformRef = { kind: 'circle', center, radius: circle.getRadius() };
          return;
        }
        const inputs = collectTransformInputs();
        for (const { el } of inputs) {
          const out = buildTransformed(kernel, el, 'invert', ts.transformRef);
          kernel.getConstruction().addElement(out);
          notifyUpdate(out);
        }
      } else {
        if (!ts.transformRef) {
          const vector = hitObject();
          if (!(vector instanceof GeoVector)) return;
          ts.transformRef = {
            kind: 'vector',
            vector: { x: vector.getVector().x, y: vector.getVector().y },
          };
        }
        const inputs = collectTransformInputs();
        for (const { el } of inputs) {
          const out = buildTransformed(kernel, el, 'translate', ts.transformRef.vector);
          kernel.getConstruction().addElement(out);
          notifyUpdate(out);
        }
      }
      clearSel();
      setRenderRev(r => r + 1);
      ts.inputs = []; ts.transformRef = null; ts.refStart = null;
      return;
    }

    case 'segment_fixed': {
      if (!ts.fixedStart) {
        const start = hitPoint() ?? emptyClickNewPoint();
        const input = window.prompt(t('fixedLengthPrompt'), '5');
        const length = Number(input);
        if (input === null || !isFinite(length) || length <= 0) return;
        ts.fixedStart = start;
        ts.fixedLength = length;
        setRenderRev(r => r + 1);
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
        ts.angleVertex = hitPoint() ?? emptyClickNewPoint();
        const input = window.prompt(t('fixedAnglePrompt'), '60');
        const degrees = Number(input);
        if (input === null || !isFinite(degrees)) {
          ts.angleVertex = null;
          return;
        }
        ts.angleDegrees = degrees;
        setRenderRev(r => r + 1);
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
    case 'checkbox': {
      const id = `ui_${Date.now()}`;
      const newUIElement: any = {
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
        algo.getOutput().label = 'm';
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
      const pHit = hitPoint();
      if (pHit) {
        const current = [...selectedElements, pHit];
        if (mode === 'parabola' && current.length === 2) {
          const line = elements.slice().reverse().find(el => el instanceof GeoLine) as GeoLine | undefined;
          if (line) {
            const algo = new AlgoParabola(kernel, current[0] as GeoPoint, line);
            addAlgoAndNotify(algo);
            clearSel();
            setRenderRev(r => r + 1);
            break;
          }
        }
        if (current.length === 3 && current.every(e => e instanceof GeoPoint)) {
          const [f1, f2, p] = current as GeoPoint[];
          const algo = mode === 'ellipse'
            ? new AlgoEllipse(kernel, f1, f2, p)
            : mode === 'hyperbola'
            ? new AlgoHyperbola(kernel, f1, f2, p)
            : new AlgoParabola(kernel, f1, new GeoLine(kernel, 0, 1, -f2.getY()));
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
  ts.regPolyCenter = null; (ts.arcPicks as any) = [];
  ts.fixedStart = null; ts.fixedLength = null;
  ts.angleVertex = null; ts.angleDegrees = null;
  ts.polylinePts = []; ts.sectorPicks = []; ts.circArcPicks = [];
};

export const toolHandlers: Record<ToolMode, (ctx: ToolContext, point: WorldPoint, screen: ScreenPoint) => ToolResult | void> = {} as unknown as any;
TOOL_MODE_LIST.forEach(m => { toolHandlers[m] = handlePointerDown; });
