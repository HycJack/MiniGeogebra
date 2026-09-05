export type ExpressionNode =
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'call'; name: string; args: ExpressionNode[] }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: ExpressionNode; right: ExpressionNode }
  | { kind: 'unary'; op: '-'; operand: ExpressionNode };

export type Scope = Map<string, number>;

export function collectVariables(node: ExpressionNode, into = new Set<string>()): Set<string> {
  if (node.kind === 'variable') into.add(node.name);
  if (node.kind === 'call') node.args.forEach(arg => collectVariables(arg, into));
  if (node.kind === 'binary') {
    collectVariables(node.left, into);
    collectVariables(node.right, into);
  }
  if (node.kind === 'unary') collectVariables(node.operand, into);
  return into;
}
