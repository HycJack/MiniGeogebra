import { Kernel } from '../core/Kernel';
import type { Construction } from '../core/Construction';
import { ConstructionElement } from '../core/ConstructionElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoVector } from '../geo/GeoVector';
import { GeoConic } from '../geo/GeoConic';
import { GeoPolygon } from '../geo/GeoPolygon';
import { GeoText } from '../geo/GeoText';
import { GeoVec3D } from '../core/GeoVec3D';
import { AlgoConicFocus, AlgoConicVertex, AlgoConicAsymptote, AlgoConicDirectrix, AlgoConicAxis, AlgoConicEccentricity, AlgoConicParameter, AlgoConicRadius, AlgoPolarLine, AlgoIsTangent } from '../algo/AlgoConicProperties';
import { AlgoCentroid, AlgoIncenter, AlgoOrthocenter, AlgoIncircle, AlgoAreCollinear, AlgoAreParallel, AlgoArePerpendicular, AlgoAreConcyclic, AlgoAreCongruent } from '../algo/AlgoTriangleCenters';
import { AlgoDependentCurve, AlgoPointOnCurve, AlgoTangentFunctionNumber, AlgoTangentCurve, AlgoCurvature, AlgoOsculatingCircle } from '../algo/AlgoCurveFamily';
import { AlgoPointInRegion, AlgoIsInRegion, AlgoRandomPointIn } from '../algo/AlgoRegion';
import { AlgoDependentInequality } from '../algo/AlgoDependentInequality';
import { AlgoDependentQuadric3D } from '../algo/AlgoDependentQuadric3D';
import { InequalityOp } from '../geo/GeoInequality';
import { AlgoPointOnFunction } from '../algo/AlgoPointOnFunction';
import { AlgoPointOnConic } from '../algo/AlgoPointOnConic';
import { AlgoPointOnLine3D, AlgoPointOnCircle3D, AlgoPointOnConic3D, AlgoPointOnPolyline3D, AlgoPointInPlane3D } from '../algo/AlgoPointOn3D';
import { AlgoTangent } from '../algo/AlgoTangent';
import { GeoCurve } from '../geo/GeoCurve';
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
import { AlgoIntersectFunctions, INTERSECT_FUNCTIONS_CAPACITY } from '../algo/AlgoIntersectFunctions';
import { AlgoPolygonBoolean } from '../algo/AlgoPolygonBoolean';
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
import { AlgoAngleBisector } from '../algo/AlgoAngleBisector';
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
import { GeoSegment } from '../geo/GeoSegment';
import { GeoRay } from '../geo/GeoRay';
import { GeoArc } from '../geo/GeoArc';
import { AlgoFunctionRootPoint } from '../algo/AlgoFunctionRootPoint';
import { AlgoRootList, ROOT_LIST_CAPACITY } from '../algo/AlgoRootList';
import { AlgoFunctionExtremumPoint, makeDerivativeEvaluator } from '../algo/AlgoFunctionExtremumPoint';
import { AlgoExtremumList, EXTREMUM_LIST_CAPACITY } from '../algo/AlgoExtremumList';
import { GeoList } from '../geo/GeoList';
import { AlgoText } from '../algo/AlgoText';
import { AlgoAngle, AlgoAngleOriented, AlgoAngleTwoLines } from '../algo/AlgoAngle';
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
import { parseExpression, withIdentifierHints } from './ExpressionParser';
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
  Vector: [2, 2],
  Midpoint: [2, 2],
  Intersection: [2, 2],
  Intersect: [2, 2],   // GeoGebra 主命令名（Intersection 的别名）
  Shear: [3, 3],
  Stretch: [3, 3],
  PointOnLine: [2, 2],
  Distance: [2, 2],
  Slope: [1, 1],
  Rotate: [2, 3],
  FitPoly: [3, 12],
  Text: [2, 4],
  Angle: [3, 3],
  Slider: [0, 5],
  DirectedAngle: [3, 3],
  Dilate: [2, 3],
  Mirror: [2, 2],
  Translate: [2, 3],
  Derivative: [1, 1],
  Root: [1, 3],
  Extremum: [1, 3],
  Integral: [3, 3],
  // ---- 圆锥曲线解析属性 ----
  Focus: [1, 1],
  Vertex: [1, 1],
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
  PointOn: [1, 1],
  Locus: [2, 2],
  Tangent: [2, 2],
  Curvature: [2, 2],
  OsculatingCircle: [2, 2],
  // ---- 区域 ----
  PointIn: [1, 1],
  IsInRegion: [2, 2],
  RandomPointIn: [1, 1],
  // ---- 插值 ----
  Polynomial: [2, 12],
  // ---- 3D 最小内核 ----
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
  LineBisector: [2, 2],            // PerpendicularBisector 的官方英文名
  AngleBisector: [3, 3],
  AngularBisector: [3, 3],         // AngleBisector 的官方英文名
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
  Reflect: [2, 2],                 // Mirror 的官方英文别名（点/线镜像双形态）
};

/** 全部命令名（字典序）：供输入栏自动补全使用。 */
export const COMMAND_NAMES: string[] = Object.keys(COMMAND_ARITY).sort();

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
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      args.push(argsText.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(argsText.slice(start).trim());
  return args;
};

/** 解析字符串字面量参数（"..." 或 '...'），非字符串返回 null。 */
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

  // A1-8：嵌套命令参数展开（对标 GeoGebra CommandProcessor.resArgs 的递归求值）。
  // 参数本身是已知命令时先递归求值并把产物加入构造，再以输出标签代入外层命令。
  // 例：Midpoint(A, Midpoint(B, C))、Circle(A, Distance(B, C))。
  const MAX_COMMAND_NESTING = 8;
  const expandNestedCommand = (arg: string): string => {
    const trimmed = arg.trim();
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/.exec(trimmed);
    if (!m) return arg;
    const [nestedMin] = COMMAND_ARITY[m[1]] ?? [0, 0];
    if (nestedMin === 0) return arg; // 不是命令（sin、自定义函数调用等），保持原样
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

  const findNumeric = (label: string): GeoNumeric | undefined =>
    construction.getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === label) as GeoNumeric | undefined;

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

  const definition = splitAtTopLevelEquals(raw);
  if (definition) {
    const [leftText, rightText] = definition;
    const functionHeader = parseFunctionHeader(leftText);

    if (functionHeader) {
      if (functionHeader.variableName !== 'x') throw new Error('Only f(x) is supported');
      if (existingLabels.has(functionHeader.label)) throw new Error(`Label "${functionHeader.label}" already exists`);
      const expression = parseExpression(rightText);
      const dependencies = makeNumericDependencies(expression, [functionHeader.variableName]);
      const algo = new AlgoDependentFunction(kernel, expression, functionHeader.variableName, rightText, dependencies);
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

    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(leftText) && leftText !== 'x' && leftText !== 'y') {
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
        if (!isFreeNumeric && !isFreePoint) throw new Error(`Label "${leftText}" already exists`);

        if (isFreeNumeric) {
          // 数值分支：RHS 必须是无依赖的数字（带依赖的升级需要替换对象，暂不支持）
          const newDeps = (() => {
            try {
              const expr = parseExpression(rightText);
              return makeNumericDependencies(expr);
            } catch { return [null as unknown as GeoNumeric]; }
          })();
          if (newDeps === null || newDeps.length > 0) {
            throw new Error(`Cannot redefine "${leftText}" with dependencies; delete dependents of "${leftText}" first`);
          }
          const value = Number(rightText);
          if (!Number.isFinite(value)) throw new Error(`"${rightText}" is not a number`);
          (existing as GeoNumeric).setValue(value);
          construction.updateDependentAlgorithms(existing as GeoElement);
          // 空数组 = 已原位更新（对象已在构造中），调用方无需再 addElement
          return [];
        }
        // 自由点分支：新 RHS 必须是坐标元组（原位 setCoords）
        const point3 = tryParseCoordTuple3(rightText, kernel);
        const coordPoint = point3 ? null : tryParseCoordTuple(rightText, kernel);
        const np = point3 ?? coordPoint;
        if (!np) throw new Error(`Cannot redefine "${leftText}" with "${rightText}": expected (x, y) coordinates`);
        np.label = leftText;
        const ep = existing as GeoPoint;
        ep.setCoords(np.getX(), np.getY(), np.getZ?.() ?? 1);
        construction.updateDependentAlgorithms(ep);
        return []; // 同上：原位更新
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
      const dependencies = makeNumericDependencies(expression);
      if (dependencies.length > 0) {
        const algo = new AlgoDependentNumeric(kernel, expression, dependencies, rightText);
        algo.getOutput().label = leftText;
        return [algo, algo.getOutput()];
      }
      const value = Number(rightText);
      if (Number.isFinite(value)) {
        const numeric = new GeoNumeric(kernel, value);
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
    const items = splitArgs(listMatch[1]).filter(arg => arg.length > 0);
    if (items.length === 0) throw new Error('Empty list');
    const children: GeoElement[] = [];
    for (const item of items) {
      const label = item.trim();
      const found = construction.getElements().find(
        el => el instanceof GeoElement && (el as unknown as { label?: string }).label === label);
      if (!found) throw new Error(`Unknown object "${label}" in list`);
      children.push(found as GeoElement);
    }
    const list = new GeoList(kernel, children);
    list.label = construction.getNextPointLabel(existingLabels);
    existingLabels.add(list.label);
    return [list];
  }

  const commandMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/.exec(raw);
  if (commandMatch) {
    const name = commandMatch[1];
    const [minArgs, maxArgs] = COMMAND_ARITY[name] ?? [0, 0];
    // 无参命令（如 Slider()）也要走命令分发：识别器有该命令的名字即进入，
    // 否则 `Slider()` 会被当成对未知函数的调用报错。
    if (name in COMMAND_ARITY) {
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
      const dispatched = dispatchCommand(name, args, {
        construction, kernel, existingLabels, viewBounds,
        evaluateNumber, resolveNumber, makeFreePoint, assignNextLabel,
        findPoint, findLine, findFunction, findNumeric, findConic, findPolygon, findCurve,
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
  if (variables.size === 0 || numericDependencies.length > 0) {
    if (numericDependencies.length > 0) {
      const algo = new AlgoDependentNumeric(kernel, expression, numericDependencies, raw);
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

/** 取函数在其驱动数字作用域下的求值闭包（`f(x) = a*x` 需要带上 `a`）。 */
const functionEvaluator = (ctx: CommandContext, fn: GeoFunction): (x: number) => number => {
  const source = fn.parentAlgo;
  const dependencies: GeoNumeric[] = source instanceof AlgoDependentFunction ? source.getDependencies() : [];
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

const dispatchCommand = (
  name: string,
  args: string[],
  ctx: CommandContext,
): ConstructionElement[] => {
  const { construction, kernel, existingLabels, assignNextLabel, viewBounds } = ctx;

  switch (name) {
    // ---- 点 ----
    case 'Point': {
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
      const algo = new AlgoMidpoint(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]));
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Intersection':
    case 'Intersect': {
      // 多边形 × 多边形 → 布尔交（GeoGebra AlgoPolygonOperation.INTERSECTION）
      const polyA = ctx.findPolygon(args[0].trim());
      const polyB = ctx.findPolygon(args[1].trim());
      if (polyA && polyB) {
        const algo = new AlgoPolygonBoolean(kernel, polyA, polyB, 'intersection');
        assignOutputLabels(ctx, [algo.getOutput()]);
        return [algo, algo.getOutput()];
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
      if (points.length === 0) throw new Error('The given objects do not intersect');
      return [algo, ...points];
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
      const algo = new AlgoSegmentTwoPoints(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]));
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
      const algo = new AlgoPerpendicularBisector(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'AngleBisector':
    case 'AngularBisector': {
      // 三点角平分线（顶点为第二点）；两直线版本官方另有，此处先接三点形态
      const algo = new AlgoAngleBisector(
        kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    // ---- 圆锥曲线（命令面补齐）----
    case 'Ellipse':
    case 'Hyperbola': {
      const algo = name === 'Ellipse'
        ? new AlgoEllipse(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]))
        : new AlgoHyperbola(kernel, resolvePointArg(ctx, args[0]), resolvePointArg(ctx, args[1]), resolvePointArg(ctx, args[2]));
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
      // Arc(C, A, B)：C 为圆（派生其圆心点，保持活依赖）或圆心点；A/B 为起止弧点
      const circleArg = ctx.findConic(args[0].trim());
      if (circleArg) {
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
      // Length(segment) 线段长；Length(polygon) 周长；Length(P) 点到原点距离
      const label = args[0].trim();
      const polygon = ctx.findPolygon(label);
      if (polygon) {
        const algo = new AlgoPerimeter(kernel, polygon);
        algo.getOutput().label = construction.getNextNumericLabel(existingLabels);
        existingLabels.add(algo.getOutput().label);
        return [algo, algo.getOutput()];
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
      throw new Error(`Length expects a segment, polygon or point; "${label}" is none of them`);
    }

    case 'Perimeter': {
      const polygon = ctx.findPolygon(args[0].trim());
      if (!polygon) throw new Error(`Unknown polygon "${args[0].trim()}"`);
      const algo = new AlgoPerimeter(kernel, polygon);
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
      const line = ctx.findLine(args[0].trim());
      if (!line) throw new Error(`Unknown line "${args[0].trim()}"`);
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
      // Slider() —— 匿名滑块（默认区间 [0, 10]，值 5，标签自动分配）
      // Slider(n) —— 绑定已有数值 n（为其设置动画区间，返回 n 本身）
      // Slider(name, min, max[, step[, value]]) —— 创建命名滑块
      // 全部产出内核 GeoNumeric：代数视图行内滑块 / 底部动画面板立即可用。
      const num = (text: string) => ctx.resolveNumber(text);
      if (args.length === 0) {
        const slider = new GeoNumeric(kernel, 5);
        slider.intervalMin = 0;
        slider.intervalMax = 10;
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
        // 返回的是构造中已有的对象：空数组哨兵（同 B12 重定义），
        // 避免调用方 addElement 把同一对象重复入列表。
        return [];
      }
      const min = num(args[0]);
      const max = num(args[1]);
      if (!(max > min)) throw new Error('Slider expects max > min');
      const step = args.length >= 3 ? num(args[2]) : (max - min) / 100;
      const value = args.length >= 4 ? num(args[3]) : min + (max - min) / 2;
      const slider = new GeoNumeric(kernel, value);
      slider.intervalMin = min;
      slider.intervalMax = max;
      if (step > 0) slider.animationIncrement = step;
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
      // 列表参数可能被顶层逗号切碎（{P1, P2, P3} → "{P1" / "P2" / "P3}"）：
      // 仅当参数以 "{" 开头时进入拼接模式，直到收到带 "}" 的片段。
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
      const source = fn.parentAlgo;
      // 有驱动数字的依赖函数走算法路径，滑块变动才会传导到导函数
      if (source instanceof AlgoDependentFunction) {
        const algo = new AlgoDerivative(kernel, source);
        assignNextLabel(algo.getOutput(), () => construction.getNextFunctionLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      // 自由函数：直接对 AST 求导，生成一个新的自由函数
      const derivative = differentiate(fn.expression, fn.variableName);
      const result = new GeoFunction(
        kernel, derivative, fn.variableName, expressionToString(derivative));
      assignNextLabel(result, () => construction.getNextFunctionLabel(existingLabels));
      return [result];
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
      const result = integrate(evaluateAt, a, b);
      if (!Number.isFinite(result.value) || !result.converged) {
        throw new Error('The integral is not finite or did not converge in the given range');
      }
      const numeric = new GeoNumeric(kernel, result.value);
      assignNextLabel(numeric, () => construction.getNextNumericLabel(existingLabels));
      numeric.intervalMin = result.value - Math.max(1, Math.abs(result.value));
      numeric.intervalMax = result.value + Math.max(1, Math.abs(result.value));
      return [numeric];
    }

    case 'Focus':
    case 'Vertex':
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
      }[name] as typeof AlgoConicFocus)(kernel, conic);
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
      const poly = new GeoPolygon(kernel, pts);
      poly.label = ctx.construction.getNextPolygonLabel(ctx.existingLabels);
      return [poly];
    }

    case 'TaylorSeries': {
      const fn = ctx.findFunction(args[0].trim());
      if (!fn) throw new Error(`Unknown function "${args[0].trim()}"`);
      const order = Math.round(ctx.resolveNumber(args[1]));
      if (!Number.isInteger(order) || order < 0 || order > 12) {
        throw new Error('TaylorSeries order must be an integer between 0 and 12');
      }
      const center = args.length === 3 ? ctx.resolveNumber(args[2]) : 0;

      const source = fn.parentAlgo;
      const scope: Scope = new Map();
      if (source instanceof AlgoDependentFunction) {
        source.getDependencies().forEach((dependency, index) =>
          scope.set(dependency.label || `dep${index}`, dependency.getValue()));
      }

      // 逐阶求导并在展开点求值，系数按二项式展开合并到 x 的幂上
      const total: number[] = new Array(order + 1).fill(0);
      let expression = fn.expression;
      for (let k = 0; k <= order; k++) {
        const value = evaluate(expression, new Map([[fn.variableName, center], ...scope]));
        if (!Number.isFinite(value)) throw new Error(`f^( ${k} ) is not finite at x = ${center}`);
        const coeff = value / factorial(k);
        for (let j = 0; j <= k; j++) {
          total[j] += coeff * binomial(k, j) * Math.pow(-center, k - j);
        }
        expression = differentiate(expression, fn.variableName);
      }

      const ast = polynomialToAst(total, fn.variableName);
      const text = expressionToString(ast);
      const algo = new AlgoDependentFunction(kernel, ast, fn.variableName, text, []);
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
      // PointOn(path)：在线/线段/射线/弧/圆锥/函数/曲线上放置约束点（含 3D path，C10）
      const label = args[0].trim();
      const line = ctx.findLine(label);
      const conic = ctx.findConic(label);
      const fn = ctx.findFunction(label);
      const curve = ctx.findCurve(label);
      const ray = construction.getElements().find(el => el instanceof GeoRay && (el as GeoRay).label === label) as GeoRay | undefined;
      const arc = construction.getElements().find(el => el instanceof GeoArc && (el as GeoArc).label === label) as GeoArc | undefined;
      const line3 = ctx.findLine3D(label);
      const circle3 = ctx.findCircle3D(label);
      const conic3 = ctx.findConic3D(label);
      const poly3 = ctx.findPolyline3D(label);
      if (!line && !conic && !fn && !curve && !ray && !arc && !line3 && !circle3 && !conic3 && !poly3) {
        throw new Error(`Unknown path "${label}"`);
      }
      const param = new GeoNumeric(kernel, 0);
      param.label = construction.getNextNumericLabel(existingLabels);
      existingLabels.add(param.label);
      let algo: AlgoElement;
      if (curve) {
        param.setValue((curve.getMinParameter() + curve.getMaxParameter()) / 2);
        algo = new AlgoPointOnCurve(kernel, curve, param);
      } else if (fn) {
        param.setValue(0);
        algo = new AlgoPointOnFunction(kernel, fn, param);
      } else if (conic) {
        param.setValue(0);
        algo = new AlgoPointOnConic(kernel, conic, param);
      } else if (line3) {
        param.setValue(0.5);
        algo = new AlgoPointOnLine3D(kernel, line3, param);
      } else if (circle3) {
        param.setValue(0);
        algo = new AlgoPointOnCircle3D(kernel, circle3, param);
      } else if (conic3) {
        param.setValue(0);
        algo = new AlgoPointOnConic3D(kernel, conic3, param);
      } else if (poly3) {
        param.setValue(0);
        algo = new AlgoPointOnPolyline3D(kernel, poly3, param);
      } else if (ray) {
        param.setValue(1);
        algo = new AlgoPointOnRay(kernel, ray, param);
      } else if (arc) {
        param.setValue((arc.getStartAngle() + arc.getEndAngle()) / 2);
        algo = new AlgoPointOnArc(kernel, arc, param);
      } else if (line instanceof GeoSegment) {
        // findLine 按 GeoLine 匹配，线段会落进这里——必须用段参数 [0,1] 的专用算法
        param.setValue(0.5);
        algo = new AlgoPointOnSegment(kernel, line, param);
      } else {
        param.setValue(0);
        algo = new AlgoPointOnLine(kernel, line!, param);
      }
      assignNextLabel(algo.getGeoElements()[0], () => construction.getNextPointLabel(existingLabels));
      // 点在前、param 在后：`P = PointOn(s)` 的 LHS 标签按"第一个非算法 Geo 元素"
      // 分配，param 在前会把标签抢走（点反而拿自动标签）
      return [...algo.getGeoElements(), param, algo];
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
      throw new Error(`Locus expects (tracer, driver) points in 2D or 3D`);
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
      // Tangent(P, conic)：过点作圆锥曲线的切线（极线法）
      const point = ctx.findPoint(target);
      const conic = ctx.findConic(args[1].trim());
      if (point && conic) {
        const algo = new AlgoTangent(kernel, conic, point);
        assignOutputLabels(ctx, algo.getGeoElements());
        return [algo, ...algo.getGeoElements()];
      }
      throw new Error(`Tangent expects (function|curve, number) or (point, conic)`);
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
      const b = ctx.findPoint3D(args[1].trim());
      if (!a || !b) throw new Error(`Line3D expects two 3D points`);
      const algo = new AlgoJoinPoints3D(kernel, a, b, name === 'Segment3D');
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Midpoint3D': {
      const a = ctx.findPoint3D(args[0].trim());
      const b = ctx.findPoint3D(args[1].trim());
      if (!a || !b) throw new Error(`Midpoint3D expects two 3D points`);
      const algo = new AlgoMidpoint3D(kernel, a, b);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Plane3D': {
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
      const plane = ctx.findPlane3D(args[1].trim());
      if (!point || !plane) throw new Error(`Distance3D expects a 3D point and a 3D plane`);
      const algo = new AlgoDistancePointPlane3D(kernel, point, plane);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Sphere3D': {
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
    case 'Cone3D': {
      const axis = ctx.findLine3D(args[0].trim());
      if (!axis) throw new Error(`Unknown 3D line "${args[0].trim()}"`);
      const value = ctx.resolveNumber(args[1]);
      // 第三参可选：有限高（数或活滑块）；缺省 → 无限
      let height: number | GeoNumeric | null = null;
      if (args.length >= 3) {
        const hText = args[2].trim();
        height = ctx.findNumeric(hText) ?? ctx.resolveNumber(hText);
      }
      const algo = name === 'Cylinder3D'
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

    case 'Prism3D': {
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

    case 'Pyramid3D': {
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

    case 'Volume3D': {
      const quadric = ctx.findQuadric3D(args[0].trim());
      const polyhedron = ctx.findPolyhedron3D(args[0].trim());
      const target = quadric ?? polyhedron;
      if (!target) throw new Error(`Unknown quadric or polyhedron "${args[0].trim()}"`);
      const algo = new AlgoVolume3D(kernel, target);
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
    }

    case 'Angle3D': {
      const l1 = ctx.findLine3D(args[0].trim());
      const l2 = ctx.findLine3D(args[1].trim());
      const p1 = ctx.findPlane3D(args[0].trim());
      const p2 = ctx.findPlane3D(args[1].trim());
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

    default:
      // 已登记参数个数但没有实现分支——宁可报错也不要静默返回空对象
      throw new Error(`Command ${name} is not implemented`);
  }
};
