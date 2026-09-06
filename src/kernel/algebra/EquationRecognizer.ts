import { Kernel } from '../core/Kernel';
import { ConstructionElement } from '../core/ConstructionElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';
import { AlgoLineTwoPoints } from '../algo/AlgoLineTwoPoints';
import { AlgoSegmentTwoPoints } from '../algo/AlgoSegmentTwoPoints';
import { AlgoRayTwoPoints } from '../algo/AlgoRayTwoPoints';
import { AlgoCircleCenterPoint } from '../algo/AlgoCircleCenterPoint';
import { AlgoVector } from '../algo/AlgoVector';
import { GeoNumeric } from '../geo/GeoNumeric';
import { parseExpression } from './ExpressionParser';
import { evaluate } from './ExpressionEvaluator';
import { collectVariables, ExpressionNode } from './ExpressionNode';
import { AlgoDependentFunction } from '../algo/AlgoDependentFunction';
import { AlgoDependentNumeric } from '../algo/AlgoDependentNumeric';

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

const COMMAND_ARITY: Record<string, number> = {
  Point: 2,
  Line: 2,
  Segment: 2,
  Ray: 2,
  Circle: 2,
  Vector: 2,
};

const assignNextLabel = <T extends { label: string }>(element: T, labels: Set<string>, nextLabel: () => string): void => {
  if (!element.label) element.label = nextLabel();
  labels.add(element.label);
};

/** Parse a coordinate tuple string "(x,y)" into a GeoPoint, or return null. */
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

  const makeNumericDependencies = (expression: ExpressionNode, allowedVariables: string[] = []): GeoNumeric[] => {
    const variables = collectVariables(expression);
    return Array.from(variables).map(name => {
      if (allowedVariables.includes(name)) return null;
      const dependency = construction.getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === name);
      if (!dependency) throw new Error(`Unknown variable "${name}"`);
      return dependency as GeoNumeric;
    }).filter((dependency): dependency is GeoNumeric => dependency !== null);
  };

  const definition = splitAtTopLevelEquals(raw);
  if (definition) {
    const [leftText, rightText] = definition;
    const functionHeader = parseFunctionHeader(leftText);
    const expression = parseExpression(rightText);

    if (functionHeader) {
      if (functionHeader.variableName !== 'x') throw new Error('Only f(x) is supported');
      if (existingLabels.has(functionHeader.label)) throw new Error(`Label "${functionHeader.label}" already exists`);
      const dependencies = makeNumericDependencies(expression, [functionHeader.variableName]);
      const algo = new AlgoDependentFunction(kernel, expression, functionHeader.variableName, rightText, dependencies);
      algo.getOutput().label = functionHeader.label;
      return [algo, algo.getOutput()];
    }

    if (leftText === 'y' && collectVariables(expression).has('x')) {
      const dependencies = makeNumericDependencies(expression, ['x']);
      const nextLabel = construction.getNextFunctionLabel(existingLabels);
      const algo = new AlgoDependentFunction(kernel, expression, 'x', rightText, dependencies);
      algo.getOutput().label = nextLabel;
      return [algo, algo.getOutput()];
    }

    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(leftText)) {
      if (existingLabels.has(leftText)) throw new Error(`Label "${leftText}" already exists`);

      // Bug fix: A=(x,y) — detect coordinate tuple before parseExpression
      const coordPoint = tryParseCoordTuple(rightText, kernel);
      if (coordPoint) {
        coordPoint.label = leftText;
        return [coordPoint];
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

    throw new Error('Definitions must use f(x), y, or a numeric label');
  }

  // GeoGebra-style command input: Point(x,y), Segment(A,B), Circle(A,B), Line(A,B), etc.
  const commandMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/.exec(raw);
  if (commandMatch && COMMAND_ARITY[commandMatch[1]]) {
    const name = commandMatch[1];
    const argsText = commandMatch[2].trim();
    if (!argsText) throw new Error(`Command ${name} requires ${COMMAND_ARITY[name]} arguments`);
    const args = argsText.split(/\s*,\s*/);
    if (args.length !== COMMAND_ARITY[name]) {
      throw new Error(`Command ${name} requires ${COMMAND_ARITY[name]} arguments`);
    }

    // Bug fix: Point(x,y) — arguments are numeric expressions, not point labels.
    // Handle this before the common point-parsing loop which would fail on bare numbers.
    if (name === 'Point') {
      const px = evaluate(parseExpression(args[0]), new Map());
      const py = evaluate(parseExpression(args[1]), new Map());
      if (!Number.isFinite(px) || !Number.isFinite(py)) throw new Error('Invalid coordinate');
      const point = new GeoPoint(kernel, new GeoVec3D(px, py, 1));
      assignNextLabel(point, existingLabels, () => construction.getNextPointLabel(existingLabels));
      return [point];
    }

    // For Line/Segment/Ray/Circle/Vector, resolve args to existing points or inline coordinates.
    const points: GeoPoint[] = args.map(argText => {
      const coordinate = /^\(([^,]+),([^,]+)\)$/.exec(argText.trim());
      if (coordinate) {
        const x = evaluate(parseExpression(coordinate[1].trim()), new Map());
        const y = evaluate(parseExpression(coordinate[2].trim()), new Map());
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid coordinate');
        const point = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
        assignNextLabel(point, existingLabels, () => construction.getNextPointLabel(existingLabels));
        return point;
      }
      const label = argText.trim();
      const point = construction.getElements().find(
        el => el instanceof GeoPoint && (el as GeoPoint).label === label,
      );
      if (!point) throw new Error(`Unknown point "${label}"`);
      return point as GeoPoint;
    });

    switch (name) {
      case 'Line': {
        const algo = new AlgoLineTwoPoints(kernel, points[0], points[1]);
        assignNextLabel(algo.getOutput(), existingLabels, () => construction.getNextLineLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      case 'Segment': {
        const algo = new AlgoSegmentTwoPoints(kernel, points[0], points[1]);
        assignNextLabel(algo.getOutput(), existingLabels, () => construction.getNextLineLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      case 'Ray': {
        const algo = new AlgoRayTwoPoints(kernel, points[0], points[1]);
        assignNextLabel(algo.getOutput(), existingLabels, () => construction.getNextLineLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      case 'Circle': {
        const algo = new AlgoCircleCenterPoint(kernel, points[0], points[1]);
        assignNextLabel(algo.getOutput(), existingLabels, () => construction.getNextCircleLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
      case 'Vector': {
        const algo = new AlgoVector(kernel, points[0], points[1]);
        assignNextLabel(algo.getOutput(), existingLabels, () => construction.getNextLineLabel(existingLabels));
        return [algo, algo.getOutput()];
      }
    }
  }

  const expression = parseExpression(raw);
  const variables = collectVariables(expression);
  const numericDependencies = makeNumericDependencies(expression, ['x', 'y']);
  if (variables.has('x')) {
    const nextLabel = construction.getNextFunctionLabel(existingLabels);
    const algo = new AlgoDependentFunction(kernel, expression, 'x', raw, numericDependencies);
    algo.getOutput().label = nextLabel;
    return [algo, algo.getOutput()];
  }
  if (variables.size === 0 || numericDependencies.length > 0) {
    const nextLabel = construction.getNextNumericLabel(existingLabels);
    if (numericDependencies.length > 0) {
        const algo = new AlgoDependentNumeric(kernel, expression, numericDependencies, raw);
      algo.getOutput().label = nextLabel;
      return [algo, algo.getOutput()];
    }
    const numeric = new GeoNumeric(kernel, evaluate(expression, new Map()));
    numeric.label = nextLabel;
    return [numeric];
  }
  throw new Error('Unknown variables in expression');
}
