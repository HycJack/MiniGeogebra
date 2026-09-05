import { Kernel } from '../core/Kernel';
import { ConstructionElement } from '../core/ConstructionElement';
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
      const dependencies = makeNumericDependencies(expression);
      if (dependencies.length > 0) {
        const algo = new AlgoDependentNumeric(kernel, expression, dependencies);
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
      const algo = new AlgoDependentNumeric(kernel, expression, numericDependencies);
      algo.getOutput().label = nextLabel;
      return [algo, algo.getOutput()];
    }
    const numeric = new GeoNumeric(kernel, evaluate(expression, new Map()));
    numeric.label = nextLabel;
    return [numeric];
  }
  throw new Error('Unknown variables in expression');
}
