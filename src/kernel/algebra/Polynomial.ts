/**
 * 一元多项式工具 —— 从 AST 提取系数 + Durand-Kerner 全根求解。
 *
 * 用途：`Root(f)` 需要给出搜索区间内的**全部**实根，采样+二分会漏掉偶数重根；
 * 对多项式（代数表达式里最常见的情形）改走"提取系数 → 复平面迭代求全根"。
 * 非多项式表达式返回 null，调用方回退到数值扫描。
 */

import { ExpressionNode, Scope } from './ExpressionNode';
export type { ExpressionNode };

/**
 * 把表达式按 `variableName` 提取为多项式系数（**升幂**排列，coeffs[i] 是 x^i 的系数）。
 *
 * 支持 +、-、*、整数次幂 ^ 与数值常量；自由变量（滑块等）用 `scope` 的当前值代入，
 * 因此 `a*x^2 - 2` 在 a=3 时提取出 [-2, 0, 3]。出现 sin/cos/除以含 x 项等
 * 非多项式结构时返回 null。
 */
export function extractPolynomialCoefficients(
  node: ExpressionNode,
  variableName: string,
  scope: Scope,
): number[] | null {
  switch (node.kind) {
    case 'number':
      return [node.value];
    case 'variable': {
      if (node.name === variableName) return [0, 1];
      const value = scope.get(node.name);
      return value !== undefined && Number.isFinite(value) ? [value] : null;
    }
    case 'unary': {
      const inner = extractPolynomialCoefficients(node.operand, variableName, scope);
      return inner ? inner.map(c => -c) : null;
    }
    case 'binary': {
      const left = extractPolynomialCoefficients(node.left, variableName, scope);
      const right = extractPolynomialCoefficients(node.right, variableName, scope);
      if (!left || !right) return null;
      switch (node.op) {
        case '+':
          return polyAdd(left, right);
        case '-':
          return polyAdd(left, right.map(c => -c));
        case '*':
          return polyMul(left, right);
        case '/': {
          // 除数必须是常数多项式
          if (right.slice(1).some(c => c !== 0)) return null;
          const d = right[0];
          if (!Number.isFinite(d) || Math.abs(d) < 1e-15) return null;
          return left.map(c => c / d);
        }
        case '^': {
          // 指数必须是（可求值的）非负整数常量
          if (right.length > 1 || right[0] !== Math.trunc(right[0])) return null;
          const exponent = right[0];
          if (exponent < 0 || exponent > 32 || !Number.isInteger(exponent)) return null;
          let result = [1];
          for (let i = 0; i < exponent; i++) result = polyMul(result, left);
          return result;
        }
      }
      return null;
    }
    default:
      return null; // call（sin 等）不是多项式
  }
}

function polyAdd(a: number[], b: number[]): number[] {
  const out = new Array(Math.max(a.length, b.length)).fill(0);
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}

function polyMul(a: number[], b: number[]): number[] {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return out;
}

/**
 * Durand-Kerner（Weierstrass）迭代求多项式**全部复根**，返回其中实根（升序）。
 *
 * 输入为升幂系数。迭代对归一化后的多项式做复平面同步牛顿式迭代，
 * 初始点取 (0.4 + 0.9i)^k。系数来自用户表达式，可能出现病态缩放，
 * 因此先做首一化，收敛判据用相对步长。
 *
 * - `keepDuplicates`（对标 GeoGebra `Root[f]` 的 skipDoubleRoots=false）：
 *   保留重根的多次出现，不做间距去重；
 * - 每个实根都做**残差验收**（对标官方 Laguerre 后的 Brent 抛光 + 残差检查）：
 *   |p(r)| 超过系数量级的 1e-6 倍的"根"视为病态缩放下的伪根，丢弃。
 */
export function polynomialRealRoots(
  coeffsAscending: number[],
  options: { keepDuplicates?: boolean } = {},
): number[] {
  // 降幂排列。注意不能修剪低阶零系数：x³−2x 的常数项为 0 是有效信息（根 0）。
  const desc = [...coeffsAscending].reverse();
  const degree = desc.length - 1;
  if (degree < 1) return [];

  // 首一化
  const lead = desc[0];
  const c = desc.map(v => v / lead);

  // 复数用 [re, im] 二元组；初始点取 (0.4 + 0.9i)^k, k = 0..degree-1
  const roots: [number, number][] = [];
  let pr = 1, pi = 0;
  for (let k = 0; k < degree; k++) {
    roots.push([pr, pi]);
    const nr = pr * 0.4 - pi * 0.9;
    const ni = pr * 0.9 + pi * 0.4;
    pr = nr; pi = ni;
  }

  const evalPoly = (zr: number, zi: number): [number, number] => {
    let rr = c[0], ri = 0;
    for (let i = 1; i <= degree; i++) {
      const nr = rr * zr - ri * zi + c[i];
      const ni = rr * zi + ri * zr;
      rr = nr; ri = ni;
    }
    return [rr, ri];
  };

  const MAX_ITERATIONS = 200;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let maxMove = 0;
    for (let k = 0; k < degree; k++) {
      const [zr, zi] = roots[k];
      const [pr, pi] = evalPoly(zr, zi);
      const prLen2 = pr * pr + pi * pi;
      if (prLen2 < 1e-300) continue; // 已是根
      // 减去除以 f'(z) 的近似：分母 = ∏ (z_k - z_j), j≠k
      let dr = 1, di = 0;
      for (let j = 0; j < degree; j++) {
        if (j === k) continue;
        const wr = zr - roots[j][0];
        const wi = zi - roots[j][1];
        const nr = dr * wr - di * wi;
        const ni = dr * wi + di * wr;
        dr = nr; di = ni;
      }
      const dLen2 = dr * dr + di * di;
      if (dLen2 < 1e-300) continue;
      // delta = f(z) / ∏(z-z_j)
      const qr = (pr * dr + pi * di) / dLen2;
      const qi = (pi * dr - pr * di) / dLen2;
      const move = Math.hypot(qr, qi);
      const scale = Math.max(1, Math.hypot(zr, zi));
      roots[k] = [zr - qr, zi - qi];
      maxMove = Math.max(maxMove, move / scale);
    }
    if (maxMove < 1e-14) break;
  }

  // 收集实根：虚部相对模长足够小，再做残差验收
  const realRoots: number[] = [];
  for (const [rr, ri] of roots) {
    const modulus = Math.hypot(rr, ri);
    if (Math.abs(ri) <= 1e-7 * Math.max(1, modulus) && Number.isFinite(rr)) {
      // 迭代残差可能留下 ±1e-44 这类"伪零"，统一快照为 0
      const root = Math.abs(rr) < 1e-10 ? 0 : rr;
      if (residualOk(desc, degree, root)) realRoots.push(root);
    }
  }
  realRoots.sort((a, b) => a - b);
  if (options.keepDuplicates) return realRoots;
  // 去重（重根的 Durand-Kerner 邻近近似）
  return realRoots.filter((r, i, all) =>
    i === 0 || Math.abs(r - all[i - 1]) > 1e-6 * Math.max(1, Math.abs(r)));
}

/** 残差验收：|p(r)| 应远小于各项量级和（病态缩放下防伪根）。desc 为降幂系数。 */
function residualOk(desc: number[], _degree: number, r: number): boolean {
  let value = 0;
  let bound = 0;
  for (const c of desc) {
    value = value * r + c;
    bound = bound * Math.abs(r) + Math.abs(c);
  }
  if (!Number.isFinite(value)) return false;
  return Math.abs(value) <= 1e-6 * Math.max(bound, 1);
}

/**
 * 过 n 个点的插值多项式（升幂系数）。
 * 构造范德蒙德矩阵 V[i][j] = x_i^j 解线性方程组；x 有重复（竖直共线）时返回 null。
 */
export function interpolatePolynomial(points: { x: number; y: number }[]): number[] | null {
  const n = points.length;
  if (n < 2) return null;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(points[i].x - points[j].x) < 1e-12 * Math.max(1, Math.abs(points[i].x))) return null;
    }
  }
  // 增广矩阵 [V | y]
  const aug: number[][] = points.map(({ x, y }) => {
    const row = new Array(n + 1).fill(0);
    let power = 1;
    for (let j = 0; j < n; j++) {
      row[j] = power;
      power *= x;
    }
    row[n] = y;
    return row;
  });
  // 高斯消元（部分主元）
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivotRow][col])) pivotRow = r;
    }
    [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-14) return null;
    for (let j = col; j <= n; j++) aug[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (Math.abs(factor) < 1e-15) continue;
      for (let j = col; j <= n; j++) aug[r][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row[n]);
}

/** 把拟合文本收敛成可读的多项式字符串（升幂系数）。 */
export function polynomialExpressionText(coeffs: number[], variable = 'x'): string {
  const parts: string[] = [];
  for (let i = coeffs.length - 1; i >= 0; i--) {
    const c = coeffs[i];
    if (Math.abs(c) < 1e-12) continue;
    const sign = c < 0 ? '-' : '+';
    const abs = Math.abs(c);
    const mag = Math.round(abs * 1e6) / 1e6;
    const coefPart = i === 0 || mag !== 1 ? `${mag}` : '';
    const varPart = i === 0 ? '' : i === 1 ? variable : `${variable}^${i}`;
    const term = `${coefPart}${coefPart && varPart ? '*' : ''}${varPart}`;
    parts.push(parts.length === 0 ? (c < 0 ? `-${term}` : term) : ` ${sign} ${term}`);
  }
  return parts.length ? parts.join('') : '0';
}

/** 升幂系数 → 多项式 AST（跳过近零项；全零时为常数 0）。 */
export function polynomialAst(coeffs: number[], variable = 'x'): ExpressionNode {
  const num = (v: number): ExpressionNode => ({ kind: 'number', value: v });
  const term = (c: number, i: number): ExpressionNode => {
    const coef = num(c);
    if (i === 0) return coef;
    const p: ExpressionNode = i === 1
      ? { kind: 'variable', name: variable }
      : { kind: 'binary', op: '^', left: { kind: 'variable', name: variable }, right: num(i) };
    return c === 1 ? p : { kind: 'binary', op: '*', left: coef, right: p };
  };
  let acc: ExpressionNode | null = null;
  coeffs.forEach((c, i) => {
    if (Math.abs(c) < 1e-12) return;
    const t = term(Math.abs(c), i);
    if (acc === null) acc = c < 0 ? { kind: 'unary', op: '-', operand: t } : t;
    else acc = { kind: 'binary', op: c < 0 ? '-' : '+', left: acc, right: t };
  });
  return acc ?? num(0);
}
