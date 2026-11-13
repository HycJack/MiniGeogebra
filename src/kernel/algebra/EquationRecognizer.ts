import { Kernel } from '../core/Kernel';
import type { Construction } from '../core/Construction';
import { ConstructionElement } from '../core/ConstructionElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { AnimationType } from '../geo/GeoNumeric';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoVector } from '../geo/GeoVector';
import { GeoConic } from '../geo/GeoConic';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoText } from '../geo/GeoText';
import { GeoVec3D } from '../core/GeoVec3D';
import { AlgoConicFocus, AlgoConicVertex, AlgoConicAsymptote, AlgoConicDirectrix, AlgoConicAxis, AlgoConicEccentricity, AlgoConicParameter, AlgoConicRadius, AlgoPolarLine, AlgoIsTangent } from '../algo/AlgoConicProperties';
import { AlgoCentroid, AlgoIncenter, AlgoOrthocenter, AlgoIncircle, AlgoAreCollinear, AlgoAreParallel, AlgoArePerpendicular, AlgoAreConcyclic, AlgoAreCongruent, AlgoAreEqual } from '../algo/AlgoTriangleCenters';
import { AlgoDependentCurve, AlgoPointOnCurve, AlgoTangentFunctionNumber, AlgoTangentCurve, AlgoCurvature, AlgoOsculatingCircle } from '../algo/AlgoCurveFamily';
import { AlgoPointInRegion, AlgoIsInRegion, AlgoRandomPointIn } from '../algo/AlgoRegion';
import { AlgoDependentInequality } from '../algo/AlgoDependentInequality';
import { AlgoDependentQuadric3D } from '../algo/AlgoDependentQuadric3D';
import { InequalityOp } from '../geo/GeoInequality';
import { AlgoPointOnFunction } from '../algo/AlgoPointOnFunction';
import { AlgoPointOnConic } from '../algo/AlgoPointOnConic';
import { AlgoPointOnLine3D, AlgoPointOnCircle3D, AlgoPointOnConic3D, AlgoPointOnPolyline3D, AlgoPointInPlane3D } from '../algo/AlgoPointOn3D';
import { AlgoTangent, AlgoTangentLineConic } from '../algo/AlgoTangent';
import { GeoCurve } from '../geo/GeoCurve';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoLine3D } from '../geo/GeoLine3D';
import { GeoPlane3D } from '../geo/GeoPlane3D';
import { Coords4 } from '../core/Coords4';
import { AlgoJoinPoints3D, AlgoMidpoint3D, AlgoPlaneThreePoints3D, AlgoIntersectLinePlane3D, AlgoDistancePointPlane3D, AlgoIntersectPlanes3D, AlgoIntersectLines3D, AlgoDistanceTwoPoints3D, AlgoSegmentLength3D, AlgoCircleCenterRadius3D, AlgoCircleCenterPoint3D, AlgoAnglePoints3D, AlgoMidpointSegment3D } from '../algo/Algo3D';
import { GeoQuadric3D } from '../geo/GeoQuadric3D';
import { GeoPolyhedron3D } from '../algo/AlgoPolyhedron3D';
import { GeoSurface } from '../geo/GeoSurface';
import { AlgoSphere3D, AlgoCylinder3D, AlgoCone3D, AlgoIntersectLineQuadric3D, AlgoPrism3D, AlgoPyramid3D, AlgoVolume3D, AlgoAngleLines3D, AlgoAnglePlanes3D, AlgoIntersectSpheres3D } from '../algo/AlgoPolyhedron3D';
import { AlgoSequence, AlgoListElement, AlgoListAggregate, AlgoListTransform } from '../algo/AlgoListOps';
import { AlgoPrimeFactors, AlgoDivisorsList, gcd, lcm, isPrime, nextPrime, previousPrime, divisorsSum, binomialCoefficient, toBase, fromBase } from '../algo/AlgoNumberTheory';
import { AlgoConicSingleAxis, AlgoConicSemiAxisLength, AlgoConicAxisLength, AlgoConicLinearEccentricity, AlgoCircleSector } from '../algo/AlgoConicProperties';
import { AlgoFractionText, AlgoScientificText, makeText, nameOf, formulaText, tableText, splitText, textToUnicode, unicodeToText, makeTextList, makeNumericList } from '../algo/AlgoTextOps';
import { AlgoFitExp, AlgoFitGrowth, AlgoFitLog, AlgoFitPow, AlgoFitLineX, AlgoFitLineY } from '../algo/AlgoFitCurve';
import { futureValue, presentValue, payment as financePayment, rate as financeRate } from '../algo/AlgoFinance';
import { AlgoFunctionRestricted } from '../algo/AlgoFunctionRestricted';
import { AlgoAffineRatio, AlgoCrossRatio, AlgoBarycenter, AlgoAreConcurrent, AlgoInteriorAngles, AlgoDirection, AlgoDynamicCoordinates, AlgoPathParameter, AlgoTriangleCenterN } from '../algo/AlgoGeoMeasures';
import { AlgoIteration, AlgoIterationList } from '../algo/AlgoIteration';
import { AlgoFitGeneral, AlgoFitSin, AlgoFitLogistic } from '../algo/AlgoFitNonlinear';
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
import { AlgoElement } from '../algo/AlgoElement';
import { interpolatePolynomial } from './Polynomial';
import { AlgoLineTwoPoints } from '../algo/AlgoLineTwoPoints';
import { AlgoSegmentTwoPoints } from '../algo/AlgoSegmentTwoPoints';
import { AlgoRayTwoPoints } from '../algo/AlgoRayTwoPoints';
import { AlgoCircleCenterPoint } from '../algo/AlgoCircleCenterPoint';
import { AlgoCirclePointRadius } from '../algo/AlgoCirclePointRadius';
import { AlgoCircleThreePoints } from '../algo/AlgoCircleThreePoints';
import { AlgoCircleCenter } from '../algo/AlgoCircleCenter';
import { AlgoVector } from '../algo/AlgoVector';
import { AlgoMidpoint } from '../algo/AlgoMidpoint';
import { AlgoIntersect } from '../algo/AlgoIntersect';
import { AlgoIntersectFunctions, AlgoIntersectFunctionsPoint, INTERSECT_FUNCTIONS_CAPACITY } from '../algo/AlgoIntersectFunctions';
import { AlgoPolygonBoolean } from '../algo/AlgoPolygonBoolean';
import { AlgoPolygonPoints } from '../algo/AlgoPolygonPoints';
import { GeoBooleanRegion } from '../geo/GeoBooleanRegion';
import { AlgoDistance } from '../algo/AlgoDistance';
import { AlgoSlope } from '../algo/AlgoSlope';
import { AlgoRotate, AlgoDilate, AlgoMirror } from '../algo/AlgoRotate';
import { AlgoShearStretch } from '../algo/AlgoShearStretch';
import { AlgoTranslate } from '../algo/AlgoTranslate';
import { AlgoFitPoly } from '../algo/AlgoFitPoly';
// ---- 命令面补齐（B 类：Algo 已有、此前仅工具栏可达）----
import { AlgoParallelLine } from '../algo/AlgoParallelLine';
import { AlgoOrthogonalLine } from '../algo/AlgoOrthogonalLine';
import { AlgoPerpendicularBisector } from '../algo/AlgoPerpendicularBisector';
import { AlgoAngleBisector, AlgoAngleBisectorLines } from '../algo/AlgoAngleBisector';
import { AlgoEllipse } from '../algo/AlgoEllipse';
import { AlgoHyperbola } from '../algo/AlgoHyperbola';
import { AlgoParabola } from '../algo/AlgoParabola';
import { AlgoConicFivePoints } from '../algo/AlgoConicFivePoints';
import { AlgoSemicircle } from '../algo/AlgoSemicircle';
import { AlgoArc } from '../algo/AlgoArc';
import { AlgoCircularSector } from '../algo/AlgoCircularSector';
import { AlgoCircumcircularArc } from '../algo/AlgoCircumcircularArc';
import { AlgoCircumcircularSector } from '../algo/AlgoCircumcircularSector';
import { AlgoCompass } from '../algo/AlgoCompass';
import { AlgoRegularPolygonEdge } from '../algo/AlgoRegularPolygonEdge';
import { AlgoInvert } from '../algo/AlgoShearStretch';
import { AlgoArea } from '../algo/AlgoArea';
import { AlgoPerimeter } from '../algo/AlgoPerimeter';
import { AlgoConicPerimeter } from '../algo/AlgoConicPerimeter';
import { AlgoPolyLine } from '../algo/AlgoPolyLine';
import { GeoSegment } from '../geo/GeoSegment';
import { GeoRay } from '../geo/GeoRay';
import { GeoArc, arcSweep } from '../geo/GeoArc';
import { GeoConicPart } from '../geo/GeoConicPart';
import { AlgoFunctionRootPoint } from '../algo/AlgoFunctionRootPoint';
import { AlgoRootList, ROOT_LIST_CAPACITY } from '../algo/AlgoRootList';
import { AlgoFunctionExtremumPoint, makeDerivativeEvaluator } from '../algo/AlgoFunctionExtremumPoint';
import { AlgoExtremumList, EXTREMUM_LIST_CAPACITY } from '../algo/AlgoExtremumList';
import { GeoList } from '../geo/GeoList';
import { AlgoText } from '../algo/AlgoText';
import { AlgoDependentText } from '../algo/AlgoDependentText';
import { AlgoAngle, AlgoAngleOriented, AlgoAngleTwoLines, AlgoAngleTwoPoints } from '../algo/AlgoAngle';
import { AlgoPointOnLine } from '../algo/AlgoPointOnLine';
import { AlgoPointOnSegment } from '../algo/AlgoPointOnSegment';
import { AlgoPointOnRay } from '../algo/AlgoPointOnRay';
import { AlgoPointOnArc } from '../algo/AlgoPointOnArc';
import { AlgoLocus } from '../algo/AlgoLocus';
import { AlgoLocus3D } from '../algo/AlgoLocus3D';
import { GeoLocus } from '../geo/GeoLocus';
import { AlgoDependentFunction } from '../algo/AlgoDependentFunction';
import { AlgoDependentNumeric } from '../algo/AlgoDependentNumeric';
import { AlgoDerivative } from '../algo/AlgoDerivative';
import { AlgoIntegralDefinite, AlgoTaylorSeriesFunction, AlgoSlopeFunction } from '../algo/AlgoFunctionAnalysis';
import { parseExpression, withIdentifierHints, BUILTIN_FUNCTIONS } from './ExpressionParser';
import { evaluate } from './ExpressionEvaluator';
import { collectVariables, ExpressionNode, Scope } from './ExpressionNode';
import { differentiate, expressionToString } from './Differentiator';
import { extractPolynomialCoefficients, polynomialRealRoots } from './Polynomial';
import { extractQuadricCoeffs } from './quadricCoeffs';
import { findRoots, findExtrema, integrate } from './Numerics';

/**
 * 代数输入识别器 —— 把一行文本变成构造对象。
 *
 * 支持两类输入：
 *   1. 定义式：`f(x) = x^2`、`y = 2x + 1`、`a = 3`、`b = a + 1`、`A = (1, 2)`；
 *   2. GeoGebra 风格命令：`Point(x,y)`、`Segment(A,B)`、`Intersection(A,B)`、
 *      `Derivative(f)`、`Root(f)`、`Extremum(f)`、`Integral(f,a,b)` 等。
 *
 * 解析顺序有讲究：`f(x) = ...` 必须先于 `y = ...` 判定（前者是定义式的特例）；
 * 坐标元组 `A = (1, 2)` 必须**先于** `parseExpression` 判定，否则 `(1, 2)` 会被当成
 * 非法算术表达式而抛 `Missing ")"`。
 */

/** 无搜索区间时的默认搜索范围（见 docs/2D-alignment-status.md 遗留项 4）。 */
export const DEFAULT_SEARCH_RANGE = 20;

/** 命令名 → [最少参数, 最多参数]。大小写不敏感。 */
const COMMAND_ARITY: Record<string, [number, number]> = {
  Point: [2, 2],
  Line: [2, 2],
  Segment: [2, 2],
  Ray: [2, 2],
  Circle: [2, 3],
  Vector: [1, 2],
  Midpoint: [1, 2],
  Intersection: [2, 3],
  Intersect: [2, 4],   // 3 = 只取第 index 个交点；4 = 函数×函数区间搜索 [a,b]
  Shear: [3, 3],
  Stretch: [3, 3],
  PointOnLine: [2, 2],
  Distance: [2, 2],
  Slope: [1, 1],
  Rotate: [2, 3],
  FitPoly: [2, 12],   // 2 参 = 完整列表字面量（花括号感知 splitArgs 后不再被切碎）
  Text: [2, 4],
  Angle: [2, 3], // 2 = 两线角 Angle(l1,l2)，3 = 三点角
  Slider: [0, 9],   // 官方 CmdSlider arity（min,max,increment,speed,width,isAngle,horizontal,animating,random）
  DirectedAngle: [3, 3],
  Dilate: [2, 3],
  Mirror: [2, 2],
  Translate: [2, 3],
  Derivative: [1, 2],
  Root: [1, 3],
  Extremum: [1, 3],
  Integral: [3, 3],
  // ---- 圆锥曲线解析属性 ----
  Focus: [1, 1],
  Eccentricity: [1, 1],
  Asymptote: [1, 1],
  Directrix: [1, 1],
  Axes: [1, 1],
  Parameter: [1, 1],
  Radius: [1, 1],
  Polar: [2, 2],
  IsTangent: [2, 2],
  // ---- 关系判断（数值版 true/false）----
  AreCollinear: [3, 3],
  AreParallel: [2, 2],
  ArePerpendicular: [2, 2],
  AreConcyclic: [4, 4],
  AreCongruent: [2, 2],
  // ---- 三角形中心 ----
  Centroid: [1, 3],
  Polygon: [3, 10],
  Incenter: [3, 3],
  Orthocenter: [3, 3],
  Incircle: [3, 3],
  Circumcircle: [3, 3],
  // ---- 分析 ----
  TaylorSeries: [2, 3],
  // ---- 参数曲线 / 曲率 ----
  Curve: [5, 5],
  PointOn: [1, 2],
  Locus: [2, 2],
  Tangent: [2, 2],
  Center: [1, 1],
  AreEqual: [2, 2],
  Curvature: [2, 2],
  OsculatingCircle: [2, 2],
  // ---- 区域 ----
  PointIn: [1, 1],
  IsInRegion: [2, 2],
  RandomPointIn: [1, 1],
  // ---- 插值 ----
  Polynomial: [2, 12],
  // ---- 3D 最小内核 ----
  // 官方命名别名：Plane/Sphere/Volume/Prism/Pyramid/Cylinder/Cone 在官方是
  // 无后缀公共命令名（BasicCommandProcessorFactory3D），此前 Mini 只认自造的
  // Xxx3D 后缀名，官方语句 Plane(A,B,C)、Sphere(A,3) 全部失败。
  Plane: [3, 3],
  Sphere: [2, 2],
  Volume: [1, 1],
  Prism: [4, 16],
  Pyramid: [4, 16],
  Cylinder: [2, 3],
  Cone: [2, 3],
  Point3D: [3, 3],
  Line3D: [2, 2],
  Segment3D: [2, 2],
  Midpoint3D: [2, 2],
  Plane3D: [3, 3],
  IntersectLinePlane: [2, 2],
  Distance3D: [2, 2],
  // ---- 阶段5：曲面/多面体/测量 ----
  Sphere3D: [2, 2],
  Cylinder3D: [2, 3],
  Cone3D: [2, 3],
  IntersectLineQuadric: [2, 2],
  Prism3D: [4, 16],
  Pyramid3D: [4, 16],
  Volume3D: [1, 1],
  Angle3D: [2, 2],
  // ---- 阶段6：参数曲面 / 旋转面 ----
  // Surface 重载：9 元自由参数曲面；2/3 元旋转面（对标 GeoGebra CmdSurfaceCartesian）
  Surface: [2, 9],
  // ---- 3D 进阶：圆/变换/截面 ----
  Circle3D: [3, 3],
  Translate3D: [4, 4],
  Rotate3D: [3, 3],
  Mirror3D: [2, 2],
  IntersectPath: [2, 2],
  SetConditionToShowObject: [2, 2],
  SetDynamicColor: [4, 5],
  Ellipsoid3D: [4, 4],
  Ellipse3D: [3, 3],
  Hyperbola3D: [3, 3],
  Parabola3D: [2, 2],
  IntersectConic: [2, 2],
  Net: [1, 2],
  // ---- C11：多边形布尔 ----
  Union: [2, 2],
  Difference: [2, 2],
  // ---- 命令面补齐（B 类：Algo 已有、此前仅工具栏可达）----
  ParallelLine: [2, 2],
  OrthogonalLine: [2, 2],
  PerpendicularLine: [2, 2],       // OrthogonalLine 的官方英文别名
  PerpendicularBisector: [2, 2],
  LineBisector: [1, 2],            // PerpendicularBisector 的官方英文名
  AngleBisector: [2, 3],
  AngularBisector: [2, 3],         // AngleBisector 的官方英文名；2 线形官方 CmdAngularBisector
  Ellipse: [3, 3],
  Hyperbola: [3, 3],
  Parabola: [2, 2],
  Conic: [5, 5],
  Semicircle: [2, 2],
  Arc: [3, 3],
  CircularSector: [3, 3],
  CircumcircularArc: [3, 3],
  CircumcircularSector: [3, 3],
  Compass: [2, 2],
  RegularPolygon: [3, 3],
  Invert: [2, 2],
  Area: [1, 1],
  Length: [1, 1],
  Perimeter: [1, 1],
  Circumference: [1, 1],
  Polyline: [2, 16],
  Vertex: [1, 2],
  Reflect: [2, 2],                 // Mirror 的官方英文别名（点/线镜像双形态）
  // ---- 列表命令族（L4/F2-4，官方 Commands 对应名）----
  Sequence: [4, 5],
  Element: [2, 2],
  First: [1, 2],
  Last: [1, 2],
  Take: [2, 3],
  Sort: [1, 1],
  Unique: [1, 1],
  Reverse: [1, 1],
  Append: [2, 2],
  Insert: [3, 3],
  Remove: [2, 2],
  RemoveUndefined: [1, 1],
  Flatten: [1, 1],
  Join: [1, 16],
  Sum: [1, 1],
  Product: [1, 1],
  IndexOf: [2, 2],
  // ---- 数论命令族（L4-A1）----
  GCD: [2, 2],
  LCM: [2, 2],
  Mod: [2, 2],
  Div: [2, 2],
  IsPrime: [1, 1],
  NextPrime: [1, 1],
  PreviousPrime: [1, 1],
  PrimeFactors: [1, 1],
  DivisorsList: [1, 1],
  DivisorsSum: [1, 1],
  BinomialCoefficient: [2, 2],
  ToBase: [2, 2],
  FromBase: [2, 2],
  // ---- 圆锥属性拆分族（L4-A5）----
  Sector: [3, 3],
  MajorAxis: [1, 1],
  MinorAxis: [1, 1],
  FirstAxis: [1, 1],
  SecondAxis: [1, 1],
  SemiMajorAxisLength: [1, 1],
  SemiMinorAxisLength: [1, 1],
  FirstAxisLength: [1, 1],
  SecondAxisLength: [1, 1],
  LinearEccentricity: [1, 1],
  // ---- 文本命令族（L4-A7）----
  FractionText: [1, 1],
  ScientificText: [1, 1],
  TableText: [1, 4],
  FormulaText: [1, 1],
  Name: [1, 1],
  Split: [1, 2],
  TextToUnicode: [1, 1],
  UnicodeToText: [1, 1],
  LetterToUnicode: [1, 1],
  UnicodeToLetter: [1, 1],
  // ---- 拟合族（L4-A8）+ 金融族（L4-A10）+ 限域函数 ----
  Fit: [1, 2],                     // 1 参 = FitLineY（官方别名）；2 参 = Fit(list, f) 通用拟合
  FitLineY: [1, 1],
  FitLineX: [1, 1],
  FitExp: [1, 1],
  FitGrowth: [1, 1],
  FitLog: [1, 1],
  FitPow: [1, 1],
  FutureValue: [4, 5],
  PresentValue: [4, 5],
  Payment: [4, 5],
  Rate: [4, 6],
  Function: [3, 3],
  // ---- 几何度量杂项（L4-A6）+ 迭代 + 非线性拟合 ----
  AffineRatio: [3, 3],
  Barycenter: [1, 2],
  CrossRatio: [4, 4],
  AreConcurrent: [3, 3],
  InteriorAngles: [1, 1],
  Direction: [1, 1],
  DynamicCoordinates: [3, 3],
  PathParameter: [1, 1],
  TriangleCenter: [4, 4],
  Iteration: [3, 3],
  IterationList: [3, 3],
  FitSin: [1, 1],
  FitLogistic: [1, 1],
  FitGeneral: [2, 2],   // 官方 Fit(list, f)——别名注册避免与 FitLine 冲突，分发时 Fit [2] 路由至此
};

/** 全部命令名（字典序）：供输入栏自动补全使用。 */
export const COMMAND_NAMES: string[] = Object.keys(COMMAND_ARITY).sort();

/** 小写名 → 规范名 反查表：官方命令查找大小写不敏感（Commands.java:1265
 *  equalsIgnoreCase），此前精确匹配会让 PolyLine(...)、point(1,2) 一类官方
 *  拼写直接失败。 */
const COMMAND_BY_LOWER: Map<string, string> = new Map(
  Object.keys(COMMAND_ARITY).map(name => [name.toLowerCase(), name]),
);

/** 大小写不敏感地解析命令名，未知命令返回 null。 */
const resolveCommandName = (name: string): string | null =>
  COMMAND_ARITY[name] ? name : (COMMAND_BY_LOWER.get(name.toLowerCase()) ?? null);

/** 3D 命令面共享查找器形状（dispatchCommand ctx 的 3D 侧子集）。 */
interface Finder3DCtx {
  findPoint3D(label: string): unknown;
  findLine3D(label: string): unknown;
  findPlane3D(label: string): unknown;
  findQuadric3D(label: string): unknown;
  findPolyhedron3D(label: string): unknown;
}

/** 解析标签为 3D 对象并标注类型：['point3D'|'line3D'|'plane3D'|'quadric3D'|'polyhedron3D', obj]。
 *  供同名命令的 3D 重载分发（官方 2D/3D 命令重载按参数类型自动分发）。 */
function resolve3DObject(ctx: Finder3DCtx, label: string): [string, unknown] | null {
  const p = ctx.findPoint3D(label);
  if (p) return ['point3D', p];
  const l = ctx.findLine3D(label);
  if (l) return ['line3D', l];
  const pl = ctx.findPlane3D(label);
  if (pl) return ['plane3D', pl];
  const q = ctx.findQuadric3D(label);
  if (q) return ['quadric3D', q];
  const ph = ctx.findPolyhedron3D(label);
  if (ph) return ['polyhedron3D', ph];
  return null;
}

/** 列表项解析：标签点/数值 → 构造内对象；数字字面量 → **入构造**的静态数值
 *  （此前临时包装不入构造，constIndex=-1 落盘后算法连同下游被静默丢弃）。 */
function resolveItemArg(ctx: CommandContext, kernel: Kernel, text: string): GeoElement | null {
  const t = text.trim();
  const found = ctx.findPoint(t) ?? ctx.findNumeric(t);
  if (found) return found;
  const v = Number(t);
  if (Number.isFinite(v) && t !== '') return ctx.createStaticNumeric(v);
  // 内联点元组 (x, y)
  const tuple = /^\(([^,]+),([^,]+)\)$/.exec(t);
  if (tuple) {
    const p = ctx.makeFreePoint(ctx.evaluateNumber(tuple[1]), ctx.evaluateNumber(tuple[2]));
    return p;
  }
  return null;
}

/** 两参数是否至少有一个是 3D 对象（同名命令 3D 回退的判定）。 */
function anyArg3D(ctx: Finder3DCtx, args: string[]): boolean {
  return args.some(arg => resolve3DObject(ctx, arg.trim()) !== null);
}

/** 命令签名文本（补全提示用）：语言无关的参数个数标注，如 `Segment(2)` / `Circle(2–3)`。 */
export function commandSignature(name: string): string {
  const entry = COMMAND_ARITY[name];
  if (!entry) return name;
  const [min, max] = entry;
  const arityText = min === max ? `${min}` : `${min}–${max}`;
  return `${name}(${arityText})`;
}

/** 只在顶层逗号处切分参数，保留括号内的逗号（`(0, 0), (3, 4)` 切成 2 个而非 4 个）。 */
const splitArgs = (argsText: string): string[] => {
  const args: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < argsText.length; i++) {
    const char = argsText[i];
    // 引号内的逗号/括号不参与切分（Text("a, b", 1, 2)）
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    // 花括号同样计入深度：命令参数里的列表字面量 FitExp({P0, P1}) 不被逗号拆开
    if (char === '(' || char === '{') depth++;
    else if (char === ')' || char === '}') depth--;
    else if (char === ',' && depth === 0) {
      args.push(argsText.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(argsText.slice(start).trim());
  return args;
};

/** 解析字符串字面量参数（"..." 或 '...'），非字符串返回 null。 */
/** 表达式树里是否含字符串字面量（动态文本分支判定）。 */
const containsStringLiteral = (node: ExpressionNode): boolean => {
  if (node.kind === 'string') return true;
  if (node.kind === 'binary') return containsStringLiteral(node.left) || containsStringLiteral(node.right);
  if (node.kind === 'unary') return containsStringLiteral(node.operand);
  if (node.kind === 'call') return node.args.some(containsStringLiteral);
  return false;
};

const parseStringArg = (arg: string): string | null => {
  const m = /^"(.*)"$/s.exec(arg.trim()) || /^'(.*)'$/s.exec(arg.trim());
  return m ? m[1] : null;
};

/** 在顶层 `=` 处切分左右两侧（忽略括号内的 `=`，如 `f(x) = ...`；也跳过 `<=`/`>=` 的等号）。 */
const splitAtTopLevelEquals = (input: string): [string, string] | null => {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === '=' && depth === 0 && input[i - 1] !== '<' && input[i - 1] !== '>') {
      return [input.slice(0, i).trim(), input.slice(i + 1).trim()];
    }
  }
  return null;
};

/** 在顶层比较运算符处切分不等式（`>=`/`<=` 必须先于 `>`/`<` 匹配）。 */
const splitAtTopLevelComparison = (input: string): { lhs: string; op: InequalityOp; rhs: string } | null => {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0) {
      if (input.startsWith('>=', i) || input.startsWith('<=', i)) {
        return { lhs: input.slice(0, i).trim(), op: input.slice(i, i + 2) as InequalityOp, rhs: input.slice(i + 2).trim() };
      }
      if (char === '>' || char === '<') {
        return { lhs: input.slice(0, i).trim(), op: char as InequalityOp, rhs: input.slice(i + 1).trim() };
      }
    }
  }
  return null;
};

const parseFunctionHeader = (left: string): { label: string; variableName: string } | null => {
  const match = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)$/.exec(left);
  return match ? { label: match[1], variableName: match[2] } : null;
};

/** GeoGebra 冒号前缀定义 `c: x²+y²=1`、`l1: y=3`、`α: ...`——此前无任何处理，
 *  官方最常用的带标签输入格式全部被拒。顶层冒号（跳过括号与字符串字面量）
 *  切分出标签，标签可含希腊字母（角度默认字符表）。 */
const COLON_LABEL_RE = /^(?:[a-zA-Z_][a-zA-Z0-9_]*|[\u0370-\u03FF](?:[\u0370-\u03FFa-zA-Z0-9_])*)$/;
const extractColonLabel = (input: string): [string, string] | null => {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '(' || char === '{') depth++;
    else if (char === ')' || char === '}') depth--;
    else if (depth === 0 && (char === '"' || char === "'")) {
      const quote = char;
      i++;
      while (i < input.length && input[i] !== quote) i++;
    } else if (char === ':' && depth === 0) {
      const label = input.slice(0, i).trim();
      const rest = input.slice(i + 1).trim();
      return COLON_LABEL_RE.test(label) && rest ? [label, rest] : null;
    }
  }
  return null;
};

/** 解析坐标元组文本 `"(x,y)"`；不是元组或求值失败返回 null。 */
const tryParseCoordTuple = (text: string, kernel: Kernel): GeoPoint | null => {
  const m = /^\(([^,]+),([^,]+)\)$/.exec(text.trim());
  if (!m) return null;
  const x = evaluate(parseExpression(m[1].trim()), new Map());
  const y = evaluate(parseExpression(m[2].trim()), new Map());
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return new GeoPoint(kernel, new GeoVec3D(x, y, 1));
};

/** `(x, y, z)` 三元组 → 3D 点。 */
const tryParseCoordTuple3 = (text: string, kernel: Kernel): GeoPoint3D | null => {
  const m = /^\(([^,]+),([^,]+),([^,]+)\)$/.exec(text.trim());
  if (!m) return null;
  const x = evaluate(parseExpression(m[1].trim()), new Map());
  const y = evaluate(parseExpression(m[2].trim()), new Map());
  const z = evaluate(parseExpression(m[3].trim()), new Map());
  if (![x, y, z].every(Number.isFinite)) return null;
  const point = new GeoPoint3D(kernel, Coords4.fromPoint(x, y, z));
  return point;
};

/** 代数输入可见视区（世界坐标）：Root/Extremum 的"视区内搜索"用。 */
export interface AlgebraViewBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** 当前构造的全部标签 —— 词法切分提示（xy → x·y 需要"哪些标识符是已知量"）。
 *  x/y/z 是 GeoGebra 的标准自由变量（函数参数 f(x)、Curve 的 t 等经 allowedVariables
 *  另行解析），常驻提示集：f(x) = xsin(x) 中的 x 不是构造标签，但切分需要它。 */
const collectKnownIdentifierHints = (kernel: Kernel): Set<string> => {
  const hints = new Set<string>(['x', 'y', 'z']);
  for (const el of kernel.getConstruction().getElements()) {
    const label = (el as { label?: string }).label;
    if (label) hints.add(label);
  }
  return hints;
};

export function parseAlgebraInput(
  kernel: Kernel,
  input: string,
  viewBounds?: AlgebraViewBounds,
  depth = 0,
): ConstructionElement[] {
  // 词法期注入已知标识符：未知多字母名（xy、xsin(x)）按构造标签切成隐式乘积
  return withIdentifierHints(collectKnownIdentifierHints(kernel), () =>
    parseAlgebraInputImpl(kernel, input, viewBounds, depth));
}

function parseAlgebraInputImpl(
  kernel: Kernel,
  input: string,
  viewBounds?: AlgebraViewBounds,
  depth = 0,
): ConstructionElement[] {
  const raw = input.trim();
  if (!raw) throw new Error('Input is empty');
  const construction = kernel.getConstruction();
  const existingLabels = new Set(construction.getElements().map(el => (el as any).label).filter(Boolean));

  // 冒号前缀定义（GeoGebra `c: x²+y²=1`）：剥掉标签前缀后重入，把第一个
  // GeoElement 输出改名为指定标签（重入产生的自动标签不会与之冲突——
  // 该标签不在 existingLabels 里，自动分配器看不到它）。
  const colonDef = extractColonLabel(raw);
  if (colonDef) {
    const [label, rest] = colonDef;
    if (existingLabels.has(label)) throw new Error(`Label "${label}" already exists`);
    const elements = parseAlgebraInputImpl(kernel, rest, viewBounds, depth + 1);
    const firstGeo = elements.find(el => el instanceof GeoElement && !(el instanceof AlgoElement));
    if (firstGeo) {
      (firstGeo as unknown as { label: string }).label = label;
    }
    return elements;
  }

  // A1-8：嵌套命令参数展开（对标 GeoGebra CommandProcessor.resArgs 的递归求值）。
  // 参数本身是已知命令时先递归求值并把产物加入构造，再以输出标签代入外层命令。
  // 例：Midpoint(A, Midpoint(B, C))、Circle(A, Distance(B, C))。
  const MAX_COMMAND_NESTING = 8;
let redefineSeq = 0;
  const expandNestedCommand = (arg: string): string => {
    const trimmed = arg.trim();
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/.exec(trimmed);
    if (!m) return arg;
    const nestedCanonical = resolveCommandName(m[1]);
    const [nestedMin] = nestedCanonical ? COMMAND_ARITY[nestedCanonical] : [0, 0];
    if (!nestedCanonical || nestedMin === 0) return arg; // 不是命令（sin、自定义函数调用等），保持原样
    if (depth >= MAX_COMMAND_NESTING) {
      throw new Error(`Command nesting is too deep (max ${MAX_COMMAND_NESTING})`);
    }
    const nestedElements = parseAlgebraInput(kernel, trimmed, viewBounds, depth + 1);
    // 先校验输出个数再入构造：校验放在 addElement 之后时，失败路径会把
    // 内联产物滞留在构造里且无 undo 记录（如 Midpoint(A, Intersection(l, c))）
    const outputs = nestedElements.filter(el => !(el instanceof AlgoElement));
    const outLabel = outputs.length === 1 ? (outputs[0] as unknown as { label?: string }).label : undefined;
    if (outputs.length !== 1 || !outLabel) {
      throw new Error(`Command ${m[1]} returns ${outputs.length} objects; nested use needs exactly one`);
    }
    nestedElements.forEach(el => construction.addElement(el));
    construction.updateAllAlgorithms();
    nestedElements.forEach(el => {
      const label = (el as any).label;
      if (label) existingLabels.add(label);
    });
    return outLabel;
  };

  // ------------------------------------------------------------------
  // 依赖解析
  // ------------------------------------------------------------------

  /** 把表达式里的变量解析成构造中已有的 GeoNumeric；找不到即报错。 */
  const makeNumericDependencies = (expression: ExpressionNode, allowedVariables: string[] = []): GeoNumeric[] => {
    const variables = collectVariables(expression);
    return Array.from(variables).map(name => {
      if (allowedVariables.includes(name)) return null;
      const dependency = construction.getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === name);
      if (!dependency) throw new Error(`Unknown variable "${name}"`);
      return dependency as GeoNumeric;
    }).filter((dependency): dependency is GeoNumeric => dependency !== null);
  };

  /** 表达式内调用的用户函数依赖（f(2)、h(x) = f(x)+1），未知名字报错。
   *  收集**传递闭包**：h 引 g、g 引 f 时依赖必须含 f，否则求值 g 的表达式时
   *  map 里没有 f、整条链 NaN（此前只收直接引用，三层函数链即挂）。 */
  const makeFunctionDeps = (ast: ExpressionNode, selfLabel?: string): GeoFunction[] => {
    const out: GeoFunction[] = [];
    const seen = new Set<string>();
    const addFn = (fn: GeoFunction) => {
      if (!fn.label || fn.label === selfLabel || seen.has(fn.label)) return;
      seen.add(fn.label);
      out.push(fn);
      const algo = fn.parentAlgo;
      if (algo && algo.getClassName() === 'AlgoDependentFunction') {
        (algo as AlgoDependentFunction).getFunctionDependencies().forEach(addFn);
      }
    };
    const visit = (node: ExpressionNode) => {
      if (node.kind === 'call') {
        if (!BUILTIN_FUNCTIONS.has(node.name)) {
          const fn = construction.getElements().find(
            el => el instanceof GeoFunction && (el as GeoFunction).label === node.name) as GeoFunction | undefined;
          if (!fn) throw new Error(`Unknown function "${node.name}"`);
          addFn(fn);
        }
        node.args.forEach(visit);
      } else if (node.kind === 'binary') { visit(node.left); visit(node.right); }
      else if (node.kind === 'unary') { visit(node.operand); }
    };
    visit(ast);
    return out;
  };

  const findNumeric = (label: string): GeoNumeric | undefined =>
    construction.getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === label) as GeoNumeric | undefined;

  /**
   * 函数定义的依赖解析（官方语义扩展）：未知**单字母**变量自动创建自由数值 1
   * 并入构造（GeoGebra 输入 f(x)=a x^b 会创建自由数 a、b——Fit 通用拟合的
   * 前提）。多字母未知变量仍报错（拼写保护）。
   */
  const makeNumericDepsAutoFree = (expression: ExpressionNode, allowedVariables: string[] = []): GeoNumeric[] => {
    const variables = collectVariables(expression);
    const pendingFree: string[] = [];
    const resolved = Array.from(variables).map(name => {
      if (allowedVariables.includes(name)) return null;
      const existing = construction.getElements().find(
        el => el instanceof GeoNumeric && (el as GeoNumeric).label === name) as GeoNumeric | undefined;
      if (existing) return existing;
      // 同名**非数值**对象已占用（点 B 等）：不静默新建数值（会造成同标签双对象）
      const clashed = construction.getElements().find(
        el => (el as unknown as { label?: string }).label === name);
      if (clashed) throw new Error(`Unknown variable "${name}"`);
      if (/^[a-zA-Z]$/.test(name)) {
        pendingFree.push(name);
        return null;
      }
      throw new Error(`Unknown variable "${name}"`);
    }).filter((dependency): dependency is GeoNumeric => dependency !== null);
    // 失败不残留：自由数在依赖收集**全部通过**后才创建（此前逐变量立即入构造，
    // 后续步骤抛错会留下幽灵滑块并随存档序列化）
    for (const name of pendingFree) {
      const free = new GeoNumeric(kernel, 1);
      free.label = name;
      existingLabels.add(name);
      construction.addElement(free);
      resolved.push(free);
    }
    return resolved;
  };

  /** 找出表达式引用到的滑块依赖（允许列表如参数名除外）。 */
  const collectDeps = (expressions: ExpressionNode[], allowedVariables: string[]): GeoNumeric[] => {
    const variables = new Set<string>();
    for (const expression of expressions) collectVariables(expression, variables);
    for (const allowed of allowedVariables) variables.delete(allowed);
    const deps: GeoNumeric[] = [];
    const seen = new Set<string>();
    for (const variable of variables) {
      const numeric = findNumeric(variable);
      if (numeric && !seen.has(numeric.label)) {
        deps.push(numeric);
        seen.add(numeric.label);
      }
    }
    return deps;
  };

  /** 静态数值输出（数论等纯算术命令）：自由 GeoNumeric 入构造。 */
  const staticNumeric = (value: number, labels: Set<string>, cons: Construction): GeoNumeric => {
    const geo = new GeoNumeric(kernel, value);
    if (Number.isNaN(value)) geo.setUndefined();
    assignNextLabel(geo, () => cons.getNextNumericLabel(labels));
    labels.add(geo.label);
    cons.addElement(geo);
    return geo;
  };

  const findPoint = (label: string): GeoPoint | undefined =>
    construction.getElements().find(el => el instanceof GeoPoint && (el as GeoPoint).label === label) as GeoPoint | undefined;

  const findFunction = (label: string): GeoFunction | undefined =>
    construction.getElements().find(el => el instanceof GeoFunction && (el as GeoFunction).label === label) as GeoFunction | undefined;

  const findLine = (label: string): GeoLine | undefined =>
    construction.getElements().find(el => el instanceof GeoLine && (el as GeoLine).label === label) as GeoLine | undefined;

  const findConic = (label: string): GeoConic | undefined =>
    construction.getElements().find(el => el instanceof GeoConic && (el as GeoConic).label === label) as GeoConic | undefined;

  const findCurve = (label: string): GeoCurve | undefined =>
    construction.getElements().find(el => el instanceof GeoCurve && (el as GeoCurve).label === label) as GeoCurve | undefined;

  // 列表命令族的源查找（按标签；列表字面量在解析期已物化为 GeoList）
  const findListArg = (label: string): GeoList | undefined =>
    construction.getElements().find(el => el instanceof GeoList && (el as GeoList).label === label) as GeoList | undefined;

  const findPolygon = (label: string): GeoPolygon | undefined =>
    construction.getElements().find(el => el instanceof GeoPolygon && (el as GeoPolygon).label === label) as GeoPolygon | undefined;

  const findPoint3D = (label: string): GeoPoint3D | undefined =>
    construction.getElements().find(el => el instanceof GeoPoint3D && (el as GeoPoint3D).label === label) as GeoPoint3D | undefined;

  const findLine3D = (label: string): GeoLine3D | undefined =>
    construction.getElements().find(el => el instanceof GeoLine3D && (el as GeoLine3D).label === label) as GeoLine3D | undefined;

  const findPlane3D = (label: string): GeoPlane3D | undefined =>
    construction.getElements().find(el => el instanceof GeoPlane3D && (el as GeoPlane3D).label === label) as GeoPlane3D | undefined;

  const findQuadric3D = (label: string): GeoQuadric3D | undefined =>
    construction.getElements().find(el => el instanceof GeoQuadric3D && (el as GeoQuadric3D).label === label) as GeoQuadric3D | undefined;

  const findPolyhedron3D = (label: string): GeoPolyhedron3D | undefined =>
    construction.getElements().find(el => el instanceof GeoPolyhedron3D && (el as GeoPolyhedron3D).label === label) as GeoPolyhedron3D | undefined;

  const findSurface = (label: string): GeoSurface | undefined =>
    construction.getElements().find(el => el instanceof GeoSurface && (el as GeoSurface).label === label) as GeoSurface | undefined;

  const findCircle3D = (label: string): GeoCircle3D | undefined =>
    construction.getElements().find(el => el instanceof GeoCircle3D && (el as GeoCircle3D).label === label) as GeoCircle3D | undefined;

  const findPolyline3D = (label: string): GeoPolyline3D | undefined =>
    construction.getElements().find(el => el instanceof GeoPolyline3D && (el as GeoPolyline3D).label === label) as GeoPolyline3D | undefined;

  const findConic3D = (label: string): GeoConic3D | undefined =>
    construction.getElements().find(el => el instanceof GeoConic3D && (el as GeoConic3D).label === label) as GeoConic3D | undefined;

  const findNet3D = (label: string): GeoNet3D | undefined =>
    construction.getElements().find(el => el instanceof GeoNet3D && (el as GeoNet3D).label === label) as GeoNet3D | undefined;

  /** 用已有数字依赖把表达式求成一个有限数值。 */
  const evaluateNumber = (text: string, allowedVariables: string[] = []): number => {
    const expression = parseExpression(text);
    const dependencies = makeNumericDependencies(expression, allowedVariables);
    const scope: Scope = new Map();
    dependencies.forEach((dependency, index) => scope.set(dependency.label || `dep${index}`, dependency.getValue()));
    const value = evaluate(expression, scope);
    if (!Number.isFinite(value)) throw new Error(`"${text}" does not evaluate to a number`);
    return value;
  };

  /** 解析一个「数字参数」：可以是已有数字标签，也可以是算术表达式。 */
  const resolveNumber = (text: string): number => {
    const trimmed = text.trim();
    const dependency = findNumeric(trimmed);
    if (dependency) return dependency.getValue();
    return evaluateNumber(trimmed);
  };

  const assignNextLabel = <T extends { label: string }>(element: T, nextLabel: () => string): void => {
    if (!element.label) element.label = nextLabel();
    existingLabels.add(element.label);
  };

  /**
   * 命令参数里内联新建的自由点追踪表。
   * resolvePointArg 的 `(x, y)` 元组、Length(P) 的原点等都经 makeFreePoint 创建，
   * 却不随命令输出返回——不登记则 constIndex 停在 -1，序列化 inputs 引用不存在的
   * 元素，载入时 "missing inputs" 静默丢对象。分发结束后由 mergeCreatedElements
   * 统一并入返回数组（已随输出返回的会被去重跳过）。
   */
  const createdElements: GeoElement[] = [];

  /** 生成一个带标签的自由点。 */
  const makeFreePoint = (x: number, y: number): GeoPoint => {
    const point = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
    assignNextLabel(point, () => construction.getNextPointLabel(existingLabels));
    createdElements.push(point);
    return point;
  };

  /** 变量 ⊆ {x,y,z} ∪ 已有滑块，或全为常数时把文本解析成表达式；否则 null。 */
  const tryParseAsQuadricSide = (text: string): ExpressionNode | null => {
    try {
      const expr = parseExpression(text.trim());
      const vars = collectVariables(expr);
      const hasSpatial = vars.has('x') || vars.has('y') || vars.has('z');
      const scope: Scope = new Map();
      for (const name of vars) {
        if (name === 'x' || name === 'y' || name === 'z') continue;
        const n = findNumeric(name);
        if (!n) return null;
        scope.set(name, n.getValue());
      }
      if (!hasSpatial) {
        // 纯常数侧（如 RHS=0）：只要能求出有限值即可
        const v = evaluate(expr, scope);
        return Number.isFinite(v) ? expr : null;
      }
      const zero: ExpressionNode = { kind: 'number', value: 0 };
      if (extractQuadricCoeffs(expr, zero, scope) === null) return null;
      return expr;
    } catch {
      return null;
    }
  };

  /**
   * 构建 AlgoDependentQuadric3D（lhs − rhs 为二次型）。
   * expressionText 始终存完整原始输入 raw（序列化 roundtrip 直接重走识别器）。
   * 要求整体至少含一个 x/y/z（避免 `q = 5` 变成退化曲面）。
   */
  const buildQuadricAlgo = (
    lhs: ExpressionNode,
    label?: string,
    rhs?: ExpressionNode,
  ): AlgoDependentQuadric3D | null => {
    const rhsExpr = rhs ?? parseExpression('0');
    const allVars = collectVariables(lhs);
    collectVariables(rhsExpr, allVars);
    if (!allVars.has('x') && !allVars.has('y') && !allVars.has('z')) return null;
    const deps = collectDeps([lhs, rhsExpr], ['x', 'y', 'z']);
    // 滑块依赖：把当前值放进 scope 试提取，失败则仍建 algo 由 compute 填
    try {
      const scope: Scope = new Map();
      deps.forEach((dep, i) => scope.set(dep.label || `dep${i}`, dep.getValue()));
      if (extractQuadricCoeffs(lhs, rhsExpr, scope) === null) {
        // 系数依赖滑块但当前不可提（非多项式）→ 放弃
        // 多项式但含未注册变量时 extract 返回 null
        const free = new Set<string>();
        collectVariables(lhs, free);
        collectVariables(rhsExpr, free);
        const known = new Set(['x', 'y', 'z']);
        deps.forEach(d => known.add(d.label));
        for (const name of free) if (!known.has(name)) return null;
        // 已知变量仍提不出 → 非二次多项式
        return null;
      }
      const algo = new AlgoDependentQuadric3D(kernel, lhs, rhsExpr, raw, deps);
      if (label) algo.getOutput().label = label;
      if (algo.getOutput().isDefined()) return algo;
      return null;
    } catch {
      return null;
    }
  };

  // ------------------------------------------------------------------
  // 2D 隐式方程 → 直线/圆锥曲线（只含 x,y 的多项式，次数 ≤ 2）
  // ------------------------------------------------------------------

  /** 解析 lhs−rhs 为 2D 多项式系数；纯常数侧直接求值合成。非 2D 多项式返回 null。 */
  const poly2DCoeffs = (text: string): number[] | null => {
    try {
      const expr = parseExpression(text.trim());
      const vars = collectVariables(expr);
      for (const v of vars) if (v !== 'x' && v !== 'y') return null;
      const zero: ExpressionNode = { kind: 'number', value: 0 };
      const scope: Scope = new Map();
      // 纯常数侧（如 `y=0` 的 RHS）：extractQuadricCoeffs 不收无空间变量
      // 的表达式，这里直接求值合成系数（[xx,yy,zz,const,...] 仅 const 位）。
      if (vars.size === 0) {
        const v = evaluate(expr, scope);
        if (!Number.isFinite(v)) return null;
        return [0, 0, 0, v, 0, 0, 0, 0, 0, 0];
      }
      return extractQuadricCoeffs(expr, zero, scope);
    } catch { return null; }
  };

  /** `lhs = rhs` → GeoLine（一次）或 GeoConic（二次，含退化）；不支持返回 null。 */
  const tryImplicit2D = (lhsText: string, rhsText: string): GeoLine | GeoConic | null => {
    const L = poly2DCoeffs(lhsText);
    const R = poly2DCoeffs(rhsText);
    if (!L || !R) return null;
    // extractQuadricCoeffs 顺序 [xx,yy,zz,const,xy,xz,yz,x,y,z]
    const A = L[0] - R[0];
    const B = L[4] - R[4];
    const C = L[1] - R[1];
    const D = L[7] - R[7];
    const E = L[8] - R[8];
    const F = L[3] - R[3];
    const deg2 = Math.max(Math.abs(A), Math.abs(B), Math.abs(C));
    const deg1 = Math.max(Math.abs(D), Math.abs(E));
    if (deg2 > 1e-12) return new GeoConic(kernel, [A, B, C, D, E, F]);
    if (deg1 > 1e-12) return new GeoLine(kernel, D, E, F);
    return null; // 0=0 / 5=5：交给上层报错
  };

  // ------------------------------------------------------------------
  // 定义式
  // ------------------------------------------------------------------

  // 完整重定义：用临时标签走正常 RHS 构造（命令/元组/表达式/隐式方程各路径复用），
  // 校验类型族后整体替换旧对象（依赖者改接新对象、保 constIndex、旧定义算法移除）

  /** 循环定义判定（对标官方 newGeo.isChildOf(oldGeo) 递归）：newGeo 的定义链
   *  沿 parentAlgo 传递可达 existing 即成环——只查直接输入会让 a=c+1 于 c=a+1
   *  之后被接受，两者互相读取陈旧值冻结。 */
  const wouldCreateCycle = (newGeo: GeoElement, existing: GeoElement, hops = 0): boolean => {
    if (hops > 64) return true; // 深度兜底：正常构造链不会这么深
    const algo = newGeo.parentAlgo;
    if (!algo) return false;
    for (const input of algo.getInput()) {
      if (!(input instanceof GeoElement)) continue;
      if (input === existing || wouldCreateCycle(input, existing, hops + 1)) return true;
    }
    return false;
  };

  const redefineElement = (existing: GeoElement, label: string, rhs: string): ConstructionElement[] => {
    const tempLabel = `__redef${++redefineSeq}`;
    const created = parseAlgebraInput(kernel, `${tempLabel} = ${rhs}`, viewBounds, depth + 1);
    const newGeo = created.find(
      el => el instanceof GeoElement && (el as GeoElement).label === tempLabel) as GeoElement | undefined;
    if (!newGeo) throw new Error(`Cannot redefine "${label}" with "${rhs}"`);
    // 类型族校验（v1 收紧为同类）：跨类替换会让期望特定类型的依赖算法失效
    if (existing.constructor !== newGeo.constructor) {
      throw new Error(`Cannot redefine "${label}": ${existing.getClassName()} → ${newGeo.getClassName()} (type change not supported)`);
    }
    const oldAlgo = existing.parentAlgo;
    if (oldAlgo && oldAlgo.getGeoElements().length !== 1) {
      throw new Error(`Cannot redefine "${label}": it is one output of a multi-output object`);
    }
    const newAlgo = created.find(el => el instanceof AlgoElement) as AlgoElement | undefined;
    // 循环定义守卫（对标 CircularDefinitionException）：直接引用或传递依赖成环。
    // 官方特判（Construction.java:1516-1533）：独立对象自引用 = 就地赋值而非错误
    // —— a = a + 1 语义是"把 a 设为表达式当前值"（脚本 SetValue 场景常规操作）。
    if (wouldCreateCycle(newGeo, existing)) {
      if (existing.isIndependent() && existing.constructor === newGeo.constructor
          && existing instanceof GeoNumeric && newGeo instanceof GeoNumeric) {
        const newAlgoSelf = created.find(el => el instanceof AlgoElement) as AlgoElement | undefined;
        newAlgoSelf?.update(); // 先算出新值（临时对象未入构造，算完即弃）
        const value = newGeo.getValue();
        if (!Number.isNaN(value)) {
          existing.setValue(value);
          return [];
        }
      }
      throw new Error(`Circular definition of "${label}"`);
    }
    // 构造段重建：依赖算法按 (类型, 输入, extras) 捕获后在 newGeo 之上原样重建
    //（算法把输入缓存在私有字段，仅换 input 数组 compute 读不到新对象）
    construction.rebuildReplace(existing, newGeo, newAlgo);
    // 附带产物（如 PointOn 的隐藏参数 GeoNumeric）与正常命令路径一样登记进构造：
    // 此前只登记 newGeo/newAlgo，param 的 constIndex 停在 −1，序列化写出
    // 引用 −1 的算法记录，反序列化整条算法被跳过（Attach 后存档丢对象）
    for (const el of created) {
      if (el instanceof GeoElement && el !== newGeo && !newAlgo?.getGeoElements().includes(el)) {
        construction.addElement(el);
      }
    }
    if (oldAlgo) construction.removeAlgoKeepOutputs(oldAlgo);
    // 定向重算：新算法先算出新对象，再让重建后的依赖链跟随
    newAlgo?.update();
    construction.updateDependentAlgorithms(newGeo);
    return []; // 已登记进构造
  };

  const buildListLiteral = (rhs: string): GeoList => {
    const match = /^\{(.*)\}$/.exec(rhs.trim());
    if (!match) throw new Error(`Invalid list literal "${rhs.trim()}"`);
    const items = splitArgs(match[1]).filter(arg => arg.length > 0);
    if (items.length === 0) throw new Error('Empty list');
    const children: GeoElement[] = [];
    for (const item of items) {
      const label = item.trim();
      const found = construction.getElements().find(
        el => el instanceof GeoElement && (el as unknown as { label?: string }).label === label);
      if (found) {
        children.push(found as GeoElement);
        continue;
      }
      // 嵌套列表字面量 {{1,2},{3}}（此前直接抛 Unknown object）
      if (/^\{.*\}$/.test(label)) {
        children.push(buildListLiteral(label));
        continue;
      }
      // 数字字面量：**入构造**的静态数值（临时包装 constIndex=-1 会让存档
      // 丢算法——与 resolveItemArg 同一约定）
      const asNumber = Number(label);
      if (Number.isFinite(asNumber) && label !== '') {
        children.push(staticNumeric(asNumber, existingLabels, construction));
        continue;
      }
      // 内联点元组 (x, y)：物化为构造内自由点（makeFreePoint 走 createdElements undo 差分）
      const tuple = /^\(([^,]+),([^,]+)\)$/.exec(label);
      if (tuple) {
        children.push(makeFreePoint(evaluateNumber(tuple[1]), evaluateNumber(tuple[2])));
        continue;
      }
      throw new Error(`Unknown object "${label}" in list`);
    }
    return new GeoList(kernel, children);
  };
  /** 命令列表参数解析：按标签查构造，字面量则物化为并入构造的列表
   *  （自有子元素走 childScalars/childPoints roundtrip）。impl 本地闭包版。 */
  const resolveListCtx = (text: string): GeoList | undefined => {
    const t = text.trim();
    const found = construction.getElements().find(
      el => el instanceof GeoList && (el as GeoList).label === t) as GeoList | undefined;
    if (found) return found;
    if (/^\{.*\}$/.test(t)) {
      const list = buildListLiteral(t);
      list.label = construction.getNextPointLabel(existingLabels);
      existingLabels.add(list.label);
      construction.addElement(list);
      return list;
    }
    return undefined;
  };

  const definition = splitAtTopLevelEquals(raw);
  if (definition) {
    const [leftText, rightText] = definition;
    // 赋值形式的列表字面量（src = {A, B, C}）：此前只支持裸输入，
    // 带标签赋值会掉进 parseExpression 报 "Unsupported character {"。
    if (/^\{(.*)\}$/.test(rightText.trim())) {
      const list = buildListLiteral(rightText);
      list.label = leftText.trim();
      existingLabels.add(list.label);
      // 不在此处 addElement：与其他定义路径同一契约（返回元素由调用方入构造），
      // 此前自加 + 调用方再加 → 构造重复条目 → 序列化同一列表出现两次
      return [list];
    }
    const functionHeader = parseFunctionHeader(leftText);

    if (functionHeader) {
      if (functionHeader.variableName !== 'x') throw new Error('Only f(x) is supported');
      if (existingLabels.has(functionHeader.label)) {
        // 函数重定义：f(x) = 新表达式（旧定义算法随替换移除，依赖者改接新函数）
        const existingFn = construction.getElements().find(
          el => el instanceof GeoElement && (el as unknown as { label?: string }).label === functionHeader.label);
        if (!(existingFn instanceof GeoFunction)) throw new Error(`Label "${functionHeader.label}" already exists`);
        const expression = parseExpression(rightText);
        const dependencies = makeNumericDepsAutoFree(expression, [functionHeader.variableName]);
        const fnDeps = makeFunctionDeps(expression, functionHeader.label);
        const algo = new AlgoDependentFunction(kernel, expression, functionHeader.variableName, rightText, dependencies, fnDeps);
        // 与 redefineElement 同一条构造段重建路径（输入缓存于私有字段，仅换 input 数组不生效）
        const oldAlgo = existingFn.parentAlgo;
        if (oldAlgo && oldAlgo.getGeoElements().length !== 1) {
          throw new Error(`Cannot redefine "${functionHeader.label}": it is one output of a multi-output object`);
        }
        if (algo.getInput().includes(existingFn) || wouldCreateCycle(algo.getOutput(), existingFn)) {
          throw new Error(`Circular definition of "${functionHeader.label}"`);
        }
        construction.rebuildReplace(existingFn, algo.getOutput(), algo);
        if (oldAlgo) construction.removeAlgoKeepOutputs(oldAlgo);
        algo.update();
        construction.updateDependentAlgorithms(algo.getOutput());
        return [];
      }
      const expression = parseExpression(rightText);
      const dependencies = makeNumericDepsAutoFree(expression, [functionHeader.variableName]);
      const fnDeps = makeFunctionDeps(expression, functionHeader.label);
      const algo = new AlgoDependentFunction(kernel, expression, functionHeader.variableName, rightText, dependencies, fnDeps);
      algo.getOutput().label = functionHeader.label;
      return [algo, algo.getOutput()];
    }

    if (leftText === 'y') {
      const expression = parseExpression(rightText);
      if (collectVariables(expression).has('x')) {
        const dependencies = makeNumericDependencies(expression, ['x']);
        const algo = new AlgoDependentFunction(kernel, expression, 'x', rightText, dependencies);
        algo.getOutput().label = construction.getNextFunctionLabel(existingLabels);
        return [algo, algo.getOutput()];
      }
      // y = <不含 x>（如 y=0）→ 落入下方 2D 隐式方程分支（GeoGebra：直线）
    }

    // LHS 标签允许希腊字母（官方角度默认 α,β,…：`α = Angle(A,B,C)` 此前被拒）
    if (/^(?:[a-zA-Z_][a-zA-Z0-9_]*|[\u0370-\u03FF](?:[\u0370-\u03FFa-zA-Z0-9_])*)$/.test(leftText) && leftText !== 'x' && leftText !== 'y') {
      // B12：**重定义**——标签已存在且原对象是自由元素时，原位更新
      // （不删对象、依赖者全部保留，对标 GeoGebra 重定义语义）：
      //   - 数值滑块 `a = 2`：setValue + 依赖链增量重算；
      //   - 自由点 `A = (x, y)`：setCoords + 同上；
      //   - 新 RHS 带依赖（`a = b + 1`）：把自由数值升级为 AlgoDependentNumeric
      //     需要替换对象，走"级联删除 + 重建"路径（依赖者会级联重建失败——
      //     此情形报错提示先删除依赖者，与 GeoGebra 的受限场景一致）。
      // 函数（f(x)=…）与派生对象不支持重定义（保持既有报错）。
      if (existingLabels.has(leftText)) {
        const existing = construction.getElements().find(
          el => el instanceof GeoElement && (el as unknown as { label?: string }).label === leftText);
        const isFreeNumeric = existing instanceof GeoNumeric && existing.isIndependent();
        const isFreePoint = existing instanceof GeoPoint && existing.isIndependent();

        if (isFreeNumeric) {
          // 快路径：RHS 为无依赖常量 → 原位 setValue
          const newDeps = (() => {
            try {
              const expr = parseExpression(rightText);
              return makeNumericDependencies(expr);
            } catch { return [null as unknown as GeoNumeric]; }
          })();
          const value = Number(rightText);
          if ((newDeps === null || newDeps.length === 0) && Number.isFinite(value)) {
            (existing as GeoNumeric).setValue(value);
            construction.updateDependentAlgorithms(existing as GeoElement);
            return []; // 原位更新，调用方无需 addElement
          }
        }
        if (isFreePoint) {
          // 快路径：RHS 为坐标元组 → 原位 setCoords
          const point3 = tryParseCoordTuple3(rightText, kernel);
          const np = point3 ?? tryParseCoordTuple(rightText, kernel);
          if (np) {
            const ep = existing as GeoPoint;
            ep.setCoords(np.getX(), np.getY(), np.getZ?.() ?? 1);
            construction.updateDependentAlgorithms(ep);
            return [];
          }
        }
        // 慢路径：完整重定义（自由↔依赖、换定义式），保标签保依赖者
        // （对标 GeoGebra AlgebraProcessor.changeGeoElement + Construction.replace）
        return redefineElement(existing as GeoElement, leftText, rightText);
      }

      // 命令式 RHS：`poly = Polygon(A, B, C)` → 递归走命令分发，把第一个输出命名为 leftText。
      // 必须先于 parseExpression：否则 `Polygon(...)` 会被当成未知函数抛错。
      if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(rightText)) {
        const elements = parseAlgebraInput(kernel, rightText, viewBounds, depth + 1);
        if (elements.length > 0) {
          const first = elements.find(el => el instanceof GeoElement && !(el instanceof AlgoElement)) ?? elements[0];
          if (first && typeof (first as unknown as { label?: string }).label === 'string') {
            (first as unknown as { label: string }).label = leftText;
          }
          existingLabels.add(leftText);
          return elements;
        }
      }

      // 必须先于 parseExpression：否则 `A = (1, 2)` 会因 `(1, 2)` 不是合法算术表达式而抛错，
      // 让坐标元组这条分支永远不可达。
      const point3 = tryParseCoordTuple3(rightText, kernel);
      if (point3) {
        point3.label = leftText;
        return [point3];
      }
      const coordPoint = tryParseCoordTuple(rightText, kernel);
      if (coordPoint) {
        coordPoint.label = leftText;
        return [coordPoint];
      }

      const expression = parseExpression(rightText);
      // 带标签的隐式二次曲面：`quad = x^2 + y^2 - z^2 - 1`（变量 ⊆ {x,y,z}∪滑块 且次数 ≤2）
      {
        const algo = (() => {
          const probe = tryParseAsQuadricSide(rightText);
          return probe ? buildQuadricAlgo(probe, leftText) : null;
        })();
        if (algo) {
          algo.getOutput().label = leftText;
          existingLabels.add(leftText);
          return [algo, algo.getOutput()];
        }
      }
      // 动态文本：RHS 含字符串字面量（"面积 = " + a）→ AlgoDependentText
      if (containsStringLiteral(expression)) {
        const textDeps = makeNumericDependencies(expression);
        const algo = new AlgoDependentText(kernel, expression, textDeps, rightText);
        algo.getOutput().label = leftText;
        return [algo, algo.getOutput()];
      }
      const dependencies = makeNumericDependencies(expression);
      const fnDeps = makeFunctionDeps(expression);
      if (dependencies.length > 0 || fnDeps.length > 0) {
        const algo = new AlgoDependentNumeric(kernel, expression, dependencies, rightText, fnDeps);
        algo.getOutput().label = leftText;
        return [algo, algo.getOutput()];
      }
      const value = Number(rightText);
      if (Number.isFinite(value)) {
        const numeric = new GeoNumeric(kernel, value);
        numeric.label = leftText;
        return [numeric];
      }
      // 常量表达式 RHS（官方合法：`a = 1 + 1`、`r = 1/3`）——此前 fall through
      // 报"Definitions must use..."，纯数字字面量之外的自由数值定义全部失败
      const constValue = evaluate(expression, new Map());
      if (Number.isFinite(constValue)) {
        const numeric = new GeoNumeric(kernel, constValue);
        numeric.label = leftText;
        return [numeric];
      }
    }

    // 无标签 2D 隐式方程：`y=0`/`x=3` → 直线；`x^2+y^2=25`、`x=y^2` → 圆锥曲线。
    // 仅支持只含 x,y 的多项式（依赖滑块的隐式曲线仍走后续/报错，保持既有行为）。
    // 必须先于 3D quadric 探测：线性/纯 xy 方程不应被当作三维曲面。
    {
      const implicit = tryImplicit2D(leftText, rightText);
      if (implicit instanceof GeoLine) {
        implicit.label = construction.getNextLineLabel(existingLabels);
        return [implicit];
      }
      if (implicit) {
        implicit.label = construction.getNextCircleLabel(existingLabels);
        return [implicit];
      }
    }

    // 无标签隐式方程：`x^2 + y^2 - z^2 = 1` → 一般二次曲面
    {
      const lhsExpr = tryParseAsQuadricSide(leftText);
      const rhsExpr = tryParseAsQuadricSide(rightText);
      if (lhsExpr && rhsExpr) {
        const algo = buildQuadricAlgo(lhsExpr, undefined, rhsExpr);
        if (algo) {
          algo.getOutput().label = construction.getNextFunctionLabel(existingLabels);
          return [algo, algo.getOutput()];
        }
      }
    }

    throw new Error('Definitions must use f(x), y, or a numeric label');
  }

  // ------------------------------------------------------------------
  // 不等式区域：y > x^2、2x + 3y < 6、x^2 + y^2 <= 25
  // ------------------------------------------------------------------

  const inequality = splitAtTopLevelComparison(raw);
  if (inequality) {
    const lhsExpr = parseExpression(inequality.lhs);
    const rhsExpr = parseExpression(inequality.rhs);
    const variables = collectVariables(lhsExpr);
    collectVariables(rhsExpr, variables);
    if (!variables.has('x') && !variables.has('y')) {
      throw new Error('Inequality must depend on x or y');
    }
    const dependencies = collectDeps([lhsExpr, rhsExpr], ['x', 'y']);
    const algo = new AlgoDependentInequality(kernel, lhsExpr, rhsExpr, inequality.op, raw, dependencies);
    algo.getOutput().label = construction.getNextLineLabel(existingLabels);
    return [algo, algo.getOutput()];
  }

  // ------------------------------------------------------------------
  // 命令
  // ------------------------------------------------------------------

  // 列表字面量 {A, B, C}：子元素必须是构造中已有标签（对标 GeoGebra 列表）。
  // 必须先于命令匹配：{...} 不含括号，但 parseExpression 不识别花括号。
  const listMatch = /^\{(.*)\}$/.exec(raw);
  if (listMatch) {
    const list = buildListLiteral(raw);
    list.label = construction.getNextPointLabel(existingLabels);
    existingLabels.add(list.label);
    return [list];
  }

  const commandMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/.exec(raw);
  if (commandMatch) {
    const name = commandMatch[1];
    // 大小写不敏感解析为规范名（官方 equalsIgnoreCase），后续按规范名分发
    const canonical = resolveCommandName(name);
    const [minArgs, maxArgs] = canonical ? COMMAND_ARITY[canonical] : [0, 0];
    // 无参命令（如 Slider()）也要走命令分发：识别器有该命令的名字即进入，
    // 否则 `Slider()` 会被当成对未知函数的调用报错。
    if (canonical) {
      const rawArgs = splitArgs(commandMatch[2]).filter(arg => arg.length > 0);
      if (rawArgs.length < minArgs || rawArgs.length > maxArgs) {
        throw new Error(`Command ${name} requires ${minArgs === maxArgs ? minArgs : `${minArgs} or ${maxArgs}`} argument${minArgs === 1 ? '' : 's'}`);
      }
      // 先做参数个数校验，再做嵌套展开（展开会把嵌套产物写入构造）
      let args = rawArgs.map(expandNestedCommand);
      // 方程字符串参数（GeoGebra：Intersect(y=0, x^2+y^2=25)）——参数含顶层 `=`、
      // 可解析为 2D 多项式方程时，先创建该对象并以标签代入命令。
      args = args.map(arg => {
        if (!arg.includes('=')) return arg;
        const parts = splitAtTopLevelEquals(arg);
        if (!parts) return arg;
        if (parseFunctionHeader(parts[0])) return arg; // f(x)=… 交由其他路径
        const implicit = tryImplicit2D(parts[0], parts[1]);
        if (!implicit) return arg;
        implicit.label = implicit instanceof GeoLine
          ? construction.getNextLineLabel(existingLabels)
          : construction.getNextCircleLabel(existingLabels);
        construction.addElement(implicit);
        existingLabels.add(implicit.label!);
        return implicit.label!;
      });
      const dispatched = dispatchCommand(canonical!, args, {
        construction, kernel, existingLabels, viewBounds,
        evaluateNumber, resolveNumber, makeFreePoint, assignNextLabel,
        findPoint, findLine, findFunction, findNumeric, findConic, findPolygon, findCurve, findListArg,
        makeNumericDeps: makeNumericDependencies,
        makeFnDeps: makeFunctionDeps,
        resolveList: resolveListCtx,
        createStaticNumeric: (value: number) => staticNumeric(value, existingLabels, construction),
        findPoint3D, findLine3D, findPlane3D, findQuadric3D, findPolyhedron3D, findSurface, findCircle3D, findPolyline3D, findConic3D, findNet3D,
      });
      // 合并命令参数里内联创建、但未随命令输出返回的辅助点（见 createdElements 注释）
      for (const el of createdElements) {
        if (!dispatched.includes(el) && !construction.getElements().includes(el)) dispatched.push(el);
      }
      return dispatched;
    }
  }

  // ------------------------------------------------------------------
  // 裸表达式
  // ------------------------------------------------------------------

  const expression = parseExpression(raw);
  const variables = collectVariables(expression);
  const numericDependencies = makeNumericDependencies(expression, ['x', 'y']);
  if (variables.has('x')) {
    const algo = new AlgoDependentFunction(kernel, expression, 'x', raw, numericDependencies);
    algo.getOutput().label = construction.getNextFunctionLabel(existingLabels);
    return [algo, algo.getOutput()];
  }
  const bareFnDeps = makeFunctionDeps(expression);
  if (variables.size === 0 || numericDependencies.length > 0 || bareFnDeps.length > 0) {
    if (numericDependencies.length > 0 || bareFnDeps.length > 0) {
      const algo = new AlgoDependentNumeric(kernel, expression, numericDependencies, raw, bareFnDeps);
      algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
      return [algo, algo.getOutput()];
    }
    const numeric = new GeoNumeric(kernel, evaluate(expression, new Map()));
    numeric.label = construction.getNextNumericLabel(existingLabels);
    return [numeric];
  }
  throw new Error('Unknown variables in expression');
}

// ---------------------------------------------------------------------------
// 命令分发
// ---------------------------------------------------------------------------

interface CommandContext {
  construction: Construction;
  kernel: Kernel;
  existingLabels: Set<string>;
  /** 可视区（世界坐标）：Root/Extremum 的视区内搜索用。 */
  viewBounds?: AlgebraViewBounds;
  evaluateNumber: (text: string, allowed?: string[]) => number;
  resolveNumber: (text: string) => number;
  makeFreePoint: (x: number, y: number) => GeoPoint;
  assignNextLabel: <T extends { label: string }>(element: T, nextLabel: () => string) => void;
  findPoint: (label: string) => GeoPoint | undefined;
  findLine: (label: string) => GeoLine | undefined;
  findFunction: (label: string) => GeoFunction | undefined;
  findNumeric: (label: string) => GeoNumeric | undefined;
  findConic: (label: string) => GeoConic | undefined;
  findPolygon: (label: string) => GeoPolygon | undefined;
  findCurve: (label: string) => GeoCurve | undefined;
  findListArg: (label: string) => GeoList | undefined;
  /** 表达式的数值依赖收集（列表命令族 Sequence 用；闭包在 impl 内）。 */
  makeNumericDeps: (expression: ExpressionNode, allowedVariables?: string[]) => GeoNumeric[];
  /** 命令列表参数解析：按标签查构造，字面量物化为并入构造的列表。 */
  resolveList: (text: string) => GeoList | undefined;
  /** 表达式的用户函数依赖（传递闭包）。 */
  makeFnDeps: (ast: ExpressionNode, selfLabel?: string) => GeoFunction[];
  /** 静态数值输出（数论命令）：建自由 GeoNumeric 入构造并分配标签。 */
  createStaticNumeric: (value: number) => GeoNumeric;
  findPoint3D: (label: string) => GeoPoint3D | undefined;
  findLine3D: (label: string) => GeoLine3D | undefined;
  findPlane3D: (label: string) => GeoPlane3D | undefined;
  findQuadric3D: (label: string) => GeoQuadric3D | undefined;
  findPolyhedron3D: (label: string) => GeoPolyhedron3D | undefined;
  findSurface: (label: string) => GeoSurface | undefined;
  findCircle3D: (label: string) => GeoCircle3D | undefined;
  findPolyline3D: (label: string) => GeoPolyline3D | undefined;
  findConic3D: (label: string) => GeoConic3D | undefined;
  findNet3D: (label: string) => GeoNet3D | undefined;
}

/** 把命令参数解析成点：已有标签，或内联坐标元组 `(x, y)`。 */
const resolvePointArg = (ctx: CommandContext, text: string): GeoPoint => {
  const coordinate = /^\(([^,]+),([^,]+)\)$/.exec(text.trim());
  if (coordinate) {
    const x = ctx.evaluateNumber(coordinate[1]);
    const y = ctx.evaluateNumber(coordinate[2]);
    return ctx.makeFreePoint(x, y);
  }
  const point = ctx.findPoint(text.trim());
  if (!point) throw new Error(`Unknown point "${text.trim()}"`);
  return point;
};

/** 把命令参数解析成「可用于求交/求距的几何对象」。 */
const resolveObjectArg = (ctx: CommandContext, text: string): GeoElement => {
  const label = text.trim();
  const point = ctx.findPoint(label);
  if (point) return point;
  const line = ctx.findLine(label);
  if (line) return line;
  const fn = ctx.findFunction(label);
  if (fn) return fn;
  const found = ctx.construction.getElements().find(el => el instanceof GeoElement && (el as any).label === label);
  if (found) return found as GeoElement;
  throw new Error(`Unknown object "${label}"`);
};

/** 取函数在其驱动数字作用域下的求值闭包（`f(x) = a*x` 需要带上 `a`）。
 *  限域函数（AlgoFunctionRestricted）回溯到源函数的依赖——此前 scope 被清空，
 *  Root/Extremum/Integral 对 Function(f,a,b) 全线 NaN。 */
const functionEvaluator = (ctx: CommandContext, fn: GeoFunction): (x: number) => number => {
  const source = fn.parentAlgo;
  const dependencies: GeoNumeric[] = source && typeof (source as unknown as { getDependencies?: () => GeoNumeric[] }).getDependencies === 'function'
    ? (source as unknown as { getDependencies: () => GeoNumeric[] }).getDependencies()
    : [];
  return (x: number) => {
    const scope: Scope = new Map();
    dependencies.forEach((dependency, index) => scope.set(dependency.label || `dep${index}`, dependency.getValue()));
    fn.setScope(scope);
    return fn.evaluateAt(x);
  };
};

const searchRange = (a: number, b: number): [number, number] =>
  a < b ? [a, b] : [b, a];

/**
 * 求 f 在 [lo, hi] 内的全部实根。
 * 多项式优先走系数提取 + Durand-Kerner 全根（不会漏偶数重根附近的配对解），
 * 非多项式回退到采样+二分扫描。
 */
const allFunctionRoots = (
  fn: GeoFunction,
  evaluateAt: (x: number) => number,
  lo: number,
  hi: number,
): number[] => {
  const source = fn.parentAlgo;
  if (source instanceof AlgoDependentFunction) {
    const scope: Scope = new Map();
    source.getDependencies().forEach((dependency, index) =>
      scope.set(dependency.label || `dep${index}`, dependency.getValue()));
    const coeffs = extractPolynomialCoefficients(source.getExpression(), fn.variableName, scope);
    if (coeffs) {
      // keepDuplicates: 对标 GeoGebra Root[f]（skipDoubleRoots=false），保留重根
      return polynomialRealRoots(coeffs, { keepDuplicates: true }).filter(r => r >= lo && r <= hi);
    }
  }
  return findRoots(evaluateAt, lo, hi);
};

/** 找出表达式引用到的滑块依赖（允许列表如参数名除外）。 */
const curveDependencies = (
  ctx: CommandContext,
  expressions: ExpressionNode[],
  allowedVariables: string[],
): GeoNumeric[] => {
  const variables = new Set<string>();
  for (const expression of expressions) collectVariables(expression, variables);
  for (const allowed of allowedVariables) variables.delete(allowed);
  const deps: GeoNumeric[] = [];
  const seen = new Set<string>();
  for (const variable of variables) {
    const numeric = ctx.findNumeric(variable);
    if (numeric && !seen.has(numeric.label)) {
      deps.push(numeric);
      seen.add(numeric.label);
    }
  }
  return deps;
};

/** 给算法输出按类型分配标签（点/线/圆/多边形/向量/数值/函数），供变换与属性类命令使用。 */
const assignOutputLabels = (ctx: CommandContext, outputs: GeoElement[]): void => {
  const used = new Set<string>();
  for (const out of outputs) {
    if (out instanceof GeoPoint) {
      ctx.assignNextLabel(out, () => ctx.construction.getNextPointLabel(used));
    } else if (out instanceof GeoConic) {
      // GeoArc/GeoConicPart 也走这里：变换输出可能是圆或一般圆锥曲线
      ctx.assignNextLabel(out, () => ctx.construction.getNextCircleLabel(used));
    } else if (out instanceof GeoLine) {
      ctx.assignNextLabel(out, () => ctx.construction.getNextLineLabel(used));
    } else if (out instanceof GeoVector) {
      // 向量从专属字符表取名（u,v,w…），不再挤占线/函数的 f,g,h…
      ctx.assignNextLabel(out, () => ctx.construction.getNextVectorLabel(used));
    } else if (out instanceof GeoPolygon || out instanceof GeoBooleanRegion) {
      ctx.assignNextLabel(out, () => ctx.construction.getNextPolygonLabel(used));
    } else if (out instanceof GeoNumeric) {
      ctx.assignNextLabel(out, () => ctx.construction.getNextNumericLabel(used));
    } else if (out instanceof GeoFunction) {
      ctx.assignNextLabel(out, () => ctx.construction.getNextFunctionLabel(used));
    } else if (out instanceof GeoCurve) {
      ctx.assignNextLabel(out, () => ctx.construction.getNextLineLabel(used));
    }
    if (out.label) used.add(out.label);
  }
};


/** 给滑条分配画布位置：纵向堆叠避让已有滑条（官方新建滑条的自动摆放）。 */
function makeSliderDrawable(num: GeoNumeric, construction: import('../core/Construction').Construction): void {
  const existing = construction.getElements()
    .filter(el => el instanceof GeoNumeric && (el as GeoNumeric).sliderVisible).length;
  num.sliderVisible = true;
  num.sliderX = 70;
  num.sliderY = 170 + existing * 60;
}

const factorial = (n: number): number => {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
};

const binomial = (n: number, k: number): number => {
  let result = 1;
  for (let i = 0; i < k; i++) result = result * (n - i) / (i + 1);
  return result;
};

/** 把升幂系数数组还原成表达式 AST（跳过零系数）。 */
const polynomialToAst = (coeffs: number[], variable: string): ExpressionNode => {
  let node: ExpressionNode | null = null;
  for (let j = coeffs.length - 1; j >= 0; j--) {
    const c = coeffs[j];
    if (Math.abs(c) < 1e-12 && node !== null) continue;
    const term: ExpressionNode = j === 0
      ? { kind: 'number', value: c }
      : j === 1
        ? { kind: 'binary', op: '*', left: { kind: 'number', value: c }, right: { kind: 'variable', name: variable } }
        : {
            kind: 'binary', op: '*',
            left: { kind: 'number', value: c },
            right: { kind: 'binary', op: '^', left: { kind: 'variable', name: variable }, right: { kind: 'number', value: j } },
          };
    node = node === null ? term : { kind: 'binary', op: '+', left: node, right: term };
  }
  return node ?? { kind: 'number', value: 0 };
};

/** 路径约束点核心（PointOn / Point(path, number) 共用）：在载体上放置参数点，
   *  paramValue 指定初值参数（缺省按载体取扫窗/区间中点）。 */
const createPathPoint = (ctx: CommandContext, label: string, paramValue?: number): ConstructionElement[] => {
  const { construction, kernel, existingLabels, assignNextLabel } = ctx;
  {
    const line = ctx.findLine(label);
    const conic = ctx.findConic(label);
    const fn = ctx.findFunction(label);
    const curve = ctx.findCurve(label);
    const ray = construction.getElements().find(el => el instanceof GeoRay && (el as GeoRay).label === label) as GeoRay | undefined;
    // GeoArc extends GeoConic：arc 必须在 conic 分支前取（否则弧被当圆锥曲线处理，扫窗丢失）
    const arc = construction.getElements().find(el => el instanceof GeoArc && (el as GeoArc).label === label) as GeoArc | undefined;
    // GeoConicPart（半圆/三点弧/扇形）同理：必须先于 conic 分支，且参数夹到角窗
    const conicPart = construction.getElements().find(el => el instanceof GeoConicPart && (el as GeoConicPart).label === label) as GeoConicPart | undefined;
    const line3 = ctx.findLine3D(label);
    const circle3 = ctx.findCircle3D(label);
    const conic3 = ctx.findConic3D(label);
    const poly3 = ctx.findPolyline3D(label);
    if (!line && !conic && !fn && !curve && !ray && !arc && !conicPart && !line3 && !circle3 && !conic3 && !poly3) {
      throw new Error(`Unknown path "${label}"`);
    }
    const param = new GeoNumeric(kernel, 0);
    param.label = construction.getNextNumericLabel(existingLabels);
    existingLabels.add(param.label);
    let algo: AlgoElement;
    if (curve) {
      param.setValue(paramValue ?? (curve.getMinParameter() + curve.getMaxParameter()) / 2);
      algo = new AlgoPointOnCurve(kernel, curve, param);
    } else if (fn) {
      param.setValue(paramValue ?? 0);
      algo = new AlgoPointOnFunction(kernel, fn, param);
    } else if (arc || conicPart) {
      // 弧类载体：参数 = 极角，初值默认取扫窗中点（沿扫向）。
      // 此前 (start+end)/2 在跨 ±π 的弧上会落到窗外，点画在弧外。
      const carrier = arc ?? conicPart!;
      const start = carrier.getStartAngle();
      const ccw = carrier.isCounterClockwise();
      const sweep = arcSweep(start, carrier.getEndAngle(), ccw);
      param.setValue(paramValue ?? start + (ccw ? -sweep / 2 : sweep / 2));
      algo = new AlgoPointOnArc(kernel, carrier, param);
    } else if (conic) {
      param.setValue(paramValue ?? 0);
      algo = new AlgoPointOnConic(kernel, conic, param);
    } else if (line3) {
      param.setValue(paramValue ?? 0.5);
      algo = new AlgoPointOnLine3D(kernel, line3, param);
    } else if (circle3) {
      param.setValue(paramValue ?? 0);
      algo = new AlgoPointOnCircle3D(kernel, circle3, param);
    } else if (conic3) {
      param.setValue(paramValue ?? 0);
      algo = new AlgoPointOnConic3D(kernel, conic3, param);
    } else if (poly3) {
      param.setValue(paramValue ?? 0);
      algo = new AlgoPointOnPolyline3D(kernel, poly3, param);
    } else if (ray) {
      param.setValue(paramValue ?? 1);
      algo = new AlgoPointOnRay(kernel, ray, param);
    } else if (line instanceof GeoSegment) {
      // findLine 按 GeoLine 匹配，线段会落进这里——必须用段参数 [0,1] 的专用算法
      param.setValue(paramValue ?? 0.5);
      algo = new AlgoPointOnSegment(kernel, line, param);
    } else {
      param.setValue(paramValue ?? 0);
      algo = new AlgoPointOnLine(kernel, line!, param);
    }
    assignNextLabel(algo.getGeoElements()[0], () => construction.getNextPointLabel(existingLabels));
    // 点在前、param 在后：`P = PointOn(s)` 的 LHS 标签按"第一个非算法 Geo 元素"
    // 分配，param 在前会把标签抢走（点反而拿自动标签）
    return [...algo.getGeoElements(), param, algo];
  }
};

/** 同名命令 → 3D 兄弟命令（参数含 3D 对象时自动路由，官方 2D/3D 重载语义）。 */
const SHARED_3D_FALLBACK: Record<string, string> = {
  Line: 'Line3D',
  Segment: 'Segment3D',
  Midpoint: 'Midpoint3D',
  Circle: 'Circle3D',
  Distance: 'Distance3D',
  Angle: 'Angle3D',
};

const dispatchCommand = (
  rawName: string,
  args: string[],
  ctx: CommandContext,
): ConstructionElement[] => {
  // 同名命令 2D/3D 重载（官方按参数类型自动分发）：任一参数引用 3D 对象时
  // 路由到 3D 兄弟命令。此前 Line(A,B)/Circle(A,B,C)（3D 点）只会走 2D
  // 分支报错，官方 .ggb/教程语句不兼容。
  const sibling3D = SHARED_3D_FALLBACK[rawName];
  const name = sibling3D && anyArg3D(ctx, args) ? sibling3D : rawName;

  const { construction, kernel, existingLabels, assignNextLabel, viewBounds } = ctx;

  switch (name) {
    // ---- 点 ----
    case 'Point': {
      // Point(path, number)：路径上参数位置的点（官方 CmdPoint 形式，此前缺失报
      // "Invalid coordinate"）——args[0] 不是数值表达式时按路径标签解析
      if (args.length === 2) {
        const asNumber = Number(args[0].trim());
        if (!Number.isFinite(asNumber) || args[0].trim() === '') {
          try {
            return createPathPoint(ctx, args[0].trim(), ctx.resolveNumber(args[1]));
          } catch { /* 落回统一坐标错误 */ }
        }
      }
      try {
        const px = ctx.evaluateNumber(args[0]);
        const py = ctx.evaluateNumber(args[1]);
        return [ctx.makeFreePoint(px, py)];
      } catch {
        // 统一给面向用户的坐标错误，而不是泄露内部解析细节
        throw new Error('Invalid coordinate');
      }
    }

    case 'Midpoint': {
      // Midpoint(segment) 线段中点；Midpoint(circle) 圆心（官方 CmdMidpoint 单参形式）
      if (args.length === 1) {
        const label = args[0].trim();
        const seg = construction.getElements().find(
          el => el instanceof GeoSegment && (el as GeoSegment).label === label) as GeoSegment | undefined;
        if (seg) {
          const algo = new AlgoMidpoint(kernel, seg.startPoint, seg.endPoint);
          assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
          return [algo, algo.getOutput()];
        }
        const conic = ctx.findConic(label);
        if (conic) {
          if (conic.getConicType() !== 'circle') {
            throw new Error(`Midpoint of a ${conic.getConicType()} is not supported yet (circle only)`);
          }
          const algo = new AlgoCircleCenter(kernel, conic);
          assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
          return [algo, algo.getOutput()];
        }
        throw new Error(`Midpoint expects two points, a segment or a circle; "${label}" is none of them`);
      }
      const algo = new AlgoMidpoint(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]));
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Intersection':
    case 'Intersect': {
      // ---- 3D 组合矩阵（官方 CmdIntersect3D.java:83-345 的同名重载）----
      // 线×面→点、面×面→线、线×线→点、面×二次曲面→解析截面、线×二次曲面→点、
      // 球×球→圆。此前 Intersect 无任何 3D 分支（只有自造名 IntersectLinePlane 等）。
      const objA3D = resolve3DObject(ctx, args[0].trim());
      const objB3D = resolve3DObject(ctx, args[1].trim());
      if (objA3D && objB3D) {
        const [tA, a3] = objA3D;
        const [tB, b3] = objB3D;
        // 按类型序取（参数顺序无关）：返回 null 表示不是该类型对
        const ordered = (typeFirst: string, typeSecond: string): [unknown, unknown] | null => {
          if (tA === typeFirst && tB === typeSecond) return [a3, b3];
          if (tA === typeSecond && tB === typeFirst) return [b3, a3];
          return null;
        };
        // 线 × 面 → 交点
        const linePlane = ordered('line3D', 'plane3D');
        if (linePlane) {
          const line = linePlane[0] instanceof GeoLine3D ? linePlane[0] : linePlane[1] as GeoLine3D;
          const plane = linePlane[0] instanceof GeoPlane3D ? linePlane[0] : linePlane[1] as GeoPlane3D;
          const algo = new AlgoIntersectLinePlane3D(kernel, line, plane);
          assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
          return [algo, algo.getOutput()];
        }
        // 面 × 面 → 交线
        const planePlane = ordered('plane3D', 'plane3D');
        if (planePlane) {
          const algo = new AlgoIntersectPlanes3D(kernel, planePlane[0] as GeoPlane3D, planePlane[1] as GeoPlane3D);
          assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
          return [algo, algo.getOutput()];
        }
        // 线 × 线 → 交点（异面 undefined）
        const lineLine = ordered('line3D', 'line3D');
        if (lineLine) {
          const algo = new AlgoIntersectLines3D(kernel, lineLine[0] as GeoLine3D, lineLine[1] as GeoLine3D);
          assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
          return [algo, algo.getOutput()];
        }
        // 线 × 二次曲面 → 交点（1–2 个）
        const lineQuadric = ordered('line3D', 'quadric3D');
        if (lineQuadric) {
          const line = lineQuadric[0] instanceof GeoLine3D ? lineQuadric[0] : lineQuadric[1] as GeoLine3D;
          const quadric = lineQuadric[0] instanceof GeoQuadric3D ? lineQuadric[0] : lineQuadric[1] as GeoQuadric3D;
          // Intersect(l, q, n)：官方 CmdIntersect3D 的单点变体（此前第三参被静默忽略）
          if (args.length === 3) {
            const idx = Math.round(ctx.resolveNumber(args[2]));
            if (!Number.isInteger(idx) || idx < 1) throw new Error('Intersect index must be a positive integer');
            const probe = new AlgoIntersectLineQuadric3D(kernel, line, quadric);
            probe.update();
            const pts = probe.getGeoElements().filter(el => el instanceof GeoPoint3D) as GeoPoint3D[];
            const chosen = pts[idx - 1];
            if (!chosen || !chosen.isDefined()) throw new Error(`No intersection #${idx}`);
            const out = new GeoPoint3D(kernel, chosen.getCoords3());
            assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
            construction.addElement(out);
            return [out];
          }
          const algo = new AlgoIntersectLineQuadric3D(kernel, line, quadric);
          assignOutputLabels(ctx, algo.getGeoElements());
          return [algo, ...algo.getGeoElements()];
        }
        // 球 × 球 → 交圆
        const sphereSphere = ordered('quadric3D', 'quadric3D');
        if (sphereSphere
          && (sphereSphere[0] as GeoQuadric3D).getKind() === 'sphere'
          && (sphereSphere[1] as GeoQuadric3D).getKind() === 'sphere') {
          const algo = new AlgoIntersectSpheres3D(kernel, sphereSphere[0] as GeoQuadric3D, sphereSphere[1] as GeoQuadric3D);
          assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
          return [algo, algo.getOutput()];
        }
        // 面 × 二次曲面 → 解析截面（复用 IntersectPath 的回退链）
        const planeQuadric = ordered('plane3D', 'quadric3D');
        if (planeQuadric) {
          const plane = planeQuadric[0] instanceof GeoPlane3D ? planeQuadric[0] : planeQuadric[1] as GeoPlane3D;
          const quadric = planeQuadric[0] instanceof GeoQuadric3D ? planeQuadric[0] : planeQuadric[1] as GeoQuadric3D;
          const analytic = new AlgoIntersectConicPlaneQuadric(kernel, plane, quadric);
          analytic.update();
          if (analytic.getOutput().isDefined()) {
            assignNextLabel(analytic.getOutput(), () => construction.getNextLineLabel(existingLabels));
            return [analytic, analytic.getOutput()];
          }
          const fallback = new AlgoIntersectPlaneQuadric(kernel, plane, quadric);
          assignNextLabel(fallback.getGeoElements()[0], () => construction.getNextLineLabel(existingLabels));
          return [fallback, ...fallback.getGeoElements()];
        }
        // 其余 3D 组合（如面×圆锥曲线）暂不覆盖 → 落回下方 2D 分支按原语义报错
      }
      // 多边形 × 多边形 → 布尔交（GeoGebra AlgoPolygonOperation.INTERSECTION）
      const polyA = ctx.findPolygon(args[0].trim());
      const polyB = ctx.findPolygon(args[1].trim());
      if (polyA && polyB) {
        const algo = new AlgoPolygonBoolean(kernel, polyA, polyB, 'intersection');
        assignOutputLabels(ctx, [algo.getOutput()]);
        return [algo, algo.getOutput()];
      }
      // Intersect(a, b, index)：只输出第 index 个交点（官方 CmdIntersect 3 参形式，
      // 须在函数×函数分支之前判定）
      if (args.length === 3) {
        const index = Math.round(ctx.resolveNumber(args[2]));
        if (!Number.isInteger(index) || index < 1) throw new Error('Intersect index must be a positive integer');
        // 函数×函数走单交点算法（AlgoIntersect 不支持函数输入——此前该形式
        // 对函数恒抛 "No intersection"，与"对函数均适用"的声明不符）
        const fnA3 = ctx.findFunction(args[0].trim());
        const fnB3 = ctx.findFunction(args[1].trim());
        if (fnA3 && fnB3) {
          const lo3 = viewBounds?.minX ?? -DEFAULT_SEARCH_RANGE;
          const hi3 = viewBounds?.maxX ?? DEFAULT_SEARCH_RANGE;
          const probeXs3 = findRoots((x: number) => fnA3.evaluateAt(x) - fnB3.evaluateAt(x), lo3, hi3);
          if (index > probeXs3.length) {
            throw new Error(`No intersection #${index}: the given objects have fewer intersection points`);
          }
          const pointAlgo = new AlgoIntersectFunctionsPoint(kernel, fnA3, fnB3, lo3, hi3);
          pointAlgo.seedLastX(probeXs3[index - 1]);
          assignNextLabel(pointAlgo.getOutput(), () => construction.getNextPointLabel(existingLabels));
          return [pointAlgo, pointAlgo.getOutput()];
        }
        const algo = new AlgoIntersect(kernel, resolveObjectArg(ctx, args[0]), resolveObjectArg(ctx, args[1]), index);
        algo.compute();
        const points = algo.getOutputPoints().filter(point => point.isDefined());
        if (points.length === 0) throw new Error(`No intersection #${index}: the given objects have fewer intersection points`);
        return [algo, ...points];
      }
      // Intersect(f, g, a, b)：区间搜索形（官方 CmdIntersect 4 参）——只在 [a,b] 内求交
      if (args.length === 4) {
        const fnA = ctx.findFunction(args[0].trim());
        const fnB = ctx.findFunction(args[1].trim());
        if (!fnA || !fnB) throw new Error('Intersect(f, g, a, b) expects two functions');
        const aRaw = ctx.resolveNumber(args[2]);
        const bRaw = ctx.resolveNumber(args[3]);
        if (!Number.isFinite(aRaw) || !Number.isFinite(bRaw)) throw new Error('Intersect interval bounds must be finite numbers');
        const lo = Math.min(aRaw, bRaw), hi = Math.max(aRaw, bRaw);
        const probeXs = findRoots((x: number) => fnA.evaluateAt(x) - fnB.evaluateAt(x), lo, hi);
        const algo = new AlgoIntersectFunctions(kernel, fnA, fnB, lo, hi, INTERSECT_FUNCTIONS_CAPACITY, probeXs);
        const elements: ConstructionElement[] = [algo, algo.getOutput()];
        const brothers = algo.getBrothers();
        const pts = algo.getPoints();
        for (let i = 0; i < Math.min(probeXs.length, pts.length); i++) {
          pts[i].label = construction.getNextPointLabel(existingLabels);
          existingLabels.add(pts[i].label);
          elements.push(brothers[i], pts[i]);
        }
        return elements;
      }
      // 函数 × 函数 → 交点列表（对标 CmdIntersect 函数分支，槽位跟随 f/g 联动）。
      // 登记模式与 Root(f) 相同：探测交点 → 首轮播种 → 仅占用的兄弟算法+槽点入构造
      const fnA = ctx.findFunction(args[0].trim());
      const fnB = ctx.findFunction(args[1].trim());
      if (fnA && fnB) {
        const lo = viewBounds?.minX ?? -DEFAULT_SEARCH_RANGE;
        const hi = viewBounds?.maxX ?? DEFAULT_SEARCH_RANGE;
        const probeXs = findRoots((x: number) => fnA.evaluateAt(x) - fnB.evaluateAt(x), lo, hi);
        const algo = new AlgoIntersectFunctions(kernel, fnA, fnB, lo, hi, INTERSECT_FUNCTIONS_CAPACITY, probeXs);
        // 容器算法与列表在前：`I = Intersect(f, g)` 的 LHS 标签按"第一个非算法
        // Geo 元素"分配，必须落在列表上；容器先于兄弟入构造也是安全的——
        // 容器 compute 自行全局求根并播种兄弟，兄弟随后窗口跟随得到相同根
        const elements: ConstructionElement[] = [algo, algo.getOutput()];
        const brothers = algo.getBrothers();
        const pts = algo.getPoints();
        for (let i = 0; i < Math.min(probeXs.length, pts.length); i++) {
          pts[i].label = construction.getNextPointLabel(existingLabels);
          existingLabels.add(pts[i].label);
          elements.push(brothers[i], pts[i]);
        }
        return elements;
      }
      const algo = new AlgoIntersect(kernel, resolveObjectArg(ctx, args[0]), resolveObjectArg(ctx, args[1]));
      algo.compute();
      const points = algo.getOutputPoints().filter(point => point.isDefined());
      if (points.length === 0) {
        const o1 = resolveObjectArg(ctx, args[0]);
        const o2 = resolveObjectArg(ctx, args[1]);
        // 平行线允许创建暂未定义的交点（官方 AlgoIntersectLines 语义：
        // 拖动后相交即出现）；其余无交组合保持干净报错
        const bothLines = o1 instanceof GeoLine && o2 instanceof GeoLine;
        if (!bothLines) throw new Error('The given objects do not intersect');
      }
      return [algo, ...algo.getOutputPoints()];
    }

    case 'Union': {
      // 多边形并集（列表 Union 见 GeoGebra AlgoUnion，此处先做多边形）
      const a = ctx.findPolygon(args[0].trim());
      const b = ctx.findPolygon(args[1].trim());
      if (!a || !b) throw new Error(`Union expects two polygons`);
      const algo = new AlgoPolygonBoolean(kernel, a, b, 'union');
      assignOutputLabels(ctx, [algo.getOutput()]);
      return [algo, algo.getOutput()];
    }

    case 'Difference': {
      const a = ctx.findPolygon(args[0].trim());
      const b = ctx.findPolygon(args[1].trim());
      if (!a || !b) throw new Error(`Difference expects two polygons`);
      const algo = new AlgoPolygonBoolean(kernel, a, b, 'difference');
      assignOutputLabels(ctx, [algo.getOutput()]);
      return [algo, algo.getOutput()];
    }

    case 'PointOnLine': {
      const line = ctx.findLine(args[1].trim());
      if (!line) throw new Error(`Unknown line "${args[1].trim()}"`);
      const anchor = resolvePointArg(ctx, args[0]);
      const param = new GeoNumeric(kernel, 0);
      param.label = construction.getNextNumericLabel(existingLabels);
      existingLabels.add(param.label);
      const algo = new AlgoPointOnLine(kernel, line, param);
      algo.updateParameter(anchor.getX(), anchor.getY());
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [param, algo, algo.getOutput()];
    }

    // ---- 直线族 ----
    case 'Line': {
      const algo = new AlgoLineTwoPoints(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Segment': {
      // Segment(A, length)：定长线段（官方 CmdSegment 数值形式）——
      // 从 A 沿 x 正方向取端点 B，B 为自由点可拖。args[1] 不是正数值时落两点形式
      if (args.length === 2) {
        let len: number | null = null;
        try {
          const v = ctx.resolveNumber(args[1]);
          if (Number.isFinite(v) && v > 0) len = v;
        } catch { /* args[1] 是点标签等非数值 → 两点形式 */ }
        if (len !== null) {
          const startPt = resolvePointArg(ctx, args[0]);
          const endPt = ctx.makeFreePoint(startPt.getX() + len, startPt.getY());
          const algo = new AlgoSegmentTwoPoints(kernel, startPt, endPt);
          assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
          // endPt 已随 createdElements 自动登记，不随输出返回（避免抢 LHS 标签）
          return [algo, algo.getOutput()];
        }
      }
      const algo = new AlgoSegmentTwoPoints(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Polyline': {
      // Polyline(P1, ..., Pn) 折线（官方 CmdPolyLine；算法/工具早已存在，仅缺命令注册）
      const points = args.map(a => resolvePointArg(ctx, a));
      const algo = new AlgoPolyLine(kernel, points);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Ray': {
      const algo = new AlgoRayTwoPoints(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    // ---- 圆 ----
    case 'Circle': {
      if (args.length === 3) {
        const algo = new AlgoCircleThreePoints(
          kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]));
        assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      // 第二个参数按 GeoGebra 的优先级尝试：已有圆上的点 → 内联坐标元组 → 数值半径
      const center = resolvePointArg(ctx, args[0]);
      const onCircle = ctx.findPoint(args[1].trim()) ?? (() => {
        const coordinate = /^\(([^,]+),([^,]+)\)$/.exec(args[1].trim());
        return coordinate ? ctx.makeFreePoint(ctx.evaluateNumber(coordinate[1]), ctx.evaluateNumber(coordinate[2])) : undefined;
      })();
      if (onCircle) {
        const algo = new AlgoCircleCenterPoint(kernel, center, onCircle);
        assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      // 数值半径：已有滑块时按活依赖传入（拖滑块联动），字面量才走静态快照
      const radiusNumeric = ctx.findNumeric(args[1].trim());
      if (radiusNumeric) {
        const algo = new AlgoCirclePointRadius(kernel, center, radiusNumeric);
        assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      let radius: number;
      try {
        radius = ctx.resolveNumber(args[1]);
      } catch {
        // 既不是已有圆上的点，也不是数值半径 —— 按 GeoGebra 的语义提示期望的点
        throw new Error(`Unknown point "${args[1].trim()}"`);
      }
      if (radius <= 0) throw new Error('Circle radius must be positive');
      const algo = new AlgoCirclePointRadius(kernel, center, radius);
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    // ---- 向量 ----
    case 'Vector': {
      // Vector(P)：位置向量（官方 CmdVector 1 参形式）——原点为辅助起点、P 为活终点
      if (args.length === 1) {
        const p = ctx.findPoint(args[0].trim());
        if (!p) throw new Error(`Unknown point "${args[0].trim()}"`);
        const origin = ctx.makeFreePoint(0, 0);
        origin.visible = false;
        const algo = new AlgoVector(kernel, origin, p);
        assignNextLabel(algo.getOutput(), () => construction.getNextVectorLabel(existingLabels));
        // origin 已随 createdElements 自动登记（mergeCreatedElements 去重），
        // 不随输出返回——否则它会作为"第一个非算法元素"抢走 LHS 标签
        return [algo, algo.getOutput()];
      }
      // 两个点标签 → 两点向量；否则按分量构造（从原点出发）
      const start = ctx.findPoint(args[0].trim());
      const end = ctx.findPoint(args[1].trim());
      if (start && end) {
        const algo = new AlgoVector(kernel, start, end);
        assignNextLabel(algo.getOutput(), () => construction.getNextVectorLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      const ux = ctx.evaluateNumber(args[0]);
      const vy = ctx.evaluateNumber(args[1]);
      const vector = new GeoVector(kernel, 0, 0, ux, vy);
      assignNextLabel(vector, () => construction.getNextVectorLabel(existingLabels));
      return [vector];
    }

    // ---- 特殊线（命令面补齐：此前仅工具栏可达）----
    case 'ParallelLine': {
      const point = resolvePointArg(ctx, args[0]);
      const line = ctx.findLine(args[1].trim());
      if (!line) throw new Error(`Unknown line "${args[1].trim()}"`);
      const algo = new AlgoParallelLine(kernel, point, line);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'OrthogonalLine':
    case 'PerpendicularLine': {
      const point = resolvePointArg(ctx, args[0]);
      const line = ctx.findLine(args[1].trim());
      if (!line) throw new Error(`Unknown line "${args[1].trim()}"`);
      const algo = new AlgoOrthogonalLine(kernel, point, line);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'PerpendicularBisector':
    case 'LineBisector': {
      // LineBisector(segment)：线段的垂直平分线（官方 CmdLineBisector 1 参形式）
      if (args.length === 1) {
        const label = args[0].trim();
        const seg = construction.getElements().find(
          el => el instanceof GeoSegment && (el as GeoSegment).label === label) as GeoSegment | undefined;
        if (!seg) throw new Error(`LineBisector expects a segment or two points; "${label}" is not a segment`);
        const algo = new AlgoPerpendicularBisector(kernel, seg.startPoint, seg.endPoint);
        assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      const algo = new AlgoPerpendicularBisector(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'AngleBisector':
    case 'AngularBisector': {
      // 两线形（官方 CmdAngularBisector：两条互相垂直的平分线）
      if (args.length === 2) {
        const l1 = ctx.findLine(args[0].trim());
        const l2 = ctx.findLine(args[1].trim());
        if (!l1 || !l2) throw new Error(`AngularBisector expects two lines or three points`);
        const algo2 = new AlgoAngleBisectorLines(kernel, l1, l2);
        algo2.getOutputLines().forEach(l => construction.getNextLineLabel(existingLabels));
        assignOutputLabels(ctx, algo2.getGeoElements());
        return [algo2, ...algo2.getGeoElements()];
      }
      // 三点角平分线（顶点为第二点）
      const algo = new AlgoAngleBisector(
        kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    // ---- 圆锥曲线（命令面补齐）----
    case 'Ellipse':
    case 'Hyperbola': {
      // 第三参：点形式 Ellipse(F1,F2,P)，或数值半长轴形式 Ellipse(F1,F2,a)
      //（官方 CmdEllipseHyperbola 的 GeoNumberValue 分支，此前数值被当点解析报错）
      const f1 = resolvePointArg(ctx, args[0]);
      const f2 = resolvePointArg(ctx, args[1]);
      const thirdNumeric = ctx.findNumeric(args[2].trim());
      const third: GeoPoint | GeoNumeric | number = thirdNumeric
        ? thirdNumeric
        : (() => { const n = Number(args[2]); return Number.isFinite(n) ? n : resolvePointArg(ctx, args[2]); })();
      const algo = name === 'Ellipse'
        ? new AlgoEllipse(kernel, f1, f2, third)
        : new AlgoHyperbola(kernel, f1, f2, third);
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Parabola': {
      const focus = resolvePointArg(ctx, args[0]);
      const directrix = ctx.findLine(args[1].trim());
      if (!directrix) throw new Error(`Unknown line "${args[1].trim()}"`);
      const algo = new AlgoParabola(kernel, focus, directrix);
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Conic': {
      const points = args.map(a => resolvePointArg(ctx, a));
      const algo = new AlgoConicFivePoints(kernel, points);
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    // ---- 圆 / 弧 / 扇形（命令面补齐）----
    case 'Semicircle': {
      const algo = new AlgoSemicircle(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]));
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Arc': {
      // Arc(C, A, B)：C 为圆（派生其圆心点，保持活依赖）或圆心点；A/B 为起止弧点。
      // 非圆圆锥上的弧需要 GeoConicPart（官方 CmdArcSector 支持）——此前椭圆/双曲线
      // 被静默降级成"|心到A| 为半径的圆弧"，看似成功实则错几何，先干净报错。
      const circleArg = ctx.findConic(args[0].trim());
      if (circleArg) {
        if (circleArg.getConicType() !== 'circle') {
          throw new Error(`Arc on a ${circleArg.getConicType()} is not supported yet (circle only)`);
        }
        const centerAlgo = new AlgoCircleCenter(kernel, circleArg);
        assignNextLabel(centerAlgo.getOutput(), () => construction.getNextPointLabel(existingLabels));
        const algo = new AlgoArc(kernel, centerAlgo.getOutput(), resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]));
        assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
        return [centerAlgo, centerAlgo.getOutput(), algo, algo.getOutput()];
      }
      const center = resolvePointArg(ctx, args[0]);
      const algo = new AlgoArc(kernel, center, resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]));
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'CircularSector': {
      const algo = new AlgoCircularSector(
        kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]));
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'CircumcircularArc': {
      const algo = new AlgoCircumcircularArc(
        kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]));
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'CircumcircularSector': {
      const algo = new AlgoCircumcircularSector(
        kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]));
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Compass': {
      // Compass(A, B)：圆心 A、半径 |AB|（官方语义）；Compass(A, seg)：半径取线段长
      const center = resolvePointArg(ctx, args[0]);
      const segment = ctx.construction.getElements().find(
        el => el instanceof GeoSegment && (el as GeoSegment).label === args[1].trim()) as GeoSegment | undefined;
      const radiusFrom = segment
        ? [segment.startPoint, segment.endPoint]
        : [center, resolvePointArg(ctx, args[1])];
      const algo = new AlgoCompass(kernel, radiusFrom[0], radiusFrom[1], center);
      assignNextLabel(algo.getOutput(), () => construction.getNextCircleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'RegularPolygon': {
      // RegularPolygon(A, B, n)：以 AB 为第一条边的正 n 边形。
      // 新顶点是算法输出的一部分，必须全部随返回值登记进构造，
      // 否则序列化的 vertices 引用不存在的元素，重载后整个多边形静默丢失
      const nSides = Math.round(ctx.resolveNumber(args[2]));
      if (nSides < 3) throw new Error('RegularPolygon needs at least 3 sides');
      const algo = new AlgoRegularPolygonEdge(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]), nSides);
      const outputs = algo.getGeoElements();
      outputs.forEach((out, i) => {
        assignNextLabel(out, i === 0
          ? () => construction.getNextPolygonLabel(existingLabels)
          : () => construction.getNextPointLabel(existingLabels));
      });
      return [algo, ...outputs];
    }

    case 'Invert': {
      const obj = resolveObjectArg(ctx, args[0]);
      const circle = ctx.findConic(args[1].trim());
      if (!circle) throw new Error(`Unknown circle "${args[1].trim()}"`);
      const algo = new AlgoInvert(kernel, obj, circle);
      assignOutputLabels(ctx, [algo.getOutput()]);
      return [algo, algo.getOutput()];
    }

    // ---- 测量（命令面补齐）----
    case 'Area': {
      const target = resolveObjectArg(ctx, args[0]);
      if (!(target instanceof GeoPolygon) && !(target instanceof GeoConic)) {
        throw new Error('Area expects a polygon or circle');
      }
      const algo = new AlgoArea(kernel, target);
      algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
      existingLabels.add(algo.getOutput().label);
      return [algo, algo.getOutput()];
    }

    case 'Length': {
      // Length(segment) 线段长；Length(polygon) 周长；Length(P) 点到原点距离；
      // Length(arc/conic) 弧长/周长（官方 CmdLength conic part → AlgoArcLength）；
      // Length(vector) 向量长度
      const label = args[0].trim();
      const polygon = ctx.findPolygon(label);
      if (polygon) {
        const algo = new AlgoPerimeter(kernel, polygon);
        algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
        existingLabels.add(algo.getOutput().label);
        return [algo, algo.getOutput()];
      }
      // GeoArc/GeoConicPart/圆锥：弧长与周长（AlgoConicPerimeter 内部分型）
      const conic = ctx.findConic(label);
      if (conic) {
        const algo = new AlgoConicPerimeter(kernel, conic, true);
        algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
        existingLabels.add(algo.getOutput().label);
        return [algo, algo.getOutput()];
      }
      const vector = construction.getElements().find(
        el => el instanceof GeoVector && (el as GeoVector).label === label) as GeoVector | undefined;
      if (vector) {
        const len = Math.hypot(vector.endX - vector.startX, vector.endY - vector.startY);
        const value = new GeoNumeric(kernel, len);
        value.label = construction.getNextNumericLabel(existingLabels);
        existingLabels.add(value.label);
        return [value];
      }
      const segment = ctx.construction.getElements().find(
        el => el instanceof GeoSegment && (el as GeoSegment).label === label) as GeoSegment | undefined;
      if (segment) {
        const algo = new AlgoDistance(kernel, segment.startPoint, segment.endPoint);
        algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
        existingLabels.add(algo.getOutput().label);
        return [algo, algo.getOutput()];
      }
      const pointA = ctx.findPoint(label);
      if (pointA) {
        // Length(P)：点到原点距离（官方 Length(Point) 语义）。
        // 原点是辅助点：随 createdElements 自动登记（可序列化），但不显示在画布上。
        const origin = ctx.makeFreePoint(0, 0);
        origin.label = '';
        origin.visible = false;
        const algo = new AlgoDistance(kernel, origin, pointA);
        algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
        existingLabels.add(algo.getOutput().label);
        return [algo, algo.getOutput()];
      }
      throw new Error(`Length expects a segment, arc, conic, vector, polygon or point; "${label}" is none of them`);
    }

    case 'Perimeter': {
      // Perimeter(polygon) 多边形周长；Perimeter(conic) 圆锥曲线周长
      //（圆 2πr、椭圆 Ramanujan、扇形弧长+2r，对标 CmdPerimeter conic 分支）
      const polygon = ctx.findPolygon(args[0].trim());
      if (polygon) {
        const algo = new AlgoPerimeter(kernel, polygon);
        algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
        existingLabels.add(algo.getOutput().label);
        return [algo, algo.getOutput()];
      }
      const conic = ctx.findConic(args[0].trim());
      if (conic) {
        const algo = new AlgoConicPerimeter(kernel, conic, false);
        algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
        existingLabels.add(algo.getOutput().label);
        return [algo, algo.getOutput()];
      }
      throw new Error(`Unknown polygon or conic "${args[0].trim()}"`);
    }

    case 'Circumference': {
      // Circumference(conic)：圆周长/椭圆周长（官方 CmdCircumference，此前缺失需手写 2π·r）
      const conic = ctx.findConic(args[0].trim());
      if (!conic) throw new Error(`Unknown conic "${args[0].trim()}"`);
      const type = conic.getConicType();
      if (type !== 'circle' && type !== 'ellipse') {
        throw new Error(`Circumference is only defined for circles and ellipses, not ${type}`);
      }
      const algo = new AlgoConicPerimeter(kernel, conic, false);
      algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
      existingLabels.add(algo.getOutput().label);
      return [algo, algo.getOutput()];
    }

    // ---- 测量 ----
    case 'Distance': {
      const algo = new AlgoDistance(kernel, resolveObjectArg(ctx, args[0]), resolveObjectArg(ctx, args[1]));
      // AlgoDistance 硬编码用 getNextLineLabel 命名（l1…），对长度量来说是错的标签，
      // 这里改成数字序列
      algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
      return [algo, algo.getOutput()];
    }

    case 'Slope': {
      // Slope(function)：f 在 x=0 处的斜率 f'(0)（官方 CmdSlope 函数形式）。
      // 活算法（f 表达式替换后重新微分跟随），此前是自由数值快照。
      const fn = ctx.findFunction(args[0].trim());
      if (fn) {
        const algo = new AlgoSlopeFunction(kernel, fn);
        assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      const line = ctx.findLine(args[0].trim());
      if (!line) throw new Error(`Unknown line or function "${args[0].trim()}"`);
      const algo = new AlgoSlope(kernel, line);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    // ---- 变换（活引用：中心/镜轴/角度/比例注册为输入，移动时联动重算）----
    case 'Rotate': {
      const obj = resolveObjectArg(ctx, args[0]);
      const center = args.length >= 3 ? ctx.findPoint(args[2].trim()) : undefined;
      if (args.length >= 3 && !center) throw new Error(`Unknown point "${args[2].trim()}"`);
      // 活角度：已有滑块按"度"实时驱动（与静态分支的度→弧度换算一致）
      const angleNumeric = ctx.findNumeric(args[1].trim());
      const angleRad = (angleNumeric ? angleNumeric.getValue() : ctx.resolveNumber(args[1])) * Math.PI / 180;
      const algo = new AlgoRotate(kernel, obj, center ?? { x: 0, y: 0 }, angleRad, angleNumeric ?? undefined);
      assignOutputLabels(ctx, [algo.getOutput()]);
      return [algo, algo.getOutput()];
    }

    case 'Dilate': {
      const obj = resolveObjectArg(ctx, args[0]);
      const center = args.length >= 3 ? ctx.findPoint(args[2].trim()) : undefined;
      if (args.length >= 3 && !center) throw new Error(`Unknown point "${args[2].trim()}"`);
      const ratioNumeric = ctx.findNumeric(args[1].trim());
      const ratio = ratioNumeric ? ratioNumeric.getValue() : ctx.resolveNumber(args[1]);
      const algo = new AlgoDilate(kernel, obj, center ?? { x: 0, y: 0 }, ratioNumeric ?? ratio);
      assignOutputLabels(ctx, [algo.getOutput()]);
      return [algo, algo.getOutput()];
    }

    case 'Mirror':
    case 'Reflect': {
      // 官方 Mirror 支持三种镜像对象：镜线、镜点（点对称 = Dilate(obj, P, -1)）、
      // 反演圆（Mirror(obj, circle) = AlgoInvert）。此前 Mirror 只收镜线，
      // 点/圆必须绕道 Reflect 别名
      const obj = resolveObjectArg(ctx, args[0]);
      const mirrorLabel = args[1].trim();
      const mirrorPoint = ctx.findPoint(mirrorLabel);
      if (mirrorPoint) {
        const algo = new AlgoDilate(kernel, obj, mirrorPoint, -1);
        assignOutputLabels(ctx, [algo.getOutput()]);
        return [algo, algo.getOutput()];
      }
      const mirrorCircle = ctx.findConic(mirrorLabel);
      if (mirrorCircle && mirrorCircle.isCircle()) {
        const algo = new AlgoInvert(kernel, obj, mirrorCircle);
        assignOutputLabels(ctx, [algo.getOutput()]);
        return [algo, algo.getOutput()];
      }
      const axis = ctx.findLine(mirrorLabel);
      if (!axis) throw new Error(`Unknown mirror object "${mirrorLabel}"`);
      const algo = new AlgoMirror(kernel, obj, axis.a, axis.b, axis.c, axis);
      assignOutputLabels(ctx, [algo.getOutput()]);
      return [algo, algo.getOutput()];
    }

    // Shear(obj, line, λ) / Stretch(obj, line, λ) —— GeoGebra AlgoShearOrStretch 对应命令
    case 'Shear':
    case 'Stretch': {
      const isStretch = name === 'Stretch';
      const obj = resolveObjectArg(ctx, args[0]);
      const axis = ctx.findLine(args[1].trim());
      if (!axis) throw new Error(`Unknown line "${args[1].trim()}"`);
      const factor = ctx.resolveNumber(args[2]);
      const algo = new AlgoShearStretch(kernel, obj, axis, factor, isStretch ? 'stretch' : 'shear');
      assignOutputLabels(ctx, [algo.getOutput()]);
      return [algo, algo.getOutput()];
    }

    // Translate(obj, v) 活向量；Translate(obj, dx, dy) 冻结分量
    case 'Translate': {
      const obj = resolveObjectArg(ctx, args[0]);
      if (args.length >= 3) {
        const dx = ctx.resolveNumber(args[1]);
        const dy = ctx.resolveNumber(args[2]);
        const algo = new AlgoTranslate(kernel, obj, { x: dx, y: dy });
        assignOutputLabels(ctx, [algo.getOutput()]);
        return [algo, algo.getOutput()];
      }
      const vectorLabel = args[1].trim();
      const vector = ctx.construction.getElements().find(
        el => el instanceof GeoVector && (el as GeoVector).label === vectorLabel,
      ) as GeoVector | undefined;
      if (!vector) throw new Error(`Unknown vector "${vectorLabel}"`);
      const algo = new AlgoTranslate(kernel, obj, vector);
      assignOutputLabels(ctx, [algo.getOutput()]);
      return [algo, algo.getOutput()];
    }

    case 'Text': {
      // Text("内容", x, y) | Text("内容", P) | Text(P, "内容") —— 至少一个字符串参数
      const strArg = args.find(a => parseStringArg(a) !== null);
      if (strArg === undefined) throw new Error('Text expects a quoted string argument');
      const text = parseStringArg(strArg)!;
      const rest = args.filter(a => a !== strArg);
      if (rest.length === 1) {
        const pt = ctx.findPoint(rest[0].trim());
        if (!pt) throw new Error(`Unknown point "${rest[0].trim()}"`);
        const algo = new AlgoText(kernel, pt, text);
        assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      if (rest.length === 2) {
        const x = ctx.resolveNumber(rest[0]);
        const y = ctx.resolveNumber(rest[1]);
        const el = new GeoText(kernel, text, x, y);
        el.label = construction.getNextPointLabel(existingLabels);
        existingLabels.add(el.label);
        return [el];
      }
      throw new Error('Text expects ("content", x, y) or ("content", Point)');
    }

    case 'Angle': {
      // Angle(l1, l2) 两线角（官方 AlgoAngleLines）：两参数都能解析成直线时优先
      if (args.length === 2) {
        const la = ctx.findLine(args[0].trim());
        const lb = ctx.findLine(args[1].trim());
        if (la && lb) {
          const algo = new AlgoAngleTwoLines(kernel, la, lb);
          assignNextLabel(algo.getOutput(), () => construction.getNextAngleLabel(existingLabels));
          return [algo, algo.getOutput()];
        }
        // Angle(P, Q) 两点形式（官方 CmdAngle.process2）：两位置向量 (P−O)、(Q−O) 的夹角。
        // 此前两点落入三分支对 undefined 取 trim 抛原生 TypeError。
        const pa = ctx.findPoint(args[0].trim());
        const pb = ctx.findPoint(args[1].trim());
        if (pa && pb) {
          const algo = new AlgoAngleTwoPoints(kernel, pa, pb);
          assignNextLabel(algo.getOutput(), () => construction.getNextAngleLabel(existingLabels));
          return [algo, algo.getOutput()];
        }
        throw new Error('Angle expects two lines, two points, or three points');
      }
      const p1 = ctx.findPoint(args[0].trim());
      const apex = ctx.findPoint(args[1].trim());
      const p3 = ctx.findPoint(args[2].trim());
      if (!p1 || !apex || !p3) throw new Error('Angle expects three points or two lines');
      const algo = new AlgoAngle(kernel, p1, apex, p3);
      assignNextLabel(algo.getOutput(), () => construction.getNextAngleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Slider': {
      // 官方 CmdSlider：Slider(min, max[, increment, speed, width, isAngle,
      // horizontal, animating, random])（arity [2,9]，前 5 参数值、后 4 参布尔）。
      // Mini 超集保留：Slider() 匿名滑块、Slider(n) 绑定已有数值。
      const num = (text: string) => ctx.resolveNumber(text);
      if (args.length === 0) {
        const slider = new GeoNumeric(kernel, 0);
        slider.intervalMin = -5;
        slider.intervalMax = 5;
        slider.animationIncrement = 0.1;
        makeSliderDrawable(slider, construction);
        assignNextLabel(slider, () => construction.getNextNumericLabel(existingLabels));
        return [slider];
      }
      if (args.length === 1) {
        const existingNum = ctx.findNumeric(args[0].trim());
        if (!existingNum) throw new Error(`Unknown number "${args[0].trim()}"`);
        if (existingNum.intervalMax <= existingNum.intervalMin) {
          existingNum.intervalMin = Math.min(0, existingNum.getValue());
          existingNum.intervalMax = existingNum.intervalMin + 10;
        }
        existingNum.sliderVisible = true;
        makeSliderDrawable(existingNum, construction);
        // 返回的是构造中已有的对象：空数组哨兵（同 B12 重定义），
        // 避免调用方 addElement 把同一对象重复入列表。
        return [];
      }
      const min = num(args[0]);
      const max = num(args[1]);
      if (!(max > min)) throw new Error('Slider expects max > min');
      const step = args.length >= 3 ? num(args[2]) : 0.1;
      const slider = new GeoNumeric(kernel, min + (max - min) / 2);
      slider.intervalMin = min;
      slider.intervalMax = max;
      if (step > 0) slider.animationIncrement = step;
      if (args.length >= 4) slider.animationSpeed = num(args[3]);
      if (args.length >= 5) slider.sliderWidthPx = Math.max(20, num(args[4]));
      if (args.length >= 6 && args[5].trim() === 'true') slider.isAngle = true;
      if (args.length >= 7) slider.sliderHorizontal = args[6].trim() !== 'false';
      if (args.length >= 8 && args[7].trim() === 'true') {
        slider.setAnimating(true);
        kernel.getAnimationManager().addAnimatedGeo(slider);
      }
      if (args.length >= 9 && args[8].trim() === 'true') {
        slider.animationType = AnimationType.RANDOM;
      }
      // 官方：LABEL_NAME_VALUE 可见、画布可见、默认厚度
      slider.sliderVisible = true;
      slider.labelVisible = true;
      makeSliderDrawable(slider, construction);
      assignNextLabel(slider, () => construction.getNextNumericLabel(existingLabels));
      return [slider];
    }

    case 'DirectedAngle': {
      // 有向角（逆时针 [0, 2π)，对标 GeoGebra Angle 的方向变体）
      const p1 = ctx.findPoint(args[0].trim());
      const apex = ctx.findPoint(args[1].trim());
      const p3 = ctx.findPoint(args[2].trim());
      if (!p1 || !apex || !p3) throw new Error('DirectedAngle expects three points (apex second)');
      const algo = new AlgoAngleOriented(kernel, p1, apex, p3);
      assignNextLabel(algo.getOutput(), () => construction.getNextAngleLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'FitPoly': {
      // FitPoly(P1, …, Pn, degree) | FitPoly({P1,…,Pn}, degree)（对标 CmdFitPoly）
      const degree = ctx.resolveNumber(args[args.length - 1]);
      const points: GeoPoint[] = [];
      const pushPoint = (src: string) => {
        const pt = ctx.findPoint(src.trim());
        if (!pt) throw new Error(`FitPoly expects points and a trailing degree; "${src.trim()}" is not a point`);
        points.push(pt);
      };
      // 完整列表字面量（花括号感知 splitArgs 后 args[0] 不再被切碎）：
      const intactLiteral = args.length === 2 && args[0].trim().startsWith('{') && args[0].trim().endsWith('}')
        ? args[0].trim().slice(1, -1).split(',').map(x => x.trim()).filter(x => x.length > 0)
        : null;
      if (intactLiteral) {
        for (const label of intactLiteral) {
          const pt = ctx.findPoint(label);
          if (!pt) throw new Error(`FitPoly expects points and a trailing degree; "${label}" is not a point`);
          points.push(pt);
        }
        const algoFp = new AlgoFitPoly(kernel, points, degree);
        assignNextLabel(algoFp.getOutput(), () => construction.getNextFunctionLabel(existingLabels));
        existingLabels.add(algoFp.getOutput().label);
        return [algoFp, algoFp.getOutput()];
      }
      // 旧式碎片拼接（保留兼容）
      const rebuilt: string[] = [];
      let joining = false;
      for (let i = 0; i < args.length - 1; i++) {
        const arg = args[i].trim();
        if (joining) {
          rebuilt[rebuilt.length - 1] += `, ${arg}`;
          if (arg.includes('}')) joining = false;
        } else if (arg.startsWith('{') && !arg.includes('}')) {
          rebuilt.push(arg);
          joining = true;
        } else {
          rebuilt.push(arg);
        }
      }
      for (const arg of rebuilt) {
        const listMatch = /^\{(.*)\}$/.exec(arg.trim());
        if (listMatch) {
          for (const item of splitArgs(listMatch[1])) pushPoint(item);
        } else {
          pushPoint(arg);
        }
      }
      const algo = new AlgoFitPoly(kernel, points, degree);
      assignNextLabel(algo.getOutput(), () => construction.getNextFunctionLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    // ---- 函数分析 ----
    case 'Derivative': {
      const fn = ctx.findFunction(args[0].trim());
      if (!fn) throw new Error(`Unknown function "${args[0].trim()}"`);
      // 官方 Derivative(f, n)：n 阶导数（此前 arity 写死 [1,1]，高阶阶数缺失）
      let order = 1;
      if (args.length === 2) {
        order = Math.round(ctx.resolveNumber(args[1]));
        if (!Number.isInteger(order) || order < 1 || order > 12) {
          throw new Error('Derivative order must be an integer between 1 and 12');
        }
      }
      // 一律走算法路径（源函数活引用）：自由函数、FitPoly 派生函数、嵌套
      // Derivative 输出都会随 f 的表达式替换重新微分——此前仅
      // AlgoDependentFunction 走算法，其余落入自由函数快照
      const algo = new AlgoDerivative(kernel, fn, order);
      assignNextLabel(algo.getOutput(), () => construction.getNextFunctionLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Root': {
      const fn = ctx.findFunction(args[0].trim());
      if (!fn) throw new Error(`Unknown function "${args[0].trim()}"`);
      const evaluateAt = functionEvaluator(ctx, fn);

      // Root(f)：返回搜索区间内的**全部**实根（多项式走全根求解，否则数值扫描）。
      // 无显式区间时优先用可视区（对标 GeoGebra 的"视区内搜索"），
      // 视区不可用再回退 DEFAULT_SEARCH_RANGE。
      if (args.length === 1) {
        const [lo, hi] = searchRange(viewBounds?.minX ?? -DEFAULT_SEARCH_RANGE, viewBounds?.maxX ?? DEFAULT_SEARCH_RANGE);
        // 多根派生列表（对标 CmdRoot 列表输出）：每个根一个 AlgoFunctionRootPoint
        // 兄弟算法（入构造、随 f/滑块联动），GeoList 只做容器。
        const probeRoots = allFunctionRoots(fn, evaluateAt, lo, hi);
        if (probeRoots.length === 0) throw new Error(`No root found in the range [${lo}, ${hi}]`);
        // 首轮播种在构造函数内完成（探测根 → 兄弟算法窗口），
        // 避免 addInput 中间那次 updateAll 让兄弟算法先各自收根。
        const algo = new AlgoRootList(kernel, fn, lo, hi, ROOT_LIST_CAPACITY, probeRoots);
        const elements: ConstructionElement[] = [];
        // B13 修复：只有**占用的**槽位（算法+输出点）入构造；
        // 空闲槽位完全不进构造——不再以 "GeoElement_CE_xx（未定义）" 泄漏到代数视图。
        // 槽位占用数在创建时固定（根数已知），后续根数变化由列表算法置
        // undefined 表达（多余槽点已在构造中，但只在原根数减少时出现）。
        const rootAlgos = algo.getRootAlgos();
        const rootPoints = algo.getRootPoints();
        // 根数可能超过容量（如 sin(x) 在宽区间）：只注册前 CAPACITY 个根，
        // 其余根丢弃（容量上限语义，列表无法再扩）。
        for (let i = 0; i < Math.min(probeRoots.length, rootPoints.length); i++) {
          rootPoints[i].label = construction.getNextPointLabel(existingLabels);
          existingLabels.add(rootPoints[i].label);
          elements.push(rootAlgos[i], rootPoints[i]);
        }
        assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
        elements.push(algo, algo.getOutput());
        return elements;
      }

      // Root(f, x0) / Root(f, a, b)：输出**派生点**（对标 GeoGebra），
      // f 或其驱动滑块变化时点自动跟随；选根优先离上次位置最近。
      let [lo, hi] = searchRange(-DEFAULT_SEARCH_RANGE, DEFAULT_SEARCH_RANGE);
      if (args.length === 3) {
        [lo, hi] = searchRange(ctx.resolveNumber(args[1]), ctx.resolveNumber(args[2]));
      } else if (args.length === 2) {
        // Root(f, x0)：从 x0 附近开始搜索
        const x0 = ctx.resolveNumber(args[1]);
        [lo, hi] = searchRange(x0 - 1, x0 + 1);
      }

      const probe = evaluateAt((lo + hi) / 2);
      if (!Number.isFinite(probe) && !Number.isFinite(evaluateAt(lo)) && !Number.isFinite(evaluateAt(hi))) {
        throw new Error(`No root found in the range [${lo}, ${hi}]`);
      }
      const algo = new AlgoFunctionRootPoint(kernel, fn, lo, hi);
      algo.compute();
      if (!algo.getOutput().isDefined()) {
        throw new Error(`No root found in the range [${lo}, ${hi}]`);
      }
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Extremum': {
      const fn = ctx.findFunction(args[0].trim());
      if (!fn) throw new Error(`Unknown function "${args[0].trim()}"`);
      // 官方 CmdExtremum 只有 1 参（全区）与 3 参（区间）两种——2 参直接参数错误，
      // 此前 args[1] 被静默吞掉、用户给的搜索点无效且无提示。
      if (args.length === 2) {
        throw new Error('Extremum expects Extremum(f) or Extremum(f, a, b)');
      }
      const evaluateAt = functionEvaluator(ctx, fn);
      // 符号微分只在闭包外做一次；放进闭包会让每个采样点都重新遍历 AST 求导。
      const derivative = makeDerivativeEvaluator(fn);
      // Extremum(f)：视区内搜索（对标 GeoGebra）；Extremum(f, a, b)：尊重显式区间
      const [lo, hi] = args.length >= 3
        ? searchRange(ctx.resolveNumber(args[1]), ctx.resolveNumber(args[2]))
        : searchRange(viewBounds?.minX ?? -DEFAULT_SEARCH_RANGE, viewBounds?.maxX ?? DEFAULT_SEARCH_RANGE);
      const hits = findExtrema(evaluateAt, derivative, lo, hi);
      if (hits.length === 0) throw new Error('No extremum found in the given range');

      // 多极值派生列表（对标 CmdExtremum 多点输出 + Root 的列表结构）：
      // 每个极值一个 AlgoFunctionExtremumPoint 兄弟算法（入构造、随 f/滑块联动），
      // GeoList 只做容器。首轮播种在构造函数内完成（探测极值 → 兄弟算法窗口），
      // 避免 addInput 中间那次 updateAll 让兄弟算法先各自收点。
      const algo = new AlgoExtremumList(kernel, fn, lo, hi, EXTREMUM_LIST_CAPACITY, hits);
      const elements: ConstructionElement[] = [];
      // 兄弟极值点算法与输出先入构造（构造序在主算法之前）；
      // 占用的槽点分配标签，空闲槽不给标签（undefined 不显示）。
      for (const point of algo.getPointOutputs()) {
        if (point.isDefined()) {
          point.label = construction.getNextPointLabel(existingLabels);
          existingLabels.add(point.label);
        }
        elements.push(point);
      }
      for (const pointAlgo of algo.getPointAlgos()) {
        elements.push(pointAlgo);
      }
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      elements.push(algo, algo.getOutput());
      return elements;
    }

    case 'Integral': {
      const fn = ctx.findFunction(args[0].trim());
      if (!fn) throw new Error(`Unknown function "${args[0].trim()}"`);
      const evaluateAt = functionEvaluator(ctx, fn);
      const a = ctx.resolveNumber(args[1]);
      const b = ctx.resolveNumber(args[2]);
      // 创建期校验保持既有报错语义；输出改为活算法（f/端点滑块变化跟随重算，
      // 此前返回自由数值 parentAlgo=null 永不跟随）
      const result = integrate(evaluateAt, a, b);
      if (!Number.isFinite(result.value) || !result.converged) {
        throw new Error('The integral is not finite or did not converge in the given range');
      }
      const aNumeric = ctx.findNumeric(args[1].trim());
      const bNumeric = ctx.findNumeric(args[2].trim());
      const algo = new AlgoIntegralDefinite(kernel, fn, aNumeric ?? a, bNumeric ?? b);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      algo.getOutput().intervalMin = result.value - Math.max(1, Math.abs(result.value));
      algo.getOutput().intervalMax = result.value + Math.max(1, Math.abs(result.value));
      return [algo, algo.getOutput()];
    }

    case 'Vertex': {
      // Vertex(polygon) 顶点列表 / Vertex(polygon, n) 第 n 个顶点（官方 CmdVertex
      // 多边形形式，此前仅圆锥分支可达）
      const polygon = ctx.findPolygon(args[0].trim());
      if (polygon) {
        if (args.length === 2) {
          const n = Math.round(ctx.resolveNumber(args[1]));
          if (!Number.isInteger(n) || n < 1 || n > polygon.vertices.length) {
            throw new Error(`Vertex index must be between 1 and ${polygon.vertices.length}`);
          }
          const v = polygon.vertices[n - 1];
          return [v];
        }
        const list = new GeoList(kernel, [...polygon.vertices]);
        assignNextLabel(list, () => `list${existingLabels.size}`);
        existingLabels.add(list.label);
        return [list];
      }
      const conic = ctx.findConic(args[0].trim());
      if (!conic) throw new Error(`Unknown polygon or conic "${args[0].trim()}"`);
      const algo = new AlgoConicVertex(kernel, conic);
      // 圆/抛物线只填部分输出（与共用圆锥分支同模式）
      const definedOutputs = algo.getGeoElements().filter(el => el.isDefined());
      assignOutputLabels(ctx, definedOutputs);
      return [algo, ...definedOutputs];
    }
    case 'Focus':
    case 'Asymptote':
    case 'Directrix':
    case 'Axes':
    case 'Eccentricity':
    case 'Parameter':
    case 'Radius': {
      const conic = ctx.findConic(args[0].trim());
      if (!conic) throw new Error(`Unknown conic "${args[0].trim()}"`);
      const algo = new ({
        Focus: AlgoConicFocus,
        Vertex: AlgoConicVertex,
        Asymptote: AlgoConicAsymptote,
        Directrix: AlgoConicDirectrix,
        Axes: AlgoConicAxis,
        Eccentricity: AlgoConicEccentricity,
        Parameter: AlgoConicParameter,
        Radius: AlgoConicRadius,
      }[name] as unknown as typeof AlgoConicFocus)(kernel, conic);
      // 圆/抛物线只填部分输出（如圆的第二个焦点保持 undefined），
      // 未定义的输出不进构造、不分配标签
      const definedOutputs = algo.getGeoElements().filter(el => el.isDefined());
      assignOutputLabels(ctx, definedOutputs);
      return [algo, ...definedOutputs];
    }

    case 'Polar': {
      const point = ctx.findPoint(args[0].trim());
      if (!point) throw new Error(`Unknown point "${args[0].trim()}"`);
      const conic = ctx.findConic(args[1].trim());
      if (!conic) throw new Error(`Unknown conic "${args[1].trim()}"`);
      const algo = new AlgoPolarLine(kernel, point, conic);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'IsTangent': {
      const line = ctx.findLine(args[0].trim()) ?? ctx.findLine(args[1].trim());
      const conic = ctx.findConic(args[0].trim()) ?? ctx.findConic(args[1].trim());
      if (!line || !conic) throw new Error('IsTangent expects a line and a conic');
      const algo = new AlgoIsTangent(kernel, line, conic);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'AreCollinear': {
      const pts = args.map(arg => {
        const p = ctx.findPoint(arg.trim());
        if (!p) throw new Error(`Unknown point "${arg.trim()}"`);
        return p;
      });
      const algo = new AlgoAreCollinear(kernel, pts[0], pts[1], pts[2]);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'AreParallel':
    case 'ArePerpendicular': {
      const lines = args.map(arg => {
        const l = ctx.findLine(arg.trim());
        if (!l) throw new Error(`Unknown line "${arg.trim()}"`);
        return l;
      });
      const algo = name === 'AreParallel'
        ? new AlgoAreParallel(kernel, lines[0], lines[1])
        : new AlgoArePerpendicular(kernel, lines[0], lines[1]);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'AreConcyclic': {
      const pts = args.map(arg => {
        const p = ctx.findPoint(arg.trim());
        if (!p) throw new Error(`Unknown point "${arg.trim()}"`);
        return p;
      });
      const algo = new AlgoAreConcyclic(kernel, pts);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'AreCongruent': {
      const elements = args.map(arg => {
        const label = arg.trim();
        const el = ctx.construction.getElements().find(e => (e as { label?: string }).label === label);
        if (!el) throw new Error(`Unknown element "${label}"`);
        return el as GeoElement;
      });
      const algo = new AlgoAreCongruent(kernel, elements);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Centroid': {
      let input: GeoElement[];
      const polygon = ctx.findPolygon(args[0].trim());
      if (args.length === 1 && polygon) {
        input = [polygon];
      } else {
        input = [];
        for (const arg of args) {
          const p = ctx.findPoint(arg.trim());
          if (!p) throw new Error(`Unknown point "${arg.trim()}"`);
          input.push(p);
        }
      }
      const algo = new AlgoCentroid(kernel, input);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Incenter':
    case 'Orthocenter':
    case 'Incircle': {
      const pts = args.map(arg => {
        const p = ctx.findPoint(arg.trim());
        if (!p) throw new Error(`Unknown point "${arg.trim()}"`);
        return p;
      });
      const algo = name === 'Incenter'
        ? new AlgoIncenter(kernel, pts[0], pts[1], pts[2])
        : name === 'Orthocenter'
          ? new AlgoOrthocenter(kernel, pts[0], pts[1], pts[2])
          : new AlgoIncircle(kernel, pts[0], pts[1], pts[2]);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Circumcircle': {
      const pts = args.map(arg => {
        const p = ctx.findPoint(arg.trim());
        if (!p) throw new Error(`Unknown point "${arg.trim()}"`);
        return p;
      });
      const algo = new AlgoCircleThreePoints(kernel, pts[0], pts[1], pts[2]);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Polygon': {
      const pts = args.map(arg => resolvePointArg(ctx, arg));
      // 有 Algo 的多边形：顶点→多边形的正向依赖边随之注册（拖顶点/删除级联才生效）；
      // 边与多边形是同一算法的兄弟输出（官方 AlgoPolygon 同构），一并登记入构造
      const algo = new AlgoPolygonPoints(kernel, pts);
      const poly = algo.getOutput();
      poly.label = ctx.construction.getNextPolygonLabel(ctx.existingLabels);
      return [algo, poly, ...algo.getEdges()];
    }

    case 'TaylorSeries': {
      // 官方双形式（CmdTaylorSeries）：TaylorSeries(f, n) 在 0 处展开 n 阶；
      // TaylorSeries(f, a, n) 在 a 处展开 n 阶。此前 3 参序相反（args[1] 当阶数），
      // 静默产出错误多项式。
      const fn = ctx.findFunction(args[0].trim());
      if (!fn) throw new Error(`Unknown function "${args[0].trim()}"`);
      const center = args.length === 3 ? ctx.resolveNumber(args[1]) : 0;
      const order = Math.round(ctx.resolveNumber(args[args.length - 1]));
      if (!Number.isInteger(order) || order < 0 || order > 12) {
        throw new Error('TaylorSeries order must be an integer between 0 and 12');
      }

      // 展开点有效性沿用创建期校验；输出改为活算法（f 表达式替换 / 展开点
      // 滑块变化跟随重展开，此前是空依赖快照函数）
      const centerNumeric = args.length === 3 ? ctx.findNumeric(args[1].trim()) : undefined;
      const algo = new AlgoTaylorSeriesFunction(kernel, fn, centerNumeric ?? center, order);
      algo.getOutput().label = ctx.construction.getNextFunctionLabel(ctx.existingLabels);
      return [algo, algo.getOutput()];
    }

    case 'Curve': {
      // Curve(x(t), y(t), t, a, b)
      const paramName = args[2].trim();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(paramName)) {
        throw new Error(`Invalid parameter name "${paramName}"`);
      }
      const xText = args[0].trim();
      const yText = args[1].trim();
      const xExpr = parseExpression(xText);
      const yExpr = parseExpression(yText);
      const dependencies = curveDependencies(ctx, [xExpr, yExpr], [paramName]);
      const tMin = ctx.resolveNumber(args[3]);
      const tMax = ctx.resolveNumber(args[4]);
      if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin) {
        throw new Error('Curve range must satisfy a < b');
      }
      const algo = new AlgoDependentCurve(
        kernel, xExpr, yExpr, paramName, tMin, tMax,
        { x: xText, y: yText }, dependencies);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'PointOn': {
      // PointOn(path) 在载体上放置约束点；PointOn(path, t) 指定初值参数
      //（对标官方 Point(<Path>, <Number>) 的参数值形式）
      return createPathPoint(ctx,
        args[0].trim(),
        args.length === 2 ? ctx.resolveNumber(args[1]) : undefined,
      );
    }

    case 'Locus': {
      // Locus(tracer, driver)：2D/3D 轨迹（C5 补 3D 分支）
      const tracer3 = ctx.findPoint3D(args[0].trim());
      const driver3 = ctx.findPoint3D(args[1].trim());
      if (tracer3 && driver3) {
        const algo = new AlgoLocus3D(kernel, tracer3, driver3);
        assignNextLabel(algo.getGeoElements()[0], () => `locus${existingLabels.size}`);
        existingLabels.add(algo.getGeoElements()[0].label);
        return [algo, ...algo.getGeoElements()];
      }
      const tracer2 = ctx.findPoint(args[0].trim());
      const driver2 = ctx.findPoint(args[1].trim());
      if (tracer2 && driver2) {
        const algo = new AlgoLocus(kernel, tracer2, driver2);
        assignNextLabel(algo.getGeoElements()[0], () => `locus${existingLabels.size}`);
        existingLabels.add(algo.getGeoElements()[0].label);
        return [algo, ...algo.getGeoElements()];
      }
      // Locus(Q, a)：数值滑块驱动（官方 CmdLocus 的 GeoNumeric 分支——
      // Q 依赖滑块 a，扫 a 的区间采集 Q 的轨迹）
      const tracerNum = ctx.findPoint(args[0].trim());
      const driverNum = ctx.findNumeric(args[1].trim());
      if (tracerNum && driverNum) {
        const algo = new AlgoLocus(kernel, tracerNum, driverNum);
        assignNextLabel(algo.getGeoElements()[0], () => `locus${existingLabels.size}`);
        existingLabels.add(algo.getGeoElements()[0].label);
        return [algo, ...algo.getGeoElements()];
      }
      throw new Error(`Locus expects (tracer, driver) points in 2D or 3D, or (point, slider)`);
    }

    case 'Tangent': {
      const target = args[0].trim();
      const fn = ctx.findFunction(target);
      const curve = ctx.findCurve(target);
      if (fn || curve) {
        // Tangent(f, a) / Tangent(c, t)：a/t 可以是滑块
        const atText = args[1].trim();
        const numeric = ctx.findNumeric(atText);
        const at: number | GeoNumeric = numeric ?? ctx.evaluateNumber(atText);
        const algo = fn
          ? new AlgoTangentFunctionNumber(kernel, fn, at)
          : new AlgoTangentCurve(kernel, curve!, at);
        assignOutputLabels(ctx, algo.getGeoElements());
        return [algo, ...algo.getGeoElements()];
      }
      // Tangent(P, f) / Tangent(f, P)：函数在点的横坐标处的切线（活依赖：点动切线跟随）
      const pt0 = ctx.findPoint(target);
      const fn1 = ctx.findFunction(args[1].trim());
      if (pt0 && fn1) {
        const algo = new AlgoTangentFunctionNumber(kernel, fn1, pt0);
        assignOutputLabels(ctx, algo.getGeoElements());
        return [algo, ...algo.getGeoElements()];
      }
      // Tangent(P, conic)：过点作圆锥曲线的切线（极线法）
      const point = ctx.findPoint(target);
      const conic = ctx.findConic(args[1].trim());
      if (point && conic) {
        const algo = new AlgoTangent(kernel, conic, point);
        assignOutputLabels(ctx, algo.getGeoElements());
        return [algo, ...algo.getGeoElements()];
      }
      // Tangent(line, conic)：平行切线（官方 CmdTangent 分支，中心型曲线）
      const lineArg = ctx.findLine(target);
      const conic2 = ctx.findConic(args[1].trim());
      if (lineArg && conic2) {
        const algo = new AlgoTangentLineConic(kernel, lineArg, conic2);
        assignOutputLabels(ctx, algo.getGeoElements());
        return [algo, ...algo.getGeoElements()];
      }
      throw new Error(`Tangent expects (function|curve, number|point), (point, conic) or (line, conic)`);
    }

    case 'Center': {
      // Center(conic)：圆/椭圆/双曲线的中心点（官方 CmdCenter，与 Vertex(circle) 同源）
      const conic = ctx.findConic(args[0].trim());
      if (!conic) throw new Error(`Unknown conic "${args[0].trim()}"`);
      const algo = new AlgoCircleCenter(kernel, conic);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'AreEqual': {
      // 参数可为标签或算术表达式（官方 resArgs 语义：AreEqual(1/3, 0.333…)）
      const resolveComparable = (text: string): GeoNumeric | GeoPoint | null => {
        const num = ctx.findNumeric(text);
        if (num) return num;
        const pt = ctx.findPoint(text);
        if (pt) return pt;
        const value = ctx.evaluateNumber(text);
        const snapshot = new GeoNumeric(kernel, value);
        snapshot.visible = false;
        return snapshot;
      };
      const a = resolveComparable(args[0].trim());
      const b = resolveComparable(args[1].trim());
      if (!a || !b) throw new Error(`AreEqual expects two numbers or two points`);
      const algo = new AlgoAreEqual(kernel, a, b);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Curvature':
    case 'OsculatingCircle': {
      const target = args[0].trim();
      const fn = ctx.findFunction(target);
      const curve = ctx.findCurve(target);
      const path = fn ?? curve;
      if (!path) throw new Error(`Unknown function or curve "${target}"`);
      const atText = args[1].trim();
      const numeric = ctx.findNumeric(atText);
      const at: number | GeoNumeric = numeric ?? ctx.evaluateNumber(atText);
      const algo = name === 'Curvature'
        ? new AlgoCurvature(kernel, path, at)
        : new AlgoOsculatingCircle(kernel, path, at);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'PointIn':
    case 'RandomPointIn': {
      const labelText = args[0].trim();
      const plane3 = ctx.findPlane3D(labelText);
      if (plane3) {
        if (name !== 'PointIn') throw new Error(`RandomPointIn does not support plane "${labelText}"`);
        // 平面是无限 Region3D（C10）：点落在面内 CoordSys 原点，可拖拽
        const algo = new AlgoPointInPlane3D(kernel, plane3);
        assignNextLabel(algo.getGeoElements()[0], () => construction.getNextPointLabel(existingLabels));
        return [algo, ...algo.getGeoElements()];
      }
      const region = ctx.findPolygon(labelText) ?? ctx.findConic(labelText);
      if (!region) throw new Error(`Unknown polygon, conic, or plane "${labelText}"`);
      const algo = name === 'PointIn'
        ? new AlgoPointInRegion(kernel, region)
        : new AlgoRandomPointIn(kernel, region);
      assignNextLabel(algo.getGeoElements()[0], () => construction.getNextPointLabel(existingLabels));
      return [algo, ...algo.getGeoElements()];
    }

    case 'IsInRegion': {
      const point = ctx.findPoint(args[0].trim());
      if (!point) throw new Error(`Unknown point "${args[0].trim()}"`);
      const region = ctx.findPolygon(args[1].trim()) ?? ctx.findConic(args[1].trim());
      if (!region) throw new Error(`Unknown polygon or conic "${args[1].trim()}"`);
      const algo = new AlgoIsInRegion(kernel, point, region);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Polynomial': {
      const points = args.map(arg => {
        const p = resolvePointArg(ctx, arg);
        if (!p) throw new Error(`Unknown point "${arg.trim()}"`);
        return p;
      });
      const coeffs = interpolatePolynomial(points.map(p => ({ x: p.getX(), y: p.getY() })));
      if (!coeffs) throw new Error('Polynomial requires points with distinct x-coordinates');
      const ast = polynomialToAst(coeffs, 'x');
      const algo = new AlgoDependentFunction(kernel, ast, 'x', expressionToString(ast), []);
      algo.getOutput().label = construction.getNextFunctionLabel(existingLabels);
      return [algo, algo.getOutput()];
    }

    case 'Point3D': {
      const x = ctx.resolveNumber(args[0]);
      const y = ctx.resolveNumber(args[1]);
      const z = ctx.resolveNumber(args[2]);
      const point = new GeoPoint3D(kernel, Coords4.fromPoint(x, y, z));
      assignNextLabel(point, () => construction.getNextPointLabel(existingLabels));
      return [point];
    }

    case 'Line3D':
    case 'Segment3D': {
      const a = ctx.findPoint3D(args[0].trim());
      const b = ctx.findPoint3D(args[1]?.trim() ?? '');
      // 定长形式 Segment(A, len)（官方 CmdSegment3D 继承 CmdSegment 的 (point, number)）
      if (a && !b) {
        const lenText = args[1].trim();
        const len = ctx.findNumeric(lenText) ?? ctx.evaluateNumber(lenText);
        const seg = new AlgoSegmentLength3D(kernel, a, len);
        assignNextLabel(seg.getOutput(), () => construction.getNextLineLabel(existingLabels));
        return [seg, seg.getOutput()];
      }
      if (!a || !b) throw new Error(`${name} expects two 3D points, or a point and a length`);
      const algo = new AlgoJoinPoints3D(kernel, a, b, name === 'Segment3D');
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Midpoint3D': {
      // 单参线段形式 Midpoint(seg3D)（官方 CmdMidpoint3D.java:57-64）——
      // 此前 args[1] undefined 抛原生 TypeError
      if (args.length === 1) {
        const seg = ctx.findLine3D(args[0].trim());
        if (seg) {
          const mid = new AlgoMidpointSegment3D(kernel, seg);
          assignNextLabel(mid.getOutput(), () => construction.getNextPointLabel(existingLabels));
          return [mid, mid.getOutput()];
        }
      }
      const a = ctx.findPoint3D(args[0].trim());
      const b = ctx.findPoint3D(args[1]?.trim() ?? '');
      if (!a || !b) throw new Error(`Midpoint3D expects two 3D points`);
      const algo = new AlgoMidpoint3D(kernel, a, b);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Plane3D':
    case 'Plane': {
      const pts = args.map(arg => {
        const p = ctx.findPoint3D(arg.trim());
        if (!p) throw new Error(`Unknown 3D point "${arg.trim()}"`);
        return p;
      });
      const algo = new AlgoPlaneThreePoints3D(kernel, pts[0], pts[1], pts[2]);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'IntersectLinePlane': {
      const line = ctx.findLine3D(args[0].trim());
      const plane = ctx.findPlane3D(args[1].trim());
      if (!line || !plane) throw new Error(`IntersectLinePlane expects a 3D line and a 3D plane`);
      const algo = new AlgoIntersectLinePlane3D(kernel, line, plane);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Distance3D': {
      const point = ctx.findPoint3D(args[0].trim());
      const point2 = ctx.findPoint3D(args[1].trim());
      const plane = ctx.findPlane3D(args[1].trim());
      // 点×点（官方 CmdDistance3D 回落 CmdDistance 的基础形式，此前抛错）
      if (point && point2) {
        const dist = new AlgoDistanceTwoPoints3D(kernel, point, point2);
        assignNextLabel(dist.getOutput(), () => construction.getNextNumericLabel(existingLabels));
        return [dist, dist.getOutput()];
      }
      if (!point || !plane) throw new Error(`Distance3D expects a 3D point and a 3D plane`);
      const algo = new AlgoDistancePointPlane3D(kernel, point, plane);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Sphere3D':
    case 'Sphere': {
      const center = ctx.findPoint3D(args[0].trim());
      if (!center) throw new Error(`Unknown 3D point "${args[0].trim()}"`);
      const numeric = ctx.findNumeric(args[1].trim());
      const surface = ctx.findPoint3D(args[1].trim());
      let algo: AlgoSphere3D;
      if (surface) algo = new AlgoSphere3D(kernel, center, surface);
      else if (numeric) algo = new AlgoSphere3D(kernel, center, numeric.getValue());
      else algo = new AlgoSphere3D(kernel, center, ctx.resolveNumber(args[1]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Cylinder3D':
    case 'Cylinder':
    case 'Cone3D':
    case 'Cone': {
      const axis = ctx.findLine3D(args[0].trim());
      if (!axis) throw new Error(`Unknown 3D line "${args[0].trim()}"`);
      const value = ctx.resolveNumber(args[1]);
      // 第三参可选：有限高（数或活滑块）；缺省 → 无限
      let height: number | GeoNumeric | null = null;
      if (args.length >= 3) {
        const hText = args[2].trim();
        height = ctx.findNumeric(hText) ?? ctx.resolveNumber(hText);
      }
      const algo = (name === 'Cylinder3D' || name === 'Cylinder')
        ? new AlgoCylinder3D(kernel, axis, value, height)
        : new AlgoCone3D(kernel, axis, value * Math.PI / 180, height);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'IntersectLineQuadric': {
      const line = ctx.findLine3D(args[0].trim());
      const quadric = ctx.findQuadric3D(args[1].trim());
      if (!line || !quadric) throw new Error(`IntersectLineQuadric expects a 3D line and a quadric`);
      const algo = new AlgoIntersectLineQuadric3D(kernel, line, quadric);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Prism3D':
    case 'Prism': {
      // Prism3D(P1..Pn, h) 直棱柱 / Prism3D(P1..Pn, Q) 斜棱柱（Q 为顶面参考点）
      const lastText = args[args.length - 1].trim();
      const pts = args.slice(0, -1).map(a => {
        const p = ctx.findPoint3D(a.trim());
        if (!p) throw new Error(`Unknown 3D point "${a.trim()}"`);
        return p;
      });
      if (pts.length < 3) throw new Error(`Prism3D expects at least 3 base points`);
      const topPoint = ctx.findPoint3D(lastText);
      const extrusion = topPoint ?? ctx.resolveNumber(lastText);
      const algo = new AlgoPrism3D(kernel, pts, extrusion);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Pyramid3D':
    case 'Pyramid': {
      // Pyramid3D(P1..Pn, apex)：前 n−1 个为底面点，末位为顶点
      const apexText = args[args.length - 1].trim();
      const apex = ctx.findPoint3D(apexText);
      if (!apex) throw new Error(`Unknown 3D point "${apexText}"`);
      const pts = args.slice(0, -1).map(a => {
        const p = ctx.findPoint3D(a.trim());
        if (!p) throw new Error(`Unknown 3D point "${a.trim()}"`);
        return p;
      });
      if (pts.length < 3) throw new Error(`Pyramid3D expects at least 3 base points`);
      const algo = new AlgoPyramid3D(kernel, pts, apex);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Volume3D':
    case 'Volume': {
      const quadric = ctx.findQuadric3D(args[0].trim());
      const polyhedron = ctx.findPolyhedron3D(args[0].trim());
      const target = quadric ?? polyhedron;
      if (!target) throw new Error(`Unknown quadric or polyhedron "${args[0].trim()}"`);
      const algo = new AlgoVolume3D(kernel, target);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Angle3D': {
      // 3D 三点角（官方 CmdAngle3D 继承 CmdAngle 的三点形式，此前抛错）
      if (args.length === 3) {
        const [a3, b3, c3] = args.map(arg => ctx.findPoint3D(arg.trim()));
        if (a3 && b3 && c3) {
          const ang = new AlgoAnglePoints3D(kernel, a3, b3, c3);
          assignNextLabel(ang.getOutput(), () => construction.getNextNumericLabel(existingLabels));
          return [ang, ang.getOutput()];
        }
      }
      const l1 = ctx.findLine3D(args[0].trim());
      const l2 = ctx.findLine3D(args[1]?.trim() ?? '');
      const p1 = ctx.findPlane3D(args[0].trim());
      const p2 = ctx.findPlane3D(args[1]?.trim() ?? '');
      const algo = l1 && l2
        ? new AlgoAngleLines3D(kernel, l1, l2)
        : p1 && p2
          ? new AlgoAnglePlanes3D(kernel, p1, p2)
          : null;
      if (!algo) throw new Error(`Angle3D expects two 3D lines or two 3D planes`);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Surface': {
      // 旋转面：Surface(path, angleDeg) | Surface(path, angleDeg, axis)
      if (args.length === 2 || args.length === 3) {
        const pathLabel = args[0].trim();
        const path = ctx.findFunction(pathLabel) ?? ctx.findCurve(pathLabel);
        if (!path) throw new Error(`Surface expects a function or curve "${pathLabel}"`);
        const angleText = args[1].trim();
        const angleNumeric = ctx.findNumeric(angleText);
        const angle: GeoNumeric | number = angleNumeric ?? ctx.evaluateNumber(angleText);
        let axis: GeoLine3D | null = null;
        if (args.length === 3) {
          axis = ctx.findLine3D(args[2].trim());
          if (!axis) throw new Error(`Unknown 3D line "${args[2].trim()}"`);
        }
        const algo = new AlgoSurfaceOfRevolution(kernel, path, angle, axis);
        assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      if (args.length !== 9) {
        throw new Error('Surface requires 2 or 3 arguments (revolution) or 9 (parametric)');
      }
      // Surface(x(u,v), y(u,v), z(u,v), u, u0, u1, v, v0, v1)
      const paramU = args[3].trim();
      const paramV = args[6].trim();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(paramU) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(paramV)) {
        throw new Error('Surface parameter names must be identifiers');
      }
      const texts = { x: args[0].trim(), y: args[1].trim(), z: args[2].trim() };
      const exprs = [parseExpression(texts.x), parseExpression(texts.y), parseExpression(texts.z)];
      const dependencies = curveDependencies(ctx, exprs, [paramU, paramV]);
      const u0 = ctx.resolveNumber(args[4]);
      const u1 = ctx.resolveNumber(args[5]);
      const v0 = ctx.resolveNumber(args[7]);
      const v1 = ctx.resolveNumber(args[8]);
      if (![u0, u1, v0, v1].every(Number.isFinite) || u1 <= u0 || v1 <= v0) {
        throw new Error('Surface ranges must satisfy u0 < u1 and v0 < v1');
      }
      const algo = new AlgoDependentSurface(
        kernel, exprs[0], exprs[1], exprs[2], paramU, u0, u1, paramV, v0, v1, texts, dependencies);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Circle3D': {
      // 圆心+半径 Circle(A, r) 与 圆心+圆上点 Circle(A, B)（官方 CmdCircle3D 两参形；
      // 此前两参 pts[2]=undefined 直接 TypeError 崩溃）
      if (args.length === 2) {
        const center = ctx.findPoint3D(args[0].trim());
        if (!center) throw new Error(`Unknown 3D point "${args[0].trim()}"`);
        const onPoint = ctx.findPoint3D(args[1].trim());
        if (onPoint) {
          const cp = new AlgoCircleCenterPoint3D(kernel, center, onPoint);
          assignNextLabel(cp.getOutput(), () => construction.getNextLineLabel(existingLabels));
          return [cp, cp.getOutput()];
        }
        const r = ctx.findNumeric(args[1].trim()) ?? ctx.evaluateNumber(args[1]);
        const cr = new AlgoCircleCenterRadius3D(kernel, center, r);
        assignNextLabel(cr.getOutput(), () => construction.getNextLineLabel(existingLabels));
        return [cr, cr.getOutput()];
      }
      const pts = args.map(a => {
        const p = ctx.findPoint3D(a.trim());
        if (!p) throw new Error(`Unknown 3D point "${a.trim()}"`);
        return p;
      });
      const algo = new AlgoCircleThreePoints3D(kernel, pts[0], pts[1], pts[2]);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Ellipsoid3D': {
      const center = ctx.findPoint3D(args[0].trim());
      if (!center) throw new Error(`Unknown 3D point "${args[0].trim()}"`);
      const algo = new AlgoEllipsoid3D(kernel, center, ctx.resolveNumber(args[1]), ctx.resolveNumber(args[2]), ctx.resolveNumber(args[3]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Translate3D': {
      // 对象级：点/直线/圆/多面体都可平移
      const obj = ctx.findPoint3D(args[0].trim()) as GeoElement | undefined
        ?? ctx.findLine3D(args[0].trim())
        ?? ctx.findCircle3D(args[0].trim())
        ?? ctx.findPolyhedron3D(args[0].trim());
      if (!obj) throw new Error(`Unknown 3D object "${args[0].trim()}"`);
      const dx = ctx.resolveNumber(args[1]);
      const dy = ctx.resolveNumber(args[2]);
      const dz = ctx.resolveNumber(args[3]);
      const tArgs: Transform3DArgs = { op: 'translate', dx, dy, dz };
      const algo = obj instanceof GeoPoint3D
        ? new AlgoTranslate3D(kernel, obj, dx, dy, dz)
        : obj instanceof GeoLine3D
          ? new AlgoTransformLine3D(kernel, obj, tArgs)
          : obj instanceof GeoCircle3D
            ? new AlgoTransformCircle3D(kernel, obj, tArgs)
            : new AlgoTransformPolyhedron3D(kernel, obj as GeoPolyhedron3D, tArgs);
      assignNextLabel(algo.getGeoElements()[0], () => construction.getNextLineLabel(existingLabels));
      return [algo, ...algo.getGeoElements()];
    }

    case 'Rotate3D': {
      const obj = ctx.findPoint3D(args[0].trim()) as GeoElement | undefined
        ?? ctx.findLine3D(args[0].trim())
        ?? ctx.findCircle3D(args[0].trim())
        ?? ctx.findPolyhedron3D(args[0].trim());
      const axis = ctx.findLine3D(args[1].trim());
      if (!obj || !axis) throw new Error(`Rotate3D expects a 3D object and a 3D axis line`);
      const angle = ctx.resolveNumber(args[2]) * Math.PI / 180;
      const tArgs: Transform3DArgs = { op: 'rotate', axis, angle };
      const algo = obj instanceof GeoPoint3D
        ? new AlgoRotatePoint3D(kernel, obj, axis, angle)
        : obj instanceof GeoLine3D
          ? new AlgoTransformLine3D(kernel, obj, tArgs)
          : obj instanceof GeoCircle3D
            ? new AlgoTransformCircle3D(kernel, obj, tArgs)
            : new AlgoTransformPolyhedron3D(kernel, obj as GeoPolyhedron3D, tArgs);
      assignNextLabel(algo.getGeoElements()[0], () => construction.getNextLineLabel(existingLabels));
      return [algo, ...algo.getGeoElements()];
    }

    case 'Mirror3D': {
      const obj = ctx.findPoint3D(args[0].trim()) as GeoElement | undefined
        ?? ctx.findLine3D(args[0].trim())
        ?? ctx.findCircle3D(args[0].trim())
        ?? ctx.findPolyhedron3D(args[0].trim());
      const plane = ctx.findPlane3D(args[1].trim());
      if (!obj || !plane) throw new Error(`Mirror3D expects a 3D object and a 3D plane`);
      const tArgs: Transform3DArgs = { op: 'mirror', plane };
      const algo = obj instanceof GeoPoint3D
        ? new AlgoMirrorPoint3D(kernel, obj, plane)
        : obj instanceof GeoLine3D
          ? new AlgoTransformLine3D(kernel, obj, tArgs)
          : obj instanceof GeoCircle3D
            ? new AlgoTransformCircle3D(kernel, obj, tArgs)
            : new AlgoTransformPolyhedron3D(kernel, obj as GeoPolyhedron3D, tArgs);
      assignNextLabel(algo.getGeoElements()[0], () => construction.getNextLineLabel(existingLabels));
      return [algo, ...algo.getGeoElements()];
    }

    // 条件显隐 / 动态颜色（对标 SetConditionToShowObject / SetDynamicColor）：
    // 条件与颜色表达式惰性求值（绘制/命中时读依赖当前值），依赖变动经
    // notifyUpdate 触发重绘，无需独立算法参与
    case 'SetConditionToShowObject': {
      const target = ctx.findPoint(args[1].trim())
        ?? ctx.findLine(args[1].trim())
        ?? ctx.findConic(args[1].trim())
        ?? ctx.findFunction(args[1].trim())
        ?? ctx.findPolygon(args[1].trim())
        ?? ctx.findCurve(args[1].trim());
      if (!target) throw new Error(`Unknown object "${args[1].trim()}"`);
      const ast = parseExpression(args[0]);
      const deps: GeoNumeric[] = [];
      for (const name of collectVariables(ast)) {
        const dep = ctx.findNumeric(name);
        if (!dep) throw new Error(`Unknown variable "${name}" in condition`);
        deps.push(dep);
      }
      target.visibleCondition = { ast, deps };
      target.update();
      return [];
    }

    case 'SetDynamicColor': {
      const target = ctx.findPoint(args[0].trim())
        ?? ctx.findLine(args[0].trim())
        ?? ctx.findConic(args[0].trim())
        ?? ctx.findFunction(args[0].trim())
        ?? ctx.findPolygon(args[0].trim())
        ?? ctx.findCurve(args[0].trim());
      if (!target) throw new Error(`Unknown object "${args[0].trim()}"`);
      const depSet = new Set<GeoNumeric>();
      const parse = (text: string) => {
        const ast = parseExpression(text);
        for (const name of collectVariables(ast)) {
          const dep = ctx.findNumeric(name);
          if (!dep) throw new Error(`Unknown variable "${name}" in color`);
          depSet.add(dep);
        }
        return ast;
      };
      const r = parse(args[1]);
      const g = parse(args[2]);
      const b = parse(args[3]);
      const a = args.length >= 5 ? parse(args[4]) : undefined;
      target.dynamicColor = { r, g, b, a, deps: Array.from(depSet) };
      target.update();
      return [];
    }

    case 'IntersectPath': {
      const plane = ctx.findPlane3D(args[0].trim());
      if (!plane) throw new Error(`IntersectPath expects a 3D plane`);
      const polyhedron = ctx.findPolyhedron3D(args[1].trim());
      const quadric = ctx.findQuadric3D(args[1].trim());
      // 平面 × 二次曲面走**解析截面**（输出 GeoConic3D，可继续取点/求圆心/算长度），
      // 与官方 AlgoIntersectPlaneQuadric 语义一致；此前输出 64 点折线近似，
      // 截面圆上无法做任何下游构造。解析解不了的退化情形（平面∥柱轴等）回退折线近似。
      if (quadric) {
        const analytic = new AlgoIntersectConicPlaneQuadric(kernel, plane, quadric);
        analytic.update();
        if (analytic.getOutput().isDefined()) {
          assignNextLabel(analytic.getOutput(), () => construction.getNextLineLabel(existingLabels));
          return [analytic, analytic.getOutput()];
        }
        const fallback = new AlgoIntersectPlaneQuadric(kernel, plane, quadric);
        assignNextLabel(fallback.getGeoElements()[0], () => construction.getNextLineLabel(existingLabels));
        return [fallback, ...fallback.getGeoElements()];
      }
      if (!polyhedron) throw new Error(`IntersectPath expects a 3D polyhedron or quadric`);
      const algo = new AlgoIntersectPathPlanePolyhedron(kernel, plane, polyhedron);
      assignNextLabel(algo.getGeoElements()[0], () => construction.getNextLineLabel(existingLabels));
      return [algo, ...algo.getGeoElements()];
    }

    case 'Ellipse3D':
    case 'Hyperbola3D': {
      const pts = args.map(a => {
        const p = ctx.findPoint3D(a.trim());
        if (!p) throw new Error(`Unknown 3D point "${a.trim()}"`);
        return p;
      });
      const algo = name === 'Ellipse3D'
        ? new AlgoEllipse3D(kernel, pts[0], pts[1], pts[2])
        : new AlgoHyperbola3D(kernel, pts[0], pts[1], pts[2]);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Net': {
      const polyhedron = ctx.findPolyhedron3D(args[0].trim());
      if (!polyhedron) throw new Error(`Unknown 3D polyhedron "${args[0].trim()}"`);
      // 可选展开因子 v∈[0,1]：活滑块走 GeoNumeric，字面量冻结为 number
      let factor: number | GeoNumeric | undefined;
      if (args.length > 1) {
        const text = args[1].trim();
        factor = ctx.findNumeric(text) ?? ctx.evaluateNumber(text);
      }
      const algo = new AlgoPolyhedronNet(kernel, polyhedron, factor);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      assignOutputLabels(ctx, algo.getFacePolygons());
      return [algo, ...algo.getGeoElements()];
    }

    case 'IntersectConic': {
      const plane = ctx.findPlane3D(args[0].trim());
      const quadric = ctx.findQuadric3D(args[1].trim());
      if (!plane || !quadric) throw new Error(`IntersectConic expects a 3D plane and a quadric`);
      const algo = new AlgoIntersectConicPlaneQuadric(kernel, plane, quadric);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Parabola3D': {
      const p = ctx.findPoint3D(args[0].trim());
      const l = ctx.findLine3D(args[1].trim());
      if (!p || !l) throw new Error(`Parabola3D expects a 3D point (focus) and a 3D line (directrix)`);
      const algo = new AlgoParabola3D(kernel, p, l);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    // ---- 列表命令族（官方 AlgoSequence / AlgoElementList / ...）----
    case 'Sequence': {
      // Sequence(expr, k, from, to[, step])：活依赖（表达式数值 + 区间端点）
      const variableName = args[1].trim();
      const expression = parseExpression(args[0].trim());
      const allowedVars = [variableName];
      const dependencies = ctx.makeNumericDeps(expression, allowedVars);
      const fnDeps = ctx.makeFnDeps(expression);
      const resolveBound = (text: string): GeoNumeric | number => {
        const n = ctx.findNumeric(text.trim());
        return n ?? ctx.evaluateNumber(text);
      };
      const from = resolveBound(args[2]);
      const to = resolveBound(args[3]);
      const step = args.length >= 5 ? resolveBound(args[4]) : 1;
      const algo = new AlgoSequence(kernel, expression, variableName, from, to, step, dependencies, fnDeps);
      algo.commandText = `Sequence(${args[0].trim()}, ${variableName}, ${args[2].trim()}, ${args[3].trim()}${args.length >= 5 ? `, ${args[4].trim()}` : ''})`;
      const out = algo.getOutput();
      assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
      return [algo, out];
    }
    case 'Element': {
      const list = ctx.resolveList(args[0].trim());
      if (!list) throw new Error(`Element expects a list`);
      const index = ctx.findNumeric(args[1].trim()) ?? ctx.evaluateNumber(args[1]);
      const algo = new AlgoListElement(kernel, list, index);
      construction.addElement(algo);
      algo.update(); // 先算：点列表在 compute 内惰性切换点输出（此前 addElement 的是切换前的数值占位）
      const out = algo.getPrimaryOutput();
      if (out) {
        assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
        construction.addElement(out);
      }
      return [algo, ...(out ? [out] : [])];
    }
    case 'First':
    case 'Last': {
      const list = ctx.resolveList(args[0].trim());
      if (!list) throw new Error(`${name} expects a list`);
      // 单参 → 单元素输出（官方语义）；双参 → 子列表
      if (args.length === 1) {
        const algo = new AlgoListElement(kernel, list, name === 'First' ? 1 : 'last');
        construction.addElement(algo);
        algo.update();
        const out = algo.getPrimaryOutput();
        if (out) {
          assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
          construction.addElement(out);
        }
        return [algo, ...(out ? [out] : [])];
      }
      const n = ctx.findNumeric(args[1].trim()) ?? ctx.evaluateNumber(args[1]);
      const algo = new AlgoListTransform(kernel, name === 'First' ? 'first' : 'last', list, null, null, n);
      const outList = algo.getOutput();
      assignNextLabel(outList, () => construction.getNextPointLabel(existingLabels));
      return [algo, outList];
    }
    case 'Take': {
      // 官方：Take(list, start, end) 与两参 Take(list, n)（末 n 个）
      const list = ctx.resolveList(args[0].trim());
      if (!list) throw new Error(`Take expects a list`);
      const a = ctx.findNumeric(args[1].trim()) ?? ctx.evaluateNumber(args[1]);
      const b = args.length >= 3 ? (ctx.findNumeric(args[2].trim()) ?? ctx.evaluateNumber(args[2])) : null;
      const algo = new AlgoListTransform(kernel, 'take', list, null, null, a, b);
      const out = algo.getOutput();
      assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
      return [algo, out];
    }
    case 'Sort':
    case 'Unique':
    case 'Reverse':
    case 'RemoveUndefined':
    case 'Flatten': {
      const list = ctx.resolveList(args[0].trim());
      if (!list) throw new Error(`${name} expects a list`);
      const op = { Sort: 'sort', Unique: 'unique', Reverse: 'reverse', RemoveUndefined: 'removeUndefined', Flatten: 'flatten' }[name] as 'sort' | 'unique' | 'reverse' | 'removeUndefined' | 'flatten';
      const algo = new AlgoListTransform(kernel, op, list);
      const out = algo.getOutput();
      assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
      return [algo, out];
    }
    case 'Append':
    case 'Insert':
    case 'Remove': {
      // 官方 Insert(object, list, pos)：第二参是列表
      const list = ctx.resolveList(args[0].trim()) ?? (name === 'Insert' ? ctx.resolveList(args[1].trim()) : undefined);
      if (!list) throw new Error(`${name} expects a list`);
      if (name === 'Remove') {
        // 官方 CmdRemove：Remove(list, 位置列表)；兼容 Remove(list, n) 单位置扩展
        const posList = ctx.resolveList(args[1].trim());
        if (posList) {
          const algo = new AlgoListTransform(kernel, 'removePositions', list, posList);
          const out = algo.getOutput();
          assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
          return [algo, out];
        }
        const pos = ctx.findNumeric(args[1].trim()) ?? ctx.evaluateNumber(args[1]);
        const algo = new AlgoListTransform(kernel, 'remove', list, null, null, pos);
        const out = algo.getOutput();
        assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
        return [algo, out];
      }
      // 官方 CmdInsert 参数序 Insert(object, list, position)；兼容 Mini Insert(list, item, pos)
      const insertOfficial = name === 'Insert' && !ctx.findListArg(args[0].trim()) && !!ctx.findListArg(args[1].trim());
      const itemArg = insertOfficial ? args[0] : args[1];
      const item = resolveItemArg(ctx, kernel, itemArg);
      if (!item) throw new Error(`${name} expects a numeric or point item`);
      if (name === 'Append') {
        const algo = new AlgoListTransform(kernel, 'append', list, null, item);
        const out = algo.getOutput();
        assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
        return [algo, out];
      }
      // Insert(list, item, pos) / Insert(item, list, pos)
      const posArg = insertOfficial ? args[2] : args[2];
      const pos = ctx.findNumeric(posArg.trim()) ?? ctx.evaluateNumber(posArg);
      const algo = new AlgoListTransform(kernel, 'insert', list, null, item, pos);
      const out = algo.getOutput();
      assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
      return [algo, out];
    }
    case 'Join': {
      // Join(listOfLists) 或 Join(l1, l2, ..., ln)（官方支持任意个列表）
      const lists = args.map(a => ctx.resolveList(a.trim())).filter((l): l is NonNullable<typeof l> => !!l);
      if (lists.length === 0) throw new Error(`Join expects lists`);
      let algo: AlgoListTransform;
      if (lists.length === 1) {
        algo = new AlgoListTransform(kernel, 'join', lists[0]);
      } else {
        // 两个以上列表：先物化一个临时合并列表（自有子元素）再 shallow 展开
        const merged = new AlgoListTransform(kernel, 'join', lists[0], lists[1]);
        void merged;
        // 直接逐个 join 链式：join(join(l1,l2),l3)...
        let acc = new AlgoListTransform(kernel, 'join', lists[0], lists[1]);
        for (let i = 2; i < lists.length; i++) {
          acc = new AlgoListTransform(kernel, 'join', acc.getOutput(), lists[i]);
          acc.getOutput().label = construction.getNextPointLabel(existingLabels);
          construction.addElement(acc);
        }
        algo = acc;
      }
      const out = algo.getOutput();
      assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
      return [algo, out];
    }
    case 'Sum':
    case 'Product': {
      const list = ctx.resolveList(args[0].trim());
      if (!list) throw new Error(`${name} expects a list`);
      const algo = new AlgoListAggregate(kernel, name === 'Sum' ? 'sum' : 'product', list);
      construction.addElement(algo);
      algo.update(); // 先算：点列表求和在 compute 内惰性切换点输出
      const out = algo.getPrimaryOutput();
      assignNextLabel(out, () => construction.getNextNumericLabel(existingLabels));
      existingLabels.add(out.label);
      construction.addElement(out);
      return [algo, out];
    }
    case 'IndexOf': {
      // 官方 CmdIndexOf 参数序 IndexOf(object, list)；兼容 Mini 早期 IndexOf(list, object)
      const listA = ctx.resolveList(args[0].trim());
      const listB = ctx.resolveList(args[1].trim());
      const list = listB ?? listA;
      const itemArg = listB ? args[0] : args[1];
      if (!list) throw new Error(`IndexOf expects a list`);
      const item = resolveItemArg(ctx, kernel, itemArg);
      if (!item) throw new Error(`IndexOf expects a numeric or point item`);
      const algo = new AlgoListAggregate(kernel, 'indexOf', list, item);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    // ---- 数论命令族（官方 AlgoGCD / AlgoMod / ...）----
    case 'GCD':
    case 'LCM': {
      const a = ctx.evaluateNumber(args[0]);
      const b = ctx.evaluateNumber(args[1]);
      const value = name === 'GCD' ? gcd(a, b) : lcm(a, b);
      return [ctx.createStaticNumeric(value)];
    }
    case 'Mod': {
      const a = ctx.evaluateNumber(args[0]);
      const b = ctx.evaluateNumber(args[1]);
      // 官方 AlgoMod.java:53-70：结果恒在 [0, |b|)（此前带符号 b，Mod(7,-3)=-2）
      const absB = Math.abs(b);
      const m = absB === 0 ? NaN : a - absB * Math.floor(a / absB);
      return [ctx.createStaticNumeric(m)];
    }
    case 'Div': {
      const a = ctx.evaluateNumber(args[0]);
      const b = ctx.evaluateNumber(args[1]);
      // 官方 AlgoDiv.java:55-59：负除数用 ceil（此前恒 floor，Div(-7,-2)=3 官方=4）
      const value = b === 0 ? NaN
        : (b < 0 ? Math.ceil(a / b) : Math.floor(a / b));
      return [ctx.createStaticNumeric(value)];
    }
    case 'IsPrime': {
      return [ctx.createStaticNumeric(isPrime(ctx.evaluateNumber(args[0])) ? 1 : 0)];
    }
    case 'NextPrime':
    case 'PreviousPrime': {
      const v = ctx.evaluateNumber(args[0]);
      return [ctx.createStaticNumeric(name === 'NextPrime' ? nextPrime(v) : previousPrime(v))];
    }
    case 'DivisorsSum': {
      return [ctx.createStaticNumeric(divisorsSum(ctx.evaluateNumber(args[0])))];
    }
    case 'BinomialCoefficient': {
      const v = binomialCoefficient(ctx.evaluateNumber(args[0]), ctx.evaluateNumber(args[1]));
      return [ctx.createStaticNumeric(v)];
    }
    case 'PrimeFactors':
    case 'DivisorsList': {
      const n = ctx.findNumeric(args[0].trim()) ?? ctx.evaluateNumber(args[0]);
      const algo = name === 'PrimeFactors'
        ? new AlgoPrimeFactors(kernel, n)
        : new AlgoDivisorsList(kernel, n);
      const out = algo.getOutput();
      assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
      return [algo, out];
    }
    case 'ToBase': {
      const text = toBase(ctx.evaluateNumber(args[0]), ctx.evaluateNumber(args[1]));
      const geo = new GeoText(kernel, text);
      assignNextLabel(geo, () => construction.getNextPointLabel(existingLabels));
      return [geo];
    }
    case 'FromBase': {
      // FromBase(文本, 底)：文本参数去引号，输出数值（官方语义）
      const raw = args[0].trim().replace(/^"(.*)"$/, '$1');
      return [ctx.createStaticNumeric(fromBase(raw, ctx.evaluateNumber(args[1])))];
    }

    // ---- 圆锥属性拆分族（官方 AlgoAxes 拆分 / Sector）----
    case 'MajorAxis':
    case 'FirstAxis':
    case 'MinorAxis':
    case 'SecondAxis': {
      const conic = ctx.findConic(args[0].trim());
      if (!conic) throw new Error(`Unknown conic "${args[0].trim()}"`);
      const which = (name === 'MajorAxis' || name === 'FirstAxis') ? 'major' : 'minor';
      const algo = new AlgoConicSingleAxis(kernel, conic, which);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'SemiMajorAxisLength':
    case 'SemiMinorAxisLength': {
      const conic = ctx.findConic(args[0].trim());
      if (!conic) throw new Error(`Unknown conic "${args[0].trim()}"`);
      const algo = new AlgoConicSemiAxisLength(kernel, conic, name === 'SemiMajorAxisLength' ? 'major' : 'minor');
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'FirstAxisLength':
    case 'SecondAxisLength': {
      const conic = ctx.findConic(args[0].trim());
      if (!conic) throw new Error(`Unknown conic "${args[0].trim()}"`);
      const algo = new AlgoConicAxisLength(kernel, conic, name === 'FirstAxisLength' ? 'major' : 'minor');
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'LinearEccentricity': {
      const conic = ctx.findConic(args[0].trim());
      if (!conic) throw new Error(`Unknown conic "${args[0].trim()}"`);
      const algo = new AlgoConicLinearEccentricity(kernel, conic);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'Sector': {
      // Sector(circle, A, B)：圆上 A→B 逆时针扇形（官方 CmdCircleArcSector）
      const circle = ctx.findConic(args[0].trim());
      const a = resolvePointArg(ctx, args[1]);
      const b = resolvePointArg(ctx, args[2]);
      if (!circle) throw new Error(`Unknown conic "${args[0].trim()}"`);
      const algo = new AlgoCircleSector(kernel, circle, a, b);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    // ---- 文本命令族（官方 AlgoFractionText / AlgoTableText / ...）----
    case 'FractionText':
    case 'ScientificText': {
      const n = ctx.findNumeric(args[0].trim()) ?? ctx.evaluateNumber(args[0]);
      const algo = name === 'FractionText'
        ? new AlgoFractionText(kernel, n)
        : new AlgoScientificText(kernel, n);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'TableText': {
      const rows = args.map(a => {
        const list = ctx.resolveList(a.trim());
        return list ? list.getChildren() : [];
      });
      if (rows.some(r => r.length === 0)) throw new Error(`TableText expects non-empty lists`);
      const geo = makeText(kernel, tableText(rows));
      assignNextLabel(geo, () => construction.getNextPointLabel(existingLabels));
      existingLabels.add(geo.label);
      construction.addElement(geo);
      return [geo];
    }
    case 'FormulaText':
    case 'Name': {
      const obj = construction.getElements().find(
        el => el instanceof GeoElement && (el as GeoElement).label === args[0].trim()) as GeoElement | undefined;
      if (!obj) throw new Error(`Unknown object "${args[0].trim()}"`);
      const geo = makeText(kernel, name === 'Name' ? nameOf(obj) : formulaText(obj));
      assignNextLabel(geo, () => construction.getNextPointLabel(existingLabels));
      existingLabels.add(geo.label);
      construction.addElement(geo);
      return [geo];
    }
    case 'Split': {
      // Split(text[, delimiters])：文本参数去引号
      const text = args[0].trim().replace(/^"(.*)"$/, '$1');
      const delims = args.length >= 2 ? args[1].trim().replace(/^"(.*)"$/, '$1') : undefined;
      const list = makeTextList(kernel, splitText(text, delims));
      assignNextLabel(list, () => construction.getNextPointLabel(existingLabels));
      existingLabels.add(list.label);
      construction.addElement(list);
      return [list];
    }
    case 'TextToUnicode': {
      const text = args[0].trim().replace(/^"(.*)"$/, '$1');
      const list = makeNumericList(kernel, textToUnicode(text));
      assignNextLabel(list, () => construction.getNextPointLabel(existingLabels));
      existingLabels.add(list.label);
      construction.addElement(list);
      return [list];
    }
    case 'UnicodeToText':
    case 'UnicodeToLetter': {
      // 码点可来自列表或数字字面量
      const list = ctx.resolveList(args[0].trim());
      let text: string;
      if (list) {
        text = unicodeToText(list.getChildren().map(c => (c instanceof GeoNumeric ? c.getValue() : NaN)));
      } else {
        text = unicodeToText(ctx.evaluateNumber(args[0]));
      }
      const geo = makeText(kernel, text);
      assignNextLabel(geo, () => construction.getNextPointLabel(existingLabels));
      existingLabels.add(geo.label);
      construction.addElement(geo);
      return [geo];
    }
    case 'LetterToUnicode': {
      const text = args[0].trim().replace(/^"(.*)"$/, '$1');
      const codes = textToUnicode(text);
      return [ctx.createStaticNumeric(codes.length > 0 ? codes[0] : NaN)];
    }

    // ---- 拟合族（官方 CmdFitExp / CmdFitLineX / ...：点列表活依赖）----
    case 'Fit':
    case 'FitLineY':
    case 'FitLineX':
    case 'FitExp':
    case 'FitGrowth':
    case 'FitLog':
    case 'FitPow': {
      // Fit(list, f) 两参形式 → 通用非线性拟合（官方 CmdFit 的 GeoFunction 分支）
      if (name === 'Fit' && args.length === 2) {
        const points: GeoPoint[] = [];
        const firstArg = args[0].trim();
        const srcList = ctx.resolveList(firstArg);
        if (srcList) {
          points.push(...srcList.getChildren().filter((c): c is GeoPoint => c instanceof GeoPoint));
        } else if (firstArg.startsWith('{') && firstArg.endsWith('}')) {
          for (const label of firstArg.slice(1, -1).split(',')) {
            const p = ctx.findPoint(label.trim());
            if (p) points.push(p);
          }
        }
        const model = ctx.findFunction(args[1].trim());
        if (!model) throw new Error(`Fit expects a list of points and a model function`);
        const general = new AlgoFitGeneral(kernel, points, model, model.variableName || 'x');
        assignNextLabel(general.getOutput(), () => construction.getNextFunctionLabel(existingLabels));
        existingLabels.add(general.getOutput().label);
        return [general, general.getOutput()];
      }
      // 参数：点列表（或直接列点）；点全部入 input（移动点重新拟合）
      const points: GeoPoint[] = [];
      const firstArg = args[0].trim();
      const srcList = ctx.resolveList(firstArg);
      if (srcList) {
        points.push(...srcList.getChildren().filter((c): c is GeoPoint => c instanceof GeoPoint));
      } else if (firstArg.startsWith('{') && firstArg.endsWith('}')) {
        // 内联列表字面量（花括号深度保护后完整到达）：展开标签
        for (const label of firstArg.slice(1, -1).split(',')) {
          const p = ctx.findPoint(label.trim());
          if (p) points.push(p);
        }
      } else {
        for (const arg of args) {
          const p = resolvePointArg(ctx, arg);
          points.push(p);
        }
      }
      if (points.length < 2) throw new Error(`${name} expects at least two points`);
      const algo = ({
        Fit: AlgoFitLineY, FitLineY: AlgoFitLineY, FitLineX: AlgoFitLineX,
        FitExp: AlgoFitExp, FitGrowth: AlgoFitGrowth, FitLog: AlgoFitLog, FitPow: AlgoFitPow,
      } as unknown as typeof AlgoFitExp)[name];
      const fit = new algo(kernel, points);
      const out = fit.getOutput() as unknown as { label?: string };
      assignNextLabel(out as never, () => construction.getNextFunctionLabel(existingLabels));
      existingLabels.add((out as { label?: string }).label ?? '');
      return [fit, ...(fit.getGeoElements() as GeoElement[])];
    }
    // ---- 金融族（官方 TABLE_FINANCIAL：静态求值）----
    case 'FutureValue':
    case 'PresentValue':
    case 'Payment':
    case 'Rate': {
      const nums = args.map(a => ctx.evaluateNumber(a));
      let value: number;
      if (name === 'FutureValue') {
        value = futureValue(nums[0], nums[1], nums[2], nums[3], nums[4] ?? 0);
      } else if (name === 'PresentValue') {
        value = presentValue(nums[0], nums[1], nums[2], nums[3], nums[4] ?? 0);
      } else if (name === 'Payment') {
        value = financePayment(nums[0], nums[1], nums[2], nums[3], nums[4] ?? 0);
      } else {
        value = financeRate(nums[0], nums[1], nums[2], nums[3], nums[4] ?? 0, nums[5] ?? 0.1);
      }
      return [ctx.createStaticNumeric(value)];
    }
    // ---- Function(f, a, b) 限域函数（官方 CmdFunction 三参形）----
    case 'Function': {
      const source = ctx.findFunction(args[0].trim());
      if (!source) throw new Error(`Unknown function "${args[0].trim()}"`);
      const resolveBound = (text: string): GeoNumeric | number => {
        const n = ctx.findNumeric(text.trim());
        return n ?? ctx.evaluateNumber(text);
      };
      const algo = new AlgoFunctionRestricted(kernel, source, resolveBound(args[1]), resolveBound(args[2]));
      assignNextLabel(algo.getOutput(), () => construction.getNextFunctionLabel(existingLabels));
      existingLabels.add(algo.getOutput().label);
      return [algo, algo.getOutput()];
    }

    // ---- 几何度量杂项（官方 AlgoAffineRatio / AlgoCrossRatio / ...）----
    case 'AffineRatio': {
      const p = resolvePointArg(ctx, args[0]);
      const a = resolvePointArg(ctx, args[1]);
      const b = resolvePointArg(ctx, args[2]);
      const algo = new AlgoAffineRatio(kernel, p, a, b);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'CrossRatio': {
      const [a, b, c, d] = args.map(arg => resolvePointArg(ctx, arg));
      const algo = new AlgoCrossRatio(kernel, a, b, c, d);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'Barycenter': {
      // Barycenter(list[, weightsList]) | Barycenter(P1..Pn)
      const first = ctx.resolveList(args[0].trim());
      const lit = /^\{(.*)\}$/.exec(args[0].trim());
      let points: GeoPoint[];
      if (first) {
        points = first.getChildren().filter((c): c is GeoPoint => c instanceof GeoPoint);
      } else if (lit) {
        // 内联列表字面量（花括号感知 splitArgs 后完整到达）
        points = [];
        for (const label of lit[1].split(',')) {
          const pt = ctx.findPoint(label.trim());
          if (pt) points.push(pt);
        }
      } else {
        points = args.map(arg => resolvePointArg(ctx, arg));
      }
      if (points.length === 0) throw new Error(`Barycenter expects points`);
      let weights: GeoNumeric[] = [];
      if (args.length === 2) {
        const wList = ctx.resolveList(args[1].trim());
        if (wList) weights = wList.getChildren().filter((c): c is GeoNumeric => c instanceof GeoNumeric);
      }
      const algo = new AlgoBarycenter(kernel, points, weights);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'AreConcurrent': {
      const lines = args.map(arg => {
        const l = ctx.findLine(arg.trim());
        if (!l) throw new Error(`AreConcurrent expects lines; "${arg.trim()}" is not a line`);
        return l;
      });
      const algo = new AlgoAreConcurrent(kernel, lines[0], lines[1], lines[2]);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'InteriorAngles': {
      const poly = ctx.findPolygon(args[0].trim());
      if (!poly) throw new Error(`InteriorAngles expects a polygon`);
      const algo = new AlgoInteriorAngles(kernel, poly);
      const out = algo.getOutput();
      assignNextLabel(out, () => construction.getNextPointLabel(existingLabels));
      return [algo, out];
    }
    case 'Direction': {
      const line = ctx.findLine(args[0].trim());
      if (!line) throw new Error(`Direction expects a line`);
      const algo = new AlgoDirection(kernel, line);
      assignNextLabel(algo.getOutput(), () => construction.getNextVectorLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'DynamicCoordinates': {
      // DynamicCoordinates(P, xExpr, yExpr)：官方记法 x(P)/y(P) 预处理为变量
      // x_<label>/y_<label>（引用源点坐标，点依赖活更新）
      const source = resolvePointArg(ctx, args[0]);
      const sourceLabel = source.label || 'P';
      const rewrite = (text: string): string => // 负向后行断言（\b 在 '2y' 之间不成立——前后都是词字符）：
      // 只把独立出现的 x(P)/y(P) 改写，max(B)/sin(x(P)) 的尾部不受影响（sin 整体被内建函数层吃掉前 x( 前是 'n'，被断言挡住）
      text.replace(/(?<![A-Za-z_\u0370-\u03FF])([xy])\(\s*([A-Za-z_\u0370-\u03FF][\w\u0370-\u03FF]*)\s*\)/g, '$1_$2');
      const xAst = parseExpression(rewrite(args[1].trim()));
      const yAst = parseExpression(rewrite(args[2].trim()));
      // x_/y_ 前缀变量引用的点 → 活依赖
      const pointDeps: GeoPoint[] = [];
      const seenDeps = new Set<string>();
      for (const ast of [xAst, yAst]) {
        for (const name of collectVariables(ast)) {
          if (!name.startsWith('x_') && !name.startsWith('y_')) continue;
          const label = name.slice(2);
          const pt = construction.getElements().find(
            el => el instanceof GeoPoint && (el as GeoPoint).label === label) as GeoPoint | undefined;
          if (pt && !seenDeps.has(label)) { pointDeps.push(pt); seenDeps.add(label); }
        }
      }
      const coordNames = pointDeps.flatMap(p => [`x_${p.label}`, `y_${p.label}`]);
      const allowed = [sourceLabel, ...coordNames];
      const deps = [...ctx.makeNumericDeps(xAst, allowed), ...ctx.makeNumericDeps(yAst, allowed)];
      const algo = new AlgoDynamicCoordinates(kernel, source, xAst, yAst, deps, pointDeps);
      algo.commandText = `DynamicCoordinates(${args[0].trim()}, ${args[1].trim()}, ${args[2].trim()})`;
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'PathParameter': {
      const p = resolvePointArg(ctx, args[0]);
      const algo = new AlgoPathParameter(kernel, p);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    case 'TriangleCenter': {
      const [a, b, c] = args.slice(0, 3).map(arg => resolvePointArg(ctx, arg));
      const n = ctx.findNumeric(args[3].trim()) ?? ctx.evaluateNumber(args[3]);
      const algo = new AlgoTriangleCenterN(kernel, a, b, c, n);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }
    // ---- 迭代族（官方 AlgoIteration / AlgoIterationList）----
    case 'Iteration':
    case 'IterationList': {
      const f = ctx.findFunction(args[0].trim());
      if (!f) throw new Error(`${name} expects a function`);
      const resolveBound = (text: string): GeoNumeric | number => {
        const n = ctx.findNumeric(text.trim());
        return n ?? ctx.evaluateNumber(text);
      };
      const start = resolveBound(args[1]);
      const n = resolveBound(args[2]);
      const algo = name === 'Iteration'
        ? new AlgoIteration(kernel, f, start, n)
        : new AlgoIterationList(kernel, f, start, n);
      const out = algo.getOutput();
      assignNextLabel(out as never, () => name === 'Iteration'
        ? construction.getNextNumericLabel(existingLabels)
        : construction.getNextPointLabel(existingLabels));
      existingLabels.add(out.label);
      return [algo, out];
    }
    // ---- 非线性拟合（官方 AlgoFit / AlgoFitSin / AlgoFitLogistic）----
    case 'FitSin':
    case 'FitLogistic': {
      const points: GeoPoint[] = [];
      const firstArg = args[0].trim();
      const srcList = ctx.resolveList(firstArg);
      if (srcList) {
        points.push(...srcList.getChildren().filter((c): c is GeoPoint => c instanceof GeoPoint));
      } else if (firstArg.startsWith('{') && firstArg.endsWith('}')) {
        for (const label of firstArg.slice(1, -1).split(',')) {
          const p = ctx.findPoint(label.trim());
          if (p) points.push(p);
        }
      }
      if (points.length < 3) throw new Error(`${name} expects at least three points`);
      const algo = name === 'FitSin'
        ? new AlgoFitSin(kernel, points)
        : new AlgoFitLogistic(kernel, points);
      assignNextLabel(algo.getOutput(), () => construction.getNextFunctionLabel(existingLabels));
      existingLabels.add(algo.getOutput().label);
      return [algo, algo.getOutput()];
    }
    case 'FitGeneral':
    case 'FitTwo': {
      // Fit(list, f)：f 的自由参数自动发现，LM 数值最小二乘
      const points: GeoPoint[] = [];
      const firstArg = args[0].trim();
      const srcList = ctx.resolveList(firstArg);
      if (srcList) {
        points.push(...srcList.getChildren().filter((c): c is GeoPoint => c instanceof GeoPoint));
      } else if (firstArg.startsWith('{') && firstArg.endsWith('}')) {
        for (const label of firstArg.slice(1, -1).split(',')) {
          const p = ctx.findPoint(label.trim());
          if (p) points.push(p);
        }
      }
      const model = ctx.findFunction(args[1].trim());
      if (!model) throw new Error(`Fit expects a list of points and a model function`);
      const mainVar = model.variableName || 'x';
      const algo = new AlgoFitGeneral(kernel, points, model, mainVar);
      assignNextLabel(algo.getOutput(), () => construction.getNextFunctionLabel(existingLabels));
      existingLabels.add(algo.getOutput().label);
      return [algo, algo.getOutput()];
    }

    default:
      // 已登记参数个数但没有实现分支——宁可报错也不要静默返回空对象
      throw new Error(`Command ${name} is not implemented`);
  }
};
