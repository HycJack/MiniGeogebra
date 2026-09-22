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
import { InequalityOp } from '../geo/GeoInequality';
import { AlgoPointOnFunction } from '../algo/AlgoPointOnFunction';
import { AlgoPointOnConic } from '../algo/AlgoPointOnConic';
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
import { GeoCircle3D } from '../geo/GeoCircle3D';
import { GeoPolyline3D } from '../geo/GeoPolyline3D';
import { AlgoCircleThreePoints3D, AlgoTranslate3D, AlgoRotatePoint3D, AlgoMirrorPoint3D, AlgoIntersectPathPlanePolyhedron } from '../algo/Algo3DAdvanced';
import { AlgoTransformLine3D, AlgoTransformCircle3D, AlgoTransformPolyhedron3D, AlgoIntersectPlaneQuadric, Transform3DArgs } from '../algo/AlgoTransformGeo3D';
import { AlgoEllipsoid3D } from '../algo/AlgoPolyhedron3D';
import { GeoConic3D } from '../geo/GeoConic3D';
import { AlgoEllipse3D, AlgoHyperbola3D, AlgoIntersectConicPlaneQuadric } from '../algo/AlgoConic3D';
import { GeoNet3D, AlgoPolyhedronNet } from '../algo/AlgoPolyhedronNet';
import { AlgoElement } from '../algo/AlgoElement';
import { interpolatePolynomial } from './Polynomial';
import { AlgoLineTwoPoints } from '../algo/AlgoLineTwoPoints';
import { AlgoSegmentTwoPoints } from '../algo/AlgoSegmentTwoPoints';
import { AlgoRayTwoPoints } from '../algo/AlgoRayTwoPoints';
import { AlgoCircleCenterPoint } from '../algo/AlgoCircleCenterPoint';
import { AlgoCirclePointRadius } from '../algo/AlgoCirclePointRadius';
import { AlgoCircleThreePoints } from '../algo/AlgoCircleThreePoints';
import { AlgoVector } from '../algo/AlgoVector';
import { AlgoMidpoint } from '../algo/AlgoMidpoint';
import { AlgoIntersect } from '../algo/AlgoIntersect';
import { AlgoDistance } from '../algo/AlgoDistance';
import { AlgoSlope } from '../algo/AlgoSlope';
import { AlgoRotate, AlgoDilate, AlgoMirror } from '../algo/AlgoRotate';
import { AlgoFitPoly } from '../algo/AlgoFitPoly';
import { AlgoFunctionRootPoint } from '../algo/AlgoFunctionRootPoint';
import { AlgoRootList, ROOT_LIST_CAPACITY } from '../algo/AlgoRootList';
import { AlgoFunctionExtremumPoint, makeDerivativeEvaluator } from '../algo/AlgoFunctionExtremumPoint';
import { AlgoExtremumList, EXTREMUM_LIST_CAPACITY } from '../algo/AlgoExtremumList';
import { GeoList } from '../geo/GeoList';
import { AlgoText } from '../algo/AlgoText';
import { AlgoAngle, AlgoAngleOriented } from '../algo/AlgoAngle';
import { AlgoPointOnLine } from '../algo/AlgoPointOnLine';
import { AlgoDependentFunction } from '../algo/AlgoDependentFunction';
import { AlgoDependentNumeric } from '../algo/AlgoDependentNumeric';
import { AlgoDerivative } from '../algo/AlgoDerivative';
import { parseExpression } from './ExpressionParser';
import { evaluate } from './ExpressionEvaluator';
import { collectVariables, ExpressionNode, Scope } from './ExpressionNode';
import { differentiate, expressionToString } from './Differentiator';
import { extractPolynomialCoefficients, polynomialRealRoots } from './Polynomial';
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
  PointOnLine: [2, 2],
  Distance: [2, 2],
  Slope: [1, 1],
  Rotate: [2, 3],
  FitPoly: [3, 12],
  Text: [2, 4],
  Angle: [3, 3],
  DirectedAngle: [3, 3],
  Dilate: [2, 3],
  Mirror: [2, 2],
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
  Cylinder3D: [2, 2],
  Cone3D: [2, 2],
  IntersectLineQuadric: [2, 2],
  Prism3D: [4, 4],
  Pyramid3D: [4, 4],
  Volume3D: [1, 1],
  Angle3D: [2, 2],
  // ---- 阶段6：参数曲面 ----
  Surface: [9, 9],
  // ---- 3D 进阶：圆/变换/截面 ----
  Circle3D: [3, 3],
  Translate3D: [4, 4],
  Rotate3D: [3, 3],
  Mirror3D: [2, 2],
  IntersectPath: [2, 2],
  Ellipsoid3D: [4, 4],
  Ellipse3D: [3, 3],
  Hyperbola3D: [3, 3],
  IntersectConic: [2, 2],
  Net: [1, 1],
};

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

export function parseAlgebraInput(
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
    nestedElements.forEach(el => construction.addElement(el));
    construction.updateAllAlgorithms();
    nestedElements.forEach(el => {
      const label = (el as any).label;
      if (label) existingLabels.add(label);
    });
    const outputs = nestedElements.filter(el => !(el instanceof AlgoElement));
    const outLabel = outputs.length === 1 ? (outputs[0] as unknown as { label?: string }).label : undefined;
    if (outputs.length !== 1 || !outLabel) {
      throw new Error(`Command ${m[1]} returns ${outputs.length} objects; nested use needs exactly one`);
    }
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

  /** 生成一个带标签的自由点。 */
  const makeFreePoint = (x: number, y: number): GeoPoint => {
    const point = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
    assignNextLabel(point, () => construction.getNextPointLabel(existingLabels));
    return point;
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
      if (!collectVariables(expression).has('x')) throw new Error('y = ... must depend on x');
      const dependencies = makeNumericDependencies(expression, ['x']);
      const algo = new AlgoDependentFunction(kernel, expression, 'x', rightText, dependencies);
      algo.getOutput().label = construction.getNextFunctionLabel(existingLabels);
      return [algo, algo.getOutput()];
    }

    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(leftText)) {
      if (existingLabels.has(leftText)) throw new Error(`Label "${leftText}" already exists`);

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
    if (minArgs > 0) {
      const rawArgs = splitArgs(commandMatch[2]).filter(arg => arg.length > 0);
      if (rawArgs.length < minArgs || rawArgs.length > maxArgs) {
        throw new Error(`Command ${name} requires ${minArgs === maxArgs ? minArgs : `${minArgs} or ${maxArgs}`} argument${minArgs === 1 ? '' : 's'}`);
      }
      // 先做参数个数校验，再做嵌套展开（展开会把嵌套产物写入构造）
      const args = rawArgs.map(expandNestedCommand);
      return dispatchCommand(name, args, {
        construction, kernel, existingLabels, viewBounds,
        evaluateNumber, resolveNumber, makeFreePoint, assignNextLabel,
        findPoint, findLine, findFunction, findNumeric, findConic, findPolygon, findCurve,
        findPoint3D, findLine3D, findPlane3D, findQuadric3D, findPolyhedron3D, findSurface, findCircle3D, findPolyline3D, findConic3D, findNet3D,
      });
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

/** 给算法输出按类型分配标签（点/线/数值），供属性类命令使用。 */
const assignOutputLabels = (ctx: CommandContext, outputs: GeoElement[]): void => {
  const used = new Set<string>();
  for (const out of outputs) {
    if (out instanceof GeoPoint) {
      ctx.assignNextLabel(out, () => ctx.construction.getNextPointLabel(used));
    } else if (out instanceof GeoLine) {
      ctx.assignNextLabel(out, () => ctx.construction.getNextLineLabel(used));
    } else if (out instanceof GeoNumeric) {
      ctx.assignNextLabel(out, () => ctx.construction.getNextNumericLabel(used));
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

    case 'Intersection': {
      const algo = new AlgoIntersect(kernel, resolveObjectArg(ctx, args[0]), resolveObjectArg(ctx, args[1]));
      algo.compute();
      const points = algo.getOutputPoints().filter(point => point.isDefined());
      if (points.length === 0) throw new Error('The given objects do not intersect');
      return [algo, ...points];
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
        assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      const ux = ctx.evaluateNumber(args[0]);
      const vy = ctx.evaluateNumber(args[1]);
      const vector = new GeoVector(kernel, 0, 0, ux, vy);
      assignNextLabel(vector, () => construction.getNextLineLabel(existingLabels));
      return [vector];
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

    // ---- 变换（活引用：中心/镜轴注册为输入，移动时联动重算）----
    case 'Rotate': {
      const obj = resolveObjectArg(ctx, args[0]);
      const angleDeg = ctx.resolveNumber(args[1]);
      const center = args.length >= 3 ? ctx.findPoint(args[2].trim()) : undefined;
      if (args.length >= 3 && !center) throw new Error(`Unknown point "${args[2].trim()}"`);
      const algo = center
        ? new AlgoRotate(kernel, obj, center, angleDeg * Math.PI / 180)
        : new AlgoRotate(kernel, obj, { x: 0, y: 0 }, angleDeg * Math.PI / 180);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Dilate': {
      const obj = resolveObjectArg(ctx, args[0]);
      const ratio = ctx.resolveNumber(args[1]);
      const center = args.length >= 3 ? ctx.findPoint(args[2].trim()) : undefined;
      if (args.length >= 3 && !center) throw new Error(`Unknown point "${args[2].trim()}"`);
      const algo = center
        ? new AlgoDilate(kernel, obj, center, ratio)
        : new AlgoDilate(kernel, obj, { x: 0, y: 0 }, ratio);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Mirror': {
      const obj = resolveObjectArg(ctx, args[0]);
      const axis = ctx.findLine(args[1].trim());
      if (!axis) throw new Error(`Unknown line "${args[1].trim()}"`);
      const algo = new AlgoMirror(kernel, obj, axis.a, axis.b, axis.c, axis);
      assignNextLabel(algo.getOutput(), () => construction.getNextPointLabel(existingLabels));
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
      const p1 = ctx.findPoint(args[0].trim());
      const apex = ctx.findPoint(args[1].trim());
      const p3 = ctx.findPoint(args[2].trim());
      if (!p1 || !apex || !p3) throw new Error('Angle expects three points (apex second)');
      const algo = new AlgoAngle(kernel, p1, apex, p3);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'DirectedAngle': {
      // 有向角（逆时针 [0, 2π)，对标 GeoGebra Angle 的方向变体）
      const p1 = ctx.findPoint(args[0].trim());
      const apex = ctx.findPoint(args[1].trim());
      const p3 = ctx.findPoint(args[2].trim());
      if (!p1 || !apex || !p3) throw new Error('DirectedAngle expects three points (apex second)');
      const algo = new AlgoAngleOriented(kernel, p1, apex, p3);
      assignNextLabel(algo.getOutput(), () => construction.getNextNumericLabel(existingLabels));
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
        // 兄弟根点算法与输出先入构造（构造序在主算法之前）；
        // 占用的槽点分配标签，空闲槽不给标签（undefined 不显示）。
        for (const rootPoint of algo.getRootPoints()) {
          if (rootPoint.isDefined()) {
            rootPoint.label = construction.getNextPointLabel(existingLabels);
            existingLabels.add(rootPoint.label);
          }
          elements.push(rootPoint);
        }
        for (const rootAlgo of algo.getRootAlgos()) {
          elements.push(rootAlgo);
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
      assignOutputLabels(ctx, algo.getGeoElements());
      return [algo, ...algo.getGeoElements()];
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
      // PointOn(path)：在线/线段/圆锥/函数/曲线上放置约束点
      const label = args[0].trim();
      const line = ctx.findLine(label);
      const conic = ctx.findConic(label);
      const fn = ctx.findFunction(label);
      const curve = ctx.findCurve(label);
      if (!line && !conic && !fn && !curve) throw new Error(`Unknown path "${label}"`);
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
      } else {
        param.setValue(0);
        algo = new AlgoPointOnLine(kernel, line!, param);
      }
      assignNextLabel(algo.getGeoElements()[0], () => construction.getNextPointLabel(existingLabels));
      return [param, algo, ...algo.getGeoElements()];
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
      const region = ctx.findPolygon(args[0].trim()) ?? ctx.findConic(args[0].trim());
      if (!region) throw new Error(`Unknown polygon or conic "${args[0].trim()}"`);
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
      const algo = name === 'Cylinder3D'
        ? new AlgoCylinder3D(kernel, axis, value)
        : new AlgoCone3D(kernel, axis, value * Math.PI / 180);
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
      const pts = args.slice(0, 3).map(a => {
        const p = ctx.findPoint3D(a.trim());
        if (!p) throw new Error(`Unknown 3D point "${a.trim()}"`);
        return p;
      });
      const algo = new AlgoPrism3D(kernel, pts, ctx.resolveNumber(args[3]));
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'Pyramid3D': {
      const pts = args.slice(0, 3).map(a => {
        const p = ctx.findPoint3D(a.trim());
        if (!p) throw new Error(`Unknown 3D point "${a.trim()}"`);
        return p;
      });
      const apex = ctx.findPoint3D(args[3].trim());
      if (!apex) throw new Error(`Unknown 3D point "${args[3].trim()}"`);
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
      const algo = polyhedron
        ? new AlgoIntersectPathPlanePolyhedron(kernel, plane, polyhedron)
        : quadric
          ? new AlgoIntersectPlaneQuadric(kernel, plane, quadric)
          : null;
      if (!algo) throw new Error(`IntersectPath expects a 3D polyhedron or quadric`);
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
      const algo = new AlgoPolyhedronNet(kernel, polyhedron);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    case 'IntersectConic': {
      const plane = ctx.findPlane3D(args[0].trim());
      const quadric = ctx.findQuadric3D(args[1].trim());
      if (!plane || !quadric) throw new Error(`IntersectConic expects a 3D plane and a quadric`);
      const algo = new AlgoIntersectConicPlaneQuadric(kernel, plane, quadric);
      assignNextLabel(algo.getOutput(), () => construction.getNextLineLabel(existingLabels));
      return [algo, algo.getOutput()];
    }

    default:
      // 已登记参数个数但没有实现分支——宁可报错也不要静默返回空对象
      throw new Error(`Command ${name} is not implemented`);
  }
};
