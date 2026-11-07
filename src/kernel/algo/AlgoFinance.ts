/**
 * 金融命令族（对标官方 CmdFutureValue / CmdPayment / CmdPresentValue / CmdRate，
 * TABLE_FINANCIAL 组）：标准货币时间价值（TVM）公式，纯函数。
 *
 * 官方符号约定：rate 为**周期利率**、numPeriods 为期数、payment 为每期
 * 支付（负=流出）、type=1 表示期末支付在期初计息（annuity due）。
 */

/** 年金终值系数：((1+r)^n − 1)/r；r=0 退化为 n。 */
const annuityFactor = (r: number, n: number): number =>
  Math.abs(r) < 1e-12 ? n : (Math.pow(1 + r, n) - 1) / r;

export function futureValue(rate: number, numPeriods: number, payment: number, presentValue: number, type = 0): number {
  const n = Math.round(numPeriods);
  if (!Number.isFinite(rate) || !Number.isFinite(n) || n < 0) return NaN;
  const growth = Math.pow(1 + rate, n);
  return -(presentValue * growth + payment * annuityFactor(rate, n) * (1 + rate * type));
}

export function presentValue(rate: number, numPeriods: number, payment: number, futureValue: number, type = 0): number {
  const n = Math.round(numPeriods);
  if (!Number.isFinite(rate) || !Number.isFinite(n) || n < 0) return NaN;
  const growth = Math.pow(1 + rate, n);
  return -(futureValue + payment * annuityFactor(rate, n) * (1 + rate * type)) / growth;
}

export function payment(rate: number, numPeriods: number, presentValue: number, futureValue: number, type = 0): number {
  const n = Math.round(numPeriods);
  if (!Number.isFinite(rate) || !Number.isFinite(n) || n < 0) return NaN;
  if (Math.abs(rate) < 1e-12) return n === 0 ? NaN : -(presentValue + futureValue) / n;
  const growth = Math.pow(1 + rate, n);
  return -(presentValue * growth + futureValue) * rate / ((growth - 1) * (1 + rate * type));
}

/** Rate：解 TVM 方程 F(r) = pv·(1+r)^n + pmt·(1+r·type)·((1+r)^n−1)/r + fv = 0。
 *  牛顿迭代（带割线回退），guess 缺省 0.1；发散 → NaN。 */
export function rate(numPeriods: number, payment0: number, presentValue: number, futureValue: number, type = 0, guess = 0.1): number {
  const n = Math.round(numPeriods);
  if (!Number.isFinite(n) || n < 0) return NaN;
  const f = (r: number): number => {
    const growth = Math.pow(1 + r, n);
    return presentValue * growth + payment0 * (1 + r * type) * annuityFactor(r, n) + futureValue;
  };
  let r = Number.isFinite(guess) && guess > -1 ? guess : 0.1;
  for (let iter = 0; iter < 100; iter++) {
    const value = f(r);
    if (!Number.isFinite(value)) return NaN;
    if (Math.abs(value) < 1e-10 * Math.max(1, Math.abs(presentValue) + Math.abs(futureValue))) return r;
    // 数值导数（中心差分）
    const h = Math.max(1e-7, Math.abs(r) * 1e-6);
    const d = (f(r + h) - f(r - h)) / (2 * h);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-14) return NaN;
    let next = r - value / d;
    if (next <= -1) next = (r - 1) / 2; // 防越界（利率 > −100%）
    if (Math.abs(next - r) < 1e-14) return next;
    r = next;
  }
  return Math.abs(f(r)) < 1e-6 ? r : NaN;
}
