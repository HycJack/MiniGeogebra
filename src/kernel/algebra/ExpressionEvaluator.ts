import { ExpressionNode, Scope } from './ExpressionNode';

const evaluateCall = (name: string, args: number[]): number => {
  switch (name) {
    case 'sin': return Math.sin(args[0]);
    case 'cos': return Math.cos(args[0]);
    case 'tan': return Math.tan(args[0]);
    case 'asin': return Math.asin(args[0]);
    case 'acos': return Math.acos(args[0]);
    case 'atan': return Math.atan(args[0]);
    case 'sqrt': return Math.sqrt(args[0]);
    case 'abs': return Math.abs(args[0]);
    case 'exp': return Math.exp(args[0]);
    case 'ln': return Math.log(args[0]);
    case 'log': return Math.log10(args[0]);
    case 'floor': return Math.floor(args[0]);
    case 'ceil': return Math.ceil(args[0]);
    case 'round': return Math.round(args[0]);
    case 'min': return Math.min(...args);
    case 'max': return Math.max(...args);
    default: return NaN;
  }
};

export function evaluate(node: ExpressionNode, scope: Scope): number {
  switch (node.kind) {
    case 'number': return node.value;
    case 'variable': return scope.get(node.name) ?? NaN;
    case 'call': {
      const args = node.args.map(arg => evaluate(arg, scope));
      return args.some(value => !Number.isFinite(value)) ? NaN : evaluateCall(node.name, args);
    }
    case 'unary': {
      const value = evaluate(node.operand, scope);
      return Number.isFinite(value) ? -value : NaN;
    }
    case 'binary': {
      const left = evaluate(node.left, scope);
      const right = evaluate(node.right, scope);
      if (!Number.isFinite(left) || !Number.isFinite(right)) return NaN;
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right === 0 ? NaN : left / right;
        case '^': return Math.pow(left, right);
      }
    }
  }
}
