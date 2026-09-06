import { Kernel } from '../core/Kernel';
import type { Construction } from '../core/Construction';
import { ConstructionElement } from '../core/ConstructionElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoLine } from '../geo/GeoLine';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoVector } from '../geo/GeoVector';
import { GeoVec3D } from '../core/GeoVec3D';
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
import { AlgoPointOnLine } from '../algo/AlgoPointOnLine';
import { AlgoDependentFunction } from '../algo/AlgoDependentFunction';
import { AlgoDependentNumeric } from '../algo/AlgoDependentNumeric';
import { AlgoDerivative } from '../algo/AlgoDerivative';
import { parseExpression } from './ExpressionParser';
import { evaluate } from './ExpressionEvaluator';
import { collectVariables, ExpressionNode, Scope } from './ExpressionNode';
import { differentiate, expressionToString } from './Differentiator';
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
  Derivative: [1, 1],
  Root: [1, 3],
  Extremum: [1, 1],
  Integral: [3, 3],
};

/** 只在顶层逗号处切分参数，保留括号内的逗号（`(0, 0), (3, 4)` 切成 2 个而非 4 个）。 */
const splitArgs = (argsText: string): string[] => {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < argsText.length; i++) {
    const char = argsText[i];
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

/** 在顶层 `=` 处切分左右两侧（忽略括号内的 `=`，如 `f(x) = ...`）。 */
const splitAtTopLevelEquals = (input: string): [string, string] | null => {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === '=' && depth === 0) return [input.slice(0, i).trim(), input.slice(i + 1).trim()];
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

export function parseAlgebraInput(kernel: Kernel, input: string): ConstructionElement[] {
  const raw = input.trim();
  if (!raw) throw new Error('Input is empty');
  const construction = kernel.getConstruction();
  const existingLabels = new Set(construction.getElements().map(el => (el as any).label).filter(Boolean));

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

  const findPoint = (label: string): GeoPoint | undefined =>
    construction.getElements().find(el => el instanceof GeoPoint && (el as GeoPoint).label === label) as GeoPoint | undefined;

  const findFunction = (label: string): GeoFunction | undefined =>
    construction.getElements().find(el => el instanceof GeoFunction && (el as GeoFunction).label === label) as GeoFunction | undefined;

  const findLine = (label: string): GeoLine | undefined =>
    construction.getElements().find(el => el instanceof GeoLine && (el as GeoLine).label === label) as GeoLine | undefined;

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

      // 必须先于 parseExpression：否则 `A = (1, 2)` 会因 `(1, 2)` 不是合法算术表达式而抛错，
      // 让坐标元组这条分支永远不可达。
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
  // 命令
  // ------------------------------------------------------------------

  const commandMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/.exec(raw);
  if (commandMatch) {
    const name = commandMatch[1];
    const [minArgs, maxArgs] = COMMAND_ARITY[name] ?? [0, 0];
    if (minArgs > 0) {
      const args = splitArgs(commandMatch[2]).filter(arg => arg.length > 0);
      if (args.length < minArgs || args.length > maxArgs) {
        throw new Error(`Command ${name} requires ${minArgs === maxArgs ? minArgs : `${minArgs} or ${maxArgs}`} argument${minArgs === 1 ? '' : 's'}`);
      }
      return dispatchCommand(name, args, {
        construction, kernel, existingLabels,
        evaluateNumber, resolveNumber, makeFreePoint, assignNextLabel,
        findPoint, findLine, findFunction, findNumeric,
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
  evaluateNumber: (text: string, allowed?: string[]) => number;
  resolveNumber: (text: string) => number;
  makeFreePoint: (x: number, y: number) => GeoPoint;
  assignNextLabel: <T extends { label: string }>(element: T, nextLabel: () => string) => void;
  findPoint: (label: string) => GeoPoint | undefined;
  findLine: (label: string) => GeoLine | undefined;
  findFunction: (label: string) => GeoFunction | undefined;
  findNumeric: (label: string) => GeoNumeric | undefined;
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

const dispatchCommand = (
  name: string,
  args: string[],
  ctx: CommandContext,
): ConstructionElement[] => {
  const { construction, kernel, existingLabels, assignNextLabel } = ctx;

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
      let [lo, hi] = searchRange(-DEFAULT_SEARCH_RANGE, DEFAULT_SEARCH_RANGE);

      if (args.length === 3) {
        [lo, hi] = searchRange(ctx.resolveNumber(args[1]), ctx.resolveNumber(args[2]));
      } else if (args.length === 2) {
        // Root(f, x0)：从 x0 附近开始搜索
        const x0 = ctx.resolveNumber(args[1]);
        [lo, hi] = searchRange(x0 - 1, x0 + 1);
      }

      const roots = findRoots(evaluateAt, lo, hi);
      if (roots.length === 0) throw new Error(`No root found in the range [${lo}, ${hi}]`);
      return [ctx.makeFreePoint(roots[0], 0)];
    }

    case 'Extremum': {
      const fn = ctx.findFunction(args[0].trim());
      if (!fn) throw new Error(`Unknown function "${args[0].trim()}"`);
      const evaluateAt = functionEvaluator(ctx, fn);
      const derivative = (x: number) => {
        const scope: Scope = new Map();
        const source = fn.parentAlgo;
        if (source instanceof AlgoDependentFunction) {
          source.getDependencies().forEach((dependency, index) =>
            scope.set(dependency.label || `dep${index}`, dependency.getValue()));
        }
        return evaluate(differentiate(fn.expression, fn.variableName), new Map([[fn.variableName, x], ...scope]));
      };
      const [lo, hi] = [-DEFAULT_SEARCH_RANGE, DEFAULT_SEARCH_RANGE];
      const hits = findExtrema(evaluateAt, derivative, lo, hi);
      if (hits.length === 0) throw new Error('No extremum found in the given range');
      return hits.map(hit => ctx.makeFreePoint(hit.x, hit.y));
    }

    case 'Integral': {
      const fn = ctx.findFunction(args[0].trim());
      if (!fn) throw new Error(`Unknown function "${args[0].trim()}"`);
      const evaluateAt = functionEvaluator(ctx, fn);
      const a = ctx.resolveNumber(args[1]);
      const b = ctx.resolveNumber(args[2]);
      const result = integrate(evaluateAt, a, b);
      if (!Number.isFinite(result.value)) throw new Error('The integral is not finite in the given range');
      const numeric = new GeoNumeric(kernel, result.value);
      assignNextLabel(numeric, () => construction.getNextNumericLabel(existingLabels));
      numeric.intervalMin = result.value - Math.max(1, Math.abs(result.value));
      numeric.intervalMax = result.value + Math.max(1, Math.abs(result.value));
      return [numeric];
    }

    default:
      // 已登记参数个数但没有实现分支——宁可报错也不要静默返回空对象
      throw new Error(`Command ${name} is not implemented`);
  }
};
