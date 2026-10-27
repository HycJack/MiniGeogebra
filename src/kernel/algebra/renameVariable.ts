/**
 * 表达式变量重命名（对标官方 kernel 统一重写 dependent 定义）：重命名对象时
 * 把所有引用它的表达式 AST 中的旧变量名替换为新名。此前重命名后 `b = a + 1`
 * 的 AST 仍是旧名、求值 scope 按新 label 取值 → NaN 断链。
 *
 * 不可变克隆：返回新树，调用方负责写回各自算法/条件并失效缓存。
 */
import { ExpressionNode } from './ExpressionNode';

export function renameVariableInAst(node: ExpressionNode, from: string, to: string): ExpressionNode {
  if (from === to) return node;
  switch (node.kind) {
    case 'variable':
      return node.name === from ? { ...node, name: to } : node;
    case 'call':
      // 函数调用名也可能是被重命名的用户函数（h(x) = f(x)+1 中 f 改名 g）
      return {
        ...node,
        name: node.name === from ? to : node.name,
        args: node.args.map(a => renameVariableInAst(a, from, to)),
      };
    case 'unary':
      return { ...node, operand: renameVariableInAst(node.operand, from, to) };
    case 'binary':
      return { ...node, left: renameVariableInAst(node.left, from, to), right: renameVariableInAst(node.right, from, to) };
    default:
      return node;
  }
}

/** 表达式是否引用了某变量名（避免无谓写回与采样失效）。 */
export function astUsesVariable(node: ExpressionNode, name: string): boolean {
  switch (node.kind) {
    case 'variable': return node.name === name;
    case 'call': return node.name === name || node.args.some(a => astUsesVariable(a, name));
    case 'unary': return astUsesVariable(node.operand, name);
    case 'binary': return astUsesVariable(node.left, name) || astUsesVariable(node.right, name);
    default: return false;
  }
}
