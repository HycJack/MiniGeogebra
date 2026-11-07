/**
 * 数论命令族（对标官方 kernel/algos 的 AlgoGCD / AlgoLCM / AlgoMod /
 * AlgoDiv / AlgoIsPrime / AlgoNextPrime / AlgoPreviousPrime / AlgoPrimeFactors /
 * AlgoDivisorsList / AlgoDivisorsSum / AlgoBinomial / AlgoToBase / AlgoFromBase）。
 *
 * 纯算术：标量输出为静态 GeoNumeric（求值期定值，与既有数值命令通道一致）；
 * 列表输出（素因数/约数）走活算法——输入数值变动时重算，加载后重算回填自有子元素。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoList } from '../geo/GeoList';

/** 最大公约数（整数化；任一非有限 → NaN）。 */
export function gcd(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function lcm(a: number, b: number): number {
  const g = gcd(a, b);
  if (!Number.isFinite(g) || g === 0) return NaN;
  return Math.abs(Math.round(a) * Math.round(b)) / g;
}

/** 素性判定的试除（平方根界 + 6k±1 步进；教学量级足够）。 */
export function isPrime(n: number): boolean {
  if (!Number.isFinite(n)) return false;
  const m = Math.round(n);
  if (m < 2 || m !== n) return false;
  if (m < 4) return true;
  if (m % 2 === 0 || m % 3 === 0) return false;
  for (let i = 5; i * i <= m; i += 6) {
    if (m % i === 0 || m % (i + 2) === 0) return false;
  }
  return true;
}

export function nextPrime(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  let m = Math.max(2, Math.floor(n) + 1);
  while (!isPrime(m)) m++;
  return m;
}

export function previousPrime(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  let m = Math.ceil(n) - 1;
  while (m >= 2 && !isPrime(m)) m--;
  return m >= 2 ? m : NaN;
}

/** 素因数分解（升序带重复）：120 → [2, 2, 2, 3, 5]。 */
export function primeFactors(n: number): number[] {
  const m = Math.round(n);
  if (!Number.isFinite(m) || m < 2) return [];
  const out: number[] = [];
  let rest = m;
  for (let p = 2; p * p <= rest; p += p === 2 ? 1 : 2) {
    while (rest % p === 0) {
      out.push(p);
      rest /= p;
    }
  }
  if (rest > 1) out.push(rest);
  return out;
}

/** 全部正约数升序。 */
export function divisors(n: number): number[] {
  const m = Math.round(n);
  if (!Number.isFinite(m) || m < 1) return [];
  const small: number[] = [];
  const large: number[] = [];
  for (let d = 1; d * d <= m; d++) {
    if (m % d === 0) {
      small.push(d);
      if (d !== m / d) large.push(m / d);
    }
  }
  return [...small, ...large.reverse()];
}

/** 二项式系数 C(n, k)（整数精确域内用乘除累积，避免阶乘溢出）。 */
export function binomialCoefficient(n: number, k: number): number {
  const nn = Math.round(n);
  const kk = Math.round(k);
  if (!Number.isFinite(nn) || !Number.isFinite(kk) || kk < 0 || kk > nn) return NaN;
  let result = 1;
  for (let i = 1; i <= kk; i++) {
    result = (result * (nn - kk + i)) / i;
  }
  return Math.round(result);
}

/** 十进制整数 → base 进制文本（2–36；负数带负号）。 */
export function toBase(n: number, base: number): string {
  const m = Math.round(n);
  const b = Math.round(base);
  if (!Number.isFinite(m) || !Number.isFinite(b) || b < 2 || b > 36) return '';
  if (m === 0) return '0';
  const digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let rest = Math.abs(m);
  let out = '';
  while (rest > 0) {
    out = digits[rest % b] + out;
    rest = Math.floor(rest / b);
  }
  return m < 0 ? `-${out}` : out;
}

/** base 进制文本 → 十进制数（非法字符 → NaN）。 */
export function fromBase(text: string, base: number): number {
  const b = Math.round(base);
  if (!Number.isFinite(b) || b < 2 || b > 36) return NaN;
  const trimmed = text.trim().replace(/^[-+]/, '');
  if (trimmed === '') return NaN;
  let result = 0;
  for (const ch of trimmed.toUpperCase()) {
    const d = parseInt(ch, 36);
    if (Number.isNaN(d) || d >= b) return NaN;
    result = result * b + d;
  }
  return text.trim().startsWith('-') ? -result : result;
}

/** 约数和（σ(n)）。 */
export function divisorsSum(n: number): number {
  return divisors(n).reduce((s, d) => s + d, 0);
}

// ---------------------------------------------------------------------------

/** 素因数列表（活算法：输入数值变动重算；子元素为自有 GeoNumeric）。 */
export class AlgoPrimeFactors extends AlgoElement {
  private outputList: GeoList;

  constructor(kernel: IKernel, private n: GeoNumeric | number) {
    super(kernel);
    this.outputList = new GeoList(kernel, []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.n instanceof GeoNumeric ? [this.n] : [];
    this.setOutput([this.outputList]);
  }

  compute(): void {
    const value = typeof this.n === 'number' ? this.n : this.n.getValue();
    this.outputList.setChildren(primeFactors(value).map(p => new GeoNumeric(this.kernel, p)));
    this.outputList.setDefined();
  }

  getOutput(): GeoList { return this.outputList; }
  getN(): GeoNumeric | number { return this.n; }
}

/** 全部约数列表（活算法，同上）。 */
export class AlgoDivisorsList extends AlgoElement {
  private outputList: GeoList;

  constructor(kernel: IKernel, private n: GeoNumeric | number) {
    super(kernel);
    this.outputList = new GeoList(kernel, []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.n instanceof GeoNumeric ? [this.n] : [];
    this.setOutput([this.outputList]);
  }

  compute(): void {
    const value = typeof this.n === 'number' ? this.n : this.n.getValue();
    this.outputList.setChildren(divisors(value).map(d => new GeoNumeric(this.kernel, d)));
    this.outputList.setDefined();
  }

  getOutput(): GeoList { return this.outputList; }
  getN(): GeoNumeric | number { return this.n; }
}
