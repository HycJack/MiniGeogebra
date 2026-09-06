import { ExpressionNode } from './ExpressionNode';

/**
 * AST 符号微分 + 表达式文本化。
 *
 * 两个纯函数，不接触 kernel / 几何对象：
 *   - `differentiate(node, variableName)`：对 `variableName` 求导，其余变量视为常数；
 *   - `expressionToString(node)`：把 AST 还原成可读且可被 `parseExpression` 再次解析的文本。
 *
 * 与 ExpressionEvaluator 的约定保持一致：`log` 是以 10 为底的对数，`ln` 是自然对数，
 * 因此 d/dx log(a) = 1/(a * ln(10))。
 *
 * 幂法则一律使用通用式 a^b * (d(b)*ln(a) + b*d(a)/a)，
 * 指数为常数时它解析地退化为 b * a^(b-1) * d(a)。
 */

const num = (value: number): ExpressionNode => ({ kind: 'number', value });
const add = (left: ExpressionNode, right: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '+', left, right });
const sub = (left: ExpressionNode, right: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '-', left, right });
const mul = (left: ExpressionNode, right: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '*', left, right });
const div = (left: ExpressionNode, right: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '/', left, right });
const pow = (left: ExpressionNode, right: ExpressionNode): ExpressionNode => ({ kind: 'binary', op: '^', left, right });
const negate = (operand: ExpressionNode): ExpressionNode => ({ kind: 'unary', op: '-', operand });
const call = (name: string, ...args: ExpressionNode[]): ExpressionNode => ({ kind: 'call', name, args });

/**
 * 常数折叠 / 零元消去（自底向上）。
 *
 * 这一步很关键：通用幂法则里含 `d(b) * ln(a)` 项，当指数是常数时 d(b) === 0。
 * 若保留 `0 * ln(a)`，求值时 `ln(a)` 在 a <= 0 处为 NaN，而本引擎的乘法是严格短路
 * （任一操作数非有限即返回 NaN），于是 0 * NaN 会得到 NaN 而非 0，
 * 使 `x^3` 这类导数在整个负半轴失效（Extremum 因此找不到 x = -1 处的极大值）。
 * 0 * g ≡ 0 对 g 的无定义处同样成立，故此处直接消去该项是解析安全的。
 */
const simplify = (node: ExpressionNode): ExpressionNode => {
  if (node.kind === 'number' || node.kind === 'variable') return node;

  if (node.kind === 'call') {
    const args = node.args.map(simplify);
    const unchanged = args.every((arg, index) => arg === node.args[index]);
    return unchanged ? node : { kind: 'call', name: node.name, args };
  }

  if (node.kind === 'unary') {
    const operand = simplify(node.operand);
    if (operand.kind === 'unary') return operand.operand;
    if (operand.kind === 'number') return num(-operand.value);
    return negate(operand);
  }

  const left = simplify(node.left);
  const right = simplify(node.right);

  if (node.op === '+' || node.op === '-') {
    if (left.kind === 'number' && right.kind === 'number') {
      return num(node.op === '+' ? left.value + right.value : left.value - right.value);
    }
    if (left.kind === 'number' && left.value === 0) return node.op === '+' ? right : negate(right);
    if (right.kind === 'number' && right.value === 0) return left;
  } else if (node.op === '*') {
    if (left.kind === 'number' && right.kind === 'number') return num(left.value * right.value);
    if (left.kind === 'number') {
      if (left.value === 0) return num(0);
      if (left.value === 1) return right;
      if (left.value === -1) return negate(right);
    }
    if (right.kind === 'number') {
      if (right.value === 0) return num(0);
      if (right.value === 1) return left;
    }
  } else if (node.op === '/') {
    if (left.kind === 'number' && right.kind === 'number') return num(left.value / right.value);
    if (right.kind === 'number' && right.value === 1) return left;
  } else {
    if (left.kind === 'number' && right.kind === 'number') return num(Math.pow(left.value, right.value));
    if (right.kind === 'number' && right.value === 0) return num(1);
    if (right.kind === 'number' && right.value === 1) return left;
  }

  return { kind: 'binary', op: node.op, left, right };
};

/** 对 `variableName` 做符号微分。 */
export function differentiate(node: ExpressionNode, variableName: string): ExpressionNode {
  const visit = (expression: ExpressionNode): ExpressionNode => {
    switch (expression.kind) {
      case 'number':
        return num(0);

      case 'variable':
        return num(expression.name === variableName ? 1 : 0);

      case 'unary':
        return simplify(negate(visit(expression.operand)));

      case 'binary': {
        const left = expression.left;
        const right = expression.right;
        const dLeft = visit(left);
        const dRight = visit(right);

        switch (expression.op) {
          case '+':
            return simplify(add(dLeft, dRight));
          case '-':
            return simplify(sub(dLeft, dRight));
          case '*': // 乘积法则
            return simplify(add(mul(dLeft, right), mul(left, dRight)));
          case '/': // 商法则
            return simplify(div(sub(mul(dLeft, right), mul(left, dRight)), mul(right, right)));
          case '^':
            // 指数为常数时用退化式 b*a^(b-1)*d(a)：通用式 a^b*(b/a) 在 a = 0
            // 处为 0*(b/0) = NaN，会让 d/dx x^n 在 x = 0 失效（GeoGebra 此处为 0）。
            if (dRight.kind === 'number' && dRight.value === 0) {
              return simplify(mul(right, mul(pow(left, sub(right, num(1))), dLeft)));
            }
            return simplify(mul(
              pow(left, right),
              add(mul(dRight, call('ln', left)), div(mul(right, dLeft), left)),
            ));
        }
        break;
      }

      case 'call': {
        const argument = expression.args[0];
        if (argument === undefined) return num(0);
        const dArgument = visit(argument);

        switch (expression.name) {
          case 'sin': return simplify(mul(call('cos', argument), dArgument));
          case 'cos': return simplify(mul(negate(call('sin', argument)), dArgument));
          case 'tan': return simplify(mul(div(num(1), mul(call('cos', argument), call('cos', argument))), dArgument));
          case 'asin': return simplify(mul(div(num(1), call('sqrt', sub(num(1), mul(argument, argument)))), dArgument));
          case 'acos': return simplify(mul(negate(div(num(1), call('sqrt', sub(num(1), mul(argument, argument))))), dArgument));
          case 'atan': return simplify(mul(div(num(1), add(num(1), mul(argument, argument))), dArgument));
          case 'sqrt': return simplify(mul(div(num(1), mul(num(2), call('sqrt', argument))), dArgument));
          case 'exp': return simplify(mul(call('exp', argument), dArgument));
          case 'ln': return simplify(mul(div(num(1), argument), dArgument));
          case 'log': return simplify(mul(div(num(1), mul(argument, call('ln', num(10)))), dArgument));
          case 'abs': return simplify(mul(div(argument, call('abs', argument)), dArgument));
          case 'floor':
          case 'ceil':
          case 'round':
          case 'min':
          case 'max':
            return num(0);
          default:
            return num(0);
        }
      }
    }

    // 该分支在类型系统上不可达（上面的 switch 已穷尽全部 kind），
    // 保留它作为运行时兑底，因此需要一次显式收窄才能访问 .kind。
    throw new Error(
      `Cannot differentiate node kind "${(expression as ExpressionNode).kind}"`,
    );
  };

  return visit(node);
}

// ---------------------------------------------------------------------------
// 表达式文本化
// ---------------------------------------------------------------------------

/** 二元运算符优先级（数字越大结合越紧）。 */
const BINARY_PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 } as const;
/** 一元负号优先级：紧于 * /，松于 ^。 */
const UNARY_PRECEDENCE = 3;
/** 原子（数字 / 变量 / 函数调用）优先级。 */
const ATOM_PRECEDENCE = 6;

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  // 去掉浮点尾部噪声（2.0000000000000004 → "2"），只保留 10 位小数。
  return value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
};

/**
 * 把 AST 渲染成可读表达式文本。
 *
 *   - 数字与变量之间省略 `*`（`2x`）；
 *   - `+` / `-` 两侧带空格，`*` / `/` / `^` 紧贴；
 *   - 一元负号紧贴被运算数（`-x`、`-2x`）；
 *   - 函数调用写成 `sin(x)`；
 *   - 规避 `1 + -x` 这类难读形式：`+` 右侧是一元负号时折叠为 `-`，`-` 右侧折叠为 `+`；
 *   - 按优先级补括号，保证输出可被 `parseExpression` 原样解析回同一 AST。
 */
export function expressionToString(node: ExpressionNode, minPrecedence = 0): string {
  switch (node.kind) {
    case 'number':
      return formatNumber(node.value);

    case 'variable':
      return node.name;

    case 'call': {
      const text = `${node.name}(${node.args.map(arg => expressionToString(arg)).join(', ')})`;
      return minPrecedence > ATOM_PRECEDENCE ? `(${text})` : text;
    }

    case 'unary': {
      const text = `-${expressionToString(node.operand, UNARY_PRECEDENCE + 1)}`;
      return minPrecedence > UNARY_PRECEDENCE ? `(${text})` : text;
    }

    case 'binary': {
      const precedence = BINARY_PRECEDENCE[node.op];
      let text: string;

      if (node.op === '*' && node.left.kind === 'number' && node.right.kind === 'variable') {
        // 隐式乘法：2x
        text = `${formatNumber(node.left.value)}${node.right.name}`;
      } else if (node.op === '+') {
        const right = node.right;
        text = right.kind === 'unary'
          ? `${expressionToString(node.left, precedence)} - ${expressionToString(right.operand, precedence + 1)}`
          : `${expressionToString(node.left, precedence)} + ${expressionToString(node.right, precedence + 1)}`;
      } else if (node.op === '-') {
        const right = node.right;
        text = right.kind === 'unary'
          ? `${expressionToString(node.left, precedence)} + ${expressionToString(right.operand, precedence + 1)}`
          : `${expressionToString(node.left, precedence)} - ${expressionToString(node.right, precedence + 1)}`;
      } else if (node.op === '^') {
        // 右结合：x^y^z 表示 x^(y^z)
        text = `${expressionToString(node.left, precedence + 1)}^${expressionToString(node.right, precedence)}`;
      } else {
        text = `${expressionToString(node.left, precedence)}${node.op}${expressionToString(node.right, precedence + 1)}`;
      }

      return minPrecedence > precedence ? `(${text})` : text;
    }
  }
}
