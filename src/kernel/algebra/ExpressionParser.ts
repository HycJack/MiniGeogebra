import { ExpressionNode } from './ExpressionNode';

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'leftParen' }
  | { type: 'rightParen' }
  | { type: 'comma' }
  | { type: 'equals' }
  | { type: 'eof' };

const BUILTIN_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sqrt', 'abs', 'exp', 'ln', 'log', 'floor', 'ceil', 'round', 'min', 'max',
]);

const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = /^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|^\.[0-9]+/.exec(input.slice(index));
      if (!match) throw new Error(`Invalid number at position ${index + 1}`);
      tokens.push({ type: 'number', value: Number(match[0]) });
      index += match[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(char)) {
      const match = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(input.slice(index))!;
      tokens.push({ type: 'identifier', value: match[0] });
      index += match[0].length;
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
    if (token.type === 'identifier') {
      if (this.peek().type === 'leftParen') {
        if (!BUILTIN_FUNCTIONS.has(token.value)) throw new Error(`Unknown function "${token.value}"`);
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
  private advanceOperator(value: '+' | '-' | '*' | '/' | '^'): { type: 'operator'; value: '+' | '-' | '*' | '/' | '^' } {
    const token = this.advance();
    if (token.type !== 'operator' || token.value !== value) {
      throw new Error(`Expected operator "${value}"`);
    }
    return token;
  }
  remainingTokens(): number { return this.tokens.length - this.index; }
}

export function parseExpression(input: string): ExpressionNode {
  const parser = new Parser(tokenize(input));
  const node = parser.parseExpression();
  parser.requireEof();
  return node;
}

export { BUILTIN_FUNCTIONS };
