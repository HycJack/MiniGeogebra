/**
 * 从表达式 AST 提取一般二次曲面的 10 个多项式系数（x,y,z 二次以内）。
 *
 * 对标 GeoGebra AlgoDependentQuadric3D 对 Equation normal form 的
 * getCoefficient("xx") 等提取；此处直接在 AST 上做多项式累积，
 * 自由变量用 scope 当前值代入（滑块活依赖）。
 *
 * 返回完整系数 [xx,yy,zz,const,xy,xz,yz,x,y,z]（未除 2），
 * 非多项式或次数 > 2 / 含未知变量时返回 null。
 */

import { ExpressionNode, Scope, collectVariables } from './ExpressionNode';

/** 单项式键 → 系数；只允许 total degree ≤ 2 的 x,y,z 单项。 */
type TermMap = Map<string, number>;

const DEG: Record<string, number> = {
  '1': 0,
  x: 1, y: 1, z: 1,
  x2: 2, y2: 2, z2: 2,
  xy: 2, xz: 2, yz: 2,
};

function keyMul(a: string, b: string): string | null {
  // 合并两个单项式（字母幂次表）
  const px = countVar(a, 'x') + countVar(b, 'x');
  const py = countVar(a, 'y') + countVar(b, 'y');
  const pz = countVar(a, 'z') + countVar(b, 'z');
  if (px > 2 || py > 2 || pz > 2 || px + py + pz > 2) return null;
  return monomialKey(px, py, pz);
}

function countVar(key: string, v: 'x' | 'y' | 'z'): number {
  if (key === '1') return 0;
  if (key === v) return 1;
  if (key === v + '2') return 2;
  // mixed: xy, xz, yz
  return key.includes(v) ? 1 : 0;
}

function monomialKey(px: number, py: number, pz: number): string {
  if (px === 0 && py === 0 && pz === 0) return '1';
  if (px === 2 && py === 0 && pz === 0) return 'x2';
  if (px === 0 && py === 2 && pz === 0) return 'y2';
  if (px === 0 && py === 0 && pz === 2) return 'z2';
  if (px === 1 && py === 1 && pz === 0) return 'xy';
  if (px === 1 && py === 0 && pz === 1) return 'xz';
  if (px === 0 && py === 1 && pz === 1) return 'yz';
  if (px === 1 && py === 0 && pz === 0) return 'x';
  if (px === 0 && py === 1 && pz === 0) return 'y';
  if (px === 0 && py === 0 && pz === 1) return 'z';
  return `x${px}y${py}z${pz}`; // degree≤2 内不会走到这里以外
}

const KEYS = ['x2', 'y2', 'z2', '1', 'xy', 'xz', 'yz', 'x', 'y', 'z'] as const;

function polyOf(node: ExpressionNode, scope: Scope, allowed: Set<string>): TermMap | null {
  switch (node.kind) {
    case 'number':
      return new Map([['1', node.value]]);
    case 'variable': {
      if (node.name === 'x' || node.name === 'y' || node.name === 'z') {
        if (!allowed.has(node.name)) return null;
        return new Map([[node.name, 1]]);
      }
      const value = scope.get(node.name);
      if (value === undefined || !Number.isFinite(value)) return null;
      return new Map([['1', value]]);
    }
    case 'unary': {
      const inner = polyOf(node.operand, scope, allowed);
      if (!inner) return null;
      const out: TermMap = new Map();
      for (const [k, v] of inner) out.set(k, -v);
      return out;
    }
    case 'binary': {
      if (node.op === '+' || node.op === '-') {
        const l = polyOf(node.left, scope, allowed);
        const r = polyOf(node.right, scope, allowed);
        if (!l || !r) return null;
        const out: TermMap = new Map(l);
        for (const [k, v] of r) {
          const nv = (out.get(k) ?? 0) + (node.op === '-' ? -v : v);
          if (nv === 0) out.delete(k);
          else out.set(k, nv);
        }
        return out;
      }
      if (node.op === '*') {
        const l = polyOf(node.left, scope, allowed);
        const r = polyOf(node.right, scope, allowed);
        if (!l || !r) return null;
        const out: TermMap = new Map();
        for (const [ka, va] of l) {
          for (const [kb, vb] of r) {
            const key = keyMul(ka, kb);
            if (key === null) return null; // degree > 2
            out.set(key, (out.get(key) ?? 0) + va * vb);
          }
        }
        for (const [k, v] of [...out]) if (Math.abs(v) < 1e-15) out.delete(k);
        return out;
      }
      if (node.op === '/') {
        const l = polyOf(node.left, scope, allowed);
        const r = polyOf(node.right, scope, allowed);
        if (!l || !r) return null;
        // 除数必须是常数
        if (r.size !== 1 || !r.has('1')) return null;
        const d = r.get('1')!;
        if (Math.abs(d) < 1e-15) return null;
        const out: TermMap = new Map();
        for (const [k, v] of l) out.set(k, v / d);
        return out;
      }
      if (node.op === '^') {
        // 指数必须是非负整数常量
        if (node.right.kind !== 'number') return null;
        const exp = node.right.value;
        if (!Number.isInteger(exp) || exp < 0 || exp > 8) return null;
        const base = polyOf(node.left, scope, allowed);
        if (!base) return null;
        let acc: TermMap = new Map([['1', 1]]);
        for (let i = 0; i < exp; i++) {
          const out: TermMap = new Map();
          for (const [ka, va] of acc) {
            for (const [kb, vb] of base) {
              const key = keyMul(ka, kb);
              if (key === null) return null;
              out.set(key, (out.get(key) ?? 0) + va * vb);
            }
          }
          acc = out;
        }
        for (const [k, v] of [...acc]) if (Math.abs(v) < 1e-15) acc.delete(k);
        return acc;
      }
      return null;
    }
    default:
      return null; // call: sin 等非多项式
  }
}

/**
 * 提取 lhs − rhs 的二次型系数。
 * @param allowedVars 方程允许的空间变量（默认 x,y,z）；其余变量须在 scope 中有值。
 * @returns [xx,yy,zz,const,xy,xz,yz,x,y,z] 或 null。
 */
export function extractQuadricCoeffs(
  lhs: ExpressionNode,
  rhs: ExpressionNode,
  scope: Scope = new Map(),
  allowedVars: Set<string> = new Set(['x', 'y', 'z']),
): number[] | null {
  // 未知自由变量（不在 scope、不在 allowed）→ 交给上层收集依赖后重试
  const vars = new Set<string>();
  collectVariables(lhs, vars);
  collectVariables(rhs, vars);
  for (const v of vars) {
    if (!allowedVars.has(v) && !scope.has(v)) return null;
  }

  const L = polyOf(lhs, scope, allowedVars);
  const R = polyOf(rhs, scope, allowedVars);
  if (!L || !R) return null;

  const diff: TermMap = new Map(L);
  for (const [k, v] of R) {
    const nv = (diff.get(k) ?? 0) - v;
    if (Math.abs(nv) < 1e-15) diff.delete(k);
    else diff.set(k, nv);
  }

  // 全零 → 退化
  if (diff.size === 0) return null;

  const get = (k: string) => diff.get(k) ?? 0;
  return [get('x2'), get('y2'), get('z2'), get('1'), get('xy'), get('xz'), get('yz'), get('x'), get('y'), get('z')];
}
