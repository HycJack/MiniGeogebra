import { Kernel } from '../core/Kernel';
import { ConstructionElement } from '../core/ConstructionElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoVec3D } from '../core/GeoVec3D';
import { AlgoElement } from '../algo/AlgoElement';
import { AlgoLineTwoPoints } from '../algo/AlgoLineTwoPoints';
import { AlgoSegmentTwoPoints } from '../algo/AlgoSegmentTwoPoints';
import { AlgoMidpoint } from '../algo/AlgoMidpoint';
import { AlgoCirclePointRadius } from '../algo/AlgoCirclePointRadius';
import { AlgoCircleCenterPoint } from '../algo/AlgoCircleCenterPoint';
import { AlgoCircleThreePoints } from '../algo/AlgoCircleThreePoints';
import { AlgoCircleCenter } from '../algo/AlgoCircleCenter';
import { AlgoIntersect } from '../algo/AlgoIntersect';
import { AlgoIntersectFunctions, INTERSECT_FUNCTIONS_CAPACITY } from '../algo/AlgoIntersectFunctions';
import { AlgoParallelLine } from '../algo/AlgoParallelLine';
import { AlgoOrthogonalLine } from '../algo/AlgoOrthogonalLine';
import { AlgoPerpendicularBisector } from '../algo/AlgoPerpendicularBisector';
import { AlgoAngleBisector } from '../algo/AlgoAngleBisector';
import { AlgoPointOnLine } from '../algo/AlgoPointOnLine';
import { AlgoPointOnSegment } from '../algo/AlgoPointOnSegment';
import { AlgoPointOnConic } from '../algo/AlgoPointOnConic';
import { AlgoPointOnPolyLine } from '../algo/AlgoPointOnPolyLine';
import { AlgoPointOnRay } from '../algo/AlgoPointOnRay';
import { AlgoPointOnLine3D, AlgoPointOnCircle3D, AlgoPointOnConic3D, AlgoPointOnPolyline3D, AlgoPointInPlane3D, AlgoPointOnSphere3D } from '../algo/AlgoPointOn3D';
import { AlgoTranslate } from '../algo/AlgoTranslate';
import { AlgoDistance } from '../algo/AlgoDistance';
import { AlgoAngle } from '../algo/AlgoAngle';
import { AlgoArea } from '../algo/AlgoArea';
import { AlgoPerimeter } from '../algo/AlgoPerimeter';
import { AlgoTangent } from '../algo/AlgoTangent';
import { AlgoLocus } from '../algo/AlgoLocus';
import { AlgoLocus3D } from '../algo/AlgoLocus3D';
import { AlgoPolygonBoolean } from '../algo/AlgoPolygonBoolean';
import { AlgoPolygonPoints } from '../algo/AlgoPolygonPoints';
import { GeoBooleanRegion } from '../geo/GeoBooleanRegion';
import { GeoMesh3D } from '../geo/GeoMesh3D';
import { AlgoVector } from '../algo/AlgoVector';
import { AlgoPolyLine } from '../algo/AlgoPolyLine';
import { AlgoSemicircle } from '../algo/AlgoSemicircle';
import { AlgoCircularSector } from '../algo/AlgoCircularSector';
import { AlgoCircumcircularSector } from '../algo/AlgoCircumcircularSector';
import { AlgoCircumcircularArc } from '../algo/AlgoCircumcircularArc';
import { AlgoArc } from '../algo/AlgoArc';
import { AlgoSlope } from '../algo/AlgoSlope';
import { AlgoFitPoly } from '../algo/AlgoFitPoly';
import { AlgoFunctionRootPoint } from '../algo/AlgoFunctionRootPoint';
import { AlgoText } from '../algo/AlgoText';
import { AlgoDependentText } from '../algo/AlgoDependentText';
import { AlgoAngleOriented } from '../algo/AlgoAngle';
import { GeoText } from '../geo/GeoText';
import { GeoList } from '../geo/GeoList';
import { GeoBoolean } from '../geo/GeoBoolean';
import { AlgoRootList, ROOT_LIST_CAPACITY } from '../algo/AlgoRootList';
import { AlgoFunctionExtremumPoint } from '../algo/AlgoFunctionExtremumPoint';
import { AlgoExtremumList, EXTREMUM_LIST_CAPACITY } from '../algo/AlgoExtremumList';
import { AlgoEllipse } from '../algo/AlgoEllipse';
import { AlgoHyperbola } from '../algo/AlgoHyperbola';
import { AlgoParabola } from '../algo/AlgoParabola';
import { AlgoConicFivePoints } from '../algo/AlgoConicFivePoints';
import { AlgoCompass } from '../algo/AlgoCompass';
import { AlgoPointOnFunction } from '../algo/AlgoPointOnFunction';
import { AlgoRayTwoPoints } from '../algo/AlgoRayTwoPoints';
import { AlgoDependentFunction } from '../algo/AlgoDependentFunction';
import { AlgoDependentNumeric } from '../algo/AlgoDependentNumeric';
import { AlgoDerivative } from '../algo/AlgoDerivative';
import {
  AlgoDependentCurve, AlgoPointOnCurve, AlgoTangentFunctionNumber, AlgoTangentCurve,
  AlgoCurvature, AlgoOsculatingCircle,
} from '../algo/AlgoCurveFamily';
import { AlgoPointInRegion, AlgoIsInRegion, AlgoRandomPointIn } from '../algo/AlgoRegion';
import { AlgoDependentInequality } from '../algo/AlgoDependentInequality';
import { AlgoDependentQuadric3D } from '../algo/AlgoDependentQuadric3D';
import { AlgoRotate, AlgoDilate, AlgoMirror } from '../algo/AlgoRotate';
import { AlgoShearStretch, AlgoInvert } from '../algo/AlgoShearStretch';
import { AlgoRegularPolygon } from '../algo/AlgoRegularPolygon';
import { AlgoRegularPolygonEdge } from '../algo/AlgoRegularPolygonEdge';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoConic } from '../geo/GeoConic';
import { GeoArc } from '../geo/GeoArc';
import { GeoConicPart, type ConicPartType } from '../geo/GeoConicPart';
import { GeoLine } from '../geo/GeoLine';
import { GeoVector } from '../geo/GeoVector';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoLine3D } from '../geo/GeoLine3D';
import { GeoPlane3D } from '../geo/GeoPlane3D';
import { Coords4 } from '../core/Coords4';
import { AlgoJoinPoints3D, AlgoMidpoint3D, AlgoPlaneThreePoints3D, AlgoIntersectLinePlane3D, AlgoDistancePointPlane3D } from '../algo/Algo3D';
import { GeoQuadric3D } from '../geo/GeoQuadric3D';
import { GeoPolyhedron3D } from '../algo/AlgoPolyhedron3D';
import { GeoSurface } from '../geo/GeoSurface';
import { AlgoSphere3D, AlgoCylinder3D, AlgoCone3D, AlgoIntersectLineQuadric3D, AlgoPrism3D, AlgoPyramid3D, AlgoVolume3D, AlgoAngleLines3D, AlgoAnglePlanes3D } from '../algo/AlgoPolyhedron3D';
import { AlgoDependentSurface } from '../algo/AlgoDependentSurface';
import { AlgoSurfaceOfRevolution } from '../algo/AlgoSurfaceOfRevolution';
import { GeoCircle3D } from '../geo/GeoCircle3D';
import { GeoPolyline3D } from '../geo/GeoPolyline3D';
import { AlgoCircleThreePoints3D, AlgoTranslate3D, AlgoRotatePoint3D, AlgoMirrorPoint3D, AlgoIntersectPathPlanePolyhedron } from '../algo/Algo3DAdvanced';
import { AlgoTransformLine3D, AlgoTransformCircle3D, AlgoTransformPolyhedron3D, AlgoIntersectPlaneQuadric, Transform3DArgs } from '../algo/AlgoTransformGeo3D';
import { AlgoEllipsoid3D } from '../algo/AlgoPolyhedron3D';
import { GeoConic3D } from '../geo/GeoConic3D';
import { AlgoEllipse3D, AlgoHyperbola3D, AlgoIntersectConicPlaneQuadric, AlgoParabola3D } from '../algo/AlgoConic3D';
import { GeoNet3D, AlgoPolyhedronNet } from '../algo/AlgoPolyhedronNet';
import {
  AlgoConicFocus, AlgoConicVertex, AlgoConicAsymptote, AlgoConicDirectrix, AlgoConicAxis,
  AlgoConicEccentricity, AlgoConicParameter, AlgoConicRadius, AlgoPolarLine, AlgoIsTangent,
} from '../algo/AlgoConicProperties';
import {
  AlgoCentroid, AlgoIncenter, AlgoOrthocenter, AlgoIncircle,
  AlgoAreCollinear, AlgoAreParallel, AlgoArePerpendicular, AlgoAreConcyclic, AlgoAreCongruent,
} from '../algo/AlgoTriangleCenters';
import { parseAlgebraInput } from '../algebra/EquationRecognizer';
import { expressionToString } from '../algebra/Differentiator';
import { GeoFunction } from '../geo/GeoFunction';
import { AnimationType } from '../geo/GeoNumeric';
import { CoordinateSystem } from '../core/CoordinateSystem';

/**
 * Serialization / Deserialization for constructions.
 *
 * Design (aligned with GeoGebra replay semantics):
 *   - Save independent elements + algorithm chain; derived objects are recomputed.
 *   - constIndex as reference key; deserialization rebuilds in constIndex ascending order.
 *   - view (coordinate system state) is saved alongside.
 *   - AlgoDependentFunction/Numeric use expression-based reconstruction.
 *   - Algo outputs are registered in the index map for downstream algorithm inputs.
 */

interface SerializedElement {
  type: string;
  /** GeoText 文本内容 */
  text?: string;
  constIndex: number;
  label: string;
  coords?: [number, number, number];
  value?: number;
  intervalMin?: number;
  intervalMax?: number;
  animationSpeed?: number;
  animationIncrement?: number;
  animationType?: number;
  /** GeoPolygon 顶点的 constIndex（顶点可能晚于多边形注册，反序列化时延迟解析）。 */
  vertices?: number[];
  /** GeoConic 的一般式系数（自由圆锥曲线） */
  coeffs?: number[];
  /** 自由 GeoLine 的 ax+by+c=0 系数（活镜轴/剪切轴 roundtrip） */
  lineCoeffs?: [number, number, number];
  /** GeoPoint3D 的 (x, y, z) */
  coords3?: [number, number, number];
  /** GeoMesh3D 的顶点 / 面索引 / 可选面颜色 */
  meshVertices?: [number, number, number][];
  meshFaces?: number[][];
  meshFaceColors?: string[];
  /** 自由 GeoArc / GeoConicPart 的圆几何（v4 起，此前这两类被静默丢弃） */
  arc?: {
    cx: number; cy: number; r: number;
    startAngle: number; endAngle: number; ccw: boolean; partType?: number;
  };
  /** GeoBoolean 的当前值与关联对象标签 */
  booleanValue?: boolean;
  linkedLabels?: string[];
  style?: Record<string, unknown>;
}

export interface SerializedAlgorithm {
  type: string;
  constIndex: number;
  inputs: number[];
  outputLabels: string[];
  outputIndices: number[];
  expressionText?: string;
  variableName?: string;
  /** 构造期标量参数（旋转角/缩放比/镜像轴系数/边数等）。 */
  scalars?: number[];
  /** AlgoDependentCurve 的 x(t)/y(t) 文本。 */
  curveX?: string;
  curveY?: string;
}

export interface ConstructionJSON {
  version: number;
  generator: string;
  /** v3 起：世界坐标 y 向上为正。缺省 = 旧 v1/v2 的 y-down 存档，读取时镜像迁移。 */
  yUp?: boolean;
  view?: {
    xZero: number;
    yZero: number;
    xScale: number;
    yScale: number;
    width: number;
    height: number;
  };
  /** v4 起：视图级选项（rounding / 角度单位 / 点捕捉），缺省用内核默认值。 */
  options?: {
    rounding: number;
    angleUnit: string;
    pointCapturing: string;
  };
  /** v4.3 起：画布 UI 元素（slider/checkbox/button/inputbox/text 的位置与绑定）。 */
  uiWidgets?: SerializedUIWidget[];
  independentElements: SerializedElement[];
  algorithms: SerializedAlgorithm[];
}

export interface SerializedUIWidget {
  id: string;
  type: 'text' | 'slider' | 'button' | 'checkbox' | 'inputbox';
  x: number;
  y: number;
  label?: string;
  numericLabel?: string;
  booleanLabel?: string;
  script?: string[];
}

const GENERATOR = 'MiniGeogebra';
const VERSION = 4;

/** 统一的样式快照（含标签偏移与元能力位），serialize 各分支与 restoreStyle 共用。 */
function styleOf(el: GeoElement): Record<string, unknown> {
  return {
    strokeColor: el.strokeColor,
    strokeWidth: el.strokeWidth,
    strokeDash: el.strokeDash ? [...el.strokeDash] : [],
    fillColor: el.fillColor,
    labelVisible: el.labelVisible,
    labelMode: el.labelMode,
    visible: el.visible,
    labelOffsetX: el.labelOffsetX,
    labelOffsetY: el.labelOffsetY,
    isFixed: el.isFixed,
    trace: el.trace,
    layer: el.layer,
  };
}

/** 提取算法的重建附加信息（scalars/expressionText/类型改写），序列化与重定义重建共用。 */
export function collectAlgoExtras(algo: AlgoElement): Partial<SerializedAlgorithm> {
  const extras: Partial<SerializedAlgorithm> = {};
      if (algo instanceof AlgoDependentFunction) {
        extras.expressionText = algo.getExpressionText();
        extras.variableName = algo.getVariableName();
      } else if (algo instanceof AlgoDependentNumeric) {
        extras.expressionText = algo.getExpressionText();
      } else if (algo instanceof AlgoDependentInequality) {
        // 不等式按原始文本重建（parseAlgebraInput 会重新走不等式分支）
        extras.expressionText = algo.getExpressionText();
      } else if (algo instanceof AlgoDependentQuadric3D) {
        // 一般二次曲面按原始方程文本重建
        extras.expressionText = algo.getExpressionText();
      } else if (algo instanceof AlgoDerivative) {
        // 导函数没有可直接重建的输入（其输入是源函数的数值依赖），
        // 改用"导数表达式 → 依赖函数"的等价重建路径。
        extras.type = 'AlgoDependentFunction';
        extras.expressionText = expressionToString(algo.getExpression());
        extras.variableName = algo.getVariableName();
      } else if (algo instanceof AlgoCirclePointRadius) {
        // P0-1：半径必须落盘，否则重载后恒回退 50，下游（面积/交点/切线/轨迹）全错
        extras.scalars = [algo.getRadiusValue()];
      } else if (algo instanceof AlgoRotate) {
        extras.scalars = [algo.getAngle(), algo.getCenterCoords().x, algo.getCenterCoords().y];
      } else if (algo instanceof AlgoDilate) {
        extras.scalars = [algo.getRatio(), algo.getCenterCoords().x, algo.getCenterCoords().y];
      } else if (algo instanceof AlgoFitPoly) {
        extras.scalars = [algo.getDegree()];
      } else if (algo instanceof AlgoFunctionRootPoint) {
        const [rlo, rhi] = algo.getSearchRange();
        // scalars[2] = 当前锁定根（NaN→null）：重建时恢复窗口位置
        extras.scalars = [rlo, rhi, algo.getLastSeedX()];
      } else if (algo instanceof AlgoIntersectFunctions) {
        const [rlo, rhi] = algo.getSearchRange();
        // scalars[2..] = 各槽位当前交点 x（NaN→null 占位），重建时恢复槽位连续性
        const slots = algo.getSlotXs().map(v => (Number.isFinite(v) ? v : null));
        extras.scalars = [rlo, rhi, ...slots];
      } else if (algo instanceof AlgoRootList) {
        const [rlo, rhi] = algo.getSearchRange();
        // 额外保存每个槽位的当前根（NaN→null 占位，scalars[2..]），重建时恢复窗口播种
        const slotRoots = algo.getSlotRoots().map(v => (Number.isFinite(v) ? v : null));
        extras.scalars = [rlo, rhi, ...slotRoots];
      } else if (algo instanceof AlgoFunctionExtremumPoint) {
        const [elo, ehi] = algo.getSearchRange();
        // scalars[2] = 当前锁定极值 x（NaN→null）：重建时恢复窗口位置
        extras.scalars = [elo, ehi, algo.getLastSeedX()];
      } else if (algo instanceof AlgoExtremumList) {
        const [elo, ehi] = algo.getSearchRange();
        // 额外保存每个槽位的当前极值 x（NaN→null 占位，scalars[2..]），重建时恢复窗口播种
        const slotXs = algo.getSlotRoots().map(v => (Number.isFinite(v) ? v : null));
        extras.scalars = [elo, ehi, ...slotXs];
      } else if (algo instanceof AlgoDependentText) {
        extras.expressionText = algo.getExpressionText();
        extras.scalars = [...algo.getOffset()];
      } else if (algo instanceof AlgoText) {
        extras.expressionText = algo.getOutput().text;
        extras.scalars = [...algo.getOffset()];
      } else if (algo instanceof AlgoMirror) {
        extras.scalars = [...algo.getMirrorLine()];
      } else if (algo instanceof AlgoShearStretch) {
        // [factor, opFlag, a, b, c]：opFlag 1=stretch
        extras.scalars = [algo.getFactor(), algo.getOp() === 'stretch' ? 1 : 0, ...algo.getAxis()];
      } else if (algo instanceof AlgoInvert) {
        extras.scalars = [...algo.getCircleCoords()];
      } else if (algo instanceof AlgoTranslate) {
        const v = algo.getVectorCoords();
        extras.scalars = [v.x, v.y];
      } else if (algo instanceof AlgoRegularPolygon) {
        extras.scalars = [algo.getRadiusValue(), algo.getSidesValue()];
      } else if (algo instanceof AlgoRegularPolygonEdge) {
        extras.scalars = [algo.getSidesValue()];
      } else if (algo instanceof AlgoDependentCurve) {
        extras.variableName = algo.getParameterName();
        extras.scalars = [...algo.getRange()];
        extras.curveX = algo.getExpressionTexts().x;
        extras.curveY = algo.getExpressionTexts().y;
      } else if (algo instanceof AlgoJoinPoints3D) {
        // asSegment 标志：Scalars[0] = 1 表示线段
        const isSegment = (algo.getOutput() as GeoLine3D).getLimits() !== null;
        extras.scalars = [isSegment ? 1 : 0];
      } else if (algo instanceof AlgoSphere3D) {
        extras.scalars = [algo.getRadiusValue()];
      } else if (algo instanceof AlgoCylinder3D) {
        // 活高已在 inputs；冻结高存 scalars[1]
        const h = algo.getHeightInput();
        extras.scalars = typeof h === 'number'
          ? [algo.getRadiusValue(), h]
          : [algo.getRadiusValue()];
      } else if (algo instanceof AlgoCone3D) {
        const h = algo.getHeightInput();
        extras.scalars = typeof h === 'number'
          ? [algo.getHalfAngle(), h]
          : [algo.getHalfAngle()];
      } else if (algo instanceof AlgoPrism3D) {
        const h = algo.getHeight();
        extras.scalars = h === null ? [] : [h];
      } else if (algo instanceof AlgoTranslate3D) {
        extras.scalars = [algo.getDx(), algo.getDy(), algo.getDz()];
      } else if (algo instanceof AlgoRotatePoint3D) {
        extras.scalars = [algo.getAngle()];
      } else if (algo instanceof AlgoEllipsoid3D) {
        extras.scalars = [...algo.getRadiiValue()];
      } else if (
        algo instanceof AlgoTransformLine3D ||
        algo instanceof AlgoTransformCircle3D ||
        algo instanceof AlgoTransformPolyhedron3D
      ) {
        const args = algo.getArgs();
        extras.scalars = args.op === 'translate'
          ? [0, args.dx ?? 0, args.dy ?? 0, args.dz ?? 0]
          : args.op === 'rotate'
            ? [1, args.angle ?? 0]
            : [2];
      } else if (algo instanceof AlgoDependentSurface) {
        extras.expressionText = algo.getCommandText();
      } else if (algo instanceof AlgoSurfaceOfRevolution) {
        extras.expressionText = algo.getCommandText();
      } else if (
        algo instanceof AlgoTangentFunctionNumber ||
        algo instanceof AlgoTangentCurve ||
        algo instanceof AlgoCurvature ||
        algo instanceof AlgoOsculatingCircle
      ) {
        const at = algo.getAtValue();
        if (typeof at === 'number') extras.scalars = [at];
      } else if (algo instanceof AlgoPolyhedronNet) {
        const fv = algo.getFactorInput();
        extras.scalars = typeof fv === 'number'
          ? [algo.getBaseN(), fv]
          : [algo.getBaseN()];
      } else if (algo instanceof AlgoPolygonBoolean) {
        const opIndex = { union: 0, intersection: 1, difference: 2, xor: 3 }[algo.getOp()] ?? 0;
        extras.scalars = [opIndex];
      }
  return extras;
}

/** Factory: rebuild algorithm instance by type (inputs already exist in map) */
export function createAlgo(kernel: Kernel, type: string, inputs: GeoElement[], scalars?: (number | null)[]): AlgoElement {
  const asPoint = (n: number) => inputs[n] as import('../geo/GeoPoint').GeoPoint;
  const asConic = (n: number) => inputs[n] as import('../geo/GeoConic').GeoConic;
  const asLine = (n: number) => inputs[n] as import('../geo/GeoLine').GeoLine;
  const asSegment = (n: number) => inputs[n] as import('../geo/GeoSegment').GeoSegment;
  const asPolyLine = (n: number) => inputs[n] as import('../geo/GeoPolyLine').GeoPolyLine;
  const asRay = (n: number) => inputs[n] as import('../geo/GeoRay').GeoRay;

  switch (type) {
    case 'AlgoLineTwoPoints':        return new AlgoLineTwoPoints(kernel, asPoint(0), asPoint(1));
    case 'AlgoSegmentTwoPoints':     return new AlgoSegmentTwoPoints(kernel, asPoint(0), asPoint(1));
    case 'AlgoMidpoint':             return new AlgoMidpoint(kernel, asPoint(0), asPoint(1));
    // 半径落盘；v4.2 起滑块半径作为 inputs[1]（GeoNumeric）活引用重建，
    // 旧存档无 scalars 时回退（历史上恒为 50，属既有的静默损坏，v4.1 起修复）
    case 'AlgoCirclePointRadius':    return new AlgoCirclePointRadius(kernel, asPoint(0), inputs[1] instanceof GeoNumeric ? inputs[1] : scalars?.[0] ?? (inputs[1] as any)?.value ?? 50);
    case 'AlgoCircleCenterPoint':    return new AlgoCircleCenterPoint(kernel, asPoint(0), asPoint(1));
    case 'AlgoCircleThreePoints':    return new AlgoCircleThreePoints(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoCircleCenter':         return new AlgoCircleCenter(kernel, asConic(0));
    case 'AlgoIntersect':            return new AlgoIntersect(kernel, inputs[0], inputs[1]);
    case 'AlgoParallelLine':         return new AlgoParallelLine(kernel, asPoint(0), asLine(1));
    case 'AlgoOrthogonalLine':       return new AlgoOrthogonalLine(kernel, asPoint(0), asLine(1));
    case 'AlgoPerpendicularBisector':return new AlgoPerpendicularBisector(kernel, asPoint(0), asPoint(1));
    case 'AlgoAngleBisector':        return new AlgoAngleBisector(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoPointOnLine':          return new AlgoPointOnLine(kernel, asLine(0), inputs[1] as GeoNumeric);
    case 'AlgoPointOnSegment':       return new AlgoPointOnSegment(kernel, asSegment(0), inputs[1] as GeoNumeric);
    case 'AlgoPointOnConic':         return new AlgoPointOnConic(kernel, asConic(0), inputs[1] as GeoNumeric);
    case 'AlgoPointOnPolyLine':      return new AlgoPointOnPolyLine(kernel, asPolyLine(0), inputs[1] as GeoNumeric);
    case 'AlgoPointOnRay':           return new AlgoPointOnRay(kernel, asRay(0), inputs[1] as GeoNumeric);
    case 'AlgoPointOnSphere3D':      return new AlgoPointOnSphere3D(kernel, inputs[0] as import('../geo/GeoQuadric3D').GeoQuadric3D, inputs[1] as GeoNumeric, inputs[2] as GeoNumeric);
    // ---- C10：3D path/region 依附点 ----
    case 'AlgoPointOnLine3D':        return new AlgoPointOnLine3D(kernel, inputs[0] as GeoLine3D, inputs[1] as GeoNumeric);
    case 'AlgoPointOnCircle3D':      return new AlgoPointOnCircle3D(kernel, inputs[0] as GeoCircle3D, inputs[1] as GeoNumeric);
    case 'AlgoPointOnConic3D':       return new AlgoPointOnConic3D(kernel, inputs[0] as GeoConic3D, inputs[1] as GeoNumeric);
    case 'AlgoPointOnPolyline3D':    return new AlgoPointOnPolyline3D(kernel, inputs[0] as GeoPolyline3D, inputs[1] as GeoNumeric);
    case 'AlgoPointInPlane3D':       return new AlgoPointInPlane3D(kernel, inputs[0] as GeoPlane3D);
    case 'AlgoPointOnFunction':     return new AlgoPointOnFunction(kernel, inputs[0] as import('../geo/GeoFunction').GeoFunction, inputs[1] as GeoNumeric);
    case 'AlgoRayTwoPoints':        return new AlgoRayTwoPoints(kernel, asPoint(0), asPoint(1));
    case 'AlgoTranslate':
      // 活向量走 inputs[1]；旧存档/冻结分量走 scalars [vx, vy]
      return inputs[1] instanceof GeoVector
        ? new AlgoTranslate(kernel, inputs[0], inputs[1])
        : new AlgoTranslate(kernel, inputs[0], { x: scalars?.[0] ?? 0, y: scalars?.[1] ?? 0 });
    case 'AlgoDistance':             return new AlgoDistance(kernel, inputs[0], inputs[1]);
    case 'AlgoAngle':                return new AlgoAngle(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoAngleOriented':        return new AlgoAngleOriented(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoArea':                 return new AlgoArea(kernel, inputs[0]);
    case 'AlgoPerimeter':            return new AlgoPerimeter(kernel, inputs[0] as GeoPolygon);
    case 'AlgoTangent':              return new AlgoTangent(kernel, asConic(0), asPoint(1));
    case 'AlgoLocus':                return new AlgoLocus(kernel, inputs[1] as import('../geo/GeoPoint').GeoPoint, inputs[0] as import('../geo/GeoPoint').GeoPoint);
    case 'AlgoLocus3D':              return new AlgoLocus3D(kernel, inputs[1] as GeoPoint3D, inputs[0] as GeoPoint3D);
    case 'AlgoVector':              return new AlgoVector(kernel, asPoint(0), asPoint(1));
    case 'AlgoSemicircle':          return new AlgoSemicircle(kernel, asPoint(0), asPoint(1));
    case 'AlgoPolyLine':            return new AlgoPolyLine(kernel, inputs as import('../geo/GeoPoint').GeoPoint[]);
    case 'AlgoCircularSector':      return new AlgoCircularSector(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoCircumcircularArc':   return new AlgoCircumcircularArc(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoSlope':               return new AlgoSlope(kernel, asLine(0));
    case 'AlgoEllipse':             return new AlgoEllipse(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoHyperbola':           return new AlgoHyperbola(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoParabola':            return new AlgoParabola(kernel, asPoint(0), asLine(1));
    case 'AlgoConicFivePoints':     return new AlgoConicFivePoints(kernel, inputs as import('../geo/GeoPoint').GeoPoint[]);
    case 'AlgoCompass':             return new AlgoCompass(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoArc':                 return new AlgoArc(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoCircumcircularSector': return new AlgoCircumcircularSector(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoRegularPolygon':      return new AlgoRegularPolygon(kernel, asPoint(0), scalars?.[0] ?? 50, Math.max(3, Math.round(scalars?.[1] ?? 6)));
    case 'AlgoRegularPolygonEdge':  return new AlgoRegularPolygonEdge(kernel, asPoint(0), asPoint(1), Math.max(3, Math.round(scalars?.[0] ?? 6)));
    // 变换算法：inputs[1] 为活中心（GeoPoint）/活镜轴（GeoLine）时优先使用
    // （依赖联动），否则回退到 scalars 里的构造期坐标（兼容旧存档）。
    // 活角度/活比例：v4.2 起数值输入挂在 inputs 末位（GeoNumeric），
    // 重建时优先按活引用接回；静态角度/比例仍从 scalars 恢复
    case 'AlgoRotate': {
      const angleNum = inputs.length >= 2 && inputs[inputs.length - 1] instanceof GeoNumeric
        ? inputs[inputs.length - 1] as GeoNumeric : null;
      const centerSrc = angleNum ? inputs[inputs.length - 2] : inputs[1];
      const center = centerSrc instanceof GeoPoint ? centerSrc : { x: scalars?.[1] ?? 0, y: scalars?.[2] ?? 0 };
      const angle = angleNum ? angleNum.getValue() * Math.PI / 180 : scalars?.[0] ?? 0;
      return new AlgoRotate(kernel, inputs[0], center, angle, angleNum);
    }
    case 'AlgoDilate': {
      const ratioNum = inputs.length >= 2 && inputs[inputs.length - 1] instanceof GeoNumeric
        ? inputs[inputs.length - 1] as GeoNumeric : null;
      const centerSrc = ratioNum ? inputs[inputs.length - 2] : inputs[1];
      const center = centerSrc instanceof GeoPoint ? centerSrc : { x: scalars?.[1] ?? 0, y: scalars?.[2] ?? 0 };
      const ratio = ratioNum ? ratioNum.getValue() : scalars?.[0] ?? 1;
      return new AlgoDilate(kernel, inputs[0], center, ratioNum ?? ratio);
    }
    case 'AlgoFitPoly':             return new AlgoFitPoly(kernel, inputs as import('../geo/GeoPoint').GeoPoint[], scalars?.[0] ?? 1);
    case 'AlgoFunctionRootPoint':   {
      const algo = new AlgoFunctionRootPoint(kernel, inputs[0] as GeoFunction, scalars?.[0] ?? -10, scalars?.[1] ?? 10);
      const seed = scalars?.[2];
      algo.seedLastX(seed === null || seed === undefined || !Number.isFinite(seed) ? Number.NaN : seed);
      return algo;
    }
    case 'AlgoIntersectFunctions': {
      // null 占位（禁用槽）→ NaN，再过滤成紧凑占用列表（构造函数按前 N 槽填充）
      const slots = (scalars ?? []).slice(2).map(v => (v === null || v === undefined || !Number.isFinite(v) ? Number.NaN : v))
        .filter((v: number) => Number.isFinite(v));
      return new AlgoIntersectFunctions(kernel, inputs[0] as import('../geo/GeoFunction').GeoFunction, inputs[1] as import('../geo/GeoFunction').GeoFunction, scalars?.[0] ?? -20, scalars?.[1] ?? 20, INTERSECT_FUNCTIONS_CAPACITY, slots);
    }
    case 'AlgoRootList':            {
      // null 占位（禁用槽）也要保留位置语义：转回 NaN
      const slotRoots = (scalars ?? []).slice(2).map(v => (v === null || v === undefined || !Number.isFinite(v) ? Number.NaN : v))
        .filter(v => Number.isFinite(v));
      // 传"紧凑的占用根列表"给 initialRoots（构造函数按前 N 个槽填充）
      return new AlgoRootList(kernel, inputs[0] as GeoFunction, scalars?.[0] ?? -10, scalars?.[1] ?? 10, ROOT_LIST_CAPACITY, slotRoots);
    }
    case 'AlgoFunctionExtremumPoint': {
      const algo = new AlgoFunctionExtremumPoint(kernel, inputs[0] as GeoFunction, scalars?.[0] ?? -10, scalars?.[1] ?? 10);
      const seed = scalars?.[2];
      algo.seedLastX(seed === null || seed === undefined || !Number.isFinite(seed) ? Number.NaN : seed);
      return algo;
    }
    case 'AlgoExtremumList':        {
      // null 占位（禁用槽）也要保留位置语义：转回 NaN 后滤出紧凑占用列表
      // （构造函数按前 N 个槽填充；y 坐标由 updateAllAlgorithms 重算补正）
      const slotXs = (scalars ?? []).slice(2).filter(v => Number.isFinite(v));
      const fn = inputs[0] as GeoFunction;
      const initialHits = slotXs.map(x => ({ x, y: fn.evaluateAt(x), kind: 'min' as const }));
      return new AlgoExtremumList(kernel, fn, scalars?.[0] ?? -10, scalars?.[1] ?? 10, EXTREMUM_LIST_CAPACITY, initialHits);
    }
    case 'AlgoMirror':              return inputs[1]
                                      ? new AlgoMirror(kernel, inputs[0], scalars?.[0] ?? 0, scalars?.[1] ?? 1, scalars?.[2] ?? 0, asLine(1))
                                      : new AlgoMirror(kernel, inputs[0], scalars?.[0] ?? 0, scalars?.[1] ?? 1, scalars?.[2] ?? 0);
    // shear/stretch：活轴走 inputs[1]，冻结系数 scalars = [factor, opFlag, a, b, c]
    case 'AlgoShearStretch': {
      const op = (scalars?.[1] ?? 0) === 1 ? 'stretch' : 'shear';
      const frozen: [number, number, number] = [scalars?.[2] ?? 0, scalars?.[3] ?? 1, scalars?.[4] ?? 0];
      return new AlgoShearStretch(
        kernel, inputs[0],
        inputs[1] instanceof GeoLine ? inputs[1] : frozen,
        scalars?.[0] ?? 1, op,
      );
    }
    // 圆反演：活圆走 inputs[1]，冻结圆心+半径 scalars = [cx, cy, r]
    case 'AlgoInvert':
      return inputs[1] instanceof GeoConic
        ? new AlgoInvert(kernel, inputs[0], inputs[1])
        : new AlgoInvert(kernel, inputs[0], {
            center: { x: scalars?.[0] ?? 0, y: scalars?.[1] ?? 0 },
            radius: scalars?.[2] ?? 1,
          });
    // ---- 圆锥曲线解析属性 / 三角形中心 / 关系判断 ----
    case 'AlgoConicFocus':          return new AlgoConicFocus(kernel, asConic(0));
    case 'AlgoConicVertex':         return new AlgoConicVertex(kernel, asConic(0));
    case 'AlgoConicAsymptote':      return new AlgoConicAsymptote(kernel, asConic(0));
    case 'AlgoConicDirectrix':      return new AlgoConicDirectrix(kernel, asConic(0));
    case 'AlgoConicAxis':           return new AlgoConicAxis(kernel, asConic(0));
    case 'AlgoConicEccentricity':   return new AlgoConicEccentricity(kernel, asConic(0));
    case 'AlgoConicParameter':      return new AlgoConicParameter(kernel, asConic(0));
    case 'AlgoConicRadius':         return new AlgoConicRadius(kernel, asConic(0));
    case 'AlgoPolarLine':           return new AlgoPolarLine(kernel, asPoint(0), asConic(1));
    case 'AlgoIsTangent':           return new AlgoIsTangent(kernel, inputs[0], inputs[1]);
    case 'AlgoCentroid':            return new AlgoCentroid(kernel, inputs);
    case 'AlgoIncenter':            return new AlgoIncenter(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoOrthocenter':         return new AlgoOrthocenter(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoIncircle':            return new AlgoIncircle(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoAreCollinear':        return new AlgoAreCollinear(kernel, asPoint(0), asPoint(1), asPoint(2));
    case 'AlgoAreParallel':         return new AlgoAreParallel(kernel, inputs[0], inputs[1]);
    case 'AlgoArePerpendicular':    return new AlgoArePerpendicular(kernel, inputs[0], inputs[1]);
    case 'AlgoAreConcyclic':        return new AlgoAreConcyclic(kernel, inputs);
    case 'AlgoAreCongruent':        return new AlgoAreCongruent(kernel, inputs);
    // ---- 参数曲线 / 区域 / 曲率 ----
    case 'AlgoPointOnCurve':        return new AlgoPointOnCurve(kernel, inputs[0] as import('../geo/GeoCurve').GeoCurve, inputs[1] as GeoNumeric);
    case 'AlgoTangentFunctionNumber': return new AlgoTangentFunctionNumber(kernel, inputs[0] as import('../geo/GeoFunction').GeoFunction, inputs.length > 1 ? inputs[1] as GeoNumeric : (scalars?.[0] ?? 0));
    case 'AlgoTangentCurve':        return new AlgoTangentCurve(kernel, inputs[0] as import('../geo/GeoCurve').GeoCurve, inputs.length > 1 ? inputs[1] as GeoNumeric : (scalars?.[0] ?? 0));
    case 'AlgoCurvature':           return new AlgoCurvature(kernel, inputs[0] as import('../geo/GeoFunction').GeoFunction | import('../geo/GeoCurve').GeoCurve, inputs.length > 1 ? inputs[1] as GeoNumeric : (scalars?.[0] ?? 0));
    case 'AlgoOsculatingCircle':    return new AlgoOsculatingCircle(kernel, inputs[0] as import('../geo/GeoFunction').GeoFunction | import('../geo/GeoCurve').GeoCurve, inputs.length > 1 ? inputs[1] as GeoNumeric : (scalars?.[0] ?? 0));
    case 'AlgoPointInRegion':       return new AlgoPointInRegion(kernel, inputs[0]);
    case 'AlgoRandomPointIn':       return new AlgoRandomPointIn(kernel, inputs[0]);
    case 'AlgoIsInRegion':          return new AlgoIsInRegion(kernel, inputs[0] as GeoPoint, inputs[1]);
    // ---- 3D 最小内核 ----
    case 'AlgoJoinPoints3D':        return new AlgoJoinPoints3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoPoint3D, scalars?.[0] === 1);
    case 'AlgoMidpoint3D':          return new AlgoMidpoint3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoPoint3D);
    case 'AlgoPlaneThreePoints3D':  return new AlgoPlaneThreePoints3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoPoint3D, inputs[2] as GeoPoint3D);
    case 'AlgoIntersectLinePlane3D': return new AlgoIntersectLinePlane3D(kernel, inputs[0] as GeoLine3D, inputs[1] as GeoPlane3D);
    case 'AlgoDistancePointPlane3D': return new AlgoDistancePointPlane3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoPlane3D);
    // ---- 阶段5：曲面/多面体/测量 ----
    case 'AlgoSphere3D':             return new AlgoSphere3D(kernel, inputs[0] as GeoPoint3D, scalars?.[0] ?? 1);
    case 'AlgoCylinder3D': {
      // 有限高：活滑块走 inputs[1]，冻结值走 scalars[1]；缺省无限
      const h = inputs[1] instanceof GeoNumeric ? inputs[1] : (scalars?.[1] ?? null);
      return new AlgoCylinder3D(kernel, inputs[0] as GeoLine3D, scalars?.[0] ?? 1, h);
    }
    case 'AlgoCone3D': {
      const h = inputs[1] instanceof GeoNumeric ? inputs[1] : (scalars?.[1] ?? null);
      return new AlgoCone3D(kernel, inputs[0] as GeoLine3D, scalars?.[0] ?? Math.PI / 6, h);
    }
    case 'AlgoIntersectLineQuadric3D': return new AlgoIntersectLineQuadric3D(kernel, inputs[0] as GeoLine3D, inputs[1] as GeoQuadric3D);
    case 'AlgoPrism3D': {
      // 直棱柱：冻结高在 scalars[0]；斜棱柱：无高标量，末位输入是顶面参考点
      const height = scalars?.[0];
      if (typeof height === 'number') {
        return new AlgoPrism3D(kernel, inputs as GeoPoint3D[], height);
      }
      const pts = inputs.slice(0, -1) as GeoPoint3D[];
      const top = inputs[inputs.length - 1] as GeoPoint3D;
      return new AlgoPrism3D(kernel, pts, top);
    }
    case 'AlgoPyramid3D': {
      const pts = inputs.slice(0, -1) as GeoPoint3D[];
      const apex = inputs[inputs.length - 1] as GeoPoint3D;
      return new AlgoPyramid3D(kernel, pts, apex);
    }
    case 'AlgoVolume3D':             return new AlgoVolume3D(kernel, inputs[0] as GeoQuadric3D | GeoPolyhedron3D);
    case 'AlgoAngleLines3D':         return new AlgoAngleLines3D(kernel, inputs[0] as GeoLine3D, inputs[1] as GeoLine3D);
    case 'AlgoAnglePlanes3D':        return new AlgoAnglePlanes3D(kernel, inputs[0] as GeoPlane3D, inputs[1] as GeoPlane3D);
    // ---- 3D 进阶：圆 / 变换 / 截面 ----
    case 'AlgoCircleThreePoints3D':  return new AlgoCircleThreePoints3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoPoint3D, inputs[2] as GeoPoint3D);
    case 'AlgoTranslate3D':          return new AlgoTranslate3D(kernel, inputs[0] as GeoPoint3D, scalars?.[0] ?? 0, scalars?.[1] ?? 0, scalars?.[2] ?? 0);
    case 'AlgoRotatePoint3D':        return new AlgoRotatePoint3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoLine3D, scalars?.[0] ?? 0);
    case 'AlgoMirrorPoint3D':        return new AlgoMirrorPoint3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoPlane3D);
    case 'AlgoIntersectPathPlanePolyhedron': return new AlgoIntersectPathPlanePolyhedron(kernel, inputs[0] as GeoPlane3D, inputs[1] as GeoPolyhedron3D);
    case 'AlgoEllipsoid3D':              return new AlgoEllipsoid3D(kernel, inputs[0] as GeoPoint3D, scalars?.[0] ?? 1, scalars?.[1] ?? 1, scalars?.[2] ?? 1);
    case 'AlgoTransformLine3D':
    case 'AlgoTransformCircle3D':
    case 'AlgoTransformPolyhedron3D': {
      const opIndex = scalars?.[0] ?? 0;
      const source = inputs[0];
      const tArgs: Transform3DArgs = opIndex === 0
        ? { op: 'translate', dx: scalars?.[1] ?? 0, dy: scalars?.[2] ?? 0, dz: scalars?.[3] ?? 0 }
        : opIndex === 1
          ? { op: 'rotate', axis: inputs[1] as GeoLine3D, angle: scalars?.[1] ?? 0 }
          : { op: 'mirror', plane: inputs[1] as GeoPlane3D };
      if (type === 'AlgoTransformLine3D') return new AlgoTransformLine3D(kernel, source as GeoLine3D, tArgs);
      if (type === 'AlgoTransformCircle3D') return new AlgoTransformCircle3D(kernel, source as GeoCircle3D, tArgs);
      return new AlgoTransformPolyhedron3D(kernel, source as GeoPolyhedron3D, tArgs);
    }
    case 'AlgoIntersectPlaneQuadric':    return new AlgoIntersectPlaneQuadric(kernel, inputs[0] as GeoPlane3D, inputs[1] as GeoQuadric3D);
    case 'AlgoEllipse3D':                return new AlgoEllipse3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoPoint3D, inputs[2] as GeoPoint3D);
    case 'AlgoHyperbola3D':              return new AlgoHyperbola3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoPoint3D, inputs[2] as GeoPoint3D);
    case 'AlgoIntersectConicPlaneQuadric': return new AlgoIntersectConicPlaneQuadric(kernel, inputs[0] as GeoPlane3D, inputs[1] as GeoQuadric3D);
    case 'AlgoParabola3D':              return new AlgoParabola3D(kernel, inputs[0] as GeoPoint3D, inputs[1] as GeoLine3D);
    // scalars = [baseN, 冻结因子?]；活滑块走 inputs[1]，反序列化时 polyhedron 可能尚未 compute，
    // 面输出数量依赖 baseN 故必须落盘。
    case 'AlgoPolyhedronNet': {
      const factor = inputs[1] instanceof GeoNumeric
        ? inputs[1]
        : (scalars?.[1] !== undefined ? scalars[1] : 1);
      return new AlgoPolyhedronNet(kernel, inputs[0] as GeoPolyhedron3D, factor, scalars?.[0]);
    }
    // C11 多边形布尔：scalars[0] 0=union 1=intersection 2=difference 3=xor
    case 'AlgoPolygonPoints': {
      // 顶点即输入（GeoPoint[]）；输出在 createAlgo 之后由调用方 addElement
      return new AlgoPolygonPoints(kernel, inputs as import('../geo/GeoPoint').GeoPoint[]);
    }
    case 'AlgoPolygonBoolean': {
      const ops = ['union', 'intersection', 'difference', 'xor'] as const;
      const op = ops[scalars?.[0] ?? 0] ?? 'union';
      return new AlgoPolygonBoolean(kernel, inputs[0] as GeoPolygon, inputs[1] as GeoPolygon, op);
    }
    default:
      throw new Error(`[ConstructionSerializer] unknown algorithm type: ${type}`);
  }
}

/** Serialize to JSON string */
export function serialize(kernel: Kernel, coord?: CoordinateSystem, uiWidgets?: readonly SerializedUIWidget[]): string {
  const construction = kernel.getConstruction();
  const elements = construction.getElements();

  const independentElements: SerializedElement[] = elements
    .filter((el): el is GeoElement => el instanceof GeoElement && el.isIndependent())
    .map(el => {
      if (el instanceof GeoPoint3D) {
        return {
          type: 'GeoPoint3D',
          constIndex: el.constIndex,
          label: el.label,
          coords3: [el.getX(), el.getY(), el.getZ()],
          style: styleOf(el),
        };
      }
      if (el instanceof GeoPoint) {
        return {
          type: 'GeoPoint',
          constIndex: el.constIndex,
          label: el.label,
          coords: [el.getX(), el.getY(), el.getZ()] as [number, number, number],
          style: styleOf(el),
        };
      }
      if (el instanceof GeoList) {
        return {
          type: 'GeoList',
          constIndex: el.constIndex,
          label: el.label,
          childIndices: el.getChildren().map(c => c.constIndex),
          style: { visible: el.visible },
        };
      }
      if (el instanceof GeoBoolean) {
        return {
          type: 'GeoBoolean',
          constIndex: el.constIndex,
          label: el.label,
          booleanValue: el.getValue(),
          linkedLabels: [...el.linkedLabels],
          style: styleOf(el),
        };
      }
      if (el instanceof GeoConicPart || el.getClassName() === 'GeoArc') {
        // 自由圆弧/圆锥片段（v4 修复：此前被静默跳过，保存后丢失）。
        // 圆几何 = 圆心 + 半径 + 起止角 + 方向；GeoConicPart 另存 partType。
        const arcEl = el as GeoArc | GeoConicPart;
        return {
          type: arcEl.getClassName(),
          constIndex: arcEl.constIndex,
          label: arcEl.label,
          arc: {
            cx: arcEl.getCenter().x,
            cy: arcEl.getCenter().y,
            r: arcEl.getRadius(),
            startAngle: arcEl.getStartAngle(),
            endAngle: arcEl.getEndAngle(),
            ccw: arcEl.isCounterClockwise(),
            partType: arcEl instanceof GeoConicPart ? arcEl.getPartType() : undefined,
          },
          style: styleOf(arcEl),
        };
      }
      if (el instanceof GeoText) {
        return {
          type: 'GeoText',
          constIndex: el.constIndex,
          label: el.label,
          text: el.text,
          coords: [el.x, el.y, 1] as [number, number, number],
          style: {
            strokeColor: el.strokeColor,
            visible: el.visible,
          },
        };
      }
      if (el instanceof GeoNumeric) {
        return {
          type: 'GeoNumeric',
          constIndex: el.constIndex,
          label: el.label,
          value: el.getValue(),
          intervalMin: el.intervalMin,
          intervalMax: el.intervalMax,
          animationSpeed: el.animationSpeed,
          animationIncrement: el.animationIncrement,
          animationType: el.animationType,
          style: styleOf(el),
        };
      }
      if (el instanceof GeoPolygon) {
        // 多边形是独立对象但顶点引用其他元素，顶点索引延迟到反序列化末段解析。
        return {
          type: el.getClassName(),
          constIndex: el.constIndex,
          label: el.label,
          vertices: el.vertices.map(v => v.constIndex),
          style: styleOf(el),
        };
      }
      if (el instanceof GeoConic && el.getClassName() === 'GeoConic') {
        // 自由圆锥曲线（一般式系数）。子类（GeoArc/GeoConicPart）带角度信息，
        // 不能按裸系数还原，仍走 fallback 提示跳过。
        return {
          type: 'GeoConic',
          constIndex: el.constIndex,
          label: el.label,
          coeffs: [...el.coeffs],
          style: styleOf(el),
        };
      }
      if (el instanceof GeoLine && el.getClassName() === 'GeoLine') {
        // 自由直线：活镜轴/shear 轴的 roundtrip 依赖这三个系数
        return {
          type: 'GeoLine',
          constIndex: el.constIndex,
          label: el.label,
          lineCoeffs: [el.a, el.b, el.c],
          style: styleOf(el),
        };
      }
      if (el instanceof GeoMesh3D) {
        // OFF 导入网格：顶点坐标 + 面索引直接落盘
        return {
          type: 'GeoMesh3D',
          constIndex: el.constIndex,
          label: el.label,
          meshVertices: el.vertices.map(v => [v.getX(), v.getY(), v.getZ()] as [number, number, number]),
          meshFaces: el.faces.map(f => [...f]),
          meshFaceColors: el.faceColors ? [...el.faceColors] : undefined,
          style: styleOf(el),
        };
      }
      return {
        type: el.getClassName(),
        constIndex: el.constIndex,
        label: el.label,
        style: styleOf(el),
      };
    });

  const algorithms: SerializedAlgorithm[] = construction.getElements()
    .filter((el): el is AlgoElement => el instanceof AlgoElement)
    .sort((a, b) => a.constIndex - b.constIndex)
    .map(algo => {
      const sa: SerializedAlgorithm = {
        type: algo.getClassName(),
        constIndex: algo.constIndex,
        inputs: algo.getInput().map(i => i.constIndex),
        outputLabels: algo.getGeoElements().map(o => o.label),
        outputIndices: algo.getGeoElements().map(o => o.constIndex),
      };
      Object.assign(sa, collectAlgoExtras(algo));
      return sa;
    });


  const data: ConstructionJSON = {
    version: VERSION,
    generator: GENERATOR,
    yUp: true,
    independentElements,
    algorithms,
  };
  if (uiWidgets && uiWidgets.length > 0) data.uiWidgets = [...uiWidgets];

  if (coord) {
    data.view = {
      xZero: coord.xZero,
      yZero: coord.yZero,
      xScale: coord.xScale,
      yScale: coord.yScale,
      width: coord.width,
      height: coord.height,
    };
  }

  // v4 起：视图级选项一并落盘（对标 GeoGebra 把 Options 存进 .ggb）
  const options = kernel.getOptions();
  data.options = {
    rounding: options.rounding,
    angleUnit: options.angleUnit,
    pointCapturing: options.pointCapturing,
  };

  return JSON.stringify(data, null, 2);
}

/** Deserialize from JSON string and return the restored coordinate system (if any) */
/**
 * y-down（v1/v2）→ y-up（v3）镜像迁移：对 x 轴翻转 (x, y) → (x, -y)。
 * 覆盖携带坐标数据的独立元素与算法 fallback 标量；算法输入以引用为主，
 * 其坐标随被引用元素迁移自动一致。3D 点不迁移（3D Y 轴本就向上，
 * 旧档平面点存的是 to3 的 −worldY，恰为新世界的 worldY）。
 */
function migrateYDownToUp(data: ConstructionJSON): void {
  const flipY = (y: number): number => -y;
  for (const el of data.independentElements) {
    if (el.type === 'GeoPoint' && el.coords) el.coords[1] = flipY(el.coords[1]);
    else if (el.type === 'GeoText' && el.coords) el.coords[1] = flipY(el.coords[1]);
    else if (el.type === 'GeoLine' && el.lineCoeffs) el.lineCoeffs = [el.lineCoeffs[0], -el.lineCoeffs[1], el.lineCoeffs[2]];
    else if (el.type === 'GeoConic' && el.coeffs) {
      const [A, B, C, D, E, F] = el.coeffs;
      el.coeffs = [A, -B, C, D, -E, F];
    }
  }
  for (const sa of data.algorithms ?? []) {
    const sc = sa.scalars;
    if (!sc) continue;
    // 各算法 fallback 标量中的坐标分量（活引用路径不受影响）
    if (sa.type === 'AlgoRotate' || sa.type === 'AlgoDilate') {
      if (sc.length >= 3) sc[2] = flipY(sc[2]);   // [angle|ratio, cx, cy]
    } else if (sa.type === 'AlgoMirror') {
      sc[1] = -sc[1];                              // [a, b, c] → b 取反
    } else if (sa.type === 'AlgoTranslate') {
      if (sc.length >= 2) sc[1] = flipY(sc[1]);    // [vx, vy]
    } else if (sa.type === 'AlgoShearStretch') {
      if (sc.length >= 4) sc[3] = flipY(sc[3]);    // [factor, op, a, b, c]
    } else if (sa.type === 'AlgoInvert') {
      if (sc.length >= 2) sc[1] = flipY(sc[1]);    // [cx, cy, r]
    }
  }
}

export function deserialize(kernel: Kernel, json: string): { coord?: CoordinateSystem; uiWidgets?: SerializedUIWidget[] } {
  // 先完成解析与结构校验，再清空当前画布——避免坏文件把已有构造毁掉。
  const data = JSON.parse(json) as ConstructionJSON;
  if (!data || !Array.isArray(data.independentElements) || !Array.isArray(data.algorithms)) {
    throw new Error('[ConstructionSerializer] invalid file: missing independentElements/algorithms');
  }
  const construction = kernel.getConstruction();
  construction.clear();

  // 旧存档（v1/v2，世界 y 向下）迁移：整体对 x 轴镜像到 y-up 世界。
  // 函数/表达式对象不迁移——表达式语义与朝向无关，翻转后恰为 GeoGebra 语义。
  if (!data.yUp) {
    migrateYDownToUp(data);
  }

  if (data.version > VERSION) {
    console.warn(`[ConstructionSerializer] file version ${data.version} is newer than supported ${VERSION}`);
  }

  const index = new Map<number, GeoElement>();
  // 列表桩：算法链重建后再回填子元素
  // 多边形：顶点通常已是独立点（步骤 1 已入 index）；顶点若为算法输出则留到
  // 算法链之后再补。先解析“顶点已就绪”的多边形，AlgoPolygonBoolean 等
  // 以多边形为输入的算法才能在下方重建时拿到输入。
  const listStubs: { el: SerializedElement & { childIndices?: number[] }; instance: GeoList }[] = [];
  const polygonStubs: SerializedElement[] = [];

  const resolveReadyPolygons = (): SerializedElement[] => {
    const pending: SerializedElement[] = [];
    for (const stub of polygonStubs) {
      const cis = stub.vertices ?? [];
      const verts = cis.map(ci => index.get(ci));
      if (cis.length < 3 || verts.some(v => !v)) {
        pending.push(stub);
        continue;
      }
      try {
        // 经 AlgoPolygonPoints 重建：恢复顶点→多边形依赖边（否则重载后拖顶点联动失效）
        const algo = new AlgoPolygonPoints(kernel, verts as GeoPoint[]);
        const poly = algo.getOutput();
        poly.label = stub.label;
        restoreStyle(poly, stub.style);
        construction.addElement(algo);
        construction.addElement(poly);
        index.set(stub.constIndex, poly);
      } catch (e) {
        console.warn(`[ConstructionSerializer] failed to rebuild polygon "${stub.label}", skipped: ${e}`);
      }
    }
    polygonStubs.length = 0;
    return pending;
  };

  // 1) Rebuild independent elements (ascending constIndex ensures downstream refs exist)
  for (const el of [...data.independentElements].sort((a, b) => a.constIndex - b.constIndex)) {
    let instance: GeoElement;
    if (el.type === 'GeoPoint3D') {
      const c = el.coords3 ?? [0, 0, 0];
      instance = new GeoPoint3D(kernel, Coords4.fromPoint(c[0], c[1], c[2]));
    } else if (el.type === 'GeoPoint') {
      const c = el.coords ?? [0, 0, 1];
      instance = new GeoPoint(kernel, new GeoVec3D(c[0], c[1], c[2]));
    } else if (el.type === 'GeoList') {
      instance = new GeoList(kernel, []);
      listStubs.push({ el: el as SerializedElement & { childIndices?: number[] }, instance: instance as GeoList });
      // 立即入 index；children 在算法链重建完之后回填
      construction.addElement(instance);
      index.set(el.constIndex, instance);
      continue;
    } else if (el.type === 'GeoText') {
      instance = new GeoText(kernel, el.text ?? '', el.coords?.[0] ?? 0, el.coords?.[1] ?? 0);
    } else if (el.type === 'GeoNumeric') {
      instance = new GeoNumeric(kernel, el.value ?? 0);
      const num = instance as GeoNumeric;
      num.intervalMin = el.intervalMin ?? 0;
      num.intervalMax = el.intervalMax ?? 2 * Math.PI;
      num.animationSpeed = el.animationSpeed ?? 1;
      num.animationIncrement = el.animationIncrement ?? 0.01;
      num.setAnimationType((el.animationType ?? AnimationType.OSCILLATING) as AnimationType);
    } else if (el.type === 'GeoConic') {
      instance = new GeoConic(kernel, el.coeffs ? [...el.coeffs] : [1, 0, 1, 0, 0, -1]);
    } else if (el.type === 'GeoArc' || el.type === 'GeoConicPart') {
      // 自由圆弧/圆锥片段（v4）：由圆几何重建；旧存档无此类型（此前静默丢弃）
      const a = el.arc;
      if (!a) throw new Error(`missing arc geometry for ${el.type}`);
      instance = el.type === 'GeoArc'
        ? new GeoArc(kernel, { x: a.cx, y: a.cy }, a.r, a.startAngle, a.endAngle, a.ccw)
        : new GeoConicPart(kernel, { x: a.cx, y: a.cy }, a.r, a.startAngle, a.endAngle, (a.partType ?? 0) as ConicPartType, a.ccw);
    } else if (el.type === 'GeoBoolean') {
      const bool = new GeoBoolean(kernel, el.booleanValue ?? false);
      if (el.linkedLabels) bool.linkedLabels = [...el.linkedLabels];
      instance = bool;
    } else if (el.type === 'GeoLine') {
      const [a = 0, b = 1, c = 0] = el.lineCoeffs ?? [0, 1, 0];
      instance = new GeoLine(kernel, a, b, c);
    } else if (el.type === 'GeoPolygon') {
      polygonStubs.push(el);
      continue;
    } else if (el.type === 'GeoMesh3D') {
      const mesh = new GeoMesh3D(kernel);
      mesh.setMesh(
        (el.meshVertices ?? []).map(c => Coords4.fromPoint(c[0], c[1], c[2])),
        (el.meshFaces ?? []).map(f => [...f]),
      );
      if (el.meshFaceColors) mesh.faceColors = [...el.meshFaceColors];
      instance = mesh;
    } else {
      console.warn(`[ConstructionSerializer] unsupported independent element type: ${el.type}, skipped`);
      continue;
    }
    instance.label = el.label;
    restoreStyle(instance, el.style);
    construction.addElement(instance);
    index.set(el.constIndex, instance);
  }

  // 列表桩：算法链重建后再回填子元素
  // 1.5) 解析顶点已就绪的多边形（自由点顶点此时已在 index）
  let unresolvedPolygons = resolveReadyPolygons();

  // 2) Rebuild algorithm chain (ascending constIndex = original topology order)
  const deferredAlgorithmErrors: { a: SerializedAlgorithm; error: unknown }[] = [];
  for (const a of [...data.algorithms].sort((a, b) => a.constIndex - b.constIndex)) {
    try {
      rebuildAlgorithm(kernel, construction, index, a);
    } catch (e) {
      // 多边形输入可能尚未解析（顶点依赖更晚的算法）→ 留到 2.5 后重试；
      // 其余失败只跳过该算法，不中断整个导入。
      deferredAlgorithmErrors.push({ a, error: e });
      console.warn(`[ConstructionSerializer] failed to rebuild algorithm ${a.type}@${a.constIndex}, deferred: ${e}`);
    }
  }

  // 2.4) 回填列表子元素（子元素可能是算法输出，算法链已就绪）
  for (const stub of listStubs) {
    const children = (stub.el.childIndices ?? [])
      .map(ci => index.get(ci))
      .filter((c): c is GeoElement => c !== undefined);
    stub.instance.setChildren(children);
  }

  // 2.5) 解析剩余多边形（顶点为算法输出的情形），再重试此前推迟的算法
  if (unresolvedPolygons.length > 0) {
    polygonStubs.push(...unresolvedPolygons);
    unresolvedPolygons = resolveReadyPolygons();
  }

  // 2.6) 重试此前因缺输入（如多边形未就绪）而推迟的算法
  for (const { a, error } of deferredAlgorithmErrors) {
    try {
      rebuildAlgorithm(kernel, construction, index, a);
    } catch (e) {
      console.warn(`[ConstructionSerializer] failed to rebuild algorithm ${a.type}@${a.constIndex}, skipped: ${error}; retry: ${e}`);
    }
  }

  // 3) Full recompute so all derived objects are in place
  construction.updateAllAlgorithms();

  // 3.5) Restore view options（v4；统一走 set()，与 UI 修改同一路径）
  if (data.options) {
    const opts = kernel.getOptions();
    const patch: Partial<{ rounding: number; angleUnit: 'degree' | 'radian'; pointCapturing: 'off' | 'automatic' | 'snap_grid' }> = {};
    if (typeof data.options.rounding === 'number') patch.rounding = data.options.rounding;
    if (data.options.angleUnit === 'degree' || data.options.angleUnit === 'radian') patch.angleUnit = data.options.angleUnit;
    if (data.options.pointCapturing === 'off' || data.options.pointCapturing === 'automatic' || data.options.pointCapturing === 'snap_grid') {
      patch.pointCapturing = data.options.pointCapturing;
    }
    opts.set(patch);
  }

  // 4) Restore view
  let coord: CoordinateSystem | undefined;
  if (data.view) {
    const v = data.view;
    coord = new CoordinateSystem(v.width, v.height, v.xZero, v.yZero, v.xScale, v.yScale);
  }

  return { coord, uiWidgets: (data as ConstructionJSON).uiWidgets };
}

function restoreStyle(instance: GeoElement, style: Record<string, unknown> | undefined): void {
  if (!style) return;
  if ('strokeColor' in style) instance.strokeColor = style.strokeColor as string | null;
  if ('strokeWidth' in style) instance.strokeWidth = style.strokeWidth as number | null;
  if ('strokeDash' in style && Array.isArray(style.strokeDash)) {
    instance.strokeDash = [...(style.strokeDash as number[])];
  } else if (!('strokeDash' in style)) {
    instance.strokeDash = null;
  }
  if ('fillColor' in style) instance.fillColor = style.fillColor as string | null;
  if ('labelVisible' in style) instance.labelVisible = style.labelVisible as boolean;
  if ('labelMode' in style) instance.labelMode = style.labelMode as 'always' | 'mouse' | 'never';
  if ('visible' in style) instance.visible = style.visible as boolean;
  if ('labelOffsetX' in style) instance.labelOffsetX = style.labelOffsetX as number;
  if ('labelOffsetY' in style) instance.labelOffsetY = style.labelOffsetY as number;
  if ('isFixed' in style) instance.isFixed = style.isFixed as boolean;
  if ('trace' in style) instance.trace = style.trace as boolean;
  if ('layer' in style) instance.layer = style.layer as number;
}

/** 重建单个算法并登记其输出（表达式类算法走 parseAlgebraInput 路径）。 */
export function rebuildAlgorithm(
  kernel: Kernel,
  construction: ReturnType<Kernel['getConstruction']>,
  index: Map<number, GeoElement>,
  a: SerializedAlgorithm,
): void {
  // 锚定文本：文本内容存在 expressionText，锚点为 inputs[0]
  if (a.type === 'AlgoText') {
    const anchor = index.get(a.inputs[0]);
    if (!anchor) throw new Error(`missing anchor for AlgoText`);
    const algo = new AlgoText(kernel, anchor as GeoPoint, a.expressionText ?? '', a.scalars?.[0] ?? 0, a.scalars?.[1] ?? 0);
    construction.addElement(algo);
    const out = algo.getOutput();
    out.label = a.outputLabels[0] ?? out.label;
    if (a.outputIndices[0] !== undefined) index.set(a.outputIndices[0], out);
    construction.addElement(out);
    return;
  }
  // 动态文本：label = "..." + expr 重建（AlgoDependentText）
  if (a.type === 'AlgoDependentText' && a.expressionText !== undefined) {
    const label = a.outputLabels[0] || '';
    const elements = parseAlgebraInput(kernel, `${label} = ${a.expressionText}`);
    for (const el of elements) {
      construction.addElement(el);
      if (el instanceof AlgoElement) {
        for (const out of el.getGeoElements()) {
          if (!construction.getElements().includes(out)) construction.addElement(out);
          (a.outputIndices ?? []).forEach((ci, oi) => {
            if (oi === 0) index.set(ci, out);
          });
        }
      }
    }
    return;
  }
  // Expression-based reconstruction for function/numeric dependency algorithms
  if (a.expressionText && (a.type === 'AlgoDependentFunction' || a.type === 'AlgoDependentNumeric' || a.type === 'AlgoDependentInequality' || a.type === 'AlgoDependentQuadric3D' || a.type === 'AlgoDependentText')) {
    const label = a.outputLabels[0] || '';
    let algInput: string;
    if (a.type === 'AlgoDependentInequality') {
      // 不等式原始文本直接重走识别器（无需加标签）
      algInput = a.expressionText;
    } else if (a.type === 'AlgoDependentQuadric3D') {
      // 二次曲面：expressionText 存完整原始方程（含/不含标签）
      algInput = a.expressionText;
    } else if (a.type === 'AlgoDependentFunction' && a.variableName) {
      algInput = `${label}(${a.variableName}) = ${a.expressionText}`;
    } else {
      algInput = `${label} = ${a.expressionText}`;
    }
    const elements = parseAlgebraInput(kernel, algInput);
    const outputs: GeoElement[] = [];
    for (const el of elements) {
      construction.addElement(el);
      const produced = el instanceof AlgoElement ? el.getGeoElements() : el instanceof GeoElement ? [el] : [];
      for (const out of produced) {
        if (!outputs.includes(out)) outputs.push(out);
      }
    }
    // Rebuilding assigns fresh constIndices, but downstream algorithms still reference
    // the saved ones — so register the outputs under their saved outputIndices.
    (a.outputIndices ?? []).forEach((ci, i) => {
      if (outputs[i]) index.set(ci, outputs[i]);
    });
    return;
  }

  // Surface(...) / 旋转面 按命令文本重建
  if ((a.type === 'AlgoDependentSurface' || a.type === 'AlgoSurfaceOfRevolution') && a.expressionText) {
    const elements = parseAlgebraInput(kernel, a.expressionText);
    const outputs: GeoElement[] = [];
    for (const el of elements) {
      construction.addElement(el);
      const produced = el instanceof AlgoElement ? el.getGeoElements() : el instanceof GeoElement ? [el] : [];
      for (const out of produced) {
        if (!outputs.includes(out)) outputs.push(out);
      }
    }
    a.outputLabels.forEach((lbl, i) => {
      if (outputs[i]) outputs[i].label = lbl;
    });
    (a.outputIndices ?? []).forEach((ci, i) => {
      if (outputs[i]) index.set(ci, outputs[i]);
    });
    return;
  }

  // Curve(x(t), y(t), t, a, b) 按命令文本重建（滑块依赖会随解析自动接线）
  if (a.type === 'AlgoDependentCurve' && a.curveX !== undefined && a.curveY !== undefined) {
    const [tMin = 0, tMax = 2 * Math.PI] = a.scalars ?? [];
    const paramName = a.variableName ?? 't';
    const algInput = `Curve(${a.curveX}, ${a.curveY}, ${paramName}, ${tMin}, ${tMax})`;
    const elements = parseAlgebraInput(kernel, algInput);
    const outputs: GeoElement[] = [];
    for (const el of elements) {
      construction.addElement(el);
      const produced = el instanceof AlgoElement ? el.getGeoElements() : el instanceof GeoElement ? [el] : [];
      for (const out of produced) {
        if (!outputs.includes(out)) outputs.push(out);
      }
    }
    // 恢复曲线标签：下游按标签引用（如 Surface(c, …)）依赖它
    a.outputLabels.forEach((lbl, i) => {
      if (outputs[i]) outputs[i].label = lbl;
    });
    (a.outputIndices ?? []).forEach((ci, i) => {
      if (outputs[i]) index.set(ci, outputs[i]);
    });
    return;
  }

  const inputs = a.inputs.map(ci => index.get(ci)).filter((x): x is GeoElement => x !== undefined);
  if (inputs.length !== a.inputs.length) {
    throw new Error(`missing inputs (have ${inputs.length}/${a.inputs.length})`);
  }
  const algo = createAlgo(kernel, a.type, inputs, a.scalars);
  construction.addElement(algo);
  // Restore output labels and register outputs in index map
  const outputs = algo.getGeoElements();
  a.outputLabels.forEach((lbl, i) => {
    if (outputs[i]) outputs[i].label = lbl;
  });
  // Register outputs by their saved constIndex so downstream algos can reference them
  if (a.outputIndices) {
    a.outputIndices.forEach((ci, i) => {
      if (outputs[i]) index.set(ci, outputs[i]);
    });
  }
  // Derived outputs belong in the element list too: rendering and hit-testing both
  // iterate getElements(), so an unregistered output would silently vanish on import.
  outputs.forEach(output => construction.addElement(output));
  // Also register by the algorithm's own output indices as fallback for old files
  outputs.forEach((o) => {
    if (!index.has(o.constIndex)) index.set(o.constIndex, o);
  });
}

/** Trigger browser download of JSON file */
export function downloadJSON(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
