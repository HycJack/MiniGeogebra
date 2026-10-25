import { ExpressionNode } from './ExpressionNode';

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' | '^' | '>' | '<' | '>=' | '<=' | '==' | '!=' }
  | { type: 'leftParen' }
  | { type: 'rightParen' }
  | { type: 'comma' }
  | { type: 'equals' }
  | { type: 'string'; value: string }
  | { type: 'eof' };

const BUILTIN_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sqrt', 'abs', 'exp', 'ln', 'log', 'floor', 'ceil', 'round', 'min', 'max',
]);

/** 三角函数名（sin²(x) 幂简写只对三角函数生效，对标 GeoGebra FunctionParser）。 */
const TRIG_FUNCTIONS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan']);

const PI_LITERAL = '(3.141592653589793)';
const DEG_FACTOR = '3.141592653589793/180';

// ---------------------------------------------------------------------------
// 标识符切分提示（对标 GeoGebra 的上下文敏感词法）：
// 未知的多字母标识符按"已知变量/内建函数名"回溯切成隐式乘积 ——
//   xy → x·y、2xy → 2·x·y、xsin(x) → x·sin(x)
// 已知集合由调用方（EquationRecognizer / 序列化重建）按当前构造的标签提供。
// 未设置提示时行为与从前完全一致（保守报 Unknown variable/function）。
// 切分规则（防止把拼错的功能名变成离谱乘积）：
//   - 整体命中已知集/内建函数 → 不切；
//   - 紧跟 "("（调用位置）→ 仅当末段是内建函数名才切（xsin(x)），否则整体报错；
//   - 每段必须是已知变量或内建函数；函数段必须紧跟 "("。
// ---------------------------------------------------------------------------
let identifierHints: Set<string> | null = null;
export function withIdentifierHints<T>(hints: Set<string>, fn: () => T): T {
  const prev = identifierHints;
  identifierHints = hints;
  try {
    return fn();
  } finally {
    identifierHints = prev;
  }
}

function trySplitIdentifier(name: string, followedByParen: boolean): string[] | null {
  if (!identifierHints || identifierHints.size === 0) return null;
  if (name.length < 2) return null;
  if (BUILTIN_FUNCTIONS.has(name) || identifierHints.has(name)) return null;
  const parts: string[] = [];
  let pos = 0;
  while (pos < name.length) {
    let matched = false;
    for (let len = name.length - pos; len >= 1; len--) {
      const candidate = name.slice(pos, pos + len);
      const isBuiltin = BUILTIN_FUNCTIONS.has(candidate);
      const isKnown = isBuiltin || identifierHints.has(candidate);
      if (!isKnown) continue;
      const isLast = pos + len === name.length;
      if (isBuiltin && !identifierHints.has(candidate)) {
        // 函数名段必须紧跟 "("：段内看下一字符，末段看原文是否跟 "("
        const nextIsParen = isLast ? followedByParen : name[pos + len] === '(';
        if (!nextIsParen) continue;
      }
      if (isLast && followedByParen && !(isBuiltin && !identifierHints.has(candidate))) {
        // 调用位置的末段必须是内建函数名，否则这是"把拼错的函数名切成变量积"，
        // 报错比静默求出错误值好
        return null;
      }
      parts.push(candidate);
      pos += len;
      matched = true;
      break;
    }
    if (!matched) return null;
  }
  return parts.length >= 2 ? parts : null;
}

/** 标识符字符类（含希腊字母：角度标签 α/β… 可在表达式中引用，评审 U6）。 */
const IDENT_CHAR = /[0-9a-zA-Z_\u0370-\u03FF.]/;
const IDENT_START = /[a-zA-Z_\u0370-\u03FF]/;

/**
 * 输入预处理：把 GeoGebra 式语法糖改写成纯 ASCII 表达式。
 *   √9 / √(x+1) / √sin(x) → sqrt(...)（主元 = 括号组 / 数字 / 标识符 / 函数调用）
 *   π                     → 圆周率字面量
 *   45°                   → (45*π/180)——**括号化后缀**，优先级高于 ^：
 *                           45°^2 = (45°)²，2^45° = 2^(45°)（评审 I1）
 *   ² / ³                 → ^2 / ^3
 *   |x - 1|               → abs(x - 1)（竖线成对配对，不支持嵌套）
 * 非法用法（`√+3`、悬空 `°`）**抛错**而不是静默产出错误值（评审 I2）。
 * sin²(x) 经 ²→^2 后由 Parser.parseAtom 识别 `sin^2(...)` 并重组为 (sin(...))²。
 */
export function preprocessInput(input: string): string {
  let s = input.replace(/²/g, '^2').replace(/³/g, '^3');
  // GeoGebra 式比较符：≥/≤/≠ 归一化为 ASCII（条件显隐表达式用）
  s = s.replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≠/g, '!=');
  s = replaceAbsBars(s);
  s = replaceDegrees(s);
  s = s.replace(/π/g, PI_LITERAL);
  s = replaceSqrt(s);
  return s;
}

/**
 * ° 后缀 → `(操作数*π/180)`：向回扫描操作数（数字字面量 / 标识符（含希腊）/
 * 平衡括号组），整体加括号使 ° 的绑定优先级高于 ^ 与隐式乘法。
 */
function replaceDegrees(s: string): string {
  let idx = s.indexOf('°');
  while (idx !== -1) {
    let j = idx;
    while (j > 0 && /\s/.test(s[j - 1])) j--;
    let start = -1;
    if (j > 0 && s[j - 1] === ')') {
      let depth = 0;
      let k = j;
      while (k > 0) {
        k--;
        if (s[k] === ')') depth++;
        else if (s[k] === '(') {
          depth--;
          if (depth === 0) { start = k; break; }
        }
      }
      if (start === -1) throw new Error('Unbalanced parentheses before "°"');
    } else if (j > 0 && IDENT_CHAR.test(s[j - 1])) {
      let k = j;
      while (k > 0 && IDENT_CHAR.test(s[k - 1])) k--;
      start = k;
    } else {
      throw new Error('Invalid use of "°" (no operand)');
    }
    const operand = s.slice(start, j);
    s = `${s.slice(0, start)}((${operand})*${DEG_FACTOR})${s.slice(idx + 1)}`;
    idx = s.indexOf('°');
  }
  return s;
}

/** |expr| → abs(expr)：从左到右成对配对竖线；不成对的竖线原样保留（交给 tokenizer 报错）。 */
function replaceAbsBars(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '|') {
      const close = s.indexOf('|', i + 1);
      if (close === -1) { out += s[i]; i++; continue; }
      out += `abs(${s.slice(i + 1, close)})`;
      i = close + 1;
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

/**
 * √ → sqrt(操作数)：操作数 = 平衡括号组 / 数字字面量 / 标识符（含希腊）/
 * 「标识符 + 括号组」（√sin(x) → sqrt(sin(x))）。从右向左逐个替换以支持
 * 嵌套（√√4 → sqrt(sqrt(4))）；前邻是操作数时补显式乘号（x√y → x*sqrt(y)）；
 * 无合法操作数**抛错**（评审 I2：不再静默产出 `sqrt+3` 这类错误值）。
 */
function replaceSqrt(s: string): string {
  let idx = s.lastIndexOf('√');
  while (idx !== -1) {
    let i = idx + 1;
    while (i < s.length && /\s/.test(s[i])) i++;
    let operand: string | null = null;
    let next = i;
    if (i < s.length && s[i] === '(') {
      let depth = 0;
      let j = i;
      for (; j < s.length; j++) {
        if (s[j] === '(') depth++;
        else if (s[j] === ')') { depth--; if (depth === 0) { j++; break; } }
      }
      if (depth !== 0) throw new Error('Unbalanced parentheses after "√"');
      operand = s.slice(i, j);
      next = j;
    } else if (i < s.length && /[0-9.]/.test(s[i])) {
      const m = /^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|^\.[0-9]+/.exec(s.slice(i));
      if (m) { operand = m[0]; next = i + m[0].length; }
    } else if (i < s.length && IDENT_START.test(s[i])) {
      const m = /^[a-zA-Z_\u0370-\u03FF][a-zA-Z0-9_\u0370-\u03FF]*/.exec(s.slice(i))!;
      operand = m[0];
      next = i + m[0].length;
      // 标识符后紧跟括号组 → 是函数调用，一并纳入操作数（√sin(x) → sqrt(sin(x))）
      if (next < s.length && s[next] === '(') {
        let depth = 0;
        let j = next;
        for (; j < s.length; j++) {
          if (s[j] === '(') depth++;
          else if (s[j] === ')') { depth--; if (depth === 0) { j++; break; } }
        }
        if (depth !== 0) throw new Error('Unbalanced parentheses after "√"');
        operand = s.slice(i, j);
        next = j;
      }
    }
    if (operand === null) throw new Error('Invalid use of "√" (no operand)');
    // 前邻是操作数字符 → 补显式乘号（x√y → x*sqrt(y)，否则 tokenizer 会粘成 xsqrt）
    const sep = idx > 0 && IDENT_CHAR.test(s[idx - 1]) ? '*' : '';
    s = `${s.slice(0, idx)}${sep}sqrt(${operand})${s.slice(next)}`;
    idx = s.lastIndexOf('√');
  }
  return s;
}

const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === '"' || char === "'") {
      // 字符串字面量（动态文本 "面积 = " + a 用）；支持 " 转义
      const quote = char;
      let value = '';
      index++;
      while (index < input.length && input[index] !== quote) {
        if (input[index] === '\\' && index + 1 < input.length) {
          value += input[index + 1];
          index += 2;
          continue;
        }
        value += input[index];
        index++;
      }
      if (index >= input.length) throw new Error(`Unterminated string at end of input`);
      index++; // closing quote
      tokens.push({ type: 'string', value });
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const rest = input.slice(index);
      const match = /^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|^\.[0-9]+/.exec(rest);
      if (!match) throw new Error(`Invalid number at position ${index + 1}`);
      // `1.2.3` 一类：数字后紧跟另一段小数点 —— 报错而非静默按隐式乘法粘成 1.2·0.3
      const after = match[0].length;
      if (rest[after] === '.' && /[0-9]/.test(rest[after + 1] ?? '')) {
        throw new Error(`Invalid number at position ${index + after + 1}`);
      }
      tokens.push({ type: 'number', value: Number(match[0]) });
      index += match[0].length;
      continue;
    }
    if (/[a-zA-Z_\u0370-\u03FF]/.test(char)) {
      const match = /^[a-zA-Z_\u0370-\u03FF][a-zA-Z0-9_\u0370-\u03FF]*/.exec(input.slice(index))!;
      const name = match[0];
      // 未知多字母标识符 → 按已知变量/函数名切成隐式乘积（xy → x·y）
      const followedByParen = /^\s*\(/.test(input.slice(index + name.length));
      const splitParts = trySplitIdentifier(name, followedByParen);
      if (splitParts) {
        for (const part of splitParts) tokens.push({ type: 'identifier', value: part });
      } else {
        tokens.push({ type: 'identifier', value: name });
      }
      index += name.length;
      continue;
    }
    if ('><'.includes(char) || (char === '=' && input[index + 1] === '=') || (char === '!' && input[index + 1] === '=')) {
      const two = input.slice(index, index + 2);
      if (two === '>=' || two === '<=' || two === '==' || two === '!=') {
        tokens.push({ type: 'operator', value: two });
        index += 2;
        continue;
      }
      tokens.push({ type: 'operator', value: char as '>' | '<' });
      index++;
      continue;
    }
    if ('+-*/^'.includes(char)) {
      tokens.push({ type: 'operator', value: char as '+' | '-' | '*' | '/' | '^' });
      index++;
      continue;
    }
    if (char === '(') { tokens.push({ type: 'leftParen' }); index++; continue; }
    if (char === ')') { tokens.push({ type: 'rightParen' }); index++; continue; }
    if (char === ',') { tokens.push({ type: 'comma' }); index++; continue; }
    if (char === '=') { tokens.push({ type: 'equals' }); index++; continue; }
    throw new Error(`Unsupported character "${char}" at position ${index + 1}`);
  }
  tokens.push({ type: 'eof' });
  return tokens;
};

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parseExpression(): ExpressionNode {
    return this.parseRelational();
  }

  /** 关系层（最低优先级）：比较运算产出 1/0，供条件显隐表达式。 */
  private parseRelational(): ExpressionNode {
    let left = this.parseArith();
    while (true) {
      const token = this.peek();
      if (token.type === 'operator' && (token.value === '>' || token.value === '<' || token.value === '>=' || token.value === '<=' || token.value === '==' || token.value === '!=')) {
        const op = (token as { value: '>' | '<' | '>=' | '<=' | '==' | '!=' }).value;
        this.index++;
        const right = this.parseArith();
        left = { kind: 'binary', op, left, right };
      } else break;
    }
    return left;
  }

  private parseArith(): ExpressionNode {
    let left = this.parseTerm();
    let token = this.peek();
    while (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
      const op = this.advanceOperator(token.value).value;
      left = { kind: 'binary', op, left, right: this.parseTerm() };
      token = this.peek();
    }
    return left;
  }

  private parseTerm(): ExpressionNode {
    let left = this.parseUnary();
    while (true) {
      const token = this.peek();
      if (token.type === 'operator' && (token.value === '*' || token.value === '/')) {
        const op = this.advanceOperator(token.value).value;
        left = { kind: 'binary', op, left, right: this.parseUnary() };
      } else if (this.isOperandStart(token)) {
        left = { kind: 'binary', op: '*', left, right: this.parseUnary() };
      } else {
        return left;
      }
    }
  }

  private parseUnary(): ExpressionNode {
    const token = this.peek();
    if (token.type === 'operator' && (token.value === '-' || token.value === '+')) {
      const op = this.advanceOperator(token.value).value;
      if (op === '+') return this.parseUnary();
      if (op !== '-') throw new Error('Expected unary operator');
      return { kind: 'unary', op, operand: this.parseUnary() };
    }
    return this.parsePower();
  }

  private parsePower(): ExpressionNode {
    const atom = this.parseAtom();
    const token = this.peek();
    if (token.type === 'operator' && token.value === '^') {
      const op = this.advanceOperator(token.value).value;
      return { kind: 'binary', op, left: atom, right: this.parseUnary() };
    }
    return atom;
  }

  private parseAtom(): ExpressionNode {
    const token = this.advance();
    if (token.type === 'number') return { kind: 'number', value: token.value };
    if (token.type === 'string') return { kind: 'string', value: token.value };
    if (token.type === 'identifier') {
      if (this.peek().type === 'leftParen') {
        // 非内建函数名也建 call 节点：表达式内调用用户函数（f(2)）由此支撑，
        // 未知名字的校验由识别器的依赖收集承担（报错语义保留，延后到解析后）
        this.advance();
        const args: ExpressionNode[] = [];
        if (this.peek().type !== 'rightParen') {
          args.push(this.parseExpression());
          while (this.peek().type === 'comma') {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        if (this.advance().type !== 'rightParen') throw new Error('Missing ")"');
        return { kind: 'call', name: token.value, args };
      }
      // sin^2(x) 幂简写（sin²(x) 预处理后形态）：重组为 (sin(x))^2，
      // 对标 GeoGebra FunctionParser.buildTrigPower。
      if (TRIG_FUNCTIONS.has(token.value) && this.peek().type === 'operator' && (this.peek() as any).value === '^') {
        this.advance(); // '^'
        const exp = this.advance();
        if (exp.type !== 'number' || !Number.isInteger(exp.value)) {
          throw new Error(`Invalid exponent after "${token.value}^"`);
        }
        if (this.advance().type !== 'leftParen') throw new Error(`"${token.value}^n" expects "(args)"`);
        const args: ExpressionNode[] = [];
        if (this.peek().type !== 'rightParen') {
          args.push(this.parseExpression());
          while (this.peek().type === 'comma') {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        if (this.advance().type !== 'rightParen') throw new Error('Missing ")"');
        const call: ExpressionNode = { kind: 'call', name: token.value, args };
        return { kind: 'binary', op: '^', left: call, right: { kind: 'number', value: exp.value } };
      }
      return { kind: 'variable', name: token.value };
    }
    if (token.type === 'leftParen') {
      const expression = this.parseExpression();
      if (this.advance().type !== 'rightParen') throw new Error('Missing ")"');
      return expression;
    }
    throw new Error(token.type === 'eof' ? 'Incomplete expression' : `Unexpected token at position ${this.index}`);
  }

  requireEof(): void {
    const token = this.advance();
    if (token.type !== 'eof') {
      throw new Error('Unexpected text after expression');
    }
  }

  private isOperandStart(token: Token): boolean {
    return token.type === 'number' || token.type === 'identifier' || token.type === 'leftParen';
  }

  private peek(): Token { return this.tokens[this.index]; }
  private advance(): Token { return this.tokens[this.index++]; }
  private advanceOperator(value: '+' | '-' | '*' | '/' | '^' | '>' | '<' | '>=' | '<=' | '==' | '!='): { type: 'operator'; value: '+' | '-' | '*' | '/' | '^' | '>' | '<' | '>=' | '<=' | '==' | '!=' } {
    const token = this.advance();
    if (token.type !== 'operator' || token.value !== value) {
      throw new Error(`Expected operator "${value}"`);
    }
    return token;
  }
  remainingTokens(): number { return this.tokens.length - this.index; }
}

export function parseExpression(input: string): ExpressionNode {
  const parser = new Parser(tokenize(preprocessInput(input)));
  const node = parser.parseExpression();
  parser.requireEof();
  return node;
}

export { BUILTIN_FUNCTIONS };
